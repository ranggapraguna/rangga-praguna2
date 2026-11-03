import { SchoolExpense, Triwulan, TaxType, QuarterStats, RincianRekeningItem, normalizeRekeningPersediaan } from '../types';

/**
 * Menentukan Triwulan (TW1 - TW4) secara otomatis berdasarkan string Tanggal
 * Mendukung format YYYY-MM-DD maupun DD/MM/YYYY atau DD-MM-YYYY
 */
export function getTriwulanFromDate(dateStr?: string, fallback: Triwulan = 'TW1'): Triwulan {
  if (!dateStr || !dateStr.trim()) return fallback;
  const trimmed = dateStr.trim();

  let month = NaN;
  // Format YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    month = parseInt(isoMatch[2], 10);
  } else {
    // Format DD/MM/YYYY atau DD-MM-YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (dmyMatch) {
      month = parseInt(dmyMatch[2], 10);
    } else {
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        month = parsed.getMonth() + 1;
      }
    }
  }

  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return fallback;
  }
  if (month <= 3) return 'TW1';
  if (month <= 6) return 'TW2';
  if (month <= 9) return 'TW3';
  return 'TW4';
}

/**
 * Menyelesaikan tanggal efektif dan Triwulan (TW1-TW4) untuk setiap baris rincian pemeliharaan.
 * Baris sub-item yang tanggalnya kosong otomatis mengikuti tanggal baris induk di atasnya.
 */
export function resolvePemeliharaanItemsWithTriwulan(
  items: RincianRekeningItem[],
  fallbackDate?: string,
  fallbackTw: Triwulan = 'TW1'
): Array<RincianRekeningItem & { resolvedTanggal: string; resolvedTriwulan: Triwulan }> {
  const firstNonEmptyDate =
    items.find((it) => it.tanggalPemeliharaan && it.tanggalPemeliharaan.trim())
      ?.tanggalPemeliharaan?.trim() ||
    fallbackDate?.trim() ||
    '';

  let currentActiveDate = firstNonEmptyDate;

  return items.map((item) => {
    const rawDate = item.tanggalPemeliharaan?.trim() || '';
    if (rawDate) {
      currentActiveDate = rawDate;
    }
    const resolvedTanggal = currentActiveDate || fallbackDate?.trim() || '';
    const resolvedTriwulan = resolvedTanggal
      ? getTriwulanFromDate(resolvedTanggal, fallbackTw)
      : fallbackTw;

    return {
      ...item,
      resolvedTanggal,
      resolvedTriwulan,
    };
  });
}

/**
 * Memfilter transaksi SchoolExpense berdasarkan pilihan Triwulan (selectedQuarters).
 * Untuk Belanja Pemeliharaan, setiap baris rincian difilter berdasarkan Tanggal pada Nilai Masuk & Keluar.
 */
export function filterExpenseByQuarters(
  expense: SchoolExpense,
  selectedQuarters: Triwulan[]
): SchoolExpense | null {
  if (selectedQuarters.length === 0) return null;

  const isPemeliharaan =
    expense.kategoriBelanja === 'pemeliharaan' ||
    Boolean(
      expense.rincianItems &&
        expense.rincianItems.some(
          (it) =>
            it.tanggalPemeliharaan !== undefined ||
            it.nilaiJasa !== undefined ||
            it.nilaiBarang !== undefined
        )
    );

  if (isPemeliharaan && expense.rincianItems && expense.rincianItems.length > 0) {
    const resolved = resolvePemeliharaanItemsWithTriwulan(
      expense.rincianItems,
      expense.tanggal,
      expense.triwulan
    );
    const matchingResolved = resolved.filter((it) =>
      selectedQuarters.includes(it.resolvedTriwulan)
    );

    if (matchingResolved.length === 0) {
      return null;
    }

    const matchingQuarters = Array.from(
      new Set(matchingResolved.map((it) => it.resolvedTriwulan))
    ).sort(
      (a, b) =>
        (['TW1', 'TW2', 'TW3', 'TW4'] as Triwulan[]).indexOf(a) -
        (['TW1', 'TW2', 'TW3', 'TW4'] as Triwulan[]).indexOf(b)
    );

    const matchingItems: RincianRekeningItem[] = matchingResolved.map(
      ({ resolvedTanggal: _rt, resolvedTriwulan: _rq, ...rest }) => rest
    );

    const totalBelanjaLra = matchingItems.reduce((sum, it) => {
      const hasExplicitJasaBarang =
        it.nilaiJasa !== undefined || it.nilaiBarang !== undefined;
      const totalRow = hasExplicitJasaBarang
        ? (Number(it.nilaiJasa) || 0) + (Number(it.nilaiBarang) || 0)
        : Number(it.nilaiBelanjaLra) || Number(it.nilaiMasuk) || 0;
      return sum + totalRow;
    }, 0);

    const firstDate =
      matchingResolved.find((it) => it.resolvedTanggal)?.resolvedTanggal ||
      expense.tanggal;

    return {
      ...expense,
      tanggal: firstDate,
      triwulan: matchingQuarters[0] || expense.triwulan,
      mergedQuarters: matchingQuarters,
      combinedQuarterLabel:
        matchingQuarters.length === 1
          ? matchingQuarters[0].replace('TW', 'TW ')
          : `${matchingQuarters[0].replace('TW', 'TW ')} - ${matchingQuarters[
              matchingQuarters.length - 1
            ].replace('TW', 'TW ')}`,
      rincianItems: matchingItems,
      nilaiSaldoAwal: 0,
      nilaiBelanjaLra: totalBelanjaLra,
      pengeluaranSaldoAwal: 0,
      pengeluaranBelanja: totalBelanjaLra,
      nilaiMasuk: totalBelanjaLra,
      nilaiKeluar: totalBelanjaLra,
      sisaNilai: 0,
      subtotal: totalBelanjaLra,
      hargaSatuan: totalBelanjaLra,
      totalBersih: totalBelanjaLra,
    };
  }

  const effectiveTw =
    isPemeliharaan && expense.tanggal
      ? getTriwulanFromDate(expense.tanggal, expense.triwulan)
      : expense.triwulan;

  if (!selectedQuarters.includes(effectiveTw)) {
    return null;
  }

  return effectiveTw !== expense.triwulan
    ? { ...expense, triwulan: effectiveTw }
    : expense;
}

