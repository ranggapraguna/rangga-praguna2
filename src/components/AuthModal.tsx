import React, { useState, useEffect } from 'react';
import { 
  X, 
  LogIn, 
  Lock, 
  User, 
  Shield, 
  Eye, 
  EyeOff, 
  AlertCircle,
  Loader2,
  Building2,
  Search,
  Database,
  RefreshCw
} from 'lucide-react';
import { UserRole, UserProfile, UserAccount } from '../types/auth';
import { authenticateUptSchool } from '../utils/auth';
import { 
  UptSchoolAccount, 
  loadUptSchools,
  saveUptSchools,
  mergeSheetSchoolsWithLocal,
  normalizeUptKey,
  filterUptSchools
} from '../data/schoolData';
import { 
  loginWithGoogleAppsScript, 
  fetchUptListFromGoogleAppsScript,
  getGasAuthUrl
} from '../utils/gasAuth';
import { fetchSharedStateFromServer } from '../utils/storage';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register';
  accounts: UserAccount[];
  schoolName: string;
  schoolYear?: string;
  onLoginSuccess: (user: UserProfile, schoolAccount?: UptSchoolAccount, loginYear?: string) => void;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  schoolName,
  schoolYear = '2026',
  onLoginSuccess,
  onClose,
}) => {
  const [gasUrl] = useState<string>(getGasAuthUrl);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncingAccounts, setIsSyncingAccounts] = useState(false);

  const [uptSchools, setUptSchools] = useState<UptSchoolAccount[]>(loadUptSchools);
  const [uptSearchQuery, setUptSearchQuery] = useState<string>('');
  const [selectedUpt, setSelectedUpt] = useState<string>(schoolName);
  const [selectedYear] = useState<string>(schoolYear);

  // Login form state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  const syncAkunAplikasi = async (_forceRemote = true) => {
    setIsSyncingAccounts(true);
    try {
      const sheetRows = await fetchUptListFromGoogleAppsScript(gasUrl, true);
      if (sheetRows.length > 0) {
        const merged = mergeSheetSchoolsWithLocal(sheetRows);
        setUptSchools(merged);
        saveUptSchools(merged, false);
        const mergedMatch = merged.find(
          (s) => normalizeUptKey(s.upt) === normalizeUptKey(schoolName)
        );
        if (mergedMatch) {
          setSelectedUpt(mergedMatch.upt);
        } else if (merged[0]) {
          setSelectedUpt(merged[0].upt);
        }
      }
    } finally {
      setIsSyncingAccounts(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setUptSearchQuery('');
      setLoginError('');
      syncAkunAplikasi(true);
    }
  }, [isOpen, schoolName, gasUrl]);

  if (!isOpen) return null;

  const filteredUptSchools = filterUptSchools(uptSchools, uptSearchQuery);

  const handleUptSearchChange = (query: string) => {
    setUptSearchQuery(query);
    setLoginError('');
    const matches = filterUptSchools(uptSchools, query);
    if (matches.length > 0 && !matches.some((m) => m.upt === selectedUpt)) {
      setSelectedUpt(matches[0].upt);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!selectedUpt.trim()) {
      setLoginError('Silakan pilih UPT / Satuan Pendidikan terlebih dahulu.');
      return;
    }

    const cleanUser = loginUsername.trim();
    if (!cleanUser || !loginPassword) {
      setLoginError('Username dan kata sandi wajib diisi sesuai data pada 6_AKUN_APLIKASI.');
      return;
    }

    const matchedSheetSchool = uptSchools.find(
      (s) => normalizeUptKey(s.upt) === normalizeUptKey(selectedUpt)
    );

    setIsSubmitting(true);

    try {
      const gasResult = await loginWithGoogleAppsScript(
        cleanUser,
        loginPassword,
        gasUrl,
        selectedUpt
      );

      if (gasResult.success && gasResult.user) {
        setIsSubmitting(false);
        const resolvedAccount = gasResult.schoolAccount || matchedSheetSchool;
        const finalRole: UserRole =
          gasResult.user.role === 'Admin' || resolvedAccount?.role === 'Admin'
            ? 'Admin'
            : 'Operator BOSP';
        onLoginSuccess(
          {
            ...gasResult.user,
            schoolName: resolvedAccount?.upt || selectedUpt,
            role: finalRole,
          },
          resolvedAccount,
          selectedYear
        );
        onClose();
        return;
      }

      setLoginError(
        gasResult.error ||
          'Autentikasi gagal di 6_AKUN_APLIKASI Google Spreadsheet. Silakan periksa kembali UPT, username, dan kata sandi.'
      );
    } catch {
      setLoginError(
        'Gagal menghubungi Database Google Spreadsheet (6_AKUN_APLIKASI). Periksa koneksi internet Anda.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden my-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 id="auth-modal-title" className="text-sm font-bold">
                Masuk Pengguna UPT BOSP
              </h2>
              <p className="text-[11px] text-slate-300">
                {selectedUpt || schoolName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
            aria-label="Tutup jendela login"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Database 6_AKUN_APLIKASI Status Bar */}
        <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-emerald-900 truncate">
            <Database className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="font-semibold shrink-0">Database:</span>
            <span className="text-[11px] font-mono text-emerald-700 truncate">
              6_AKUN_APLIKASI ({uptSchools.length} Akun UPT)
            </span>
          </div>
          <button
            type="button"
            onClick={() => syncAkunAplikasi(true)}
            disabled={isSyncingAccounts}
            className="text-emerald-700 font-bold hover:underline shrink-0 text-[11px] flex items-center gap-1 disabled:opacity-60"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncingAccounts ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>

        {/* Single Login Header Tab */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold">
          <div className="flex-1 py-3 text-center flex items-center justify-center gap-1.5 border-b-2 border-emerald-600 text-emerald-800 bg-white shadow-xs">
            <LogIn className="w-4 h-4" />
            <span>Menu Masuk (Berdasarkan 6_AKUN_APLIKASI)</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6">
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {loginError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 space-y-2 text-xs text-rose-800" role="alert">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="modal-upt-select" className="block text-xs font-semibold text-slate-700">
                Pilih UPT / Satuan Pendidikan (6_AKUN_APLIKASI) <span className="text-rose-500">*</span>
              </label>

              {/* Kolom Search UPT */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="modal-upt-search"
                  type="text"
                  aria-label="Cari UPT Sekolah"
                  value={uptSearchQuery}
                  onChange={(e) => handleUptSearchChange(e.target.value)}
                  placeholder="Cari nama UPT / Sekolah..."
                  disabled={isSubmitting}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-75"
                />
                {uptSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setUptSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label="Bersihkan pencarian UPT"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="relative">
                <Building2 className="w-4 h-4 text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  id="modal-upt-select"
                  value={selectedUpt}
                  onChange={(e) => {
                    setSelectedUpt(e.target.value);
                    setLoginError('');
                  }}
                  disabled={isSubmitting}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-75"
                >
                  <option value="">-- Pilih UPT Sekolah --</option>
                  {filteredUptSchools.map((s) => (
                    <option key={s.id} value={s.upt}>
                      {s.upt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Username Sekolah (Kolom C)
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="Username sesuai 6_AKUN_APLIKASI"
                  disabled={isSubmitting}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-75"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kata Sandi (Kolom D)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isSubmitting}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-10 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-75"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showLoginPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow transition-all active:scale-95 disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memverifikasi Kredensial 6_AKUN_APLIKASI...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Masuk ke {selectedUpt || 'Sistem BOSP'}</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
