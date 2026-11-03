import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  const DEFAULT_REKAPAN_GAS_URL =
    'https://script.google.com/macros/s/AKfycbwf4HgF7IVU7Hthn_fqlruBTdEwOvkcP6BEE5YXCvLSCKVFtGNtsBtIirJk8a39q4AV/exec';

  // Helper function to call Google Apps Script POST properly (following 302 redirect with GET as required by GAS)
  async function postToGoogleAppsScript(targetUrl: string, bodyObj: unknown): Promise<string> {
    const initialRes = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(bodyObj),
      redirect: 'manual',
    });

    if ([301, 302, 303, 307, 308].includes(initialRes.status)) {
      const redirectUrl = initialRes.headers.get('location');
      if (redirectUrl) {
        const followRes = await fetch(redirectUrl, {
          method: 'GET',
          redirect: 'follow',
        });
        return await followRes.text();
      }
    }

    return await initialRes.text();
  }

  function normalizeUptServerKey(upt: string): string {
    const raw = String(upt || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .replace(/^UPT\s+/, '')
      .replace(/^SMP NEGERI\b/, 'SMPN')
      .replace(/^SD NEGERI INPRES\b/, 'SD INPRES')
      .replace(/^SDN INPRES\b/, 'SD INPRES')
      .replace(/^SD NEGERI\b/, 'SDN');
    if (raw.startsWith('DINAS PENDIDIKAN')) return 'DINAS PENDIDIKAN';
    return raw;
  }

  function parseAkunAplikasiSheetMatrix(rows: any[][]): any[] {
    if (!Array.isArray(rows) || rows.length <= 1) return [];
    const result: any[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!Array.isArray(r)) continue;
      const namaUpt = String(r[5] || '').trim();
      const username = String(r[2] || '').trim();
      if (!namaUpt && !username) continue;
      result.push({
        id: String(r[0] || `upt-${i}`).trim(),
        name: String(r[1] || '').trim(),
        username,
        password: String(r[3] || '').trim(),
        role: String(r[4] || 'Operator BOSP').trim(),
        namaUpt: namaUpt || String(r[1] || '').trim(),
        createdAt: String(r[6] || '').trim(),
        npsn: String(r[7] || '-').trim(),
        kecamatan: String(r[8] || 'Minahasa Tenggara').trim(),
        kepalaSekolah: String(r[9] || '').trim(),
        nipKepalaSekolah: String(r[10] || '').trim(),
        bendahara: String(r[11] || '').trim(),
        nipBendahara: String(r[12] || '').trim(),
        pengurusBarang: String(r[13] || r[1] || '').trim(),
        nipPengurusBarang: String(r[14] || '').trim(),
      });
    }
    return result;
  }

  // Live in-memory mirror of synced Google Spreadsheet sheets so newly saved changes from Menu Data Umum
  // or Database Spreadsheet are immediately reflected and never overwritten by a slow GAS read
  let liveSyncedSheetsCache: Record<string, any[][]> = {};
  let lastDirectSyncTimestamp = 0;

  async function fetchLiveSpreadsheetAccounts(targetUrl: string): Promise<any[]> {
    // If a direct sync of 6_AKUN_APLIKASI just occurred within the last 30 seconds, return the newly synced accounts immediately
    if (
      Date.now() - lastDirectSyncTimestamp < 30000 &&
      Array.isArray(liveSyncedSheetsCache['6_AKUN_APLIKASI']) &&
      liveSyncedSheetsCache['6_AKUN_APLIKASI'].length > 1
    ) {
      const cached = parseAkunAplikasiSheetMatrix(liveSyncedSheetsCache['6_AKUN_APLIKASI']);
      if (cached.length > 0) return cached;
    }

    const separator = String(targetUrl).includes('?') ? '&' : '?';
    try {
      const response = await fetch(`${targetUrl}${separator}action=getSchools`, {
        method: 'GET',
        redirect: 'follow',
      });
      const text = await response.text();
      const data = JSON.parse(text);

      if ((data.status === 'success' || data.success === true) && Array.isArray(data.schools) && data.schools.length > 0) {
        return data.schools;
      }

      if (data.sheets && Array.isArray(data.sheets['6_AKUN_APLIKASI'])) {
        liveSyncedSheetsCache = { ...data.sheets, ...liveSyncedSheetsCache };
        const parsedFromSheet = parseAkunAplikasiSheetMatrix(data.sheets['6_AKUN_APLIKASI']);
        if (parsedFromSheet.length > 0) {
          return parsedFromSheet;
        }
      }
    } catch {
      // Try POST pullAll fallback
    }

    try {
      const postText = await postToGoogleAppsScript(targetUrl, { action: 'pullAll' });
      const postData = JSON.parse(postText);
      if (Array.isArray(postData.schools) && postData.schools.length > 0) {
        return postData.schools;
      }
      if (postData.sheets && Array.isArray(postData.sheets['6_AKUN_APLIKASI'])) {
        liveSyncedSheetsCache = { ...postData.sheets, ...liveSyncedSheetsCache };
        return parseAkunAplikasiSheetMatrix(postData.sheets['6_AKUN_APLIKASI']);
      }
    } catch {
      // Ignore
    }

    if (Array.isArray(liveSyncedSheetsCache['6_AKUN_APLIKASI'])) {
      return parseAkunAplikasiSheetMatrix(liveSyncedSheetsCache['6_AKUN_APLIKASI']);
    }

    return [];
  }

  // Legacy shared-state endpoint disabled (Local Database Removed - Using Spreadsheet Database Only)
  app.all('/api/shared-state', (_req, res) => {
    return res.json({
      success: true,
      spreadsheetOnly: true,
      state: null,
    });
  });

  // Database Spreadsheet Proxy for fetching UPT schools list exclusively from Sheet 6_AKUN_APLIKASI
  app.all('/api/auth/gas-schools', async (req, res) => {
    try {
      const rawUrl = (req.body && req.body.gasUrl) || (req.query && req.query.gasUrl) || '';
      const targetUrl =
        rawUrl && !String(rawUrl).includes('AKfycbxn2Boqw')
          ? String(rawUrl)
          : DEFAULT_REKAPAN_GAS_URL;

      const schools = await fetchLiveSpreadsheetAccounts(targetUrl);
      return res.json({
        status: 'success',
        success: true,
        schools,
        source: 'spreadsheet-6_AKUN_APLIKASI',
      });
    } catch (err) {
      return res.status(200).json({
        status: 'error',
        success: false,
        schools: [],
        message: err instanceof Error ? err.message : 'Gagal membaca 6_AKUN_APLIKASI dari Google Spreadsheet',
      });
    }
  });

  // Database Spreadsheet Login Proxy exclusively based on Sheet 6_AKUN_APLIKASI in Google Spreadsheet
  app.post('/api/auth/gas-login', async (req, res) => {
    try {
      const { username, email, password, upt, namaUpt, gasUrl } = req.body || {};
      const targetUser = String(username || email || '').trim();
      const targetPass = String(password || '').trim();
      const targetUpt = String(namaUpt || upt || '').trim();
      const targetUrl =
        gasUrl && !String(gasUrl).includes('AKfycbxn2Boqw')
          ? String(gasUrl)
          : DEFAULT_REKAPAN_GAS_URL;

      // 1. Direct verification via Google Apps Script action: 'login' on Sheet 6_AKUN_APLIKASI
      try {
        const text = await postToGoogleAppsScript(targetUrl, {
          action: 'login',
          username: targetUser,
          password: targetPass,
          upt: targetUpt,
          namaUpt: targetUpt,
        });

        const data = JSON.parse(text);
        if (data.status === 'success' || data.success === true) {
          return res.json({
            success: true,
            user: data.user || data.data,
          });
        }
        if (data.message && String(data.message).includes('6_AKUN_APLIKASI')) {
          return res.json({
            success: false,
            message: data.message,
          });
        }
      } catch {
        // Fallback to reading Sheet 6_AKUN_APLIKASI directly from Google Spreadsheet
      }

      // 2. Verify directly against live rows pulled from Sheet 6_AKUN_APLIKASI in Google Spreadsheet
      const liveAccounts = await fetchLiveSpreadsheetAccounts(targetUrl);
      if (liveAccounts.length > 0) {
        const normTargetUpt = normalizeUptServerKey(targetUpt);
        const matchedAccount = liveAccounts.find((s: any) => {
          const sUser = String(s.username || '').trim().toLowerCase();
          const sPass = String(s.password || '').trim();
          const sNpsn = String(s.npsn || '').trim().toLowerCase();
          const userMatch =
            sUser === targetUser.toLowerCase() || (sNpsn && sNpsn !== '-' && sNpsn === targetUser.toLowerCase());
          return userMatch && sPass === targetPass;
        });

        if (matchedAccount) {
          const accUpt = String(matchedAccount.namaUpt || matchedAccount.upt || '').trim();
          if (normTargetUpt && accUpt && normalizeUptServerKey(accUpt) !== normTargetUpt) {
            return res.json({
              success: false,
              message: `Username & Password ini terdaftar di 6_AKUN_APLIKASI untuk UPT "${accUpt}", tidak sesuai dengan UPT yang dipilih ("${targetUpt}").`,
            });
          }

          const isAdmin =
            String(matchedAccount.role || '').toLowerCase().includes('admin') ||
            String(matchedAccount.username || '').toLowerCase() === 'admin_disdik' ||
            normalizeUptServerKey(accUpt) === 'DINAS PENDIDIKAN';

          const resolvedRole = isAdmin ? 'Admin' : 'Operator BOSP';

          return res.json({
            success: true,
            user: {
              id: String(matchedAccount.id || 'upt-1'),
              name: matchedAccount.pengurusBarang || matchedAccount.name || matchedAccount.kepalaSekolah || `Operator ${accUpt}`,
              username: matchedAccount.username,
              role: resolvedRole,
              namaUpt: accUpt,
              upt: accUpt,
              schoolName: accUpt,
              npsn: matchedAccount.npsn,
              kecamatan: matchedAccount.kecamatan,
              kepalaSekolah: matchedAccount.kepalaSekolah,
              nipKepalaSekolah: matchedAccount.nipKepalaSekolah,
              bendahara: matchedAccount.bendahara,
              nipBendahara: matchedAccount.nipBendahara,
              pengurusBarang: matchedAccount.pengurusBarang || matchedAccount.name,
              nipPengurusBarang: matchedAccount.nipPengurusBarang,
            },
            schoolAccount: {
              id: String(matchedAccount.id || 'upt-1'),
              upt: accUpt,
              npsn: matchedAccount.npsn || '-',
              kecamatan: matchedAccount.kecamatan || 'Minahasa Tenggara',
              username: matchedAccount.username,
              password: matchedAccount.password,
              role: resolvedRole,
              kepalaSekolah: matchedAccount.kepalaSekolah,
              nipKepalaSekolah: matchedAccount.nipKepalaSekolah,
              bendahara: matchedAccount.bendahara,
              nipBendahara: matchedAccount.nipBendahara,
              pengurusBarang: matchedAccount.pengurusBarang || matchedAccount.name,
              nipPengurusBarang: matchedAccount.nipPengurusBarang,
            },
          });
        }
      }

      return res.json({
        success: false,
        message: 'Username, Password, atau Pilihan UPT tidak cocok dengan data pada lembar 6_AKUN_APLIKASI di Google Spreadsheet.',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error jaringan';
      return res.status(500).json({
        success: false,
        message: 'Gagal memverifikasi akun di 6_AKUN_APLIKASI Google Spreadsheet: ' + errorMessage,
      });
    }
  });

  // Proxy GET/POST for Rekapan Se-Dinas Apps Script status & data fetch
  app.all('/api/rekapan-gas/status', async (req, res) => {
    try {
      const targetUrl =
        (req.body && req.body.gasUrl) ||
        (req.query && req.query.gasUrl) ||
        DEFAULT_REKAPAN_GAS_URL;
      const action = (req.body && req.body.action) || (req.query && req.query.action) || '';
      const separator = String(targetUrl).includes('?') ? '&' : '?';
      const fullUrl = action ? `${targetUrl}${separator}action=${encodeURIComponent(String(action))}` : String(targetUrl);

      const response = await fetch(fullUrl, {
        method: 'GET',
        redirect: 'follow',
      });
      const text = await response.text();

      try {
        const data = JSON.parse(text);
        if (data.status === 'success' || data.success === true) {
          return res.json({
            connected: true,
            sheetInitialized: true,
            status: 'success',
            message: data.message || 'Terhubung ke Google Apps Script Rekapan Se-Dinas.',
            data: data.data || [],
            sheets: data.sheets || null,
          });
        }
        if (data.message && String(data.message).includes('Sheet tidak ditemukan')) {
          return res.json({
            connected: true,
            sheetInitialized: false,
            status: 'connected_needs_init',
            message:
              'Terhubung ke Web App Google Apps Script! Lembar kerja "2_REKAPAN_SE_DINAS" belum dibuat di Spreadsheet. Silakan klik "Kirim / Sinkronkan Data Sekarang" atau jalankan menu "📋 Rekapan Se-Dinas" di Google Sheets.',
            data: [],
          });
        }
        return res.json({
          connected: true,
          sheetInitialized: false,
          status: data.status || 'warning',
          message: data.message || 'Web App merespon tetapi belum ada data rekapan.',
          data: data.data || [],
        });
      } catch {
        const isHtmlError = text.includes('<!DOCTYPE html>') || text.includes('<html');
        return res.json({
          connected: false,
          sheetInitialized: false,
          status: 'error',
          message: isHtmlError
            ? 'Web App Google Apps Script merespon dengan halaman HTML (pastikan akses disetel ke "Anyone / Siapa saja").'
            : 'Respon dari Web App bukan format JSON yang valid.',
          raw: text.slice(0, 300),
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Gagal menghubungi Google Apps Script';
      return res.status(200).json({
        connected: false,
        sheetInitialized: false,
        status: 'error',
        message: errorMessage,
      });
    }
  });

  // Proxy POST for pushing / syncing application database sheets to Rekapan Se-Dinas Apps Script
  app.post('/api/rekapan-gas/sync', async (req, res) => {
    try {
      const { gasUrl, payload } = req.body || {};
      const targetUrl = gasUrl || DEFAULT_REKAPAN_GAS_URL;

      // Immediately update live in-memory mirror so any subsequent pull or login reflects the change instantly
      if (payload && payload.sheets && typeof payload.sheets === 'object') {
        liveSyncedSheetsCache = {
          ...liveSyncedSheetsCache,
          ...payload.sheets,
        };
        lastDirectSyncTimestamp = Date.now();
      }

      const text = await postToGoogleAppsScript(targetUrl, payload || { action: 'syncAll' });

      if (
        text.includes('Script function not found: doPost') ||
        text.includes(' fungsi doPost') ||
        text.includes('Script function not found')
      ) {
        return res.status(200).json({
          success: false,
          needsScriptUpdate: true,
          message:
            'Koneksi ke URL Web App berhasil, tetapi Deployment Google Apps Script Anda masih menggunakan versi kode lama yang belum memiliki fungsi "doPost(e)". Silakan klik tab "Source Code Script (.gs)", salin kode terbaru, tempel di Apps Script Editor, lalu klik Deploy > Manage deployments > Edit (ikon pensil) > Version: New version > Deploy.',
        });
      }

      try {
        const data = JSON.parse(text);
        if (data.status === 'success' || data.success === true) {
          return res.json({
            success: true,
            message:
              data.message ||
              'Seluruh lembar kerja berhasil disinkronkan ke Google Spreadsheet Rekapan Se-Dinas!',
            summary: data.summary || null,
          });
        }
        if (data.message && String(data.message).includes('Sheet tidak ditemukan')) {
          return res.json({
            success: false,
            needsScriptUpdate: true,
            message:
              'Deployment Web App Anda masih menjalankan fungsi lama (Sheet "2_REKAPAN_SE_DINAS" belum dibuat otomatis). Silakan perbarui kode di tab "Source Code Script (.gs)" dan pilih Deploy > Manage deployments > Edit > New version > Deploy.',
          });
        }
        return res.json({
          success: false,
          message: data.message || data.error || 'Gagal menyinkronkan data ke Google Apps Script.',
        });
      } catch {
        const isPermissionHtml =
          text.includes('accounts.google.com') ||
          text.includes('Sign in') ||
          text.includes('Perlu izin');
        return res.json({
          success: false,
          needsScriptUpdate: true,
          message: isPermissionHtml
            ? 'Akses Web App Google Apps Script belum disetel ke "Anyone / Siapa saja". Pada Google Apps Script, pilih Deploy > Manage deployments > Edit > Who has access: Anyone > Deploy.'
            : 'Deployment Google Apps Script belum memiliki fungsi penerima sinkronisasi doPost(e) terbaru. Silakan salin kode terbaru di tab "Source Code Script (.gs)" lalu pilih Deploy > Manage deployments > Edit (ikon pensil) > Version: New version > Deploy.',
          raw: text.slice(0, 300),
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error jaringan';
      return res.status(200).json({
        success: false,
        message: 'Gagal mengirim data ke Google Apps Script: ' + errorMessage,
      });
    }
  });

  // Proxy POST/GET for pulling all 6 sheets from Google Apps Script back into the Application
  app.all('/api/rekapan-gas/pull', async (req, res) => {
    try {
      const targetUrl =
        (req.body && req.body.gasUrl) ||
        (req.query && req.query.gasUrl) ||
        DEFAULT_REKAPAN_GAS_URL;

      const isRecentDirectSync = Date.now() - lastDirectSyncTimestamp < 30000;

      // 1. Try POST with { action: 'pullAll' } first
      try {
        const postText = await postToGoogleAppsScript(String(targetUrl), {
          action: 'pullAll',
        });
        const postData = JSON.parse(postText);
        if (
          (postData.status === 'success' || postData.success === true) &&
          postData.sheets &&
          typeof postData.sheets === 'object'
        ) {
          const mergedSheets = isRecentDirectSync
            ? { ...postData.sheets, ...liveSyncedSheetsCache }
            : postData.sheets;
          liveSyncedSheetsCache = mergedSheets;
          return res.json({
            success: true,
            message: postData.message || 'Berhasil menarik seluruh lembar kerja dari Google Apps Script!',
            sheets: mergedSheets,
            spreadsheetUrl: postData.spreadsheetUrl || null,
            spreadsheetId: postData.spreadsheetId || null,
          });
        }
      } catch {
        // Fallback to GET ?action=pullAll
      }

      // 2. Try GET with ?action=pullAll
      const separator = String(targetUrl).includes('?') ? '&' : '?';
      const getRes = await fetch(`${targetUrl}${separator}action=pullAll`, {
        method: 'GET',
        redirect: 'follow',
      });
      const getText = await getRes.text();
      try {
        const getData = JSON.parse(getText);
        if (
          (getData.status === 'success' || getData.success === true) &&
          getData.sheets &&
          typeof getData.sheets === 'object'
        ) {
          const mergedSheets = isRecentDirectSync
            ? { ...getData.sheets, ...liveSyncedSheetsCache }
            : getData.sheets;
          liveSyncedSheetsCache = mergedSheets;
          return res.json({
            success: true,
            message: getData.message || 'Berhasil menarik seluruh lembar kerja dari Google Spreadsheet!',
            sheets: mergedSheets,
            spreadsheetUrl: getData.spreadsheetUrl || null,
            spreadsheetId: getData.spreadsheetId || null,
          });
        }

        if (getData.status === 'success' || getData.success === true) {
          return res.json({
            success: false,
            needsScriptUpdate: true,
            legacyData: getData.data || [],
            message:
              'Web App Google Apps Script Anda aktif, namun masih menggunakan versi script lama yang belum mengembalikan isi 6 lembar kerja (pullAll). Silakan perbarui kode di tab "Source Code Script (.gs)" (Deploy > Manage deployments > Edit > New version > Deploy) ATAU tempel langsung Link Google Spreadsheet Anda pada kolom "Tarik dari Link Google Spreadsheet".',
          });
        }
      } catch {
        // Not valid JSON
      }

      return res.json({
        success: false,
        needsScriptUpdate: true,
        message:
          'Untuk menarik perubahan dari Google Spreadsheet secara otomatis melalui Apps Script, pastikan kode Apps Script terbaru sudah di-deploy (New version), atau gunakan fitur Tarik Langsung dari Link Google Spreadsheet.',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Gagal menghubungi Google Apps Script';
      return res.status(200).json({
        success: false,
        message: errorMessage,
      });
    }
  });

  // Proxy POST for pulling a Google Spreadsheet directly via its Spreadsheet URL or ID (exports .xlsx buffer)
  app.post('/api/spreadsheet/pull-public', async (req, res) => {
    try {
      const rawInput = String((req.body && (req.body.spreadsheetUrl || req.body.spreadsheetId)) || '').trim();
      if (!rawInput) {
        return res.status(400).json({
          success: false,
          message: 'Masukkan Link atau ID Google Spreadsheet terlebih dahulu.',
        });
      }

      let sheetId = rawInput;
      const match = rawInput.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        sheetId = match[1];
      }

      const exportUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/export?format=xlsx`;
      const response = await fetch(exportUrl, {
        method: 'GET',
        redirect: 'follow',
      });

      if (!response.ok) {
        return res.status(200).json({
          success: false,
          message:
            'Gagal mengunduh Google Spreadsheet. Pastikan pengaturan Bagikan (Share) pada Google Spreadsheet disetel ke "Siapa saja yang memiliki link (Anyone with the link)".',
        });
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        return res.status(200).json({
          success: false,
          message:
            'Google Spreadsheet masih terkunci (Privat). Silakan klik tombol "Bagikan (Share)" di pojok kanan atas Google Sheets lalu ubah akses menjadi "Siapa saja yang memiliki link (Anyone with the link)".',
        });
      }

      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');

      return res.json({
        success: true,
        spreadsheetId: sheetId,
        base64,
        message: 'Berhasil mengambil data terbaru dari Google Spreadsheet!',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Gagal mengambil Google Spreadsheet';
      return res.status(200).json({
        success: false,
        message: errorMessage,
      });
    }
  });

  // Mount Vite middleware in development
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