/**
 * Menghitung nilai potongan atau kewajiban pajak berdasarkan subtotal dan tipe pajak
 */
export function calculateTax(subtotal: number, taxType: TaxType): number {
  if (subtotal <= 0 || taxType === 'Tanpa Pajak') {
    return 0;
  }

  switch (taxType) {
    case 'PPN 11%':
      return Math.round(subtotal * 0.11);
    case 'PPh 21 (Honor 5%)':
      return Math.round(subtotal * 0.05);
    case 'PPh 22 (Barang 1.5%)':
      return Math.round(subtotal * 0.015);
    case 'PPh 23 (Jasa 2%)':
      return Math.round(subtotal * 0.02);
    default:
      return 0;
  }
}

/**
 * Menghitung total bersih yang dibayarkan ke rekanan/penerima setelah potongan pajak (PPh)
 */
export function calculateNetTotal(subtotal: number, taxType: TaxType): number {
  const tax = calculateTax(subtotal, taxType);
  if (taxType.startsWith('PPh')) {
    return Math.max(0, subtotal - tax);
  }
  return subtotal;
}

/**
 * Menghitung persentase serapan belanja terhadap pagu anggaran
 */
export function getAbsorptionRate(realisasi: number, pagu: number): number {
  if (pagu <= 0) return 0;
  const rate = (realisasi / pagu) * 100;
  return Number(rate.toFixed(1));
}

/**
 * Format angka ke format mata uang Rupiah Indonesia (Rp xx.xxx.xxx)
 */
export function formatRupiah(amount: number): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safeAmount);
}

/**
 * Rekapitulasi ringkasan statistik per triwulan
 */
export function calculateQuarterSummary(
  expenses: SchoolExpense[],
  paguPerTriwulan: Record<Triwulan, number>
): Record<Triwulan, QuarterStats> {
  const quarters: Triwulan[] = ['TW1', 'TW2', 'TW3', 'TW4'];
  const summary: Record<Triwulan, QuarterStats> = {
    TW1: { pagu: paguPerTriwulan.TW1 || 0, realisasi: 0, sisaPagu: 0, persentaseSerapan: 0, jumlahTransaksi: 0, pajakTerpotong: 0 },
    TW2: { pagu: paguPerTriwulan.TW2 || 0, realisasi: 0, sisaPagu: 0, persentaseSerapan: 0, jumlahTransaksi: 0, pajakTerpotong: 0 },
    TW3: { pagu: paguPerTriwulan.TW3 || 0, realisasi: 0, sisaPagu: 0, persentaseSerapan: 0, jumlahTransaksi: 0, pajakTerpotong: 0 },
    TW4: { pagu: paguPerTriwulan.TW4 || 0, realisasi: 0, sisaPagu: 0, persentaseSerapan: 0, jumlahTransaksi: 0, pajakTerpotong: 0 },
  };

  for (const exp of expenses) {
    if (exp.kategoriBelanja === 'pemeliharaan' && exp.rincianItems && exp.rincianItems.length > 0) {
      for (const q of quarters) {
        const filtered = filterExpenseByQuarters(exp, [q]);
        if (filtered) {
          summary[q].realisasi += filtered.subtotal;
          summary[q].jumlahTransaksi += 1;
        }
      }
    } else if (summary[exp.triwulan]) {
      summary[exp.triwulan].realisasi += exp.subtotal;
      summary[exp.triwulan].pajakTerpotong += exp.nilaiPajak;
      summary[exp.triwulan].jumlahTransaksi += 1;
    }
  }

  for (const q of quarters) {
    const pagu = summary[q].pagu;
    const realisasi = summary[q].realisasi;
    summary[q].sisaPagu = pagu - realisasi;
    summary[q].persentaseSerapan = getAbsorptionRate(realisasi, pagu);
  }

  return summary;
}

export interface QuarterPersediaanStats {
  triwulan: Triwulan | 'TOTAL';
  saldoAwal: number;
  belanjaMasuk: number;
  pengeluaranSaldoAwal: number;
  pengeluaranBelanja: number;
  belanjaKeluar: number;
  hibahMasuk: number;
  hibahKeluar: number;
  totalMasuk: number;
  totalKeluar: number;
  saldoAkhir: number;
  jumlahTransaksi: number;
}

/**
 * Mengekstrak rincian nilai persediaan (Saldo Awal, Belanja Masuk, Belanja Keluar, Hibah Masuk/Keluar, Saldo Akhir)
 * dari satu transaksi SchoolExpense (mendukung rincianItems maupun properti langsung).
 */
