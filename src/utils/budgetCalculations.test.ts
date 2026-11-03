import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTax,
  calculateNetTotal,
  getAbsorptionRate,
  formatRupiah,
  calculateQuarterSummary,
  calculateQuarterPersediaanSummary,
  getExpenseYear,
  filterExpensesByYear,
  filterExpensesForUser,
  generateNextReceiptNumber,
} from './budgetCalculations';
import { terbilang } from './terbilang';
import { SchoolExpense, Triwulan } from '../types';

test('terbilang converts numbers to Indonesian words', () => {
  assert.equal(terbilang(0), 'Nol Rupiah');
  assert.equal(terbilang(1500000), 'Satu Juta Lima Ratus Ribu Rupiah');
  assert.equal(terbilang(810000), 'Delapan Ratus Sepuluh Ribu Rupiah');
});

test('calculateTax handles various tax types correctly', () => {
  // Tanpa Pajak
  assert.equal(calculateTax(1000000, 'Tanpa Pajak'), 0);
  assert.equal(calculateTax(0, 'PPN 11%'), 0);

  // PPN 11%
  assert.equal(calculateTax(1000000, 'PPN 11%'), 110000);

  // PPh 21 (5%)
  assert.equal(calculateTax(2000000, 'PPh 21 (Honor 5%)'), 100000);

  // PPh 22 (1.5%)
  assert.equal(calculateTax(3000000, 'PPh 22 (Barang 1.5%)'), 45000);

  // PPh 23 (2%)
  assert.equal(calculateTax(500000, 'PPh 23 (Jasa 2%)'), 10000);
});

test('calculateNetTotal deducts withholding tax for PPh and preserves subtotal for non-withholding', () => {
  // PPh 21 should deduct 5%
  assert.equal(calculateNetTotal(2000000, 'PPh 21 (Honor 5%)'), 1900000);

  // Tanpa Pajak
  assert.equal(calculateNetTotal(500000, 'Tanpa Pajak'), 500000);

  // PPN 11% does not deduct from subtotal
  assert.equal(calculateNetTotal(1000000, 'PPN 11%'), 1000000);
});

test('getAbsorptionRate calculates percentage properly', () => {
  assert.equal(getAbsorptionRate(25000000, 100000000), 25);
  assert.equal(getAbsorptionRate(0, 50000000), 0);
  assert.equal(getAbsorptionRate(1000000, 0), 0);
  assert.equal(getAbsorptionRate(3333333, 10000000), 33.3);
});

test('formatRupiah formats currency string correctly', () => {
  const formatted = formatRupiah(1500000);
  assert.ok(formatted.includes('1.500.000') || formatted.includes('1,500,000'));
});

