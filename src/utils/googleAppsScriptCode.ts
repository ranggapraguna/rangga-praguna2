/**
 * Google Apps Script (GAS) untuk Rekapan Se-Dinas Pendidikan BOSP
 * Script ini dipasang di Google Sheets (Extensions > Apps Script)
 */

import { SchoolExpense, SchoolInfo, BarangEkstraItem } from '../types';
import { loadUptSchools, UptSchoolAccount } from '../data/schoolData';
import {
  buildPanelAdminSheetRows,
  buildRekapanDinasSheetRows,
  buildBelanjaPersediaanSheetRows,
  buildBelanjaPemeliharaanSheetRows,
  buildBarangEkstraSheetRows,
  buildAkunAplikasiSheetRows,
  parseMasterSheetsMap,
  parseMasterDatabaseArrayBuffer,
  ParseMasterDatabaseResult,
} from './databaseSpreadsheet';

export const DEFAULT_REKAPAN_GAS_URL =
  'https://script.google.com/macros/s/AKfycbwf4HgF7IVU7Hthn_fqlruBTdEwOvkcP6BEE5YXCvLSCKVFtGNtsBtIirJk8a39q4AV/exec';

const STORAGE_KEY_REKAPAN_GAS_URL = 'bosp_rekapan_sedinas_gas_url_v1';
const STORAGE_KEY_PUBLIC_SHEET_URL = 'bosp_public_google_sheet_url_v1';

export function getSavedGoogleSpreadsheetUrl(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_PUBLIC_SHEET_URL) || localStorage.getItem('bosp_active_sheet_id') || '';
  } catch {
    return '';
  }
}

export function saveGoogleSpreadsheetUrl(urlOrId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_PUBLIC_SHEET_URL, urlOrId.trim());
  } catch {
    // ignore
  }
}

export function getRekapanGasUrl(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_REKAPAN_GAS_URL);
    if (saved && saved.trim().startsWith('https://script.google.com/')) {
      return saved.trim();
    }
    localStorage.setItem(STORAGE_KEY_REKAPAN_GAS_URL, DEFAULT_REKAPAN_GAS_URL);
    return DEFAULT_REKAPAN_GAS_URL;
  } catch {
    return DEFAULT_REKAPAN_GAS_URL;
  }
}

export function saveRekapanGasUrl(url: string): void {
  try {
    const clean = url.trim() || DEFAULT_REKAPAN_GAS_URL;
    localStorage.setItem(STORAGE_KEY_REKAPAN_GAS_URL, clean);
  } catch (err) {
    console.error('Gagal menyimpan URL Apps Script Rekapan:', err);
  }
}

export interface RekapanGasStatusResult {
  connected: boolean;
  sheetInitialized: boolean;
  status: string;
  message: string;
  data?: Record<string, any>[];
  raw?: string;
}

export async function checkRekapanGasConnection(
  gasUrl: string = getRekapanGasUrl()
): Promise<RekapanGasStatusResult> {
  // 1. Try via backend server proxy first to avoid CORS issues
  try {
    const res = await fetch('/api/rekapan-gas/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gasUrl }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Fallback to direct client fetch
  }

  // 2. Direct client fetch
  try {
    const response = await fetch(gasUrl, {
      method: 'GET',
      redirect: 'follow',
    });
    const text = await response.text();
    const data = JSON.parse(text);

    if (data.status === 'success' || data.success === true) {
      return {
        connected: true,
        sheetInitialized: true,
        status: 'success',
        message: data.message || 'Terhubung ke Google Apps Script Rekapan Se-Dinas.',
        data: data.data || [],
      };
    }

    if (data.message && String(data.message).includes('Sheet tidak ditemukan')) {
      return {
        connected: true,
        sheetInitialized: false,
        status: 'connected_needs_init',
        message:
          'Terhubung ke Web App Google Apps Script! Lembar kerja "2_REKAPAN_SE_DINAS" belum dibuat di Spreadsheet. Silakan klik "Kirim / Sinkronkan Data" atau jalankan menu "📋 Rekapan Se-Dinas" di Google Sheets.',
        data: [],
      };
    }

    return {
      connected: true,
      sheetInitialized: false,
      status: data.status || 'warning',
      message: data.message || 'Terhubung ke Web App Google Apps Script.',
      data: data.data || [],
    };
  } catch (err: any) {
    return {
      connected: false,
      sheetInitialized: false,
      status: 'error',
      message: `Gagal menghubungi endpoint Apps Script: ${err.message || 'Periksa koneksi internet.'}`,
    };
  }
}

export interface SyncRekapanGasResult {
  success: boolean;
  needsScriptUpdate?: boolean;
  message: string;
  summary?: Record<string, number>;
  pulledData?: Record<string, any>[];
}

export interface PullRekapanGasResult {
  success: boolean;
  needsScriptUpdate?: boolean;
  message: string;
  parsed?: ParseMasterDatabaseResult;
  spreadsheetUrl?: string | null;
  spreadsheetId?: string | null;
}

export async function pullAllDataFromRekapanGas(
  schoolInfo: SchoolInfo,
  gasUrl: string = getRekapanGasUrl()
): Promise<PullRekapanGasResult> {
  try {
    const res = await fetch('/api/rekapan-gas/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gasUrl }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.sheets && typeof data.sheets === 'object') {
        if (data.spreadsheetId) {
          saveGoogleSpreadsheetUrl(data.spreadsheetId);
        }
        const parsed = parseMasterSheetsMap(data.sheets, schoolInfo);
        const totalItems =
          parsed.persediaanCount +
          parsed.pemeliharaanCount +
          parsed.rekapMatrixCount +
          parsed.barangEkstraCount +
          parsed.akunCount;
        return {
          success: true,
          message: `Berhasil menarik ${totalItems} baris data terbaru dari Google Spreadsheet (${parsed.sheetsFound.length} sheet)!`,
          parsed,
          spreadsheetUrl: data.spreadsheetUrl || null,
          spreadsheetId: data.spreadsheetId || null,
        };
      }
      if (data.needsScriptUpdate) {
        // Check if we have a saved Google Spreadsheet URL/ID to fallback to direct .xlsx export
        const savedSheetId = getSavedGoogleSpreadsheetUrl();
        if (savedSheetId) {
          const directPull = await pullFromGoogleSpreadsheetLink(savedSheetId, schoolInfo);
          if (directPull.success) {
            return directPull;
          }
        }
        return {
          success: false,
          needsScriptUpdate: true,
          message:
            data.message ||
            'Untuk menarik perubahan dari Google Spreadsheet, perbarui kode Apps Script ke versi 2 arah (doGet/doPost pullAll) atau tempel Link Google Spreadsheet Anda.',
        };
      }
    }
  } catch {
    // Fallback to direct client fetch if backend proxy is unavailable
  }

  // 2. Direct client fetch fallback (GET ?action=pullAll)
  try {
    const separator = gasUrl.includes('?') ? '&' : '?';
    const response = await fetch(`${gasUrl}${separator}action=pullAll`, {
      method: 'GET',
      redirect: 'follow',
    });
    const text = await response.text();
    const data = JSON.parse(text);
    if ((data.status === 'success' || data.success === true) && data.sheets && typeof data.sheets === 'object') {
      if (data.spreadsheetId) {
        saveGoogleSpreadsheetUrl(data.spreadsheetId);
      }
      const parsed = parseMasterSheetsMap(data.sheets, schoolInfo);
      const totalItems =
        parsed.persediaanCount +
        parsed.pemeliharaanCount +
        parsed.rekapMatrixCount +
        parsed.barangEkstraCount +
        parsed.akunCount;
      return {
        success: true,
        message: `Berhasil menarik ${totalItems} baris data terbaru dari Google Spreadsheet (${parsed.sheetsFound.length} sheet)!`,
        parsed,
        spreadsheetUrl: data.spreadsheetUrl || null,
        spreadsheetId: data.spreadsheetId || null,
      };
    }
  } catch {
    // Ignore direct client fetch error
  }

  return {
    success: false,
    needsScriptUpdate: true,
    message:
      'Gagal menarik data dari Google Apps Script. Pastikan kode Apps Script terbaru sudah di-deploy atau masukkan Link Google Spreadsheet Anda.',
  };
}