export function extractExpensePersediaanBreakdown(expense: SchoolExpense): Omit<QuarterPersediaanStats, 'triwulan' | 'jumlahTransaksi'> {
  let saldoAwal = 0;
  let belanjaMasuk = 0;
  let pengeluaranSaldoAwal = 0;
  let pengeluaranBelanja = 0;
  let hibahMasuk = 0;
  let hibahKeluar = 0;

  const items =
    expense.rincianItems && expense.rincianItems.length > 0
      ? expense.rincianItems
      : [
          {
            id: expense.id,
            kodeRekening: expense.kodeRekening,
            saldoAwal: expense.saldoAwal || 'Bukan Saldo Awal',
            saldoAwalMasuk: expense.saldoAwalMasuk || expense.saldoAwal || 'Bukan Saldo Awal',
            saldoAwalKeluar: expense.saldoAwalKeluar || 'Bukan Saldo Awal',
            isHibah: Boolean(expense.isHibah),
            nilaiSaldoAwal: expense.nilaiSaldoAwal,
            nilaiBelanjaLra: expense.nilaiBelanjaLra,
            pengeluaranSaldoAwal: expense.pengeluaranSaldoAwal,
            pengeluaranBelanja: expense.pengeluaranBelanja,
            hibahMasuk: expense.hibahMasuk,
            hibahKeluar: expense.hibahKeluar,
            nilaiMasuk: expense.nilaiMasuk ?? expense.subtotal ?? 0,
            nilaiKeluar: expense.nilaiKeluar ?? 0,
            sisaNilai: expense.sisaNilai ?? 0,
          },
        ];

  for (const item of items) {
    const masukType = item.saldoAwalMasuk || item.saldoAwal || 'Bukan Saldo Awal';
    const keluarType = item.saldoAwalKeluar || 'Bukan Saldo Awal';
    const hibah = Boolean(item.isHibah);
    const keyNorm = String(item.kodeRekening || '').trim().toLowerCase();
    const isPemeliharaan =
      expense.kategoriBelanja === 'pemeliharaan' ||
      (item as any).nilaiJasa !== undefined ||
      (item as any).nilaiBarang !== undefined ||
      keyNorm.startsWith('belanja pemeliharaan');

    let itemSaldoAwal = 0;
    let itemBelanjaMasuk = 0;
    let itemPengeluaranSaldoAwal = 0;
    let itemPengeluaranBelanja = 0;
    let itemHibahMasuk = 0;
    let itemHibahKeluar = 0;

    if (isPemeliharaan) {
      const hasExplicitJasaBarang =
        (item as any).nilaiJasa !== undefined || (item as any).nilaiBarang !== undefined;
      const totalJasaBarang = hasExplicitJasaBarang
        ? (Number((item as any).nilaiJasa) || 0) + (Number((item as any).nilaiBarang) || 0)
        : Number(item.nilaiBelanjaLra) || Number(item.nilaiMasuk) || 0;
      itemBelanjaMasuk = totalJasaBarang;
      itemPengeluaranBelanja = totalJasaBarang;
    } else {
      itemSaldoAwal =
        item.nilaiSaldoAwal !== undefined
          ? Number(item.nilaiSaldoAwal) || 0
          : !hibah && masukType === 'Saldo Awal'
          ? Number(item.nilaiMasuk) || 0
          : 0;
      itemBelanjaMasuk =
        item.nilaiBelanjaLra !== undefined
          ? Number(item.nilaiBelanjaLra) || 0
          : !hibah && masukType === 'Bukan Saldo Awal'
          ? Number(item.nilaiMasuk) || 0
          : 0;
      itemPengeluaranSaldoAwal =
        item.pengeluaranSaldoAwal !== undefined
          ? Number(item.pengeluaranSaldoAwal) || 0
          : !hibah && keluarType === 'Saldo Awal'
          ? Number(item.nilaiKeluar) || 0
          : 0;
      itemPengeluaranBelanja =
        item.pengeluaranBelanja !== undefined
          ? Number(item.pengeluaranBelanja) || 0
          : !hibah && keluarType === 'Bukan Saldo Awal'
          ? Number(item.nilaiKeluar) || 0
          : 0;
      itemHibahMasuk =
        item.hibahMasuk !== undefined
          ? Number(item.hibahMasuk) || 0
          : hibah
          ? Number(item.nilaiMasuk) || 0
          : 0;
      itemHibahKeluar =
        item.hibahKeluar !== undefined
          ? Number(item.hibahKeluar) || 0
          : hibah
          ? Number(item.nilaiKeluar) || 0
          : 0;
    }

    saldoAwal += itemSaldoAwal;
    belanjaMasuk += itemBelanjaMasuk;
    pengeluaranSaldoAwal += itemPengeluaranSaldoAwal;
    pengeluaranBelanja += itemPengeluaranBelanja;
    hibahMasuk += itemHibahMasuk;
    hibahKeluar += itemHibahKeluar;
  }

  const belanjaKeluar = pengeluaranSaldoAwal + pengeluaranBelanja;
  const totalMasuk = saldoAwal + belanjaMasuk + hibahMasuk;
  const totalKeluar = belanjaKeluar + hibahKeluar;
  const saldoAkhir = totalMasuk - totalKeluar;

  return {
    saldoAwal,
    belanjaMasuk,
    pengeluaranSaldoAwal,
    pengeluaranBelanja,
    belanjaKeluar,
    hibahMasuk,
    hibahKeluar,
    totalMasuk,
    totalKeluar,
    saldoAkhir,
  };
}

/**
 * Menghitung laporan persediaan per Triwulan (TW1 - TW4) beserta total keseluruhan
 * mencakup: Total Saldo Awal, Belanja Masuk, Belanja Keluar, Hibah Masuk & Keluar, dan Total Saldo Akhir.
 */
