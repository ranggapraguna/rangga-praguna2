import { SchoolExpense, SchoolInfo, Triwulan, BOSSource, KomponenBOS, KodeRekening, TaxType, PaymentMethod, ExpenseStatus } from '../types';

export const SHEET_COLUMNS = [
  'No',
  'No Bukti',
  'Tanggal',
  'Triwulan',
  'Sumber Dana',
  'Komponen BOS',
  'Kode Rekening',
  'Uraian Belanja',
  'Penerima / Toko',
  'NPWP Toko',
  'Metode Bayar',
  'Volume',
  'Satuan',
  'Harga Satuan (Rp)',
  'Subtotal (Rp)',
  'Jenis Pajak',
  'Nilai Pajak (Rp)',
  'Total Bersih (Rp)',
  'Status SPJ',
  'Catatan',
  'ID Sistem'
] as const;

/**
 * Transforms an array of SchoolExpenses into a 2D array formatted for Google Sheets.
 */
export function expensesToSheetRows(expenses: SchoolExpense[]): (string | number)[][] {
  const rows: (string | number)[][] = [
    [...SHEET_COLUMNS]
  ];

  expenses.forEach((exp, idx) => {
    rows.push([
      idx + 1,
      exp.noBukti || '',
      exp.tanggal || '',
      exp.triwulan || 'TW1',
      exp.sumberDana || 'BOS Reguler',
      exp.komponen || '',
      exp.kodeRekening || '',
      exp.uraian || '',
      exp.penerimaToko || '',
      exp.npwpPenerima || '-',
      exp.metodePembayaran || 'Kas Tunai Bendahara',
      Number(exp.volume) || 1,
      exp.satuan || 'Paket',
      Number(exp.hargaSatuan) || 0,
      Number(exp.subtotal) || 0,
      exp.tipePajak || 'Tanpa Pajak',
      Number(exp.nilaiPajak) || 0,
      Number(exp.totalBersih) || 0,
      exp.status || 'Draf',
      exp.catatan || '',
      exp.id || ''
    ]);
  });

  return rows;
}

/**
 * Transforms summary statistics and school info into a Summary sheet 2D array.
 */
export function generateSummarySheetRows(schoolInfo: SchoolInfo, expenses: SchoolExpense[]): (string | number)[][] {
  const tws: Triwulan[] = ['TW1', 'TW2', 'TW3', 'TW4'];
  const twRealisasi: Record<Triwulan, number> = {
    TW1: 0,
    TW2: 0,
    TW3: 0,
    TW4: 0,
  };
  const twPajak: Record<Triwulan, number> = {
    TW1: 0,
    TW2: 0,
    TW3: 0,
    TW4: 0,
  };
  const twCount: Record<Triwulan, number> = {
    TW1: 0,
    TW2: 0,
    TW3: 0,
    TW4: 0,
  };

  expenses.forEach((e) => {
    if (twRealisasi[e.triwulan] !== undefined) {
      twRealisasi[e.triwulan] += Number(e.totalBersih) || 0;
      twPajak[e.triwulan] += Number(e.nilaiPajak) || 0;
      twCount[e.triwulan] += 1;
    }
  });

  const totalRealisasi = tws.reduce((acc, tw) => acc + twRealisasi[tw], 0);
  const totalPagu = schoolInfo.totalPaguTahunan || 0;
  const sisaPaguTotal = totalPagu - totalRealisasi;
  const serapanTotalPersen = totalPagu > 0 ? (totalRealisasi / totalPagu) * 100 : 0;

  const rows: (string | number)[][] = [
    ['REKAPITULASI LAPORAN REALISASI DANA BOSP SEKOLAH'],
    ['Nama Sekolah:', schoolInfo.namaSekolah, 'NPSN:', schoolInfo.npsn],
    ['Tahun Anggaran:', schoolInfo.tahunAnggaran, 'Total Pagu Tahunan:', totalPagu],
    ['Kepala Sekolah:', schoolInfo.kepalaSekolah, 'NIP:', schoolInfo.nipKepalaSekolah],
    ['Bendahara BOSP:', schoolInfo.bendahara, 'NIP:', schoolInfo.nipBendahara],
    [''],
    ['RINCIAN PER TRIWULAN'],
    ['Triwulan', 'Pagu Anggaran (Rp)', 'Realisasi Belanja (Rp)', 'Sisa Pagu (Rp)', 'Persentase (%)', 'Jml Transaksi', 'Pajak Terpotong (Rp)'],
  ];

  tws.forEach((tw) => {
    const pagu = schoolInfo.paguPerTriwulan[tw] || 0;
    const realisasi = twRealisasi[tw];
    const sisa = pagu - realisasi;
    const persen = pagu > 0 ? ((realisasi / pagu) * 100).toFixed(1) + '%' : '0.0%';
    rows.push([
      tw,
      pagu,
      realisasi,
      sisa,
      persen,
      twCount[tw],
      twPajak[tw]
    ]);
  });

  rows.push([
    'TOTAL TAHUNAN',
    totalPagu,
    totalRealisasi,
    sisaPaguTotal,
    `${serapanTotalPersen.toFixed(1)}%`,
    expenses.length,
    tws.reduce((acc, tw) => acc + twPajak[tw], 0)
  ]);

  return rows;
}

/**
 * Parses Google Sheets rows back into SchoolExpense objects.
 */