export async function pullFromGoogleSpreadsheetLink(
  spreadsheetUrlOrId: string,
  schoolInfo: SchoolInfo
): Promise<PullRekapanGasResult> {
  const clean = spreadsheetUrlOrId.trim();
  if (!clean) {
    return {
      success: false,
      message: 'Masukkan Link atau ID Google Spreadsheet terlebih dahulu.',
    };
  }

  try {
    saveGoogleSpreadsheetUrl(clean);
    const res = await fetch('/api/spreadsheet/pull-public', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spreadsheetUrl: clean }),
    });
    const data = await res.json();
    if (!data.success || !data.base64) {
      return {
        success: false,
        message:
          data.message ||
          'Gagal membaca Google Spreadsheet. Pastikan akses Spreadsheet disetel ke "Siapa saja yang memiliki link (Anyone with the link)".',
      };
    }

    const binaryString = window.atob(data.base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const parsed = parseMasterDatabaseArrayBuffer(bytes.buffer, schoolInfo);
    const total =
      parsed.persediaanCount +
      parsed.pemeliharaanCount +
      parsed.rekapMatrixCount +
      parsed.barangEkstraCount +
      parsed.akunCount;

    return {
      success: true,
      spreadsheetId: data.spreadsheetId,
      parsed,
      message: `Berhasil menarik & memperbarui ${total} baris data langsung dari Google Spreadsheet (${parsed.sheetsFound.length} lembar kerja)!`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal memproses file Google Spreadsheet: ${err.message || 'Error'}`,
    };
  }
}

export const DO_POST_SNIPPET_ONLY = `/**
 * TAMBAHKAN FUNGSI INI DI BAGIAN PALING BAWAH KODE APPS SCRIPT ANDA (MENDUKUNG SINKRONISASI 2 ARAH & LOGIN 6_AKUN_APLIKASI)
 * Lalu klik: Deploy > Manage deployments > Edit (Ikon Pensil) > Version: New version > Deploy
 */
function bacaSemuaSheetDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const daftarNama = [
    '1_PANEL_ADMIN_UPT',
    '2_REKAPAN_SE_DINAS',
    '3_BELANJA_PERSEDIAAN',
    '4_BELANJA_PEMELIHARAAN',
    '5_BARANG_EKSTRA',
    '6_AKUN_APLIKASI'
  ];
  const hasil = {};
  daftarNama.forEach(nama => {
    const sh = ss.getSheetByName(nama);
    if (sh && sh.getLastRow() > 0 && sh.getLastColumn() > 0) {
      hasil[nama] = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getDisplayValues();
    }
  });
  return hasil;
}

function bacaDaftarAkunAplikasi(ss) {
  const sh = ss.getSheetByName('6_AKUN_APLIKASI');
  if (!sh || sh.getLastRow() <= 1) return [];
  const rows = sh.getRange(1, 1, sh.getLastRow(), Math.max(sh.getLastColumn(), 16)).getDisplayValues();
  const schools = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const namaUpt = String(r[5] || '').trim();
    const username = String(r[2] || '').trim();
    if (!namaUpt && !username) continue;
    schools.push({
      id: String(r[0] || 'upt-' + i).trim(),
      name: String(r[1] || '').trim(),
      username: username,
      password: String(r[3] || '').trim(),
      role: String(r[4] || 'Operator BOSP').trim(),
      namaUpt: namaUpt || String(r[1] || '').trim(),
      createdAt: String(r[6] || '').trim(),
      npsn: String(r[7] || '').trim(),
      kecamatan: String(r[8] || '').trim(),
      kepalaSekolah: String(r[9] || '').trim(),
      nipKepalaSekolah: String(r[10] || '').trim(),
      bendahara: String(r[11] || '').trim(),
      nipBendahara: String(r[12] || '').trim(),
      pengurusBarang: String(r[13] || r[1] || '').trim(),
      nipPengurusBarang: String(r[14] || '').trim(),
      statusAkun: String(r[15] || 'Aktif').trim()
    });
  }
  return schools;
}

