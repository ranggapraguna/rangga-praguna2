import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Printer, ClipboardList, PackagePlus, RefreshCw, Building, Search, X, ChevronDown, FileText, FileSpreadsheet, Layers } from 'lucide-react';
import { SchoolExpense, SchoolInfo, BarangEkstraItem } from '../types';
import { UserProfile } from '../types/auth';
import { loadUptSchools, normalizeUptKey } from '../data/schoolData';
import { ReceiptPrintView, ReklasSubView } from './ReceiptPrintView';

export type CetakReportVariant = 
  | 'rekon' 
  | 'stock_opname' 
  | 'barang_ekstra' 
  | 'reklas_barang_ekstra' 
  | 'kib_barang_ekstra' 
  | 'rekon_gabung_sekolah';

interface CetakLaporanViewProps {
  initialExpense: SchoolExpense | null;
  allExpenses: SchoolExpense[];
  allYearExpenses?: SchoolExpense[];
  schoolInfo: SchoolInfo;
  onBack: () => void;
  defaultVariant?: CetakReportVariant;
  currentVariant?: CetakReportVariant;
  onVariantChange?: (variant: CetakReportVariant) => void;
  reklasSubView?: ReklasSubView;
  onReklasSubViewChange?: (sub: ReklasSubView) => void;
  isAdmin?: boolean;
  currentUser?: UserProfile | null;
  barangEkstraItems?: BarangEkstraItem[];
}

const REKLAS_SUB_OPTIONS: { id: ReklasSubView; label: string }[] = [
  { id: 'ba_reklas', label: '1. BA Reklas Barang Ekstra' },
  { id: 'lampiran_1', label: '2. Lampiran 1' },
  { id: 'lampiran_2', label: '3. Lampiran 2' },
];

