import * as XLSX from 'xlsx';
import { SchoolExpense, SchoolInfo, Triwulan, BarangEkstraItem, RincianRekeningItem } from '../types';
import { loadUptSchools, normalizeUptKey, UptSchoolAccount, generateSlugUsername, inferKecamatanFromUpt } from '../data/schoolData';
import { parseExcelNumber, findMatchingRekening } from './excelImport';
import { buildMergedPersediaanTableRows } from './budgetCalculations';
import { normalizeUserRole } from './auth';

// --- SHEET COLUMNS DEFINITIONS ---
export const COLS_PANEL_ADMIN = [
  'No',
  'Nama UPT Sekolah',
  'NPSN',
  'Kecamatan',
  'Jenjang',
  'Kepala Sekolah',
  'NIP Kepala Sekolah',
  'Bendahara BOS',
  'NIP Bendahara',
  'Pengurus Barang',
  'NIP Pengurus Barang',
  'Pagu Tahunan (Rp)',
  'Total Belanja LRA (Rp)',
  'Sisa Pagu (Rp)',
  'Serapan (%)',
  'Total Transaksi',
  'Status Approval'
] as const;


export const COLS_BELANJA_PERSEDIAAN = [
  'No',
  'ID Transaksi',
  'Nama UPT Sekolah',
  'NPSN',
  'Tanggal SPJ',
  'No Bukti',
  'Triwulan',
  'Sumber Dana',
  'Komponen BOS',
  'Kode Rekening Persediaan',
  'Uraian Belanja',
  'Penerima / Nama Toko',
  'NPWP Toko',
  'Metode Bayar',
  'Volume',
  'Satuan',
  'Harga Satuan (Rp)',
  'Subtotal (Rp)',
  'Saldo Awal 1 Jan (Rp)',
  'Belanja LRA (Rp)',
  'Pengeluaran Saldo Awal (Rp)',
  'Pengeluaran Belanja (Rp)',
  'Hibah Masuk (Rp)',
  'Hibah Keluar (Rp)',
  'Saldo Akhir (Rp)',
  'Jenis Pajak',
  'Nilai Pajak (Rp)',
  'Total Bersih (Rp)',
  'Status SPJ',
  'Catatan'
] as const;

export const COLS_BELANJA_PEMELIHARAAN = [
  'No',
  'ID Transaksi',
  'Nama UPT Sekolah',
  'NPSN',
  'Tanggal SPJ',
  'No Bukti Kas',
  'No BAST Pemeliharaan',
  'Tanggal BAST',
  'Triwulan',
  'Sumber Dana',
  'Kode Rekening Pemeliharaan',
  'Jenis Pekerjaan / Pemeliharaan',
  'Nilai Jasa Pemeliharaan (Rp)',
  'Nilai Barang / Suku Cadang (Rp)',
  'Total Belanja LRA (Jasa + Barang) (Rp)',
  'Nilai Pengakuan BAST (Rp)',
  'Pengeluaran Belanja Pemeliharaan (Rp)',
  'Pengeluaran BAST Di Luar Belanja (Rp)',
  'Rekanan / Bengkel / Toko',
  'Keterangan Pemeliharaan',
  'Status SPJ'
] as const;

export const COLS_BARANG_EKSTRA = [
  'No',
  'ID Barang',
  'Nama UPT Sekolah',
  'NPSN',
  'Tahun Anggaran',
  'Tanggal Perolehan',
  'Nama Barang',
  'Merk / Spesifikasi',
  'Volume',
  'Satuan',
  'Harga Satuan (Rp)',
  'Total Nilai Perolehan (Rp)',
  'Kondisi',
  'Sumber Dana',
  'Keterangan / Lokasi',
  'Status'
] as const;

export const COLS_AKUN_APLIKASI = [
  'ID',
  'Nama',
  'Username',
  'Password',
  'Role',
  'NAMA UPT',
  'Waktu_Dibuat',
  'NPSN',
  'Kecamatan',
  'Kepala Sekolah',
  'NIP Kepala Sekolah',
  'Bendahara BOS',
  'NIP Bendahara',
  'Pengurus Barang',
  'NIP Pengurus Barang',
  'Status Akun'
] as const;

export interface MasterDatabaseExportData {
  schoolInfo: SchoolInfo;
  expenses: SchoolExpense[];
  barangEkstraItems: BarangEkstraItem[];
  masterSchools?: UptSchoolAccount[];
}

/**
 * Builds data rows for Sheet 1: Panel Admin & UPT Sekolah
 */
export function buildPanelAdminSheetRows(
  masterSchools: UptSchoolAccount[],
  expenses: SchoolExpense[],
  schoolInfo: SchoolInfo
): (string | number)[][] {
  const rows: (string | number)[][] = [[...COLS_PANEL_ADMIN]];

  // Group expenses by school
  const schoolSpendingMap = new Map<string, { total: number; count: number; approvedCount: number }>();
  expenses.forEach((e) => {
    const norm = normalizeUptKey(e.schoolName || schoolInfo.namaSekolah);
    const existing = schoolSpendingMap.get(norm) || { total: 0, count: 0, approvedCount: 0 };
    existing.total += Number(e.totalBersih) || Number(e.subtotal) || 0;
    existing.count += 1;
    if (e.status === 'Disetujui Kepala Sekolah') {
      existing.approvedCount += 1;
    }
    schoolSpendingMap.set(norm, existing);
  });

  masterSchools.forEach((school, index) => {
    const norm = normalizeUptKey(school.upt);
    const stat = schoolSpendingMap.get(norm) || { total: 0, count: 0, approvedCount: 0 };
    const pagu = schoolInfo.totalPaguTahunan > 0 ? schoolInfo.totalPaguTahunan : 150000000;
    const sisa = Math.max(0, pagu - stat.total);
    const serapan = pagu > 0 ? Number(((stat.total / pagu) * 100).toFixed(1)) : 0;
    const jenjang = school.upt.toUpperCase().includes('SMP')
      ? 'SMP'
      : school.upt.toUpperCase().includes('SD')
      ? 'SD'
      : school.upt.toUpperCase().includes('TK')
      ? 'TK/PAUD'
      : 'Dinas/Lainnya';

    let statusApproval = 'Belum Ada Transaksi';
    if (stat.count > 0) {
      if (stat.approvedCount === stat.count) {
        statusApproval = 'Semua Disetujui';
      } else if (stat.approvedCount > 0) {
        statusApproval = `${stat.approvedCount}/${stat.count} Disetujui`;
      } else {
        statusApproval = 'Menunggu Verifikasi';
      }
    }

    rows.push([
      index + 1,
      school.upt,
      school.npsn,
      school.kecamatan,
      jenjang,
      school.kepalaSekolah || '-',
      school.nipKepalaSekolah || '-',
      school.bendahara || '-',
      school.nipBendahara || '-',
      school.pengurusBarang || '-',
      school.nipPengurusBarang || '-',
      pagu,
      stat.total,
      sisa,
      `${serapan}%`,
      stat.count,
      statusApproval
    ]);
  });

  return rows;
}

// Standar lengkap seluruh rekening / jenis persediaan sesuai format laporan menu Rekapan Dinas
export const STANDARD_JENIS_PERSEDIAAN_REKAP = [
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
] as const;

export const COLS_REKAPAN_DINAS = [
  'NO',
  'NAMA UPT / SATUAN PENDIDIKAN',
  ...STANDARD_JENIS_PERSEDIAAN_REKAP,
  'TOTAL MASUK',
  'TOTAL KELUAR',
  'TOTAL SALDO AKHIR'
] as const;

/**
 * Builds data rows for Sheet 2: Rekapan Se Dinas
 * Menggunakan bentuk tabel matriks 3 baris header persis seperti di Laporan Menu Rekapan Dinas:
 * - Baris 1: NO | NAMA UPT / SATUAN PENDIDIKAN | [JENIS PERSEDIAAN (7 kolom)] ... | TOTAL MASUK | TOTAL KELUAR | TOTAL SALDO AKHIR
 * - Baris 2: "" | "" | SALDO AWAL (3 kolom) | BELANJA (3 kolom) | SALDO AKHIR ... | "" | "" | ""
 * - Baris 3: "" | "" | Masuk | Keluar | Sisa | Masuk | Keluar | Sisa | Saldo Akhir ... | "" | "" | ""
 * - Baris Data per UPT Satuan Pendidikan
 * - Baris Footer: JUMLAH TOTAL SE-KABUPATEN
 */