export function sheetRowsToExpenses(rows: any[][]): SchoolExpense[] {
  if (!rows || rows.length <= 1) return [];

  const headers = rows[0].map((h: any) => String(h || '').trim().toLowerCase());
  
  // Find column indices
  const getCol = (keyParts: string[]) => {
    return headers.findIndex((h) => keyParts.some((p) => h.includes(p)));
  };

  const idCol = getCol(['id sistem', 'id']);
  const noBuktiCol = getCol(['no bukti', 'bukti']);
  const tanggalCol = getCol(['tanggal']);
  const twCol = getCol(['triwulan']);
  const sumberDanaCol = getCol(['sumber dana', 'sumber']);
  const komponenCol = getCol(['komponen']);
  const rekeningCol = getCol(['kode rekening', 'rekening']);
  const uraianCol = getCol(['uraian']);
  const penerimaCol = getCol(['penerima', 'toko']);
  const npwpCol = getCol(['npwp']);
  const metodeCol = getCol(['metode']);
  const volumeCol = getCol(['volume']);
  const satuanCol = getCol(['satuan']);
  const hargaCol = getCol(['harga']);
  const subtotalCol = getCol(['subtotal']);
  const pajakTipeCol = getCol(['jenis pajak', 'tipe pajak']);
  const nilaiPajakCol = getCol(['nilai pajak']);
  const totalBersihCol = getCol(['total bersih', 'bersih']);
  const statusCol = getCol(['status']);
  const catatanCol = getCol(['catatan']);

  const expenses: SchoolExpense[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const noBuktiVal = noBuktiCol >= 0 ? String(row[noBuktiCol] || '').trim() : '';
    const uraianVal = uraianCol >= 0 ? String(row[uraianCol] || '').trim() : '';
    
    // Ignore completely empty rows
    if (!noBuktiVal && !uraianVal) continue;

    const volume = volumeCol >= 0 ? parseFloat(String(row[volumeCol]).replace(/[^0-9.-]/g, '')) || 1 : 1;
    const harga = hargaCol >= 0 ? parseFloat(String(row[hargaCol]).replace(/[^0-9.-]/g, '')) || 0 : 0;
    const subtotal = subtotalCol >= 0 ? parseFloat(String(row[subtotalCol]).replace(/[^0-9.-]/g, '')) || volume * harga : volume * harga;
    const nilaiPajak = nilaiPajakCol >= 0 ? parseFloat(String(row[nilaiPajakCol]).replace(/[^0-9.-]/g, '')) || 0 : 0;
    const totalBersih = totalBersihCol >= 0 ? parseFloat(String(row[totalBersihCol]).replace(/[^0-9.-]/g, '')) || (subtotal - nilaiPajak) : (subtotal - nilaiPajak);

    let twRaw = twCol >= 0 ? String(row[twCol] || '').toUpperCase() : 'TW1';
    let tw: Triwulan = 'TW1';
    if (twRaw.includes('2') || twRaw.includes('TW2')) tw = 'TW2';
    else if (twRaw.includes('3') || twRaw.includes('TW3')) tw = 'TW3';
    else if (twRaw.includes('4') || twRaw.includes('TW4')) tw = 'TW4';

    const id = idCol >= 0 && row[idCol] ? String(row[idCol]) : `exp-${Date.now()}-${i}`;

    expenses.push({
      id,
      noBukti: noBuktiVal || `BOSP/2025/${i.toString().padStart(4, '0')}`,
      tanggal: tanggalCol >= 0 && row[tanggalCol] ? String(row[tanggalCol]) : new Date().toISOString().split('T')[0],
      triwulan: tw,
      sumberDana: (sumberDanaCol >= 0 && row[sumberDanaCol] ? String(row[sumberDanaCol]) : 'BOS Reguler') as BOSSource,
      komponen: (komponenCol >= 0 && row[komponenCol] ? String(row[komponenCol]) : '5. Administrasi Kegiatan Sekolah & ATK') as KomponenBOS,
      kodeRekening: (rekeningCol >= 0 && row[rekeningCol] ? String(row[rekeningCol]) : 'Alat/Bahan untuk Kegiatan Kantor- Alat Tulis Kantor') as KodeRekening,
      uraian: uraianVal || 'Belanja Keperluan BOSP',
      penerimaToko: penerimaCol >= 0 && row[penerimaCol] ? String(row[penerimaCol]) : 'Toko Sekolah',
      npwpPenerima: npwpCol >= 0 ? String(row[npwpCol] || '') : undefined,
      metodePembayaran: (metodeCol >= 0 && row[metodeCol] ? String(row[metodeCol]) : 'Kas Tunai Bendahara') as PaymentMethod,
      volume,
      satuan: satuanCol >= 0 && row[satuanCol] ? String(row[satuanCol]) : 'Paket',
      hargaSatuan: harga,
      subtotal,
      tipePajak: (pajakTipeCol >= 0 && row[pajakTipeCol] ? String(row[pajakTipeCol]) : 'Tanpa Pajak') as TaxType,
      nilaiPajak,
      totalBersih,
      status: (statusCol >= 0 && row[statusCol] ? String(row[statusCol]) : 'Diverifikasi Bendahara') as ExpenseStatus,
      catatan: catatanCol >= 0 ? String(row[catatanCol] || '') : '',
      createdAt: new Date().toISOString()
    });
  }

  return expenses;
}