test('calculateQuarterSummary aggregates quarterly totals and balances', () => {
  const dummyExpenses: SchoolExpense[] = [
    {
      id: '1',
      noBukti: 'KW-01',
      tanggal: '2026-02-10',
      triwulan: 'TW1',
      sumberDana: 'BOS Reguler',
      komponen: '5. Administrasi Kegiatan Sekolah & ATK',
      kodeRekening: 'Alat/Bahan untuk Kegiatan Kantor- Alat Tulis Kantor',
      uraian: 'Pembelian Kertas HVS & Spidol',
      penerimaToko: 'Toko Nusantara',
      metodePembayaran: 'Kas Tunai Bendahara',
      volume: 10,
      satuan: 'Rim',
      hargaSatuan: 55000,
      subtotal: 550000,
      tipePajak: 'Tanpa Pajak',
      nilaiPajak: 0,
      totalBersih: 550000,
      status: 'Disetujui Kepala Sekolah',
      createdAt: '2026-02-10T10:00:00Z',
    },
    {
      id: '2',
      noBukti: 'KW-02',
      tanggal: '2026-03-01',
      triwulan: 'TW1',
      sumberDana: 'BOS Reguler',
      komponen: '9. Pembayaran Honor Tenaga Pendidik/Kependidikan',
      kodeRekening: 'Alat/Bahan untuk Kegiatan Kantor- Kertas dan Cover',
      uraian: 'Honor Guru GTT Bulan Feb',
      penerimaToko: 'Ahmad Fauzi, S.Pd',
      metodePembayaran: 'Transfer Bank BPD/BRI',
      volume: 1,
      satuan: 'Bulan',
      hargaSatuan: 1200000,
      subtotal: 1200000,
      tipePajak: 'PPh 21 (Honor 5%)',
      nilaiPajak: 60000,
      totalBersih: 1140000,
      status: 'Diverifikasi Bendahara',
      createdAt: '2026-03-01T10:00:00Z',
    },
    {
      id: '3',
      noBukti: 'KW-03',
      tanggal: '2026-05-15',
      triwulan: 'TW2',
      sumberDana: 'BOS Reguler',
      komponen: '6. Langganan Daya & Jasa (Listrik, Internet, Air)',
      kodeRekening: 'Alat/Bahan untuk Kegiatan Kantor- Alat Listrik',
      uraian: 'Tagihan Indihome Mei',
      penerimaToko: 'PT Telkom Indonesia',
      metodePembayaran: 'Transfer Bank BPD/BRI',
      volume: 1,
      satuan: 'Bulan',
      hargaSatuan: 450000,
      subtotal: 450000,
      tipePajak: 'Tanpa Pajak',
      nilaiPajak: 0,
      totalBersih: 450000,
      status: 'Disetujui Kepala Sekolah',
      createdAt: '2026-05-15T10:00:00Z',
    },
  ];

  const paguMap: Record<Triwulan, number> = {
    TW1: 20000000,
    TW2: 25000000,
    TW3: 20000000,
    TW4: 15000000,
  };

  const summary = calculateQuarterSummary(dummyExpenses, paguMap);

  // TW1 has 2 expenses: 550,000 + 1,200,000 = 1,750,000
  assert.equal(summary.TW1.realisasi, 1750000);
  assert.equal(summary.TW1.pajakTerpotong, 60000);
  assert.equal(summary.TW1.jumlahTransaksi, 2);
  assert.equal(summary.TW1.sisaPagu, 20000000 - 1750000);
  assert.equal(summary.TW1.persentaseSerapan, 8.8);

  // TW2 has 1 expense: 450,000
  assert.equal(summary.TW2.realisasi, 450000);
  assert.equal(summary.TW2.jumlahTransaksi, 1);
  assert.equal(summary.TW2.sisaPagu, 24550000);

  // TW3 and TW4 have 0 expenses
  assert.equal(summary.TW3.realisasi, 0);
  assert.equal(summary.TW3.jumlahTransaksi, 0);
  assert.equal(summary.TW3.sisaPagu, 20000000);
});

test('generateNextReceiptNumber sequences receipts per quarter', () => {
  const existing: SchoolExpense[] = [
    {
      id: '1',
      noBukti: 'KW-BOS/2026/TW1/001',
      tanggal: '2026-01-10',
      triwulan: 'TW1',
      sumberDana: 'BOS Reguler',
      komponen: '5. Administrasi Kegiatan Sekolah & ATK',
      kodeRekening: 'Alat/Bahan untuk Kegiatan Kantor- Alat Tulis Kantor',
      uraian: 'Item 1',
      penerimaToko: 'Toko A',
      metodePembayaran: 'Kas Tunai Bendahara',
      volume: 1,
      satuan: 'Paket',
      hargaSatuan: 10000,
      subtotal: 10000,
      tipePajak: 'Tanpa Pajak',
      nilaiPajak: 0,
      totalBersih: 10000,
      status: 'Disetujui Kepala Sekolah',
      createdAt: '2026-01-10T00:00:00Z',
    },
  ];

  const nextTW1 = generateNextReceiptNumber(existing, 'TW1', 2026);
  assert.equal(nextTW1, 'KW-BOS/2026/TW1/002');

  const nextTW2 = generateNextReceiptNumber(existing, 'TW2', 2026);
  assert.equal(nextTW2, 'KW-BOS/2026/TW2/001');
});

