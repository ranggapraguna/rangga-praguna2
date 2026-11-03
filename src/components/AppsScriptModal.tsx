import React, { useState, useEffect } from 'react';
import {
  X,
  Code2,
  Copy,
  Check,
  Download,
  ExternalLink,
  Sparkles,
  Terminal,
  BookOpen,
  CheckCircle2,
  Link2,
  RotateCw,
  Send,
  AlertCircle,
  Wifi
} from 'lucide-react';
import {
  APPSCRIPT_REKAPAN_SE_DINAS,
  DO_POST_SNIPPET_ONLY,
  DEFAULT_REKAPAN_GAS_URL,
  getRekapanGasUrl,
  saveRekapanGasUrl,
  getSavedGoogleSpreadsheetUrl,
  saveGoogleSpreadsheetUrl,
  checkRekapanGasConnection,
  syncAllDataToRekapanGas,
  pullAllDataFromRekapanGas,
  pullFromGoogleSpreadsheetLink,
  RekapanGasStatusResult
} from '../utils/googleAppsScriptCode';
import { downloadMasterDatabaseSpreadsheet, ParseMasterDatabaseResult } from '../utils/databaseSpreadsheet';
import { loadUptSchools } from '../data/schoolData';
import { SchoolExpense, SchoolInfo, BarangEkstraItem } from '../types';

interface AppsScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolInfo?: SchoolInfo;
  expenses?: SchoolExpense[];
  barangEkstraItems?: BarangEkstraItem[];
  onApplyMasterDatabase?: (result: ParseMasterDatabaseResult, replaceAll?: boolean) => void;
  onNotify?: (msg: string, type?: 'success' | 'info') => void;
}

