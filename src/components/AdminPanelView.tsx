import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  FileText,
  Edit,
  Trash2,
  Printer,
  Search,
  Download,
  FileSpreadsheet,
  CheckSquare,
  Square,
  AlertCircle,
  Eye,
  Building,
  Tag,
  ArrowUpDown,
  Check,
  ChevronDown,
  LayoutList,
  Table as TableIcon,
  X,
  School,
  Sparkles,
  PackagePlus,
} from 'lucide-react';
import { SchoolExpense, SchoolInfo, Triwulan, ExpenseStatus, BarangEkstraItem } from '../types';
import { UserProfile } from '../types/auth';
import {
  formatRupiah,
  consolidateExpensesBySchoolAndQuarters,
  formatCombinedQuarterLabel,
  buildMergedPersediaanTableRows,
  filterExpenseByQuarters,
} from '../utils/budgetCalculations';
import { exportExpensesToCSV } from '../utils/storage';
import { loadUptSchools, normalizeUptKey } from '../data/schoolData';

interface AdminPanelViewProps {
  schoolInfo: SchoolInfo;
  currentUser: UserProfile;
  expenses: SchoolExpense[];
  barangEkstraItems?: BarangEkstraItem[];
  onApproveExpense: (id: string, sourceIds?: string[]) => void;
  onBulkApproveExpenses: (ids: string[]) => void;
  onUpdateStatus: (id: string, newStatus: ExpenseStatus, sourceIds?: string[]) => void;
  onEditExpense: (exp: SchoolExpense) => void;
  onDeleteExpense: (id: string, sourceIds?: string[]) => void;
  onSelectExpense: (exp: SchoolExpense) => void;
  onPrintReceipt?: (exp: SchoolExpense) => void;
  onOpenGoogleSheets: () => void;
  onClearAllExpenses?: () => void;
  onSaveBarangEkstra?: (item: BarangEkstraItem) => void;
  onDeleteBarangEkstra?: (id: string) => void;
  onUpdateBarangEkstraStatus?: (id: string, status: ExpenseStatus) => void;
  onOpenDatabaseSpreadsheet?: () => void;
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

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({
  schoolInfo,
  currentUser,
  expenses,
  barangEkstraItems = [],
  onApproveExpense,
  onBulkApproveExpenses,
  onUpdateStatus,
  onEditExpense,
  onDeleteExpense,
  onSelectExpense,
  onPrintReceipt,
  onOpenGoogleSheets,
  onClearAllExpenses,
  onSaveBarangEkstra,
  onDeleteBarangEkstra,
  onUpdateBarangEkstraStatus,
  onOpenDatabaseSpreadsheet,
}) => {
  const [adminSection, setAdminSection] = useState<'belanja' | 'barang_ekstra'>('belanja');

  // View mode: Table vs Deck/Card
  const [viewMode, setViewMode] = useState<'table' | 'deck'>('table');

  // Status Filter: all | pending | approved | draft
  const [statusTab, setStatusTab] = useState<'all' | 'pending' | 'approved' | 'draft'>('all');

  // Check Buttons per Triwulan (seperti di Berita Acara Rekon Persediaan)
  const [selectedQuarters, setSelectedQuarters] = useState<Triwulan[]>([
    'TW1',
    'TW2',
    'TW3',
    'TW4',
  ]);
  const [isTwComboOpen, setIsTwComboOpen] = useState<boolean>(false);
  const twComboRef = useRef<HTMLDivElement>(null);

  // Searchable UPT Filter
  const [selectedUpt, setSelectedUpt] = useState<string>('Semua');
  const [uptSearchInput, setUptSearchInput] = useState<string>('');
  const [isUptModalOpen, setIsUptModalOpen] = useState<boolean>(false);
  const [uptFilterMode, setUptFilterMode] = useState<'all' | 'with_input'>('all');
  const uptContainerRef = useRef<HTMLDivElement>(null);
  const uptSearchFieldRef = useRef<HTMLInputElement>(null);

  // Barang Ekstra UPT & Year Filter state
  const [barangEkstraUptFilter, setBarangEkstraUptFilter] = useState<string>('Semua');
  const [barangEkstraTahunFilter, setBarangEkstraTahunFilter] = useState<string>('all');
  const [isBeUptModalOpen, setIsBeUptModalOpen] = useState<boolean>(false);
  const [beUptSearchInput, setBeUptSearchInput] = useState<string>('');
  const beUptContainerRef = useRef<HTMLDivElement>(null);
  const beUptSearchFieldRef = useRef<HTMLInputElement>(null);

  const beAvailableUpts = useMemo(() => {
    const setUpt = new Set<string>();
    barangEkstraItems.forEach(i => {
      const name =
        i.schoolName === 'DINAS PENDIDIKAN KAB. MINAHASA TENGGARA' ||
        i.schoolName === 'DINAS PENDIDIKAN KABUPATEN MINAHASA TENGGARA' ||
        (i.schoolName && i.schoolName.toUpperCase().startsWith('DINAS PENDIDIKAN'))
          ? 'DINAS PENDIDIKAN'
          : i.schoolName;
      if (name) setUpt.add(name);
    });
    return Array.from(setUpt).sort();
  }, [barangEkstraItems]);

  const beFilteredUptOptions = useMemo(() => {
    if (!beUptSearchInput.trim()) return beAvailableUpts;
    const q = beUptSearchInput.trim().toLowerCase();
    return beAvailableUpts.filter(u => u.toLowerCase().includes(q));
  }, [beAvailableUpts, beUptSearchInput]);

  const beAvailableYears = useMemo(() => {
    const yearsSet = new Set<string>();
    barangEkstraItems.forEach(i => {
      if (i.tahunAnggaran) yearsSet.add(String(i.tahunAnggaran));
    });
    yearsSet.add(String(schoolInfo.tahunAnggaran));
    return Array.from(yearsSet).sort().reverse();
  }, [barangEkstraItems, schoolInfo.tahunAnggaran]);

  // Edit Barang Ekstra state & handler
  const [editingBarangEkstra, setEditingBarangEkstra] = useState<BarangEkstraItem | null>(null);
  const [beNamaBarang, setBeNamaBarang] = useState('');
  const [beSpesifikasi, setBeSpesifikasi] = useState('');
  const [beVolume, setBeVolume] = useState<number>(1);
  const [beSatuan, setBeSatuan] = useState('Unit');
  const [beHargaSatuan, setBeHargaSatuan] = useState<number>(0);
  const [beKondisi, setBeKondisi] = useState<'Baik' | 'Kurang Baik' | 'Rusak Berat'>('Baik');
  const [beSumberPerolehan, setBeSumberPerolehan] = useState('BOS Reguler');
  const [beTanggalPerolehan, setBeTanggalPerolehan] = useState(new Date().toISOString().slice(0, 10));
  const [beKeterangan, setBeKeterangan] = useState('');

  const handleOpenEditBarangEkstra = (item: BarangEkstraItem) => {
    if (item.status === 'Disetujui Kepala Sekolah') {
      alert('Barang Ekstra yang sudah di-approve (disetujui) tidak dapat di-edit.');
      return;
    }
    setEditingBarangEkstra(item);
    setBeNamaBarang(item.namaBarang);
    setBeSpesifikasi(item.spesifikasi || '');
    setBeVolume(item.volume);
    setBeSatuan(item.satuan);
    setBeHargaSatuan(item.hargaSatuan);
    setBeKondisi(item.kondisi);
    setBeSumberPerolehan(item.sumberPerolehan);
    setBeTanggalPerolehan(item.tanggalPerolehan || new Date().toISOString().slice(0, 10));
    setBeKeterangan(item.keterangan || '');
  };

  const handleSaveEditedBarangEkstra = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBarangEkstra || !onSaveBarangEkstra) return;
    if (editingBarangEkstra.status === 'Disetujui Kepala Sekolah') {
      alert('Barang Ekstra yang sudah di-approve (disetujui) tidak dapat di-edit.');
      setEditingBarangEkstra(null);
      return;
    }
    const totalHarga = Number(beVolume) * Number(beHargaSatuan);
    const resolvedSchool =
      editingBarangEkstra.schoolName === 'DINAS PENDIDIKAN KAB. MINAHASA TENGGARA' ||
      editingBarangEkstra.schoolName === 'DINAS PENDIDIKAN KABUPATEN MINAHASA TENGGARA' ||
      (editingBarangEkstra.schoolName && editingBarangEkstra.schoolName.toUpperCase().startsWith('DINAS PENDIDIKAN'))
        ? 'DINAS PENDIDIKAN'
        : editingBarangEkstra.schoolName;
    const updatedItem: BarangEkstraItem = {
      ...editingBarangEkstra,
      schoolName: resolvedSchool,
      namaBarang: beNamaBarang.trim(),
      spesifikasi: beSpesifikasi.trim(),
      volume: Number(beVolume) || 1,
      satuan: beSatuan.trim() || 'Unit',
      hargaSatuan: Number(beHargaSatuan) || 0,
      totalHarga,
      kondisi: beKondisi,
      sumberPerolehan: beSumberPerolehan,
      tanggalPerolehan: beTanggalPerolehan,
      keterangan: beKeterangan.trim(),
    };
    onSaveBarangEkstra(updatedItem);
    setEditingBarangEkstra(null);
  };

  // Global Table Search Query & Sorting
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');

  // Filtered Barang Ekstra List for Admin Table
  const filteredBarangEkstraItems = useMemo(() => {
    return barangEkstraItems.map((item) => {
      if (
        item.schoolName === 'DINAS PENDIDIKAN KAB. MINAHASA TENGGARA' ||
        item.schoolName === 'DINAS PENDIDIKAN KABUPATEN MINAHASA TENGGARA' ||
        (item.schoolName && item.schoolName.toUpperCase().startsWith('DINAS PENDIDIKAN'))
      ) {
        return { ...item, schoolName: 'DINAS PENDIDIKAN' };
      }
      return item;
    }).filter((item) => {
      if (statusTab === 'pending' && item.status === 'Disetujui Kepala Sekolah') return false;
      if (statusTab === 'approved' && item.status !== 'Disetujui Kepala Sekolah') return false;
      if (barangEkstraUptFilter !== 'Semua' && item.schoolName !== barangEkstraUptFilter) return false;
      if (barangEkstraTahunFilter !== 'all' && String(item.tahunAnggaran) !== barangEkstraTahunFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.namaBarang.toLowerCase().includes(q);
        const matchSpec = (item.spesifikasi || '').toLowerCase().includes(q);
        const matchSchool = (item.schoolName || '').toLowerCase().includes(q);
        if (!matchName && !matchSpec && !matchSchool) return false;
      }
      return true;
    });
  }, [barangEkstraItems, statusTab, barangEkstraUptFilter, barangEkstraTahunFilter, searchQuery]);

  // Total Nilai Barang Ekstra: HANYA MENAMPILKAN NILAI BARANG YANG SUDAH DI-APPROVE
  const totalApprovedBarangEkstra = useMemo(() => {
    return barangEkstraItems
      .map((item) => {
        if (
          item.schoolName === 'DINAS PENDIDIKAN KAB. MINAHASA TENGGARA' ||
          item.schoolName === 'DINAS PENDIDIKAN KABUPATEN MINAHASA TENGGARA' ||
          (item.schoolName && item.schoolName.toUpperCase().startsWith('DINAS PENDIDIKAN'))
        ) {
          return { ...item, schoolName: 'DINAS PENDIDIKAN' };
        }
        return item;
      })
      .filter((item) => {
        // Wajib sudah di-approve
        if (item.status !== 'Disetujui Kepala Sekolah') return false;
        // Filter UPT jika dipilih
        if (barangEkstraUptFilter !== 'Semua' && item.schoolName !== barangEkstraUptFilter) return false;
        // Filter Tahun jika dipilih
        if (barangEkstraTahunFilter !== 'all' && String(item.tahunAnggaran) !== barangEkstraTahunFilter) return false;
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = item.namaBarang.toLowerCase().includes(q);
          const matchSpec = (item.spesifikasi || '').toLowerCase().includes(q);
          const matchSchool = (item.schoolName || '').toLowerCase().includes(q);
          if (!matchName && !matchSpec && !matchSchool) return false;
        }
        return true;
      })
      .reduce((acc, i) => acc + (i.totalHarga || 0), 0);
  }, [barangEkstraItems, barangEkstraUptFilter, barangEkstraTahunFilter, searchQuery]);

  // Selection & Modals
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<SchoolExpense | null>(null);
  const [deleteTargetBarangEkstra, setDeleteTargetBarangEkstra] = useState<BarangEkstraItem | null>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (twComboRef.current && !twComboRef.current.contains(event.target as Node)) {
        setIsTwComboOpen(false);
      }
      if (uptContainerRef.current && !uptContainerRef.current.contains(event.target as Node)) {
        setIsUptModalOpen(false);
      }
      if (beUptContainerRef.current && !beUptContainerRef.current.contains(event.target as Node)) {
        setIsBeUptModalOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Summary metrics across all school inputs
  const stats = useMemo(() => {
    const totalBruto = expenses.reduce((sum, e) => sum + e.subtotal, 0);
    const pendingItems = expenses.filter((e) => e.status !== 'Disetujui Kepala Sekolah');
    const approvedItems = expenses.filter((e) => e.status === 'Disetujui Kepala Sekolah');
    const draftItems = expenses.filter((e) => e.status === 'Draf');

    const pendingTotal = pendingItems.reduce((sum, e) => sum + e.subtotal, 0);
    const approvedTotal = approvedItems.reduce((sum, e) => sum + e.subtotal, 0);
    const approvalRate = expenses.length > 0 ? Math.round((approvedItems.length / expenses.length) * 100) : 0;

    return {
      totalCount: expenses.length,
      totalBruto,
      pendingCount: pendingItems.length,
      pendingTotal,
      pendingIds: pendingItems.map((i) => i.id),
      approvedCount: approvedItems.length,
      approvedTotal,
      draftCount: draftItems.length,
      approvalRate,
    };
  }, [expenses]);

  // Master UPT schools list
  const masterSchools = useMemo(() => {
    return loadUptSchools();
  }, [schoolInfo, expenses]);

  // Aggregate UPT schools with input data and merge with catalog
  const { uptsWithInputs, allUptsCatalog } = useMemo(() => {
    const map = new Map<string, { displayName: string; count: number; total: number }>();
    expenses.forEach((e) => {
      const uptName = (e.schoolName || schoolInfo.namaSekolah || '').trim();
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

    // Combine with master schools so Admin can search any UPT
    const seen = new Set(withInputs.map((u) => normalizeUptKey(u.name)));
    const catalog = [...withInputs];

    masterSchools.forEach((s) => {
      const norm = normalizeUptKey(s.upt);
      if (s.upt && !seen.has(norm) && norm !== 'DINAS PENDIDIKAN') {
        seen.add(norm);
        catalog.push({
          name: s.upt,
          count: 0,
          total: 0,
          hasInput: false,
        });
      }
    });

    return { uptsWithInputs: withInputs, allUptsCatalog: catalog };
  }, [expenses, schoolInfo.namaSekolah, masterSchools]);

  // Search filtered UPT options (supports "SMPN 10 TOULUAAN" -> "SMP NEGERI 10 TOULUAAN")
  const filteredUptOptions = useMemo(() => {
    let source = allUptsCatalog;
    if (uptFilterMode === 'with_input' && uptsWithInputs.length > 0) {
      source = uptsWithInputs;
    }

    if (!uptSearchInput.trim()) return source;
    const q = uptSearchInput.trim().toLowerCase();
    const normQ = normalizeUptKey(uptSearchInput).toLowerCase();
    return allUptsCatalog.filter((u) => {
      const nameLower = u.name.toLowerCase();
      const normNameLower = normalizeUptKey(u.name).toLowerCase();
      return nameLower.includes(q) || normNameLower.includes(q) || (normQ && normNameLower.includes(normQ));
    });
  }, [allUptsCatalog, uptsWithInputs, uptSearchInput, uptFilterMode]);

  // Multi-select TW toggle helper (matches Berita Acara Rekon Persediaan)
  const toggleQuarter = (tw: Triwulan) => {
    setSelectedQuarters((prev) => {
      const exists = prev.includes(tw);
      const next = exists ? prev.filter((q) => q !== tw) : [...prev, tw];
      return ALL_QUARTERS.map((q) => q.id).filter((id) => next.includes(id));
    });
  };

  const toggleAllQuarters = () => {
    setSelectedQuarters((prev) =>
      prev.length === ALL_QUARTERS.length ? [] : ALL_QUARTERS.map((q) => q.id)
    );
  };

  // Combo button label for TW check button
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

  // Filtered & Consolidated list for Admin table:
  // Jika dicentang lebih dari 1 TW (misal TW 1 dan TW 2), seluruh transaksi milik UPT yang sama
  // otomatis digabung menjadi 1 Laporan Gabungan (TW 1 - TW 2) beserta nilai tabelnya.
  const filteredExpenses = useMemo(() => {
    if (selectedQuarters.length === 0) return [];
    const rawFiltered: SchoolExpense[] = [];

    for (const rawItem of expenses) {
      // Status Filter
      if (statusTab === 'pending' && rawItem.status === 'Disetujui Kepala Sekolah') continue;
      if (statusTab === 'approved' && rawItem.status !== 'Disetujui Kepala Sekolah') continue;
      if (statusTab === 'draft' && rawItem.status !== 'Draf') continue;

      // Triwulan Multi-Check Filter (untuk Pemeliharaan berdasarkan Tanggal rincian)
      const item = filterExpenseByQuarters(rawItem, selectedQuarters);
      if (!item) continue;

      // UPT School Filter (supports normalized matching e.g. SMPN 10 TOULUAAN == SMP NEGERI 10 TOULUAAN)
      const itemUpt = (item.schoolName || schoolInfo.namaSekolah || '').trim();
      if (
        selectedUpt !== 'Semua' &&
        itemUpt.toLowerCase() !== selectedUpt.toLowerCase() &&
        normalizeUptKey(itemUpt) !== normalizeUptKey(selectedUpt)
      ) {
        continue;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const normQ = normalizeUptKey(searchQuery).toLowerCase();
        const matchNo = item.noBukti.toLowerCase().includes(q);
        const matchUraian = item.uraian.toLowerCase().includes(q);
        const matchToko = item.penerimaToko.toLowerCase().includes(q);
        const matchKomponen = item.komponen.toLowerCase().includes(q);
        const matchRek = item.kodeRekening.toLowerCase().includes(q);
        const matchUpt =
          itemUpt.toLowerCase().includes(q) ||
          normalizeUptKey(itemUpt).toLowerCase().includes(normQ);
        if (!matchNo && !matchUraian && !matchToko && !matchKomponen && !matchRek && !matchUpt) {
          continue;
        }
      }

      rawFiltered.push(item);
    }

    const consolidated = consolidateExpensesBySchoolAndQuarters(
      rawFiltered,
      selectedQuarters,
      schoolInfo.namaSekolah
    );

    return consolidated.sort((a, b) => {
      if (sortBy === 'date-desc') return new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime();
      if (sortBy === 'date-asc') return new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime();
      if (sortBy === 'amount-desc') return b.subtotal - a.subtotal;
      if (sortBy === 'amount-asc') return a.subtotal - b.subtotal;
      return 0;
    });
  }, [expenses, statusTab, selectedQuarters, selectedUpt, schoolInfo.namaSekolah, searchQuery, sortBy]);

  // Selection actions
  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = filteredExpenses.map((e) => e.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds(Array.from(new Set([...selectedIds, ...visibleIds])));
    }
  };

  const handleBulkApproveSelected = () => {
    if (selectedIds.length === 0) return;
    // Resolve underlying sourceExpenseIds for any merged items
    const resolvedIds: string[] = [];
    for (const id of selectedIds) {
      const found = filteredExpenses.find((e) => e.id === id);
      if (found?.sourceExpenseIds && found.sourceExpenseIds.length > 0) {
        resolvedIds.push(...found.sourceExpenseIds);
      } else {
        resolvedIds.push(id);
      }
    }
    onBulkApproveExpenses(Array.from(new Set(resolvedIds)));
    setSelectedIds([]);
  };

  const handleApproveAllPending = () => {
    if (stats.pendingIds.length === 0) return;
    onBulkApproveExpenses(stats.pendingIds);
    setSelectedIds([]);
  };

  const getQuarterBadge = (tw: Triwulan, combinedLabel?: string) => {
    if (combinedLabel && (combinedLabel.includes('-') || combinedLabel.includes('&'))) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-extrabold border bg-emerald-100 text-emerald-900 border-emerald-300 shadow-2xs">
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
      <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold border ${colors[tw]}`}>
        {combinedLabel || tw}
      </span>
    );
  };

  const getStatusBadge = (status: ExpenseStatus) => {
    switch (status) {
      case 'Disetujui Kepala Sekolah':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Approved
          </span>
        );
      case 'Diverifikasi Bendahara':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <Clock className="w-3 h-3 text-blue-600" />
            Diverifikasi
          </span>
        );
      case 'Menunggu Verifikasi':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            Menunggu
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <FileText className="w-3 h-3 text-slate-500" />
            Draf
          </span>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. DISTINCT ADMIN EXECUTIVE COMMAND BANNER */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 rounded-2xl p-5 sm:p-6 text-white shadow-xl border border-slate-800">
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-radial from-emerald-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-400/40 uppercase tracking-widest shadow-xs">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                TAMPILAN KHUSUS ADMIN BOSP
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                Pusat Audit & Persetujuan Belanja Sekolah Minahasa Tenggara
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              <span>Data Belanja Sekolah & Persetujuan SPJ</span>
            </h1>
            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Login sebagai: <strong className="text-white font-bold">{currentUser.name}</strong> (@{currentUser.username}) • Wewenang penuh mengaudit seluruh transaksi belanja persediaan dari seluruh UPT sekolah, melakukan persetujuan (<em>Approve</em>), pengeditan, atau pencetakan berita acara rekon.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {stats.pendingCount > 0 && (
              <button
                type="button"
                onClick={handleApproveAllPending}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer"
                title="Setujui seluruh transaksi yang masih berstatus pending"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Approve Semua Tertunda ({stats.pendingCount})</span>
              </button>
            )}

            {onOpenDatabaseSpreadsheet && (
              <button
                type="button"
                onClick={onOpenDatabaseSpreadsheet}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-400/50 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
                title="Buka / Unduh Database Spreadsheet Master 5 Sheet"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Database Spreadsheet</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenGoogleSheets}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Sinkron Spreadsheet</span>
            </button>

            <button
              type="button"
              onClick={() => exportExpensesToCSV(filteredExpenses)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-xs"
            >
              <Download className="w-4 h-4 text-slate-400" />
              <span>Unduh CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Section Switcher: Inputan Belanja vs Inputan Barang Ekstra */}
      <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs w-fit">
        <button
          type="button"
          onClick={() => {
            setAdminSection('belanja');
            setStatusTab('all');
            setSearchQuery('');
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            adminSection === 'belanja'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <span>1. Inputan Belanja Sekolah ({expenses.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setAdminSection('barang_ekstra');
            setStatusTab('all');
            setSearchQuery('');
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            adminSection === 'barang_ekstra'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <PackagePlus className="w-4 h-4 text-emerald-400" />
          <span>2. Inputan Barang Ekstra ({barangEkstraItems.length})</span>
        </button>
      </div>

      {adminSection === 'barang_ekstra' ? (
        <div className="space-y-4">
          {/* Filter & Search for Barang Ekstra */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setStatusTab('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  statusTab === 'all' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Semua Barang Ekstra ({barangEkstraItems.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusTab('pending')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  statusTab === 'pending' ? 'bg-amber-600 text-white shadow-xs' : 'bg-amber-50 text-amber-900 border border-amber-200'
                }`}
              >
                Perlu Approve ({barangEkstraItems.filter(i => i.status !== 'Disetujui Kepala Sekolah').length})
              </button>
              <button
                type="button"
                onClick={() => setStatusTab('approved')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  statusTab === 'approved' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                }`}
              >
                Sudah Approved ({barangEkstraItems.filter(i => i.status === 'Disetujui Kepala Sekolah').length})
              </button>

              {/* UPT Filter with Search */}
              <div ref={beUptContainerRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsBeUptModalOpen(prev => !prev);
                    setTimeout(() => beUptSearchFieldRef.current?.focus(), 80);
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-xs ${
                    barangEkstraUptFilter !== 'Semua'
                      ? 'bg-emerald-50 text-emerald-950 border-emerald-400 ring-2 ring-emerald-400/20'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
                  }`}
                >
                  <Building className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="truncate max-w-[150px]">
                    {barangEkstraUptFilter === 'Semua' ? 'Semua UPT' : barangEkstraUptFilter}
                  </span>
                  <Search className="w-3 h-3 text-emerald-600" />
                </button>

                {isBeUptModalOpen && (
                  <div className="absolute left-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-3 text-xs space-y-2 animate-fadeIn">
                    <div className="relative mb-2">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        ref={beUptSearchFieldRef}
                        value={beUptSearchInput}
                        onChange={(e) => setBeUptSearchInput(e.target.value)}
                        placeholder="Cari nama UPT..."
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setBarangEkstraUptFilter('Semua');
                          setIsBeUptModalOpen(false);
                          setBeUptSearchInput('');
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl font-medium transition-all cursor-pointer ${
                          barangEkstraUptFilter === 'Semua' ? 'bg-emerald-50 text-emerald-800 font-bold' : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        Semua UPT
                      </button>
                      {beFilteredUptOptions.map((upt) => (
                        <button
                          key={upt}
                          type="button"
                          onClick={() => {
                            setBarangEkstraUptFilter(upt);
                            setIsBeUptModalOpen(false);
                            setBeUptSearchInput('');
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl font-medium transition-all cursor-pointer truncate ${
                            barangEkstraUptFilter === upt ? 'bg-emerald-50 text-emerald-800 font-bold' : 'hover:bg-slate-100 text-slate-700'
                          }`}
                          title={upt}
                        >
                          {upt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Year Filter */}
              <select
                value={barangEkstraTahunFilter}
                onChange={(e) => setBarangEkstraTahunFilter(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="all">Semua Tahun</option>
                {beAvailableYears.map(yr => (
                  <option key={yr} value={yr}>Tahun {yr}</option>
                ))}
              </select>
            </div>

            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama barang..."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Barang Ekstra Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Audit Inputan Barang Ekstra / Non-Persediaan</h3>
                <p className="text-xs text-slate-300">Pemeriksaan dan persetujuan (Approve) barang ekstra dari UPT sekolah</p>
              </div>
              <span 
                className="text-xs font-black bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-lg border border-emerald-400/30"
                title="Hanya mengakumulasi nilai barang ekstra yang sudah disetujui (Approved)"
              >
                Total Nilai: {formatRupiah(totalApprovedBarangEkstra)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[11px]">
                  <tr>
                    <th className="py-3 px-3.5">No</th>
                    <th className="py-3 px-3.5">Sekolah / UPT</th>
                    <th className="py-3 px-3.5">Nama &amp; Spesifikasi Barang</th>
                    <th className="py-3 px-3.5 text-center">Volume</th>
                    <th className="py-3 px-3.5 text-right">Harga Satuan</th>
                    <th className="py-3 px-3.5 text-right">Total Harga</th>
                    <th className="py-3 px-3.5 text-center">Kondisi</th>
                    <th className="py-3 px-3.5 text-center">Status</th>
                    <th className="py-3 px-3.5 text-center">Aksi / Approve</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBarangEkstraItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        Belum ada data Barang Ekstra yang sesuai dengan filter.
                      </td>
                    </tr>
                  ) : (
                    filteredBarangEkstraItems.map((item, idx) => {
                      const isApproved = item.status === 'Disetujui Kepala Sekolah';
                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-3.5 font-bold text-slate-600">{idx + 1}</td>
                          <td className="py-3 px-3.5 font-semibold text-slate-800">{item.schoolName}</td>
                          <td className="py-3 px-3.5">
                            <span className="font-bold text-slate-900 block">{item.namaBarang}</span>
                            {item.spesifikasi && <span className="text-[11px] text-slate-500 block">{item.spesifikasi}</span>}
                          </td>
                          <td className="py-3 px-3.5 text-center font-semibold text-slate-800">{item.volume} {item.satuan}</td>
                          <td className="py-3 px-3.5 text-right font-semibold text-slate-700">{formatRupiah(item.hargaSatuan)}</td>
                          <td className="py-3 px-3.5 text-right font-black text-emerald-800">{formatRupiah(item.totalHarga)}</td>
                          <td className="py-3 px-3.5 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${item.kondisi === 'Baik' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                              {item.kondisi}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            {isApproved ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                                <CheckCircle2 className="w-3 h-3" />
                                Approved
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[11px]">
                                <Clock className="w-3 h-3" />
                                Menunggu
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {/* Tombol Edit: Jika sudah di-approve, maka tidak bisa di-edit */}
                              {isApproved ? (
                                <button
                                  type="button"
                                  disabled
                                  className="p-1.5 bg-slate-100 text-slate-300 rounded-lg cursor-not-allowed opacity-50 transition-all"
                                  title="Barang sudah di-approve, tidak dapat di-edit"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditBarangEkstra(item)}
                                  className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-all cursor-pointer shadow-xs"
                                  title="Edit Barang Ekstra"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Tombol Approve atau Batalkan Approval */}
                              {!isApproved && onUpdateBarangEkstraStatus && (
                                <button
                                  type="button"
                                  onClick={() => onUpdateBarangEkstraStatus(item.id, 'Disetujui Kepala Sekolah')}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1"
                                  title="Setujui (Approve) Barang Ekstra ini"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  <span>Approve</span>
                                </button>
                              )}

                              {isApproved && onUpdateBarangEkstraStatus && (
                                <button
                                  type="button"
                                  onClick={() => onUpdateBarangEkstraStatus(item.id, 'Menunggu Verifikasi')}
                                  className="px-2 py-0.5 text-[10px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded border border-amber-200 transition-colors cursor-pointer"
                                  title="Batalkan approval untuk mengaktifkan kembali tombol edit"
                                >
                                  Batal Approve
                                </button>
                              )}

                              {/* Tombol Hapus: Jika sudah di-approve, maka tidak bisa dihapus */}
                              {isApproved ? (
                                <button
                                  type="button"
                                  disabled
                                  className="p-1.5 bg-slate-100 text-slate-300 rounded-lg cursor-not-allowed opacity-50 transition-all"
                                  title="Barang sudah di-approve, tidak dapat dihapus"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setDeleteTargetBarangEkstra(item)}
                                  className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-all cursor-pointer shadow-xs"
                                  title="Hapus Barang Ekstra"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* 2. ADMIN STATS KPI CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div
          onClick={() => setStatusTab('all')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            statusTab === 'all'
              ? 'bg-white border-slate-900 ring-2 ring-slate-900/15 shadow-md'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold">Total Semua Belanja</span>
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold text-[11px]">
              {selectedQuarters.length === 4 ? 'TW1 - TW4' : selectedQuarters.join('+')}
            </span>
          </div>
          <div className="text-xl font-black text-slate-900">{formatRupiah(stats.totalBruto)}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>{stats.totalCount} transaksi masuk</span>
            <span className="font-semibold text-slate-700">TA {schoolInfo.tahunAnggaran}</span>
          </div>
        </div>

        <div
          onClick={() => setStatusTab('pending')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            statusTab === 'pending'
              ? 'bg-amber-50/70 border-amber-500 ring-2 ring-amber-500/20 shadow-md'
              : 'bg-white border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-amber-800 mb-1">
            <span className="font-bold flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              Menunggu Approve Admin
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-extrabold text-[11px]">
              {stats.pendingCount}
            </span>
          </div>
          <div className="text-xl font-black text-amber-900">{formatRupiah(stats.pendingTotal)}</div>
          <div className="text-[11px] text-amber-700 mt-1">
            Klik untuk meninjau & menyetujui transaksi
          </div>
        </div>

        <div
          onClick={() => setStatusTab('approved')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            statusTab === 'approved'
              ? 'bg-emerald-50/70 border-emerald-600 ring-2 ring-emerald-500/20 shadow-md'
              : 'bg-white border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-emerald-800 mb-1">
            <span className="font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Telah Di-Approve Admin
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-extrabold text-[11px]">
              {stats.approvedCount}
            </span>
          </div>
          <div className="text-xl font-black text-emerald-900">{formatRupiah(stats.approvedTotal)}</div>
          <div className="text-[11px] text-emerald-700 mt-1">
            Progres persetujuan: <strong>{stats.approvalRate}% tervalidasi</strong>
          </div>
        </div>

        <div
          onClick={() => setStatusTab('draft')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            statusTab === 'draft'
              ? 'bg-slate-100 border-slate-600 ring-2 ring-slate-500/20 shadow-md'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
            <span className="font-bold flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              Berstatus Draf
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-bold text-[11px]">
              {stats.draftCount}
            </span>
          </div>
          <div className="text-xl font-black text-slate-800">
            {stats.draftCount} Transaksi
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Dapat langsung disunting atau disetujui Admin
          </div>
        </div>
      </div>

      {/* 3. TOOLBAR CONTROLS: UPT SEARCHABLE BUTTON + TW CHECK BUTTON (SEPERTI BERITA ACARA REKON) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3.5">
        {/* Row 1: Status Tab Pills + View Mode + Global Search */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setStatusTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusTab === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Semua Belanja ({stats.totalCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusTab('pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusTab === 'pending'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              Perlu Approve ({stats.pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusTab('approved')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusTab === 'approved'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              Sudah Approved ({stats.approvedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusTab('draft')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusTab === 'draft'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Draf ({stats.draftCount})
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle: Table vs Card */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-all ${
                  viewMode === 'table'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                aria-label="Tampilan Tabel Audit"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tabel Audit</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('deck')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-all ${
                  viewMode === 'deck'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                aria-label="Tampilan Kartu Verifikasi"
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Kartu Verifikasi</span>
              </button>
            </div>

            {/* Global Search input */}
            <div className="relative min-w-[220px] sm:min-w-[280px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari no bukti, toko, uraian, rekening..."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: SEARCHABLE UPT FILTER BUTTON + TW CHECK BUTTON (SEPERTI BERITA ACARA REKON) */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* === FITUR 1: TOMBOL FILTER NAMA UPT YANG BISA DI CARI === */}
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
                    : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
                }`}
                aria-haspopup="dialog"
                aria-expanded={isUptModalOpen}
                title="Klik untuk membuka jendela pencarian dan filter nama UPT sekolah"
              >
                <div className="p-1 rounded-md bg-emerald-100 text-emerald-700">
                  <Building className="w-3.5 h-3.5" />
                </div>
                <div className="text-left">
                  <div className="text-[10px] text-slate-500 font-medium leading-none">
                    Filter UPT Sekolah
                  </div>
                  <div className="font-extrabold text-slate-900 truncate max-w-[190px] sm:max-w-[260px]">
                    {selectedUpt === 'Semua'
                      ? `Semua UPT (${uptsWithInputs.length > 0 ? `${uptsWithInputs.length} Berinputan` : `${allUptsCatalog.length} Sekolah`})`
                      : selectedUpt}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-1 text-slate-400">
                  <Search className="w-3.5 h-3.5 text-emerald-600" />
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-150 ${
                      isUptModalOpen ? 'rotate-180 text-emerald-600' : ''
                    }`}
                  />
                </div>
              </button>

              {/* POPUP / MODAL PENCARIAN UPT */}
              {isUptModalOpen && (
                <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-3 text-xs space-y-2.5 animate-fadeIn">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                      <Building className="w-4 h-4 text-emerald-600" />
                      <span>Cari & Pilih UPT Sekolah</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      {filteredUptOptions.length} Sekolah
                    </span>
                  </div>

                  {/* Mode Tab: Semua UPT vs UPT Berinputan */}
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setUptFilterMode('all')}
                      className={`flex-1 py-1 rounded font-bold transition-all ${
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
                      className={`flex-1 py-1 rounded font-bold transition-all ${
                        uptFilterMode === 'with_input'
                          ? 'bg-white text-emerald-800 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      UPT Berinputan ({uptsWithInputs.length})
                    </button>
                  </div>

                  {/* Input Pencarian UPT secara Real-time */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      ref={uptSearchFieldRef}
                      type="text"
                      value={uptSearchInput}
                      onChange={(e) => setUptSearchInput(e.target.value)}
                      placeholder="Ketik & cari nama UPT sekolah..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-7 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                      autoFocus
                    />
                    {uptSearchInput && (
                      <button
                        type="button"
                        onClick={() => setUptSearchInput('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Opsi Tampilkan Semua UPT */}
                  <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUpt('Semua');
                        setIsUptModalOpen(false);
                        setUptSearchInput('');
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition-colors cursor-pointer ${
                        selectedUpt === 'Semua'
                          ? 'bg-emerald-600 text-white font-bold shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-800 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Building className="w-4 h-4 shrink-0" />
                        <div>
                          <div className="font-bold">Semua UPT Sekolah</div>
                          <div className={`text-[10px] ${selectedUpt === 'Semua' ? 'text-emerald-100' : 'text-slate-500'}`}>
                            Tampilkan seluruh transaksi tanpa filter sekolah
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {selectedUpt === 'Semua' ? (
                          <Check className="w-4 h-4 text-white" />
                        ) : (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                            {expenses.length} data
                          </span>
                        )}
                      </div>
                    </button>

                    {/* List UPT Hasil Pencarian */}
                    {filteredUptOptions.length === 0 ? (
                      <div className="py-6 text-center text-slate-500 space-y-1">
                        <p className="font-bold text-xs">Tidak ditemukan nama UPT</p>
                        <p className="text-[11px] text-slate-400">
                          Tidak ada sekolah yang cocok dengan "{uptSearchInput}"
                        </p>
                      </div>
                    ) : (
                      filteredUptOptions.map(({ name, count, total, hasInput }) => {
                        const isSelected = selectedUpt.toLowerCase() === name.toLowerCase();
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => {
                              setSelectedUpt(name);
                              setIsUptModalOpen(false);
                              setUptSearchInput('');
                            }}
                            className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-600 text-white font-bold shadow-xs'
                                : hasInput
                                ? 'bg-emerald-50/50 hover:bg-emerald-100/60 text-slate-900 border border-emerald-200/60'
                                : 'hover:bg-slate-100 text-slate-800 border border-transparent hover:border-slate-200'
                            }`}
                          >
                            <div className="truncate flex-1">
                              <div className="font-bold truncate flex items-center gap-1.5">
                                <span className="truncate">{name}</span>
                                {hasInput && (
                                  <span className="shrink-0 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-emerald-600 text-white">
                                    Ada Inputan
                                  </span>
                                )}
                              </div>
                              <div
                                className={`text-[10px] ${
                                  isSelected
                                    ? 'text-emerald-100'
                                    : hasInput
                                    ? 'text-emerald-800 font-medium'
                                    : 'text-slate-400'
                                }`}
                              >
                                {count > 0 ? `${count} transaksi • Total: ${formatRupiah(total)}` : 'Belum ada inputan transaksi'}
                              </div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 shrink-0 text-white" />}
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Footer Modal UPT */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      {selectedUpt === 'Semua' ? 'Aktif: Semua UPT' : `Aktif: ${selectedUpt}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUpt('Semua');
                        setUptSearchInput('');
                        setIsUptModalOpen(false);
                      }}
                      className="text-rose-600 hover:underline font-bold cursor-pointer"
                    >
                      Reset Filter UPT
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* === FITUR 2: TOMBOL CHEK BUTTON PER TW SEPERTI DI BERITA ACARA REKON PERSEDIAAN === */}
            <div ref={twComboRef} className="relative">
              {/* Dropdown Combo Button persis seperti di Berita Acara Rekon */}
              <button
                type="button"
                onClick={() => setIsTwComboOpen((prev) => !prev)}
                className={`flex items-center justify-between gap-2.5 px-3 py-1.5 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-[215px] sm:min-w-[245px] transition-all cursor-pointer shadow-xs ${
                  selectedQuarters.length === 0
                    ? 'bg-rose-50 border-rose-300 text-rose-800'
                    : selectedQuarters.length === ALL_QUARTERS.length
                    ? 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800'
                    : 'bg-emerald-50 hover:bg-emerald-100/70 border-emerald-400 text-emerald-950 ring-2 ring-emerald-400/20'
                }`}
                aria-haspopup="listbox"
                aria-expanded={isTwComboOpen}
                aria-label="Filter Triwulan Data Belanja Admin"
                title="Centang filter per TW (TW1, TW2, TW3, TW4)"
              >
                <span className="flex items-center gap-1.5 truncate">
                  <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="truncate font-extrabold">{twComboButtonLabel}</span>
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                    {selectedQuarters.length}/4
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-150 ${
                      isTwComboOpen ? 'rotate-180 text-emerald-600' : ''
                    }`}
                  />
                </div>
              </button>

              {/* Dropdown Menu Centang Filter Triwulan (Identik dengan Berita Acara Rekon) */}
              {isTwComboOpen && (
                <div
                  className="absolute left-0 mt-2 w-72 sm:w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 py-2.5 px-1 text-xs animate-fadeIn"
                  role="listbox"
                  aria-multiselectable="true"
                >
                  <div className="px-3 pb-2 mb-1 border-b border-slate-100 flex items-center justify-between">
                    <span className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Centang Filter Triwulan</span>
                    </span>
                    <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      {selectedQuarters.length}/4 dipilih
                    </span>
                  </div>

                  {/* Opsi Master: Centang Semua TW */}
                  <label className="flex items-center justify-between px-3 py-2 hover:bg-emerald-50/70 rounded-xl cursor-pointer select-none transition-colors border-b border-slate-100 mx-1">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={selectedQuarters.length === ALL_QUARTERS.length}
                        onChange={toggleAllQuarters}
                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="font-extrabold text-slate-900">
                        Semua Triwulan (TW1 - TW4)
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                      {expenses.length} input
                    </span>
                  </label>

                  {/* Individual TW Checkboxes */}
                  <div className="py-1 divide-y divide-slate-50 px-1">
                    {ALL_QUARTERS.map((q) => {
                      const isChecked = selectedQuarters.includes(q.id);
                      const countInTw = expenses.filter((e) => e.triwulan === q.id).length;
                      return (
                        <label
                          key={q.id}
                          className={`flex items-center justify-between px-3 py-2 hover:bg-slate-50 rounded-xl cursor-pointer select-none transition-colors ${
                            isChecked ? 'bg-emerald-50/40' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleQuarter(q.id)}
                              className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                            <div>
                              <div
                                className={`font-bold ${
                                  isChecked ? 'text-emerald-950' : 'text-slate-700'
                                }`}
                              >
                                {q.label}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Periode {q.period}
                              </div>
                            </div>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              countInTw > 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {countInTw} input
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  {/* Helper Footer inside TW Dropdown */}
                  <div className="px-3 pt-2.5 mt-1 border-t border-slate-100 text-[11px] text-slate-500 leading-snug">
                    {selectedQuarters.length === 0 ? (
                      <span className="text-rose-600 font-bold">
                        ⚠️ Centang minimal 1 TW untuk menampilkan data belanja.
                      </span>
                    ) : selectedQuarters.length === 1 ? (
                      <span>
                        Menampilkan transaksi khusus:{' '}
                        <strong className="text-slate-900 font-bold">{selectedQuarters[0]}</strong>.
                      </span>
                    ) : (
                      <span>
                        Menggabungkan data transaksi:{' '}
                        <strong className="text-emerald-700 font-bold">
                          {selectedQuarters.join(' + ')}
                        </strong>
                        .
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* QUICK TW CHECK-BUTTON CHIPS (1-Click Langsung di Toolbar) */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200">
              {ALL_QUARTERS.map((q) => {
                const isChecked = selectedQuarters.includes(q.id);
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => toggleQuarter(q.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isChecked
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                    title={`Klik untuk toggle centang ${q.id}`}
                  >
                    {isChecked ? (
                      <CheckSquare className="w-3.5 h-3.5 text-white" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <span>{q.id}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1 ml-auto">
            <ArrowUpDown className="w-3 h-3 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              aria-label="Urutan belanja admin"
            >
              <option value="date-desc">Tanggal Terbaru</option>
              <option value="date-asc">Tanggal Terlama</option>
              <option value="amount-desc">Nominal Tertinggi</option>
              <option value="amount-asc">Nominal Terendah</option>
            </select>
          </div>
        </div>

        {/* ACTIVE FILTER SUMMARY BADGES */}
        <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-500 font-medium">Filter Aktif:</span>

            {/* UPT Badge */}
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
              <Building className="w-3 h-3 text-emerald-700" />
              <span>UPT: {selectedUpt === 'Semua' ? 'Semua Sekolah' : selectedUpt}</span>
              {selectedUpt !== 'Semua' && (
                <button
                  type="button"
                  onClick={() => setSelectedUpt('Semua')}
                  className="hover:text-rose-600 ml-0.5 cursor-pointer"
                  title="Batalkan filter UPT ini"
                >
                  ✕
                </button>
              )}
            </span>

            {/* TW Badge */}
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-900 border border-indigo-300">
              <CheckSquare className="w-3 h-3 text-indigo-700" />
              <span>
                TW: {selectedQuarters.length === 4 ? 'Semua (TW1-4)' : selectedQuarters.join(', ') || 'Tidak Ada'}
              </span>
            </span>

            {/* Search query badge */}
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-medium bg-slate-200 text-slate-800">
                <Search className="w-3 h-3 text-slate-500" />
                <span>"{searchQuery}"</span>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="hover:text-rose-600 ml-0.5 cursor-pointer"
                >
                  ✕
                </button>
              </span>
            )}
          </div>

          <div className="text-slate-700 font-medium">
            Ditampilkan: <strong className="text-slate-950 font-black">{filteredExpenses.length}</strong> transaksi • Total:{' '}
            <strong className="text-emerald-800 font-black text-sm">
              {formatRupiah(filteredExpenses.reduce((s, e) => s + e.subtotal, 0))}
            </strong>
          </div>
        </div>

        {/* BULK SELECTION ACTION BAR */}
        {selectedIds.length > 0 && (
          <div className="bg-slate-900 text-white px-4 py-2.5 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs shadow-lg animate-fadeIn border border-slate-700">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-emerald-400" />
              <span className="font-extrabold text-amber-300">
                {selectedIds.length} inputan belanja dipilih
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBulkApproveSelected}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-lg flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Approve Terpilih ({selectedIds.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
              >
                Batal Pilihan
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. MAIN DATA VIEW: TABEL AUDIT vs KARTU VERIFIKASI + LAMPIRAN TABEL GABUNGAN */}
      {filteredExpenses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <Search className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            Tidak Ada Data Belanja yang Sesuai
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
            Tidak ditemukan transaksi belanja sekolah berdasarkan kombinasi filter UPT, Triwulan yang dicentang, atau status yang Anda pilih.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedUpt('Semua');
              setSelectedQuarters(['TW1', 'TW2', 'TW3', 'TW4']);
              setStatusTab('all');
              setSearchQuery('');
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow transition-all cursor-pointer"
          >
            Reset Semua Filter
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {viewMode === 'table' ? (
            /* TABEL AUDIT LENGKAP KHUSUS ADMIN */
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="px-4 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="font-extrabold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>Tabel Audit Belanja Sekolah (Admin BOSP)</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 text-[11px] border border-slate-700">
                    {filteredExpenses.length} Laporan
                  </span>
                </div>
                <div className="text-slate-300">
                  Total Nilai Ditampilkan:{' '}
                  <strong className="text-white font-black">
                    {formatRupiah(filteredExpenses.reduce((s, e) => s + e.subtotal, 0))}
                  </strong>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-extrabold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-3 w-8 text-center">
                        <input
                          type="checkbox"
                          checked={
                            filteredExpenses.length > 0 &&
                            filteredExpenses.every((e) => selectedIds.includes(e.id))
                          }
                          onChange={toggleSelectAllVisible}
                          className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          aria-label="Pilih semua baris"
                        />
                      </th>
                      <th className="py-3 px-3">Nama UPT Sekolah</th>
                      <th className="py-3 px-3">No. Bukti & Tanggal</th>
                      <th className="py-3 px-2 text-center">Periode TW</th>
                      <th className="py-3 px-3">Uraian & Rincian Belanja</th>
                      <th className="py-3 px-3 text-right">Belanja Masuk</th>
                      <th className="py-3 px-3 text-right">Saldo Akhir</th>
                      <th className="py-3 px-3 text-center">Status SPJ</th>
                      <th className="py-3 px-3 text-center">Aksi Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredExpenses.map((exp) => {
                      const isApproved = exp.status === 'Disetujui Kepala Sekolah';
                      const isSelected = selectedIds.includes(exp.id);
                      const expSchool = exp.schoolName || schoolInfo.namaSekolah || 'UPT Sekolah';

                      return (
                        <tr
                          key={exp.id}
                          className={`transition-colors ${
                            isSelected
                              ? 'bg-emerald-50/70'
                              : isApproved
                              ? 'hover:bg-slate-50'
                              : 'bg-amber-50/25 hover:bg-amber-50/50'
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-3.5 px-3 text-center align-top">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectOne(exp.id)}
                              className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer mt-1"
                              aria-label={`Pilih ${exp.noBukti}`}
                            />
                          </td>

                          {/* Nama UPT Sekolah */}
                          <td className="py-3.5 px-3 align-top whitespace-nowrap">
                            <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                              <Building className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="truncate max-w-[180px]" title={expSchool}>
                                {expSchool}
                              </span>
                            </div>
                            {exp.npsn && (
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                NPSN: {exp.npsn}
                              </div>
                            )}
                          </td>

                          {/* No Bukti & Tanggal */}
                          <td className="py-3.5 px-3 align-top whitespace-nowrap">
                            <div className="font-mono font-bold text-slate-900">{exp.noBukti}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">{exp.tanggal}</div>
                          </td>

                          {/* Triwulan */}
                          <td className="py-3.5 px-2 text-center align-top whitespace-nowrap">
                            {getQuarterBadge(exp.triwulan, exp.combinedQuarterLabel)}
                          </td>

                          {/* Uraian & Komponen */}
                          <td className="py-3.5 px-3 align-top max-w-xs">
                            <div
                              onClick={() => onSelectExpense(exp)}
                              className="font-bold text-slate-900 hover:text-emerald-700 cursor-pointer line-clamp-2"
                              title="Klik untuk melihat Lampiran Tabel Gabungan"
                            >
                              {exp.uraian}
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1 truncate">
                              <Tag className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate" title={exp.komponen}>
                                {exp.komponen}
                              </span>
                            </div>
                          </td>

                          {/* Belanja Masuk */}
                          <td className="py-3.5 px-3 text-right align-top whitespace-nowrap">
                            <div className="font-bold text-slate-800 text-xs">
                              {formatRupiah(exp.nilaiMasuk ?? exp.subtotal ?? 0)}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Keluar: {formatRupiah(exp.nilaiKeluar ?? 0)}
                            </div>
                          </td>

                          {/* Saldo Akhir */}
                          <td className="py-3.5 px-3 text-right align-top whitespace-nowrap">
                            <div className="font-black text-emerald-800 text-xs sm:text-sm">
                              {formatRupiah(exp.sisaNilai ?? exp.subtotal ?? 0)}
                            </div>
                          </td>

                          {/* Status SPJ */}
                          <td className="py-3.5 px-3 text-center align-top whitespace-nowrap space-y-1.5">
                            <div>{getStatusBadge(exp.status)}</div>
                            <div>
                              <select
                                value={exp.status}
                                onChange={(e) =>
                                  onUpdateStatus(
                                    exp.id,
                                    e.target.value as ExpenseStatus,
                                    exp.sourceExpenseIds
                                  )
                                }
                                className="bg-white border border-slate-200 rounded px-2 py-0.5 text-[10px] font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                                aria-label={`Ubah status ${exp.noBukti}`}
                              >
                                <option value="Draf">Draf</option>
                                <option value="Menunggu Verifikasi">Menunggu</option>
                                <option value="Diverifikasi Bendahara">Diverifikasi</option>
                                <option value="Disetujui Kepala Sekolah">Disetujui (Approved)</option>
                              </select>
                            </div>
                          </td>

                          {/* Aksi Admin: Approve, Edit, Print, Detail, Delete */}
                          <td className="py-3.5 px-3 text-center align-top whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {/* Tombol Approve Cepat */}
                              {!isApproved ? (
                                <button
                                  type="button"
                                  onClick={() => onApproveExpense(exp.id, exp.sourceExpenseIds)}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold flex items-center gap-1 transition-all shadow-xs cursor-pointer"
                                  title="Setujui (Approve) laporan belanja ini sekarang"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Approve</span>
                                </button>
                              ) : (
                                <span className="px-2 py-0.5 text-[10px] font-bold text-emerald-800 bg-emerald-100 rounded">
                                  Disetujui
                                </span>
                              )}

                              {/* Tombol Edit */}
                              <button
                                type="button"
                                onClick={() => onEditExpense(exp)}
                                className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                title="Edit rincian transaksi belanja ini"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>

                              {/* Tombol Cetak / Berita Acara */}
                              {onPrintReceipt && (
                                <button
                                  type="button"
                                  onClick={() => onPrintReceipt(exp)}
                                  className="p-1.5 text-slate-600 hover:text-indigo-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                  title="Cetak Berita Acara Rekon / Lampiran"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Tombol Detail / Lampiran */}
                              <button
                                type="button"
                                onClick={() => onSelectExpense(exp)}
                                className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                title="Lihat Lampiran Tabel Gabungan"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {/* Tombol Hapus */}
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(exp)}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                title="Hapus transaksi belanja ini"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* KARTU VERIFIKASI DECK KHUSUS ADMIN */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredExpenses.map((exp) => {
                const isApproved = exp.status === 'Disetujui Kepala Sekolah';
                const isSelected = selectedIds.includes(exp.id);
                const expSchool = exp.schoolName || schoolInfo.namaSekolah || 'UPT Sekolah';

                return (
                  <div
                    key={exp.id}
                    className={`bg-white rounded-2xl border p-4 shadow-xs transition-all space-y-3 ${
                      isSelected
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                        : isApproved
                        ? 'border-slate-200'
                        : 'border-amber-300 bg-amber-50/20'
                    }`}
                  >
                    {/* Header Kartu: UPT & Triwulan */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="truncate flex-1">
                        <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 truncate">
                          <Building className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">{expSchool}</span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                          {exp.noBukti} • {exp.tanggal}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {getQuarterBadge(exp.triwulan, exp.combinedQuarterLabel)}
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(exp.id)}
                          className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Uraian Belanja */}
                    <div
                      onClick={() => onSelectExpense(exp)}
                      className="font-bold text-slate-900 text-xs hover:text-emerald-700 cursor-pointer line-clamp-2 min-h-8"
                    >
                      {exp.uraian}
                    </div>

                    {/* Info Nilai Gabungan */}
                    <div className="bg-slate-50 rounded-xl p-2.5 text-[11px] space-y-1 border border-slate-100">
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Periode Laporan:</span>
                        <span className="font-extrabold text-emerald-800">
                          {exp.combinedQuarterLabel || exp.triwulan}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Belanja Masuk:</span>
                        <span className="font-semibold text-slate-800">
                          {formatRupiah(exp.nilaiMasuk ?? exp.subtotal ?? 0)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Total Pengeluaran:</span>
                        <span className="font-semibold text-slate-800">
                          {formatRupiah(exp.nilaiKeluar ?? 0)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-slate-200 text-slate-900">
                        <span className="font-bold">Saldo Akhir:</span>
                        <span className="font-black text-emerald-800 text-sm">
                          {formatRupiah(exp.sisaNilai ?? exp.subtotal ?? 0)}
                        </span>
                      </div>
                    </div>

                    {/* Status & Action Buttons */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div>{getStatusBadge(exp.status)}</div>
                      <div className="flex items-center gap-1">
                        {!isApproved && (
                          <button
                            type="button"
                            onClick={() => onApproveExpense(exp.id, exp.sourceExpenseIds)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onEditExpense(exp)}
                          className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        {onPrintReceipt && (
                          <button
                            type="button"
                            onClick={() => onPrintReceipt(exp)}
                            className="p-1.5 text-slate-600 hover:text-indigo-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Cetak Berita Acara"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(exp)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}
      </>
      )}

      {/* MODAL KONFIRMASI HAPUS TRANSAKSI BELANJA */}
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
                  Tindakan ini akan menghapus transaksi belanja ini dari sistem.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">No. Bukti / Periode:</span>
                <span className="font-bold text-slate-800">
                  {deleteTarget.noBukti} ({deleteTarget.combinedQuarterLabel || deleteTarget.triwulan})
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Sekolah:</span>
                <span className="font-bold text-slate-700">
                  {deleteTarget.schoolName || schoolInfo.namaSekolah}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Total Saldo Akhir:</span>
                <span className="font-extrabold text-emerald-700">
                  {formatRupiah(deleteTarget.sisaNilai ?? deleteTarget.totalBersih ?? deleteTarget.subtotal)}
                </span>
              </div>
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

      {/* MODAL KONFIRMASI HAPUS BARANG EKSTRA */}
      {deleteTargetBarangEkstra && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Hapus Barang Ekstra?
                </h3>
                <p className="text-xs text-slate-500">
                  Tindakan ini akan menghapus data barang ekstra ini dari daftar inventaris.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Nama Barang:</span>
                <span className="font-bold text-slate-800">
                  {deleteTargetBarangEkstra.namaBarang}
                </span>
              </div>
              {deleteTargetBarangEkstra.spesifikasi && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Spesifikasi:</span>
                  <span className="font-medium text-slate-700">
                    {deleteTargetBarangEkstra.spesifikasi}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Sekolah / UPT:</span>
                <span className="font-bold text-slate-700">
                  {deleteTargetBarangEkstra.schoolName || '-'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Volume:</span>
                <span className="font-bold text-slate-800">
                  {deleteTargetBarangEkstra.volume} {deleteTargetBarangEkstra.satuan}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Total Nilai:</span>
                <span className="font-extrabold text-emerald-700">
                  {formatRupiah(deleteTargetBarangEkstra.totalHarga || (deleteTargetBarangEkstra.volume * deleteTargetBarangEkstra.hargaSatuan))}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetBarangEkstra(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteBarangEkstra && deleteTargetBarangEkstra) {
                    onDeleteBarangEkstra(deleteTargetBarangEkstra.id);
                  }
                  setDeleteTargetBarangEkstra(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Barang</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT BARANG EKSTRA */}
      {editingBarangEkstra && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <PackagePlus className="w-5 h-5 text-emerald-600" />
                  <span>Edit Barang Ekstra (Admin)</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Sekolah / UPT: <strong className="text-slate-800">{editingBarangEkstra.schoolName || '-'}</strong> • Tahun {editingBarangEkstra.tahunAnggaran}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingBarangEkstra(null)}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg px-2 py-0.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditedBarangEkstra} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Nama Barang Ekstra *</label>
                  <input
                    type="text"
                    required
                    value={beNamaBarang}
                    onChange={(e) => setBeNamaBarang(e.target.value)}
                    placeholder="Contoh: Meja Kerja Kayu Jati / Proyektor Portabel"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Spesifikasi / Merek / Tipe</label>
                  <input
                    type="text"
                    value={beSpesifikasi}
                    onChange={(e) => setBeSpesifikasi(e.target.value)}
                    placeholder="Contoh: Epson EB-S41 / Kayu Jati Kelas I"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Volume</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={beVolume}
                    onChange={(e) => setBeVolume(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Satuan</label>
                  <input
                    type="text"
                    required
                    value={beSatuan}
                    onChange={(e) => setBeSatuan(e.target.value)}
                    placeholder="Unit / Buah / Set / Lembar"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Harga Satuan (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={beHargaSatuan}
                    onChange={(e) => setBeHargaSatuan(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold text-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Total Harga Preview</label>
                  <div className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-emerald-800 font-black">
                    {formatRupiah(Number(beVolume || 0) * Number(beHargaSatuan || 0))}
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kondisi Barang</label>
                  <select
                    value={beKondisi}
                    onChange={(e) => setBeKondisi(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Baik">Baik</option>
                    <option value="Kurang Baik">Kurang Baik</option>
                    <option value="Rusak Berat">Rusak Berat</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Sumber Perolehan</label>
                  <input
                    type="text"
                    value={beSumberPerolehan}
                    onChange={(e) => setBeSumberPerolehan(e.target.value)}
                    placeholder="BOS Reguler / APBD / Hibah Komite / Donasi"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tanggal Perolehan</label>
                  <input
                    type="date"
                    value={beTanggalPerolehan}
                    onChange={(e) => setBeTanggalPerolehan(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Keterangan / Catatan</label>
                  <textarea
                    rows={2}
                    value={beKeterangan}
                    onChange={(e) => setBeKeterangan(e.target.value)}
                    placeholder="Catatan tambahan lokasi penyimpanan atau asal usul barang..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingBarangEkstra(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow transition-all cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