test('filterExpensesByYear isolates inputs per login year (2025, 2026, 2027)', () => {
  const mixedYearExpenses: SchoolExpense[] = [
    {
      id: 'exp-2025',
      tahunAnggaran: 2025,
      noBukti: 'KW-BOS/2025/TW1/001',
      tanggal: '2025-02-10',
      triwulan: 'TW1',
      sumberDana: 'BOS Reguler',
      komponen: '5. Administrasi Kegiatan Sekolah & ATK',
      kodeRekening: 'Alat/Bahan untuk Kegiatan Kantor- Alat Tulis Kantor',
      uraian: 'ATK 2025',
      penerimaToko: 'Toko A',
      metodePembayaran: 'Kas Tunai Bendahara',
      volume: 1,
      satuan: 'Paket',
      hargaSatuan: 1000000,
      subtotal: 1000000,
      tipePajak: 'Tanpa Pajak',
      nilaiPajak: 0,
      totalBersih: 1000000,
      status: 'Disetujui Kepala Sekolah',
      createdAt: '2025-02-10T00:00:00Z',
    },
    {
      id: 'exp-2026',
      tahunAnggaran: 2026,
      noBukti: 'KW-BOS/2026/TW2/001',
      tanggal: '2026-05-10',
      triwulan: 'TW2',
      sumberDana: 'BOS Reguler',
      komponen: '5. Administrasi Kegiatan Sekolah & ATK',
      kodeRekening: 'Alat/Bahan untuk Kegiatan Kantor- Kertas dan Cover',
      uraian: 'Kertas 2026',
      penerimaToko: 'Toko B',
      metodePembayaran: 'Kas Tunai Bendahara',
      volume: 1,
      satuan: 'Paket',
      hargaSatuan: 2000000,
      subtotal: 2000000,
      tipePajak: 'Tanpa Pajak',
      nilaiPajak: 0,
      totalBersih: 2000000,
      status: 'Disetujui Kepala Sekolah',
      createdAt: '2026-05-10T00:00:00Z',
    },
  ];

  assert.equal(getExpenseYear(mixedYearExpenses[0]), 2025);
  assert.equal(getExpenseYear(mixedYearExpenses[1]), 2026);

  const only2025 = filterExpensesByYear(mixedYearExpenses, 2025);
  assert.equal(only2025.length, 1);
  assert.equal(only2025[0].id, 'exp-2025');

  const only2026 = filterExpensesByYear(mixedYearExpenses, 2026);
  assert.equal(only2026.length, 1);
  assert.equal(only2026[0].id, 'exp-2026');

  const only2027 = filterExpensesByYear(mixedYearExpenses, 2027);
  assert.equal(only2027.length, 0);
});

test('calculateQuarterPersediaanSummary computes Saldo Awal, Belanja Masuk, Belanja Keluar, Hibah Masuk/Keluar, and Saldo Akhir per TW', () => {
  const sampleExpenses: SchoolExpense[] = [
    {
      id: 'tw1-exp',
      tahunAnggaran: 2026,
      noBukti: 'KW-BOS/2026/TW1/001',
      tanggal: '2026-01-20',
      triwulan: 'TW1',
      sumberDana: 'BOS Reguler',
      komponen: '5. Administrasi Kegiatan Sekolah & ATK',
      kodeRekening: 'Alat/Bahan untuk Kegiatan Kantor- Alat Tulis Kantor',
      uraian: 'ATK TW1',
      penerimaToko: '-',
      metodePembayaran: 'Kas Tunai Bendahara',
      volume: 1,
      satuan: 'Paket',
      hargaSatuan: 1500000,
      subtotal: 1500000,
      nilaiSaldoAwal: 2000000,
      nilaiBelanjaLra: 1000000,
      pengeluaranSaldoAwal: 1500000,
      pengeluaranBelanja: 660000,
      hibahMasuk: 500000,
      hibahKeluar: 200000,
      rincianItems: [
        {
          id: 'item-1',
          kodeRekening: 'Alat/Bahan untuk Kegiatan Kantor- Alat Tulis Kantor',
          saldoAwal: 'Bukan Saldo Awal',
          saldoAwalMasuk: 'Bukan Saldo Awal',
          saldoAwalKeluar: 'Bukan Saldo Awal',
          isHibah: false,
          nilaiSaldoAwal: 2000000,
          nilaiBelanjaLra: 1000000,
          pengeluaranSaldoAwal: 1500000,
          pengeluaranBelanja: 660000,
          hibahMasuk: 500000,
          hibahKeluar: 200000,
          nilaiMasuk: 3500000,
          nilaiKeluar: 2360000,
          sisaNilai: 1140000,
        },
      ],
      tipePajak: 'Tanpa Pajak',
      nilaiPajak: 0,
      totalBersih: 1500000,
      status: 'Disetujui Kepala Sekolah',
      createdAt: '2026-01-20T00:00:00Z',
    },
    {
      id: 'tw2-exp',
      tahunAnggaran: 2026,
      noBukti: 'KW-BOS/2026/TW2/001',
      tanggal: '2026-04-15',
      triwulan: 'TW2',
      sumberDana: 'BOS Reguler',
      komponen: '5. Administrasi Kegiatan Sekolah & ATK',
      kodeRekening: 'Makanan dan Minuman Rapat',
      uraian: 'Mamin TW2',
      penerimaToko: '-',
      metodePembayaran: 'Kas Tunai Bendahara',
      volume: 1,
      satuan: 'Paket',
      hargaSatuan: 4000000,
      subtotal: 4000000,
      nilaiSaldoAwal: 0,
      nilaiBelanjaLra: 4000000,
      pengeluaranSaldoAwal: 0,
      pengeluaranBelanja: 3400000,
      hibahMasuk: 0,
      hibahKeluar: 0,
      tipePajak: 'Tanpa Pajak',
      nilaiPajak: 0,
      totalBersih: 4000000,
      status: 'Menunggu Verifikasi',
      createdAt: '2026-04-15T00:00:00Z',
    },
  ];

  const { byQuarter, total } = calculateQuarterPersediaanSummary(sampleExpenses);

  // TW1 assertions
  assert.equal(byQuarter.TW1.saldoAwal, 2000000);
  assert.equal(byQuarter.TW1.belanjaMasuk, 1000000);
  assert.equal(byQuarter.TW1.belanjaKeluar, 2160000); // 1,500,000 + 660,000
  assert.equal(byQuarter.TW1.hibahMasuk, 500000);
  assert.equal(byQuarter.TW1.hibahKeluar, 200000);
  assert.equal(byQuarter.TW1.saldoAkhir, 1140000); // (2,000,000 + 1,000,000 + 500,000) - (2,160,000 + 200,000)
  assert.equal(byQuarter.TW1.jumlahTransaksi, 1);

  // TW2 assertions
  assert.equal(byQuarter.TW2.saldoAwal, 0);
  assert.equal(byQuarter.TW2.belanjaMasuk, 4000000);
  assert.equal(byQuarter.TW2.belanjaKeluar, 3400000);
  assert.equal(byQuarter.TW2.hibahMasuk, 0);
  assert.equal(byQuarter.TW2.hibahKeluar, 0);
  assert.equal(byQuarter.TW2.saldoAkhir, 600000);
  assert.equal(byQuarter.TW2.jumlahTransaksi, 1);

  // Total assertions
  assert.equal(total.saldoAwal, 2000000);
  assert.equal(total.belanjaMasuk, 5000000);
  assert.equal(total.belanjaKeluar, 5560000);
  assert.equal(total.hibahMasuk, 500000);
  assert.equal(total.hibahKeluar, 200000);
  assert.equal(total.saldoAkhir, 1740000);
  assert.equal(total.jumlahTransaksi, 2);
});