export const CetakLaporanView: React.FC<CetakLaporanViewProps> = ({
  initialExpense,
  allExpenses,
  allYearExpenses,
  schoolInfo,
  onBack,
  defaultVariant = 'rekon',
  currentVariant: controlledVariant,
  onVariantChange,
  reklasSubView: controlledReklasSubView,
  onReklasSubViewChange,
  isAdmin = false,
  currentUser = null,
  barangEkstraItems = [],
}) => {
  const [internalVariant, setInternalVariant] = useState<CetakReportVariant>(defaultVariant);
  const [internalReklasSubView, setInternalReklasSubView] = useState<ReklasSubView>('ba_reklas');
  const [isReklasMenuOpen, setIsReklasMenuOpen] = useState<boolean>(false);
  const [isMobileReportMenuOpen, setIsMobileReportMenuOpen] = useState<boolean>(false);
  const [showOnlyFilledRows, setShowOnlyFilledRows] = useState<boolean>(true);
  const reklasMenuRef = useRef<HTMLDivElement>(null);

  const currentVariant = controlledVariant ?? internalVariant;
  const setCurrentVariant = (v: CetakReportVariant) => {
    setInternalVariant(v);
    onVariantChange?.(v);
  };

  const reklasSubView = controlledReklasSubView ?? internalReklasSubView;
  const setReklasSubView = (s: ReklasSubView) => {
    setInternalReklasSubView(s);
    onReklasSubViewChange?.(s);
  };

  // UPT Filter State (Only for Admin users)
  const [selectedUpt, setSelectedUpt] = useState<string>(() => {
    if (initialExpense?.schoolName) return initialExpense.schoolName;
    if (!isAdmin && currentUser?.schoolName) return currentUser.schoolName;
    return 'Semua';
  });

  const [isUptModalOpen, setIsUptModalOpen] = useState<boolean>(false);
  const [uptSearchInput, setUptSearchInput] = useState<string>('');
  const uptContainerRef = useRef<HTMLDivElement>(null);
  const uptSearchFieldRef = useRef<HTMLInputElement>(null);

  // Master catalog of all UPTs in Kabupaten Minahasa Tenggara
  const masterSchools = useMemo(() => {
    return loadUptSchools();
  }, [schoolInfo, allExpenses]);

  // Collect all available UPT names (from master catalog, expenses, and barang ekstra, including DINAS PENDIDIKAN)
  const availableUpts = useMemo(() => {
    const setUpt = new Set<string>(['DINAS PENDIDIKAN']);
    masterSchools.forEach((s) => {
      if (s.upt) setUpt.add(s.upt);
    });
    allExpenses.forEach((e) => {
      if (e.schoolName) setUpt.add(e.schoolName);
    });
    barangEkstraItems.forEach((b) => {
      if (b.schoolName) setUpt.add(b.schoolName);
    });
    return Array.from(setUpt).sort((a, b) => {
      if (a === 'DINAS PENDIDIKAN') return -1;
      if (b === 'DINAS PENDIDIKAN') return 1;
      return a.localeCompare(b);
    });
  }, [masterSchools, allExpenses, barangEkstraItems]);

  // Filtered UPT list for search modal
  const filteredUptOptions = useMemo(() => {
    if (!uptSearchInput.trim()) return availableUpts;
    const q = uptSearchInput.trim().toLowerCase();
    const normQ = normalizeUptKey(uptSearchInput).toLowerCase();
    return availableUpts.filter((u) => {
      const uLower = u.toLowerCase();
      const normULower = normalizeUptKey(u).toLowerCase();
      return uLower.includes(q) || normULower.includes(q) || (normQ && normULower.includes(normQ));
    });
  }, [availableUpts, uptSearchInput]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (uptContainerRef.current && !uptContainerRef.current.contains(event.target as Node)) {
        setIsUptModalOpen(false);
      }
      if (reklasMenuRef.current && !reklasMenuRef.current.contains(event.target as Node)) {
        setIsReklasMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const REPORT_METADATA: Record<
    CetakReportVariant,
    { label: string; icon: React.ComponentType<{ className?: string }> }
  > = {
    rekon: { label: '1. Berita Acara Rekon Persediaan', icon: Printer },
    stock_opname: { label: '2. Berita Acara Stock Opname', icon: ClipboardList },
    barang_ekstra: { label: '3. Berita Acara Barang Ekstra', icon: PackagePlus },
    reklas_barang_ekstra: { label: '4. Berita Acara Reklas Barang Ekstra', icon: RefreshCw },
    kib_barang_ekstra: { label: '5. KIB Barang Ekstra', icon: FileSpreadsheet },
    rekon_gabung_sekolah: { label: '6. BA Rekon Gabung Sekolah', icon: Layers },
  };

  const activeReklasOption = REKLAS_SUB_OPTIONS.find((o) => o.id === reklasSubView) || REKLAS_SUB_OPTIONS[0];
  const activeReport = REPORT_METADATA[currentVariant] || REPORT_METADATA.rekon;
  const ActiveReportIcon = activeReport.icon;

  return (
    <div className="space-y-6">
      {/* Cetak Laporan Header & Admin UPT Filter */}
      <div className="print:hidden bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-2xs shrink-0">
              <ActiveReportIcon className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                  Laporan Aktif
                </span>
                {currentVariant === 'reklas_barang_ekstra' && (
                  <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {activeReklasOption.label}
                  </span>
                )}
              </div>
              <h2 className="text-base font-black text-slate-900 mt-0.5">
                {activeReport.label}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto justify-start md:justify-end">
            {/* UPT Filter with Search (KHUSUS PENGGUNA ADMIN) */}
            {isAdmin && (
              <div ref={uptContainerRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsUptModalOpen((prev) => !prev);
                    setTimeout(() => uptSearchFieldRef.current?.focus(), 80);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-xs ${
                    selectedUpt !== 'Semua'
                      ? 'bg-emerald-50 text-emerald-950 border-emerald-400 ring-2 ring-emerald-400/20'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
                  }`}
                  title="Filter UPT Sekolah untuk Berita Acara"
                >
                  <Building className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate max-w-[150px] sm:max-w-[200px]">
                    {selectedUpt === 'Semua' ? 'Semua UPT' : selectedUpt}
                  </span>
                  <Search className="w-3 h-3 text-emerald-600 shrink-0" />
                </button>

                {isUptModalOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-3 text-xs space-y-2 animate-fadeIn">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                      <span className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Pilih UPT Sekolah</span>
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {filteredUptOptions.length} UPT
                      </span>
                    </div>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        ref={uptSearchFieldRef}
                        value={uptSearchInput}
                        onChange={(e) => setUptSearchInput(e.target.value)}
                        placeholder="Ketik nama UPT sekolah..."
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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

                    <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedUpt('Semua');
                          setIsUptModalOpen(false);
                          setUptSearchInput('');
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl font-medium transition-all cursor-pointer ${
                          selectedUpt === 'Semua'
                            ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200'
                            : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        Semua UPT (Kabupaten)
                      </button>
                      {filteredUptOptions.map((upt) => (
                        <button
                          key={upt}
                          type="button"
                          onClick={() => {
                            setSelectedUpt(upt);
                            setIsUptModalOpen(false);
                            setUptSearchInput('');
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl font-medium transition-all cursor-pointer truncate ${
                            selectedUpt === upt
                              ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200'
                              : 'hover:bg-slate-100 text-slate-700'
                          }`}
                          title={upt}
                        >
                          {upt}
                        </button>
                      ))}
                      {filteredUptOptions.length === 0 && (
                        <div className="py-4 text-center text-slate-400 text-xs italic">
                          UPT tidak ditemukan
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Selector Khusus Mobile / Layar Kecil (Berbaris Kebawah) */}
            <div className="relative md:hidden w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setIsMobileReportMenuOpen((prev) => !prev)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-300 transition-all cursor-pointer"
              >
                <span className="flex items-center gap-2 truncate">
                  <ActiveReportIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="truncate">Ganti Laporan</span>
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isMobileReportMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isMobileReportMenuOpen && (
                <div className="absolute right-0 left-0 sm:left-auto sm:w-72 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-2 text-xs space-y-1 animate-fadeIn">
                  <div className="px-2.5 py-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    Pilih Dokumen Laporan (1 s/d 6)
                  </div>
                  {(Object.keys(REPORT_METADATA) as CetakReportVariant[]).map((key) => {
                    const item = REPORT_METADATA[key];
                    const isSelected = currentVariant === key;
                    const ItemIcon = item.icon;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setCurrentVariant(key);
                          setIsMobileReportMenuOpen(false);
                        }}
                        className={`w-full flex items-start gap-2.5 px-3 py-2 rounded-xl font-bold transition-all cursor-pointer text-left ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <ItemIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span className="whitespace-normal break-words flex-1 leading-snug">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sub-pilihan langsung ketika Berita Acara Reklas Barang Ekstra aktif */}
        {currentVariant === 'reklas_barang_ekstra' && (
          <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-emerald-600" />
              <span>Pilihan Dokumen Berita Acara Reklas Barang Ekstra:</span>
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {REKLAS_SUB_OPTIONS.map((opt) => {
                const active = reklasSubView === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setReklasSubView(opt.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                      active
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-emerald-50/60 hover:bg-emerald-100/70 text-emerald-900 border-emerald-200'
                    }`}
                  >
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Render ReceiptPrintView with respective variant and selected UPT */}
      <ReceiptPrintView
        key={`${currentVariant}-${selectedUpt}`}
        variant={currentVariant}
        reklasSubView={reklasSubView}
        onReklasSubViewChange={setReklasSubView}
        initialExpense={initialExpense}
        allExpenses={currentVariant === 'rekon_gabung_sekolah' && allYearExpenses ? allYearExpenses : allExpenses}
        schoolInfo={schoolInfo}
        onBack={onBack}
        isAdmin={isAdmin}
        currentUser={currentUser}
        barangEkstraItems={barangEkstraItems}
        selectedUpt={selectedUpt}
        onUptChange={setSelectedUpt}
        initialShowOnlyFilledRows={showOnlyFilledRows}
        onShowOnlyFilledRowsChange={setShowOnlyFilledRows}
      />
    </div>
  );
};
