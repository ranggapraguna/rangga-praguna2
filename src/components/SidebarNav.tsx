import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  FileSpreadsheet, 
  PlusCircle, 
  Printer, 
  Sliders, 
  ShieldCheck, 
  PackagePlus, 
  PanelLeftClose, 
  PanelLeftOpen,
  ClipboardList,
  RefreshCw,
  Layers,
  ChevronDown,
  FileText,
  Package,
  Wrench
} from 'lucide-react';
import { ActiveTab } from './BottomNavBar';
import { ReklasSubView } from './ReceiptPrintView';

export type ReportVariant = 
  | 'rekon' 
  | 'stock_opname' 
  | 'barang_ekstra' 
  | 'reklas_barang_ekstra' 
  | 'kib_barang_ekstra' 
  | 'rekon_gabung_sekolah';

interface SidebarNavProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  expenseCount: number;
  isAdmin?: boolean;
  pendingApprovalCount?: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  reportVariant?: ReportVariant;
  onSelectReportVariant?: (variant: ReportVariant, subView?: ReklasSubView) => void;
  reklasSubView?: ReklasSubView;
  expenseInputMode?: 'persediaan' | 'pemeliharaan';
  onSelectExpenseInputMode?: (mode: 'persediaan' | 'pemeliharaan') => void;
}

const REPORT_SUB_ITEMS: {
  id: ReportVariant;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'rekon', label: '1. Berita Acara Rekon Persediaan', icon: Printer },
  { id: 'stock_opname', label: '2. Berita Acara Stock Opname', icon: ClipboardList },
  { id: 'barang_ekstra', label: '3. Berita Acara Barang Ekstra', icon: PackagePlus },
  { id: 'reklas_barang_ekstra', label: '4. Berita Acara Reklas Barang Ekstra', icon: RefreshCw },
  { id: 'kib_barang_ekstra', label: '5. KIB Barang Ekstra', icon: FileSpreadsheet },
  { id: 'rekon_gabung_sekolah', label: '6. BA Rekon Gabung Sekolah', icon: Layers },
];

