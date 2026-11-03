import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  LayoutList, 
  Table as TableIcon, 
  Printer, 
  Edit, 
  Trash2, 
  Download, 
  FileSpreadsheet,
  CheckCircle2, 
  Clock, 
  FileText,
  Building,
  Tag,
  ArrowUpDown,
  Lock,
  ShieldCheck,
  CheckSquare,
  Square,
  ChevronDown,
  Check,
  X
} from 'lucide-react';
import { SchoolExpense, Triwulan, ExpenseStatus } from '../types';
import {
  formatRupiah,
  consolidateExpensesBySchoolAndQuarters,
  formatCombinedQuarterLabel,
  buildMergedPersediaanTableRows,
  filterExpenseByQuarters,
} from '../utils/budgetCalculations';
import { exportExpensesToCSV } from '../utils/storage';
import { loadUptSchools, normalizeUptKey } from '../data/schoolData';

interface ExpenseListViewProps {
  expenses: SchoolExpense[];
  activeQuarterFilter: string[];
  onQuarterFilterChange: (tw: string[]) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onNewExpense: () => void;
  onSelectExpense: (exp: SchoolExpense) => void;
  onEditExpense: (exp: SchoolExpense) => void;
  onDeleteExpense: (id: string, sourceIds?: string[]) => void;
  onPrintReceipt: (exp: SchoolExpense) => void;
  onOpenGoogleSheets?: () => void;
  isAdmin?: boolean;
  onApproveExpense?: (id: string, sourceIds?: string[]) => void;
  onClearAllExpenses?: () => void;
}

const ALL_QUARTERS: {
  id: Triwulan;
  label: string;
  period: string;
}[] = [
  { id: 'TW1', label: 'Triwulan 1 (TW1)', period: '1 Jan - 31 Mar' },
  { id: 'TW2', label: 'Triwulan 2 (TW2)', period: '1 Apr - 30 Jun' },
  { id: 'TW3', label: 'Triwulan 3 (TW3)', period: '1 Jul - 30 Sep' },
  { id: 'TW4', label: 'Triwulan 4 (TW4)', period: '1 Okt - 31 Des' },
];

