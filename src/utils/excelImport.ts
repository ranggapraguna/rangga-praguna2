import * as XLSX from 'xlsx';
import { RincianRekeningItem, REKENING_PERSEDIAAN_OPTIONS, KodeRekening, normalizeRekeningPersediaan } from '../types';

/**
 * Normalizes number from various Excel cell values:
 * - Direct number
 * - Indonesian formatted string (e.g. "Rp 23.112.000", "23.112.000,00", "1.500.000")
 * - Dash / "-" / "NIHIL" -> 0
 */
export function parseExcelNumber(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : val;
  }

  const str = String(val).trim();
  if (!str || str === '-' || str === '–' || str === '—' || str.toLowerCase() === 'nihil' || str.toLowerCase() === 'nil') {
    return 0;
  }

  // Remove currency symbol, whitespace, and brackets
  let cleaned = str.replace(/[Rp\s()]/gi, '');

  // Handle Indonesian currency formatting: e.g. 1.250.000,00 or 1.250.000
  if (cleaned.includes('.') && cleaned.includes(',')) {
    // Has both dot and comma (e.g. 1.250.000,50)
    cleaned = cleaned.replace(/\./g, '').replace(/,/g, '.');
  } else if (cleaned.includes('.')) {
    // Multiple dots (e.g. 1.250.000) or single dot followed by 3 digits -> thousands separator
    const dotParts = cleaned.split('.');
    if (dotParts.length > 2 || (dotParts.length === 2 && dotParts[1].length === 3)) {
      cleaned = cleaned.replace(/\./g, '');
    }
  } else if (cleaned.includes(',')) {
    // Single comma (e.g. 1250,50 or 1250000,00)
    cleaned = cleaned.replace(/,/g, '.');
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Normalizes and matches raw string from Excel to the closest official Rekening Persediaan
 */
export function findMatchingRekening(raw: string): KodeRekening {
  if (!raw) return 'Alat/Bahan untuk Kegiatan Kantor- Alat Tulis Kantor';
  const clean = raw.trim();

  // 1. Direct or legacy map normalization
  const normalized = normalizeRekeningPersediaan(clean);
  if (REKENING_PERSEDIAAN_OPTIONS.includes(normalized)) {
    return normalized;
  }

  const lower = clean.toLowerCase();

  // 2. Common aliases & government formatting mapping to canonical Rekening Persediaan
  const aliasMap: [RegExp, string][] = [
    [/alat\s*tulis\s*kantor|\batk\b/i, 'Alat/Bahan untuk Kegiatan Kantor- Alat Tulis Kantor'],
    [/kertas\s*(?:dan|&)\s*cover/i, 'Alat/Bahan untuk Kegiatan Kantor- Kertas dan Cover'],
    [/bahan\s*cetak/i, 'Alat/Bahan untuk Kegiatan Kantor- Bahan Cetak'],
    [/bahan\s*komputer/i, 'Alat/Bahan untuk Kegiatan Kantor- Bahan Komputer'],
    [/alat\s*listrik/i, 'Alat/Bahan untuk Kegiatan Kantor- Alat Listrik'],
    [/perabot\s*kantor/i, 'Alat/Bahan untuk Kegiatan Kantor- Perabot Kantor'],
    [/perangko|materai|benda\s*pos/i, 'Alat/Bahan untuk Kegiatan Kantor- Benda Pos'],
    [/perlengkapan\s*dinas/i, 'Alat/Bahan untuk Kegiatan Kantor- Perlengkapan Dinas'],
    [/kaporlap|perlengkapan\s*satwa/i, 'Alat/Bahan untuk Kegiatan Kantor- Kaporlap dan Perlengkapan Satwa'],
    [/dokumen.*tender|administrasi\s*tender/i, 'Alat/Bahan untuk Kegiatan Kantor-Persediaan Dokumen/Administrasi Tender'],
    [/suvenir|cendera\s*mata/i, 'Alat/Bahan untuk Kegiatan Kantor- Suvenir/Cendera Mata'],
    [/pendukung\s*olahraga|pendukung\s*olah\s*raga/i, 'Alat/Bahan untuk Kegiatan Kantor- Perlengkapan Pendukung Olahraga'],
    [/kegiatan\s*kantor\s*lainnya/i, 'Alat/Bahan untuk Kegiatan Kantor- Alat/Bahan untuk Kegiatan Kantor Lainnya'],
    [/makanan\s*(?:dan|&)\s*minuman\s*rapat/i, 'Makanan dan Minuman Rapat'],
    [/makanan\s*(?:dan|&)\s*minuman\s*jamuan\s*tamu/i, 'Makanan dan Minuman Jamuan Tamu'],
    [/daya\s*tahan\s*tubuh/i, 'Penambah Daya Tahan Tubuh'],
    [/urusan\s*pendidikan/i, 'Makanan dan Minuman pada Fasilitas Pelayanan Urusan Pendidikan'],
    [/urusan\s*kesehatan/i, 'Makanan dan Minuman pada Fasilitas Pelayanan Urusan Kesehatan'],
    [/urusan\s*sosial/i, 'Makanan dan Minuman pada Fasilitas Pelayanan Urusan Sosial'],
    [/aktivitas\s*lapangan/i, 'Makanan dan Minuman Aktivitas Lapangan'],
    [/bahan\s*bakar|pelumas/i, 'Bahan-Bahan Bakar dan Pelumas'],
    [/bahan\s*baku/i, 'Bahan-Bahan Baku'],
    [/bangunan\s*(?:dan|&)\s*konstruksi/i, 'Bahan-Bahan Bangunan dan Konstruksi'],
    [/bahan\s*kimia(?!\s*nuklir)/i, 'Bahan-Bahan Kimia'],
    [/bahan\s*kimia\s*nuklir/i, 'Bahan-Bahan Kimia Nuklir'],
    [/tabung\s*gas/i, 'Bahan-Isi Tabung Gas'],
    [/pemadam\s*kebakaran/i, 'Bahan-Isi Tabung Pemadam Kebakaran'],
    [/bibit\s*tanaman/i, 'Bahan-Bahan/Bibit Tanaman'],
    [/bibit\s*ternak|bibit\s*ikan/i, 'Bahan-Bahan/Bibit Ternak/Bibit Ikan'],
    [/diserahkan\s*kepada\s*masyarakat/i, 'Barang untuk Dijual/Diserahkan kepada Masyarakat'],
    [/pihak\s*ketiga|pihak\s*lain|diserahkan\s*lainnya/i, 'Barang untuk Dijual/Diserahkan kepada Pihak Ketiga/Pihak Lain'],
    [/obat.*lainnya/i, 'Obat-Obatan-Obat-Obatan Lainnya'],
    [/obat/i, 'Obat-Obatan-Obat'],
    [/natura.*pakan\s*lainnya/i, 'Natura dan Pakan-Natura dan Pakan Lainnya'],
    [/natura/i, 'Natura dan Pakan-Natura'],
    [/pakan/i, 'Natura dan Pakan-Pakan'],
  ];

  for (const [regex, standardName] of aliasMap) {
    if (regex.test(lower)) {
      return standardName;
    }
  }

  // 3. Substring search in REKENING_PERSEDIAAN_OPTIONS
  const partial = REKENING_PERSEDIAAN_OPTIONS.find((r) => {
    const rLower = r.toLowerCase();
    return rLower.includes(lower) || lower.includes(rLower);
  });
  if (partial) return partial;

  // 4. Fallback to normalized string
  return normalized;
}

export interface ParseExcelResult {
  items: RincianRekeningItem[];
  totalRowsFound: number;
  sheetName: string;
  error?: string;
}

/**
 * Parses an Excel (.xlsx, .xls) or CSV file buffer into RincianRekeningItem[]
 */
export function parsePersediaanExcel(fileBuffer: ArrayBuffer): ParseExcelResult {
  try {
    const data = new Uint8Array(fileBuffer);
    const workbook = XLSX.read(data, { type: 'array' });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return { items: [], totalRowsFound: 0, sheetName: '', error: 'File Excel tidak memiliki lembar kerja (sheet).' };
    }

    // Prefer sheet with "persediaan" or "belanja" in the name, otherwise use first sheet
    let sheetName = workbook.SheetNames[0];
    const preferredSheet = workbook.SheetNames.find((name) =>
      /persediaan|belanja|rekon|lampiran/i.test(name)
    );
    if (preferredSheet) {
      sheetName = preferredSheet;
    }

    const worksheet = workbook.Sheets[sheetName];
    const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    if (!rawRows || rawRows.length === 0) {
      return { items: [], totalRowsFound: 0, sheetName, error: 'Lembar kerja Excel kosong.' };
    }

    // Detect header row index and column positions
    let headerRowIdx = -1;
    let colRekening = -1;
    let colSaldoAwal = -1;
    let colBelanjaLra = -1;
    let colPengeluaranSaldoAwal = -1;
    let colPengeluaranBelanja = -1;
    let colHibahMasuk = -1;
    let colHibahKeluar = -1;
    let colSaldoAkhir = -1;

    // Scan first 15 rows to find header pattern
    for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
      const row = rawRows[r].map((cell) => String(cell || '').trim().toLowerCase());
      const hasRekeningHeader = row.some((c) =>
        /jenis\s*persediaan|kode\s*rekening|nama\s*rekening|nama\s*barang|uraian/i.test(c)
      );
      const hasNominalHeader = row.some((c) =>
        /saldo\s*awal|belanja|lra|pengeluaran|hibah|masuk|keluar/i.test(c)
      );

      if (hasRekeningHeader || hasNominalHeader) {
        headerRowIdx = r;
        break;
      }
    }

    // If header row found, inspect row and possibly sub-header row (for merged column headers)
    if (headerRowIdx !== -1) {
      const r1 = rawRows[headerRowIdx].map((c) => String(c || '').trim().toLowerCase());
      const r2 =
        headerRowIdx + 1 < rawRows.length
          ? rawRows[headerRowIdx + 1].map((c) => String(c || '').trim().toLowerCase())
          : [];

      // Combine column texts from r1 and r2
      const maxCols = Math.max(r1.length, r2.length);
      for (let c = 0; c < maxCols; c++) {
        const top = r1[c] || '';
        const bot = r2[c] || '';
        const combined = `${top} ${bot}`.trim();

        if (colRekening === -1 && /jenis\s*persediaan|kode\s*rekening|nama\s*rekening|nama\s*barang|uraian/i.test(combined)) {
          colRekening = c;
        } else if (colSaldoAwal === -1 && /saldo\s*awal.*1\s*jan|saldo\s*awal$/i.test(combined)) {
          colSaldoAwal = c;
        } else if (colBelanjaLra === -1 && /belanja\s*lra|belanja\s*masuk|penerimaan/i.test(combined)) {
          colBelanjaLra = c;
        } else if (
          colPengeluaranSaldoAwal === -1 &&
          ((/pengeluaran/i.test(top) && /saldo\s*awal/i.test(bot)) ||
            /pengeluaran.*saldo\s*awal|keluar.*saldo\s*awal/i.test(combined))
        ) {
          colPengeluaranSaldoAwal = c;
        } else if (
          colPengeluaranBelanja === -1 &&
          ((/pengeluaran/i.test(top) && /belanja/i.test(bot)) ||
            /pengeluaran.*belanja|keluar.*belanja/i.test(combined))
        ) {
          colPengeluaranBelanja = c;
        } else if (
          colHibahMasuk === -1 &&
          ((/hibah/i.test(top) && /masuk/i.test(bot)) || /hibah.*masuk/i.test(combined))
        ) {
          colHibahMasuk = c;
        } else if (
          colHibahKeluar === -1 &&
          ((/hibah/i.test(top) && /keluar/i.test(bot)) || /hibah.*keluar/i.test(combined))
        ) {
          colHibahKeluar = c;
        } else if (colSaldoAkhir === -1 && /saldo\s*akhir|sisa\s*nilai/i.test(combined)) {
          colSaldoAkhir = c;
        }
      }

      // Check if subheader row r2 exists and contains 'saldo awal', 'belanja', 'masuk', 'keluar'
      // If so, actual data begins at headerRowIdx + 2
      const isSubHeaderRow = r2.some((c) => /saldo\s*awal|belanja|masuk|keluar/i.test(c));
      if (isSubHeaderRow) {
        headerRowIdx = headerRowIdx + 1;
      }
    }

    // Fallbacks if columns were not recognized by text
    if (colRekening === -1) {
      // Typically column 1 (index 1) if col 0 is 'No', or column 0 if no 'No'
      colRekening = rawRows[0] && rawRows[0].length > 1 ? 1 : 0;
    }
    if (colSaldoAwal === -1) colSaldoAwal = colRekening + 1;
    if (colBelanjaLra === -1) colBelanjaLra = colRekening + 2;
    if (colPengeluaranSaldoAwal === -1) colPengeluaranSaldoAwal = colRekening + 3;
    if (colPengeluaranBelanja === -1) colPengeluaranBelanja = colRekening + 4;
    if (colHibahMasuk === -1) colHibahMasuk = colRekening + 5;
    if (colHibahKeluar === -1) colHibahKeluar = colRekening + 6;

    const dataStartRow = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;
    const parsedItems: RincianRekeningItem[] = [];

    for (let r = dataStartRow; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!row || row.length === 0) continue;

      const rawRekening = String(row[colRekening] || '').trim();

      // Skip empty or summary rows
      if (!rawRekening) continue;
      const lowerRekening = rawRekening.toLowerCase();
      if (
        lowerRekening === 'jumlah' ||
        lowerRekening === 'total' ||
        lowerRekening === 'sub total' ||
        lowerRekening === 'subtotal' ||
        lowerRekening.startsWith('jumlah total') ||
        lowerRekening.startsWith('sub total') ||
        lowerRekening === 'nihil'
      ) {
        continue;
      }

      // Parse nominal values
      const nilaiSaldoAwal = colSaldoAwal >= 0 ? parseExcelNumber(row[colSaldoAwal]) : 0;
      const nilaiBelanjaLra = colBelanjaLra >= 0 ? parseExcelNumber(row[colBelanjaLra]) : 0;
      const pengeluaranSaldoAwal = colPengeluaranSaldoAwal >= 0 ? parseExcelNumber(row[colPengeluaranSaldoAwal]) : 0;
      const pengeluaranBelanja = colPengeluaranBelanja >= 0 ? parseExcelNumber(row[colPengeluaranBelanja]) : 0;
      const hibahMasuk = colHibahMasuk >= 0 ? parseExcelNumber(row[colHibahMasuk]) : 0;
      const hibahKeluar = colHibahKeluar >= 0 ? parseExcelNumber(row[colHibahKeluar]) : 0;

      const totalMasukItem = nilaiSaldoAwal + nilaiBelanjaLra + hibahMasuk;
      const totalKeluarItem = pengeluaranSaldoAwal + pengeluaranBelanja + hibahKeluar;
      const sisaNilai = totalMasukItem - totalKeluarItem;

      // Skip row if it has absolutely zero nominal and seems like header fragment
      if (
        totalMasukItem === 0 &&
        totalKeluarItem === 0 &&
        (lowerRekening.includes('jenis persediaan') || lowerRekening.includes('kode rekening'))
      ) {
        continue;
      }

      const matchedKodeRekening = findMatchingRekening(rawRekening);
      const isHibah = hibahMasuk > 0 || hibahKeluar > 0;
      const saldoAwalMasuk = nilaiSaldoAwal > 0 ? 'Saldo Awal' : 'Bukan Saldo Awal';
      const saldoAwalKeluar = pengeluaranSaldoAwal > 0 ? 'Saldo Awal' : 'Bukan Saldo Awal';

      parsedItems.push({
        id: `import-${Date.now()}-${r}-${Math.random().toString(36).slice(2, 6)}`,
        kodeRekening: matchedKodeRekening,
        saldoAwal: saldoAwalMasuk,
        saldoAwalMasuk,
        saldoAwalKeluar,
        isHibah,
        nilaiSaldoAwal,
        nilaiBelanjaLra,
        pengeluaranSaldoAwal,
        pengeluaranBelanja,
        hibahMasuk,
        hibahKeluar,
        nilaiMasuk: totalMasukItem,
        nilaiKeluar: totalKeluarItem,
        sisaNilai,
      });
    }

    if (parsedItems.length === 0) {
      return {
        items: [],
        totalRowsFound: 0,
        sheetName,
        error: 'Tidak ditemukan data rincian persediaan yang valid di dalam file Excel.',
      };
    }

    return {
      items: parsedItems,
      totalRowsFound: parsedItems.length,
      sheetName,
    };
  } catch (err: any) {
    return {
      items: [],
      totalRowsFound: 0,
      sheetName: '',
      error: `Gagal membaca file Excel: ${err?.message || 'Format tidak didukung.'}`,
    };
  }
}

