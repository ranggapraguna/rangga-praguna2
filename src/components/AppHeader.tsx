import React, { useState } from 'react';
import { 
  Building2, 
  RotateCw, 
  CheckCircle2, 
  Search, 
  Calendar,
  Sparkles,
  Sheet,
  FileSpreadsheet,
  User,
  LogIn,
  UserPlus,
  LogOut,
  ShieldCheck,
  Globe,
  Copy,
  X
} from 'lucide-react';
import { SchoolInfo, Triwulan } from '../types';
import { UserProfile, UserRole } from '../types/auth';
import { formatCombinedQuarterLabel } from '../utils/budgetCalculations';

export const PUBLIC_ONLINE_APP_URL =
  'https://ais-pre-blkzji4kaduzdmea67e74h-516501898304.asia-southeast1.run.app';

interface AppHeaderProps {
  schoolInfo: SchoolInfo;
  currentUser: UserProfile | null;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onLogout: () => void;
  activeQuarterFilter: string[];
  onQuarterFilterChange: (tw: string[]) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenSettings: () => void;
  onOpenGoogleSheets?: () => void;
  onNewExpense: () => void;
  onOpenAdminPanel?: () => void;
  onSwitchRole?: (role: UserRole) => void;
  onOpenDatabaseSpreadsheet?: () => void;
}

const QUARTER_IDS: Triwulan[] = ['TW1', 'TW2', 'TW3', 'TW4'];

