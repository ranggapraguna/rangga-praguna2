import React, { useState, useEffect, useRef } from 'react';
import { 
  LogIn, 
  Lock, 
  User, 
  Shield, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  FileSpreadsheet,
  Building2,
  Upload,
  Search,
  X,
  Calendar,
  ChevronDown,
  RefreshCw,
  Database
} from 'lucide-react';
import { UserRole, UserProfile, UserAccount } from '../types/auth';
import { SchoolInfo } from '../types';
import { authenticateUptSchool } from '../utils/auth';
import { 
  LOGIN_YEARS,
  UptSchoolAccount, 
  loadUptSchools, 
  saveUptSchools, 
  parseSchoolSpreadsheetCsv,
  mergeSheetSchoolsWithLocal,
  normalizeUptKey,
  filterUptSchools
} from '../data/schoolData';
import { 
  loginWithGoogleAppsScript, 
  fetchUptListFromGoogleAppsScript,
  getGasAuthUrl
} from '../utils/gasAuth';
import { parseMasterDatabaseSpreadsheet } from '../utils/databaseSpreadsheet';
import { fetchSharedStateFromServer } from '../utils/storage';

interface LoginScreenProps {
  accounts: UserAccount[];
  schoolInfo: SchoolInfo;
  onLoginSuccess: (user: UserProfile, schoolAccount?: UptSchoolAccount, loginYear?: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  schoolInfo,
  onLoginSuccess,
}) => {
  const [gasUrl] = useState<string>(getGasAuthUrl);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncingAccounts, setIsSyncingAccounts] = useState(false);

  // Tahun Login (2025, 2026, 2027)
  const [selectedYear, setSelectedYear] = useState<string>(() =>
    LOGIN_YEARS.includes(String(schoolInfo.tahunAnggaran) as any)
      ? String(schoolInfo.tahunAnggaran)
      : LOGIN_YEARS[0]
  );

  // Data Akun Sekolah (UPT) dari Database Spreadsheet (Sheet 6_AKUN_APLIKASI)
  const [uptSchools, setUptSchools] = useState<UptSchoolAccount[]>(loadUptSchools);
  const [uptSearchQuery, setUptSearchQuery] = useState<string>('');
  const [showUptSuggestions, setShowUptSuggestions] = useState<boolean>(false);
  const [selectedUpt, setSelectedUpt] = useState<string>(() => {
    const initial = loadUptSchools();
    const matchCurrent = initial.find(
      (s) => normalizeUptKey(s.upt) === normalizeUptKey(schoolInfo.namaSekolah)
    );
    return matchCurrent ? matchCurrent.upt : initial[0]?.upt || '';
  });
  const [uploadNotice, setUploadNotice] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uptDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (uptDropdownRef.current && !uptDropdownRef.current.contains(e.target as Node)) {
        setShowUptSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Login form state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  const syncAkunAplikasiDatabase = async (showFeedback = false) => {
    setIsSyncingAccounts(true);
    try {
      // Pull accounts exclusively from Sheet 6_AKUN_APLIKASI in Google Spreadsheet
      const sheetRows = await fetchUptListFromGoogleAppsScript(gasUrl, true);
      if (sheetRows.length > 0) {
        const merged = mergeSheetSchoolsWithLocal(sheetRows);
        setUptSchools(merged);
        saveUptSchools(merged, false);
        setSelectedUpt((prevUpt) => {
          const match = merged.find(
            (s) => normalizeUptKey(s.upt) === normalizeUptKey(prevUpt || schoolInfo.namaSekolah)
          );
          return match ? match.upt : merged[0]?.upt || prevUpt;
        });
        if (showFeedback) {
          setUploadNotice(`Data 6_AKUN_APLIKASI dari Google Spreadsheet berhasil dimuat (${merged.length} akun UPT).`);
          setTimeout(() => setUploadNotice(''), 4000);
        }
      } else {
        setUptSchools([]);
        if (showFeedback) {
          setUploadNotice('Belum ada baris akun di lembar 6_AKUN_APLIKASI Google Spreadsheet.');
          setTimeout(() => setUploadNotice(''), 4000);
        }
      }
    } finally {
      setIsSyncingAccounts(false);
    }
  };

  useEffect(() => {
    syncAkunAplikasiDatabase(false);
  }, [gasUrl, schoolInfo.namaSekolah]);

  const filteredUptSchools = filterUptSchools(uptSchools, uptSearchQuery);

  const handleUptChange = (newUpt: string) => {
    setSelectedUpt(newUpt);
    setLoginError('');
    setShowUptSuggestions(false);
  };

  const handleUploadDatabaseFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const fileNameLower = file.name.toLowerCase();
    if (fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls')) {
      try {
        const parsed = await parseMasterDatabaseSpreadsheet(file, schoolInfo);
        if (parsed.importedAccounts.length > 0) {
          setUptSchools(parsed.importedAccounts);
          saveUptSchools(parsed.importedAccounts, false);
          setSelectedUpt(parsed.importedAccounts[0].upt);
          setUptSearchQuery('');
          setLoginError('');
          setUploadNotice(
            `Berhasil memuat ${parsed.importedAccounts.length} akun UPT dari lembar 6_AKUN_APLIKASI pada file "${file.name}".`
          );
          setTimeout(() => setUploadNotice(''), 5000);
        } else {
          setLoginError('Tidak ditemukan data akun pada lembar 6_AKUN_APLIKASI di file Excel tersebut.');
        }
      } catch (err: any) {
        setLoginError(`Gagal membaca file Database Excel: ${err.message || 'Format tidak didukung'}`);
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || '');
      const parsed = parseSchoolSpreadsheetCsv(content);
      if (parsed.length > 0) {
        setUptSchools(parsed);
        saveUptSchools(parsed, false);
        setSelectedUpt(parsed[0].upt);
        setUptSearchQuery('');
        setLoginError('');
        setUploadNotice(`Berhasil memuat ${parsed.length} akun UPT ke 6_AKUN_APLIKASI dari file "${file.name}".`);
        setTimeout(() => setUploadNotice(''), 5000);
      } else {
        setLoginError('Format file spreadsheet tidak valid atau tidak ditemukan kolom UPT / Username.');
      }
    };
    reader.readAsText(file);
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
      // Verify exclusively against Google Spreadsheet (Sheet 6_AKUN_APLIKASI)
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
        return;
      }

      setLoginError(
        gasResult.error ||
          'Username, Password, atau Pilihan UPT tidak cocok dengan data pada lembar 6_AKUN_APLIKASI di Google Spreadsheet.'
      );
    } catch {
      setLoginError(
        'Gagal terhubung ke Database Google Spreadsheet (6_AKUN_APLIKASI). Periksa koneksi internet Anda.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeSchoolObj = uptSchools.find((s) => s.upt === selectedUpt);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between selection:bg-emerald-500 selection:text-white">
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
      </div>

      {/* Header Bar */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-emerald-900/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-white text-sm sm:text-base tracking-tight">
                  PEMERINTAH KABUPATEN MINAHASA TENGGARA
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  TA {selectedYear}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Sistem Penginputan Belanja & Persediaan Sekolah (UPT) BOSP Per Triwulan
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 text-xs">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Database: 6_AKUN_APLIKASI ({uptSchools.length} Akun)</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Login Card Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 my-4">
        <div className="bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 max-w-lg w-full overflow-hidden">
          {/* Card Top Title Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-6 text-white text-center relative">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-md">
              <Shield className="w-6 h-6" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Portal Masuk UPT Sekolah BOSP
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-sm mx-auto">
              Autentikasi langsung berdasarkan Database Spreadsheet lembar <strong className="text-emerald-300">6_AKUN_APLIKASI</strong>.
            </p>
          </div>

          {/* Database 6_AKUN_APLIKASI Status & Quick Sync Bar */}
          <div className="bg-emerald-50/90 border-b border-emerald-100 px-5 py-2.5 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-emerald-900 truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="font-bold truncate">Sheet: 6_AKUN_APLIKASI ({uptSchools.length} UPT)</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => syncAkunAplikasiDatabase(true)}
                disabled={isSyncingAccounts}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold text-[11px] flex items-center gap-1 transition-colors disabled:opacity-60"
                title="Tarik data terbaru dari 6_AKUN_APLIKASI"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncingAccounts ? 'animate-spin' : ''}`} />
                <span>Segarkan</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-[11px] flex items-center gap-1 transition-colors"
                title="Upload file Database Spreadsheet (.xlsx) yang memuat 6_AKUN_APLIKASI"
              >
                <Upload className="w-3 h-3" />
                <span>Impor .xlsx</span>
              </button>
            </div>
          </div>

          {/* Single Login Header Bar */}
          <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold">
            <div className="flex-1 py-3.5 text-center flex items-center justify-center gap-2 border-b-2 border-emerald-600 text-emerald-800 bg-white shadow-xs">
              <LogIn className="w-4 h-4 text-[12px] bg-[#f7efef]" />
              <span className="text-[31px] font-['Verdana'] leading-[28px]">LOGIN</span>
            </div>
          </div>

          {/* Card Body - LOGIN FORM */}
          <div className="p-6">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.txt,.tsv"
              onChange={handleUploadDatabaseFile}
              className="hidden"
            />

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {uploadNotice && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{uploadNotice}</span>
                </div>
              )}

              {loginError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 space-y-2 text-xs text-rose-900" role="alert">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{loginError}</span>
                  </div>
                </div>
              )}

              {/* PILIHAN TAHUN LOGIN / TAHUN ANGGARAN (2025, 2026, 2027) */}
              <div>
                <label htmlFor="login-year-select" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tahun Anggaran <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    id="login-year-select"
                    aria-label="Pilih Tahun Login"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-8 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:opacity-75 transition-all"
                  >
                    {LOGIN_YEARS.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* PILIHAN UPT SEKOLAH & SEARCH DIJADIKAN 1 TOMBOL / DROPDOWN */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="login-upt-button" className="block text-xs font-bold text-slate-700">
                    SATUAN PENDIDIKAN (6_AKUN_APLIKASI) <span className="text-rose-500">*</span>
                  </label>
                </div>

                {/* Unified UPT Search & Select 1 Button Component */}
                <div className="relative" ref={uptDropdownRef}>
                  <button
                    id="login-upt-button"
                    type="button"
                    onClick={() => setShowUptSuggestions(!showUptSuggestions)}
                    disabled={isSubmitting}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-3 text-xs text-slate-900 flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:opacity-75 transition-all text-left shadow-xs"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className={`truncate font-bold ${!selectedUpt ? 'text-slate-400 font-normal' : 'text-slate-900'}`}>
                        {selectedUpt || '-- Pilih UPT Sekolah --'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
                      <Search className="w-3.5 h-3.5 text-emerald-600" />
                      <ChevronDown className="w-3.5 h-3.5" />
                    </div>
                  </button>

                  {/* Dropdown Popup with built-in search */}
                  {showUptSuggestions && (
                    <div className="absolute z-40 left-0 right-0 mt-1.5 bg-white border border-emerald-300 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
                      <div className="p-2.5 border-b border-slate-100 bg-slate-50">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            value={uptSearchQuery}
                            onChange={(e) => setUptSearchQuery(e.target.value)}
                            placeholder="Ketik untuk mencari UPT / sekolah..."
                            className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            autoFocus
                          />
                          {uptSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setUptSearchQuery('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                        {filteredUptSchools.length > 0 ? (
                          filteredUptSchools.map((school) => (
                            <button
                              key={school.id}
                              type="button"
                              onClick={() => {
                                handleUptChange(school.upt);
                                setShowUptSuggestions(false);
                                setUptSearchQuery('');
                              }}
                              className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between hover:bg-emerald-50 transition-colors ${
                                selectedUpt === school.upt
                                  ? 'bg-emerald-50 font-bold text-emerald-900'
                                  : 'text-slate-700'
                              }`}
                            >
                              <div className="truncate">
                                <span className="block truncate font-semibold">{school.upt}</span>
                                <span className="text-[10px] text-slate-400">{school.kecamatan}</span>
                              </div>
                              {selectedUpt === school.upt && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 ml-2" />
                              )}
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-xs text-slate-500 text-center">
                            Tidak ada UPT yang cocok dengan &quot;{uptSearchQuery}&quot;
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {activeSchoolObj && (
                  <p className="text-[11px] text-slate-500 flex items-center justify-between px-1">
                    <span>Kecamatan: <strong>{activeSchoolObj.kecamatan}</strong></span>
                    <span>NPSN: <strong>{activeSchoolObj.npsn}</strong></span>
                  </p>
                )}
              </div>

              {/* USERNAME (Kolom C pada 6_AKUN_APLIKASI) */}
              <div>
                <label htmlFor="login-username-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Username <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-username-input"
                    type="text"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder={activeSchoolObj ? `Contoh: ${activeSchoolObj.username}` : 'Masukkan username sekolah'}
                    disabled={isSubmitting}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:opacity-75 transition-all"
                    autoFocus
                  />
                </div>
              </div>

              {/* PASSWORD (Kolom D pada 6_AKUN_APLIKASI) */}
              <div>
                <label htmlFor="login-password-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-password-input"
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Masukkan kata sandi sesuai 6_AKUN_APLIKASI"
                    disabled={isSubmitting}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:opacity-75 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showLoginPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-emerald-700/20 transition-all active:scale-95 disabled:opacity-70 mt-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memverifikasi Akun di 6_AKUN_APLIKASI...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>
                      {selectedUpt
                        ? `Masuk ke ${selectedUpt}`
                        : 'Masuk ke Sistem BOSP'}
                    </span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="relative z-10 py-4 px-4 text-center border-t border-slate-900 bg-slate-950/80 text-xs text-slate-500">
        <p>&copy; 2026 Dinas Pendidikan Kabupaten Minahasa Tenggara &bull; Sistem Persediaan & Belanja BOSP</p>
      </footer>
    </div>
  );
};