function verifikasiLoginAkunAplikasi(ss, payload) {
  const accounts = bacaDaftarAkunAplikasi(ss);
  const reqUser = String(payload.username || payload.user || '').trim().toLowerCase();
  const reqPass = String(payload.password || '').trim();
  const reqUpt = String(payload.namaUpt || payload.upt || payload.schoolName || '').trim().toUpperCase();

  for (let i = 0; i < accounts.length; i++) {
    const acc = accounts[i];
    const rowUser = String(acc.username || '').trim().toLowerCase();
    const rowPass = String(acc.password || '').trim();
    const rowUpt = String(acc.namaUpt || '').trim();

    if (rowUser === reqUser && rowPass === reqPass) {
      if (reqUpt && rowUpt && rowUpt.toUpperCase() !== reqUpt) {
        return {
          status: 'error',
          success: false,
          message: 'Username & Password ini terdaftar di 6_AKUN_APLIKASI untuk UPT "' + rowUpt + '", tidak sesuai dengan UPT yang dipilih ("' + (payload.namaUpt || payload.upt) + '").'
        };
      }
      const isAdmin = String(acc.role || '').toLowerCase().indexOf('admin') !== -1 || rowUser === 'admin_disdik' || rowUpt.toUpperCase().indexOf('DINAS PENDIDIKAN') !== -1;
      return {
        status: 'success',
        success: true,
        user: {
          id: acc.id,
          name: acc.name || acc.pengurusBarang || ('Operator ' + rowUpt),
          username: acc.username,
          role: isAdmin ? 'Admin' : 'Operator BOSP',
          namaUpt: rowUpt,
          upt: rowUpt,
          schoolName: rowUpt,
          npsn: acc.npsn,
          kecamatan: acc.kecamatan,
          kepalaSekolah: acc.kepalaSekolah,
          nipKepalaSekolah: acc.nipKepalaSekolah,
          bendahara: acc.bendahara,
          nipBendahara: acc.nipBendahara,
          pengurusBarang: acc.pengurusBarang || acc.name,
          nipPengurusBarang: acc.nipPengurusBarang,
          createdAt: acc.createdAt
        }
      };
    }
  }

  return {
    status: 'error',
    success: false,
    message: 'Username, Password, atau Pilihan UPT tidak cocok dengan data pada lembar 6_AKUN_APLIKASI.'
  };
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(25000);
  try {
    const raw = e && e.postData ? e.postData.contents : '{}';
    const payload = JSON.parse(raw);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (payload.action === 'getSchools' || payload.action === 'getAccounts' || payload.action === 'list') {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        success: true,
        schools: bacaDaftarAkunAplikasi(ss)
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (payload.action === 'login') {
      return ContentService.createTextOutput(JSON.stringify(
        verifikasiLoginAkunAplikasi(ss, payload)
      )).setMimeType(ContentService.MimeType.JSON);
    }

    if (payload.action === 'pullAll') {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        success: true,
        spreadsheetId: ss.getId(),
        spreadsheetUrl: ss.getUrl(),
        sheets: bacaSemuaSheetDatabase(),
        message: 'Berhasil menarik seluruh 6 lembar kerja dari Google Spreadsheet ke Aplikasi!'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (payload.action === 'syncAll' && payload.sheets) {
      const summary = {};
      const sheetKeys = Object.keys(payload.sheets);

      sheetKeys.forEach(sheetName => {
        const rows = payload.sheets[sheetName];
        if (!Array.isArray(rows) || rows.length === 0) return;

        let sh = ss.getSheetByName(sheetName);
        if (!sh) {
          sh = ss.insertSheet(sheetName);
        } else {
          sh.clear();
        }

        const numRows = rows.length;
        const numCols = rows[0].length;
        if (sh.getMaxColumns() < numCols) {
          sh.insertColumnsAfter(sh.getMaxColumns(), numCols - sh.getMaxColumns());
        }
        if (sh.getMaxRows() < numRows) {
          sh.insertRowsAfter(sh.getMaxRows(), numRows - sh.getMaxRows());
        }
        sh.getRange(1, 1, numRows, numCols).setValues(rows);
        if (typeof rapikanFormatSheet === 'function') {
          rapikanFormatSheet(sh, numRows, numCols);
        }
        summary[sheetName] = sheetName === '2_REKAPAN_SE_DINAS' ? Math.max(0, numRows - 4) : numRows - 1;
      });

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        success: true,
        message: 'Seluruh 6 Lembar Kerja berhasil disinkronkan ke Google Spreadsheet!',
        summary: summary
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'Action POST tidak dikenali.'
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}`;

export async function syncAllDataToRekapanGas(
  params: {
    schoolInfo: SchoolInfo;
    expenses: SchoolExpense[];
    barangEkstraItems: BarangEkstraItem[];
    masterSchools?: UptSchoolAccount[];
  },
  gasUrl: string = getRekapanGasUrl()
): Promise<SyncRekapanGasResult> {
  const schools = params.masterSchools || loadUptSchools();
  const panelAdminRows = buildPanelAdminSheetRows(schools, params.expenses, params.schoolInfo);
  const rekapanDinasRows = buildRekapanDinasSheetRows(schools, params.expenses, params.schoolInfo);
  const belanjaPersediaanRows = buildBelanjaPersediaanSheetRows(params.expenses, params.schoolInfo);
  const belanjaPemeliharaanRows = buildBelanjaPemeliharaanSheetRows(params.expenses, params.schoolInfo);
  const barangEkstraRows = buildBarangEkstraSheetRows(params.barangEkstraItems, params.schoolInfo);
  const akunAplikasiRows = buildAkunAplikasiSheetRows(schools);

  const payload = {
    action: 'syncAll',
    tahunAnggaran: params.schoolInfo.tahunAnggaran,
    timestamp: new Date().toISOString(),
    sheets: {
      '1_PANEL_ADMIN_UPT': panelAdminRows,
      '2_REKAPAN_SE_DINAS': rekapanDinasRows,
      '3_BELANJA_PERSEDIAAN': belanjaPersediaanRows,
      '4_BELANJA_PEMELIHARAAN': belanjaPemeliharaanRows,
      '5_BARANG_EKSTRA': barangEkstraRows,
      '6_AKUN_APLIKASI': akunAplikasiRows,
    },
  };

  // Save snapshot locally so data is always preserved
  try {
    localStorage.setItem(
      'bosp_last_rekapan_sync_summary_v1',
      JSON.stringify({
        timestamp: payload.timestamp,
        counts: {
          '1_PANEL_ADMIN_UPT': panelAdminRows.length - 1,
          '2_REKAPAN_SE_DINAS': Math.max(0, rekapanDinasRows.length - 4),
          '3_BELANJA_PERSEDIAAN': belanjaPersediaanRows.length - 1,
          '4_BELANJA_PEMELIHARAAN': belanjaPemeliharaanRows.length - 1,
          '5_BARANG_EKSTRA': barangEkstraRows.length - 1,
          '6_AKUN_APLIKASI': akunAplikasiRows.length - 1,
        },
      })
    );
  } catch {
    // Ignore storage quota errors
  }

  // 1. Primary path: via backend proxy (/api/rekapan-gas/sync) to avoid browser CORS errors on GAS 302 redirects
  try {
    const res = await fetch('/api/rekapan-gas/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gasUrl, payload }),
    });
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      return json;
    } catch {
      // If server returned non-JSON (e.g. proxy error), continue to fallback diagnostic
    }
  } catch {
    // Fallback if backend proxy is unreachable
  }

  // 2. Fallback: Check if GET endpoint works, and attempt no-cors POST so browser doesn't throw Failed to fetch
  try {
    await fetch(gasUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });

    // Check status via GET to see if sheets were updated or if doPost is missing
    const statusCheck = await checkRekapanGasConnection(gasUrl);
    if (statusCheck.connected) {
      return {
        success: false,
        needsScriptUpdate: true,
        message:
          'Endpoint Web App Anda aktif (doGet berhasil), namun pengiriman data 5 sheet membutuhkan fungsi "doPost(e)" pada Google Apps Script Anda. Silakan tambahkan fungsi doPost(e) di bawah ini lalu klik Deploy > Manage deployments > Edit > Version: New version > Deploy.',
      };
    }
  } catch {
    // Ignore
  }

  return {
    success: false,
    needsScriptUpdate: true,
    message:
      'Gagal mengirim data ke Google Apps Script karena fungsi penerima "doPost(e)" belum di-deploy pada versi Web App terbaru. Silakan salin fungsi doPost(e) dan pilih Deploy > Manage deployments > Edit > New version > Deploy.',
  };
}

/**
 * Fast lightweight sync specifically for User / Account / School Profile changes (6_AKUN_APLIKASI & 1_PANEL_ADMIN_UPT)
 * Avoids rebuilding and formatting the 455-column 2_REKAPAN_SE_DINAS matrix so user edits sync 10x faster.
 */
export async function syncAccountsOnlyToRekapanGas(
  params: {
    schoolInfo: SchoolInfo;
    expenses: SchoolExpense[];
    masterSchools: UptSchoolAccount[];
  },
  gasUrl: string = getRekapanGasUrl()
): Promise<SyncRekapanGasResult> {
  const panelAdminRows = buildPanelAdminSheetRows(
    params.masterSchools,
    params.expenses,
    params.schoolInfo
  );
  const akunAplikasiRows = buildAkunAplikasiSheetRows(params.masterSchools);

  const payload = {
    action: 'syncAll',
    tahunAnggaran: params.schoolInfo.tahunAnggaran,
    timestamp: new Date().toISOString(),
    sheets: {
      '1_PANEL_ADMIN_UPT': panelAdminRows,
      '6_AKUN_APLIKASI': akunAplikasiRows,
    },
  };

  try {
    const res = await fetch('/api/rekapan-gas/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gasUrl, payload }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Fallback to direct client fetch
  }

  // Direct client POST fallback (text/plain avoids CORS preflight on Google Apps Script)
  try {
    const directRes = await fetch(gasUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    const text = await directRes.text();
    const json = JSON.parse(text);
    if (json.status === 'success' || json.success === true) {
      return {
        success: true,
        message: json.message || 'Data Umum & Akun berhasil disinkronkan ke Google Spreadsheet!',
        summary: json.summary,
      };
    }
  } catch {
    try {
      await fetch(gasUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
      return {
        success: true,
        message: 'Data Umum & Akun telah dikirim ke Google Spreadsheet.',
      };
    } catch {
      // Ignore
    }
  }

  return {
    success: false,
    message: 'Gagal menyinkronkan data akun ke Google Apps Script.',
  };
}

export const APPSCRIPT_REKAPAN_SE_DINAS = `/**
 * =========================================================================================
 * GOOGLE APPS SCRIPT: SISTEM REKAPAN SE-DINAS PENDIDIKAN BOSP & PERSEDIAAN
 * Kabupaten Minahasa Tenggara - Dinas Pendidikan
 * =========================================================================================
 * 
 * FITUR UTAMA:
 * 1. Aman dijalankan langsung dari tombol "▶️ Jalankan (Run)" di Editor Apps Script
 *    maupun dari menu "📋 Rekapan Se-Dinas" di Google Spreadsheet (Tanpa Error getUi).
 * 2. Sheet "2_REKAPAN_SE_DINAS" menggunakan Bentuk Tabel Matriks 3 Tingkat Header persis
 *    seperti di Laporan Menu Rekapan Dinas:
 *    - Baris 1: NO | NAMA UPT / SATUAN PENDIDIKAN | [JENIS PERSEDIAAN (7 Kolom)] | TOTAL MASUK | TOTAL KELUAR | TOTAL SALDO AKHIR
 *    - Baris 2: SALDO AWAL (3 Kolom) | BELANJA (3 Kolom) | SALDO AKHIR
 *    - Baris 3: Masuk | Keluar | Sisa | Masuk | Keluar | Sisa | Saldo Akhir
 *    - Baris Bawah: JUMLAH TOTAL SE-KABUPATEN
 * 3. doGet(e) & doPost(e): Endpoint API Web App untuk sinkronisasi otomatis 2 arah.
 * =========================================================================================
 */

// Konfigurasi Nama 6 Lembar Kerja Utama
const SHEET_NAMES = {
  PANEL_ADMIN: '1_PANEL_ADMIN_UPT',
  REKAPAN_DINAS: '2_REKAPAN_SE_DINAS',
  BELANJA_PERSEDIAAN: '3_BELANJA_PERSEDIAAN',
  BELANJA_PEMELIHARAAN: '4_BELANJA_PEMELIHARAAN',
  BARANG_EKSTRA: '5_BARANG_EKSTRA',
  AKUN_APLIKASI: '6_AKUN_APLIKASI'
};

// Seluruh Rekening Standar Rekapan Persediaan Sesuai Laporan Menu Rekapan Dinas
const DAFTAR_JENIS_PERSEDIAAN = [
  "ALAT/ BAHAN UNTUK KEGIATAN KANTOR (ALAT LISTRIK)",
  "ALAT/ BAHAN UNTUK KEGIATAN KANTOR (ATK)",
  "ALAT/ BAHAN UNTUK KEGIATAN KANTOR (BAHAN CETAK)",
  "ALAT/ BAHAN UNTUK KEGIATAN KANTOR (BAHAN KOMPUTER)",
  "ALAT/ BAHAN UNTUK KEGIATAN KANTOR (KAPORLAP & PERLENGKAPAN SATWA)",
  "ALAT/ BAHAN UNTUK KEGIATAN KANTOR (KERTAS & COVER)",
  "ALAT/ BAHAN UNTUK KEGIATAN KANTOR (PERABOT KANTOR)",
  "ALAT/ BAHAN UNTUK KEGIATAN KANTOR (PERANGKO, MATERAI & BENDA POS LAINNYA)",
  "ALAT/ BAHAN UNTUK KEGIATAN KANTOR (PERLENGKAPAN DINAS)",
  "ALAT/ BAHAN UNTUK KEGIATAN KANTOR (PERLENGKAPAN PENDUKUNG OLAH RAGA)",
  "ALAT/ BAHAN UNTUK KEGIATAN KANTOR (PERSEDIAAN DOKUMEN/ ADMISTRASI TENDER)",
  "ALAT/ BAHAN UNTUK KEGIATAN KANTOR (SUVENIR/ CENDERA MATA)",
  "ALAT/ BAHAN UNTUK KEGIATAN KANTOR LAINNYA",
  "ATACHMENT",
  "BAHAN BAKAR & PELUMAS",
  "BAHAN BAKU",
  "BAHAN BANGUNAN & KONSTRUKSI",
  "BAHAN KIMIA",
  "BAHAN KIMIA NUKLIR",
  "BAHAN LAINNYA",
  "BAHAN PELEDAK",
  "BAHAN/ BIBIT TANAMAN",
  "BAHAN/ BIBIT TERNAK/ BIBIT IKAN",
  "BARANG DALAM PROSES",
  "BARANG UNTUK DIJUAL/ DISERAHKAN KEPADA MASYARAKAT",
  "BARANG UNTUK DIJUAL/ DISERAHKAN LAINNYA",
  "ISI TABUNG GAS",
  "ISI TABUNG PEMADAM KEBAKARAN",
  "KOMPONEN BEKAS",
  "KOMPONEN BEKAS DAN PIPA BEKAS LAINNYA",
  "KOMPONEN JEMBATAN BAJA",
  "KOMPONEN JEMBATAN PRAKTEKAN",
  "KOMPONEN LAINNYA",
  "KOMPONEN PERALATAN",
  "KOMPONEN RAMBU-RAMBU",
  "NATURA",
  "OBAT",
  "OBAT-OBATAN LAINNYA",
  "PAKAN",
  "PAKAN LAINNYA",
  "PERSEDIAAN DALAM PROSES",
  "PERSEDIAAN DALAM PROSES LAINNYA",
  "PERSEDIAAN DARI BELANJA BANTUAN SOSIAL",
  "PERSEDIAAN PENELITIAN BIOLOGI",
  "PERSEDIAAN PENELITIAN BIOLOGI LAINNYA",
  "PERSEDIAAN PENELITIAN LAINNYA",
  "PERSEDIAAN PENELITIAN TEKNOLOGI",
  "PERSEDIAAN UNTUK TUJUAN STRATEGIS/ BERJAGA-JAGA",
  "PERSEDIAAN UNTUK TUJUAN STRATEGIS/ BERJAGA-JAGA LAINNYA",
  "PIPA AIR BESI TUANG (DCI)",
  "PIPA ASBES SEMEN (APC)",
  "PIPA BAJA",
  "PIPA BEKAS",
  "PIPA BETON PRAKTEKAN",
  "PIPA FIBER GLASS",
  "PIPA LAINNYA",
  "PIPA PLASTIK PVC (UPVC)",
  "SUKU CADANG ALAT ANGKUTAN",
  "SUKU CADANG ALAT BENGKEL",
  "SUKU CADANG ALAT BESAR",
  "SUKU CADANG ALAT KEDOKTERAN",
  "SUKU CADANG ALAT LABORATORIUM",
  "SUKU CADANG ALAT PEMANCAR",
  "SUKU CADANG ALAT PERSENJATAAN",
  "SUKU CADANG ALAT PERTANIAN",
  "SUKU CADANG ALAT STUDIO & KOMUNIKASI"
];

/**
 * Helper Aman untuk menampilkan pesan (Tidak akan error jika dijalankan dari Editor Apps Script / Web App)
 */
function tampilkanPesanAman(judul, pesan) {
  console.log('[' + judul + '] ' + pesan);
  try {
    const ui = SpreadsheetApp.getUi();
    ui.alert(judul, pesan, ui.ButtonSet.OK);
  } catch (err) {
    // Abaikan error getUi() saat dijalankan dari tombol "Run" di Editor atau dari Webhook
  }
}

/**
 * 1. Event Handler onOpen:
 * - Jika dibuka dari Google Sheets: Membuat Menu Dropdown "📋 Rekapan Se-Dinas"
 * - Jika diklik tombol "▶️ Jalankan (Run)" dari Editor Apps Script: Otomatis menyiapkan 5 Sheet & Rekap!
 */
function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('📋 Rekapan Se-Dinas')
      .addItem('▶️ 1. Buat / Update Tabel Matriks Rekapan Se-Dinas', 'jalankanRekapitulasiSeDinas')
      .addItem('🗂️ 2. Siapkan 5 Sheet Database Utama', 'siapkanSemuaSheetDatabase')
      .addSeparator()
      .addItem('🎨 3. Format & Rapikan Tabel (Border & Rupiah)', 'rapikanFormatTabel')
      .addItem('📑 4. Bersihkan Baris Kosong', 'bersihkanBarisKosong')
      .addSeparator()
      .addItem('ℹ️ 5. Petunjuk & Informasi Versi', 'tampilkanPetunjukAppsScript')
      .addToUi();
    console.log('✅ Menu Rekapan Se-Dinas berhasil ditambahkan ke Google Spreadsheet.');
  } catch (err) {
    console.log('ℹ️ onOpen dijalankan dari Editor Apps Script. Menyiapkan seluruh 5 Sheet Database secara otomatis...');
    siapkanSemuaSheetDatabase();
    jalankanRekapitulasiSeDinas();
    console.log('✅ Selesai! Seluruh 5 Sheet Database & Tabel Matriks Rekapan Se-Dinas telah siap.');
  }
}

/**
 * Membangun 3 Baris Header Matriks untuk Sheet 2_REKAPAN_SE_DINAS (Sama seperti Laporan Menu Rekapan Dinas)
 */
function buatHeaderMatriksRekapanDinas(daftarJenis) {
  const list = daftarJenis || DAFTAR_JENIS_PERSEDIAAN;
  const header1 = ['NO', 'NAMA UPT / SATUAN PENDIDIKAN'];
  const header2 = ['', ''];
  const header3 = ['', ''];

  list.forEach(jenis => {
    header1.push(jenis, '', '', '', '', '', '');
    header2.push('SALDO AWAL', '', '', 'BELANJA', '', '', 'SALDO AKHIR');
    header3.push('Masuk', 'Keluar', 'Sisa', 'Masuk', 'Keluar', 'Sisa', 'Saldo Akhir');
  });

  header1.push('TOTAL MASUK', 'TOTAL KELUAR', 'TOTAL SALDO AKHIR');
  header2.push('', '', '');
  header3.push('', '', '');

  return [header1, header2, header3];
}

/**
 * Fungsi Otomatis Membuat 5 Lembar Kerja Database jika belum ada di Spreadsheet
 */
function siapkanSemuaSheetDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    console.log('⚠️ Pastikan script ini dipasang melalui menu Ekstensi > Apps Script di dalam Google Spreadsheet.');
    return;
  }

  const definisiHeaderSatuBaris = {
    [SHEET_NAMES.PANEL_ADMIN]: [
      'No', 'Nama UPT Sekolah', 'NPSN', 'Kecamatan', 'Jenjang', 'Kepala Sekolah', 'NIP Kepala Sekolah',
      'Bendahara BOS', 'NIP Bendahara', 'Pengurus Barang', 'NIP Pengurus Barang',
      'Pagu Tahunan (Rp)', 'Total Belanja LRA (Rp)', 'Sisa Pagu (Rp)', 'Serapan (%)', 'Total Transaksi', 'Status Approval'
    ],
    [SHEET_NAMES.BELANJA_PERSEDIAAN]: [
      'No', 'ID Transaksi', 'Nama UPT Sekolah', 'NPSN', 'Tanggal SPJ', 'No Bukti',
      'Triwulan', 'Sumber Dana', 'Komponen BOS', 'Kode Rekening Persediaan', 'Uraian Belanja',
      'Penerima / Nama Toko', 'NPWP Toko', 'Metode Bayar', 'Volume', 'Satuan',
      'Harga Satuan (Rp)', 'Subtotal (Rp)', 'Saldo Awal 1 Jan (Rp)', 'Belanja LRA (Rp)',
      'Pengeluaran Saldo Awal (Rp)', 'Pengeluaran Belanja (Rp)', 'Hibah Masuk (Rp)', 'Hibah Keluar (Rp)',
      'Saldo Akhir (Rp)', 'Jenis Pajak', 'Nilai Pajak (Rp)', 'Total Bersih (Rp)', 'Status SPJ', 'Catatan'
    ],
    [SHEET_NAMES.BELANJA_PEMELIHARAAN]: [
      'No', 'ID Transaksi', 'Nama UPT Sekolah', 'NPSN', 'Tanggal SPJ', 'No Bukti Kas',
      'No BAST Pemeliharaan', 'Tanggal BAST', 'Triwulan', 'Sumber Dana', 'Kode Rekening Pemeliharaan',
      'Jenis Pekerjaan / Pemeliharaan', 'Nilai Jasa Pemeliharaan (Rp)', 'Nilai Barang / Suku Cadang (Rp)',
      'Total Belanja LRA (Jasa + Barang) (Rp)', 'Nilai Pengakuan BAST (Rp)', 'Pengeluaran Belanja Pemeliharaan (Rp)',
      'Pengeluaran BAST Di Luar Belanja (Rp)', 'Rekanan / Bengkel / Toko', 'Keterangan Pemeliharaan', 'Status SPJ'
    ],
    [SHEET_NAMES.BARANG_EKSTRA]: [
      'No', 'ID Barang', 'Nama UPT Sekolah', 'NPSN', 'Tahun Anggaran', 'Tanggal Perolehan',
      'Nama Barang', 'Merk / Spesifikasi', 'Volume', 'Satuan', 'Harga Satuan (Rp)',
      'Total Nilai Perolehan (Rp)', 'Kondisi', 'Sumber Dana', 'Keterangan / Lokasi', 'Status'
    ],
    [SHEET_NAMES.AKUN_APLIKASI]: [
      'ID', 'Nama', 'Username', 'Password', 'Role', 'NAMA UPT', 'Waktu_Dibuat',
      'NPSN', 'Kecamatan', 'Kepala Sekolah', 'NIP Kepala Sekolah',
      'Bendahara BOS', 'NIP Bendahara', 'Pengurus Barang', 'NIP Pengurus Barang', 'Status Akun'
    ]
  };

  // Siapkan Sheet 2_REKAPAN_SE_DINAS dengan Header 3 Tingkat (Matriks Laporan Rekapan Dinas)
  let shRekap = ss.getSheetByName(SHEET_NAMES.REKAPAN_DINAS);
  if (!shRekap) {
    shRekap = ss.insertSheet(SHEET_NAMES.REKAPAN_DINAS);
  }
  if (shRekap.getLastRow() === 0) {
    const headerRows = buatHeaderMatriksRekapanDinas(DAFTAR_JENIS_PERSEDIAAN);
    const numCols = headerRows[0].length;
    if (shRekap.getMaxColumns() < numCols) {
      shRekap.insertColumnsAfter(shRekap.getMaxColumns(), numCols - shRekap.getMaxColumns());
    }
    shRekap.getRange(1, 1, 3, numCols).setValues(headerRows);
    rapikanFormatSheet(shRekap, 3, numCols);
  }

  // Siapkan 4 Sheet lainnya
  Object.keys(definisiHeaderSatuBaris).forEach(namaSheet => {
    let sh = ss.getSheetByName(namaSheet);
    if (!sh) {
      sh = ss.insertSheet(namaSheet);
    }
    if (sh.getLastRow() === 0) {
      const headers = definisiHeaderSatuBaris[namaSheet];
      if (sh.getMaxColumns() < headers.length) {
        sh.insertColumnsAfter(sh.getMaxColumns(), headers.length - sh.getMaxColumns());
      }
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      rapikanFormatSheet(sh, 1, headers.length);
    }
  });

  tampilkanPesanAman(
    '5 Sheet Database Siap!',
    'Kelima lembar kerja (termasuk Tabel Matriks 2_REKAPAN_SE_DINAS sesuai Laporan Menu Rekapan Dinas) telah siap di Google Spreadsheet Anda.'
  );
}