/**
 * Generates and downloads a standardized template Excel file for inputting Belanja Persediaan
 */
export function downloadPersediaanExcelTemplate(): void {
  const headers = [
    [
      'No',
      'Jenis Persediaan',
      'Saldo Awal (per 1 Jan)',
      'Belanja LRA',
      'Pengeluaran (Saldo Awal)',
      'Pengeluaran (Belanja)',
      'Hibah (Masuk)',
      'Hibah (Keluar)',
      'Saldo Akhir',
    ],
  ];

  // 5 rekening belanja contoh dengan nilai dikosongkan agar pengguna dapat mengisi nominal sendiri
  const sampleData = [
    [1, 'Alat/Bahan untuk Kegiatan Kantor- Alat Tulis Kantor', '', '', '', '', '', '', ''],
    [2, 'Alat/Bahan untuk Kegiatan Kantor- Kertas dan Cover', '', '', '', '', '', '', ''],
    [3, 'Alat/Bahan untuk Kegiatan Kantor- Alat Listrik', '', '', '', '', '', '', ''],
    [4, 'Makanan dan Minuman Rapat', '', '', '', '', '', '', ''],
    [5, 'Barang untuk Dijual/Diserahkan kepada Masyarakat', '', '', '', '', '', '', ''],
  ];

  const fullData = [...headers, ...sampleData];
  const worksheet = XLSX.utils.aoa_to_sheet(fullData);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 6 },  // No
    { wch: 45 }, // Jenis Persediaan
    { wch: 22 }, // Saldo Awal
    { wch: 18 }, // Belanja LRA
    { wch: 24 }, // Pengeluaran (Saldo Awal)
    { wch: 22 }, // Pengeluaran (Belanja)
    { wch: 16 }, // Hibah (Masuk)
    { wch: 16 }, // Hibah (Keluar)
    { wch: 18 }, // Saldo Akhir
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Belanja Persediaan');

  // Trigger file download
  XLSX.writeFile(workbook, 'Template_Belanja_Persediaan.xlsx');
}