export function buildRekapanDinasSheetRows(
  masterSchools: UptSchoolAccount[],
  expenses: SchoolExpense[],
  schoolInfo: SchoolInfo
): (string | number)[][] {
  // Group expenses by normalized school name
  const mapSchoolExpenses = new Map<string, SchoolExpense[]>();
  const extraSchoolNames = new Map<string, string>();

  expenses.forEach((e) => {
    const rawName = (e.schoolName || schoolInfo.namaSekolah || 'UPT Sekolah').trim();
    const norm = normalizeUptKey(rawName);
    const list = mapSchoolExpenses.get(norm) || [];
    list.push(e);
    mapSchoolExpenses.set(norm, list);
    if (!extraSchoolNames.has(norm)) {
      extraSchoolNames.set(norm, rawName);
    }
  });

  // Collect all UPT schools (master list + any additional schools from expenses)
  const schoolEntries: { norm: string; schoolName: string }[] = [];
  const seenNorm = new Set<string>();

  masterSchools.forEach((s) => {
    const norm = normalizeUptKey(s.upt);
    if (!seenNorm.has(norm)) {
      seenNorm.add(norm);
      schoolEntries.push({ norm, schoolName: s.upt });
    }
  });

  extraSchoolNames.forEach((name, norm) => {
    if (!seenNorm.has(norm)) {
      seenNorm.add(norm);
      schoolEntries.push({ norm, schoolName: name });
    }
  });

  // Compute per-school rowsMap and collect any dynamic Jenis Persediaan
  const setJenis = new Set<string>(STANDARD_JENIS_PERSEDIAAN_REKAP);
  const computedSchools = schoolEntries.map((entry) => {
    const schoolExps = mapSchoolExpenses.get(entry.norm) || [];
    const rowsMap = new Map<
      string,
      {
        saMasuk: number;
        saKeluar: number;
        saSisa: number;
        blMasuk: number;
        blKeluar: number;
        blSisa: number;
        saldoAkhir: number;
      }
    >();

    let totalMasuk = 0;
    let totalKeluar = 0;
    let totalSaldoAkhir = 0;

    if (schoolExps.length > 0) {
      const { rows: mergedRows } = buildMergedPersediaanTableRows(schoolExps);
      mergedRows.forEach((r) => {
        const kodeUpper = r.kodeRekening.trim().toUpperCase();
        setJenis.add(kodeUpper);

        const saMasuk = r.nominalSaldoAwal;
        const saKeluar = r.nominalPengeluaranSaldoAwal;
        const saSisa = saMasuk - saKeluar;
        const blMasuk = r.nominalBelanjaLra + r.nominalHibahMasuk;
        const blKeluar = r.nominalPengeluaranBelanja + r.nominalHibahKeluar;
        const blSisa = blMasuk - blKeluar;
        const saldoAkhir = r.sisaNilai;

        rowsMap.set(kodeUpper, {
          saMasuk,
          saKeluar,
          saSisa,
          blMasuk,
          blKeluar,
          blSisa,
          saldoAkhir,
        });

        totalMasuk += saMasuk + blMasuk;
        totalKeluar += saKeluar + blKeluar;
        totalSaldoAkhir += saldoAkhir;
      });
    }

    return {
      schoolName: entry.schoolName,
      rowsMap,
      totalMasuk,
      totalKeluar,
      totalSaldoAkhir,
    };
  });

  const allJenisList = Array.from(setJenis);

  // Build 3-Row Matrix Header identical to DinasRekapView
  const header1: (string | number)[] = ['NO', 'NAMA UPT / SATUAN PENDIDIKAN'];
  const header2: (string | number)[] = ['', ''];
  const header3: (string | number)[] = ['', ''];

  allJenisList.forEach((jenis) => {
    header1.push(jenis, '', '', '', '', '', '');
    header2.push('SALDO AWAL', '', '', 'BELANJA', '', '', 'SALDO AKHIR');
    header3.push('Masuk', 'Keluar', 'Sisa', 'Masuk', 'Keluar', 'Sisa', 'Saldo Akhir');
  });

  header1.push('TOTAL MASUK', 'TOTAL KELUAR', 'TOTAL SALDO AKHIR');
  header2.push('', '', '');
  header3.push('', '', '');

  const rows: (string | number)[][] = [header1, header2, header3];

  let grandTotMasuk = 0;
  let grandTotKeluar = 0;
  let grandTotSaldo = 0;

  // Build School Rows
  computedSchools.forEach((school, idx) => {
    const row: (string | number)[] = [idx + 1, school.schoolName];
    allJenisList.forEach((jenis) => {
      const d = school.rowsMap.get(jenis) || {
        saMasuk: 0,
        saKeluar: 0,
        saSisa: 0,
        blMasuk: 0,
        blKeluar: 0,
        blSisa: 0,
        saldoAkhir: 0,
      };
      row.push(d.saMasuk, d.saKeluar, d.saSisa, d.blMasuk, d.blKeluar, d.blSisa, d.saldoAkhir);
    });
    row.push(school.totalMasuk, school.totalKeluar, school.totalSaldoAkhir);
    rows.push(row);

    grandTotMasuk += school.totalMasuk;
    grandTotKeluar += school.totalKeluar;
    grandTotSaldo += school.totalSaldoAkhir;
  });

  // Build Footer Row: JUMLAH TOTAL SE-KABUPATEN
  const totRow: (string | number)[] = ['JUMLAH TOTAL SE-KABUPATEN', ''];
  allJenisList.forEach((jenis) => {
    let tSaM = 0;
    let tSaK = 0;
    let tSaS = 0;
    let tBlM = 0;
    let tBlK = 0;
    let tBlS = 0;
    let tSk = 0;

    computedSchools.forEach((s) => {
      const d = s.rowsMap.get(jenis);
      if (d) {
        tSaM += d.saMasuk;
        tSaK += d.saKeluar;
        tSaS += d.saSisa;
        tBlM += d.blMasuk;
        tBlK += d.blKeluar;
        tBlS += d.blSisa;
        tSk += d.saldoAkhir;
      }
    });

    totRow.push(tSaM, tSaK, tSaS, tBlM, tBlK, tBlS, tSk);
  });
  totRow.push(grandTotMasuk, grandTotKeluar, grandTotSaldo);
  rows.push(totRow);

  return rows;
}

/**
 * Builds Excel cell merges for the 3-row grouped header and footer of Sheet 2 (2_REKAPAN_SE_DINAS)
 */
export function buildRekapanDinasSheetMerges(
  totalRows: number,
  totalCols: number
): XLSX.Range[] {
  if (totalRows < 4 || totalCols < 5) return [];
  const merges: XLSX.Range[] = [
    // NO (Row 0..2, Col 0)
    { s: { r: 0, c: 0 }, e: { r: 2, c: 0 } },
    // NAMA UPT / SATUAN PENDIDIKAN (Row 0..2, Col 1)
    { s: { r: 0, c: 1 }, e: { r: 2, c: 1 } },
  ];

  const jenisCount = Math.floor((totalCols - 5) / 7);
  for (let i = 0; i < jenisCount; i++) {
    const colStart = 2 + i * 7;
    // Row 0: Jenis Persediaan (7 columns)
    merges.push({ s: { r: 0, c: colStart }, e: { r: 0, c: colStart + 6 } });
    // Row 1: SALDO AWAL (3 columns)
    merges.push({ s: { r: 1, c: colStart }, e: { r: 1, c: colStart + 2 } });
    // Row 1: BELANJA (3 columns)
    merges.push({ s: { r: 1, c: colStart + 3 }, e: { r: 1, c: colStart + 5 } });
    // Row 1..2: SALDO AKHIR (2 rows)
    merges.push({ s: { r: 1, c: colStart + 6 }, e: { r: 2, c: colStart + 6 } });
  }

  const endColStart = 2 + jenisCount * 7;
  // TOTAL MASUK, TOTAL KELUAR, TOTAL SALDO AKHIR (Row 0..2)
  merges.push({ s: { r: 0, c: endColStart }, e: { r: 2, c: endColStart } });
  merges.push({ s: { r: 0, c: endColStart + 1 }, e: { r: 2, c: endColStart + 1 } });
  merges.push({ s: { r: 0, c: endColStart + 2 }, e: { r: 2, c: endColStart + 2 } });

  // Footer Row: JUMLAH TOTAL SE-KABUPATEN (Col 0..1)
  const footerRowIdx = totalRows - 1;
  merges.push({ s: { r: footerRowIdx, c: 0 }, e: { r: footerRowIdx, c: 1 } });

  return merges;
}

/**
 * Builds data rows for Sheet 3: Input Belanja Persediaan
 */
export function buildBelanjaPersediaanSheetRows(
  expenses: SchoolExpense[],
  schoolInfo: SchoolInfo
): (string | number)[][] {
  const rows: (string | number)[][] = [[...COLS_BELANJA_PERSEDIAAN]];

  // Filter expenses that belong to persediaan
  const persediaanExpenses = expenses.filter(
    (e) => e.kategoriBelanja !== 'pemeliharaan'
  );

  let counter = 1;
  persediaanExpenses.forEach((exp) => {
    // If expense has rincian items, output each item as a row or aggregate
    if (exp.rincianItems && exp.rincianItems.length > 0) {
      exp.rincianItems.forEach((it) => {
        const sa = Number(it.nilaiSaldoAwal) || 0;
        const bl = Number(it.nilaiBelanjaLra) || (it.nilaiMasuk || 0);
        const psa = Number(it.pengeluaranSaldoAwal) || 0;
        const pbl = Number(it.pengeluaranBelanja) || (it.nilaiKeluar || 0);
        const hm = Number(it.hibahMasuk) || 0;
        const hk = Number(it.hibahKeluar) || 0;
        const sAkhir = Number(it.sisaNilai) || (sa + bl + hm - (psa + pbl + hk));

        rows.push([
          counter++,
          exp.id || `EXP-${counter}`,
          exp.schoolName || schoolInfo.namaSekolah,
          exp.npsn || schoolInfo.npsn,
          exp.tanggal || '',
          exp.noBukti || '',
          exp.triwulan || 'TW1',
          exp.sumberDana || 'BOS Reguler',
          exp.komponen || '5. Administrasi Kegiatan Sekolah & ATK',
          it.kodeRekening || exp.kodeRekening || '',
          exp.uraian || '',
          exp.penerimaToko || '',
          exp.npwpPenerima || '-',
          exp.metodePembayaran || 'Kas Tunai Bendahara',
          exp.volume || 1,
          exp.satuan || 'Paket',
          exp.hargaSatuan || 0,
          bl,
          sa,
          bl,
          psa,
          pbl,
          hm,
          hk,
          sAkhir,
          exp.tipePajak || 'Tanpa Pajak',
          exp.nilaiPajak || 0,
          exp.totalBersih || bl,
          exp.status || 'Draf',
          exp.catatan || ''
        ]);
      });
    } else {
      const sa = Number(exp.nilaiSaldoAwal) || 0;
      const bl = Number(exp.nilaiBelanjaLra) || Number(exp.subtotal) || 0;
      const psa = Number(exp.pengeluaranSaldoAwal) || 0;
      const pbl = Number(exp.pengeluaranBelanja) || Number(exp.subtotal) || 0;
      const hm = Number(exp.hibahMasuk) || 0;
      const hk = Number(exp.hibahKeluar) || 0;
      const sAkhir = Number(exp.sisaNilai) || (sa + bl + hm - (psa + pbl + hk));

      rows.push([
        counter++,
        exp.id || `EXP-${counter}`,
        exp.schoolName || schoolInfo.namaSekolah,
        exp.npsn || schoolInfo.npsn,
        exp.tanggal || '',
        exp.noBukti || '',
        exp.triwulan || 'TW1',
        exp.sumberDana || 'BOS Reguler',
        exp.komponen || '5. Administrasi Kegiatan Sekolah & ATK',
        exp.kodeRekening || '',
        exp.uraian || '',
        exp.penerimaToko || '',
        exp.npwpPenerima || '-',
        exp.metodePembayaran || 'Kas Tunai Bendahara',
        exp.volume || 1,
        exp.satuan || 'Paket',
        exp.hargaSatuan || exp.subtotal || 0,
        exp.subtotal || bl,
        sa,
        bl,
        psa,
        pbl,
        hm,
        hk,
        sAkhir,
        exp.tipePajak || 'Tanpa Pajak',
        exp.nilaiPajak || 0,
        exp.totalBersih || exp.subtotal || 0,
        exp.status || 'Draf',
        exp.catatan || ''
      ]);
    }
  });

  return rows;
}