export function calculateQuarterPersediaanSummary(expenses: SchoolExpense[]): {
  byQuarter: Record<Triwulan, QuarterPersediaanStats>;
  total: QuarterPersediaanStats;
} {
  const quarters: Triwulan[] = ['TW1', 'TW2', 'TW3', 'TW4'];
  const createEmptyStats = (tw: Triwulan | 'TOTAL'): QuarterPersediaanStats => ({
    triwulan: tw,
    saldoAwal: 0,
    belanjaMasuk: 0,
    pengeluaranSaldoAwal: 0,
    pengeluaranBelanja: 0,
    belanjaKeluar: 0,
    hibahMasuk: 0,
    hibahKeluar: 0,
    totalMasuk: 0,
    totalKeluar: 0,
    saldoAkhir: 0,
    jumlahTransaksi: 0,
  });

  const byQuarter: Record<Triwulan, QuarterPersediaanStats> = {
    TW1: createEmptyStats('TW1'),
    TW2: createEmptyStats('TW2'),
    TW3: createEmptyStats('TW3'),
    TW4: createEmptyStats('TW4'),
  };
  const total = createEmptyStats('TOTAL');

  for (const exp of expenses) {
    if (exp.kategoriBelanja === 'pemeliharaan' && exp.rincianItems && exp.rincianItems.length > 0) {
      for (const q of quarters) {
        const filtered = filterExpenseByQuarters(exp, [q]);
        if (filtered) {
          const qBreakdown = extractExpensePersediaanBreakdown(filtered);
          const qStats = byQuarter[q];
          qStats.saldoAwal += qBreakdown.saldoAwal;
          qStats.belanjaMasuk += qBreakdown.belanjaMasuk;
          qStats.pengeluaranSaldoAwal += qBreakdown.pengeluaranSaldoAwal;
          qStats.pengeluaranBelanja += qBreakdown.pengeluaranBelanja;
          qStats.belanjaKeluar += qBreakdown.belanjaKeluar;
          qStats.hibahMasuk += qBreakdown.hibahMasuk;
          qStats.hibahKeluar += qBreakdown.hibahKeluar;
          qStats.totalMasuk += qBreakdown.totalMasuk;
          qStats.totalKeluar += qBreakdown.totalKeluar;
          qStats.saldoAkhir += qBreakdown.saldoAkhir;
          qStats.jumlahTransaksi += 1;
        }
      }
      const fullBreakdown = extractExpensePersediaanBreakdown(exp);
      total.saldoAwal += fullBreakdown.saldoAwal;
      total.belanjaMasuk += fullBreakdown.belanjaMasuk;
      total.pengeluaranSaldoAwal += fullBreakdown.pengeluaranSaldoAwal;
      total.pengeluaranBelanja += fullBreakdown.pengeluaranBelanja;
      total.belanjaKeluar += fullBreakdown.belanjaKeluar;
      total.hibahMasuk += fullBreakdown.hibahMasuk;
      total.hibahKeluar += fullBreakdown.hibahKeluar;
      total.totalMasuk += fullBreakdown.totalMasuk;
      total.totalKeluar += fullBreakdown.totalKeluar;
      total.saldoAkhir += fullBreakdown.saldoAkhir;
      total.jumlahTransaksi += 1;
      continue;
    }

    const breakdown = extractExpensePersediaanBreakdown(exp);
    const qStats = byQuarter[exp.triwulan];
    if (qStats) {
      qStats.saldoAwal += breakdown.saldoAwal;
      qStats.belanjaMasuk += breakdown.belanjaMasuk;
      qStats.pengeluaranSaldoAwal += breakdown.pengeluaranSaldoAwal;
      qStats.pengeluaranBelanja += breakdown.pengeluaranBelanja;
      qStats.belanjaKeluar += breakdown.belanjaKeluar;
      qStats.hibahMasuk += breakdown.hibahMasuk;
      qStats.hibahKeluar += breakdown.hibahKeluar;
      qStats.totalMasuk += breakdown.totalMasuk;
      qStats.totalKeluar += breakdown.totalKeluar;
      qStats.saldoAkhir += breakdown.saldoAkhir;
      qStats.jumlahTransaksi += 1;
    }

    total.saldoAwal += breakdown.saldoAwal;
    total.belanjaMasuk += breakdown.belanjaMasuk;
    total.pengeluaranSaldoAwal += breakdown.pengeluaranSaldoAwal;
    total.pengeluaranBelanja += breakdown.pengeluaranBelanja;
    total.belanjaKeluar += breakdown.belanjaKeluar;
    total.hibahMasuk += breakdown.hibahMasuk;
    total.hibahKeluar += breakdown.hibahKeluar;
    total.totalMasuk += breakdown.totalMasuk;
    total.totalKeluar += breakdown.totalKeluar;
    total.saldoAkhir += breakdown.saldoAkhir;
    total.jumlahTransaksi += 1;
  }

  for (const q of quarters) {
    byQuarter[q].saldoAkhir = byQuarter[q].totalMasuk - byQuarter[q].totalKeluar;
  }
  total.saldoAkhir = total.totalMasuk - total.totalKeluar;

  return { byQuarter, total };
}

/**
 * Generate nomor kuitansi otomatis bergaya AppSheet
 * Contoh: KW-BOS/2026/TW1/004
 */
/**
 * Menentukan Tahun Anggaran dari suatu transaksi belanja sekolah
 */
export function getExpenseYear(expense: SchoolExpense): number {
  if (expense.tahunAnggaran && Number.isFinite(Number(expense.tahunAnggaran))) {
    return Number(expense.tahunAnggaran);
  }
  const matchNoBukti = String(expense.noBukti || "").match(/\b(202[0-9])\b/);
  if (matchNoBukti) {
    return Number(matchNoBukti[1]);
  }
  const matchTanggal = String(expense.tanggal || "").match(/^(202[0-9])/);
  if (matchTanggal) {
    return Number(matchTanggal[1]);
  }
  return 2026;
}