test('INITIAL_EXPENSES is empty and filterOutLegacyDemoExpenses removes legacy demo reports', async () => {
  const { INITIAL_EXPENSES } = await import('../data/initialData');
  const { filterOutLegacyDemoExpenses } = await import('./storage');

  assert.equal(INITIAL_EXPENSES.length, 0);

  const mixed: SchoolExpense[] = [
    {
      id: 'exp-001',
      noBukti: 'KW-BOS/2026/TW1/001',
      tanggal: '2026-01-14',
      triwulan: 'TW1',
      sumberDana: 'BOS Reguler',
      komponen: '5. Administrasi Kegiatan Sekolah & ATK',
      kodeRekening: 'Alat/Bahan untuk Kegiatan Kantor- Alat Tulis Kantor',
      uraian: 'Demo item',
      penerimaToko: 'Toko Demo',
      metodePembayaran: 'Kas Tunai Bendahara',
      volume: 1,
      satuan: 'Rim',
      hargaSatuan: 50000,
      subtotal: 50000,
      tipePajak: 'Tanpa Pajak',
      nilaiPajak: 0,
      totalBersih: 50000,
      status: 'Disetujui Kepala Sekolah',
      createdAt: '2026-01-14T08:30:00Z',
    },
    {
      id: 'custom-123',
      noBukti: 'KW-BOS/2026/TW1/001',
      tanggal: '2026-02-01',
      triwulan: 'TW1',
      sumberDana: 'BOS Reguler',
      komponen: '5. Administrasi Kegiatan Sekolah & ATK',
      kodeRekening: 'Alat/Bahan untuk Kegiatan Kantor- Alat Tulis Kantor',
      uraian: 'Real item',
      penerimaToko: 'Toko Asli',
      metodePembayaran: 'Kas Tunai Bendahara',
      volume: 1,
      satuan: 'Paket',
      hargaSatuan: 100000,
      subtotal: 100000,
      tipePajak: 'Tanpa Pajak',
      nilaiPajak: 0,
      totalBersih: 100000,
      status: 'Menunggu Verifikasi',
      createdAt: '2026-02-01T08:30:00Z',
    },
  ];

  const cleaned = filterOutLegacyDemoExpenses(mixed);
  assert.equal(cleaned.length, 1);
  assert.equal(cleaned[0].id, 'custom-123');
});