/**
 * Builds data rows for Sheet 4: Input Belanja Pemeliharaan
 */
export function buildBelanjaPemeliharaanSheetRows(
  expenses: SchoolExpense[],
  schoolInfo: SchoolInfo
): (string | number)[][] {
  const rows: (string | number)[][] = [[...COLS_BELANJA_PEMELIHARAAN]];

  const pemeliharaanExpenses = expenses.filter(
    (e) => e.kategoriBelanja === 'pemeliharaan'
  );

  let counter = 1;
  pemeliharaanExpenses.forEach((exp) => {
    if (exp.rincianItems && exp.rincianItems.length > 0) {
      exp.rincianItems.forEach((it) => {
        const nJasa = Number(it.nilaiJasa) || 0;
        const nBarang = Number(it.nilaiBarang) || 0;
        const totalLra = nJasa + nBarang;
        const nBast = Number(it.nilaiPengakuanBast) || nBarang;
        const pBast = Number(it.pengeluaranBast) || nBarang;

        rows.push([
          counter++,
          exp.id || `PEM-${counter}`,
          exp.schoolName || schoolInfo.namaSekolah,
          exp.npsn || schoolInfo.npsn,
          it.tanggalPemeliharaan || exp.tanggal || '',
          exp.noBukti || '',
          (exp as any).noBast || exp.noBukti || 'BAST/2026/001',
          (exp as any).tanggalBast || it.tanggalPemeliharaan || exp.tanggal || '',
          exp.triwulan || 'TW1',
          exp.sumberDana || 'BOS Reguler',
          it.kodeRekening || exp.kodeRekening || '',
          it.jenisPemeliharaan || exp.uraian || 'Pemeliharaan Sarana Sekolah',
          nJasa,
          nBarang,
          totalLra,
          nBast,
          totalLra,
          pBast,
          exp.penerimaToko || 'Bengkel / Rekanan',
          it.keteranganPemeliharaan || exp.catatan || '',
          exp.status || 'Draf'
        ]);
      });
    } else {
      const subtotal = Number(exp.subtotal) || 0;
      const nBarang = Math.round(subtotal * 0.6);
      const nJasa = subtotal - nBarang;

      rows.push([
        counter++,
        exp.id || `PEM-${counter}`,
        exp.schoolName || schoolInfo.namaSekolah,
        exp.npsn || schoolInfo.npsn,
        exp.tanggal || '',
        exp.noBukti || '',
        (exp as any).noBast || exp.noBukti || 'BAST/2026/001',
        (exp as any).tanggalBast || exp.tanggal || '',
        exp.triwulan || 'TW1',
        exp.sumberDana || 'BOS Reguler',
        exp.kodeRekening || '',
        exp.uraian || 'Pemeliharaan',
        nJasa,
        nBarang,
        subtotal,
        nBarang,
        subtotal,
        nBarang,
        exp.penerimaToko || 'Bengkel / Rekanan',
        exp.catatan || '',
        exp.status || 'Draf'
      ]);
    }
  });

  return rows;
}

/**
 * Builds data rows for Sheet 5: Input Barang Ekstra
 */
export function buildBarangEkstraSheetRows(
  barangEkstraItems: BarangEkstraItem[],
  schoolInfo: SchoolInfo
): (string | number)[][] {
  const rows: (string | number)[][] = [[...COLS_BARANG_EKSTRA]];

  barangEkstraItems.forEach((item, index) => {
    rows.push([
      index + 1,
      item.id || `BE-${index + 1}`,
      item.schoolName || schoolInfo.namaSekolah,
      item.npsn || schoolInfo.npsn,
      item.tahunAnggaran || schoolInfo.tahunAnggaran,
      item.tanggalPerolehan || '',
      item.namaBarang || '',
      item.spesifikasi || '-',
      Number(item.volume) || 1,
      item.satuan || 'Unit',
      Number(item.hargaSatuan) || 0,
      Number(item.totalHarga) || (Number(item.volume || 1) * Number(item.hargaSatuan || 0)),
      item.kondisi || 'Baik',
      item.sumberPerolehan || 'BOS Reguler',
      item.keterangan || '-',
      item.status || 'Draf'
    ]);
  });

  return rows;
}

/**
 * Builds data rows for Sheet 6: Database Akun Aplikasi (6_AKUN_APLIKASI)
 * Kolom A-G kompatibel langsung dengan Google Apps Script Login (ID, Nama, Username, Password, Role, NAMA UPT, Waktu_Dibuat)
 * ditambah NPSN, Kecamatan, Kepala Sekolah, Bendahara BOS, Pengurus Barang & NIP.
 */
export function buildAkunAplikasiSheetRows(
  masterSchools: UptSchoolAccount[] = loadUptSchools()
): (string | number)[][] {
  const rows: (string | number)[][] = [[...COLS_AKUN_APLIKASI]];
  const defaultCreatedDate = '2026-01-01';

  masterSchools.forEach((school, index) => {
    const idAkun = school.id || `upt-${index + 1}`;
    const namaOperator =
      school.pengurusBarang ||
      school.bendahara ||
      school.kepalaSekolah ||
      `Operator ${school.upt}`;
    const username = school.username || generateSlugUsername(school.upt);
    const password = school.password || school.npsn || '123456';
    const role = normalizeUserRole(school.role, username);

    rows.push([
      idAkun,
      namaOperator,
      username,
      password,
      role,
      school.upt,
      defaultCreatedDate,
      school.npsn || '-',
      school.kecamatan || inferKecamatanFromUpt(school.upt),
      school.kepalaSekolah || '-',
      school.nipKepalaSekolah || '-',
      school.bendahara || '-',
      school.nipBendahara || '-',
      school.pengurusBarang || '-',
      school.nipPengurusBarang || '-',
      'Aktif'
    ]);
  });

  return rows;
}

/**
 * Builds data rows for Sheet 7: Petunjuk & Metadata Database
 */
export function buildPetunjukSheetRows(schoolInfo: SchoolInfo): (string | number)[][] {
  return [
    ['DOKUMENTASI DATABASE SPREADSHEET BOSP & PERSEDIAAN'],
    ['KABUPATEN MINAHASA TENGGARA - TAHUN ANGGARAN ' + schoolInfo.tahunAnggaran],
    [''],
    ['KODE LEMBAR KERJA', 'NAMA LEMBAR KERJA (SHEET)', 'DESKRIPSI DATABASE & SUMBER MENU'],
    ['1', '1_PANEL_ADMIN_UPT', 'Database Master Sekolah UPT, Profil Kepala Sekolah/Bendahara, Plafon Pagu & Status Verifikasi'],
    ['2', '2_REKAPAN_SE_DINAS', 'Tabel Matriks Rekapitulasi Persediaan Se-Dinas Pendidikan (NO, NAMA UPT / SATUAN PENDIDIKAN, Per Jenis Persediaan: SALDO AWAL [Masuk, Keluar, Sisa], BELANJA [Masuk, Keluar, Sisa], SALDO AKHIR, TOTAL MASUK, TOTAL KELUAR, TOTAL SALDO AKHIR)'],
    ['3', '3_BELANJA_PERSEDIAAN', 'Database Inputan Belanja Persediaan (Menu Input Belanja -> 1. Input Belanja Persediaan)'],
    ['4', '4_BELANJA_PEMELIHARAAN', 'Database Inputan Belanja Pemeliharaan & BAST (Menu Input Belanja -> 2. Input Pemeliharaan)'],
    ['5', '5_BARANG_EKSTRA', 'Database Inputan Inventaris Non-Rutin Barang Ekstra (Menu Input Belanja -> 3. Input Barang Ekstra)'],
    ['6', '6_AKUN_APLIKASI', 'Database Akun Login Aplikasi BOSP (ID, Nama Operator, Username, Password, Role [Admin / Operator BOSP], NAMA UPT, Waktu_Dibuat, NPSN, Kecamatan, Kepala Sekolah, Bendahara & Pengurus Barang)'],
    [''],
    ['PANDUAN PENGGUNAAN & IMPOR/EKSPOR:'],
    ['1. File spreadsheet ini berfungsi sebagai database terintegrasi multi-tabel untuk seluruh menu & akun aplikasi.'],
    ['2. Anda dapat mengedit data offline pada sheet 3, 4, 5, dan 6 (Akun Aplikasi) lalu mengunggah kembali melalui tombol Upload Database Spreadsheet.'],
    ['3. Lembar 6_AKUN_APLIKASI memiliki urutan Kolom A–G (ID, Nama, Username, Password, Role, NAMA UPT, Waktu_Dibuat) yang kompatibel langsung dengan sistem Login UPT Spreadsheet.'],
    ['4. Format angka diperbolehkan berupa angka murni (misal: 500000) atau berformat Rupiah (misal: Rp 500.000).'],
    ['5. Tanggal diisi dengan format YYYY-MM-DD (contoh: 2026-03-15).']
  ];
}