/**
 * Memfilter daftar inputan belanja agar hanya menampilkan data sesuai Tahun Login / Tahun Anggaran aktif
 */
export function filterExpensesByYear(
  expenses: SchoolExpense[],
  year: number | string
): SchoolExpense[] {
  const targetYear = Number(year);
  if (!Number.isFinite(targetYear)) return expenses;
  return expenses.filter((exp) => getExpenseYear(exp) === targetYear);
}

import { normalizeUptKey } from '../data/schoolData';

/**
 * Memfilter daftar inputan belanja berdasarkan hak akses pengguna:
 * - HANYA AKUN ADMIN yang dapat melihat semua inputan (dari seluruh sekolah).
 * - AKUN OPERATOR BOS hanya dapat melihat inputan per akun sekolah masing-masing.
 */
export function filterExpensesForUser(
  expenses: SchoolExpense[],
  user: { role?: string; schoolName?: string; username?: string } | null | undefined,
  currentSchoolName?: string
): SchoolExpense[] {
  if (!user) return [];
  const roleStr = String(user.role || '').toLowerCase();
  const userNormSchool = normalizeUptKey(user.schoolName || '');
  const activeNormSchool = normalizeUptKey(currentSchoolName || '');

  // Hanya akun Admin yang dapat melihat semua inputan
  if (
    user.role === 'Admin' ||
    roleStr.includes('admin') ||
    user.username === 'admin_disdik' ||
    userNormSchool === 'DINAS PENDIDIKAN'
  ) {
    return expenses;
  }

  return expenses.filter((exp) => {
    // Jika data expense belum memiliki schoolName, anggap milik sekolah aktif jika dibuat di sesi sekolah tersebut
    if (!exp.schoolName) {
      return true;
    }
    const expNorm = normalizeUptKey(exp.schoolName);
    const expLower = exp.schoolName.trim().toLowerCase();
    const matchUserSchool =
      Boolean(userNormSchool) &&
      (expLower === (user.schoolName || '').trim().toLowerCase() || expNorm === userNormSchool);
    const matchActiveSchool =
      Boolean(activeNormSchool) &&
      (expLower === (currentSchoolName || '').trim().toLowerCase() || expNorm === activeNormSchool);
    return matchUserSchool || matchActiveSchool;
  });
}

export function generateNextReceiptNumber(
  expenses: SchoolExpense[],
  tw: Triwulan,
  year: number
): string {
  const matching = filterExpensesByYear(expenses, year).filter((e) => e.triwulan === tw);
  const nextSeq = matching.length + 1;
  const padded = String(nextSeq).padStart(3, "0");
  return `KW-BOS/${year}/${tw}/${padded}`;
}

/**
 * Konversi nama Triwulan ke label lengkap berbahasa Indonesia
 */
export function getQuarterLabel(tw: Triwulan): string {
  switch (tw) {
    case 'TW1':
      return 'Triwulan I (Jan - Mar)';
    case 'TW2':
      return 'Triwulan II (Apr - Jun)';
    case 'TW3':
      return 'Triwulan III (Jul - Sep)';
    case 'TW4':
      return 'Triwulan IV (Okt - Des)';
    default:
      return tw;
  }
}

const QUARTER_ORDER: Triwulan[] = ['TW1', 'TW2', 'TW3', 'TW4'];

export function sortQuarters(quarters: Triwulan[]): Triwulan[] {
  const unique = Array.from(new Set(quarters));
  return QUARTER_ORDER.filter((q) => unique.includes(q));
}

/**
 * Menghasilkan label gabungan Triwulan seperti "TW 1 - TW 2"
 */
export function formatCombinedQuarterLabel(quarters: Triwulan[]): string {
  const sorted = sortQuarters(quarters);
  if (sorted.length === 0) return '-';
  if (sorted.length === 1) {
    return sorted[0].replace('TW', 'TW ');
  }

  const nums = sorted.map((q) => Number(q.replace('TW', '')));
  const isConsecutive = nums.every((n, i) => (i === 0 ? true : n === nums[i - 1] + 1));

  if (isConsecutive) {
    return `TW ${nums[0]} - TW ${nums[nums.length - 1]}`;
  }
  return sorted.map((q) => q.replace('TW', 'TW ')).join(' & ');
}

export interface MergedPersediaanTableRow {
  id: string;
  kodeRekening: string;
  nominalSaldoAwal: number;
  nominalBelanjaLra: number;
  nominalPengakuanBast?: number;
  nominalPengeluaranSaldoAwal: number;
  nominalPengeluaranBelanja: number;
  nominalPengeluaranBast?: number;
  nominalHibahMasuk: number;
  nominalHibahKeluar: number;
  nominalJasa?: number;
  nominalBarang?: number;
  isPemeliharaan?: boolean;
  sisaNilai: number;
}

/**
 * Menggabungkan seluruh rincianItems dari daftar SchoolExpense menjadi baris tabel Lampiran Persediaan
 * yang sudah dijumlahkan per Jenis Persediaan (kodeRekening).
 */
