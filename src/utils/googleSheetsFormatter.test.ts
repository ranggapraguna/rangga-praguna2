import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  expensesToSheetRows, 
  sheetRowsToExpenses, 
  generateSummarySheetRows,
  SHEET_COLUMNS 
} from './googleSheetsFormatter.ts';
import { SchoolExpense, SchoolInfo } from '../types/index.ts';

const mockExpenses: SchoolExpense[] = [
  {
    id: 'exp-1',
    noBukti: 'BOSP/2025/0001',
    tanggal: '2025-01-15',
    triwulan: 'TW1',
    sumberDana: 'BOS Reguler',
    komponen: '5. Administrasi Kegiatan Sekolah & ATK',
    kodeRekening: 'Alat/Bahan untuk Kegiatan Kantor- Alat Tulis Kantor',
    uraian: 'Kertas HVS A4 75gr Sinar Dunia 10 Rim',
    penerimaToko: 'CV Sumber ATK Makmur',
    npwpPenerima: '01.234.567.8-123.000',
    metodePembayaran: 'Kas Tunai Bendahara',
    volume: 10,
    satuan: 'Rim',
    hargaSatuan: 55000,
    subtotal: 550000,
    tipePajak: 'Tanpa Pajak',
    nilaiPajak: 0,
    totalBersih: 550000,
    status: 'Disetujui Kepala Sekolah',
    catatan: 'Untuk kebutuhan ujian semester',
    createdAt: '2025-01-15T08:00:00.000Z',
  },
  {
    id: 'exp-2',
    noBukti: 'BOSP/2025/0002',
    tanggal: '2025-04-10',
    triwulan: 'TW2',
    sumberDana: 'BOS Reguler',
    komponen: '6. Langganan Daya & Jasa (Listrik, Internet, Air)',
    kodeRekening: 'Alat/Bahan untuk Kegiatan Kantor- Alat Listrik',
    uraian: 'Tagihan Listrik PLN Bulan April',
    penerimaToko: 'PT PLN (Persero)',
    metodePembayaran: 'Transfer Bank BPD/BRI',
    volume: 1,
    satuan: 'Bulan',
    hargaSatuan: 1200000,
    subtotal: 1200000,
    tipePajak: 'PPN 11%',
    nilaiPajak: 132000,
    totalBersih: 1068000,
    status: 'Diverifikasi Bendahara',
    createdAt: '2025-04-10T09:00:00.000Z',
  }
];

const mockSchoolInfo: SchoolInfo = {
  namaSekolah: 'SD Negeri 01 Merdeka Belajar',
  npsn: '20109988',
  alamat: 'Jl. Pendidikan No. 45',
  kecamatan: 'Menteng',
  kabupaten: 'Jakarta Pusat',
  provinsi: 'DKI Jakarta',
  kepalaSekolah: 'Dra. Hj. Siti Rahmawati, M.Pd.',
  nipKepalaSekolah: '19750812 200003 2 001',
  bendahara: 'Ahmad Fauzi, S.Pd.',
  nipBendahara: '19880415 201101 1 004',
  tahunAnggaran: 2025,
  totalPaguTahunan: 120000000,
  paguPerTriwulan: {
    TW1: 30000000,
    TW2: 30000000,
    TW3: 30000000,
    TW4: 30000000,
  },
};

test('expensesToSheetRows produces valid header and expense rows', () => {
  const rows = expensesToSheetRows(mockExpenses);
  assert.equal(rows.length, 3); // 1 header + 2 items
  assert.deepEqual(rows[0], [...SHEET_COLUMNS]);

  // First item validation
  const row1 = rows[1];
  assert.equal(row1[1], 'BOSP/2025/0001');
  assert.equal(row1[3], 'TW1');
  assert.equal(row1[7], 'Kertas HVS A4 75gr Sinar Dunia 10 Rim');
  assert.equal(row1[14], 550000); // Subtotal
  assert.equal(row1[17], 550000); // Total Bersih
});

test('sheetRowsToExpenses correctly reconstructs expenses from rows', () => {
  const rows = expensesToSheetRows(mockExpenses);
  const parsed = sheetRowsToExpenses(rows);
  
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].noBukti, 'BOSP/2025/0001');
  assert.equal(parsed[0].triwulan, 'TW1');
  assert.equal(parsed[0].volume, 10);
  assert.equal(parsed[0].hargaSatuan, 55000);
  assert.equal(parsed[0].subtotal, 550000);
  assert.equal(parsed[0].totalBersih, 550000);

  assert.equal(parsed[1].noBukti, 'BOSP/2025/0002');
  assert.equal(parsed[1].triwulan, 'TW2');
  assert.equal(parsed[1].nilaiPajak, 132000);
});

test('generateSummarySheetRows generates valid quarterly recap', () => {
  const summaryRows = generateSummarySheetRows(mockSchoolInfo, mockExpenses);
  assert.ok(summaryRows.length >= 8);
  
  // Verify school title
  assert.equal(summaryRows[0][0], 'REKAPITULASI LAPORAN REALISASI DANA BOSP SEKOLAH');
  
  // Check TW rows
  const tw1Row = summaryRows.find(r => r[0] === 'TW1');
  assert.ok(tw1Row);
  assert.equal(tw1Row[1], 30000000); // Pagu
  assert.equal(tw1Row[2], 550000);   // Realisasi
});