/**
 * Helper to auto-fit column widths in worksheet
 */
function autoFitColumns(ws: XLSX.WorkSheet, data: (string | number)[][]) {
  if (!data || data.length === 0) return;
  const colWidths: number[] = [];
  data.forEach((row) => {
    row.forEach((cell, colIdx) => {
      const len = String(cell ?? '').length;
      colWidths[colIdx] = Math.max(colWidths[colIdx] || 10, len + 2);
    });
  });
  ws['!cols'] = colWidths.map((w) => ({ wch: Math.min(w, 50) }));
}

/**
 * Creates the complete master multi-sheet workbook (.xlsx)
 */
export function generateMasterDatabaseWorkbook({
  schoolInfo,
  expenses,
  barangEkstraItems,
  masterSchools = loadUptSchools(),
}: MasterDatabaseExportData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // 1. Panel Admin Sheet
  const panelAdminRows = buildPanelAdminSheetRows(masterSchools, expenses, schoolInfo);
  const wsPanelAdmin = XLSX.utils.aoa_to_sheet(panelAdminRows);
  autoFitColumns(wsPanelAdmin, panelAdminRows);
  XLSX.utils.book_append_sheet(wb, wsPanelAdmin, '1_PANEL_ADMIN_UPT');

  // 2. Rekapan Se Dinas Sheet (Bentuk Tabel Matriks Laporan Menu Rekapan Dinas)
  const rekapDinasRows = buildRekapanDinasSheetRows(masterSchools, expenses, schoolInfo);
  const wsRekapDinas = XLSX.utils.aoa_to_sheet(rekapDinasRows);
  wsRekapDinas['!merges'] = buildRekapanDinasSheetMerges(
    rekapDinasRows.length,
    rekapDinasRows[0]?.length || 0
  );
  autoFitColumns(wsRekapDinas, rekapDinasRows);
  XLSX.utils.book_append_sheet(wb, wsRekapDinas, '2_REKAPAN_SE_DINAS');

  // 3. Input Belanja Persediaan Sheet
  const persediaanRows = buildBelanjaPersediaanSheetRows(expenses, schoolInfo);
  const wsPersediaan = XLSX.utils.aoa_to_sheet(persediaanRows);
  autoFitColumns(wsPersediaan, persediaanRows);
  XLSX.utils.book_append_sheet(wb, wsPersediaan, '3_BELANJA_PERSEDIAAN');

  // 4. Input Belanja Pemeliharaan Sheet
  const pemeliharaanRows = buildBelanjaPemeliharaanSheetRows(expenses, schoolInfo);
  const wsPemeliharaan = XLSX.utils.aoa_to_sheet(pemeliharaanRows);
  autoFitColumns(wsPemeliharaan, pemeliharaanRows);
  XLSX.utils.book_append_sheet(wb, wsPemeliharaan, '4_BELANJA_PEMELIHARAAN');

  // 5. Input Barang Ekstra Sheet
  const barangEkstraRows = buildBarangEkstraSheetRows(barangEkstraItems, schoolInfo);
  const wsBarangEkstra = XLSX.utils.aoa_to_sheet(barangEkstraRows);
  autoFitColumns(wsBarangEkstra, barangEkstraRows);
  XLSX.utils.book_append_sheet(wb, wsBarangEkstra, '5_BARANG_EKSTRA');

  // 6. Database Akun Aplikasi Sheet
  const akunRows = buildAkunAplikasiSheetRows(masterSchools);
  const wsAkun = XLSX.utils.aoa_to_sheet(akunRows);
  autoFitColumns(wsAkun, akunRows);
  XLSX.utils.book_append_sheet(wb, wsAkun, '6_AKUN_APLIKASI');

  // 7. Petunjuk Database Sheet
  const petunjukRows = buildPetunjukSheetRows(schoolInfo);
  const wsPetunjuk = XLSX.utils.aoa_to_sheet(petunjukRows);
  autoFitColumns(wsPetunjuk, petunjukRows);
  XLSX.utils.book_append_sheet(wb, wsPetunjuk, '7_PETUNJUK_DATABASE');

  return wb;
}

/**
 * Downloads the populated Master Database Spreadsheet (.xlsx)
 */
export function downloadMasterDatabaseSpreadsheet(data: MasterDatabaseExportData) {
  const wb = generateMasterDatabaseWorkbook(data);
  const filename = `DATABASE_BOSP_${data.schoolInfo.namaSekolah.replace(/[^a-zA-Z0-9]/g, '_')}_TA${data.schoolInfo.tahunAnggaran}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * Downloads a standalone Database Spreadsheet specifically for Application Accounts (6_AKUN_APLIKASI)
 */
export function downloadAkunAplikasiSpreadsheet(
  masterSchools: UptSchoolAccount[] = loadUptSchools(),
  tahunAnggaran: number = 2026
) {
  const wb = XLSX.utils.book_new();
  const akunRows = buildAkunAplikasiSheetRows(masterSchools);

  // Sheet: 6_AKUN_APLIKASI
  const wsAkun = XLSX.utils.aoa_to_sheet(akunRows);
  autoFitColumns(wsAkun, akunRows);
  XLSX.utils.book_append_sheet(wb, wsAkun, '6_AKUN_APLIKASI');

  const filename = `DATABASE_AKUN_APLIKASI_BOSP_TA${tahunAnggaran}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * Downloads an empty template with 1-2 sample rows for manual data entry
 */
export function downloadMasterDatabaseTemplate(schoolInfo: SchoolInfo) {
  const demoMasterSchools = loadUptSchools().slice(0, 5);
  const demoExpenses: SchoolExpense[] = [
    {
      id: 'EXP-SAMPLE-1',
      tahunAnggaran: schoolInfo.tahunAnggaran,
      schoolName: schoolInfo.namaSekolah,
      npsn: schoolInfo.npsn,
      tanggal: `${schoolInfo.tahunAnggaran}-02-15`,
      noBukti: `KW-BOS/${schoolInfo.tahunAnggaran}/TW1/001`,
      triwulan: 'TW1',
      sumberDana: 'BOS Reguler',
      komponen: '5. Administrasi Kegiatan Sekolah & ATK',
      kodeRekening: 'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (ATK)',
      kategoriBelanja: 'persediaan',
      uraian: 'Pembelian Kertas HVS & Tinta Printer Kantor',
      penerimaToko: 'Toko Buku Maju Jaya',
      npwpPenerima: '01.234.567.8-901.000',
      metodePembayaran: 'Kas Tunai Bendahara',
      volume: 10,
      satuan: 'Rim',
      hargaSatuan: 55000,
      subtotal: 550000,
      nilaiSaldoAwal: 0,
      nilaiBelanjaLra: 550000,
      pengeluaranSaldoAwal: 0,
      pengeluaranBelanja: 550000,
      hibahMasuk: 0,
      hibahKeluar: 0,
      nilaiMasuk: 550000,
      nilaiKeluar: 550000,
      sisaNilai: 0,
      tipePajak: 'Tanpa Pajak',
      nilaiPajak: 0,
      totalBersih: 550000,
      status: 'Disetujui Kepala Sekolah',
      createdAt: new Date().toISOString()
    },
    {
      id: 'EXP-SAMPLE-2',
      tahunAnggaran: schoolInfo.tahunAnggaran,
      schoolName: schoolInfo.namaSekolah,
      npsn: schoolInfo.npsn,
      tanggal: `${schoolInfo.tahunAnggaran}-03-10`,
      noBukti: `KW-BOS/${schoolInfo.tahunAnggaran}/TW1/002`,
      triwulan: 'TW1',
      sumberDana: 'BOS Reguler',
      komponen: '7. Pemeliharaan Sarana & Prasarana Sekolah',
      kodeRekening: 'Belanja Pemeliharaan Bangunan Gedung-Bangunan Gedung Tempat Kerja-Bangunan Gedung Tempat Pendidikan',
      kategoriBelanja: 'pemeliharaan',
      uraian: 'Pemeliharaan Plafon & Kusen Ruang Kelas 1',
      penerimaToko: 'CV Mitra Bangunan',
      npwpPenerima: '02.345.678.9-012.000',
      metodePembayaran: 'Transfer Bank BPD/BRI',
      volume: 1,
      satuan: 'Paket',
      hargaSatuan: 1250000,
      subtotal: 1250000,
      nilaiSaldoAwal: 0,
      nilaiBelanjaLra: 1250000,
      pengeluaranSaldoAwal: 0,
      pengeluaranBelanja: 1250000,
      hibahMasuk: 0,
      hibahKeluar: 0,
      nilaiMasuk: 1250000,
      nilaiKeluar: 1250000,
      sisaNilai: 0,
      tipePajak: 'Tanpa Pajak',
      nilaiPajak: 0,
      totalBersih: 1250000,
      status: 'Disetujui Kepala Sekolah',
      createdAt: new Date().toISOString(),
      rincianItems: [
        {
          id: 'item-1',
          kodeRekening: 'Belanja Pemeliharaan Bangunan Gedung-Bangunan Gedung Tempat Kerja-Bangunan Gedung Tempat Pendidikan',
          jenisPemeliharaan: 'Pemeliharaan Kusen & Plafon',
          tanggalPemeliharaan: `${schoolInfo.tahunAnggaran}-03-10`,
          nilaiJasa: 500000,
          nilaiBarang: 750000,
          saldoAwal: 'Bukan Saldo Awal',
          nilaiSaldoAwal: 0,
          nilaiBelanjaLra: 1250000,
          nilaiPengakuanBast: 750000,
          pengeluaranSaldoAwal: 0,
          pengeluaranBelanja: 1250000,
          pengeluaranBast: 750000,
          hibahMasuk: 0,
          hibahKeluar: 0,
          nilaiMasuk: 1250000,
          nilaiKeluar: 1250000,
          sisaNilai: 0,
          keteranganPemeliharaan: 'BAST No. 04/BAST-PEM/2026'
        }
      ]
    }
  ];

  const demoBarangEkstra: BarangEkstraItem[] = [
    {
      id: 'BE-SAMPLE-1',
      tahunAnggaran: schoolInfo.tahunAnggaran,
      schoolName: schoolInfo.namaSekolah,
      npsn: schoolInfo.npsn,
      namaBarang: 'Kipas Angin Dinding Tornado',
      spesifikasi: 'Regency 18 Inch Besi',
      volume: 2,
      satuan: 'Unit',
      hargaSatuan: 425000,
      totalHarga: 850000,
      kondisi: 'Baik',
      sumberPerolehan: 'BOS Reguler',
      tanggalPerolehan: `${schoolInfo.tahunAnggaran}-01-20`,
      keterangan: 'Ruang Guru & Perpustakaan',
      status: 'Disetujui Kepala Sekolah',
      createdAt: new Date().toISOString()
    }
  ];

  const wb = generateMasterDatabaseWorkbook({
    schoolInfo,
    expenses: demoExpenses,
    barangEkstraItems: demoBarangEkstra,
    masterSchools: demoMasterSchools
  });

  XLSX.writeFile(wb, `TEMPLATE_DATABASE_BOSP_KOSONG_TA${schoolInfo.tahunAnggaran}.xlsx`);
}

/**
 * Parses an uploaded master spreadsheet workbook or 2D sheets map and converts it to app data
 */
export interface ParseMasterDatabaseResult {
  importedExpenses: SchoolExpense[];
  importedBarangEkstra: BarangEkstraItem[];
  importedAccounts: UptSchoolAccount[];
  importedPaguTahunan?: number;
  persediaanCount: number;
  pemeliharaanCount: number;
  rekapMatrixCount: number;
  barangEkstraCount: number;
  akunCount: number;
  panelAdminCount: number;
  sheetsFound: string[];
}

function normalizeStatusSpj(raw: any): SchoolExpense['status'] {
  const s = String(raw || '').trim();
  if (!s) return 'Disetujui Kepala Sekolah';
  const lower = s.toLowerCase();
  if (lower.includes('setuju') || lower.includes('approve')) return 'Disetujui Kepala Sekolah';
  if (lower.includes('verifikasi') || lower.includes('bendahara')) return 'Diverifikasi Bendahara';
  if (lower.includes('draf') || lower.includes('draft') || lower.includes('tunggu')) return 'Draf';
  return 'Disetujui Kepala Sekolah';
}

function normalizeBarangEkstraStatus(raw: any): BarangEkstraItem['status'] {
  const s = String(raw || '').trim().toLowerCase();
  if (s.includes('draf') || s.includes('tunggu') || s.includes('belum')) {
    return 'Draf';
  }
  return 'Disetujui Kepala Sekolah';
}

function normalizeSpreadsheetDate(raw: any, fallbackDate: string): string {
  const str = String(raw ?? '').trim();
  if (!str || str === '-') return fallbackDate;

  // Handle Excel serial date numbers (e.g. "46297" or 46297 -> 2026-03-31)
  if (/^\d{5}(\.\d+)?$/.test(str)) {
    const serial = parseFloat(str);
    if (serial > 35000 && serial < 65000) {
      const utcMs = Math.round((serial - 25569) * 86400 * 1000);
      const d = new Date(utcMs);
      if (!isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10);
      }
    }
  }

  // Handle ISO timestamp strings (e.g. "2026-03-04T16:00:00.000Z")
  const isoPrefix = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoPrefix) {
    if (str.includes('T')) {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        // Add 8 hours (WITA) so 16:00Z becomes the intended local calendar date
        const localDate = new Date(d.getTime() + 8 * 3600 * 1000);
        return localDate.toISOString().slice(0, 10);
      }
    }
    return `${isoPrefix[1]}-${isoPrefix[2].padStart(2, '0')}-${isoPrefix[3].padStart(2, '0')}`;
  }

  // Handle DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  }

  return str;
}

