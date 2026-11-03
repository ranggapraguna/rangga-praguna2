import { SchoolExpense, SchoolInfo, BarangEkstraItem } from '../types';
import { INITIAL_SCHOOL_INFO } from '../data/initialData';
import { loadUptSchools, normalizeUptKey, splitCsvLine } from '../data/schoolData';

const LOCAL_DB_KEYS_TO_PURGE = [
  'appsheet_school_expenses_v1',
  'appsheet_school_expenses_v2_clean',
  'appsheet_school_expenses_v3_reset',
  'bosp_appsheet_expenses_v2',
  'appsheet_school_expenses_v4_clean',
  'appsheet_school_info_v1',
  'bosp_barang_ekstra_v1',
  'bosp_upt_schools_spreadsheet_v1',
  'appsheet_registered_accounts_v1',
  'appsheet_registered_accounts_v2',
  'appsheet_registered_accounts_v3_clean',
  'bosp_last_rekapan_sync_summary_v1',
];

const LEGACY_DEMO_IDS = new Set([
  'exp-001',
  'exp-002',
  'exp-003',
  'exp-004',
  'exp-005',
  'exp-006',
  'exp-007',
]);

// In-memory runtime state (synced exclusively with Google Spreadsheet Database)
let runtimeExpenses: SchoolExpense[] = [];
let runtimeSchoolInfo: SchoolInfo = { ...INITIAL_SCHOOL_INFO };
let runtimeBarangEkstra: BarangEkstraItem[] = [];

export function purgeAllLocalDatabaseStorage(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    LOCAL_DB_KEYS_TO_PURGE.forEach((key) => {
      localStorage.removeItem(key);
    });
  } catch {
    // ignore storage errors
  }
}

export function filterOutLegacyDemoExpenses(expenses: SchoolExpense[]): SchoolExpense[] {
  if (!Array.isArray(expenses)) return [];
  return expenses.filter((item) => item && !LEGACY_DEMO_IDS.has(item.id));
}

export function clearAllSchoolExpenses(): void {
  purgeAllLocalDatabaseStorage();
  runtimeExpenses = [];
}

export function loadSchoolExpenses(): SchoolExpense[] {
  purgeAllLocalDatabaseStorage();
  return runtimeExpenses;
}

export function saveSchoolExpenses(expenses: SchoolExpense[]): void {
  purgeAllLocalDatabaseStorage();
  runtimeExpenses = Array.isArray(expenses) ? filterOutLegacyDemoExpenses(expenses) : [];
}

export function loadSchoolInfo(): SchoolInfo {
  purgeAllLocalDatabaseStorage();
  return runtimeSchoolInfo;
}

export function saveSchoolInfo(info: SchoolInfo): void {
  purgeAllLocalDatabaseStorage();
  runtimeSchoolInfo = { ...INITIAL_SCHOOL_INFO, ...info };
}