const REKLAS_SUB_OPTIONS: { id: ReklasSubView; label: string }[] = [
  { id: 'ba_reklas', label: '1. BA Reklas Barang Ekstra' },
  { id: 'lampiran_1', label: '2. Lampiran 1' },
  { id: 'lampiran_2', label: '3. Lampiran 2' },
];

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeTab,
  onTabChange,
  expenseCount,
  isAdmin = false,
  pendingApprovalCount = 0,
  isCollapsed,
  onToggleCollapse,
  reportVariant = 'rekon',
  onSelectReportVariant,
  reklasSubView = 'ba_reklas',
  expenseInputMode = 'persediaan',
  onSelectExpenseInputMode,
}) => {
  const [isCetakMenuOpen, setIsCetakMenuOpen] = useState<boolean>(activeTab === 'cetak_laporan');
  const [isInputBelanjaOpen, setIsInputBelanjaOpen] = useState<boolean>(
    activeTab === 'form' || activeTab === 'barang_ekstra'
  );

  React.useEffect(() => {
    if (activeTab === 'cetak_laporan') {
      setIsCetakMenuOpen(true);
    } else if (activeTab === 'form' || activeTab === 'barang_ekstra') {
      setIsInputBelanjaOpen(true);
    }
  }, [activeTab]);

  const baseTabs = [
    {
      id: 'dashboard' as ActiveTab,
      label: 'Dashboard',
      sublabel: 'Rekap TW',
      icon: LayoutDashboard,
    },
    ...(isAdmin
      ? [
          {
            id: 'admin' as ActiveTab,
            label: 'Panel Admin',
            sublabel: 'Edit & Approve',
            icon: ShieldCheck,
            badge: pendingApprovalCount,
            isAdminTab: true,
          },
          {
            id: 'rekap_dinas' as ActiveTab,
            label: 'Rekapan Se Dinas',
            sublabel: 'Rekap Se-Kabupaten',
            icon: FileSpreadsheet,
            isAdminTab: true,
          },
        ]
      : []),
    ...(!isAdmin
      ? [
          {
            id: 'list' as ActiveTab,
            label: 'Data Belanja',
            sublabel: 'Tabel & Kartu',
            icon: FileSpreadsheet,
            badge: expenseCount,
          },
        ]
      : []),
    {
      id: 'form' as ActiveTab,
      label: 'Input Belanja',
      sublabel: 'Formulir SPJ',
      icon: PlusCircle,
      highlight: true,
    },

    {
      id: 'cetak_laporan' as ActiveTab,
      label: 'Cetak Laporan',
      sublabel: 'Rekon, Stock & Ekstra',
      icon: Printer,
    },
   
    {
      id: 'settings' as ActiveTab,
      label: 'Data Umum',
      sublabel: 'Profil Sekolah',
      icon: Sliders,
    },
  ];

  return (
    <aside
      aria-label="Navigasi Samping"
      className={`fixed top-0 left-0 bottom-0 z-40 bg-slate-900 text-white border-r border-slate-800 shadow-2xl transition-all duration-300 flex flex-col print:hidden ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Sidebar Header / Logo & Collapse Toggle */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        {!isCollapsed && (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center font-black text-white shrink-0 shadow-md">
              B
            </div>
            <div className="truncate">
              <span className="text-xs font-black tracking-wider uppercase block text-white truncate">
                BOSP Sekolah
              </span>
              <span className="text-[10px] text-emerald-400 block truncate">
                Sistem Pengelolaan
              </span>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Tampilkan Sidebar (Unhide)' : 'Sembunyikan Sidebar (Hide)'}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer mx-auto sm:mx-0 shadow-xs"
          aria-label="Toggle Sidebar"
        >
          {isCollapsed ? (
            <PanelLeftOpen className="w-4 h-4 text-emerald-400" />
          ) : (
            <PanelLeftClose className="w-4 h-4 text-emerald-400" />
          )}
        </button>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {baseTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          if ('isAdminTab' in tab && tab.isAdminTab) {
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                title={tab.label}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all relative group cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                    : 'bg-amber-950/40 text-amber-300 hover:bg-amber-900/50 border border-amber-600/30'
                }`}
              >
                <div className="relative shrink-0">
                  <Icon className="w-5 h-5" />
                  {typeof tab.badge === 'number' && tab.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 bg-rose-600 text-white text-[10px] font-extrabold px-1 rounded-full min-w-4 text-center">
                      {tab.badge}
                    </span>
                  )}
                </div>
                {!isCollapsed && (
                  <div className="text-left truncate">
                    <span className="text-xs font-black block leading-tight truncate">{tab.label}</span>
                    <span className="text-[10px] opacity-80 leading-none block truncate mt-0.5">{tab.sublabel}</span>
                  </div>
                )}
              </button>
            );
          }

          // Khusus Menu Input Belanja dengan Sub-Menu Berbaris Kebawah (Input Belanja Persediaan, Input Pemeliharaan & Input Barang Ekstra)
          if (tab.id === 'form') {
            const isMenuExpanded = !isCollapsed && isInputBelanjaOpen;
            const isInputBelanjaActive = activeTab === 'form' || activeTab === 'barang_ekstra';
            return (
              <div key={tab.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    if (isCollapsed) {
                      onToggleCollapse();
                    }
                    if (isInputBelanjaActive) {
                      setIsInputBelanjaOpen((prev) => !prev);
                    } else {
                      onTabChange('form');
                      setIsInputBelanjaOpen(true);
                    }
                  }}
                  title={tab.label}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all relative group cursor-pointer ${
                    isInputBelanjaActive
                      ? 'bg-slate-800 text-emerald-400 font-bold border-l-4 border-emerald-500 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <Icon className="w-5 h-5 text-emerald-400" />
                    </div>
                    {!isCollapsed && (
                      <div className="text-left truncate">
                        <span className="text-xs font-semibold block leading-tight truncate">{tab.label}</span>
                        <span className="text-[10px] text-slate-500 leading-none block truncate mt-0.5">{tab.sublabel}</span>
                      </div>
                    )}
                  </div>
                  {!isCollapsed && (
                    <ChevronDown
                      className={`w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200 ${
                        isMenuExpanded ? 'rotate-180 text-emerald-400' : ''
                      }`}
                    />
                  )}
                </button>

                {/* Sub-menu Tombol Input Belanja Berbaris Kebawah */}
                {isMenuExpanded && (
                  <div className="flex flex-col space-y-1.5 pl-2.5 pr-1 py-1 border-l-2 border-emerald-500/40 ml-3.5 mt-1 animate-fadeIn">
                    <button
                      type="button"
                      onClick={() => {
                        onTabChange('form');
                        onSelectExpenseInputMode?.('persediaan');
                      }}
                      className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-left ${
                        activeTab === 'form' && expenseInputMode === 'persediaan'
                          ? 'bg-emerald-600 text-white shadow-md ring-1 ring-emerald-400/40'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                      }`}
                      title="1. Input Belanja Persediaan"
                    >
                      <Package className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${activeTab === 'form' && expenseInputMode === 'persediaan' ? 'text-white' : 'text-emerald-400'}`} />
                      <span className="whitespace-normal break-words flex-1 text-[11.5px] leading-snug">
                        1. Input Belanja Persediaan
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onTabChange('form');
                        onSelectExpenseInputMode?.('pemeliharaan');
                      }}
                      className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-left ${
                        activeTab === 'form' && expenseInputMode === 'pemeliharaan'
                          ? 'bg-emerald-600 text-white shadow-md ring-1 ring-emerald-400/40'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                      }`}
                      title="2. Input Pemeliharaan"
                    >
                      <Wrench className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${activeTab === 'form' && expenseInputMode === 'pemeliharaan' ? 'text-white' : 'text-emerald-400'}`} />
                      <span className="whitespace-normal break-words flex-1 text-[11.5px] leading-snug">
                        2. Input Pemeliharaan
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onTabChange('barang_ekstra');
                      }}
                      className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-left ${
                        activeTab === 'barang_ekstra'
                          ? 'bg-emerald-600 text-white shadow-md ring-1 ring-emerald-400/40'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                      }`}
                      title="3. Input Barang Ekstra"
                    >
                      <PackagePlus className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${activeTab === 'barang_ekstra' ? 'text-white' : 'text-emerald-400'}`} />
                      <span className="whitespace-normal break-words flex-1 text-[11.5px] leading-snug">
                        3. Input Barang Ekstra
                      </span>
                    </button>
                  </div>
                )}
              </div>
            );
          }

          if (tab.highlight) {
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                title={tab.label}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all relative group cursor-pointer ${
                  isActive
                    ? 'bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-600/30'
                    : 'bg-emerald-950/50 text-emerald-300 hover:bg-emerald-900/60 border border-emerald-600/30'
                }`}
              >
                <div className="relative shrink-0">
                  <Icon className="w-5 h-5 text-emerald-400" />
                </div>
                {!isCollapsed && (
                  <div className="text-left truncate">
                    <span className="text-xs font-bold block leading-tight truncate">{tab.label}</span>
                    <span className="text-[10px] opacity-80 leading-none block truncate mt-0.5">{tab.sublabel}</span>
                  </div>
                )}
              </button>
            );
          }

          // Khusus Menu Cetak Laporan dengan Sub-Menu Berbaris Kebawah
          if (tab.id === 'cetak_laporan') {
            const isMenuExpanded = !isCollapsed && isCetakMenuOpen;
            return (
              <div key={tab.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    if (isCollapsed) {
                      onToggleCollapse();
                    }
                    if (activeTab === tab.id) {
                      setIsCetakMenuOpen((prev) => !prev);
                    } else {
                      onTabChange(tab.id);
                      setIsCetakMenuOpen(true);
                    }
                  }}
                  title={tab.label}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all relative group cursor-pointer ${
                    isActive
                      ? 'bg-slate-800 text-emerald-400 font-bold border-l-4 border-emerald-500 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <Icon className="w-5 h-5 text-emerald-400" />
                    </div>
                    {!isCollapsed && (
                      <div className="text-left truncate">
                        <span className="text-xs font-semibold block leading-tight truncate">{tab.label}</span>
                        <span className="text-[10px] text-slate-500 leading-none block truncate mt-0.5">{tab.sublabel}</span>
                      </div>
                    )}
                  </div>
                  {!isCollapsed && (
                    <ChevronDown
                      className={`w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200 ${
                        isMenuExpanded ? 'rotate-180 text-emerald-400' : ''
                      }`}
                    />
                  )}
                </button>

                {/* Sub-menu Tombol Cetak Laporan Berbaris Kebawah (1 s/d 6) */}
                {isMenuExpanded && (
                  <div className="flex flex-col space-y-1.5 pl-2.5 pr-1 py-1 border-l-2 border-emerald-500/40 ml-3.5 mt-1 animate-fadeIn">
                    {REPORT_SUB_ITEMS.map((subItem) => {
                      const SubIcon = subItem.icon;
                      const isSubActive = isActive && reportVariant === subItem.id;

                      return (
                        <button
                          key={subItem.id}
                          type="button"
                          onClick={() => {
                            onTabChange('cetak_laporan');
                            onSelectReportVariant?.(subItem.id);
                          }}
                          className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-left ${
                            isSubActive
                              ? 'bg-emerald-600 text-white shadow-md ring-1 ring-emerald-400/40'
                              : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                          }`}
                          title={subItem.label}
                        >
                          <SubIcon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isSubActive ? 'text-white' : 'text-emerald-400'}`} />
                          <span className="whitespace-normal break-words flex-1 text-[11.5px] leading-snug">{subItem.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              title={tab.label}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all relative group cursor-pointer ${
                isActive
                  ? 'bg-slate-800 text-emerald-400 font-bold border-l-4 border-emerald-500 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="relative shrink-0">
                <Icon className="w-5 h-5" />
                {typeof tab.badge === 'number' && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-emerald-600 text-white text-[10px] font-bold px-1 rounded-full min-w-4 text-center">
                    {tab.badge}
                  </span>
                )}
              </div>
              {!isCollapsed && (
                <div className="text-left truncate">
                  <span className="text-xs font-semibold block leading-tight truncate">{tab.label}</span>
                  <span className="text-[10px] text-slate-500 leading-none block truncate mt-0.5">{tab.sublabel}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Sidebar Footer info */}
      {!isCollapsed && (
        <div className="p-3 m-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-[11px] text-slate-400">
          <div className="font-bold text-slate-200">BOSP v2.6</div>
          <div className="text-[10px] text-slate-400">Minahasa Tenggara</div>
        </div>
      )}
    </aside>
  );
};