export const AppHeader: React.FC<AppHeaderProps> = ({
  schoolInfo,
  currentUser,
  onOpenAuth,
  onLogout,
  activeQuarterFilter,
  onQuarterFilterChange,
  searchQuery,
  onSearchChange,
  onOpenSettings,
  onOpenGoogleSheets,
  onNewExpense,
  onOpenAdminPanel,
  onSwitchRole,
  onOpenDatabaseSpreadsheet,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showOnlineLinkModal, setShowOnlineLinkModal] = useState(false);
  const [copiedOnlineLink, setCopiedOnlineLink] = useState(false);

  const handleCopyOnlineLink = () => {
    navigator.clipboard.writeText(PUBLIC_ONLINE_APP_URL);
    setCopiedOnlineLink(true);
    setTimeout(() => setCopiedOnlineLink(false), 2500);
  };

  const selectedTwList: Triwulan[] = activeQuarterFilter.includes('Semua')
    ? QUARTER_IDS
    : QUARTER_IDS.filter((q) => activeQuarterFilter.includes(q));
  const isAllQuartersSelected = selectedTwList.length === QUARTER_IDS.length;

  const handleToggleQuarterInHeader = (tw: string) => {
    if (tw === 'Semua') {
      onQuarterFilterChange(QUARTER_IDS);
      return;
    }
    const targetTw = tw as Triwulan;
    if (isAllQuartersSelected) {
      // Jika sebelumnya Semua TW aktif, klik salah satu TW akan memilih TW tersebut
      onQuarterFilterChange([targetTw]);
      return;
    }
    const exists = selectedTwList.includes(targetTw);
    const next = exists
      ? selectedTwList.filter((q) => q !== targetTw)
      : QUARTER_IDS.filter((q) => q === targetTw || selectedTwList.includes(q));
    onQuarterFilterChange(next.length > 0 ? next : QUARTER_IDS);
  };

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setSyncToast(true);
      setTimeout(() => setSyncToast(false), 3000);
    }, 1000);
  };

  return (
    <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-md border-b border-slate-800 print:hidden">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Logo & School Title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
              <Sheet className="w-5 h-5 text-white" />
            </div>
            <div className="truncate cursor-pointer" onClick={onOpenSettings} title="Klik untuk edit data sekolah">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base sm:text-lg tracking-tight text-white truncate">
                  {currentUser?.schoolName || schoolInfo.namaSekolah || 'PERSEDIAAN DISDIK'}
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  TA {schoolInfo.tahunAnggaran}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate flex items-center gap-1.5">
                <span className="font-medium text-slate-300">AppSheet BOSP</span>
                <span>•</span>
                <span>NPSN: {schoolInfo.npsn}</span>
                <span>•</span>
                <span>Dana BOSP/BOS</span>
              </p>
            </div>
          </div>

          {/* Quick Actions (User/Auth, New Transaction, Settings) */}
          <div className="flex items-center gap-2 shrink-0">

            {/* Link Akses Online Button */}
            <button
              type="button"
              onClick={() => setShowOnlineLinkModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/50 text-sky-300 transition-all active:scale-95 cursor-pointer shadow-xs"
              title="Salin & Bagikan Link Akses Online Aplikasi BOSP"
            >
              <Globe className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="hidden md:inline">Link Online</span>
            </button>

            {/* Database Spreadsheet Master Button */}
            {onOpenDatabaseSpreadsheet && (
              <button
                type="button"
                onClick={onOpenDatabaseSpreadsheet}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/50 text-emerald-300 transition-all active:scale-95 cursor-pointer shadow-xs"
                title="Buka Database Spreadsheet Master (Panel Admin, Rekap Dinas & Input Belanja)"
                aria-label="Database Spreadsheet Master"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="hidden sm:inline">Database Spreadsheet</span>
              </button>
            )}

            {/* Admin Panel Quick Button when user is Admin */}
            {currentUser?.role === 'Admin' && onOpenAdminPanel && (
              <button
                onClick={onOpenAdminPanel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-300 transition-all active:scale-95"
                title="Buka Tampilan Khusus Admin (Edit & Approve)"
                aria-label="Panel Khusus Admin"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="hidden md:inline">Panel Admin</span>
              </button>
            )}

            {/* User Auth Section: Login / Register / Profile */}
            {currentUser ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    currentUser.role === 'Admin'
                      ? 'bg-slate-800 hover:bg-slate-700 border-amber-500/50 text-slate-100'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                  }`}
                  aria-label="Menu Pengguna Aktif"
                  aria-expanded={userMenuOpen}
                >
                  <div
                    className={`w-5 h-5 rounded-full text-white flex items-center justify-center font-bold text-[10px] ${
                      currentUser.role === 'Admin' ? 'bg-amber-600' : 'bg-emerald-600'
                    }`}
                  >
                    {currentUser.name.charAt(0)}
                  </div>
                  <div className="text-left hidden md:block max-w-[150px] truncate">
                    <span className="block font-semibold truncate leading-none">
                      {currentUser.name}
                    </span>
                    <span
                      className={`text-[10px] font-bold leading-none mt-0.5 block ${
                        currentUser.role === 'Admin' ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {currentUser.role}
                    </span>
                  </div>
                </button>

                {/* Dropdown Menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-60 rounded-xl bg-slate-800 border border-slate-700 shadow-xl py-2 z-50 animate-fadeIn text-xs">
                    <div className="px-3 py-2 border-b border-slate-700/80">
                      <p className="font-bold text-white truncate">{currentUser.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono truncate">@{currentUser.username || 'pengguna'}</p>
                      <span
                        className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          currentUser.role === 'Admin'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300'
                        }`}
                      >
                        Peran: {currentUser.role}
                      </span>
                    </div>

                    {currentUser.role === 'Admin' && onOpenAdminPanel && (
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          onOpenAdminPanel();
                        }}
                        className="w-full text-left px-3 py-2 text-amber-300 hover:bg-slate-700/80 flex items-center gap-2 font-bold"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                        <span>Panel Khusus Admin</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        onOpenSettings();
                      }}
                      className="w-full text-left px-3 py-2 text-slate-300 hover:bg-slate-700/80 flex items-center gap-2"
                    >
                      <Building2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>Profil Sekolah</span>
                    </button>

                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full text-left px-3 py-2 text-rose-400 hover:bg-slate-700/80 flex items-center gap-2 border-t border-slate-700/80 mt-1"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Keluar (Logout)</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onOpenAuth('login')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-all hover:border-slate-600"
                  aria-label="Menu Masuk Login"
                >
                  <LogIn className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Masuk</span>
                </button>
              </div>
            )}

            {/* School / Budget Info Modal Button */}
            <button
              onClick={onOpenSettings}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-all hover:border-slate-600"
              aria-label="Buka Pengaturan Profil Sekolah"
              title="Pengaturan Profil Sekolah"
            >
              <Building2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Profil Sekolah</span>
            </button>

            {/* Prominent Add Button */}
            <button
              onClick={onNewExpense}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all active:scale-95"
              aria-label="Input Belanja Baru"
            >
              <span className="text-base leading-none font-bold">+</span>
              <span className="hidden xs:inline">Input Belanja</span>
            </button>
          </div>
        </div>

        {/* Sync Toast Feedback */}
        {syncToast && (
          <div className="pb-2 text-xs text-emerald-300 flex items-center gap-1.5 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Data belanja per triwulan berhasil disinkronkan dengan Google Sheets & Database Sekolah.</span>
          </div>
        )}

        {/* Marquee Banner: SELAMAT DATANG DI APLIKASI SI RANGGA */}
        <div className="py-2.5 border-t border-slate-800 overflow-hidden bg-slate-950/80 relative">
          <div className="overflow-hidden whitespace-nowrap">
            <span className="inline-block animate-marquee text-emerald-400 font-extrabold text-xs sm:text-sm tracking-wider uppercase">
              SELAMAT DATANG DI APLIKASI SI RANGGA &nbsp;&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;&nbsp; SELAMAT DATANG DI APLIKASI SI RANGGA &nbsp;&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;&nbsp; SELAMAT DATANG DI APLIKASI SI RANGGA
            </span>
          </div>
        </div>
      </div>

      {/* Modal Link Akses Online */}
      {showOnlineLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden text-white">
            <div className="p-4 bg-gradient-to-r from-sky-900/70 to-emerald-900/70 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">Link Akses Online Aplikasi BOSP</h3>
                  <p className="text-[11px] text-slate-300">
                    Bagikan link ini kepada seluruh Operator UPT Sekolah & Admin Dinas
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOnlineLinkModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-300">
                  Link Publik / Akses Online Bersama (Tersinkronisasi 2 Arah):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={PUBLIC_ONLINE_APP_URL}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-mono text-sky-300 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopyOnlineLink}
                    className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                  >
                    {copiedOnlineLink ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Salin Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-800/60 text-emerald-200 space-y-1">
                <p className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Sinkronisasi Multi-Pengguna & Spreadsheet Aktif</span>
                </p>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Seluruh data yang diinput melalui link online di atas otomatis tersimpan di server bersama dan tersinkronisasi 2 arah dengan 6 lembar kerja pada Google Spreadsheet Master (termasuk login berdasarkan <strong>6_AKUN_APLIKASI</strong>).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
