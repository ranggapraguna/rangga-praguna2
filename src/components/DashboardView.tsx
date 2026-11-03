import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PackageCheck,
  Gift,
  CheckCircle,
  Clock,
  FileText,
  ChevronRight,
  PlusCircle,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
} from 'lucide-react';
import { SchoolExpense, SchoolInfo, Triwulan } from '../types';
import {
  calculateQuarterPersediaanSummary,
  extractExpensePersediaanBreakdown,
  formatRupiah,
  getQuarterLabel,
} from '../utils/budgetCalculations';

interface DashboardViewProps {
  schoolInfo: SchoolInfo;
  expenses: SchoolExpense[];
  onSelectQuarter: (tw: Triwulan) => void;
  onNewExpenseWithQuarter: (tw: Triwulan) => void;
  onViewExpenseDetail: (exp: SchoolExpense) => void;
  onNavigateToList: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  schoolInfo,
  expenses,
  onSelectQuarter,
  onNewExpenseWithQuarter,
  onViewExpenseDetail,
  onNavigateToList,
}) => {
  const quarters: Triwulan[] = ['TW1', 'TW2', 'TW3', 'TW4'];
  const { byQuarter, total } = calculateQuarterPersediaanSummary(expenses);

  // Status breakdown
  const approvedCount = expenses.filter((e) => e.status === 'Disetujui Kepala Sekolah').length;
  const pendingCount = expenses.filter(
    (e) => e.status === 'Menunggu Verifikasi' || e.status === 'Diverifikasi Bendahara'
  ).length;
  const draftCount = expenses.filter((e) => e.status === 'Draf').length;

  // Breakdown per Kode Rekening Belanja Persediaan
  const rekeningMap: Record<
    string,
    {
      saldoAwal: number;
      belanjaMasuk: number;
      belanjaKeluar: number;
      hibahMasuk: number;
      hibahKeluar: number;
      saldoAkhir: number;
    }
  > = {};

  for (const exp of expenses) {
    const items =
      exp.rincianItems && exp.rincianItems.length > 0
        ? exp.rincianItems
        : [
            {
              id: exp.id,
              kodeRekening: exp.kodeRekening,
              saldoAwal: exp.saldoAwal || 'Bukan Saldo Awal',
              saldoAwalMasuk: exp.saldoAwalMasuk || exp.saldoAwal || 'Bukan Saldo Awal',
              saldoAwalKeluar: exp.saldoAwalKeluar || 'Bukan Saldo Awal',
              isHibah: Boolean(exp.isHibah),
              nilaiSaldoAwal: exp.nilaiSaldoAwal,
              nilaiBelanjaLra: exp.nilaiBelanjaLra,
              pengeluaranSaldoAwal: exp.pengeluaranSaldoAwal,
              pengeluaranBelanja: exp.pengeluaranBelanja,
              hibahMasuk: exp.hibahMasuk,
              hibahKeluar: exp.hibahKeluar,
              nilaiMasuk: exp.nilaiMasuk ?? exp.subtotal ?? 0,
              nilaiKeluar: exp.nilaiKeluar ?? 0,
              sisaNilai: exp.sisaNilai ?? 0,
            },
          ];

    for (const it of items) {
      const key = it.kodeRekening;
      if (!key) continue;
      if (!rekeningMap[key]) {
        rekeningMap[key] = {
          saldoAwal: 0,
          belanjaMasuk: 0,
          belanjaKeluar: 0,
          hibahMasuk: 0,
          hibahKeluar: 0,
          saldoAkhir: 0,
        };
      }
      const masukType = it.saldoAwalMasuk || it.saldoAwal || 'Bukan Saldo Awal';
      const keluarType = it.saldoAwalKeluar || 'Bukan Saldo Awal';
      const hibah = Boolean(it.isHibah);

      const sAwal =
        it.nilaiSaldoAwal !== undefined
          ? Number(it.nilaiSaldoAwal) || 0
          : !hibah && masukType === 'Saldo Awal'
          ? Number(it.nilaiMasuk) || 0
          : 0;
      const bMasuk =
        it.nilaiBelanjaLra !== undefined
          ? Number(it.nilaiBelanjaLra) || 0
          : !hibah && masukType === 'Bukan Saldo Awal'
          ? Number(it.nilaiMasuk) || 0
          : 0;
      const kSaldoAwal =
        it.pengeluaranSaldoAwal !== undefined
          ? Number(it.pengeluaranSaldoAwal) || 0
          : !hibah && keluarType === 'Saldo Awal'
          ? Number(it.nilaiKeluar) || 0
          : 0;
      const kBelanja =
        it.pengeluaranBelanja !== undefined
          ? Number(it.pengeluaranBelanja) || 0
          : !hibah && keluarType === 'Bukan Saldo Awal'
          ? Number(it.nilaiKeluar) || 0
          : 0;
      const hMasuk =
        it.hibahMasuk !== undefined
          ? Number(it.hibahMasuk) || 0
          : hibah
          ? Number(it.nilaiMasuk) || 0
          : 0;
      const hKeluar =
        it.hibahKeluar !== undefined
          ? Number(it.hibahKeluar) || 0
          : hibah
          ? Number(it.nilaiKeluar) || 0
          : 0;

      rekeningMap[key].saldoAwal += sAwal;
      rekeningMap[key].belanjaMasuk += bMasuk;
      rekeningMap[key].belanjaKeluar += kSaldoAwal + kBelanja;
      rekeningMap[key].hibahMasuk += hMasuk;
      rekeningMap[key].hibahKeluar += hKeluar;
      rekeningMap[key].saldoAkhir =
        rekeningMap[key].saldoAwal +
        rekeningMap[key].belanjaMasuk +
        rekeningMap[key].hibahMasuk -
        (rekeningMap[key].belanjaKeluar + rekeningMap[key].hibahKeluar);
    }
  }

  const sortedRekeningList = Object.entries(rekeningMap).sort(
    (a, b) =>
      b[1].saldoAwal +
      b[1].belanjaMasuk +
      b[1].hibahMasuk -
      (a[1].saldoAwal + a[1].belanjaMasuk + a[1].hibahMasuk)
  );

  // Max value for Bar Chart scaling
  const quarterBelanjaValues = quarters.map((tw) => byQuarter[tw].belanjaMasuk);
  const maxQuarterBelanja = Math.max(...quarterBelanjaValues, 1000);

  return (
    <div className="space-y-6">
      {/* Top Welcome / Headline Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 pointer-events-none transform skew-x-12" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-2 border border-emerald-400/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Laporan Persediaan BOSP Per Triwulan • TA {schoolInfo.tahunAnggaran}
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              Rekapitulasi Persediaan {schoolInfo.namaSekolah}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Ringkasan Total Saldo Awal, Belanja Masuk, Belanja Keluar, Hibah Masuk &amp; Keluar, serta Total Saldo Akhir per Triwulan I, II, III, dan IV Tahun Anggaran {schoolInfo.tahunAnggaran}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNewExpenseWithQuarter('TW1')}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow transition-all active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Input Belanja Baru</span>
            </button>
          </div>
        </div>
      </div>

      {/* 5 Summary Overview Cards (Total Tahun Anggaran Aktif) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Card 1: Total Saldo Awal */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-bold text-slate-600">Total Saldo Awal</span>
            <Wallet className="w-4 h-4 text-slate-700" />
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-900 truncate">
            {formatRupiah(total.saldoAwal)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Saldo Awal Persediaan TA {schoolInfo.tahunAnggaran}
          </div>
        </div>

        {/* Card 2: Total Belanja Masuk */}
        <div className="bg-white rounded-xl p-4 border border-emerald-200 shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 mb-1.5">
            <span className="text-xs font-bold">Belanja Masuk</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg sm:text-xl font-black text-emerald-700 truncate">
            {formatRupiah(total.belanjaMasuk)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Penambahan / Pengadaan Belanja (LRA)
          </div>
        </div>

        {/* Card 3: Total Belanja Keluar */}
        <div className="bg-white rounded-xl p-4 border border-rose-200 shadow-xs">
          <div className="flex items-center justify-between text-rose-700 mb-1.5">
            <span className="text-xs font-bold">Belanja Keluar</span>
            <TrendingDown className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-lg sm:text-xl font-black text-rose-700 truncate">
            {formatRupiah(total.belanjaKeluar)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between gap-1">
            <span title="Pengeluaran dari Saldo Awal">
              S.Awal: {formatRupiah(total.pengeluaranSaldoAwal)}
            </span>
            <span>•</span>
            <span title="Pengeluaran dari Belanja">
              Belanja: {formatRupiah(total.pengeluaranBelanja)}
            </span>
          </div>
        </div>

        {/* Card 4: Hibah Masuk & Keluar */}
        <div className="bg-white rounded-xl p-4 border border-amber-200 shadow-xs">
          <div className="flex items-center justify-between text-amber-800 mb-1.5">
            <span className="text-xs font-bold">Hibah Masuk &amp; Keluar</span>
            <Gift className="w-4 h-4 text-amber-600" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Hibah Masuk:</span>
              <span className="font-bold text-amber-800">{formatRupiah(total.hibahMasuk)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Hibah Keluar:</span>
              <span className="font-bold text-rose-700">{formatRupiah(total.hibahKeluar)}</span>
            </div>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Mutasi barang / persediaan hibah
          </div>
        </div>

        {/* Card 5: Total Saldo Akhir */}
        <div className="bg-gradient-to-br from-emerald-900 to-slate-900 text-white rounded-xl p-4 border border-emerald-700 shadow-sm">
          <div className="flex items-center justify-between text-emerald-300 mb-1.5">
            <span className="text-xs font-extrabold uppercase tracking-wider">Total Saldo Akhir</span>
            <PackageCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg sm:text-xl font-black text-white truncate">
            {formatRupiah(total.saldoAkhir)}
          </div>
          <div className="text-[11px] text-emerald-200/90 mt-1 flex items-center justify-between">
            <span>Sisa Akhir Persediaan</span>
            <span className="font-bold text-white">{total.jumlahTransaksi} inputan</span>
          </div>
        </div>
      </div>

      {/* Grafik Batang Perbandingan Belanja Per Triwulan (Bar Chart Component) */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-600" />
              <span>Grafik Batang Perbandingan Total Belanja Per Triwulan</span>
            </h3>
            <p className="text-xs text-slate-500">
              Visualisasi komparatif penggunaan anggaran pengadaan belanja (LRA) pada masing-masing Triwulan I s.d IV
            </p>
          </div>
          <span className="text-xs font-extrabold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
            Total Kumulatif: {formatRupiah(total.belanjaMasuk)}
          </span>
        </div>

        <div className="pt-6 pb-2 px-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-end h-56 pt-6 border-b border-slate-200">
            {quarters.map((tw) => {
              const val = byQuarter[tw].belanjaMasuk;
              const heightPercentage = Math.max(Math.round((val / maxQuarterBelanja) * 100), 8);
              return (
                <div
                  key={tw}
                  onClick={() => onSelectQuarter(tw)}
                  className="flex flex-col items-center h-full justify-end group cursor-pointer"
                >
                  <div className="text-[11px] font-bold text-emerald-800 mb-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shadow-xs">
                    {formatRupiah(val)}
                  </div>
                  <div
                    style={{ height: `${heightPercentage}%` }}
                    className="w-full max-w-[80px] bg-gradient-to-t from-emerald-700 to-teal-500 rounded-t-xl transition-all duration-300 group-hover:from-emerald-600 group-hover:to-teal-400 group-hover:shadow-md relative"
                  >
                    <div className="absolute inset-x-0 top-0 h-2 bg-white/20 rounded-t-xl" />
                  </div>
                  <div className="mt-3 text-center">
                    <span className="text-xs font-black text-slate-900 block">{tw}</span>
                    <span className="text-[10px] text-slate-500 block truncate max-w-[90px]">
                      {byQuarter[tw].jumlahTransaksi} input
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Diagram Lingkaran (Donut Chart) Proporsi Nilai Belanja Per Rekening */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>Diagram Lingkaran Proporsi Nilai Belanja Per Rekening</span>
            </h3>
            <p className="text-xs text-slate-500">
              Visualisasi persentase dan nilai pengadaan belanja berdasarkan seluruh jenis rekening belanja yang memiliki inputan
            </p>
          </div>
          <span className="text-xs font-black text-emerald-900 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
            Total Belanja: {formatRupiah(total.belanjaMasuk)}
          </span>
        </div>

        {(() => {
          const rawSlices = sortedRekeningList
            .filter(([_, item]) => (item.belanjaMasuk > 0 || item.saldoAkhir > 0 || item.saldoAwal > 0))
            .map(([rekening, item], idx) => {
              const colors = [
                '#059669', '#0d9488', '#2563eb', '#d97706', '#7c3aed',
                '#db2777', '#4f46e5', '#ea580c', '#0891b2', '#65a30d',
                '#0284c7', '#16a34a', '#ca8a04', '#9333ea', '#e11d48'
              ];
              return {
                label: rekening,
                value: item.belanjaMasuk > 0 ? item.belanjaMasuk : item.saldoAkhir,
                color: colors[idx % colors.length],
              };
            });

          let slices = rawSlices;
          if (rawSlices.length > 8) {
            const top = rawSlices.slice(0, 7);
            const others = rawSlices.slice(7);
            const otherVal = others.reduce((acc, s) => acc + s.value, 0);
            slices = [
              ...top,
              { label: 'REKENING LAINNYA', value: otherVal, color: '#64748b' }
            ];
          }

          const totalVal = slices.reduce((acc, s) => acc + s.value, 0) || 1;
          const radius = 75;
          const circumference = 2 * Math.PI * radius;
          let currentOffset = 0;
          const chartSlices = slices.map((slice) => {
            const fraction = slice.value / totalVal;
            const strokeDasharray = `${fraction * circumference} ${circumference}`;
            const strokeDashoffset = -currentOffset;
            currentOffset += fraction * circumference;
            return {
              ...slice,
              fraction,
              strokeDasharray,
              strokeDashoffset,
            };
          });

          return (
            <div className="flex flex-col md:flex-row items-center justify-center gap-8 py-4">
              {/* SVG Donut */}
              <div className="relative w-52 h-52 flex items-center justify-center shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
                  <circle
                    cx="100"
                    cy="100"
                    r="75"
                    fill="transparent"
                    stroke="#f1f5f9"
                    strokeWidth="32"
                  />
                  {chartSlices.map((slice, idx) => (
                    slice.value > 0 ? (
                      <circle
                        key={idx}
                        cx="100"
                        cy="100"
                        r="75"
                        fill="transparent"
                        stroke={slice.color}
                        strokeWidth="32"
                        strokeDasharray={slice.strokeDasharray}
                        strokeDashoffset={slice.strokeDashoffset}
                        className="transition-all duration-500 hover:opacity-90 cursor-pointer"
                      >
                        <title>{`${slice.label}: ${formatRupiah(slice.value)} (${(slice.fraction * 100).toFixed(1)}%)`}</title>
                      </circle>
                    ) : null
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Rekening Aktif</span>
                  <span className="text-xs font-black text-slate-900 truncate max-w-[120px]">
                    {rawSlices.length} Jenis
                  </span>
                </div>
              </div>

              {/* Legend Grid */}
              <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
                {slices.map((slice, idx) => {
                  const fraction = totalVal > 0 ? slice.value / totalVal : 0;
                  const percent = (fraction * 100).toFixed(1);
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50/50 border border-slate-200/80 transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: slice.color }} />
                        <div className="min-w-0">
                          <span className="font-bold text-slate-800 text-xs block truncate" title={slice.label}>{slice.label}</span>
                          <span className="text-[10px] text-slate-500">{percent}% dari total</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 pl-2">
                        <span className="font-black text-slate-900 text-xs block">{formatRupiah(slice.value)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

      {/* 4 Quarters Breakdown Grid (Laporan Per Triwulan TW1 s.d TW4) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-600" />
              <span>Laporan Persediaan Per Triwulan (TW1 - TW4)</span>
            </h2>
            <p className="text-xs text-slate-500">
              Rincian Total Saldo Awal, Belanja Masuk, Belanja Keluar, Hibah Masuk &amp; Keluar, serta Total Saldo Akhir pada masing-masing Triwulan.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quarters.map((tw) => {
            const data = byQuarter[tw];
            const hasActivity = data.jumlahTransaksi > 0;

            return (
              <div
                key={tw}
                className={`bg-white rounded-xl border transition-all duration-200 hover:shadow-md flex flex-col justify-between ${
                  hasActivity
                    ? 'border-emerald-300 ring-1 ring-emerald-400/20'
                    : 'border-slate-200'
                }`}
              >
                {/* Quarter Header */}
                <div className="p-4 border-b border-slate-100 bg-slate-50/70 rounded-t-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-slate-900 text-white">
                      {tw}
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      {data.jumlahTransaksi} Inputan
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mt-2">
                    {getQuarterLabel(tw)}
                  </h3>
                </div>

                {/* Quarter Body: Saldo Awal, Belanja Masuk, Belanja Keluar, Hibah Masuk/Keluar, Saldo Akhir */}
                <div className="p-4 space-y-2.5 flex-1 text-xs">
                  {/* 1. Total Saldo Awal */}
                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600 font-medium">Total Saldo Awal</span>
                    <span className="font-bold text-slate-900">
                      {formatRupiah(data.saldoAwal)}
                    </span>
                  </div>

                  {/* 2. Belanja Masuk */}
                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600 font-medium flex items-center gap-1">
                      <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      Belanja Masuk
                    </span>
                    <span className="font-bold text-emerald-700">
                      {formatRupiah(data.belanjaMasuk)}
                    </span>
                  </div>

                  {/* 3. Belanja Keluar */}
                  <div className="py-1 border-b border-slate-100 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 font-medium flex items-center gap-1">
                        <ArrowDownRight className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        Belanja Keluar
                      </span>
                      <span className="font-bold text-rose-700">
                        {formatRupiah(data.belanjaKeluar)}
                      </span>
                    </div>
                    {(data.pengeluaranSaldoAwal > 0 || data.pengeluaranBelanja > 0) && (
                      <div className="text-[10px] text-slate-400 pl-4 flex flex-col gap-0.5">
                        <div className="flex justify-between">
                          <span>• Keluar Saldo Awal:</span>
                          <span>{formatRupiah(data.pengeluaranSaldoAwal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>• Keluar Belanja:</span>
                          <span>{formatRupiah(data.pengeluaranBelanja)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 4. Hibah Masuk & Hibah Keluar */}
                  <div className="py-1 border-b border-slate-100 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 font-medium">Hibah Masuk</span>
                      <span className="font-semibold text-amber-800">
                        {formatRupiah(data.hibahMasuk)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 font-medium">Hibah Keluar</span>
                      <span className="font-semibold text-rose-700">
                        {formatRupiah(data.hibahKeluar)}
                      </span>
                    </div>
                  </div>

                  {/* 5. Total Saldo Akhir */}
                  <div className="pt-1.5">
                    <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                      <span className="text-[11px] font-extrabold text-emerald-950 uppercase">
                        Total Saldo Akhir
                      </span>
                      <span
                        className={`text-sm font-black ${
                          data.saldoAkhir >= 0 ? 'text-emerald-800' : 'text-rose-600'
                        }`}
                      >
                        {formatRupiah(data.saldoAkhir)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quarter Footer Actions */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 rounded-b-xl flex items-center gap-2">
                  <button
                    onClick={() => onSelectQuarter(tw)}
                    className="flex-1 py-1.5 px-2 text-center text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-all"
                    aria-label={`Lihat belanja ${tw}`}
                  >
                    Buka Data {tw}
                  </button>
                  <button
                    onClick={() => onNewExpenseWithQuarter(tw)}
                    className="p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all"
                    title={`Tambah Belanja di ${tw}`}
                    aria-label={`Tambah Belanja ${tw}`}
                  >
                    <PlusCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tabel Rekapitulasi Laporan Per Triwulan (TW1 - TW4) */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="px-4 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs sm:text-sm font-bold">
                Tabel Rekapitulasi Laporan Persediaan Per Triwulan (TA {schoolInfo.tahunAnggaran})
              </h3>
              <p className="text-[11px] text-slate-300">
                Perbandingan Saldo Awal, Belanja Masuk, Belanja Keluar, Hibah Masuk/Keluar, dan Saldo Akhir per Triwulan
              </p>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Total Inputan: {total.jumlahTransaksi} Transaksi
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-3">Triwulan</th>
                  <th className="py-3 px-3 text-right">Total Saldo Awal</th>
                  <th className="py-3 px-3 text-right">Belanja Masuk</th>
                  <th className="py-3 px-3 text-right">Belanja Keluar</th>
                  <th className="py-3 px-3 text-right">Hibah Masuk</th>
                  <th className="py-3 px-3 text-right">Hibah Keluar</th>
                  <th className="py-3 px-3 text-right bg-emerald-50/60 text-emerald-950">
                    Total Saldo Akhir
                  </th>
                  <th className="py-3 px-3 text-center">Inputan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quarters.map((tw) => {
                  const row = byQuarter[tw];
                  return (
                    <tr
                      key={tw}
                      onClick={() => onSelectQuarter(tw)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                        <span className="inline-block w-10 text-center px-1.5 py-0.5 rounded bg-slate-900 text-white text-[10px] font-extrabold mr-2">
                          {tw}
                        </span>
                        <span>{getQuarterLabel(tw)}</span>
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-800 whitespace-nowrap">
                        {formatRupiah(row.saldoAwal)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-700 whitespace-nowrap">
                        {formatRupiah(row.belanjaMasuk)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-rose-700 whitespace-nowrap">
                        {formatRupiah(row.belanjaKeluar)}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-amber-800 whitespace-nowrap">
                        {formatRupiah(row.hibahMasuk)}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-rose-700 whitespace-nowrap">
                        {formatRupiah(row.hibahKeluar)}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-emerald-900 bg-emerald-50/40 whitespace-nowrap">
                        {formatRupiah(row.saldoAkhir)}
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-slate-600 whitespace-nowrap">
                        {row.jumlahTransaksi}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-900 text-white font-bold text-xs">
                <tr>
                  <td className="py-3 px-3 uppercase">
                    TOTAL TAHUN {schoolInfo.tahunAnggaran}
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    {formatRupiah(total.saldoAwal)}
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-300 whitespace-nowrap">
                    {formatRupiah(total.belanjaMasuk)}
                  </td>
                  <td className="py-3 px-3 text-right text-rose-300 whitespace-nowrap">
                    {formatRupiah(total.belanjaKeluar)}
                  </td>
                  <td className="py-3 px-3 text-right text-amber-300 whitespace-nowrap">
                    {formatRupiah(total.hibahMasuk)}
                  </td>
                  <td className="py-3 px-3 text-right text-rose-300 whitespace-nowrap">
                    {formatRupiah(total.hibahKeluar)}
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-400 font-black whitespace-nowrap">
                    {formatRupiah(total.saldoAkhir)}
                  </td>
                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    {total.jumlahTransaksi}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Two Column: Rekening Persediaan Breakdown & Recent Expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 cols: Rincian Berdasarkan Kode Rekening Belanja Persediaan */}
        <div className="lg:col-span-2 bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Rincian Berdasarkan Kode Rekening Belanja Persediaan
              </h3>
              <p className="text-xs text-slate-500">
                Rekapitulasi Masuk, Keluar, dan Saldo Akhir per Kode Rekening Persediaan
              </p>
            </div>
            <button
              onClick={onNavigateToList}
              className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-0.5"
            >
              Lihat Semua
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {sortedRekeningList.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                Belum ada inputan belanja persediaan pada Tahun Anggaran {schoolInfo.tahunAnggaran}.
              </p>
            ) : (
              sortedRekeningList.map(([rekening, item]) => (
                <div
                  key={rekening}
                  className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-xs font-bold text-slate-900 truncate"
                      title={rekening}
                    >
                      {rekening}
                    </span>
                    <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full shrink-0">
                      Saldo Akhir: {formatRupiah(item.saldoAkhir)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1 border-t border-slate-200/60">
                    <div>
                      <span className="text-slate-400 block">Saldo Awal</span>
                      <span className="font-semibold text-slate-700">
                        {formatRupiah(item.saldoAwal)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Belanja Masuk</span>
                      <span className="font-semibold text-emerald-700">
                        {formatRupiah(item.belanjaMasuk)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Belanja Keluar</span>
                      <span className="font-semibold text-rose-700">
                        {formatRupiah(item.belanjaKeluar)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Hibah (M/K)</span>
                      <span className="font-semibold text-amber-800">
                        {formatRupiah(item.hibahMasuk)} / {formatRupiah(item.hibahKeluar)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right 1 col: Status Verifikasi & Recent Quick Table */}
        <div className="space-y-4">
          {/* Status Verifikasi SPJ Card */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              Status Verifikasi SPJ Kuitansi
            </h3>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 border border-emerald-100">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-semibold text-emerald-900">
                    Disetujui Kepala Sekolah
                  </span>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800">
                  {approvedCount}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50 border border-amber-100">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-semibold text-amber-900">
                    Menunggu / Diverifikasi
                  </span>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">
                  {pendingCount}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-700">
                    Draf Belum Diajukan
                  </span>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                  {draftCount}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Recent Expenses List */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Transaksi Belanja Terbaru
              </h3>
              <button
                onClick={onNavigateToList}
                className="text-[11px] font-semibold text-emerald-700 hover:underline"
              >
                Lihat Semua
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {expenses.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  Belum ada transaksi pada TA {schoolInfo.tahunAnggaran}.
                </p>
              ) : (
                expenses.slice(0, 4).map((exp) => {
                  const b = extractExpensePersediaanBreakdown(exp);
                  return (
                    <div
                      key={exp.id}
                      onClick={() => onViewExpenseDetail(exp)}
                      className="py-2.5 first:pt-0 last:pb-0 cursor-pointer hover:bg-slate-50/80 rounded px-1 transition-all group"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800 truncate max-w-[65%] group-hover:text-emerald-700">
                          {exp.uraian}
                        </span>
                        <span className="font-bold text-emerald-800 shrink-0">
                          {formatRupiah(b.saldoAkhir)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5">
                        <span>
                          {exp.noBukti} • {exp.triwulan}
                        </span>
                        <span className="text-slate-500">{exp.tanggal}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