export const AppsScriptModal: React.FC<AppsScriptModalProps> = ({
  isOpen,
  onClose,
  schoolInfo,
  expenses = [],
  barangEkstraItems = [],
  onApplyMasterDatabase,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useState<'connect' | 'code' | 'guide'>('connect');
  const [copied, setCopied] = useState(false);
  const [copiedDoPost, setCopiedDoPost] = useState(false);

  // Connection state
  const [gasUrlInput, setGasUrlInput] = useState<string>(() => getRekapanGasUrl());
  const [sheetLinkInput, setSheetLinkInput] = useState<string>(() => getSavedGoogleSpreadsheetUrl());
  const [isChecking, setIsChecking] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<RekapanGasStatusResult | null>(null);
  const [syncResultMsg, setSyncResultMsg] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
    needsScriptUpdate?: boolean;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const currentUrl = getRekapanGasUrl();
      setGasUrlInput(currentUrl);
      setSheetLinkInput(getSavedGoogleSpreadsheetUrl());
      handleTestConnection(currentUrl);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async (targetUrl?: string) => {
    const urlToTest = (targetUrl || gasUrlInput || DEFAULT_REKAPAN_GAS_URL).trim();
    setIsChecking(true);
    setSyncResultMsg(null);
    try {
      saveRekapanGasUrl(urlToTest);
      const res = await checkRekapanGasConnection(urlToTest);
      setConnectionStatus(res);
      if (res.connected) {
        onNotify?.('Berhasil terhubung ke Web App Google Apps Script Rekapan Se-Dinas!', 'success');
      }
    } finally {
      setIsChecking(false);
    }
  };

  const handleSyncToGas = async () => {
    if (!schoolInfo) return;
    const urlToUse = (gasUrlInput || DEFAULT_REKAPAN_GAS_URL).trim();
    saveRekapanGasUrl(urlToUse);
    setIsSyncing(true);
    setSyncResultMsg(null);
    try {
      const result = await syncAllDataToRekapanGas(
        {
          schoolInfo,
          expenses,
          barangEkstraItems,
        },
        urlToUse
      );

      if (result.success) {
        setSyncResultMsg({
          type: 'success',
          text: result.message,
        });
        onNotify?.(result.message, 'success');
        const updatedStatus = await checkRekapanGasConnection(urlToUse);
        setConnectionStatus(updatedStatus);
      } else if (result.needsScriptUpdate) {
        setSyncResultMsg({
          type: 'warning',
          text: result.message,
          needsScriptUpdate: true,
        });
      } else {
        setSyncResultMsg({
          type: 'error',
          text: result.message,
        });
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePullFromGas = async () => {
    if (!schoolInfo) return;
    const urlToUse = (gasUrlInput || DEFAULT_REKAPAN_GAS_URL).trim();
    saveRekapanGasUrl(urlToUse);
    setIsPulling(true);
    setSyncResultMsg(null);
    try {
      const res = await pullAllDataFromRekapanGas(schoolInfo, urlToUse);
      if (res.success && res.parsed) {
        onApplyMasterDatabase?.(res.parsed, true);
        setSyncResultMsg({
          type: 'success',
          text: res.message,
        });
        onNotify?.(res.message, 'success');
        return;
      }

      if (sheetLinkInput.trim()) {
        const directRes = await pullFromGoogleSpreadsheetLink(sheetLinkInput, schoolInfo);
        if (directRes.success && directRes.parsed) {
          onApplyMasterDatabase?.(directRes.parsed, true);
          setSyncResultMsg({
            type: 'success',
            text: directRes.message,
          });
          onNotify?.(directRes.message, 'success');
          return;
        }
      }

      setSyncResultMsg({
        type: res.needsScriptUpdate ? 'warning' : 'error',
        text: res.message,
        needsScriptUpdate: res.needsScriptUpdate,
      });
    } finally {
      setIsPulling(false);
    }
  };

  const handlePullFromSheetLink = async () => {
    if (!schoolInfo) return;
    if (!sheetLinkInput.trim()) {
      setSyncResultMsg({
        type: 'warning',
        text: 'Silakan tempel Link atau ID Google Spreadsheet Anda terlebih dahulu.',
      });
      return;
    }
    saveGoogleSpreadsheetUrl(sheetLinkInput.trim());
    setIsPulling(true);
    setSyncResultMsg(null);
    try {
      const res = await pullFromGoogleSpreadsheetLink(sheetLinkInput.trim(), schoolInfo);
      if (res.success && res.parsed) {
        onApplyMasterDatabase?.(res.parsed, true);
        setSyncResultMsg({
          type: 'success',
          text: res.message,
        });
        onNotify?.(res.message, 'success');
      } else {
        setSyncResultMsg({
          type: 'error',
          text: res.message,
        });
      }
    } finally {
      setIsPulling(false);
    }
  };

  const handleCopyDoPostOnly = async () => {
    try {
      await navigator.clipboard.writeText(DO_POST_SNIPPET_ONLY);
      setCopiedDoPost(true);
      onNotify?.('Fungsi doPost(e) berhasil disalin! Tempel di bagian paling bawah Apps Script Anda.', 'success');
      setTimeout(() => setCopiedDoPost(false), 3000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = DO_POST_SNIPPET_ONLY;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedDoPost(true);
      onNotify?.('Fungsi doPost(e) berhasil disalin!', 'success');
      setTimeout(() => setCopiedDoPost(false), 3000);
    }
  };

  const handleDownloadExcelDatabase = () => {
    if (!schoolInfo) return;
    downloadMasterDatabaseSpreadsheet({
      schoolInfo,
      expenses,
      barangEkstraItems,
      masterSchools: loadUptSchools(),
    });
    onNotify?.('File Excel (.xlsx) 6 Lembar Kerja berhasil diunduh!', 'success');
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(APPSCRIPT_REKAPAN_SE_DINAS);
      setCopied(true);
      onNotify?.('Kode Google Apps Script berhasil disalin ke clipboard!', 'success');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = APPSCRIPT_REKAPAN_SE_DINAS;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      onNotify?.('Kode Google Apps Script berhasil disalin!', 'success');
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleDownloadFile = () => {
    const blob = new Blob([APPSCRIPT_REKAPAN_SE_DINAS], { type: 'text/javascript;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'RekapanSeDinas.gs');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onNotify?.('File RekapanSeDinas.gs berhasil diunduh!', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-teal-950/40 via-slate-900 to-emerald-950/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/20 text-white shrink-0">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  TERHUBUNG KE APPS SCRIPT
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  RekapanSeDinas.gs
                </span>
              </div>
              <h2 className="text-lg font-black text-white leading-tight mt-0.5">
                Koneksi &amp; Otomasi Google Apps Script Rekapan Se-Dinas
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
            aria-label="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-800 px-5 gap-2 bg-slate-950/40 text-xs font-bold overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('connect')}
            className={`py-3 px-3.5 border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'connect'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Koneksi Web App (Aktif)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('code')}
            className={`py-3 px-3.5 border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'code'
                ? 'border-teal-500 text-teal-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Source Code Script (.gs)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('guide')}
            className={`py-3 px-3.5 border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'guide'
                ? 'border-teal-500 text-teal-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Panduan Pemasangan</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-slate-200">
          {activeTab === 'connect' && (
            <div className="space-y-5">
              {/* Active Endpoint Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/50 via-slate-800/60 to-slate-900 border border-emerald-500/40 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Wifi className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-black text-white">
                      Endpoint Web App Google Apps Script Rekapan Se-Dinas
                    </h3>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${
                      connectionStatus?.connected
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : isChecking
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        connectionStatus?.connected
                          ? 'bg-emerald-400 animate-pulse'
                          : isChecking
                          ? 'bg-amber-400 animate-ping'
                          : 'bg-slate-400'
                      }`}
                    />
                    {isChecking
                      ? 'Memeriksa Koneksi...'
                      : connectionStatus?.connected
                      ? 'TERHUBUNG AKTIF'
                      : 'Siap Dihubungkan'}
                  </span>
                </div>

                {/* URL Input & Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={gasUrlInput}
                    onChange={(e) => setGasUrlInput(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleTestConnection()}
                      disabled={isChecking}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
                    >
                      <RotateCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                      <span>Tes Koneksi</span>
                    </button>

                    <a
                      href={gasUrlInput || DEFAULT_REKAPAN_GAS_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all"
                      title="Buka URL Endpoint di Tab Baru"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Buka URL</span>
                    </a>
                  </div>
                </div>

                {/* Live Connection Status Diagnostic */}
                {connectionStatus && (
                  <div
                    className={`p-3.5 rounded-xl border text-xs flex items-start gap-3 ${
                      connectionStatus.connected && connectionStatus.sheetInitialized
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                        : connectionStatus.connected
                        ? 'bg-teal-950/40 border-teal-500/40 text-teal-200'
                        : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                    }`}
                  >
                    {connectionStatus.connected ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1 flex-1">
                      <p className="font-bold">
                        {connectionStatus.connected
                          ? 'Status Endpoint: Terhubung ke Google Apps Script'
                          : 'Status Endpoint: Gagal Menghubungi URL'}
                      </p>
                      <p className="text-[11px] opacity-90 leading-relaxed">
                        {connectionStatus.message}
                      </p>
                      {connectionStatus.data && connectionStatus.data.length > 0 && (
                        <p className="text-[11px] font-bold text-emerald-300 pt-1">
                          • Terbaca {connectionStatus.data.length} baris rekapitulasi UPT Sekolah dari Google Sheets.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Synchronization Action Card */}
              {schoolInfo && (
                <div className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700/80 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-white flex items-center gap-2">
                        <Send className="w-3.5 h-3.5 text-emerald-400" />
                        Sinkronisasi 2 Arah (6 Lembar Kerja) antara Aplikasi &amp; Google Sheets
                      </h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        <b>Kirim ke Sheets:</b> Menyimpan data aplikasi ke Google Spreadsheet.{' '}
                        <b>Tarik dari Sheets:</b> Mengambil perubahan yang Anda ketik di Google Spreadsheet agar langsung terubah di aplikasi.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleSyncToGas}
                        disabled={isSyncing || isPulling}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-emerald-600/25 transition-all cursor-pointer active:scale-95"
                      >
                        <Send className={`w-3.5 h-3.5 ${isSyncing ? 'animate-bounce' : ''}`} />
                        <span>
                          {isSyncing ? 'Menyinkronkan ke Sheets...' : 'Kirim Data ke Sheets'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handlePullFromGas}
                        disabled={isPulling || isSyncing}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-indigo-600/25 transition-all cursor-pointer active:scale-95"
                        title="Ambil perubahan data dari 6 lembar kerja Google Sheets ke dalam aplikasi"
                      >
                        <RotateCw className={`w-3.5 h-3.5 ${isPulling ? 'animate-spin' : ''}`} />
                        <span>
                          {isPulling ? 'Menarik Data dari Sheets...' : 'Tarik Perubahan dari Sheets'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDownloadExcelDatabase}
                        className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold text-xs border border-slate-600 transition-all cursor-pointer"
                        title="Unduh file Excel (.xlsx) 6 Lembar Kerja siap impor ke Google Sheets"
                      >
                        <Download className="w-3.5 h-3.5 text-teal-400" />
                        <span>Unduh .xlsx (6 Sheet)</span>
                      </button>
                    </div>
                  </div>

                  {/* Direct Google Spreadsheet URL Pull Option (Works without redeploying GAS) */}
                  <div className="pt-3 border-t border-slate-700/70 space-y-2">
                    <label className="text-[11px] font-bold text-teal-300 flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-teal-400" />
                      <span>
                        Alternatif Cepat: Tarik Perubahan Langsung dari Link Google Spreadsheet (Tanpa Perlu Redeploy Script)
                      </span>
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={sheetLinkInput}
                        onChange={(e) => setSheetLinkInput(e.target.value)}
                        placeholder="Tempel link Google Spreadsheet (https://docs.google.com/spreadsheets/d/.../edit)..."
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                      <button
                        type="button"
                        onClick={handlePullFromSheetLink}
                        disabled={isPulling || isSyncing}
                        className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-xs shadow transition-all cursor-pointer shrink-0"
                      >
                        <RotateCw className={`w-3.5 h-3.5 ${isPulling ? 'animate-spin' : ''}`} />
                        <span>Tarik dari Link Spreadsheet</span>
                      </button>
                    </div>
                    <p className="text-[10.5px] text-slate-400">
                      Pastikan akses berbagi Google Spreadsheet disetel ke <b>"Siapa saja yang memiliki link dapat melihat/mengedit"</b>, lalu klik <b>Tarik dari Link Spreadsheet</b> setiap kali Anda selesai mengubah data di Google Sheets.
                    </p>
                  </div>

                  {syncResultMsg && (
                    <div
                      className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                        syncResultMsg.type === 'success'
                          ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                          : syncResultMsg.type === 'warning'
                          ? 'bg-amber-950/60 border-amber-500/40 text-amber-100'
                          : 'bg-rose-950/50 border-rose-500/40 text-rose-200'
                      }`}
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                      <div className="space-y-2.5 flex-1">
                        <p className="leading-relaxed font-medium">{syncResultMsg.text}</p>

                        {syncResultMsg.needsScriptUpdate && (
                          <div className="p-3 rounded-xl bg-slate-950/90 border border-amber-500/30 space-y-2.5">
                            <p className="text-[11px] font-bold text-amber-300">
                              Mengapa muncul pesan ini?
                            </p>
                            <p className="text-[11px] text-slate-300 leading-relaxed">
                              Saat Anda men-deploy URL Web App pertama kali, kode di Google Apps Script baru memiliki fungsi pembaca (<code className="text-emerald-300">doGet</code>) dan belum memiliki fungsi penerima kiriman data (<code className="text-emerald-300">doPost</code>).
                            </p>
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={handleCopyDoPostOnly}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-all cursor-pointer shadow-xs"
                              >
                                {copiedDoPost ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                <span>
                                  {copiedDoPost
                                    ? 'Fungsi doPost(e) Tersalin!'
                                    : '1. Salin Fungsi doPost(e) Saja'}
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={handleCopyCode}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600/30 hover:bg-teal-600/50 text-teal-200 font-bold text-[11px] border border-teal-500/40 cursor-pointer"
                              >
                                <Terminal className="w-3.5 h-3.5" />
                                <span>Salin Seluruh Kode Lengkap</span>
                              </button>

                              <button
                                type="button"
                                onClick={handleDownloadExcelDatabase}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] border border-slate-700 cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5 text-teal-400" />
                                <span>Unduh Excel (.xlsx) 5 Sheet</span>
                              </button>
                            </div>
                            <p className="text-[11px] text-slate-400">
                              Setelah ditempel di bagian paling bawah editor Google Apps Script, klik <b>Simpan (Ctrl+S)</b> &rarr; <b>Deploy &gt; Manage deployments &gt; Edit (Ikon Pensil) &gt; Version: New version &gt; Deploy</b>.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Info Box about Deployment ID */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-semibold">Deployment ID Aktif:</span>
                  <code className="text-teal-300 font-mono text-[11px] bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    AKfycbwf4HgF7IVU7Hthn_fqlruBTdEwOvkcP6BEE5YXCvLSCKVFtGNtsBtIirJk8a39q4AV
                  </code>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Tip: Jika Anda baru memperbarui kode di editor Google Apps Script, klik <b>Deploy &gt; Manage deployments &gt; Edit (Ikon Pensil) &gt; Version: New version &gt; Deploy</b> agar fungsi sinkronisasi otomatis (<code className="text-emerald-300">doPost</code>) langsung aktif pada URL yang sama.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'code' && (
            <div className="space-y-4">
              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                    Kode Lengkap Siap Pasang (Mendukung Menu Sheets + doGet + doPost)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Otomatis membuat menu "📋 Rekapan Se-Dinas", rekapitulasi 1-klik, matriks 32 rekening, serta sinkronisasi dua arah dengan aplikasi web.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm ${
                      copied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-teal-600 hover:bg-teal-500 text-white shadow-teal-600/30'
                    }`}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Tersalin!' : 'Salin Kode Script'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadFile}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold transition-all cursor-pointer border border-slate-600"
                    title="Unduh file RekapanSeDinas.gs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh .gs</span>
                  </button>
                </div>
              </div>

              {/* Code Viewer */}
              <div className="relative rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden shadow-inner">
                <div className="p-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400 px-4 font-mono">
                  <span>RekapanSeDinas.gs • Google Apps Script JavaScript</span>
                  <span className="text-teal-400 font-bold">doGet + doPost + Menu Otomatis</span>
                </div>
                <pre className="p-4 text-xs font-mono text-emerald-300 overflow-x-auto max-h-[420px] leading-relaxed selection:bg-teal-800">
                  <code>{APPSCRIPT_REKAPAN_SE_DINAS}</code>
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'guide' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-950/40 via-slate-800/40 to-slate-900 border border-teal-500/30 space-y-1.5">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-teal-400" />
                  Cara Memasang &amp; Menghubungkan Apps Script di Google Spreadsheet
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Ikuti 4 langkah mudah di bawah ini untuk mengaktifkan otomasi Rekapan Se-Dinas di Google Spreadsheet Anda:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Langkah 1 */}
                <div className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700/80 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center font-black text-xs">
                      1
                    </div>
                    <h4 className="text-xs font-black text-white">Buka Google Apps Script</h4>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Buka Google Spreadsheet BOSP di Google Drive Anda. Di menu navigasi atas Google Sheets, klik menu:
                  </p>
                  <div className="p-2.5 rounded-xl bg-slate-950 font-mono text-xs text-teal-300 border border-slate-800">
                    Ekstensi &gt; Apps Script
                  </div>
                </div>

                {/* Langkah 2 */}
                <div className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700/80 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center font-black text-xs">
                      2
                    </div>
                    <h4 className="text-xs font-black text-white">Tempel (Paste) Kode Script</h4>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Hapus kode lama yang ada di editor, lalu tempel (<i>paste</i>) seluruh kode script yang sudah Anda salin.
                  </p>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Klik untuk Salin Kode</span>
                  </button>
                </div>

                {/* Langkah 3 */}
                <div className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700/80 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center font-black text-xs">
                      3
                    </div>
                    <h4 className="text-xs font-black text-white">Deploy sebagai Web App</h4>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Simpan (<code className="text-teal-300 bg-slate-950 px-1 py-0.5 rounded">Ctrl + S</code>), lalu klik <b>Deploy &gt; Manage deployments &gt; Edit &gt; New version &gt; Deploy</b> dengan akses <b>Anyone (Siapa saja)</b>.
                  </p>
                </div>

                {/* Langkah 4 */}
                <div className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700/80 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center font-black text-xs">
                      4
                    </div>
                    <h4 className="text-xs font-black text-white">Sinkronkan atau Jalankan Menu</h4>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Klik tombol <b>Kirim / Sinkronkan Data Sekarang</b> pada tab Koneksi Web App, atau gunakan menu <b>📋 Rekapan Se-Dinas</b> langsung di Google Sheets!
                  </p>
                </div>
              </div>

              {/* Menu Capabilities Preview */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Daftar Perintah Menu yang Disediakan oleh Apps Script:
                </h4>
                <ul className="text-xs text-slate-300 space-y-1.5 pl-6 list-disc">
                  <li>
                    <b>▶️ 1. Buat / Update Rekapan Se-Dinas (Otomatis):</b> Mengagregasi data transaksi persediaan &amp; pemeliharaan dari seluruh sekolah ke sheet <i>2_REKAPAN_SE_DINAS</i>.
                  </li>
                  <li>
                    <b>📊 2. Buat Matriks Jenis Rekening Persediaan:</b> Menyusun tabel matriks cross-tab untuk seluruh 32 rekening persediaan standar Dinas Pendidikan.
                  </li>
                  <li>
                    <b>🎨 3. Format &amp; Rapikan Tabel:</b> Memberikan warna header hijau emerald resmi, garis border presisi, format angka mata uang Rupiah, dan zebra striping.
                  </li>
                  <li>
                    <b>📑 4. Bersihkan Baris Kosong:</b> Menghapus baris kosong yang berlebih di bawah data agar spreadsheet tetap ringan dan cepat.
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Terhubung ke URL Web App Google Apps Script Rekapan Se-Dinas</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyCode}
              className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Salin Kode</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