/**
 * Normalisasi nama UPT sekolah untuk pencocokan konsisten
 */
function normalisasiNamaUpt(nama) {
  if (!nama) return '';
  return String(nama)
    .trim()
    .toUpperCase()
    .replace(/\\s+/g, ' ')
    .replace(/^UPTD?\\s+/i, '')
    .replace(/\\bSMPN\\b/g, 'SMP NEGERI')
    .replace(/\\bSDN\\b/g, 'SD NEGERI');
}

/**
 * Mengubah teks/angka menjadi format angka numerik
 */
function toAngka(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = String(val)
    .replace(/[Rp\\s()]/gi, '')
    .replace(/\\./g, '')
    .replace(/,/g, '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * 2. Fungsi Utama: Menghitung Tabel Matriks Rekapitulasi Se-Dinas (Sesuai Laporan Menu Rekapan Dinas)
 */
function jalankanRekapitulasiSeDinas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return;

  let sheetRekap = ss.getSheetByName(SHEET_NAMES.REKAPAN_DINAS);
  if (!sheetRekap) {
    sheetRekap = ss.insertSheet(SHEET_NAMES.REKAPAN_DINAS);
  }

  // 1. Baca Master Sekolah dari sheet PANEL ADMIN jika ada
  const masterSekolahMap = new Map();
  const sheetAdmin = ss.getSheetByName(SHEET_NAMES.PANEL_ADMIN);
  if (sheetAdmin && sheetAdmin.getLastRow() > 1) {
    const numCols = Math.min(sheetAdmin.getLastColumn(), 5);
    const adminData = sheetAdmin.getRange(2, 1, sheetAdmin.getLastRow() - 1, numCols).getValues();
    adminData.forEach(row => {
      const nama = String(row[1] || '').trim();
      const npsn = String(row[2] || '').trim();
      if (nama) {
        masterSekolahMap.set(normalisasiNamaUpt(nama), { nama, npsn });
      }
    });
  }

  // 2. Baca Sheet Belanja Persediaan (Sheet 3) per Sekolah & per Jenis Rekening
  const setJenis = new Set(DAFTAR_JENIS_PERSEDIAAN);
  const sekolahMap = new Map();

  masterSekolahMap.forEach((val, norm) => {
    sekolahMap.set(norm, { nama: val.nama, items: {} });
  });

  const sheetPersediaan = ss.getSheetByName(SHEET_NAMES.BELANJA_PERSEDIAAN);
  if (sheetPersediaan && sheetPersediaan.getLastRow() > 1) {
    const maxCol = Math.max(sheetPersediaan.getLastColumn(), 25);
    const persediaanData = sheetPersediaan.getRange(2, 1, sheetPersediaan.getLastRow() - 1, maxCol).getValues();
    persediaanData.forEach(row => {
      const namaSekolah = String(row[2] || '').trim();
      if (!namaSekolah) return;
      const norm = normalisasiNamaUpt(namaSekolah);
      const rekening = String(row[9] || '').trim().toUpperCase();
      if (!rekening) return;

      setJenis.add(rekening);

      if (!sekolahMap.has(norm)) {
        sekolahMap.set(norm, { nama: namaSekolah, items: {} });
      }
      const rec = sekolahMap.get(norm);
      if (!rec.items[rekening]) {
        rec.items[rekening] = { saM: 0, saK: 0, blM: 0, blK: 0, saldo: 0 };
      }

      const saAwal = toAngka(row[18]);
      const blLra = toAngka(row[19]) || toAngka(row[17]);
      const pSa = toAngka(row[20]);
      const pBl = toAngka(row[21]) || blLra;
      const hm = toAngka(row[22]);
      const hk = toAngka(row[23]);
      const sAkhir = toAngka(row[24]) || (saAwal + blLra + hm - (pSa + pBl + hk));

      rec.items[rekening].saM += saAwal;
      rec.items[rekening].saK += pSa;
      rec.items[rekening].blM += (blLra + hm);
      rec.items[rekening].blK += (pBl + hk);
      rec.items[rekening].saldo += sAkhir;
    });
  }

  // Jika sheet Rekapan sudah memiliki data dari sinkronisasi web dan sheet 1 & 3 masih kosong, pertahankan data yang ada
  if (sekolahMap.size === 0 && sheetRekap.getLastRow() > 3) {
    rapikanFormatSheet(sheetRekap, sheetRekap.getLastRow(), sheetRekap.getLastColumn());
    tampilkanPesanAman(
      'Rekapan Se-Dinas Siap',
      'Tabel Matriks pada lembar "' + SHEET_NAMES.REKAPAN_DINAS + '" telah diformat dan siap digunakan.'
    );
    return;
  }

  const allJenisList = Array.from(setJenis);
  const headerRows = buatHeaderMatriksRekapanDinas(allJenisList);
  const outputRows = [...headerRows];

  let nomor = 1;
  let grandTotMasuk = 0;
  let grandTotKeluar = 0;
  let grandTotSaldo = 0;

  const sortedSchools = Array.from(sekolahMap.values());

  sortedSchools.forEach(sch => {
    const row = [nomor++, sch.nama];
    let totM = 0;
    let totK = 0;
    let totS = 0;

    allJenisList.forEach(j => {
      const it = sch.items[j] || { saM: 0, saK: 0, blM: 0, blK: 0, saldo: 0 };
      const saS = it.saM - it.saK;
      const blS = it.blM - it.blK;
      row.push(it.saM, it.saK, saS, it.blM, it.blK, blS, it.saldo);
      totM += (it.saM + it.blM);
      totK += (it.saK + it.blK);
      totS += it.saldo;
    });

    row.push(totM, totK, totS);
    outputRows.push(row);

    grandTotMasuk += totM;
    grandTotKeluar += totK;
    grandTotSaldo += totS;
  });

  // Baris Footer: JUMLAH TOTAL SE-KABUPATEN
  const totRow = ['JUMLAH TOTAL SE-KABUPATEN', ''];
  allJenisList.forEach(j => {
    let tSaM = 0, tSaK = 0, tSaS = 0, tBlM = 0, tBlK = 0, tBlS = 0, tSk = 0;
    sortedSchools.forEach(sch => {
      const it = sch.items[j];
      if (it) {
        tSaM += it.saM;
        tSaK += it.saK;
        tSaS += (it.saM - it.saK);
        tBlM += it.blM;
        tBlK += it.blK;
        tBlS += (it.blM - it.blK);
        tSk += it.saldo;
      }
    });
    totRow.push(tSaM, tSaK, tSaS, tBlM, tBlK, tBlS, tSk);
  });
  totRow.push(grandTotMasuk, grandTotKeluar, grandTotSaldo);
  outputRows.push(totRow);

  const numRows = outputRows.length;
  const numCols = outputRows[0].length;

  sheetRekap.clear();
  if (sheetRekap.getMaxColumns() < numCols) {
    sheetRekap.insertColumnsAfter(sheetRekap.getMaxColumns(), numCols - sheetRekap.getMaxColumns());
  }
  if (sheetRekap.getMaxRows() < numRows) {
    sheetRekap.insertRowsAfter(sheetRekap.getMaxRows(), numRows - sheetRekap.getMaxRows());
  }

  sheetRekap.getRange(1, 1, numRows, numCols).setValues(outputRows);
  rapikanFormatSheet(sheetRekap, numRows, numCols);

  tampilkanPesanAman(
    'Tabel Matriks Rekapan Se-Dinas Selesai!',
    \`Berhasil menyusun Tabel Matriks Rekapitulasi untuk \${sortedSchools.length} UPT Sekolah ke dalam lembar "\${SHEET_NAMES.REKAPAN_DINAS}".\`
  );
}

/**
 * 3. Merapikan Format Tampilan, Warna, dan Format Rupiah
 */
function rapikanFormatSheet(sheet, totalBaris, totalKolom) {
  if (!sheet || totalBaris <= 0 || totalKolom <= 0) return;

  const isRekapanMatriks = sheet.getName() === SHEET_NAMES.REKAPAN_DINAS && totalBaris >= 3 && totalKolom > 20;

  if (isRekapanMatriks) {
    // Styling 3 Baris Header Matriks (Sesuai Laporan Menu Rekapan Dinas)
    sheet.getRange(1, 1, 1, totalKolom)
      .setBackground('#0f172a')
      .setFontColor('#ffffff')
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setWrap(true);

    sheet.getRange(2, 1, 1, totalKolom)
      .setBackground('#065f46')
      .setFontColor('#ffffff')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');

    sheet.getRange(3, 1, 1, totalKolom)
      .setBackground('#d1fae5')
      .setFontColor('#064e3b')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');

    sheet.setFrozenRows(3);
    sheet.setFrozenColumns(2);

    // Format angka untuk nilai matriks
    if (totalBaris > 3 && totalKolom > 2) {
      sheet.getRange(4, 3, totalBaris - 3, totalKolom - 2).setNumberFormat('#,##0');
    }

    // Format baris JUMLAH TOTAL SE-KABUPATEN di paling bawah
    if (totalBaris > 4) {
      sheet.getRange(totalBaris, 1, 1, totalKolom)
        .setBackground('#e2e8f0')
        .setFontColor('#0f172a')
        .setFontWeight('bold');
    }
    return;
  }

  // Header Styling Standar (1 Baris Header)
  const headerRange = sheet.getRange(1, 1, 1, totalKolom);
  headerRange
    .setBackground('#065f46')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setWrap(true);

  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 35);

  const dataRange = sheet.getRange(1, 1, totalBaris, totalKolom);
  dataRange.setBorder(true, true, true, true, true, true, '#cbd5e1', SpreadsheetApp.BorderStyle.SOLID);

  if (totalBaris > 1) {
    const bgColors = [];
    for (let r = 2; r <= totalBaris; r++) {
      const color = r % 2 === 0 ? '#f8fafc' : '#ffffff';
      const rowColors = new Array(totalKolom).fill(color);
      bgColors.push(rowColors);
    }
    sheet.getRange(2, 1, totalBaris - 1, totalKolom).setBackgrounds(bgColors);
  }
}

/**
 * 4. Wrapper Format Cepat
 */
function rapikanFormatTabel() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return;
  const sheet = ss.getActiveSheet();
  rapikanFormatSheet(sheet, sheet.getLastRow(), sheet.getLastColumn());
  tampilkanPesanAman('Selesai', 'Format tabel lembar aktif berhasil dirapikan!');
}

/**
 * 5. Pembersih Baris Kosong
 */
function bersihkanBarisKosong() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const maxRows = sheet.getMaxRows();
  const lastRow = sheet.getLastRow();
  if (maxRows > lastRow) {
    sheet.deleteRows(lastRow + 1, maxRows - lastRow);
    tampilkanPesanAman('Selesai', \`Berhasil menghapus \${maxRows - lastRow} baris kosong di bagian bawah.\`);
  }
}

/**
 * 6. Dialog Petunjuk Penggunaan
 */
function tampilkanPetunjukAppsScript() {
  try {
    const html = HtmlService.createHtmlOutput(\`
      <div style="font-family: sans-serif; padding: 15px; line-height: 1.5; color: #1e293b;">
        <h3 style="color: #065f46; margin-top: 0;">Petunjuk Penggunaan Apps Script Rekapan Se-Dinas</h3>
        <ol style="padding-left: 20px;">
          <li><b>Jalankan Rekapitulasi:</b> Klik menu <i>📋 Rekapan Se-Dinas &gt; ▶️ 1. Buat / Update Tabel Matriks Rekapan Se-Dinas</i> untuk menyusun tabel matriks 3 baris header seperti di Laporan Menu Rekapan Dinas.</li>
          <li><b>Siapkan 5 Sheet:</b> Klik menu nomor 2 untuk membuat struktur 5 lembar kerja database utama.</li>
          <li><b>Format &amp; Garis:</b> Klik menu nomor 3 kapan saja untuk memformat angka dan border tabel.</li>
        </ol>
        <p style="font-size: 11px; color: #64748b;">Dinas Pendidikan Kabupaten Minahasa Tenggara • Sistem Pengelolaan BOSP &amp; Persediaan</p>
      </div>
    \`)
    .setWidth(450)
    .setHeight(280);

    SpreadsheetApp.getUi().showModalDialog(html, 'Panduan Google Apps Script');
  } catch (err) {
    console.log('Panduan: Gunakan menu Rekapan Se-Dinas di Google Spreadsheet atau hubungkan Web App URL ke aplikasi.');
  }
}

/**
 * Membaca seluruh 6 lembar kerja untuk dikirim kembali ke Aplikasi Web (Sinkronisasi 2 Arah)
 */
function bacaSemuaSheetDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const daftarNama = [
    SHEET_NAMES.PANEL_ADMIN,
    SHEET_NAMES.REKAPAN_DINAS,
    SHEET_NAMES.BELANJA_PERSEDIAAN,
    SHEET_NAMES.BELANJA_PEMELIHARAAN,
    SHEET_NAMES.BARANG_EKSTRA,
    SHEET_NAMES.AKUN_APLIKASI
  ];
  const hasil = {};
  daftarNama.forEach(nama => {
    const sh = ss.getSheetByName(nama);
    if (sh && sh.getLastRow() > 0 && sh.getLastColumn() > 0) {
      hasil[nama] = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getDisplayValues();
    }
  });
  return hasil;
}

/**
 * Membaca Daftar Akun dari Sheet 6_AKUN_APLIKASI (Kolom A s/d Kolom P)
 */
function bacaDaftarAkunAplikasi(ss) {
  const sh = ss.getSheetByName(SHEET_NAMES.AKUN_APLIKASI);
  if (!sh || sh.getLastRow() <= 1) return [];
  const rows = sh.getRange(1, 1, sh.getLastRow(), Math.max(sh.getLastColumn(), 16)).getDisplayValues();
  const schools = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const namaUpt = String(r[5] || '').trim();
    const username = String(r[2] || '').trim();
    if (!namaUpt && !username) continue;
    schools.push({
      id: String(r[0] || 'upt-' + i).trim(),
      name: String(r[1] || '').trim(),
      username: username,
      password: String(r[3] || '').trim(),
      role: String(r[4] || 'Operator BOSP').trim(),
      namaUpt: namaUpt || String(r[1] || '').trim(),
      createdAt: String(r[6] || '').trim(),
      npsn: String(r[7] || '').trim(),
      kecamatan: String(r[8] || '').trim(),
      kepalaSekolah: String(r[9] || '').trim(),
      nipKepalaSekolah: String(r[10] || '').trim(),
      bendahara: String(r[11] || '').trim(),
      nipBendahara: String(r[12] || '').trim(),
      pengurusBarang: String(r[13] || r[1] || '').trim(),
      nipPengurusBarang: String(r[14] || '').trim(),
      statusAkun: String(r[15] || 'Aktif').trim()
    });
  }
  return schools;
}

/**
 * Verifikasi Login Berdasarkan Data pada Sheet 6_AKUN_APLIKASI
 */
function verifikasiLoginAkunAplikasi(ss, payload) {
  const accounts = bacaDaftarAkunAplikasi(ss);
  const reqUser = String(payload.username || payload.user || '').trim().toLowerCase();
  const reqPass = String(payload.password || '').trim();
  const reqUpt = String(payload.namaUpt || payload.upt || payload.schoolName || '').trim().toUpperCase();

  for (let i = 0; i < accounts.length; i++) {
    const acc = accounts[i];
    const rowUser = String(acc.username || '').trim().toLowerCase();
    const rowPass = String(acc.password || '').trim();
    const rowUpt = String(acc.namaUpt || '').trim();

    if (rowUser === reqUser && rowPass === reqPass) {
      if (reqUpt && rowUpt && normalisasiNamaUpt(rowUpt) !== normalisasiNamaUpt(reqUpt)) {
        return {
          status: 'error',
          success: false,
          message: 'Username & Password ini terdaftar di 6_AKUN_APLIKASI untuk UPT "' + rowUpt + '", tidak sesuai dengan UPT yang dipilih ("' + (payload.namaUpt || payload.upt) + '").'
        };
      }
      const isAdmin = String(acc.role || '').toLowerCase().indexOf('admin') !== -1 || rowUser === 'admin_disdik' || rowUpt.toUpperCase().indexOf('DINAS PENDIDIKAN') !== -1;
      return {
        status: 'success',
        success: true,
        user: {
          id: acc.id,
          name: acc.name || acc.pengurusBarang || ('Operator ' + rowUpt),
          username: acc.username,
          role: isAdmin ? 'Admin' : 'Operator BOSP',
          namaUpt: rowUpt,
          upt: rowUpt,
          schoolName: rowUpt,
          npsn: acc.npsn,
          kecamatan: acc.kecamatan,
          kepalaSekolah: acc.kepalaSekolah,
          nipKepalaSekolah: acc.nipKepalaSekolah,
          bendahara: acc.bendahara,
          nipBendahara: acc.nipBendahara,
          pengurusBarang: acc.pengurusBarang || acc.name,
          nipPengurusBarang: acc.nipPengurusBarang,
          createdAt: acc.createdAt
        }
      };
    }
  }

  return {
    status: 'error',
    success: false,
    message: 'Username, Password, atau Pilihan UPT tidak cocok dengan data pada lembar 6_AKUN_APLIKASI.'
  };
}

/**
 * 7. Endpoint API Webhook (GET) untuk integrasi JSON, Login 6_AKUN_APLIKASI & Tarik Data 2 Arah ke Aplikasi Web
 */
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const action = e && e.parameter && e.parameter.action ? String(e.parameter.action) : '';

    if (action === 'getSchools' || action === 'getAccounts' || action === 'list') {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        success: true,
        schools: bacaDaftarAkunAplikasi(ss)
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'pullAll') {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        success: true,
        spreadsheetId: ss.getId(),
        spreadsheetUrl: ss.getUrl(),
        sheets: bacaSemuaSheetDatabase(),
        schools: bacaDaftarAkunAplikasi(ss),
        message: 'Berhasil menarik seluruh 6 lembar kerja dari Google Spreadsheet ke Aplikasi!'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    let sheet = ss.getSheetByName(SHEET_NAMES.REKAPAN_DINAS);
    if (!sheet) {
      siapkanSemuaSheetDatabase();
      sheet = ss.getSheetByName(SHEET_NAMES.REKAPAN_DINAS);
    }
    const lastRow = sheet.getLastRow();
    if (lastRow <= 3) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        spreadsheetId: ss.getId(),
        spreadsheetUrl: ss.getUrl(),
        sheets: bacaSemuaSheetDatabase(),
        schools: bacaDaftarAkunAplikasi(ss),
        message: 'Terhubung ke Google Spreadsheet Rekapan Se-Dinas (Tabel Matriks & 6_AKUN_APLIKASI siap).',
        data: []
      })).setMimeType(ContentService.MimeType.JSON);
    }
    const numRowsToRead = lastRow - 3;
    const basicData = sheet.getRange(4, 1, numRowsToRead, 2).getValues();
    const result = basicData
      .filter(r => String(r[0]) !== 'JUMLAH TOTAL SE-KABUPATEN' && String(r[1]).trim() !== '')
      .map(r => ({ no: r[0], namaUpt: r[1] }));

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      spreadsheetId: ss.getId(),
      spreadsheetUrl: ss.getUrl(),
      sheets: bacaSemuaSheetDatabase(),
      schools: bacaDaftarAkunAplikasi(ss),
      message: 'Berhasil memuat ' + result.length + ' baris UPT pada Tabel Matriks Rekapan Se-Dinas.',
      data: result
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 8. Endpoint API Webhook (POST) untuk Login 6_AKUN_APLIKASI & Sinkronisasi Otomatis 2 Arah (Kirim & Tarik 6 Sheet)
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(25000);
  try {
    const raw = e && e.postData ? e.postData.contents : '{}';
    const payload = JSON.parse(raw);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (payload.action === 'getSchools' || payload.action === 'getAccounts' || payload.action === 'list') {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        success: true,
        schools: bacaDaftarAkunAplikasi(ss)
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (payload.action === 'login') {
      return ContentService.createTextOutput(JSON.stringify(
        verifikasiLoginAkunAplikasi(ss, payload)
      )).setMimeType(ContentService.MimeType.JSON);
    }

    if (payload.action === 'pullAll') {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        success: true,
        spreadsheetId: ss.getId(),
        spreadsheetUrl: ss.getUrl(),
        sheets: bacaSemuaSheetDatabase(),
        schools: bacaDaftarAkunAplikasi(ss),
        message: 'Berhasil menarik seluruh 6 lembar kerja dari Google Spreadsheet ke Aplikasi!'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (payload.action === 'syncAll' && payload.sheets) {
      const summary = {};
      const sheetKeys = Object.keys(payload.sheets);

      sheetKeys.forEach(sheetName => {
        const rows = payload.sheets[sheetName];
        if (!Array.isArray(rows) || rows.length === 0) return;

        let sh = ss.getSheetByName(sheetName);
        if (!sh) {
          sh = ss.insertSheet(sheetName);
        } else {
          sh.clear();
        }

        const numRows = rows.length;
        const numCols = rows[0].length;
        if (sh.getMaxColumns() < numCols) {
          sh.insertColumnsAfter(sh.getMaxColumns(), numCols - sh.getMaxColumns());
        }
        if (sh.getMaxRows() < numRows) {
          sh.insertRowsAfter(sh.getMaxRows(), numRows - sh.getMaxRows());
        }
        sh.getRange(1, 1, numRows, numCols).setValues(rows);
        rapikanFormatSheet(sh, numRows, numCols);
        summary[sheetName] = sheetName === '2_REKAPAN_SE_DINAS' ? Math.max(0, numRows - 4) : numRows - 1;
      });

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        success: true,
        message: 'Seluruh 6 Lembar Kerja (termasuk Tabel Matriks 2_REKAPAN_SE_DINAS & 6_AKUN_APLIKASI) berhasil disinkronkan!',
        summary: summary
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'Action POST tidak dikenali.'
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
`;


