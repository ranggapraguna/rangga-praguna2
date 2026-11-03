import { UserProfile } from '../types/auth';
import { normalizeUserRole } from './auth';
import { normalizeUptKey, SheetUptRow, UptSchoolAccount } from '../data/schoolData';
import { DEFAULT_REKAPAN_GAS_URL, getRekapanGasUrl, saveRekapanGasUrl } from './googleAppsScriptCode';

export const DEFAULT_GAS_URL = DEFAULT_REKAPAN_GAS_URL;

export function getGasAuthUrl(): string {
  try {
    // Clear legacy separate login script keys so old script URLs never override the unified 6_AKUN_APLIKASI database
    localStorage.removeItem('appsheet_gas_auth_url_v1');
    localStorage.removeItem('appsheet_gas_auth_url_v2');
  } catch {
    // ignore
  }
  return getRekapanGasUrl();
}

export function saveGasAuthUrl(url: string): void {
  saveRekapanGasUrl(url);
}

export interface GasAuthResult {
  success: boolean;
  user?: UserProfile;
  schoolAccount?: UptSchoolAccount;
  error?: string;
  isGasScriptError?: boolean;
}

/**
 * Pure parser function to interpret responses from Database Spreadsheet (Sheet 6_AKUN_APLIKASI)
 * Supports Kolom A-P of 6_AKUN_APLIKASI:
 * Kolom A: ID | Kolom B: Nama | Kolom C: Username | Kolom D: Password | Kolom E: Role | Kolom F: NAMA UPT | Kolom G: Waktu_Dibuat
 * Kolom H: NPSN | Kolom I: Kecamatan | Kolom J: Kepala Sekolah | Kolom K: NIP Kepala Sekolah | Kolom L: Bendahara BOS | Kolom M: NIP Bendahara | Kolom N: Pengurus Barang | Kolom O: NIP Pengurus Barang | Kolom P: Status Akun
 */
export function parseGasResponse(rawText: string, requestedUpt?: string): GasAuthResult {
  if (!rawText || typeof rawText !== 'string') {
    return {
      success: false,
      error: 'Respon dari Database Spreadsheet (6_AKUN_APLIKASI) kosong atau tidak valid.',
    };
  }

  if (rawText.includes('Script function not found: doPost') || rawText.includes('Script function not found: doGet')) {
    return {
      success: false,
      error: 'Fungsi doPost(e) belum dideploy pada Google Apps Script Database Anda.',
      isGasScriptError: true,
    };
  }

  if (rawText.includes('Script error') || rawText.includes('Authorization is required')) {
    return {
      success: false,
      error: 'Google Apps Script memerlukan izin otorisasi atau deployment Web App belum disetel ke "Anyone" (Siapa saja).',
      isGasScriptError: true,
    };
  }

  try {
    let jsonString = rawText.trim();
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonString = jsonMatch[0];
    }

    const data = JSON.parse(jsonString);

    if (data.status === 'success' || data.success === true) {
      const u = data.user || data.data || data;
      const usernameVal = u.username || u.user || u.email || 'pengguna';
      const rawUptFromSheet = String(
        u.namaUpt || u.upt || u.schoolName || u.sekolah || ''
      ).trim();

      const isLegacyDefaultSchool =
        !rawUptFromSheet || rawUptFromSheet.toUpperCase() === 'SD NEGERI 01 NUSANTARA';

      if (
        requestedUpt &&
        requestedUpt.trim() &&
        !isLegacyDefaultSchool &&
        normalizeUptKey(rawUptFromSheet) !== normalizeUptKey(requestedUpt.trim())
      ) {
        return {
          success: false,
          error: `Username "${usernameVal}" di 6_AKUN_APLIKASI terdaftar pada UPT "${rawUptFromSheet}", bukan "${requestedUpt}". Silakan pilih UPT yang sesuai.`,
        };
      }

      const resolvedSchoolName = !isLegacyDefaultSchool
        ? rawUptFromSheet
        : requestedUpt?.trim() || 'SD NEGERI 01 NUSANTARA';

      const roleVal = normalizeUserRole(u.role || u.peran, usernameVal);

      const userProfile: UserProfile = {
        id: String(u.id || `upt-${Date.now()}`),
        username: String(usernameVal),
        name: u.name || u.nama || u.pengurusBarang || `Operator ${resolvedSchoolName}`,
        email: u.email || undefined,
        role: roleVal,
        nip: u.nip || u.nipPengurusBarang || undefined,
        schoolName: resolvedSchoolName,
        createdAt: u.createdAt || u.waktuDibuat || new Date().toISOString(),
      };

      const schoolAccount: UptSchoolAccount | undefined = u.schoolAccount
        ? u.schoolAccount
        : !isLegacyDefaultSchool
        ? {
            id: String(u.id || `upt-${Date.now()}`),
            upt: resolvedSchoolName,
            npsn: String(u.npsn || '-'),
            kecamatan: String(u.kecamatan || 'Minahasa Tenggara'),
            username: String(usernameVal),
            password: String(u.password || ''),
            role: roleVal,
            kepalaSekolah: u.kepalaSekolah || undefined,
            nipKepalaSekolah: u.nipKepalaSekolah || undefined,
            bendahara: u.bendahara || undefined,
            nipBendahara: u.nipBendahara || undefined,
            pengurusBarang: u.pengurusBarang || u.name || u.nama || undefined,
            nipPengurusBarang: u.nipPengurusBarang || undefined,
          }
        : undefined;

      return {
        success: true,
        user: userProfile,
        schoolAccount,
      };
    }

    return {
      success: false,
      error: data.message || data.error || 'Autentikasi gagal pada lembar 6_AKUN_APLIKASI.',
    };
  } catch {
    return {
      success: false,
      error: 'Respon dari Google Apps Script bukan format JSON yang valid.',
      isGasScriptError: true,
    };
  }
}