export const ExpenseListView: React.FC<ExpenseListViewProps> = ({
  expenses,
  activeQuarterFilter,
  onQuarterFilterChange,
  searchQuery,
  onSearchChange,
  onNewExpense,
  onSelectExpense,
  onEditExpense,
  onDeleteExpense,
  onPrintReceipt,
  onOpenGoogleSheets,
  isAdmin = false,
  onApproveExpense,
  onClearAllExpenses,
}) => {
  const [viewMode, setViewMode] = useState<'deck' | 'table'>('deck');
  const [selectedComponentFilter, setSelectedComponentFilter] = useState<string>('Semua');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('Semua');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');
  const [deleteTarget, setDeleteTarget] = useState<SchoolExpense | null>(null);
  const [clearAllModalOpen, setClearAllModalOpen] = useState(false);

  // Derive selectedQuarters directly from activeQuarterFilter (string[])
  const selectedQuarters = useMemo<Triwulan[]>(() => {
    if (activeQuarterFilter.includes('Semua')) {
      return ALL_QUARTERS.map((q) => q.id);
    }
    return ALL_QUARTERS.map((q) => q.id).filter((id) => activeQuarterFilter.includes(id));
  }, [activeQuarterFilter]);

  const [isTwComboOpen, setIsTwComboOpen] = useState<boolean>(false);
  const twComboRef = useRef<HTMLDivElement>(null);

  // Searchable UPT Filter state
  const [selectedUpt, setSelectedUpt] = useState<string>('Semua');
  const [uptSearchInput, setUptSearchInput] = useState<string>('');
  const [isUptModalOpen, setIsUptModalOpen] = useState<boolean>(false);
  const [uptFilterMode, setUptFilterMode] = useState<'all' | 'with_input'>('all');
  const uptContainerRef = useRef<HTMLDivElement>(null);
  const uptSearchFieldRef = useRef<HTMLInputElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (twComboRef.current && !twComboRef.current.contains(event.target as Node)) {
        setIsTwComboOpen(false);
      }
      if (uptContainerRef.current && !uptContainerRef.current.contains(event.target as Node)) {
        setIsUptModalOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const masterSchools = useMemo(() => loadUptSchools(), []);

  // Aggregate unique UPT schools from expenses + master catalog
  const { uniqueUptsWithInputs, allUptsCatalog } = useMemo(() => {
    const map = new Map<string, { displayName: string; count: number; total: number }>();
    expenses.forEach((e) => {
      const uptName = (e.schoolName || '').trim();
      if (uptName) {
        const normKey = normalizeUptKey(uptName);
        const curr = map.get(normKey) || { displayName: uptName, count: 0, total: 0 };
        map.set(normKey, {
          displayName: curr.displayName,
          count: curr.count + 1,
          total: curr.total + (e.subtotal || 0),
        });
      }
    });

    const withInputs = Array.from(map.entries())
      .map(([, data]) => ({
        name: data.displayName,
        count: data.count,
        total: data.total,
        hasInput: true,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const seen = new Set(withInputs.map((u) => normalizeUptKey(u.name)));
    const catalog = [...withInputs];

    if (!seen.has('DINAS PENDIDIKAN')) {
      seen.add('DINAS PENDIDIKAN');
      catalog.unshift({
        name: 'DINAS PENDIDIKAN',
        count: 0,
        total: 0,
        hasInput: false,
      });
    }

    masterSchools.forEach((s) => {
      const norm = normalizeUptKey(s.upt);
      if (s.upt && !seen.has(norm)) {
        seen.add(norm);
        catalog.push({
          name: s.upt,
          count: 0,
          total: 0,
          hasInput: false,
        });
      }
    });

    return { uniqueUptsWithInputs: withInputs, allUptsCatalog: catalog };
  }, [expenses, masterSchools]);

  // Filtered UPT list by search input (supports "SMPN 10 TOULUAAN" -> "SMP NEGERI 10 TOULUAAN")
  const filteredUptOptions = useMemo(() => {
    const source =
      uptFilterMode === 'with_input' && uniqueUptsWithInputs.length > 0
        ? uniqueUptsWithInputs
        : allUptsCatalog;

    if (!uptSearchInput.trim()) return source;
    const q = uptSearchInput.trim().toLowerCase();
    const normQ = normalizeUptKey(uptSearchInput).toLowerCase();
    return allUptsCatalog.filter((u) => {
      const nameLower = u.name.toLowerCase();
      const normNameLower = normalizeUptKey(u.name).toLowerCase();
      return nameLower.includes(q) || normNameLower.includes(q) || (normQ && normNameLower.includes(normQ));
    });
  }, [allUptsCatalog, uniqueUptsWithInputs, uptSearchInput, uptFilterMode]);

  // Multi-TW toggles synced with activeQuarterFilter: string[]
  const toggleQuarter = (tw: Triwulan) => {
    const exists = selectedQuarters.includes(tw);
    const next = exists ? selectedQuarters.filter((q) => q !== tw) : [...selectedQuarters, tw];
    const sorted = ALL_QUARTERS.map((q) => q.id).filter((id) => next.includes(id));
    onQuarterFilterChange(sorted);
  };

  const toggleAllQuarters = () => {
    if (selectedQuarters.length === ALL_QUARTERS.length) {
      onQuarterFilterChange([]);
    } else {
      onQuarterFilterChange(ALL_QUARTERS.map((q) => q.id));
    }
  };

  const twComboButtonLabel = useMemo(() => {
    if (selectedQuarters.length === 0) {
      return 'Pilih Filter Triwulan...';
    }
    if (selectedQuarters.length === ALL_QUARTERS.length) {
      return 'Semua Triwulan (TW 1 - TW 4)';
    }
    if (selectedQuarters.length === 1) {
      const found = ALL_QUARTERS.find((q) => q.id === selectedQuarters[0]);
      return found ? found.label : selectedQuarters[0];
    }
    return `Gabungan: ${formatCombinedQuarterLabel(selectedQuarters)}`;
  }, [selectedQuarters]);

  const getExpenseSaldoAkhir = (exp: SchoolExpense): number => {
    if (exp.rincianItems && exp.rincianItems.length > 0) {
      return exp.rincianItems.reduce((acc, item) => {
        const masukType = item.saldoAwalMasuk || item.saldoAwal || 'Bukan Saldo Awal';
        const keluarType = item.saldoAwalKeluar || 'Bukan Saldo Awal';
        const hibah = Boolean(item.isHibah);

        const nominalSaldoAwal =
          item.nilaiSaldoAwal !== undefined
            ? item.nilaiSaldoAwal
            : !hibah && masukType === 'Saldo Awal'
            ? item.nilaiMasuk
            : 0;
        const nominalBelanjaLra =
          item.nilaiBelanjaLra !== undefined
            ? item.nilaiBelanjaLra
            : !hibah && masukType === 'Bukan Saldo Awal'
            ? item.nilaiMasuk
            : 0;
        const nominalPengeluaranSaldoAwal =
          item.pengeluaranSaldoAwal !== undefined
            ? item.pengeluaranSaldoAwal
            : !hibah && keluarType === 'Saldo Awal'
            ? item.nilaiKeluar
            : 0;
        const nominalPengeluaranBelanja =
          item.pengeluaranBelanja !== undefined
            ? item.pengeluaranBelanja
            : !hibah && keluarType === 'Bukan Saldo Awal'
            ? item.nilaiKeluar
            : 0;
        const nominalHibahMasuk =
          item.hibahMasuk !== undefined
            ? item.hibahMasuk
            : hibah
            ? item.nilaiMasuk
            : 0;
        const nominalHibahKeluar =
          item.hibahKeluar !== undefined
            ? item.hibahKeluar
            : hibah
            ? item.nilaiKeluar
            : 0;

        const totalMasuk = nominalSaldoAwal + nominalBelanjaLra + nominalHibahMasuk;
        const totalKeluar =
          nominalPengeluaranSaldoAwal + nominalPengeluaranBelanja + nominalHibahKeluar;

        return acc + (totalMasuk - totalKeluar);
      }, 0);
    }

    if (exp.sisaNilai !== undefined) return exp.sisaNilai;
    if (exp.nilaiMasuk !== undefined || exp.nilaiKeluar !== undefined) {
      return (exp.nilaiMasuk || 0) - (exp.nilaiKeluar || 0);
    }
    return exp.subtotal || 0;
  };

  // Filtered & Consolidated items:
  // Jika dicentang lebih dari 1 TW (misal TW 1 dan TW 2), seluruh transaksi milik UPT yang sama
  // otomatis digabung menjadi 1 Laporan Gabungan (TW 1 - TW 2) beserta nilai tabelnya.
  const filteredExpenses = useMemo(() => {
    if (selectedQuarters.length === 0) return [];
    const rawFiltered: SchoolExpense[] = [];

    for (const rawItem of expenses) {
      const item = filterExpenseByQuarters(rawItem, selectedQuarters);
      if (!item) continue;

      // UPT School filter (supports normalized matching e.g. SMPN 10 TOULUAAN == SMP NEGERI 10 TOULUAAN)
      if (selectedUpt !== 'Semua') {
        const itemUpt = (item.schoolName || '').trim();
        if (
          itemUpt.toLowerCase() !== selectedUpt.toLowerCase() &&
          normalizeUptKey(itemUpt) !== normalizeUptKey(selectedUpt)
        ) {
          continue;
        }
      }

      // Component filter
      if (selectedComponentFilter !== 'Semua' && item.komponen !== selectedComponentFilter) {
        continue;
      }

      // Status filter
      if (selectedStatusFilter !== 'Semua' && item.status !== selectedStatusFilter) {
        continue;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const normQ = normalizeUptKey(searchQuery).toLowerCase();
        const matchesUraian = item.uraian.toLowerCase().includes(q);
        const matchesRekening = item.kodeRekening.toLowerCase().includes(q);
        const matchesNoBukti = item.noBukti?.toLowerCase().includes(q) || false;
        const matchesToko = item.penerimaToko?.toLowerCase().includes(q) || false;
        const matchesSchool =
          item.schoolName?.toLowerCase().includes(q) ||
          (item.schoolName ? normalizeUptKey(item.schoolName).toLowerCase().includes(normQ) : false);
        const matchesRincian =
          item.rincianItems?.some((r) => r.kodeRekening.toLowerCase().includes(q)) || false;

        if (!matchesUraian && !matchesRekening && !matchesNoBukti && !matchesToko && !matchesSchool && !matchesRincian) {
          continue;
        }
      }

      rawFiltered.push(item);
    }

    const consolidated = consolidateExpensesBySchoolAndQuarters(
      rawFiltered,
      selectedQuarters,
      selectedUpt !== 'Semua' ? selectedUpt : undefined
    );

    return consolidated.sort((a, b) => {
      if (sortBy === 'date-desc') return new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime();
      if (sortBy === 'date-asc') return new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime();
      if (sortBy === 'amount-desc') return getExpenseSaldoAkhir(b) - getExpenseSaldoAkhir(a);
      if (sortBy === 'amount-asc') return getExpenseSaldoAkhir(a) - getExpenseSaldoAkhir(b);
      return 0;
    });
  }, [expenses, selectedQuarters, selectedUpt, selectedComponentFilter, selectedStatusFilter, searchQuery, sortBy]);

  // Aggregate sum of Saldo Akhir for current filtered view
  const filteredTotalSaldoAkhir = useMemo(() => {
    return filteredExpenses.reduce((sum, item) => sum + getExpenseSaldoAkhir(item), 0);
  }, [filteredExpenses]);

  const getStatusBadge = (status: ExpenseStatus) => {
    switch (status) {
      case 'Disetujui Kepala Sekolah':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Disetujui
          </span>
        );
      case 'Diverifikasi Bendahara':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800">
            <Clock className="w-3 h-3 text-blue-600" />
            Diverifikasi
          </span>
        );
      case 'Menunggu Verifikasi':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
            <Clock className="w-3 h-3 text-amber-600" />
            Menunggu
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
            <FileText className="w-3 h-3 text-slate-500" />
            Draf
          </span>
        );
    }
  };

  const getQuarterBadge = (tw: Triwulan, combinedLabel?: string) => {
    if (combinedLabel && (combinedLabel.includes('-') || combinedLabel.includes('&'))) {
      return (
        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold border bg-emerald-100 text-emerald-900 border-emerald-300 shadow-2xs">
          {combinedLabel}
        </span>
      );
    }
    const colors: Record<Triwulan, string> = {
      TW1: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      TW2: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      TW3: 'bg-amber-100 text-amber-800 border-amber-200',
      TW4: 'bg-purple-100 text-purple-800 border-purple-200',
    };
    return (
      <span className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold border ${colors[tw] || 'bg-slate-100 text-slate-800'}`}>
        {combinedLabel || tw}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* KHUSUS ADMIN: DISTINCT ADMIN HEADER BANNER */}
      {isAdmin && (
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 rounded-2xl p-4 sm:p-5 text-white shadow-lg border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-500/20 text-amber-300 border border-amber-400/40 uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                TAMPILAN DATA BELANJA ADMIN
              </span>
              <span className="text-[11px] text-slate-300 font-medium hidden sm:inline">
                Mode Audit & Persetujuan Seluruh Sekolah
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-white">
              Data Belanja Persediaan Sekolah (Minahasa Tenggara)
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-slate-800 text-emerald-400 font-bold px-3 py-1.5 rounded-xl border border-slate-700">
              {filteredExpenses.length} transaksi ditampilkan
            </span>
          </div>
        </div>
      )}

      {/* Top Filter & Toolbar Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3.5">
        {/* Row 1: Header title, View switchers, Export & New button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>{isAdmin ? 'Tabel Data Belanja Sekolah' : 'Data Belanja Persediaan'}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                {filteredExpenses.length} data
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              {isAdmin
                ? 'Daftar transaksi belanja sekolah yang terinput dalam sistem untuk diperiksa atau disetujui.'
                : 'Daftar seluruh transaksi belanja persediaan per triwulan yang telah diinputkan.'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                onClick={() => setViewMode('deck')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
                  viewMode === 'deck'
                    ? 'bg-white text-emerald-800 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                aria-label="Tampilan Kartu / Deck"
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span>Kartu</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
                  viewMode === 'table'
                    ? 'bg-white text-emerald-800 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                aria-label="Tampilan Tabel Spreadsheet"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Tabel</span>
              </button>
            </div>

            {/* Export CSV / Excel */}
            <button
              onClick={() => exportExpensesToCSV(filteredExpenses)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-all cursor-pointer"
              title="Unduh Format CSV / Spreadsheet"
              aria-label="Ekspor CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden md:inline">Ekspor CSV</span>
            </button>

            {/* Google Sheets Trigger */}
            {onOpenGoogleSheets && (
              <button
                onClick={onOpenGoogleSheets}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg border border-emerald-300 transition-all shadow-xs cursor-pointer"
                title="Buka atau Sinkronkan ke Google Sheets"
                aria-label="Google Sheets"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Google Sheets</span>
              </button>
            )}

            {/* Clear All Expenses Trigger */}
            {onClearAllExpenses && expenses.length > 0 && (
              <button
                type="button"
                onClick={() => setClearAllModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg border border-rose-200 transition-all shadow-xs cursor-pointer"
                title="Hapus seluruh data inputan belanja yang ada"
                aria-label="Hapus Semua Data"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span className="hidden md:inline">Hapus Semua Data</span>
              </button>
            )}

            {/* New Expense Button */}
            <button
              onClick={onNewExpense}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow transition-all active:scale-95 cursor-pointer"
              aria-label="Tambah Belanja Baru"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Input Belanja</span>
            </button>
          </div>
        </div>

        {/* Row 2: TOMBOL FILTER NAMA UPT YANG BISA DICARI + TOMBOL CENTANG TW SEPERTI BERITA ACARA REKON */}
        <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* === TOMBOL FILTER NAMA UPT (HANYA MUNCUL UNTUK ADMIN, UNTUK OPERATOR BOS HANYA UPT TERLOGIN) === */}
            {isAdmin && (
              <div ref={uptContainerRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsUptModalOpen((prev) => !prev);
                    setTimeout(() => uptSearchFieldRef.current?.focus(), 80);
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-xs ${
                    selectedUpt !== 'Semua'
                      ? 'bg-emerald-50 text-emerald-950 border-emerald-400 ring-2 ring-emerald-400/20'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-300'
                  }`}
                  title="Klik untuk mencari dan memfilter nama UPT sekolah"
                >
                  <Building className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="font-extrabold max-w-[180px] sm:max-w-[240px] truncate">
                    {selectedUpt === 'Semua'
                      ? `Filter UPT: Semua (${uniqueUptsWithInputs.length > 0 ? `${uniqueUptsWithInputs.length} Berinputan` : `${allUptsCatalog.length} Sekolah`})`
                      : selectedUpt}
                  </span>
                  <Search className="w-3 h-3 text-emerald-600" />
                  <ChevronDown
                    className={`w-3 h-3 text-slate-500 transition-transform ${
                      isUptModalOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* MODAL / DROPDOWN PENCARIAN UPT */}
                {isUptModalOpen && (
                  <div className="absolute left-0 mt-2 w-72 sm:w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-3 text-xs space-y-2 animate-fadeIn">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                      <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Filter Nama UPT Sekolah</span>
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        {filteredUptOptions.length} Sekolah
                      </span>
                    </div>

                    {/* Mode Tab: Semua UPT vs UPT Berinputan */}
                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setUptFilterMode('all')}
                        className={`flex-1 py-1 rounded font-bold transition-all cursor-pointer ${
                          uptFilterMode === 'all'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Semua UPT ({allUptsCatalog.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setUptFilterMode('with_input')}
                        className={`flex-1 py-1 rounded font-bold transition-all cursor-pointer ${
                          uptFilterMode === 'with_input'
                            ? 'bg-white text-emerald-800 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        UPT Berinputan ({uniqueUptsWithInputs.length})
                      </button>
                    </div>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        ref={uptSearchFieldRef}
                        type="text"
                        value={uptSearchInput}
                        onChange={(e) => setUptSearchInput(e.target.value)}
                        placeholder="Ketik & cari nama UPT (misal: SMPN 10 Touluaan)..."
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-7 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      {uptSearchInput && (
                        <button
                          type="button"
                          onClick={() => setUptSearchInput('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedUpt('Semua');
                          setIsUptModalOpen(false);
                          setUptSearchInput('');
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                          selectedUpt === 'Semua'
                            ? 'bg-emerald-600 text-white font-bold'
                            : 'hover:bg-slate-100 text-slate-800'
                        }`}
                      >
                        <span className="font-bold">Semua UPT Sekolah ({expenses.length} input)</span>
                        {selectedUpt === 'Semua' && <Check className="w-3.5 h-3.5 text-white" />}
                      </button>

                      {filteredUptOptions.map(({ name, count }) => {
                        const isSelected = normalizeUptKey(selectedUpt) === normalizeUptKey(name);
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => {
                              setSelectedUpt(name);
                              setIsUptModalOpen(false);
                              setUptSearchInput('');
                            }}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-600 text-white font-bold'
                                : 'hover:bg-slate-100 text-slate-800'
                            }`}
                          >
                            <span className="truncate">{name}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ml-2 shrink-0 ${
                              isSelected ? 'bg-emerald-700 text-white' : count > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {count} input
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-500">
                      <span>{selectedUpt === 'Semua' ? 'Aktif: Semua UPT' : `Aktif: ${selectedUpt}`}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedUpt('Semua');
                          setIsUptModalOpen(false);
                        }}
                        className="text-rose-600 hover:underline font-bold cursor-pointer"
                      >
                        Reset Filter
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* === TOMBOL CHEK BUTTON PER TW (PERSIS SEPERTI DI BERITA ACARA REKON PERSEDIAAN) === */}
            <div ref={twComboRef} className="relative">
              <button
                type="button"
                onClick={() => setIsTwComboOpen((prev) => !prev)}
                className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-xs ${
                  selectedQuarters.length === ALL_QUARTERS.length
                    ? 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-300'
                    : 'bg-emerald-50 text-emerald-950 border-emerald-400 ring-2 ring-emerald-400/20'
                }`}
                title="Centang filter per TW (TW1, TW2, TW3, TW4)"
              >
                <CheckSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate font-extrabold">{twComboButtonLabel}</span>
                <span className="text-[10px] font-bold px-1 rounded bg-slate-200 text-slate-700">
                  {selectedQuarters.length}/4
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-500 transition-transform ${
                    isTwComboOpen ? 'rotate-180 text-emerald-600' : ''
                  }`}
                />
              </button>

              {/* DROPDOWN MENU CENTANG TW */}
              {isTwComboOpen && (
                <div className="absolute left-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-2.5 text-xs space-y-1 animate-fadeIn">
                  <div className="px-2 pb-1.5 mb-1 border-b border-slate-100 flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                      Centang Filter Triwulan
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      {selectedQuarters.length}/4 dipilih
                    </span>
                  </div>

                  <label className="flex items-center justify-between px-2.5 py-1.5 hover:bg-emerald-50/70 rounded-lg cursor-pointer select-none border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedQuarters.length === ALL_QUARTERS.length}
                        onChange={toggleAllQuarters}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="font-extrabold text-slate-900">Semua Triwulan (TW1 - TW4)</span>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {expenses.length} input
                    </span>
                  </label>

                  <div className="py-1 space-y-0.5">
                    {ALL_QUARTERS.map((q) => {
                      const isChecked = selectedQuarters.includes(q.id);
                      const countInTw = expenses.filter((e) => e.triwulan === q.id).length;
                      return (
                        <label
                          key={q.id}
                          className={`flex items-center justify-between px-2.5 py-1.5 hover:bg-slate-50 rounded-lg cursor-pointer select-none transition-colors ${
                            isChecked ? 'bg-emerald-50/40' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleQuarter(q.id)}
                              className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                            <div>
                              <div className={`font-bold ${isChecked ? 'text-emerald-950' : 'text-slate-700'}`}>
                                {q.label}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Periode {q.period}
                              </div>
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            countInTw > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
                          }`}>
                            {countInTw}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Chips for TW */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              {ALL_QUARTERS.map((q) => {
                const isChecked = selectedQuarters.includes(q.id);
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => toggleQuarter(q.id)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold transition-all cursor-pointer ${
                      isChecked
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    {isChecked ? (
                      <CheckSquare className="w-3 h-3 text-white" />
                    ) : (
                      <Square className="w-3 h-3 text-slate-400" />
                    )}
                    <span>{q.id}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status & Sorting Controls */}
          <div className="flex items-center gap-2 flex-wrap ml-auto">
            {/* Status SPJ Filter */}
            <div className="flex items-center gap-1">
              <span className="text-slate-400">Status:</span>
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                aria-label="Filter status verifikasi"
              >
                <option value="Semua">Semua Status</option>
                <option value="Draf">Draf</option>
                <option value="Menunggu Verifikasi">Menunggu</option>
                <option value="Diverifikasi Bendahara">Diverifikasi</option>
                <option value="Disetujui Kepala Sekolah">Disetujui</option>
              </select>
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                aria-label="Urutan belanja"
              >
                <option value="date-desc">Tanggal Terbaru</option>
                <option value="date-asc">Tanggal Terlama</option>
                <option value="amount-desc">Saldo Akhir Tertinggi</option>
                <option value="amount-asc">Saldo Akhir Terendah</option>
              </select>
            </div>
          </div>
        </div>

        {/* Filter Summary Banner */}
        <div className="bg-emerald-50/70 border border-emerald-100 rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-950">
          <div className="flex items-center gap-2 flex-wrap">
            <span>Filter Aktif: </span>
            {selectedUpt !== 'Semua' && (
              <span className="font-bold text-emerald-900 bg-white px-2 py-0.5 rounded border border-emerald-300">
                UPT: {selectedUpt}
              </span>
            )}
            <strong className="text-emerald-800">
              Periode: {selectedQuarters.length === 0 ? 'Tidak Ada' : formatCombinedQuarterLabel(selectedQuarters)}
            </strong>
            {selectedQuarters.length > 1 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-[10px]">
                Digabung Menjadi 1 Laporan per UPT
              </span>
            )}
            {searchQuery && (
              <span className="text-slate-600">
                (Kata kunci: "{searchQuery}")
              </span>
            )}
          </div>
          <div>
            <span>Total Nilai Saldo Akhir Gabungan: </span>
            <strong className="text-sm font-black text-emerald-800">
              {formatRupiah(filteredTotalSaldoAkhir)}
            </strong>
          </div>
        </div>
      </div>

      {/* Main Content: Deck View vs Table View + Lampiran Tabel Gabungan */}
      {filteredExpenses.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 mb-1">
            Tidak ditemukan transaksi belanja
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
            Tidak ada transaksi belanja yang sesuai dengan filter atau kata kunci pencarian Anda.
          </p>
          <button
            onClick={() => {
              onQuarterFilterChange(['TW1', 'TW2', 'TW3', 'TW4']);
              setSelectedUpt('Semua');
              onSearchChange('');
              setSelectedComponentFilter('Semua');
              setSelectedStatusFilter('Semua');
            }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Reset Semua Filter
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {viewMode === 'deck' ? (
            /* Card Deck View (1 Card Gabungan per UPT ketika >1 TW dicentang) */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredExpenses.map((expense) => {
                const saldoAkhir = getExpenseSaldoAkhir(expense);
                const isApproved = expense.status === 'Disetujui Kepala Sekolah';

                return (
                  <div
                    key={expense.id}
                    className="bg-white rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all p-4 flex flex-col justify-between space-y-3"
                  >
                    {/* Header card: School, Date, TW badge (misal TW 1 - TW 2), and Status */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-500">{expense.tanggal}</span>
                        <div className="flex items-center gap-1.5">
                          {getQuarterBadge(expense.triwulan, expense.combinedQuarterLabel)}
                          {getStatusBadge(expense.status)}
                        </div>
                      </div>

                      {/* School Name Badge */}
                      {expense.schoolName && (
                        <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 mt-1">
                          <div className="flex items-center gap-1 truncate">
                            <Building className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span className="truncate">{expense.schoolName}</span>
                          </div>
                          {expense.mergedCount && expense.mergedCount > 1 && (
                            <span className="shrink-0 text-[10px] font-black bg-emerald-700 text-white px-1.5 py-0.2 rounded">
                              Gabungan {expense.combinedQuarterLabel}
                            </span>
                          )}
                        </div>
                      )}

                      <h3
                        onClick={() => onSelectExpense(expense)}
                        className="text-sm font-bold text-slate-900 hover:text-emerald-700 cursor-pointer line-clamp-2 mt-1"
                        title={expense.uraian}
                      >
                        {expense.uraian}
                      </h3>
                    </div>

                    {/* Body details: Ringkasan Nilai Gabungan */}
                    <div className="text-xs space-y-1.5 pt-2 border-t border-slate-100 text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Periode Laporan:</span>
                        <span className="font-extrabold text-emerald-800">
                          {expense.combinedQuarterLabel || expense.triwulan}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Belanja Masuk (LRA + Saldo Awal):</span>
                        <span className="font-semibold text-slate-800">
                          {formatRupiah(expense.nilaiMasuk ?? expense.subtotal ?? 0)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Total Pengeluaran:</span>
                        <span className="font-semibold text-slate-700">
                          {formatRupiah(expense.nilaiKeluar ?? 0)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        <span className="font-bold text-slate-700">Saldo Akhir Gabungan:</span>
                        <span className="font-black text-emerald-700 text-sm">
                          {formatRupiah(saldoAkhir)}
                        </span>
                      </div>
                    </div>

                    {/* Footer action buttons */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1 text-xs">
                      <div className="flex items-center gap-1">
                        {/* Approve button for Admin */}
                        {isAdmin && !isApproved && onApproveExpense && (
                          <button
                            type="button"
                            onClick={() => onApproveExpense(expense.id, expense.sourceExpenseIds)}
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors cursor-pointer"
                            title="Approve Laporan Ini"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {(!isApproved || isAdmin) ? (
                          <button
                            onClick={() => onEditExpense(expense)}
                            className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Edit Data Belanja"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="p-1.5 text-slate-400 cursor-not-allowed" title="Terkunci (Sudah Diapprove)">
                            <Lock className="w-3.5 h-3.5" />
                          </span>
                        )}

                        <button
                          onClick={() => onPrintReceipt(expense)}
                          className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Cetak Berita Acara Rekon / Lampiran Gabungan"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>

                        {(!isApproved || isAdmin) ? (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(expense)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Data Belanja"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="p-1.5 text-slate-400 cursor-not-allowed" title="Terkunci (Sudah Disetujui Admin)">
                            <Lock className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => onSelectExpense(expense)}
                        className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                      >
                        Lihat Lampiran ({expense.combinedQuarterLabel || expense.triwulan}) →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Spreadsheet Table View */
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-3">Tanggal & Periode TW</th>
                      <th className="py-3 px-3">Nama UPT</th>
                      <th className="py-3 px-3">No. Bukti / Laporan</th>
                      <th className="py-3 px-3">Uraian Jenis Persediaan</th>
                      <th className="py-3 px-3 text-right">Belanja Masuk</th>
                      <th className="py-3 px-3 text-right">Pengeluaran</th>
                      <th className="py-3 px-3 text-right">Saldo Akhir</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredExpenses.map((expense) => {
                      const saldoAkhir = getExpenseSaldoAkhir(expense);
                      const isApproved = expense.status === 'Disetujui Kepala Sekolah';

                      return (
                        <tr key={expense.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="font-medium text-slate-900">{expense.tanggal}</div>
                            <div className="mt-0.5">{getQuarterBadge(expense.triwulan, expense.combinedQuarterLabel)}</div>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="font-bold text-slate-800 flex items-center gap-1">
                              <Building className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span className="truncate max-w-[170px]">{expense.schoolName || '-'}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono font-medium text-slate-700 whitespace-nowrap">
                            {expense.noBukti}
                          </td>
                          <td className="py-3 px-3 max-w-xs">
                            <div
                              onClick={() => onSelectExpense(expense)}
                              className="font-semibold text-slate-900 hover:text-emerald-700 cursor-pointer line-clamp-2"
                            >
                              {expense.uraian}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-semibold text-slate-800 whitespace-nowrap">
                            {formatRupiah(expense.nilaiMasuk ?? expense.subtotal ?? 0)}
                          </td>
                          <td className="py-3 px-3 text-right font-semibold text-slate-700 whitespace-nowrap">
                            {formatRupiah(expense.nilaiKeluar ?? 0)}
                          </td>
                          <td className="py-3 px-3 text-right font-black text-emerald-800 whitespace-nowrap">
                            {formatRupiah(saldoAkhir)}
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            {getStatusBadge(expense.status)}
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              {isAdmin && !isApproved && onApproveExpense && (
                                <button
                                  type="button"
                                  onClick={() => onApproveExpense(expense.id, expense.sourceExpenseIds)}
                                  className="p-1.5 text-emerald-700 hover:bg-emerald-100 rounded transition-colors cursor-pointer"
                                  title="Approve Laporan Ini"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {(!isApproved || isAdmin) ? (
                                <button
                                  onClick={() => onEditExpense(expense)}
                                  className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                  title="Edit Data Belanja"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <span className="p-1.5 text-slate-400 cursor-not-allowed" title="Terkunci">
                                  <Lock className="w-3.5 h-3.5" />
                                </span>
                              )}
                              <button
                                onClick={() => onPrintReceipt(expense)}
                                className="p-1.5 text-slate-600 hover:text-indigo-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                title="Cetak Berita Acara Rekon / Lampiran"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              {(!isApproved || isAdmin) ? (
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(expense)}
                                  className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                  title="Hapus Data Belanja"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <span className="p-1.5 text-slate-400 cursor-not-allowed" title="Terkunci (Sudah Disetujui Admin)">
                                  <Lock className="w-3.5 h-3.5" />
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}



      {/* Modal Konfirmasi Hapus Satu Belanja */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Hapus Data Belanja?
                </h3>
                <p className="text-xs text-slate-500">
                  Tindakan ini akan menghapus data belanja ini dari daftar transaksi.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Periode:</span>
                <span className="font-bold text-slate-800">
                  {deleteTarget.combinedQuarterLabel || deleteTarget.triwulan} ({deleteTarget.tanggal})
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Total Saldo Akhir:</span>
                <span className="font-extrabold text-emerald-700">{formatRupiah(getExpenseSaldoAkhir(deleteTarget))}</span>
              </div>
              {deleteTarget.uraian && (
                <div className="pt-2 border-t border-slate-200 text-slate-700">
                  <span className="text-slate-500 block text-[11px] mb-0.5">Uraian:</span>
                  <span className="font-medium">{deleteTarget.uraian}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const idToDelete = deleteTarget.id;
                  const sourceIds = deleteTarget.sourceExpenseIds;
                  setDeleteTarget(null);
                  onDeleteExpense(idToDelete, sourceIds);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Data</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Semua Data Belanja */}
      {clearAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-rose-200 max-w-md w-full p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-rose-900">
                  Hapus Semua Data Belanja?
                </h3>
                <p className="text-xs text-slate-500">
                  Seluruh data transaksi belanja yang ada akan dikosongkan secara permanen.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-rose-50 p-3 rounded-xl border border-rose-100">
              Apakah Anda yakin ingin menghapus seluruh data belanja sekolah? Data yang sudah dihapus tidak dapat dipulihkan kembali.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setClearAllModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setClearAllModalOpen(false);
                  if (onClearAllExpenses) onClearAllExpenses();
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Semua Data</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