export function buildMergedPersediaanTableRows(
  expenses: SchoolExpense[]
): {
  rows: MergedPersediaanTableRow[];
  totals: {
    nominalSaldoAwal: number;
    nominalBelanjaLra: number;
    nominalPengeluaranSaldoAwal: number;
    nominalPengeluaranBelanja: number;
    nominalHibahMasuk: number;
    nominalHibahKeluar: number;
    sisaNilai: number;
  };
} {
  const acc: Record<string, MergedPersediaanTableRow> = {};

  for (const expense of expenses) {
    const rawItems =
      expense.rincianItems && expense.rincianItems.length > 0
        ? expense.rincianItems
        : [
            {
              id: expense.id,
              kodeRekening: expense.kodeRekening || expense.uraian || '-',
              saldoAwal: expense.saldoAwal || 'Bukan Saldo Awal',
              saldoAwalMasuk:
                expense.saldoAwalMasuk || expense.saldoAwal || 'Bukan Saldo Awal',
              saldoAwalKeluar: expense.saldoAwalKeluar || 'Bukan Saldo Awal',
              isHibah: Boolean(expense.isHibah),
              nilaiSaldoAwal: expense.nilaiSaldoAwal,
              nilaiBelanjaLra: expense.nilaiBelanjaLra,
              pengeluaranSaldoAwal: expense.pengeluaranSaldoAwal,
              pengeluaranBelanja: expense.pengeluaranBelanja,
              hibahMasuk: expense.hibahMasuk,
              hibahKeluar: expense.hibahKeluar,
              nilaiMasuk: expense.nilaiMasuk ?? expense.subtotal ?? 0,
              nilaiKeluar: expense.nilaiKeluar ?? 0,
              sisaNilai:
                expense.sisaNilai ??
                (expense.nilaiMasuk ?? expense.subtotal ?? 0) -
                  (expense.nilaiKeluar ?? 0),
            },
          ];

    for (const item of rawItems) {
      const masukType =
        item.saldoAwalMasuk || item.saldoAwal || 'Bukan Saldo Awal';
      const keluarType = item.saldoAwalKeluar || 'Bukan Saldo Awal';
      const hibah = Boolean(item.isHibah);
      const keyNorm = String(item.kodeRekening || '').trim().toLowerCase();
      const isPemeliharaan =
        expense.kategoriBelanja === 'pemeliharaan' ||
        (item as any).nilaiJasa !== undefined ||
        (item as any).nilaiBarang !== undefined ||
        keyNorm.startsWith('belanja pemeliharaan');

      let nominalSaldoAwal = 0;
      let nominalBelanjaLra = 0;
      let nominalPengakuanBast = 0;
      let nominalPengeluaranSaldoAwal = 0;
      let nominalPengeluaranBelanja = 0;
      let nominalPengeluaranBast = 0;
      let nominalHibahMasuk = 0;
      let nominalHibahKeluar = 0;
      let nominalJasa = 0;
      let nominalBarang = 0;

      if (isPemeliharaan) {
        const hasExplicitJasaBarang =
          (item as any).nilaiJasa !== undefined || (item as any).nilaiBarang !== undefined;
        nominalJasa = hasExplicitJasaBarang ? Number((item as any).nilaiJasa) || 0 : 0;
        nominalBarang = hasExplicitJasaBarang
          ? Number((item as any).nilaiBarang) || 0
          : Number((item as any).nilaiPengakuanBast) ||
            Number((item as any).pengeluaranBast) ||
            0;
        nominalPengakuanBast =
          (item as any).nilaiPengakuanBast !== undefined
            ? Number((item as any).nilaiPengakuanBast) || 0
            : nominalBarang;
        nominalPengeluaranBast =
          (item as any).pengeluaranBast !== undefined
            ? Number((item as any).pengeluaranBast) || 0
            : nominalBarang;

        // Di Panel Admin:
        // Nilai Belanja LRA pemeliharaan diambil dari Nilai Pengakuan BAST pemeliharaan (nilai barang)
        // Nilai Pengeluaran Belanja pemeliharaan diambil dari Nilai BAST di luar belanja (nilai barang)
        nominalBelanjaLra = nominalPengakuanBast;
        nominalPengeluaranBelanja = nominalPengeluaranBast;
      } else {
        nominalSaldoAwal =
          item.nilaiSaldoAwal !== undefined
            ? Number(item.nilaiSaldoAwal) || 0
            : !hibah && masukType === 'Saldo Awal'
            ? Number(item.nilaiMasuk) || 0
            : 0;
        nominalBelanjaLra =
          item.nilaiBelanjaLra !== undefined
            ? Number(item.nilaiBelanjaLra) || 0
            : !hibah && masukType === 'Bukan Saldo Awal'
            ? Number(item.nilaiMasuk) || 0
            : 0;
        nominalPengakuanBast = Number((item as any).nilaiPengakuanBast) || 0;
        nominalPengeluaranSaldoAwal =
          item.pengeluaranSaldoAwal !== undefined
            ? Number(item.pengeluaranSaldoAwal) || 0
            : !hibah && keluarType === 'Saldo Awal'
            ? Number(item.nilaiKeluar) || 0
            : 0;
        nominalPengeluaranBelanja =
          item.pengeluaranBelanja !== undefined
            ? Number(item.pengeluaranBelanja) || 0
            : !hibah && keluarType === 'Bukan Saldo Awal'
            ? Number(item.nilaiKeluar) || 0
            : 0;
        nominalPengeluaranBast = Number((item as any).pengeluaranBast) || 0;
        nominalHibahMasuk =
          item.hibahMasuk !== undefined
            ? Number(item.hibahMasuk) || 0
            : hibah
            ? Number(item.nilaiMasuk) || 0
            : 0;
        nominalHibahKeluar =
          item.hibahKeluar !== undefined
            ? Number(item.hibahKeluar) || 0
            : hibah
            ? Number(item.nilaiKeluar) || 0
            : 0;
      }

      const rawKey = String(item.kodeRekening || '-');
      const key = isPemeliharaan ? rawKey : normalizeRekeningPersediaan(rawKey);
      const existing = acc[key];
      if (!existing) {
        const totalMasuk =
          nominalSaldoAwal + nominalBelanjaLra + nominalHibahMasuk;
        const totalKeluar =
          nominalPengeluaranSaldoAwal +
          nominalPengeluaranBelanja +
          nominalHibahKeluar;
        acc[key] = {
          id: item.id || `${expense.id}-${key}`,
          kodeRekening: key,
          nominalSaldoAwal,
          nominalBelanjaLra,
          nominalPengakuanBast,
          nominalPengeluaranSaldoAwal,
          nominalPengeluaranBelanja,
          nominalPengeluaranBast,
          nominalHibahMasuk,
          nominalHibahKeluar,
          nominalJasa,
          nominalBarang,
          isPemeliharaan,
          sisaNilai: totalMasuk - totalKeluar,
        };
      } else {
        existing.nominalSaldoAwal += nominalSaldoAwal;
        existing.nominalBelanjaLra += nominalBelanjaLra;
        existing.nominalPengakuanBast =
          (existing.nominalPengakuanBast || 0) + nominalPengakuanBast;
        existing.nominalPengeluaranSaldoAwal += nominalPengeluaranSaldoAwal;
        existing.nominalPengeluaranBelanja += nominalPengeluaranBelanja;
        existing.nominalPengeluaranBast =
          (existing.nominalPengeluaranBast || 0) + nominalPengeluaranBast;
        existing.nominalHibahMasuk += nominalHibahMasuk;
        existing.nominalHibahKeluar += nominalHibahKeluar;
        existing.nominalJasa = (existing.nominalJasa || 0) + nominalJasa;
        existing.nominalBarang = (existing.nominalBarang || 0) + nominalBarang;
        if (isPemeliharaan) existing.isPemeliharaan = true;
        const totalMasuk =
          existing.nominalSaldoAwal +
          existing.nominalBelanjaLra +
          existing.nominalHibahMasuk;
        const totalKeluar =
          existing.nominalPengeluaranSaldoAwal +
          existing.nominalPengeluaranBelanja +
          existing.nominalHibahKeluar;
        existing.sisaNilai = totalMasuk - totalKeluar;
      }
    }
  }

  const rows = Object.values(acc);
  const totals = rows.reduce(
    (sum, r) => ({
      nominalSaldoAwal: sum.nominalSaldoAwal + r.nominalSaldoAwal,
      nominalBelanjaLra: sum.nominalBelanjaLra + r.nominalBelanjaLra,
      nominalPengeluaranSaldoAwal:
        sum.nominalPengeluaranSaldoAwal + r.nominalPengeluaranSaldoAwal,
      nominalPengeluaranBelanja:
        sum.nominalPengeluaranBelanja + r.nominalPengeluaranBelanja,
      nominalHibahMasuk: sum.nominalHibahMasuk + r.nominalHibahMasuk,
      nominalHibahKeluar: sum.nominalHibahKeluar + r.nominalHibahKeluar,
      sisaNilai: sum.sisaNilai + r.sisaNilai,
    }),
    {
      nominalSaldoAwal: 0,
      nominalBelanjaLra: 0,
      nominalPengeluaranSaldoAwal: 0,
      nominalPengeluaranBelanja: 0,
      nominalHibahMasuk: 0,
      nominalHibahKeluar: 0,
      sisaNilai: 0,
    }
  );

  return { rows, totals };
}

