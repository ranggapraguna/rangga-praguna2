import React from 'react';
import { LayoutDashboard, FileSpreadsheet, PlusCircle, Printer, Sliders, ShieldCheck, PackagePlus } from 'lucide-react';

export type ActiveTab = 'admin' | 'rekap_dinas' | 'dashboard' | 'list' | 'form' | 'receipt' | 'stock_opname' | 'cetak_laporan' | 'barang_ekstra' | 'settings';

interface BottomNavBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  expenseCount: number;
  isAdmin?: boolean;
  pendingApprovalCount?: number;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onTabChange,
  expenseCount,
  isAdmin = false,
  pendingApprovalCount = 0,
}) => {
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
      id: 'barang_ekstra' as ActiveTab,
      label: 'Input Barang Ekstra',
      sublabel: 'Inventaris Non-Rutin',
      icon: PackagePlus,
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
    <nav 
      aria-label="Navigasi Utama Aplikasi"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-xl sm:static sm:bg-slate-100 sm:border-b sm:border-t-0 sm:shadow-none print:hidden"
    >
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
        <div className="flex items-center justify-around sm:justify-start sm:gap-2 py-1.5 sm:py-2 overflow-x-auto">
          {baseTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            if ('isAdminTab' in tab && tab.isAdminTab) {
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  aria-label="Tab Panel Khusus Admin"
                  className={`flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-3 py-1.5 rounded-xl transition-all relative shrink-0 ${
                    isActive
                      ? 'bg-slate-900 text-amber-300 font-bold shadow-md border border-amber-500/40'
                      : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300'
                  }`}
                  aria-pressed={isActive}
                >
                  <div className="relative">
                    <Icon className="w-5 h-5 text-amber-500" />
                    {typeof tab.badge === 'number' && tab.badge > 0 && (
                      <span className="absolute -top-1.5 -right-2 bg-rose-600 text-white text-[10px] font-extrabold px-1 rounded-full min-w-4 text-center">
                        {tab.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-left">
                    <span className="text-xs font-extrabold block leading-tight">{tab.label}</span>
                    <span className="hidden sm:block text-[10px] opacity-80 leading-none">{tab.sublabel}</span>
                  </div>
                </button>
              );
            }

            if (tab.highlight) {
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  aria-label="Tab Formulir Input Belanja"
                  className={`flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-3 py-1.5 rounded-xl transition-all relative shrink-0 ${
                    isActive
                      ? 'bg-emerald-600 text-white font-semibold shadow-md shadow-emerald-600/30'
                      : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                  }`}
                  aria-pressed={isActive}
                >
                  <Icon className="w-5 h-5" />
                  <div className="text-left">
                    <span className="text-xs font-bold block leading-tight">{tab.label}</span>
                    <span className="hidden sm:block text-[10px] opacity-80 leading-none">{tab.sublabel}</span>
                  </div>
                </button>
              );
            }

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                aria-label={`Tab ${tab.label}`}
                className={`flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-3 py-1.5 rounded-lg transition-all relative shrink-0 ${
                  isActive
                    ? 'text-emerald-700 bg-emerald-50/80 font-bold border-b-2 sm:border-b-0 sm:border-l-2 border-emerald-600'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
                aria-pressed={isActive}
              >
                <div className="relative">
                  <Icon className="w-5 h-5 sm:w-4 sm:h-4" />
                  {typeof tab.badge === 'number' && (
                    <span className="absolute -top-1.5 -right-2 bg-slate-800 text-white text-[10px] font-bold px-1 rounded-full min-w-4 text-center">
                      {tab.badge}
                    </span>
                  )}
                </div>
                <div className="text-center sm:text-left">
                  <span className="text-[11px] sm:text-xs block leading-tight">{tab.label}</span>
                  <span className="hidden sm:block text-[10px] text-slate-400 leading-none">{tab.sublabel}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