export function parseMasterSheetsMap(
  sheetsMap: Record<string, any[][]>,
  schoolInfo: SchoolInfo
): ParseMasterDatabaseResult {
  const sheetNames = Object.keys(sheetsMap);
  const importedExpenses: SchoolExpense[] = [];
  const importedBarangEkstra: BarangEkstraItem[] = [];
  const accountByNormUpt = new Map<string, UptSchoolAccount>();
  let importedPaguTahunan: number | undefined = undefined;

  let persediaanCount = 0;
  let pemeliharaanCount = 0;
  let rekapMatrixCount = 0;
  let barangEkstraCount = 0;
  let akunCount = 0;
  let panelAdminCount = 0;

  // Seed existing accounts map so partial edits in Sheet 1 or Sheet 6 preserve other fields
  const existingSchools = loadUptSchools();
  const existingByNorm = new Map<string, UptSchoolAccount>();
  existingSchools.forEach((s) => {
    existingByNorm.set(normalizeUptKey(s.upt), s);
  });

  // 1. Check Sheet 3: Belanja Persediaan
  const persediaanSheetName = sheetNames.find(
    (s) => s.toUpperCase().includes('PERSEDIAAN') || s.includes('3_')
  );
  if (persediaanSheetName) {
    const data = sheetsMap[persediaanSheetName] || [];
    if (data.length > 1) {
      let headerRowIdx = 0;
      for (let i = 0; i < Math.min(data.length, 5); i++) {
        const rowStr = (data[i] || []).join(' ').toLowerCase();
        if (
          rowStr.includes('rekening') ||
          rowStr.includes('uraian') ||
          rowStr.includes('subtotal') ||
          rowStr.includes('belanja')
        ) {
          headerRowIdx = i;
          break;
        }
      }

      const persediaanGroupMap = new Map<string, SchoolExpense>();

      for (let r = headerRowIdx + 1; r < data.length; r++) {
        const row = data[r];
        if (!row || row.length === 0) continue;

        const rawId = String(row[1] || '').trim();
        const rawSchool = String(row[2] || '').trim();
        const noBukti = String(row[5] || '').trim();
        const uraian = String(row[10] || '').trim();
        const rawRekening = String(row[9] || '').trim();
        const rekening = rawRekening ? findMatchingRekening(rawRekening) : '';

        const vol = parseExcelNumber(row[14] || 1) || 1;
        const hrg = parseExcelNumber(row[16] || 0);
        const subCol = parseExcelNumber(row[17] || 0);
        const saAwal = parseExcelNumber(row[18] || 0);
        const blLraCol = parseExcelNumber(row[19] || 0);
        const pSa = parseExcelNumber(row[20] || 0);
        const pBlCol = parseExcelNumber(row[21] || 0);
        const hm = parseExcelNumber(row[22] || 0);
        const hk = parseExcelNumber(row[23] || 0);

        const blLra = blLraCol > 0 ? blLraCol : subCol > 0 ? subCol : vol * hrg;
        const subtotal = subCol > 0 ? subCol : blLra > 0 ? blLra : saAwal + hm;
        const hasExplicitPBl = row[21] !== undefined && String(row[21]).trim() !== '';
        const pBl = hasExplicitPBl ? pBlCol : blLra;
        const computedSAkhir = saAwal + blLra + hm - (pSa + pBl + hk);
        const sAkhirCol = parseExcelNumber(row[24] || 0);
        const sAkhir =
          row[24] !== undefined && String(row[24]).trim() !== '' && sAkhirCol !== 0
            ? sAkhirCol
            : computedSAkhir;

        if (
          !noBukti &&
          !uraian &&
          !rawRekening &&
          subtotal === 0 &&
          saAwal === 0 &&
          blLra === 0 &&
          pSa === 0 &&
          pBl === 0 &&
          hm === 0 &&
          hk === 0
        ) {
          continue;
        }

        const id = rawId || `IMP-PERS-${schoolInfo.tahunAnggaran}-${r}`;
        const schoolName = rawSchool || schoolInfo.namaSekolah;
        const npsn = String(row[3] || schoolInfo.npsn).trim();
        const tanggal = normalizeSpreadsheetDate(row[4], `${schoolInfo.tahunAnggaran}-01-15`);
        const rawTw = String(row[6] || 'TW1').toUpperCase().trim();
        const triwulan: Triwulan = ['TW1', 'TW2', 'TW3', 'TW4'].includes(rawTw)
          ? (rawTw as Triwulan)
          : 'TW1';
        const sumberDana = (String(row[7] || 'BOS Reguler').trim() || 'BOS Reguler') as any;
        const komponen = (String(row[8] || '5. Administrasi Kegiatan Sekolah & ATK').trim() ||
          '5. Administrasi Kegiatan Sekolah & ATK') as any;
        const toko = String(row[11] || '-').trim();
        const npwp = String(row[12] || '-').trim();
        const metode = (String(row[13] || 'Kas Tunai Bendahara').trim() ||
          'Kas Tunai Bendahara') as any;
        const satuan = String(row[15] || 'Paket').trim();
        const tipePajak = (String(row[25] || 'Tanpa Pajak').trim() || 'Tanpa Pajak') as any;
        const pajak = parseExcelNumber(row[26] || 0);
        const totalBersihCol = parseExcelNumber(row[27] || 0);
        const totalBersih = totalBersihCol > 0 ? totalBersihCol : Math.max(0, subtotal - pajak);
        const status = normalizeStatusSpj(row[28]);
        const catatan = String(row[29] || '').trim();

        const isSaldoAwalOnly = saAwal > 0 && blLra === 0 && hm === 0;
        const isKeluarSaldoAwalOnly = pSa > 0 && pBl === 0 && hk === 0;
        const isHibahOnly = (hm > 0 || hk > 0) && blLra === 0 && saAwal === 0;

        const rincianItem: RincianRekeningItem = {
          id: `${id}-item-${r}`,
          kodeRekening: rekening || 'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (ATK)',
          saldoAwal: isSaldoAwalOnly ? 'Saldo Awal' : 'Bukan Saldo Awal',
          saldoAwalMasuk: isSaldoAwalOnly ? 'Saldo Awal' : 'Bukan Saldo Awal',
          saldoAwalKeluar: isKeluarSaldoAwalOnly ? 'Saldo Awal' : 'Bukan Saldo Awal',
          isHibah: isHibahOnly,
          nilaiSaldoAwal: saAwal,
          nilaiBelanjaLra: blLra,
          pengeluaranSaldoAwal: pSa,
          pengeluaranBelanja: pBl,
          hibahMasuk: hm,
          hibahKeluar: hk,
          nilaiMasuk: saAwal + blLra + hm,
          nilaiKeluar: pSa + pBl + hk,
          sisaNilai: sAkhir,
        };

        const groupKey = `${id}__${normalizeUptKey(schoolName)}__${triwulan}`;
        const existingExp = persediaanGroupMap.get(groupKey);

        if (existingExp) {
          existingExp.rincianItems = [...(existingExp.rincianItems || []), rincianItem];
          existingExp.subtotal += subtotal;
          existingExp.nilaiSaldoAwal = (existingExp.nilaiSaldoAwal || 0) + saAwal;
          existingExp.nilaiBelanjaLra = (existingExp.nilaiBelanjaLra || 0) + blLra;
          existingExp.pengeluaranSaldoAwal = (existingExp.pengeluaranSaldoAwal || 0) + pSa;
          existingExp.pengeluaranBelanja = (existingExp.pengeluaranBelanja || 0) + pBl;
          existingExp.hibahMasuk = (existingExp.hibahMasuk || 0) + hm;
          existingExp.hibahKeluar = (existingExp.hibahKeluar || 0) + hk;
          existingExp.nilaiMasuk = (existingExp.nilaiMasuk || 0) + (saAwal + blLra + hm);
          existingExp.nilaiKeluar = (existingExp.nilaiKeluar || 0) + (pSa + pBl + hk);
          existingExp.sisaNilai = (existingExp.sisaNilai || 0) + sAkhir;
          existingExp.nilaiPajak += pajak;
          existingExp.totalBersih += totalBersih;
        } else {
          persediaanGroupMap.set(groupKey, {
            id,
            tahunAnggaran: schoolInfo.tahunAnggaran,
            schoolName,
            npsn,
            tanggal,
            noBukti: noBukti || `KW/${schoolInfo.tahunAnggaran}/${triwulan}/${r}`,
            triwulan,
            sumberDana,
            komponen,
            kodeRekening: (rekening || 'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (ATK)') as any,
            kategoriBelanja: 'persediaan',
            uraian: uraian || 'Belanja Persediaan',
            penerimaToko: toko,
            npwpPenerima: npwp,
            metodePembayaran: metode,
            volume: vol,
            satuan,
            hargaSatuan: hrg > 0 ? hrg : subtotal,
            subtotal,
            nilaiSaldoAwal: saAwal,
            nilaiBelanjaLra: blLra,
            pengeluaranSaldoAwal: pSa,
            pengeluaranBelanja: pBl,
            hibahMasuk: hm,
            hibahKeluar: hk,
            nilaiMasuk: saAwal + blLra + hm,
            nilaiKeluar: pSa + pBl + hk,
            sisaNilai: sAkhir,
            tipePajak,
            nilaiPajak: pajak,
            totalBersih,
            status,
            catatan,
            createdAt: new Date().toISOString(),
            rincianItems: [rincianItem],
          });
        }
        persediaanCount++;
      }

      persediaanGroupMap.forEach((exp) => importedExpenses.push(exp));
    }
  }

  // 2. Check Sheet 4: Belanja Pemeliharaan
  const pemeliharaanSheetName = sheetNames.find(
    (s) => s.toUpperCase().includes('PEMELIHARAAN') || s.includes('4_')
  );
  if (pemeliharaanSheetName) {
    const data = sheetsMap[pemeliharaanSheetName] || [];
    if (data.length > 1) {
      let headerRowIdx = 0;
      for (let i = 0; i < Math.min(data.length, 5); i++) {
        const rowStr = (data[i] || []).join(' ').toLowerCase();
        if (
          rowStr.includes('rekening') ||
          rowStr.includes('jasa') ||
          rowStr.includes('barang') ||
          rowStr.includes('pemeliharaan')
        ) {
          headerRowIdx = i;
          break;
        }
      }

      const pemeliharaanGroupMap = new Map<string, SchoolExpense>();

      for (let r = headerRowIdx + 1; r < data.length; r++) {
        const row = data[r];
        if (!row || row.length === 0) continue;

        const rawId = String(row[1] || '').trim();
        const rawSchool = String(row[2] || '').trim();
        const noBukti = String(row[5] || '').trim();
        const jenisPemeliharaan = String(row[11] || '').trim();
        const nJasa = parseExcelNumber(row[12] || 0);
        const nBarang = parseExcelNumber(row[13] || 0);
        const totalLraCol = parseExcelNumber(row[14] || 0);
        const totalLra = totalLraCol > 0 ? totalLraCol : nJasa + nBarang;

        if (!noBukti && !jenisPemeliharaan && totalLra === 0 && nJasa === 0 && nBarang === 0) {
          continue;
        }

        const id = rawId || `IMP-PEM-${schoolInfo.tahunAnggaran}-${r}`;
        const schoolName = rawSchool || schoolInfo.namaSekolah;
        const npsn = String(row[3] || schoolInfo.npsn).trim();
        const tanggal = normalizeSpreadsheetDate(row[4], `${schoolInfo.tahunAnggaran}-02-20`);
        const noBast = String(row[6] || noBukti || `BAST/${schoolInfo.tahunAnggaran}/${r}`).trim();
        const tanggalBast = normalizeSpreadsheetDate(row[7], tanggal);
        const rawTw = String(row[8] || 'TW1').toUpperCase().trim();
        const triwulan: Triwulan = ['TW1', 'TW2', 'TW3', 'TW4'].includes(rawTw)
          ? (rawTw as Triwulan)
          : 'TW1';
        const sumberDana = (String(row[9] || 'BOS Reguler').trim() || 'BOS Reguler') as any;
        const rekening =
          String(row[10] || '').trim() ||
          'Belanja Pemeliharaan Bangunan Gedung-Bangunan Gedung Tempat Kerja-Bangunan Gedung Tempat Pendidikan';
        const nilaiBast = parseExcelNumber(row[15] || nBarang);
        const keluarLra = parseExcelNumber(row[16] || totalLra);
        const keluarBast = parseExcelNumber(row[17] || nBarang);
        const toko = String(row[18] || 'Bengkel / Rekanan').trim();
        const ket = String(row[19] || '').trim();
        const status = normalizeStatusSpj(row[20]);

        const rincianItem: RincianRekeningItem = {
          id: `${id}-item-${r}`,
          kodeRekening: rekening,
          jenisPemeliharaan: jenisPemeliharaan || 'Pemeliharaan Sarana Sekolah',
          tanggalPemeliharaan: tanggal,
          nilaiJasa: nJasa,
          nilaiBarang: nBarang,
          saldoAwal: 'Bukan Saldo Awal',
          nilaiSaldoAwal: 0,
          nilaiBelanjaLra: totalLra,
          nilaiPengakuanBast: nilaiBast,
          pengeluaranSaldoAwal: 0,
          pengeluaranBelanja: keluarLra,
          pengeluaranBast: keluarBast,
          hibahMasuk: 0,
          hibahKeluar: 0,
          nilaiMasuk: totalLra,
          nilaiKeluar: keluarLra,
          sisaNilai: Math.max(0, totalLra - keluarLra),
          keteranganPemeliharaan: ket,
        };

        const groupKey = `${id}__${normalizeUptKey(schoolName)}`;
        const existingExp = pemeliharaanGroupMap.get(groupKey);

        if (existingExp) {
          existingExp.rincianItems = [...(existingExp.rincianItems || []), rincianItem];
          existingExp.subtotal += totalLra;
          existingExp.hargaSatuan = existingExp.subtotal;
          existingExp.nilaiBelanjaLra = (existingExp.nilaiBelanjaLra || 0) + totalLra;
          existingExp.pengeluaranBelanja = (existingExp.pengeluaranBelanja || 0) + keluarLra;
          existingExp.nilaiMasuk = (existingExp.nilaiMasuk || 0) + totalLra;
          existingExp.nilaiKeluar = (existingExp.nilaiKeluar || 0) + keluarLra;
          existingExp.totalBersih += totalLra;
        } else {
          const newExp: SchoolExpense = {
            id,
            tahunAnggaran: schoolInfo.tahunAnggaran,
            schoolName,
            npsn,
            tanggal,
            noBukti: noBukti || `KW-PEM/${schoolInfo.tahunAnggaran}/${triwulan}/${r}`,
            triwulan,
            sumberDana,
            komponen: '7. Pemeliharaan Sarana & Prasarana Sekolah',
            kodeRekening: rekening as any,
            kategoriBelanja: 'pemeliharaan',
            uraian: jenisPemeliharaan || 'Belanja Pemeliharaan',
            penerimaToko: toko,
            metodePembayaran: 'Transfer Bank BPD/BRI',
            volume: 1,
            satuan: 'Paket',
            hargaSatuan: totalLra,
            subtotal: totalLra,
            nilaiSaldoAwal: 0,
            nilaiBelanjaLra: totalLra,
            pengeluaranSaldoAwal: 0,
            pengeluaranBelanja: keluarLra,
            hibahMasuk: 0,
            hibahKeluar: 0,
            nilaiMasuk: totalLra,
            nilaiKeluar: keluarLra,
            sisaNilai: Math.max(0, totalLra - keluarLra),
            tipePajak: 'Tanpa Pajak',
            nilaiPajak: 0,
            totalBersih: totalLra,
            status,
            catatan: ket,
            createdAt: new Date().toISOString(),
            rincianItems: [rincianItem],
          };
          (newExp as any).noBast = noBast;
          (newExp as any).tanggalBast = tanggalBast;
          pemeliharaanGroupMap.set(groupKey, newExp);
        }
        pemeliharaanCount++;
      }

      pemeliharaanGroupMap.forEach((exp) => importedExpenses.push(exp));
    }
  }

  // 2B. Check Sheet 2: 2_REKAPAN_SE_DINAS (Reconcile direct matrix edits!)
  const rekapSheetName = sheetNames.find(
    (s) => s.toUpperCase().includes('REKAPAN') || s.includes('2_')
  );
  if (rekapSheetName) {
    const data = sheetsMap[rekapSheetName] || [];
    if (data.length >= 4 && (data[0]?.length || 0) > 5) {
      const headerRow1 = data[0] || [];
      const jenisCols: { colStart: number; jenisName: string }[] = [];
      for (let c = 2; c + 6 < headerRow1.length - 2; c += 7) {
        const jName = String(headerRow1[c] || '').trim().toUpperCase();
        if (
          jName &&
          jName !== 'TOTAL MASUK' &&
          jName !== 'TOTAL KELUAR' &&
          jName !== 'TOTAL SALDO AKHIR'
        ) {
          jenisCols.push({ colStart: c, jenisName: jName });
        }
      }

      if (jenisCols.length > 0) {
        for (let r = 3; r < data.length; r++) {
          const row = data[r];
          if (!row || row.length < 3) continue;
          const col0 = String(row[0] || '').trim().toUpperCase();
          const schoolName = String(row[1] || '').trim();
          if (!schoolName || col0.includes('JUMLAH TOTAL') || schoolName.toUpperCase().includes('JUMLAH TOTAL')) {
            continue;
          }

          const normSchool = normalizeUptKey(schoolName);
          const matchedAcc = existingByNorm.get(normSchool);

          for (const { colStart, jenisName } of jenisCols) {
            const saMasuk = parseExcelNumber(row[colStart] || 0);
            const saKeluar = parseExcelNumber(row[colStart + 1] || 0);
            const blMasuk = parseExcelNumber(row[colStart + 3] || 0);
            const blKeluar = parseExcelNumber(row[colStart + 4] || 0);

            if (saMasuk === 0 && saKeluar === 0 && blMasuk === 0 && blKeluar === 0) {
              continue;
            }

            // Check current sum in importedExpenses for this (normSchool, jenisName)
            let curSaM = 0;
            let curSaK = 0;
            let curBlM = 0;
            let curBlK = 0;
            const matchingRincianRefs: { exp: SchoolExpense; item: RincianRekeningItem }[] = [];

            for (const exp of importedExpenses) {
              if (exp.kategoriBelanja === 'pemeliharaan') continue;
              if (normalizeUptKey(exp.schoolName || '') !== normSchool) continue;
              if (exp.rincianItems && exp.rincianItems.length > 0) {
                for (const it of exp.rincianItems) {
                  if (String(it.kodeRekening || '').trim().toUpperCase() === jenisName) {
                    curSaM += Number(it.nilaiSaldoAwal) || 0;
                    curSaK += Number(it.pengeluaranSaldoAwal) || 0;
                    curBlM += (Number(it.nilaiBelanjaLra) || 0) + (Number(it.hibahMasuk) || 0);
                    curBlK += (Number(it.pengeluaranBelanja) || 0) + (Number(it.hibahKeluar) || 0);
                    matchingRincianRefs.push({ exp, item: it });
                  }
                }
              } else if (String(exp.kodeRekening || '').trim().toUpperCase() === jenisName) {
                curSaM += Number(exp.nilaiSaldoAwal) || 0;
                curSaK += Number(exp.pengeluaranSaldoAwal) || 0;
                curBlM += (Number(exp.nilaiBelanjaLra) || 0) + (Number(exp.hibahMasuk) || 0);
                curBlK += (Number(exp.pengeluaranBelanja) || 0) + (Number(exp.hibahKeluar) || 0);
              }
            }

            const hasDiff =
              Math.abs(curSaM - saMasuk) > 1 ||
              Math.abs(curSaK - saKeluar) > 1 ||
              Math.abs(curBlM - blMasuk) > 1 ||
              Math.abs(curBlK - blKeluar) > 1;

            if (!hasDiff) continue;

            const newSisa = saMasuk + blMasuk - (saKeluar + blKeluar);

            if (matchingRincianRefs.length === 1) {
              // Update the single matching rincian item directly with the matrix edits
              const { exp, item } = matchingRincianRefs[0];
              const oldSaM = Number(item.nilaiSaldoAwal) || 0;
              const oldSaK = Number(item.pengeluaranSaldoAwal) || 0;
              const oldBlM = Number(item.nilaiBelanjaLra) || 0;
              const oldBlK = Number(item.pengeluaranBelanja) || 0;
              const oldSisa = Number(item.sisaNilai) || 0;

              item.nilaiSaldoAwal = saMasuk;
              item.pengeluaranSaldoAwal = saKeluar;
              item.nilaiBelanjaLra = blMasuk;
              item.pengeluaranBelanja = blKeluar;
              item.hibahMasuk = 0;
              item.hibahKeluar = 0;
              item.nilaiMasuk = saMasuk + blMasuk;
              item.nilaiKeluar = saKeluar + blKeluar;
              item.sisaNilai = newSisa;

              exp.nilaiSaldoAwal = (exp.nilaiSaldoAwal || 0) - oldSaM + saMasuk;
              exp.pengeluaranSaldoAwal = (exp.pengeluaranSaldoAwal || 0) - oldSaK + saKeluar;
              exp.nilaiBelanjaLra = (exp.nilaiBelanjaLra || 0) - oldBlM + blMasuk;
              exp.pengeluaranBelanja = (exp.pengeluaranBelanja || 0) - oldBlK + blKeluar;
              exp.subtotal = Math.max(0, (exp.subtotal || 0) - oldBlM + blMasuk);
              exp.totalBersih = exp.subtotal;
              exp.nilaiMasuk = (exp.nilaiSaldoAwal || 0) + (exp.nilaiBelanjaLra || 0);
              exp.nilaiKeluar = (exp.pengeluaranSaldoAwal || 0) + (exp.pengeluaranBelanja || 0);
              exp.sisaNilai = (exp.sisaNilai || 0) - oldSisa + newSisa;
              rekapMatrixCount++;
            } else if (matchingRincianRefs.length === 0) {
              // Create a new Persediaan expense from the matrix cell edit
              const matId = `MAT-${normSchool.replace(/[^A-Z0-9]/g, '').slice(0, 10)}-${colStart}`;
              const matItem: RincianRekeningItem = {
                id: `${matId}-item`,
                kodeRekening: jenisName,
                saldoAwal: saMasuk > 0 && blMasuk === 0 ? 'Saldo Awal' : 'Bukan Saldo Awal',
                saldoAwalMasuk: saMasuk > 0 && blMasuk === 0 ? 'Saldo Awal' : 'Bukan Saldo Awal',
                saldoAwalKeluar: saKeluar > 0 && blKeluar === 0 ? 'Saldo Awal' : 'Bukan Saldo Awal',
                isHibah: false,
                nilaiSaldoAwal: saMasuk,
                nilaiBelanjaLra: blMasuk,
                pengeluaranSaldoAwal: saKeluar,
                pengeluaranBelanja: blKeluar,
                hibahMasuk: 0,
                hibahKeluar: 0,
                nilaiMasuk: saMasuk + blMasuk,
                nilaiKeluar: saKeluar + blKeluar,
                sisaNilai: newSisa,
              };

              importedExpenses.push({
                id: matId,
                tahunAnggaran: schoolInfo.tahunAnggaran,
                schoolName,
                npsn: matchedAcc?.npsn || schoolInfo.npsn,
                tanggal: `${schoolInfo.tahunAnggaran}-03-31`,
                noBukti: `REKAP/${schoolInfo.tahunAnggaran}/TW1/${r}`,
                triwulan: 'TW1',
                sumberDana: 'BOS Reguler',
                komponen: '5. Administrasi Kegiatan Sekolah & ATK',
                kodeRekening: jenisName as any,
                kategoriBelanja: 'persediaan',
                uraian: `Rekap Persediaan ${jenisName}`,
                penerimaToko: '-',
                npwpPenerima: '-',
                metodePembayaran: 'Kas Tunai Bendahara',
                volume: 1,
                satuan: 'Paket',
                hargaSatuan: blMasuk > 0 ? blMasuk : saMasuk,
                subtotal: blMasuk > 0 ? blMasuk : saMasuk,
                nilaiSaldoAwal: saMasuk,
                nilaiBelanjaLra: blMasuk,
                pengeluaranSaldoAwal: saKeluar,
                pengeluaranBelanja: blKeluar,
                hibahMasuk: 0,
                hibahKeluar: 0,
                nilaiMasuk: saMasuk + blMasuk,
                nilaiKeluar: saKeluar + blKeluar,
                sisaNilai: newSisa,
                tipePajak: 'Tanpa Pajak',
                nilaiPajak: 0,
                totalBersih: blMasuk > 0 ? blMasuk : saMasuk,
                status: 'Disetujui Kepala Sekolah',
                createdAt: new Date().toISOString(),
                rincianItems: [matItem],
              });
              rekapMatrixCount++;
            }
          }
        }
      }
    }
  }

  // 3. Check Sheet 5: Barang Ekstra
  const barangEkstraSheetName = sheetNames.find(
    (s) => s.toUpperCase().includes('EKSTRA') || s.includes('5_')
  );
  if (barangEkstraSheetName) {
    const data = sheetsMap[barangEkstraSheetName] || [];
    if (data.length > 1) {
      let headerRowIdx = 0;
      for (let i = 0; i < Math.min(data.length, 5); i++) {
        const rowStr = (data[i] || []).join(' ').toLowerCase();
        if (
          rowStr.includes('nama barang') ||
          rowStr.includes('volume') ||
          rowStr.includes('harga')
        ) {
          headerRowIdx = i;
          break;
        }
      }

      for (let r = headerRowIdx + 1; r < data.length; r++) {
        const row = data[r];
        if (!row || row.length === 0) continue;
        const namaBarang = String(row[6] || row[1] || '').trim();
        const volume = parseExcelNumber(row[8] || 1) || 1;
        const hargaSatuan = parseExcelNumber(row[10] || 0);
        const totalHargaCol = parseExcelNumber(row[11] || 0);
        const totalHarga = totalHargaCol > 0 ? totalHargaCol : volume * hargaSatuan;

        if (!namaBarang && totalHarga === 0) continue;

        importedBarangEkstra.push({
          id: String(row[1] || `IMP-BE-${schoolInfo.tahunAnggaran}-${r}`).trim(),
          tahunAnggaran: parseExcelNumber(row[4] || schoolInfo.tahunAnggaran) || schoolInfo.tahunAnggaran,
          schoolName: String(row[2] || schoolInfo.namaSekolah).trim(),
          npsn: String(row[3] || schoolInfo.npsn).trim(),
          namaBarang,
          spesifikasi: String(row[7] || '-').trim(),
          volume,
          satuan: String(row[9] || 'Unit').trim(),
          hargaSatuan: hargaSatuan > 0 ? hargaSatuan : Math.round(totalHarga / volume),
          totalHarga,
          kondisi: (String(row[12] || 'Baik').trim() as any) || 'Baik',
          sumberPerolehan: String(row[13] || 'BOS Reguler').trim(),
          tanggalPerolehan: normalizeSpreadsheetDate(row[5], `${schoolInfo.tahunAnggaran}-01-20`),
          keterangan: String(row[14] || '-').trim(),
          status: normalizeBarangEkstraStatus(row[15]),
          createdAt: new Date().toISOString(),
        });
        barangEkstraCount++;
      }
    }
  }

  // 4. Check Sheet 6: Akun Aplikasi (6_AKUN_APLIKASI, AKUN, or USERS)
  const akunSheetName = sheetNames.find(
    (s) =>
      s.toUpperCase().includes('AKUN') ||
      s.toUpperCase().includes('USERS') ||
      s.includes('6_AKUN')
  );
  if (akunSheetName) {
    const data = sheetsMap[akunSheetName] || [];
    if (data.length > 1) {
      let headerRowIdx = 0;
      for (let i = 0; i < Math.min(data.length, 5); i++) {
        const rowStr = (data[i] || []).join(' ').toLowerCase();
        if (
          rowStr.includes('username') ||
          rowStr.includes('password') ||
          rowStr.includes('nama upt')
        ) {
          headerRowIdx = i;
          break;
        }
      }

      for (let r = headerRowIdx + 1; r < data.length; r++) {
        const row = data[r];
        if (!row || row.length === 0) continue;
        const idVal = String(row[0] || `upt-${r}`).trim();
        const namaPejabat = String(row[1] || '').trim();
        const usernameVal = String(row[2] || '').trim();
        const passwordVal = String(row[3] || '').trim();
        const rawRoleVal = String(row[4] || 'Operator BOSP').trim();
        const namaUptVal = String(row[5] || row[1] || '').trim();

        if (!namaUptVal && !usernameVal) continue;

        const resolvedUpt = namaUptVal || `UPT ${usernameVal.toUpperCase()}`;
        const normKey = normalizeUptKey(resolvedUpt);
        const existingAcc = existingByNorm.get(normKey);
        const resolvedUser = usernameVal || existingAcc?.username || generateSlugUsername(resolvedUpt);
        const resolvedPass = passwordVal || existingAcc?.password || String(row[7] || '123456').trim();
        const resolvedRole = normalizeUserRole(rawRoleVal, resolvedUser);

        const accObj: UptSchoolAccount = {
          id: idVal || existingAcc?.id || `upt-${r}`,
          upt: resolvedUpt,
          npsn: String(row[7] || existingAcc?.npsn || idVal || '-').trim(),
          kecamatan: String(row[8] || existingAcc?.kecamatan || inferKecamatanFromUpt(resolvedUpt)).trim(),
          username: resolvedUser,
          password: resolvedPass,
          role: resolvedRole,
          kepalaSekolah:
            row[9] && String(row[9]).trim() !== '-'
              ? String(row[9]).trim()
              : existingAcc?.kepalaSekolah,
          nipKepalaSekolah:
            row[10] && String(row[10]).trim() !== '-'
              ? String(row[10]).trim()
              : existingAcc?.nipKepalaSekolah,
          bendahara:
            row[11] && String(row[11]).trim() !== '-'
              ? String(row[11]).trim()
              : existingAcc?.bendahara,
          nipBendahara:
            row[12] && String(row[12]).trim() !== '-'
              ? String(row[12]).trim()
              : existingAcc?.nipBendahara,
          pengurusBarang:
            row[13] && String(row[13]).trim() !== '-'
              ? String(row[13]).trim()
              : namaPejabat || existingAcc?.pengurusBarang,
          nipPengurusBarang:
            row[14] && String(row[14]).trim() !== '-'
              ? String(row[14]).trim()
              : existingAcc?.nipPengurusBarang,
        };

        accountByNormUpt.set(normKey, accObj);
        akunCount++;
      }
    }
  }

  // 5. Check Sheet 1: 1_PANEL_ADMIN_UPT (Merge edits to Kepala Sekolah, Bendahara, Pengurus Barang, NIP, NPSN, Pagu)
  const panelAdminSheetName = sheetNames.find(
    (s) => s.toUpperCase().includes('PANEL_ADMIN') || s.includes('1_')
  );
  if (panelAdminSheetName) {
    const data = sheetsMap[panelAdminSheetName] || [];
    if (data.length > 1) {
      let headerRowIdx = 0;
      for (let i = 0; i < Math.min(data.length, 5); i++) {
        const rowStr = (data[i] || []).join(' ').toLowerCase();
        if (
          rowStr.includes('kepala sekolah') ||
          rowStr.includes('bendahara') ||
          rowStr.includes('nama upt')
        ) {
          headerRowIdx = i;
          break;
        }
      }

      for (let r = headerRowIdx + 1; r < data.length; r++) {
        const row = data[r];
        if (!row || row.length < 2) continue;
        const uptName = String(row[1] || '').trim();
        if (!uptName) continue;

        const normKey = normalizeUptKey(uptName);
        const baseAcc = accountByNormUpt.get(normKey) || existingByNorm.get(normKey);

        const npsnVal = String(row[2] || baseAcc?.npsn || '-').trim();
        const kecVal = String(row[3] || baseAcc?.kecamatan || inferKecamatanFromUpt(uptName)).trim();
        const kepsekVal = String(row[5] || '').trim();
        const nipKepsekVal = String(row[6] || '').trim();
        const bendaharaVal = String(row[7] || '').trim();
        const nipBendaharaVal = String(row[8] || '').trim();
        const pengurusVal = String(row[9] || '').trim();
        const nipPengurusVal = String(row[10] || '').trim();
        const paguVal = parseExcelNumber(row[11] || 0);

        if (paguVal > 0 && normalizeUptKey(schoolInfo.namaSekolah) === normKey) {
          importedPaguTahunan = paguVal;
        } else if (paguVal > 0 && importedPaguTahunan === undefined) {
          importedPaguTahunan = paguVal;
        }

        const mergedAcc: UptSchoolAccount = {
          id: baseAcc?.id || (npsnVal !== '-' ? npsnVal : `upt-${r}`),
          upt: baseAcc?.upt || uptName,
          npsn: baseAcc?.npsn && baseAcc.npsn !== '-' ? baseAcc.npsn : npsnVal,
          kecamatan: baseAcc?.kecamatan || kecVal,
          username: baseAcc?.username || generateSlugUsername(uptName),
          password: baseAcc?.password || (npsnVal !== '-' ? npsnVal : '123456'),
          role: baseAcc?.role || (normKey === 'DINAS PENDIDIKAN' ? 'Admin' : 'Operator BOSP'),
          kepalaSekolah:
            baseAcc?.kepalaSekolah || (kepsekVal && kepsekVal !== '-' ? kepsekVal : undefined),
          nipKepalaSekolah:
            baseAcc?.nipKepalaSekolah ||
            (nipKepsekVal && nipKepsekVal !== '-' ? nipKepsekVal : undefined),
          bendahara:
            baseAcc?.bendahara ||
            (bendaharaVal && bendaharaVal !== '-' ? bendaharaVal : undefined),
          nipBendahara:
            baseAcc?.nipBendahara ||
            (nipBendaharaVal && nipBendaharaVal !== '-' ? nipBendaharaVal : undefined),
          pengurusBarang:
            baseAcc?.pengurusBarang ||
            (pengurusVal && pengurusVal !== '-' ? pengurusVal : undefined),
          nipPengurusBarang:
            baseAcc?.nipPengurusBarang ||
            (nipPengurusVal && nipPengurusVal !== '-' ? nipPengurusVal : undefined),
        };

        accountByNormUpt.set(normKey, mergedAcc);
        panelAdminCount++;
      }
    }
  }

  const importedAccounts = Array.from(accountByNormUpt.values());

  return {
    importedExpenses,
    importedBarangEkstra,
    importedAccounts,
    importedPaguTahunan,
    persediaanCount,
    pemeliharaanCount,
    rekapMatrixCount,
    barangEkstraCount,
    akunCount: Math.max(akunCount, importedAccounts.length),
    panelAdminCount,
    sheetsFound: sheetNames,
  };
}

export function parseMasterDatabaseArrayBuffer(
  buffer: ArrayBuffer,
  schoolInfo: SchoolInfo
): ParseMasterDatabaseResult {
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetsMap: Record<string, any[][]> = {};
  wb.SheetNames.forEach((sheetName) => {
    const ws = wb.Sheets[sheetName];
    if (ws) {
      sheetsMap[sheetName] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    }
  });
  return parseMasterSheetsMap(sheetsMap, schoolInfo);
}

export async function parseMasterDatabaseSpreadsheet(
  file: File,
  schoolInfo: SchoolInfo
): Promise<ParseMasterDatabaseResult> {
  const buffer = await file.arrayBuffer();
  return parseMasterDatabaseArrayBuffer(buffer, schoolInfo);
}