/**
 * Menggabungkan (konsolidasi) daftar transaksi SchoolExpense per UPT Sekolah
 * apabila filter Triwulan dicentang lebih dari 1 (atau terdapat beberapa inputan pada sekolah yang sama).
 * Menghasilkan 1 Laporan Gabungan (misal: TW 1 - TW 2) per UPT beserta nilai tabel rincianItems yang telah dijumlahkan.
 */
export function consolidateExpensesBySchoolAndQuarters(
  expenses: SchoolExpense[],
  selectedQuarters: Triwulan[],
  defaultSchoolName?: string
): SchoolExpense[] {
  if (expenses.length === 0) return [];

  const isMultiQuarterChecked = selectedQuarters.length > 1;

  // Jika hanya 1 TW yang dicentang, periksa apakah ada sekolah dengan >1 transaksi yang perlu digabung
  // Namun jika >1 TW dicentang, wajib digabung menjadi 1 laporan per UPT sekolah
  const groupsBySchool = new Map<string, SchoolExpense[]>();
  for (const exp of expenses) {
    const rawSchool = (exp.schoolName || defaultSchoolName || 'UPT Sekolah').trim();
    const normSchool = normalizeUptKey(rawSchool);
    const list = groupsBySchool.get(normSchool) || [];
    list.push(exp);
    groupsBySchool.set(normSchool, list);
  }

  const consolidatedList: SchoolExpense[] = [];

  for (const [, schoolExpenses] of groupsBySchool.entries()) {
    // Urutkan berdasarkan urutan TW1 -> TW4 lalu tanggal
    const sortedGroup = [...schoolExpenses].sort((a, b) => {
      const qDiff = QUARTER_ORDER.indexOf(a.triwulan) - QUARTER_ORDER.indexOf(b.triwulan);
      if (qDiff !== 0) return qDiff;
      return new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime();
    });

    if (!isMultiQuarterChecked && sortedGroup.length === 1) {
      const single = sortedGroup[0];
      const singleQuarters =
        single.mergedQuarters && single.mergedQuarters.length > 0
          ? single.mergedQuarters
          : [single.triwulan];
      consolidatedList.push({
        ...single,
        mergedQuarters: singleQuarters,
        combinedQuarterLabel: formatCombinedQuarterLabel(singleQuarters),
        sourceExpenseIds: [single.id],
        mergedCount: 1,
      });
      continue;
    }

    // Gabungkan seluruh transaksi milik UPT ini menjadi 1 Laporan Gabungan
    const distinctQuarters = sortQuarters(
      sortedGroup.flatMap((e) =>
        e.mergedQuarters && e.mergedQuarters.length > 0
          ? e.mergedQuarters
          : [e.triwulan]
      )
    );
    const effectiveQuarters =
      selectedQuarters.length > 1 && selectedQuarters.length < 4
        ? sortQuarters(selectedQuarters)
        : distinctQuarters.length > 1
        ? distinctQuarters
        : sortQuarters(selectedQuarters.length > 0 ? selectedQuarters : distinctQuarters);

    const combinedLabel = formatCombinedQuarterLabel(effectiveQuarters);
    const { rows: mergedRows, totals } = buildMergedPersediaanTableRows(sortedGroup);

    const mergedRincianItems = mergedRows.map((r) => ({
      id: r.id,
      kodeRekening: r.kodeRekening as any,
      nilaiJasa: r.isPemeliharaan ? r.nominalJasa : undefined,
      nilaiBarang: r.isPemeliharaan ? r.nominalBarang : undefined,
      saldoAwal: (r.nominalSaldoAwal > 0 ? 'Saldo Awal' : 'Bukan Saldo Awal') as any,
      saldoAwalMasuk: (r.nominalSaldoAwal > 0 ? 'Saldo Awal' : 'Bukan Saldo Awal') as any,
      saldoAwalKeluar: (r.nominalPengeluaranSaldoAwal > 0 ? 'Saldo Awal' : 'Bukan Saldo Awal') as any,
      isHibah: r.nominalHibahMasuk > 0 || r.nominalHibahKeluar > 0,
      nilaiSaldoAwal: r.nominalSaldoAwal,
      nilaiBelanjaLra: r.nominalBelanjaLra,
      nilaiPengakuanBast: r.nominalPengakuanBast || 0,
      pengeluaranSaldoAwal: r.nominalPengeluaranSaldoAwal,
      pengeluaranBelanja: r.nominalPengeluaranBelanja,
      pengeluaranBast: r.nominalPengeluaranBast || 0,
      hibahMasuk: r.nominalHibahMasuk,
      hibahKeluar: r.nominalHibahKeluar,
      nilaiMasuk: r.nominalSaldoAwal + r.nominalBelanjaLra + r.nominalHibahMasuk,
      nilaiKeluar:
        r.nominalPengeluaranSaldoAwal + r.nominalPengeluaranBelanja + r.nominalHibahKeluar,
      sisaNilai: r.sisaNilai,
    }));

    const first = sortedGroup[0];
    const last = sortedGroup[sortedGroup.length - 1];
    const totalSubtotal = sortedGroup.reduce((s, e) => s + (e.subtotal || 0), 0);
    const totalPajak = sortedGroup.reduce((s, e) => s + (e.nilaiPajak || 0), 0);
    const totalBersih = sortedGroup.reduce((s, e) => s + (e.totalBersih || e.subtotal || 0), 0);

    const allApproved = sortedGroup.every((e) => e.status === 'Disetujui Kepala Sekolah');
    const anyVerified = sortedGroup.some((e) => e.status === 'Diverifikasi Bendahara');
    const anyPending = sortedGroup.some((e) => e.status === 'Menunggu Verifikasi');
    const mergedStatus = allApproved
      ? 'Disetujui Kepala Sekolah'
      : anyVerified
      ? 'Diverifikasi Bendahara'
      : anyPending
      ? 'Menunggu Verifikasi'
      : first.status;

    const totalMasuk =
      totals.nominalSaldoAwal + totals.nominalBelanjaLra + totals.nominalHibahMasuk;
    const totalKeluar =
      totals.nominalPengeluaranSaldoAwal +
      totals.nominalPengeluaranBelanja +
      totals.nominalHibahKeluar;

    const summaryRekeningList = mergedRows.map((r) => r.kodeRekening).join(', ');
    const year = getExpenseYear(first);

    consolidatedList.push({
      ...last,
      id: sortedGroup.length === 1 ? first.id : `merged-${normalizeUptKey(first.schoolName || defaultSchoolName || 'upt').replace(/\s+/g, '-')}-${effectiveQuarters.join('-')}`,
      schoolName: first.schoolName || defaultSchoolName,
      npsn: first.npsn,
      noBukti:
        sortedGroup.length === 1
          ? first.noBukti
          : `LAP-GAB/${year}/${effectiveQuarters.join('-')}`,
      tanggal: last.tanggal,
      triwulan: last.triwulan,
      uraian: summaryRekeningList || first.uraian,
      subtotal: totalSubtotal,
      hargaSatuan: totalSubtotal,
      nilaiPajak: totalPajak,
      totalBersih: totalBersih,
      nilaiSaldoAwal: totals.nominalSaldoAwal,
      nilaiBelanjaLra: totals.nominalBelanjaLra,
      pengeluaranSaldoAwal: totals.nominalPengeluaranSaldoAwal,
      pengeluaranBelanja: totals.nominalPengeluaranBelanja,
      hibahMasuk: totals.nominalHibahMasuk,
      hibahKeluar: totals.nominalHibahKeluar,
      nilaiMasuk: totalMasuk,
      nilaiKeluar: totalKeluar,
      sisaNilai: totals.sisaNilai,
      rincianItems: mergedRincianItems,
      status: mergedStatus,
      mergedQuarters: effectiveQuarters,
      combinedQuarterLabel: combinedLabel,
      sourceExpenseIds: sortedGroup.map((e) => e.id),
      mergedCount: sortedGroup.length,
    });
  }

  return consolidatedList;
}