/**
 * Perform login request against Database Spreadsheet (Sheet 6_AKUN_APLIKASI)
 */
export async function loginWithGoogleAppsScript(
  username: string,
  password: string,
  gasUrl: string = getGasAuthUrl(),
  selectedUpt?: string
): Promise<GasAuthResult> {
  const payload = {
    action: 'login',
    username: username.trim(),
    password: password.trim(),
    upt: selectedUpt ? selectedUpt.trim() : '',
    namaUpt: selectedUpt ? selectedUpt.trim() : '',
  };

  try {
    const proxyRes = await fetch('/api/auth/gas-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, gasUrl }),
    });

    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data.success && data.user) {
        return parseGasResponse(
          JSON.stringify({
            status: 'success',
            user: {
              ...data.user,
              schoolAccount: data.schoolAccount,
            },
          }),
          selectedUpt
        );
      }
      return {
        success: false,
        error: data.error || data.message || 'Login gagal di Database 6_AKUN_APLIKASI.',
        isGasScriptError: data.isGasScriptError,
      };
    }
  } catch {
    // Fallback to direct client-side fetch if backend proxy is unreachable
  }

  try {
    const response = await fetch(gasUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    return parseGasResponse(text, selectedUpt);
  } catch (err: any) {
    return {
      success: false,
      error: `Gagal menghubungi Database Spreadsheet (6_AKUN_APLIKASI): ${err.message || 'Periksa koneksi internet.'}`,
    };
  }
}

/**
 * Fetch list of UPT schools & accounts from Database Spreadsheet sheet 6_AKUN_APLIKASI
 */
export async function fetchUptListFromGoogleAppsScript(
  gasUrl: string = getGasAuthUrl(),
  forceRemotePull: boolean = false
): Promise<SheetUptRow[]> {
  try {
    const proxyRes = await fetch('/api/auth/gas-schools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gasUrl, forceRemotePull }),
    });
    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if ((data.status === 'success' || data.success === true) && Array.isArray(data.schools)) {
        return data.schools;
      }
    }
  } catch {
    // fallback to direct fetch
  }

  try {
    const separator = gasUrl.includes('?') ? '&' : '?';
    const response = await fetch(`${gasUrl}${separator}action=getSchools`, {
      method: 'GET',
      redirect: 'follow',
    });
    const text = await response.text();
    const data = JSON.parse(text);
    if ((data.status === 'success' || data.success === true) && Array.isArray(data.schools)) {
      return data.schools;
    }
    if (data.sheets && Array.isArray(data.sheets['6_AKUN_APLIKASI'])) {
      const rows = data.sheets['6_AKUN_APLIKASI'];
      const parsed: SheetUptRow[] = [];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!Array.isArray(r)) continue;
        const namaUpt = String(r[5] || '').trim();
        const username = String(r[2] || '').trim();
        if (!namaUpt && !username) continue;
        parsed.push({
          id: String(r[0] || `upt-${i}`).trim(),
          name: String(r[1] || '').trim(),
          username,
          password: String(r[3] || '').trim(),
          role: String(r[4] || 'Operator BOSP').trim(),
          namaUpt: namaUpt || String(r[1] || '').trim(),
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
      if (parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }

  return [];
}

/**
 * Unified Database Login Template Based on Sheet "6_AKUN_APLIKASI" (Kolom A s/d Kolom P):
 * Kolom A: ID
 * Kolom B: Nama
 * Kolom C: Username
 * Kolom D: Password
 * Kolom E: Role
 * Kolom F: NAMA UPT
 * Kolom G: Waktu_Dibuat
 * Kolom H: NPSN
 * Kolom I: Kecamatan
 * Kolom J: Kepala Sekolah
 * Kolom K: NIP Kepala Sekolah
 * Kolom L: Bendahara BOS
 * Kolom M: NIP Bendahara
 * Kolom N: Pengurus Barang
 * Kolom O: NIP Pengurus Barang
 * Kolom P: Status Akun
 */
export const GAS_CODE_TEMPLATE = `// =========================================================================================
// KODE LOGIN DATABASE SPREADSHEET BERDASARKAN SHEET "6_AKUN_APLIKASI"
// (Sudah terintegrasi penuh di dalam Master Script Database 6 Sheet)
// =========================================================================================
// Struktur Kolom pada Sheet "6_AKUN_APLIKASI":
//   Kolom A: ID
//   Kolom B: Nama
//   Kolom C: Username
//   Kolom D: Password
//   Kolom E: Role
//   Kolom F: NAMA UPT
//   Kolom G: Waktu_Dibuat
//   Kolom H: NPSN
//   Kolom I: Kecamatan
//   Kolom J: Kepala Sekolah
//   Kolom K: NIP Kepala Sekolah
//   Kolom L: Bendahara BOS
//   Kolom M: NIP Bendahara
//   Kolom N: Pengurus Barang
//   Kolom O: NIP Pengurus Barang
//   Kolom P: Status Akun
// =========================================================================================

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
}`;