test('filterExpensesForUser restricts Operator BOS to their own school inputs and gives Admin full visibility', () => {
  const schoolAExpense: SchoolExpense = {
    id: 'exp-school-a',
    tahunAnggaran: 2026,
    schoolName: 'SMP NEGERI 2 TOULUAAN',
    noBukti: 'KW-01',
    tanggal: '2026-02-01',
    triwulan: 'TW1',
    sumberDana: 'BOS Reguler',
    komponen: '5. Administrasi Kegiatan Sekolah & ATK',
    kodeRekening: 'Alat/Bahan untuk Kegiatan Kantor- Alat Tulis Kantor',
    uraian: 'Kertas HVS',
    penerimaToko: 'Toko A',
    metodePembayaran: 'Kas Tunai Bendahara',
    volume: 1,
    satuan: 'Rim',
    hargaSatuan: 50000,
    subtotal: 50000,
    tipePajak: 'Tanpa Pajak',
    nilaiPajak: 0,
    totalBersih: 50000,
    status: 'Disetujui Kepala Sekolah',
    createdAt: '2026-02-01T00:00:00Z',
  };

  const schoolBExpense: SchoolExpense = {
    id: 'exp-school-b',
    tahunAnggaran: 2026,
    schoolName: 'SMP NEGERI 1 TOULUAAN',
    noBukti: 'KW-02',
    tanggal: '2026-02-02',
    triwulan: 'TW1',
    sumberDana: 'BOS Reguler',
    komponen: '5. Administrasi Kegiatan Sekolah & ATK',
    kodeRekening: 'Alat/Bahan untuk Kegiatan Kantor- Alat Tulis Kantor',
    uraian: 'Tinta Printer',
    penerimaToko: 'Toko B',
    metodePembayaran: 'Kas Tunai Bendahara',
    volume: 1,
    satuan: 'Botol',
    hargaSatuan: 100000,
    subtotal: 100000,
    tipePajak: 'Tanpa Pajak',
    nilaiPajak: 0,
    totalBersih: 100000,
    status: 'Menunggu Verifikasi',
    createdAt: '2026-02-02T00:00:00Z',
  };

  const allExpenses = [schoolAExpense, schoolBExpense];

  // Operator BOS for SMPN 2 TOULUAAN
  const operatorUserA = {
    id: 'user-a',
    username: 'smpn2touluaan',
    nama: 'Operator SMPN 2 Touluaan',
    role: 'Operator BOSP',
    schoolName: 'SMP NEGERI 2 TOULUAAN',
    npsn: '40101972',
    createdAt: '2026-01-01T00:00:00Z',
  };

  const filteredForA = filterExpensesForUser(allExpenses, operatorUserA, 'SMP NEGERI 2 TOULUAAN');
  assert.equal(filteredForA.length, 1);
  assert.equal(filteredForA[0].id, 'exp-school-a');

  // Operator BOS for SMPN 1 TOULUAAN
  const operatorUserB = {
    id: 'user-b',
    username: 'smpn1touluaan',
    nama: 'Operator SMPN 1 Touluaan',
    role: 'Operator BOSP',
    schoolName: 'SMP NEGERI 1 TOULUAAN',
    npsn: '40102058',
    createdAt: '2026-01-01T00:00:00Z',
  };

  const filteredForB = filterExpensesForUser(allExpenses, operatorUserB, 'SMP NEGERI 1 TOULUAAN');
  assert.equal(filteredForB.length, 1);
  assert.equal(filteredForB[0].id, 'exp-school-b');

  // Admin user
  const adminUser = {
    id: 'user-admin',
    username: 'admin',
    nama: 'Admin Dinas Pendidikan',
    role: 'Admin',
    schoolName: 'DINAS PENDIDIKAN KAB. MINAHASA TENGGARA',
    createdAt: '2026-01-01T00:00:00Z',
  };

  const filteredForAdmin = filterExpensesForUser(allExpenses, adminUser, 'DINAS PENDIDIKAN');
  assert.equal(filteredForAdmin.length, 2);
  assert.deepEqual(filteredForAdmin.map((e) => e.id), ['exp-school-a', 'exp-school-b']);
});

test('clearAllSchoolExpenses and loadSchoolExpenses start with completely clean state', async () => {
  const { clearAllSchoolExpenses, loadSchoolExpenses } = await import('./storage');
  clearAllSchoolExpenses();
  const loaded = loadSchoolExpenses();
  assert.equal(Array.isArray(loaded), true);
  assert.equal(loaded.length, 0);
});


