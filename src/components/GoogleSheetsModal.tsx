import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sheet, 
  ExternalLink, 
  RotateCw, 
  Plus, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Upload, 
  LogOut,
  FolderOpen,
  Search,
  Check
} from 'lucide-react';
import { User } from 'firebase/auth';
import { SchoolExpense, SchoolInfo, BarangEkstraItem } from '../types';
import { 
  initGoogleAuth, 
  signInWithGoogle, 
  signOutGoogle, 
  getGoogleAccessToken, 
  GoogleAuthState 
} from '../services/googleAuth';
import { 
  listSpreadsheets, 
  getSpreadsheetDetails, 
  createBospSpreadsheet, 
  syncExpensesToSpreadsheet, 
  fetchMasterDatabaseFromSpreadsheet,
  DriveSpreadsheetFile,
  SheetMetadata
} from '../services/googleSheetsApi';
import { ParseMasterDatabaseResult } from '../utils/databaseSpreadsheet';
import { pullFromGoogleSpreadsheetLink, getSavedGoogleSpreadsheetUrl } from '../utils/googleAppsScriptCode';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolInfo: SchoolInfo;
  expenses: SchoolExpense[];
  barangEkstraItems?: BarangEkstraItem[];
  onImportExpenses: (imported: SchoolExpense[], replaceAll?: boolean) => void;
  onApplyMasterDatabase?: (result: ParseMasterDatabaseResult, replaceAll?: boolean) => void;
  onSyncSuccessNotification?: (msg: string) => void;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  schoolInfo,
  expenses,
  barangEkstraItems = [],
  onImportExpenses,
  onApplyMasterDatabase,
  onSyncSuccessNotification,
}) => {
  const [googleState, setGoogleState] = useState<GoogleAuthState>({
    user: null,
    accessToken: null,
    isAuthenticated: false,
  });
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [activeSpreadsheetId, setActiveSpreadsheetId] = useState<string>(() => {
    return localStorage.getItem('bosp_active_sheet_id') || getSavedGoogleSpreadsheetUrl() || '';
  });
  const [sheetDetails, setSheetDetails] = useState<SheetMetadata | null>(null);

  // Drive Spreadsheet listing
  const [driveFiles, setDriveFiles] = useState<DriveSpreadsheetFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [manualSheetInput, setManualSheetInput] = useState('');

  // Operations state
  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Confirmation dialogs (MANDATORY for mutating/destructive operations)
  const [confirmSyncOpen, setConfirmSyncOpen] = useState(false);
  const [confirmImportOpen, setConfirmImportOpen] = useState(false);
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false);

  // Initialize Auth state listener
  useEffect(() => {
    const unsubscribe = initGoogleAuth((state) => {
      setGoogleState(state);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // When authenticated, load spreadsheet metadata or files
  useEffect(() => {
    if (googleState.isAuthenticated && googleState.accessToken) {
      if (activeSpreadsheetId) {
        loadDetails(activeSpreadsheetId);
      }
      loadDriveFiles();
    } else {
      setDriveFiles([]);
      setSheetDetails(null);
    }
  }, [googleState.isAuthenticated, googleState.accessToken, activeSpreadsheetId]);

  const loadDetails = async (id: string) => {
    try {
      const token = await getGoogleAccessToken();
      if (!token) return;
      const details = await getSpreadsheetDetails(token, id);
      setSheetDetails(details);
    } catch (err: any) {
      console.warn('Gagal memuat detail sheet:', err.message);
    }
  };

  const loadDriveFiles = async () => {
    try {
      setIsLoadingFiles(true);
      const token = await getGoogleAccessToken();
      if (!token) return;
      const files = await listSpreadsheets(token);
      setDriveFiles(files);
    } catch (err: any) {
      console.error('Drive files error:', err);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleSignIn = async () => {
    setIsAuthenticating(true);
    setStatusMessage(null);
    try {
      const res = await signInWithGoogle();
      setGoogleState({
        user: res.user,
        accessToken: res.accessToken,
        isAuthenticated: true,
      });
      setStatusMessage({ type: 'success', text: `Berhasil terhubung dengan Google (${res.user.email}).` });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Gagal login dengan akun Google.' });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSignOut = async () => {
    await signOutGoogle();
    setGoogleState({ user: null, accessToken: null, isAuthenticated: false });
    setStatusMessage({ type: 'info', text: 'Telah keluar dari akun Google.' });
  };

  const handleSelectSpreadsheet = (id: string) => {
    setActiveSpreadsheetId(id);
    localStorage.setItem('bosp_active_sheet_id', id);
    loadDetails(id);
    setStatusMessage({ type: 'info', text: 'Spreadsheet target aktif dipilih.' });
  };

  const handleSetManualId = () => {
    let cleanId = manualSheetInput.trim();
    const urlMatch = cleanId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (urlMatch && urlMatch[1]) {
      cleanId = urlMatch[1];
    }
    if (!cleanId) return;
    handleSelectSpreadsheet(cleanId);
    setManualSheetInput('');
  };

  // Execution of Create Spreadsheet with User Confirmation
  const executeCreateNewSpreadsheet = async () => {
    setConfirmCreateOpen(false);
    setIsBusy(true);
    setStatusMessage(null);
    try {
      const token = await getGoogleAccessToken();
      if (!token) throw new Error('Silakan login dengan Google terlebih dahulu.');

      const result = await createBospSpreadsheet(token, schoolInfo, expenses, barangEkstraItems);
      handleSelectSpreadsheet(result.spreadsheetId);
      await loadDriveFiles();

      setStatusMessage({
        type: 'success',
        text: `Spreadsheet BOSP baru berhasil dibuat di Google Drive dan ${expenses.length} data belanja serta ${barangEkstraItems.length} inventaris barang ekstra telah disinkronkan.`,
      });
      if (onSyncSuccessNotification) {
        onSyncSuccessNotification('Spreadsheet BOSP baru berhasil dibuat di Google Sheets.');
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Gagal membuat spreadsheet baru.' });
    } finally {
      setIsBusy(false);
    }
  };

  // Execution of Sync to Spreadsheet with User Confirmation
  const executeSync = async () => {
    setConfirmSyncOpen(false);
    if (!activeSpreadsheetId) return;
    setIsBusy(true);
    setStatusMessage(null);
    try {
      const token = await getGoogleAccessToken();
      if (!token) throw new Error('Silakan login dengan Google terlebih dahulu.');

      const result = await syncExpensesToSpreadsheet(token, activeSpreadsheetId, schoolInfo, expenses, barangEkstraItems);
      await loadDetails(activeSpreadsheetId);

      setStatusMessage({
        type: 'success',
        text: `Berhasil menyinkronkan ${expenses.length} transaksi belanja BOSP ke Google Sheets (${result.updatedCells} sel diperbarui).`,
      });
      if (onSyncSuccessNotification) {
        onSyncSuccessNotification('Data belanja BOSP berhasil disinkronkan ke Google Sheets.');
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Gagal menyinkronkan ke Google Sheets.' });
    } finally {
      setIsBusy(false);
    }
  };

  // Execution of Import from Spreadsheet with User Confirmation (Supports all 6 Master Database Sheets)
  const executeImport = async () => {
    setConfirmImportOpen(false);
    if (!activeSpreadsheetId) return;
    setIsBusy(true);
    setStatusMessage(null);
    try {
      const token = await getGoogleAccessToken();
      if (token) {
        const parsed = await fetchMasterDatabaseFromSpreadsheet(token, activeSpreadsheetId, schoolInfo);
        if (onApplyMasterDatabase) {
          onApplyMasterDatabase(parsed, true);
        } else if (parsed.importedExpenses.length > 0) {
          onImportExpenses(parsed.importedExpenses, true);
        }
        setStatusMessage({
          type: 'success',
          text: `Berhasil memperbarui aplikasi dari Google Sheets: ${parsed.importedExpenses.length} transaksi belanja, ${parsed.barangEkstraCount} barang ekstra, dan ${parsed.akunCount} akun UPT.`,
        });
        return;
      }

      // Fallback if not logged in via OAuth: pull via public link export
      const pullRes = await pullFromGoogleSpreadsheetLink(activeSpreadsheetId, schoolInfo);
      if (pullRes.success && pullRes.parsed) {
        if (onApplyMasterDatabase) {
          onApplyMasterDatabase(pullRes.parsed, true);
        } else if (pullRes.parsed.importedExpenses.length > 0) {
          onImportExpenses(pullRes.parsed.importedExpenses, true);
        }
        setStatusMessage({
          type: 'success',
          text: pullRes.message,
        });
      } else {
        throw new Error(pullRes.message || 'Silakan login dengan Google terlebih dahulu.');
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Gagal mengimpor dari Google Sheets.' });
    } finally {
      setIsBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sheet className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base sm:text-lg flex items-center gap-2">
                Integrasi Google Sheets & Drive
              </h3>
              <p className="text-xs text-slate-400">
                Kelola, sinkronkan, dan ekspor data belanja BOSP ke Google Spreadsheet
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-slate-200 text-xs sm:text-sm">
          {/* Status Message Banner */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs animate-fadeIn ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : statusMessage.type === 'error'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span className="flex-1 leading-relaxed">{statusMessage.text}</span>
            </div>
          )}

          {/* 1. Google Authentication Section */}
          <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Status Autentikasi Google
              </span>
              {googleState.isAuthenticated && (
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Terhubung
                </span>
              )}
            </div>

            {googleState.isAuthenticated && googleState.user ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-3">
                  {googleState.user.photoURL ? (
                    <img
                      src={googleState.user.photoURL}
                      alt="Google Avatar"
                      className="w-9 h-9 rounded-full border border-emerald-500/50"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                      {googleState.user.displayName?.charAt(0) || googleState.user.email?.charAt(0) || 'G'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate text-xs sm:text-sm">
                      {googleState.user.displayName || 'Pengguna Google'}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate font-mono">
                      {googleState.user.email}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-rose-300 bg-slate-700/70 hover:bg-slate-700 border border-slate-600 transition-colors shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Putuskan Akun</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Hubungkan dengan akun Google Anda untuk membuat atau memperbarui spreadsheet BOSP secara langsung di Google Sheets dan Google Drive Anda dengan izin pengguna.
                </p>

                {/* Official Sign in with Google Button */}
                <div className="pt-1">
                  <button
                    onClick={handleSignIn}
                    disabled={isAuthenticating}
                    className="gsi-material-button shadow-md disabled:opacity-60"
                    type="button"
                    aria-label="Sign in with Google"
                  >
                    <div className="gsi-material-button-state"></div>
                    <div className="gsi-material-button-content-wrapper">
                      <div className="gsi-material-button-icon">
                        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                          <path fill="none" d="M0 0h48v48H0z"></path>
                        </svg>
                      </div>
                      <span className="gsi-material-button-contents">
                        {isAuthenticating ? 'Menghubungkan...' : 'Sign in with Google'}
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 2. Target Spreadsheet Section */}
          {googleState.isAuthenticated && (
            <div className="space-y-4">
              {/* Active Selected Spreadsheet Card */}
              {sheetDetails ? (
                <div className="p-4 rounded-xl bg-slate-800/60 border border-emerald-500/30 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                        Spreadsheet BOSP Aktif
                      </span>
                      <h4 className="font-bold text-white text-sm sm:text-base truncate">
                        {sheetDetails.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 font-mono truncate">
                        ID: {sheetDetails.id}
                      </p>
                    </div>

                    <a
                      href={sheetDetails.spreadsheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-sm shrink-0 self-start sm:self-center"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Buka di Google Sheets</span>
                    </a>
                  </div>

                  {/* Tabs indicator */}
                  <div className="pt-2 border-t border-slate-700/60 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-slate-400">Lembar Tersedia:</span>
                    {sheetDetails.sheets.map((s) => (
                      <span
                        key={s.sheetId}
                        className="px-2 py-0.5 rounded text-[10px] bg-slate-700 text-slate-300 font-medium"
                      >
                        {s.title}
                      </span>
                    ))}
                  </div>

                  {/* Action buttons: Sync and Import */}
                  <div className="pt-2 flex flex-wrap gap-2.5">
                    <button
                      onClick={() => setConfirmSyncOpen(true)}
                      disabled={isBusy}
                      className="flex-1 min-w-[170px] inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all disabled:opacity-50"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Sinkronkan ke Google Sheets ({expenses.length} data)</span>
                    </button>

                    <button
                      onClick={() => setConfirmImportOpen(true)}
                      disabled={isBusy}
                      className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition-all disabled:opacity-50"
                    >
                      <Download className="w-4 h-4 text-emerald-400" />
                      <span>Impor dari Google Sheets</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                  <p className="font-semibold">Belum ada spreadsheet target yang dipilih.</p>
                  <p className="text-amber-300/80 mt-1">
                    Buat spreadsheet BOSP baru di bawah ini atau pilih salah satu spreadsheet dari Google Drive Anda.
                  </p>
                </div>
              )}

              {/* Create New BOSP Spreadsheet Button */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h5 className="font-semibold text-white text-xs sm:text-sm">
                    Buat Spreadsheet BOSP Baru
                  </h5>
                  <p className="text-[11px] text-slate-400">
                    Otomatis membuat tab Ringkasan Pagu, Semua Belanja, TW1, TW2, TW3, dan TW4 berformat standar Kemdikbud.
                  </p>
                </div>
                <button
                  onClick={() => setConfirmCreateOpen(true)}
                  disabled={isBusy}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 hover:border-emerald-400 transition-all shrink-0 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>Buat Spreadsheet Baru</span>
                </button>
              </div>

              {/* Choose from Google Drive Spreadsheets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300 text-xs flex items-center gap-1.5">
                    <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
                    Pilih Dari Google Drive Anda
                  </span>
                  <button
                    onClick={loadDriveFiles}
                    disabled={isLoadingFiles}
                    className="text-slate-400 hover:text-white text-[11px] flex items-center gap-1"
                  >
                    <RotateCw className={`w-3 h-3 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                    <span>Muat Ulang</span>
                  </button>
                </div>

                {isLoadingFiles ? (
                  <div className="py-6 text-center text-slate-400 text-xs">
                    Memuat daftar spreadsheet dari Google Drive...
                  </div>
                ) : driveFiles.length > 0 ? (
                  <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                    {driveFiles.map((file) => {
                      const isSelected = activeSpreadsheetId === file.id;
                      return (
                        <div
                          key={file.id}
                          onClick={() => handleSelectSpreadsheet(file.id)}
                          className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-center justify-between gap-2 transition-all ${
                            isSelected
                              ? 'bg-emerald-600/20 border-emerald-500 text-white font-medium'
                              : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <FileSpreadsheet className={`w-4 h-4 shrink-0 ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`} />
                            <span className="truncate">{file.name}</span>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 text-center text-slate-400 text-xs bg-slate-800/30 rounded-lg border border-slate-800">
                    Tidak ditemukan file spreadsheet di Google Drive Anda.
                  </div>
                )}

                {/* Manual Input Spreadsheet ID / Link */}
                <div className="pt-2 flex gap-2">
                  <input
                    type="text"
                    value={manualSheetInput}
                    onChange={(e) => setManualSheetInput(e.target.value)}
                    placeholder="Atau tempel Link / ID Google Spreadsheet..."
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    onClick={handleSetManualId}
                    disabled={!manualSheetInput.trim()}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 disabled:opacity-50"
                  >
                    Gunakan
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
          <p className="text-[11px] text-slate-400">
            {expenses.length} transaksi belanja tersimpan di sistem
          </p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* CONFIRMATION DIALOG 1: CREATE SPREADSHEET (MANDATORY MUTATION CONFIRMATION) */}
      {confirmCreateOpen && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-base">Buat Spreadsheet BOSP?</h4>
                <p className="text-xs text-slate-400">Google Sheets API</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Tindakan ini akan membuat file Google Spreadsheet baru di akun Google Drive Anda dengan judul:
              <br />
              <strong className="text-emerald-300 block mt-1">
                BOSP {schoolInfo.namaSekolah} - TA {schoolInfo.tahunAnggaran}
              </strong>
              dan langsung mengunggah {expenses.length} baris belanja beserta ringkasan pagu per triwulan.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setConfirmCreateOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                onClick={executeCreateNewSpreadsheet}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
              >
                Ya, Buat Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG 2: SYNC / OVERWRITE SPREADSHEET (MANDATORY MUTATION CONFIRMATION) */}
      {confirmSyncOpen && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-base">Perbarui Data di Google Sheets?</h4>
                <p className="text-xs text-slate-400">Konfirmasi Sinkronisasi Data</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Anda akan memperbarui spreadsheet target dengan <strong>{expenses.length} data belanja</strong> dan rekapitulasi pagu terbaru.
              <br />
              <span className="text-amber-300 block mt-1.5 font-medium">
                Data pada tab 'Ringkasan Pagu', 'Semua Belanja', dan Triwulan terkait akan diperbarui sesuai data di aplikasi.
              </span>
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setConfirmSyncOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                onClick={executeSync}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
              >
                Konfirmasi & Sinkronkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG 3: IMPORT SPREADSHEET (MANDATORY MUTATION CONFIRMATION) */}
      {confirmImportOpen && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-base">Impor Belanja dari Google Sheets?</h4>
                <p className="text-xs text-slate-400">Konfirmasi Impor Data</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Aplikasi akan membaca baris transaksi pada sheet <strong>'Semua Belanja'</strong> dari Google Spreadsheet Anda dan memperbarui daftar belanja lokal di aplikasi.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setConfirmImportOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                onClick={executeImport}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm"
              >
                Konfirmasi Impor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