export function exportExpensesToCSV(expenses: SchoolExpense[]): void {
  const headers = [
    'No. Bukti / Kuitansi',
    'Tanggal',
    'Triwulan',
    'Sumber Dana',
    'Komponen BOSP',
    'Kode Rekening Belanja',
    'Uraian Kegiatan / Belanja',
    'Penerima / Toko / Rekanan',
    'NPWP',
    'Metode Pembayaran',
    'Volume',
    'Satuan',
    'Harga Satuan (Rp)',
    'Subtotal (Rp)',
    'Tipe Pajak',
    'Nilai Pajak (Rp)',
    'Total Bersih (Rp)',
    'Status SPJ',
    'Catatan',
  ];

  const escapeCSV = (val: string | number | undefined) => {
    if (val === undefined || val === null) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = expenses.map((e) => [
    escapeCSV(e.noBukti),
    escapeCSV(e.tanggal),
    escapeCSV(e.triwulan),
    escapeCSV(e.sumberDana),
    escapeCSV(e.komponen),
    escapeCSV(e.kodeRekening),
    escapeCSV(e.uraian),
    escapeCSV(e.penerimaToko),
    escapeCSV(e.npwpPenerima || '-'),
    escapeCSV(e.metodePembayaran),
    e.volume,
    escapeCSV(e.satuan),
    e.hargaSatuan,
    e.subtotal,
    escapeCSV(e.tipePajak),
    e.nilaiPajak,
    e.totalBersih,
    escapeCSV(e.status),
    escapeCSV(e.catatan || '-'),
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Rekap_Belanja_Sekolah_BOSP_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function loadBarangEkstraItems(): BarangEkstraItem[] {
  purgeAllLocalDatabaseStorage();
  return runtimeBarangEkstra;
}

export function saveBarangEkstraItems(items: BarangEkstraItem[]): void {
  purgeAllLocalDatabaseStorage();
  if (!Array.isArray(items)) {
    runtimeBarangEkstra = [];
    return;
  }
  runtimeBarangEkstra = items.map((item) => {
    if (
      item &&
      item.schoolName &&
      (item.schoolName === 'DINAS PENDIDIKAN KAB. MINAHASA TENGGARA' ||
        item.schoolName === 'DINAS PENDIDIKAN KABUPATEN MINAHASA TENGGARA' ||
        (item.schoolName.toUpperCase().startsWith('DINAS PENDIDIKAN') &&
          item.schoolName !== 'DINAS PENDIDIKAN'))
    ) {
      return { ...item, schoolName: 'DINAS PENDIDIKAN' };
    }
    return item;
  });
}

export function parseAndNormalizeBarangEkstraCsv(csvText: string): BarangEkstraItem[] {
  if (!csvText || !csvText.trim()) return [];
  const lines = csvText.replace(/\r\n/g, '\n').split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const uptSchools = loadUptSchools();
  const uptMap = new Map<string, { upt: string; npsn: string }>();
  for (const s of uptSchools) {
    uptMap.set(normalizeUptKey(s.upt), { upt: s.upt, npsn: s.npsn });
  }

  const items: BarangEkstraItem[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], ',');
    if (cols.length < 6) continue;
    const namaBarang = (cols[1] || '').replace(/^["\s]+|["\s]+$/g, '');
    if (!namaBarang || namaBarang.toUpperCase() === 'NAMA BARANG' || namaBarang === 'No.' || namaBarang.startsWith(',,')) continue;

    const tahun = parseInt(cols[2]) || 2024;
    const volume = parseFloat(String(cols[3] || '1').replace(/[^0-9.]/g, '')) || 1;
    
    const cleanPrice = (val: string) => {
      if (!val) return 0;
      const s = val.replace(/"/g, '').trim();
      const numericStr = s.replace(/\./g, '').replace(/,/g, '.').replace(/[^0-9.]/g, '');
      return parseFloat(numericStr) || 0;
    };

    const hargaSatuan = cleanPrice(cols[4]);
    const rawTotal = cleanPrice(cols[5]);
    const totalHarga = rawTotal > 0 ? rawTotal : volume * hargaSatuan;

    const rawSchool = (cols[6] || 'DINAS PENDIDIKAN').replace(/"/g, '').trim();
    const normKey = normalizeUptKey(rawSchool);
    const matched = uptMap.get(normKey);

    let schoolName = matched ? matched.upt : (rawSchool ? rawSchool.toUpperCase() : 'DINAS PENDIDIKAN');
    if (
      schoolName === 'DINAS PENDIDIKAN KAB. MINAHASA TENGGARA' ||
      schoolName === 'DINAS PENDIDIKAN KABUPATEN MINAHASA TENGGARA' ||
      schoolName.toUpperCase().startsWith('DINAS PENDIDIKAN')
    ) {
      schoolName = 'DINAS PENDIDIKAN';
    }
    const npsn = matched ? matched.npsn : '40100001';

    items.push({
      id: `be-csv-${i}-${Math.random().toString(36).substr(2, 4)}`,
      tahunAnggaran: tahun >= 2018 && tahun <= 2027 ? tahun : 2024,
      schoolName,
      npsn,
      namaBarang: namaBarang.trim(),
      spesifikasi: '',
      volume,
      satuan: 'Unit',
      hargaSatuan,
      totalHarga,
      kondisi: 'Baik',
      sumberPerolehan: 'BOS Reguler',
      tanggalPerolehan: `${tahun >= 2018 && tahun <= 2027 ? tahun : 2024}-01-01`,
      keterangan: 'Impor Data Barang Ekstra Disdik',
      status: 'Disetujui Kepala Sekolah',
      createdAt: new Date().toISOString(),
    });
  }

  return items;
}

export interface SharedServerStatePayload {
  expenses?: SchoolExpense[];
  deletedExpenseIds?: string[];
  clearAllExpenses?: boolean;
  replaceAllExpenses?: boolean;
  barangEkstraItems?: BarangEkstraItem[];
  deletedBarangEkstraIds?: string[];
  replaceAllBarangEkstra?: boolean;
  uptSchools?: any[];
  replaceAllUptSchools?: boolean;
  schoolInfo?: SchoolInfo;
  isDirectSave?: boolean;
}

export interface SharedServerStateResponse {
  expenses: SchoolExpense[];
  deletedExpenseIds: string[];
  barangEkstraItems: BarangEkstraItem[];
  deletedBarangEkstraIds: string[];
  uptSchools: any[];
  schoolInfoByKey: Record<string, SchoolInfo>;
  updatedAt: string;
}

export async function pushSharedStateToServer(
  _payload: SharedServerStatePayload
): Promise<SharedServerStateResponse | null> {
  return null;
}

export async function fetchSharedStateFromServer(): Promise<SharedServerStateResponse | null> {
  return null;
}
