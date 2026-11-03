import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  Download,
  Upload,
  Database,
  Building2,
  Building,
  Package,
  Wrench,
  PackagePlus,
  CheckCircle2,
  AlertCircle,
  FileText,
  RotateCw,
  ExternalLink,
  Layers,
  Sparkles,
  Code2,
  Search,
  Users,
  KeyRound,
  Eye,
  EyeOff,
  UserPlus,
  Copy,
  Check,
  Edit,
  Trash2,
  Link2
} from 'lucide-react';
import { SchoolExpense, SchoolInfo, BarangEkstraItem, ExpenseStatus } from '../types';
import { UserRole } from '../types/auth';
import {
  loadUptSchools,
  saveUptSchools,
  normalizeUptKey,
  UptSchoolAccount,
  generateSlugUsername,
  inferKecamatanFromUpt
} from '../data/schoolData';
import {
  downloadMasterDatabaseSpreadsheet,
  downloadMasterDatabaseTemplate,
  downloadAkunAplikasiSpreadsheet,
  parseMasterDatabaseSpreadsheet,
  ParseMasterDatabaseResult,
  STANDARD_JENIS_PERSEDIAAN_REKAP
} from '../utils/databaseSpreadsheet';
import {
  pullAllDataFromRekapanGas,
  pullFromGoogleSpreadsheetLink,
  getSavedGoogleSpreadsheetUrl
} from '../utils/googleAppsScriptCode';
import { buildMergedPersediaanTableRows, formatRupiah } from '../utils/budgetCalculations';
import { AppsScriptModal } from './AppsScriptModal';

interface DatabaseSpreadsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolInfo: SchoolInfo;
  expenses: SchoolExpense[];
  barangEkstraItems: BarangEkstraItem[];
  onImportExpenses: (newExpenses: SchoolExpense[]) => void;
  onImportBarangEkstra?: (newItems: BarangEkstraItem[]) => void;
  onApplyMasterDatabase?: (result: ParseMasterDatabaseResult, replaceAll?: boolean) => void;
  onUpdateMasterSchools?: (schools: UptSchoolAccount[]) => void;
  onOpenGoogleSheets?: () => void;
  onNotify?: (msg: string, type?: 'success' | 'info') => void;
}

export const DatabaseSpreadsheetModal: React.FC<DatabaseSpreadsheetModalProps> = ({
  isOpen,
  onClose,
  schoolInfo,
  expenses,
  barangEkstraItems,
  onImportExpenses,
  onImportBarangEkstra,
  onApplyMasterDatabase,
  onUpdateMasterSchools,
  onOpenGoogleSheets,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'rekapan_table' | 'belanja_table' | 'akun_table' | 'import' | 'structure'
  >('overview');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPullingRemote, setIsPullingRemote] = useState(false);
  const [sheetLinkInput, setSheetLinkInput] = useState<string>(() => getSavedGoogleSpreadsheetUrl());
  const [replaceAllOnImport, setReplaceAllOnImport] = useState<boolean>(true);
  const [importResult, setImportResult] = useState<ParseMasterDatabaseResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [appsScriptModalOpen, setAppsScriptModalOpen] = useState(false);
  const [hanyaRekeningTerisi, setHanyaRekeningTerisi] = useState(false);
  const [searchRekapQuery, setSearchRekapQuery] = useState('');

  // State for inline Sheet 3, 4, 5 editor
  const [activeBelanjaSubSheet, setActiveBelanjaSubSheet] = useState<'persediaan' | 'pemeliharaan' | 'ekstra'>('persediaan');
  const [searchBelanjaQuery, setSearchBelanjaQuery] = useState('');
  const [editingExpenseRowId, setEditingExpenseRowId] = useState<string | null>(null);
  const [editExpUraian, setEditExpUraian] = useState('');
  const [editExpToko, setEditExpToko] = useState('');
  const [editExpBelanjaLra, setEditExpBelanjaLra] = useState<number>(0);
  const [editExpKeluarBelanja, setEditExpKeluarBelanja] = useState<number>(0);
  const [editExpSaldoAwal, setEditExpSaldoAwal] = useState<number>(0);
  const [editExpKeluarSaldoAwal, setEditExpKeluarSaldoAwal] = useState<number>(0);
  const [editExpStatus, setEditExpStatus] = useState<ExpenseStatus>('Disetujui Kepala Sekolah');

  // State for Sheet 6: Akun Aplikasi
  const [masterSchools, setMasterSchools] = useState<UptSchoolAccount[]>(() => loadUptSchools());
  const [searchAkunQuery, setSearchAkunQuery] = useState('');
  const [filterAkunRole, setFilterAkunRole] = useState<'ALL' | 'Admin' | 'Operator BOSP'>('ALL');
  const [showPasswords, setShowPasswords] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAddAccountForm, setShowAddAccountForm] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [formUpt, setFormUpt] = useState('');
  const [formNpsn, setFormNpsn] = useState('');
  const [formKecamatan, setFormKecamatan] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('Operator BOSP');
  const [formNamaPejabat, setFormNamaPejabat] = useState('');
  const [formKepsek, setFormKepsek] = useState('');
  const [formBendahara, setFormBendahara] = useState('');

  useEffect(() => {
    setMasterSchools(loadUptSchools());
    if (isOpen) {
      setSheetLinkInput(getSavedGoogleSpreadsheetUrl());
    }
  }, [isOpen, schoolInfo, expenses]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const persediaanExpenses = useMemo(
    () => expenses.filter((e) => e.kategoriBelanja !== 'pemeliharaan'),
    [expenses]
  );
  const pemeliharaanExpenses = useMemo(
    () => expenses.filter((e) => e.kategoriBelanja === 'pemeliharaan'),
    [expenses]
  );

  const filteredAccounts = useMemo(() => {
    return masterSchools.filter((acc) => {
      if (filterAkunRole !== 'ALL' && acc.role !== filterAkunRole) return false;
      if (!searchAkunQuery.trim()) return true;
      const q = searchAkunQuery.toLowerCase();
      return (
        acc.upt.toLowerCase().includes(q) ||
        acc.username.toLowerCase().includes(q) ||
        (acc.npsn || '').toLowerCase().includes(q) ||
        (acc.kecamatan || '').toLowerCase().includes(q) ||
        (acc.pengurusBarang || '').toLowerCase().includes(q) ||
        (acc.kepalaSekolah || '').toLowerCase().includes(q)
      );
    });
  }, [masterSchools, filterAkunRole, searchAkunQuery]);

  // Build Matrix Data for Sheet 2_REKAPAN_SE_DINAS (identical to Laporan Menu Rekapan Dinas)
  const rekapanMatrixData = useMemo(() => {
    const mapSchoolExpenses = new Map<string, SchoolExpense[]>();
    const extraSchoolNames = new Map<string, string>();

    expenses.forEach((e) => {
      const rawName = (e.schoolName || schoolInfo.namaSekolah || 'UPT Sekolah').trim();
      const norm = normalizeUptKey(rawName);
      const list = mapSchoolExpenses.get(norm) || [];
      list.push(e);
      mapSchoolExpenses.set(norm, list);
      if (!extraSchoolNames.has(norm)) {
        extraSchoolNames.set(norm, rawName);
      }
    });

    const schoolEntries: { norm: string; schoolName: string; npsn: string }[] = [];
    const seenNorm = new Set<string>();

    masterSchools.forEach((s) => {
      const norm = normalizeUptKey(s.upt);
      if (!seenNorm.has(norm)) {
        seenNorm.add(norm);
        schoolEntries.push({ norm, schoolName: s.upt, npsn: s.npsn });
      }
    });

    extraSchoolNames.forEach((name, norm) => {
      if (!seenNorm.has(norm)) {
        seenNorm.add(norm);
        schoolEntries.push({ norm, schoolName: name, npsn: '-' });
      }
    });

    const setJenis = new Set<string>(STANDARD_JENIS_PERSEDIAAN_REKAP);
    const schools = schoolEntries.map((entry) => {
      const schoolExps = mapSchoolExpenses.get(entry.norm) || [];
      const rowsMap = new Map<
        string,
        {
          saMasuk: number;
          saKeluar: number;
          saSisa: number;
          blMasuk: number;
          blKeluar: number;
          blSisa: number;
          saldoAkhir: number;
        }
      >();

      let totalMasuk = 0;
      let totalKeluar = 0;
      let totalSaldoAkhir = 0;

      if (schoolExps.length > 0) {
        const { rows: mergedRows } = buildMergedPersediaanTableRows(schoolExps);
        mergedRows.forEach((r) => {
          const kodeUpper = r.kodeRekening.trim().toUpperCase();
          setJenis.add(kodeUpper);

          const saMasuk = r.nominalSaldoAwal;
          const saKeluar = r.nominalPengeluaranSaldoAwal;
          const saSisa = saMasuk - saKeluar;
          const blMasuk = r.nominalBelanjaLra + r.nominalHibahMasuk;
          const blKeluar = r.nominalPengeluaranBelanja + r.nominalHibahKeluar;
          const blSisa = blMasuk - blKeluar;
          const saldoAkhir = r.sisaNilai;

          rowsMap.set(kodeUpper, {
            saMasuk,
            saKeluar,
            saSisa,
            blMasuk,
            blKeluar,
            blSisa,
            saldoAkhir,
          });

          totalMasuk += saMasuk + blMasuk;
          totalKeluar += saKeluar + blKeluar;
          totalSaldoAkhir += saldoAkhir;
        });
      }

      return {
        schoolName: entry.schoolName,
        npsn: entry.npsn,
        rowsMap,
        totalMasuk,
        totalKeluar,
        totalSaldoAkhir,
      };
    });

    const allJenis = Array.from(setJenis);
    const displayedJenis = hanyaRekeningTerisi
      ? allJenis.filter((jenis) =>
          schools.some((s) => {
            const d = s.rowsMap.get(jenis);
            return (
              d &&
              (d.saMasuk > 0 ||
                d.saKeluar > 0 ||
                d.blMasuk > 0 ||
                d.blKeluar > 0 ||
                d.saldoAkhir !== 0)
            );
          })
        )
      : allJenis;

    const filteredSchools = searchRekapQuery.trim()
      ? schools.filter(
          (s) =>
            s.schoolName.toLowerCase().includes(searchRekapQuery.toLowerCase()) ||
            s.npsn.toLowerCase().includes(searchRekapQuery.toLowerCase())
        )
      : schools;

    let grandMasuk = 0;
    let grandKeluar = 0;
    let grandSaldo = 0;
    filteredSchools.forEach((s) => {
      grandMasuk += s.totalMasuk;
      grandKeluar += s.totalKeluar;
      grandSaldo += s.totalSaldoAkhir;
    });

    return {
      displayedJenis,
      filteredSchools,
      grandMasuk,
      grandKeluar,
      grandSaldo,
    };
  }, [expenses, masterSchools, schoolInfo.namaSekolah, hanyaRekeningTerisi, searchRekapQuery]);

  if (!isOpen) return null;

  const handleDownloadDatabase = () => {
    try {
      downloadMasterDatabaseSpreadsheet({
        schoolInfo,
        expenses,
        barangEkstraItems,
        masterSchools,
      });
      onNotify?.(
        `Database Spreadsheet berhasil diunduh (6 lembar kerja: Panel Admin, Rekap Dinas Matriks, Persediaan, Pemeliharaan, Barang Ekstra & Akun Aplikasi)!`,
        'success'
      );
    } catch (err: any) {
      setErrorMessage(`Gagal mengunduh spreadsheet: ${err.message}`);
    }
  };

  const handleDownloadAkunOnly = () => {
    try {
      downloadAkunAplikasiSpreadsheet(masterSchools, schoolInfo.tahunAnggaran);
      onNotify?.(
        `Database Spreadsheet Akun Aplikasi (${masterSchools.length} Akun UPT & Admin) berhasil diunduh!`,
        'success'
      );
    } catch (err: any) {
      setErrorMessage(`Gagal mengunduh spreadsheet akun: ${err.message}`);
    }
  };

  const handleOpenAddAccount = () => {
    setEditingAccountId(null);
    setFormUpt('');
    setFormNpsn('');
    setFormKecamatan('Ratahan');
    setFormUsername('');
    setFormPassword('');
    setFormRole('Operator BOSP');
    setFormNamaPejabat('');
    setFormKepsek('');
    setFormBendahara('');
    setShowAddAccountForm(true);
  };

  const handleOpenEditAccount = (acc: UptSchoolAccount) => {
    setEditingAccountId(acc.id);
    setFormUpt(acc.upt);
    setFormNpsn(acc.npsn || '');
    setFormKecamatan(acc.kecamatan || 'Ratahan');
    setFormUsername(acc.username);
    setFormPassword(acc.password);
    setFormRole(acc.role);
    setFormNamaPejabat(acc.pengurusBarang || '');
    setFormKepsek(acc.kepalaSekolah || '');
    setFormBendahara(acc.bendahara || '');
    setShowAddAccountForm(true);
  };

  const handleSaveAccountForm = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUpt = formUpt.trim().toUpperCase();
    if (!cleanUpt) {
      setErrorMessage('Nama UPT / Satuan Pendidikan wajib diisi.');
      return;
    }
    const cleanUser = formUsername.trim() || generateSlugUsername(cleanUpt);
    const cleanPass = formPassword.trim() || formNpsn.trim() || '123456';

    let updated: UptSchoolAccount[];
    if (editingAccountId) {
      updated = masterSchools.map((s) =>
        s.id === editingAccountId
          ? {
              ...s,
              upt: cleanUpt,
              npsn: formNpsn.trim() || s.npsn,
              kecamatan: formKecamatan.trim() || inferKecamatanFromUpt(cleanUpt),
              username: cleanUser,
              password: cleanPass,
              role: formRole,
              pengurusBarang: formNamaPejabat.trim() || s.pengurusBarang,
              kepalaSekolah: formKepsek.trim() || s.kepalaSekolah,
              bendahara: formBendahara.trim() || s.bendahara,
            }
          : s
      );
      setMasterSchools(updated);
      saveUptSchools(updated);
      onUpdateMasterSchools?.(updated);
      onNotify?.(`Akun "${cleanUpt}" (${cleanUser}) berhasil diperbarui di Database Akun Aplikasi!`, 'success');
    } else {
      const newAcc: UptSchoolAccount = {
        id: formNpsn.trim() || `upt-${masterSchools.length + 1}`,
        upt: cleanUpt,
        npsn: formNpsn.trim() || '-',
        kecamatan: formKecamatan.trim() || inferKecamatanFromUpt(cleanUpt),
        username: cleanUser,
        password: cleanPass,
        role: formRole,
        pengurusBarang: formNamaPejabat.trim() || `Operator ${cleanUpt}`,
        kepalaSekolah: formKepsek.trim() || '-',
        bendahara: formBendahara.trim() || '-',
      };
      updated = [newAcc, ...masterSchools];
      setMasterSchools(updated);
      saveUptSchools(updated);
      onUpdateMasterSchools?.(updated);
      onNotify?.(`Akun baru "${cleanUpt}" (${cleanUser}) berhasil ditambahkan ke Database Akun Aplikasi!`, 'success');
    }

    setShowAddAccountForm(false);
    setEditingAccountId(null);
  };

  const handleCopyCredential = (acc: UptSchoolAccount) => {
    const text = `UPT: ${acc.upt} | Username: ${acc.username} | Password: ${acc.password} | Role: ${acc.role}`;
    navigator.clipboard.writeText(text);
    setCopiedId(acc.id);
    onNotify?.(`Kredensial login ${acc.upt} berhasil disalin!`, 'success');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleDownloadTemplate = () => {
    try {
      downloadMasterDatabaseTemplate(schoolInfo);
      onNotify?.(`Template Database Spreadsheet Kosong berhasil diunduh!`, 'success');
    } catch (err: any) {
      setErrorMessage(`Gagal mengunduh template: ${err.message}`);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setImportResult(null);

    try {
      const result = await parseMasterDatabaseSpreadsheet(file, schoolInfo);
      setImportResult(result);
    } catch (err: any) {
      setErrorMessage(`Gagal membaca file spreadsheet: ${err.message}`);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const applyParsedDatabaseResult = (result: ParseMasterDatabaseResult, replaceAll: boolean) => {
    if (result.importedAccounts && result.importedAccounts.length > 0) {
      setMasterSchools(result.importedAccounts);
      saveUptSchools(result.importedAccounts);
    }
    if (onApplyMasterDatabase) {
      onApplyMasterDatabase(result, replaceAll);
    } else {
      if (result.importedExpenses.length > 0) {
        onImportExpenses(result.importedExpenses);
      }
      if (result.importedBarangEkstra.length > 0 && onImportBarangEkstra) {
        onImportBarangEkstra(result.importedBarangEkstra);
      }
    }
  };

  const handleApplyImport = () => {
    if (!importResult) return;

    applyParsedDatabaseResult(importResult, replaceAllOnImport);

    const total =
      importResult.persediaanCount +
      importResult.pemeliharaanCount +
      importResult.barangEkstraCount +
      (importResult.akunCount || 0);

    onNotify?.(
      `Berhasil menerapkan perubahan ${total} data spreadsheet ke aplikasi!`,
      'success'
    );
    onClose();
  };

  const handlePullFromGasInModal = async () => {
    setIsPullingRemote(true);
    setErrorMessage(null);
    try {
      const res = await pullAllDataFromRekapanGas(schoolInfo);
      if (res.success && res.parsed) {
        applyParsedDatabaseResult(res.parsed, replaceAllOnImport);
        onNotify?.(res.message, 'success');
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal menarik data dari Google Apps Script.');
    } finally {
      setIsPullingRemote(false);
    }
  };

  const handlePullFromSheetLinkInModal = async () => {
    if (!sheetLinkInput.trim()) {
      setErrorMessage('Masukkan URL / Link Google Spreadsheet terlebih dahulu.');
      return;
    }
    setIsPullingRemote(true);
    setErrorMessage(null);
    try {
      const res = await pullFromGoogleSpreadsheetLink(sheetLinkInput.trim(), schoolInfo);
      if (res.success && res.parsed) {
        applyParsedDatabaseResult(res.parsed, replaceAllOnImport);
        onNotify?.(res.message, 'success');
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal menarik data dari Link Google Spreadsheet.');
    } finally {
      setIsPullingRemote(false);
    }
  };

  const handleStartEditExpenseRow = (exp: SchoolExpense) => {
    const firstItem = exp.rincianItems && exp.rincianItems[0];
    setEditingExpenseRowId(exp.id);
    setEditExpUraian(exp.uraian || '');
    setEditExpToko(exp.penerimaToko || '');
    setEditExpBelanjaLra(firstItem ? firstItem.nilaiBelanjaLra || exp.subtotal : exp.subtotal);
    setEditExpKeluarBelanja(firstItem ? firstItem.pengeluaranBelanja || 0 : exp.pengeluaranBelanja || 0);
    setEditExpSaldoAwal(firstItem ? firstItem.nilaiSaldoAwal || 0 : exp.nilaiSaldoAwal || 0);
    setEditExpKeluarSaldoAwal(firstItem ? firstItem.pengeluaranSaldoAwal || 0 : exp.pengeluaranSaldoAwal || 0);
    setEditExpStatus(exp.status || 'Disetujui Kepala Sekolah');
  };

  const handleSaveEditedExpenseRow = (exp: SchoolExpense) => {
    const updatedExpenses: SchoolExpense[] = expenses.map((item) => {
      if (item.id !== exp.id) return item;
      const cleanBelanja = Number(editExpBelanjaLra) || 0;
      const cleanKeluarBelanja = Number(editExpKeluarBelanja) || 0;
      const cleanSaldoAwal = Number(editExpSaldoAwal) || 0;
      const cleanKeluarSaldoAwal = Number(editExpKeluarSaldoAwal) || 0;

      const updatedItems =
        item.rincianItems && item.rincianItems.length > 0
          ? item.rincianItems.map((ri, idx) => {
              if (idx !== 0) return ri;
              const nMasuk = cleanSaldoAwal + cleanBelanja + (ri.hibahMasuk || 0);
              const nKeluar = cleanKeluarSaldoAwal + cleanKeluarBelanja + (ri.hibahKeluar || 0);
              return {
                ...ri,
                nilaiBelanjaLra: cleanBelanja,
                pengeluaranBelanja: cleanKeluarBelanja,
                nilaiSaldoAwal: cleanSaldoAwal,
                pengeluaranSaldoAwal: cleanKeluarSaldoAwal,
                nilaiMasuk: nMasuk,
                nilaiKeluar: nKeluar,
                sisaNilai: nMasuk - nKeluar,
              };
            })
          : undefined;

      const newSubtotal = updatedItems
        ? updatedItems.reduce((sum, ri) => sum + (ri.nilaiBelanjaLra || ri.nilaiMasuk || 0), 0)
        : cleanBelanja;

      return {
        ...item,
        uraian: editExpUraian.trim() || item.uraian,
        penerimaToko: editExpToko.trim() || item.penerimaToko,
        subtotal: newSubtotal,
        totalBersih: newSubtotal - (item.nilaiPajak || 0),
        hargaSatuan: cleanBelanja,
        nilaiBelanjaLra: cleanBelanja,
        pengeluaranBelanja: cleanKeluarBelanja,
        nilaiSaldoAwal: cleanSaldoAwal,
        pengeluaranSaldoAwal: cleanKeluarSaldoAwal,
        status: editExpStatus,
        rincianItems: updatedItems,
      };
    });

    if (onApplyMasterDatabase) {
      onApplyMasterDatabase(
        {
          importedExpenses: updatedExpenses,
          importedBarangEkstra: barangEkstraItems,
          importedAccounts: masterSchools,
          persediaanCount: updatedExpenses.filter((e) => e.kategoriBelanja !== 'pemeliharaan').length,
          pemeliharaanCount: updatedExpenses.filter((e) => e.kategoriBelanja === 'pemeliharaan').length,
          barangEkstraCount: barangEkstraItems.length,
          akunCount: masterSchools.length,
          rekapMatrixCount: 0,
          panelAdminCount: 0,
          sheetsFound: ['INLINE_EDIT'],
        },
        true
      );
    } else {
      onImportExpenses(updatedExpenses);
    }

    setEditingExpenseRowId(null);
    onNotify?.(`Baris transaksi "${editExpUraian}" berhasil diperbarui di Database & Aplikasi!`, 'success');
  };

  const handleDeleteExpenseRow = (expId: string, uraian: string) => {
    const updatedExpenses = expenses.filter((e) => e.id !== expId);
    if (onApplyMasterDatabase) {
      onApplyMasterDatabase(
        {
          importedExpenses: updatedExpenses,
          importedBarangEkstra: barangEkstraItems,
          importedAccounts: masterSchools,
          persediaanCount: updatedExpenses.filter((e) => e.kategoriBelanja !== 'pemeliharaan').length,
          pemeliharaanCount: updatedExpenses.filter((e) => e.kategoriBelanja === 'pemeliharaan').length,
          barangEkstraCount: barangEkstraItems.length,
          akunCount: masterSchools.length,
          rekapMatrixCount: 0,
          panelAdminCount: 0,
          sheetsFound: ['INLINE_DELETE'],
        },
        true
      );
    } else {
      onImportExpenses(updatedExpenses);
    }
    onNotify?.(`Baris transaksi "${uraian}" berhasil dihapus dari Database & Aplikasi!`, 'info');
  };

  const handleDeleteBarangEkstraRow = (itemId: string, namaBarang: string) => {
    const updatedEkstra = barangEkstraItems.filter((i) => i.id !== itemId);
    if (onApplyMasterDatabase) {
      onApplyMasterDatabase(
        {
          importedExpenses: expenses,
          importedBarangEkstra: updatedEkstra,
          importedAccounts: masterSchools,
          persediaanCount: persediaanExpenses.length,
          pemeliharaanCount: pemeliharaanExpenses.length,
          barangEkstraCount: updatedEkstra.length,
          akunCount: masterSchools.length,
          rekapMatrixCount: 0,
          panelAdminCount: 0,
          sheetsFound: ['INLINE_DELETE_EKSTRA'],
        },
        true
      );
    } else if (onImportBarangEkstra) {
      onImportBarangEkstra(updatedEkstra);
    }
    onNotify?.(`Barang ekstra "${namaBarang}" berhasil dihapus dari Database & Aplikasi!`, 'info');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-6xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-950/40 via-slate-900 to-teal-950/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Database Multi-Sheet 2 Arah
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  TA {schoolInfo.tahunAnggaran}
                </span>
              </div>
              <h2 className="text-lg font-black text-white leading-tight mt-0.5">
                Database Spreadsheet Master Aplikasi
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

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-slate-800 px-5 gap-2 bg-slate-950/40 text-xs font-bold overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3.5 border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'overview'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Ikhtisar &amp; Sinkron 2 Arah</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rekapan_table')}
            className={`py-3 px-3.5 border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'rekapan_table'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Tabel 2_REKAPAN_SE_DINAS (Matriks)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('belanja_table')}
            className={`py-3 px-3.5 border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'belanja_table'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Tabel 3, 4 &amp; 5: Edit Data Belanja ({expenses.length + barangEkstraItems.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('akun_table')}
            className={`py-3 px-3.5 border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'akun_table'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Tabel 6_AKUN_APLIKASI ({masterSchools.length} Akun)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`py-3 px-3.5 border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'import'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Tarik / Upload Spreadsheet</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('structure')}
            className={`py-3 px-3.5 border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'structure'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Struktur Lembar Kerja (6 Sheet)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-300 flex items-start gap-3 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Terjadi Kesalahan</p>
                <p className="mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Introduction Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-800/40 to-slate-900 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    Database Terintegrasi 6 Lembar Kerja Excel (.xlsx) + Sinkronisasi 2 Arah
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                    Database ini menghubungkan 2 arah seluruh data <b>Panel Admin</b>,{' '}
                    <b>Rekapan Se Dinas (Format Matriks)</b>, <b>Input Belanja Persediaan</b>,{' '}
                    <b>Pemeliharaan</b>, <b>Barang Ekstra</b>, dan <b>Akun Aplikasi</b>. Jika Anda mengubah data di Google Spreadsheet atau file Excel, gunakan tombol <b>Tarik Perubahan dari Spreadsheet</b> atau <b>Upload .xlsx</b> agar perubahan langsung masuk ke aplikasi.
                  </p>
                </div>
                <div className="flex flex-wrap sm:flex-nowrap gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handlePullFromGasInModal}
                    disabled={isPullingRemote}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all cursor-pointer active:scale-95"
                    title="Tarik perubahan terbaru yang diedit di Google Sheets ke aplikasi"
                  >
                    <RotateCw className={`w-4 h-4 ${isPullingRemote ? 'animate-spin' : ''}`} />
                    <span>{isPullingRemote ? 'Menarik...' : 'Tarik dari Google Sheets'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadDatabase}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    <span>Unduh Database (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadAkunOnly}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/20 border border-rose-400/30 transition-all cursor-pointer active:scale-95"
                    title="Unduh khusus Spreadsheet Database Akun Aplikasi (6_AKUN_APLIKASI & Users)"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Unduh Database Akun (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAppsScriptModalOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md shadow-teal-600/20 border border-teal-400/30 transition-all cursor-pointer active:scale-95"
                    title="Buka Kode & Panduan Google Apps Script (.gs) untuk Otomasi Rekapan Se-Dinas"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>Apps Script Rekapan</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs border border-slate-700 transition-all cursor-pointer"
                    title="Unduh template kosong untuk diisi offline"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span>Template Kosong</span>
                  </button>
                </div>
              </div>

              {/* Quick 2-Way Google Spreadsheet Link Sync Bar */}
              <div className="p-4 rounded-2xl bg-slate-800/80 border border-indigo-500/40 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-indigo-300 flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-indigo-400" />
                    Sudah Mengubah Data di Google Spreadsheet / Excel? Tarik ke Aplikasi Sekarang:
                  </h4>
                  <p className="text-[11px] text-slate-300">
                    Tempel link Google Spreadsheet Anda di bawah ini untuk mengambil perubahan dari ke-6 sheet tanpa perlu redeploy script, atau klik tab <b>Tarik / Upload Spreadsheet</b> untuk mengunggah file <code className="text-emerald-300">.xlsx</code> hasil editan Anda.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 min-w-[340px]">
                  <input
                    type="text"
                    value={sheetLinkInput}
                    onChange={(e) => setSheetLinkInput(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handlePullFromSheetLinkInModal}
                    disabled={isPullingRemote}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isPullingRemote ? 'animate-spin' : ''}`} />
                    <span>Tarik Perubahan</span>
                  </button>
                </div>
              </div>

              {/* Data Cards for all 5 Core Areas */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {/* 1. Panel Admin */}
                <div className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                      1
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                      Sheet: 1_PANEL_ADMIN_UPT
                    </span>
                  </div>
                  <h4 className="text-xs font-black text-white">Panel Admin &amp; UPT Sekolah</h4>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Master UPT Sekolah se-Kabupaten, data Kepala Sekolah, Bendahara, Pengurus Barang,
                    Pagu Tahunan &amp; status approval.
                  </p>
                  <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Total UPT Terdata:</span>
                    <span className="font-bold text-amber-400">{masterSchools.length} Sekolah</span>
                  </div>
                </div>

                {/* 2. Rekapan Se Dinas */}
                <div className="p-4 rounded-2xl bg-slate-800/70 border border-indigo-500/40 space-y-2 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                        2
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        Sheet: 2_REKAPAN_SE_DINAS
                      </span>
                    </div>
                    <h4 className="text-xs font-black text-white">
                      Tabel Matriks Rekapan Se-Dinas Pendidikan
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Bentuk tabel matriks persis seperti Laporan Menu Rekapan Dinas: Header 3 tingkat
                      per Jenis Persediaan (<b>SALDO AWAL</b>: Masuk, Keluar, Sisa | <b>BELANJA</b>:
                      Masuk, Keluar, Sisa | <b>SALDO AKHIR</b>) + Total Masuk, Keluar &amp; Saldo Akhir.
                    </p>
                    <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-xs">
                      <span className="text-slate-400">Format Tabel:</span>
                      <span className="font-bold text-emerald-300">Matriks Laporan Rekapan Dinas</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab('rekapan_table')}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 rounded-lg text-[11px] font-bold border border-indigo-500/30 transition-colors cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-300" />
                      <span>Lihat Tabel Matriks</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAppsScriptModalOpen(true)}
                      className="flex items-center justify-center gap-1 py-1.5 px-2.5 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 rounded-lg text-[11px] font-bold border border-teal-500/30 transition-colors cursor-pointer"
                      title="Apps Script Rekapan Se-Dinas"
                    >
                      <Code2 className="w-3.5 h-3.5 text-teal-300" />
                      <span>.gs</span>
                    </button>
                  </div>
                </div>

                {/* 3. Input Belanja Persediaan */}
                <div className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                      <Package className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                      Sheet: 3_BELANJA_PERSEDIAAN
                    </span>
                  </div>
                  <h4 className="text-xs font-black text-white">Input Belanja Persediaan</h4>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Seluruh rincian rekening persediaan dengan 6 kolom saldo awal, belanja LRA,
                    pengeluaran, hibah, subtotal &amp; pajak.
                  </p>
                  <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Transaksi Tersimpan:</span>
                    <span className="font-bold text-emerald-400">{persediaanExpenses.length} Inputan</span>
                  </div>
                </div>

                {/* 4. Input Pemeliharaan */}
                <div className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                      <Wrench className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                      Sheet: 4_BELANJA_PEMELIHARAAN
                    </span>
                  </div>
                  <h4 className="text-xs font-black text-white">Input Pemeliharaan &amp; BAST</h4>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Rincian pekerjaan pemeliharaan, nilai jasa, nilai barang, BAST pemeliharaan, dan
                    rekanan pelaksana.
                  </p>
                  <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Transaksi Tersimpan:</span>
                    <span className="font-bold text-cyan-400">{pemeliharaanExpenses.length} Inputan</span>
                  </div>
                </div>

                {/* 5. Input Barang Ekstra */}
                <div className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                      <PackagePlus className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                      Sheet: 5_BARANG_EKSTRA
                    </span>
                  </div>
                  <h4 className="text-xs font-black text-white">Input Barang Ekstra</h4>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Inventaris aset ekstra non-rutin sekolah (spesifikasi, volume, satuan, perolehan,
                    kondisi dan lokasi ruangan).
                  </p>
                  <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Barang Terdata:</span>
                    <span className="font-bold text-purple-400">{barangEkstraItems.length} Barang</span>
                  </div>
                </div>

                {/* 6. Database Akun Aplikasi */}
                <div className="p-4 rounded-2xl bg-slate-800/70 border border-rose-500/40 flex flex-col justify-between space-y-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold">
                        <Users className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        Sheet: 6_AKUN_APLIKASI
                      </span>
                    </div>
                    <h4 className="text-xs font-black text-white">
                      Database Akun Aplikasi (Login UPT &amp; Admin)
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Daftar lengkap akun pengguna aplikasi: ID, Nama Operator, Username, Password,
                      Role (<b>Admin</b> / <b>Operator BOSP</b>), Nama UPT, NPSN &amp; Pejabat Sekolah.
                    </p>
                    <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-xs">
                      <span className="text-slate-400">Total Akun Terdata:</span>
                      <span className="font-bold text-rose-300">{masterSchools.length} Akun Aktif</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab('akun_table')}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded-lg text-[11px] font-bold border border-rose-500/30 transition-colors cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5 text-rose-300" />
                      <span>Lihat &amp; Kelola Akun</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadAkunOnly}
                      className="flex items-center justify-center gap-1 py-1.5 px-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg text-[11px] font-bold border border-emerald-500/30 transition-colors cursor-pointer"
                      title="Unduh Khusus Spreadsheet Akun Aplikasi (.xlsx)"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-300" />
                      <span>.xlsx</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: TABEL 2_REKAPAN_SE_DINAS (BENTUK TABEL SEPERTI DI LAPORAN MENU REKAPAN DINAS) */}
          {activeTab === 'rekapan_table' && (
            <div className="space-y-4">
              {/* Filter & Action Toolbar */}
              <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchRekapQuery}
                      onChange={(e) => setSearchRekapQuery(e.target.value)}
                      placeholder="Cari UPT / Satuan Pendidikan..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-700 font-bold text-slate-200 hover:bg-slate-900">
                    <input
                      type="checkbox"
                      checked={hanyaRekeningTerisi}
                      onChange={(e) => setHanyaRekeningTerisi(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span>Hanya Kolom/Rekening Terisi</span>
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadDatabase}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh Database (.xlsx)</span>
                  </button>
                </div>
              </div>

              {/* Exact Matrix Table matching Laporan Menu Rekapan Dinas */}
              <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden text-slate-900">
                <div className="px-4 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    <div>
                      <span className="font-black text-xs uppercase tracking-wide block">
                        SHEET 2_REKAPAN_SE_DINAS: TABEL MATRIKS REKAPITULASI PERSEDIAAN SE-DINAS PENDIDIKAN
                      </span>
                      <span className="text-[10px] text-slate-300 font-normal">
                        Struktur tabel sama persis dengan Laporan Menu Rekapan Dinas ({rekapanMatrixData.filteredSchools.length} UPT Satuan Pendidikan)
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] text-emerald-300 font-bold bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                    TA {schoolInfo.tahunAnggaran}
                  </span>
                </div>

                <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs border border-slate-800 whitespace-nowrap">
                    <thead className="sticky top-0 z-20 bg-slate-100 text-slate-900 font-serif text-[10px] font-bold uppercase tracking-tight shadow-md">
                      {/* Row 1: Account Name */}
                      <tr>
                        <th rowSpan={3} className="border border-slate-700 py-2.5 px-3 text-center align-middle bg-slate-200">
                          NO
                        </th>
                        <th rowSpan={3} className="border border-slate-700 py-2.5 px-4 text-center align-middle min-w-[220px] bg-slate-200">
                          NAMA UPT / SATUAN PENDIDIKAN
                        </th>
                        {rekapanMatrixData.displayedJenis.length === 0 ? (
                          <th className="border border-slate-700 py-2.5 px-4 text-center align-middle">
                            JENIS PERSEDIAAN
                          </th>
                        ) : (
                          rekapanMatrixData.displayedJenis.map((jenis) => (
                            <th
                              key={`db-r1-${jenis}`}
                              colSpan={7}
                              className="border border-slate-700 py-1.5 px-2 text-center align-middle bg-slate-900 text-white font-black text-[10px]"
                            >
                              {jenis}
                            </th>
                          ))
                        )}
                        <th rowSpan={3} className="border border-slate-700 py-2.5 px-3 text-center align-middle bg-emerald-100 text-emerald-950">
                          TOTAL MASUK
                        </th>
                        <th rowSpan={3} className="border border-slate-700 py-2.5 px-3 text-center align-middle bg-rose-100 text-rose-950">
                          TOTAL KELUAR
                        </th>
                        <th rowSpan={3} className="border border-slate-700 py-2.5 px-3 text-center align-middle bg-slate-300">
                          TOTAL SALDO AKHIR
                        </th>
                      </tr>
                      {/* Row 2: Group Headers */}
                      <tr>
                        {rekapanMatrixData.displayedJenis.length === 0 ? (
                          <th className="border border-slate-700 py-1.5 px-2 text-center">Saldo Akhir</th>
                        ) : (
                          rekapanMatrixData.displayedJenis.map((jenis) => (
                            <React.Fragment key={`db-r2-${jenis}`}>
                              <th colSpan={3} className="border border-slate-700 py-1.5 px-2 text-center text-[9px] bg-emerald-200 text-emerald-950 font-bold uppercase">
                                SALDO AWAL
                              </th>
                              <th colSpan={3} className="border border-slate-700 py-1.5 px-2 text-center text-[9px] bg-slate-300 text-slate-900 font-bold uppercase">
                                BELANJA
                              </th>
                              <th rowSpan={2} className="border border-slate-700 py-1.5 px-2 text-center text-[9px] bg-rose-600 text-white font-bold uppercase align-middle">
                                SALDO AKHIR
                              </th>
                            </React.Fragment>
                          ))
                        )}
                      </tr>
                      {/* Row 3: Sub-columns */}
                      <tr>
                        {rekapanMatrixData.displayedJenis.length === 0 ? null : (
                          rekapanMatrixData.displayedJenis.map((jenis) => (
                            <React.Fragment key={`db-r3-${jenis}`}>
                              <th className="border border-slate-700 py-1 px-1.5 text-center text-[9px] bg-emerald-50 font-bold">Masuk</th>
                              <th className="border border-slate-700 py-1 px-1.5 text-center text-[9px] bg-emerald-50 font-bold">Keluar</th>
                              <th className="border border-slate-700 py-1 px-1.5 text-center text-[9px] bg-emerald-100 font-bold border-r border-slate-700">Sisa</th>
                              <th className="border border-slate-700 py-1 px-1.5 text-center text-[9px] bg-slate-50 font-bold">Masuk</th>
                              <th className="border border-slate-700 py-1 px-1.5 text-center text-[9px] bg-slate-50 font-bold">Keluar</th>
                              <th className="border border-slate-700 py-1 px-1.5 text-center text-[9px] bg-slate-200 font-bold border-r border-slate-700">Sisa</th>
                            </React.Fragment>
                          ))
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white text-slate-900">
                      {rekapanMatrixData.filteredSchools.map((school, idx) => (
                        <tr key={school.npsn + school.schoolName + idx} className="hover:bg-slate-50 transition-colors">
                          <td className="border border-slate-700 py-1.5 px-3 text-center font-bold text-slate-600 bg-slate-50">
                            {idx + 1}
                          </td>
                          <td className="border border-slate-700 py-1.5 px-3 font-bold text-slate-900 bg-slate-50/80">
                            <div className="flex items-center gap-1.5">
                              <Building className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="truncate max-w-[220px]" title={school.schoolName}>
                                {school.schoolName}
                              </span>
                            </div>
                          </td>
                          {rekapanMatrixData.displayedJenis.length === 0 ? (
                            <td className="border border-slate-700 py-1.5 px-3 text-center text-slate-400">-</td>
                          ) : (
                            rekapanMatrixData.displayedJenis.map((jenis) => {
                              const dataItem = school.rowsMap.get(jenis) || {
                                saMasuk: 0,
                                saKeluar: 0,
                                saSisa: 0,
                                blMasuk: 0,
                                blKeluar: 0,
                                blSisa: 0,
                                saldoAkhir: 0,
                              };
                              return (
                                <React.Fragment key={`db-cell-${idx}-${jenis}`}>
                                  <td className="border border-slate-700 py-1.5 px-2 text-right">
                                    {dataItem.saMasuk > 0 ? formatRupiah(dataItem.saMasuk) : '-'}
                                  </td>
                                  <td className="border border-slate-700 py-1.5 px-2 text-right">
                                    {dataItem.saKeluar > 0 ? formatRupiah(dataItem.saKeluar) : '-'}
                                  </td>
                                  <td className="border border-slate-700 py-1.5 px-2 text-right font-semibold bg-emerald-50/40 border-r border-slate-700">
                                    {dataItem.saSisa !== 0 ? formatRupiah(dataItem.saSisa) : '-'}
                                  </td>
                                  <td className="border border-slate-700 py-1.5 px-2 text-right">
                                    {dataItem.blMasuk > 0 ? formatRupiah(dataItem.blMasuk) : '-'}
                                  </td>
                                  <td className="border border-slate-700 py-1.5 px-2 text-right">
                                    {dataItem.blKeluar > 0 ? formatRupiah(dataItem.blKeluar) : '-'}
                                  </td>
                                  <td className="border border-slate-700 py-1.5 px-2 text-right font-semibold bg-slate-50 border-r border-slate-700">
                                    {dataItem.blSisa !== 0 ? formatRupiah(dataItem.blSisa) : '-'}
                                  </td>
                                  <td className="border border-slate-700 py-1.5 px-2 text-right font-black bg-rose-50/80 text-rose-950">
                                    {dataItem.saldoAkhir !== 0 ? formatRupiah(dataItem.saldoAkhir) : '-'}
                                  </td>
                                </React.Fragment>
                              );
                            })
                          )}
                          <td className="border border-slate-700 py-1.5 px-3 text-right font-semibold text-emerald-900 bg-emerald-50">
                            {formatRupiah(school.totalMasuk)}
                          </td>
                          <td className="border border-slate-700 py-1.5 px-3 text-right font-semibold text-rose-800 bg-rose-50">
                            {formatRupiah(school.totalKeluar)}
                          </td>
                          <td className="border border-slate-700 py-1.5 px-3 text-right font-black text-emerald-800 bg-slate-100">
                            {formatRupiah(school.totalSaldoAkhir)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-200 text-slate-900 font-extrabold sticky bottom-0 z-10 shadow-lg">
                      <tr>
                        <td colSpan={2} className="border border-slate-800 py-2 px-4 text-center uppercase">
                          JUMLAH TOTAL SE-KABUPATEN
                        </td>
                        {rekapanMatrixData.displayedJenis.length === 0 ? (
                          <td className="border border-slate-800 py-2 px-2 text-center">-</td>
                        ) : (
                          rekapanMatrixData.displayedJenis.map((jenis) => {
                            let tSaM = 0,
                              tSaK = 0,
                              tSaS = 0,
                              tBlM = 0,
                              tBlK = 0,
                              tBlS = 0,
                              tSk = 0;
                            rekapanMatrixData.filteredSchools.forEach((s) => {
                              const d = s.rowsMap.get(jenis);
                              if (d) {
                                tSaM += d.saMasuk;
                                tSaK += d.saKeluar;
                                tSaS += d.saSisa;
                                tBlM += d.blMasuk;
                                tBlK += d.blKeluar;
                                tBlS += d.blSisa;
                                tSk += d.saldoAkhir;
                              }
                            });
                            return (
                              <React.Fragment key={`db-tot-${jenis}`}>
                                <td className="border border-slate-800 py-2 px-2 text-right">{tSaM > 0 ? formatRupiah(tSaM) : '-'}</td>
                                <td className="border border-slate-800 py-2 px-2 text-right">{tSaK > 0 ? formatRupiah(tSaK) : '-'}</td>
                                <td className="border border-slate-800 py-2 px-2 text-right bg-emerald-100">{tSaS !== 0 ? formatRupiah(tSaS) : '-'}</td>
                                <td className="border border-slate-800 py-2 px-2 text-right">{tBlM > 0 ? formatRupiah(tBlM) : '-'}</td>
                                <td className="border border-slate-800 py-2 px-2 text-right">{tBlK > 0 ? formatRupiah(tBlK) : '-'}</td>
                                <td className="border border-slate-800 py-2 px-2 text-right bg-slate-300">{tBlS !== 0 ? formatRupiah(tBlS) : '-'}</td>
                                <td className="border border-slate-800 py-2 px-2 text-right font-black bg-rose-200 text-rose-950">{tSk !== 0 ? formatRupiah(tSk) : '-'}</td>
                              </React.Fragment>
                            );
                          })
                        )}
                        <td className="border border-slate-800 py-2 px-3 text-right font-bold text-emerald-950 bg-emerald-100">
                          {formatRupiah(rekapanMatrixData.grandMasuk)}
                        </td>
                        <td className="border border-slate-800 py-2 px-3 text-right font-bold text-rose-950 bg-rose-100">
                          {formatRupiah(rekapanMatrixData.grandKeluar)}
                        </td>
                        <td className="border border-slate-800 py-2 px-3 text-right font-black text-emerald-900 bg-slate-300">
                          {formatRupiah(rekapanMatrixData.grandSaldo)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: TABEL 3, 4 & 5 (EDIT LANGSUNG DATA BELANJA & BARANG DI SPREADSHEET MODAL) */}
          {activeTab === 'belanja_table' && (
            <div className="space-y-4">
              {/* Sub-sheet switcher & Search */}
              <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveBelanjaSubSheet('persediaan');
                      setEditingExpenseRowId(null);
                    }}
                    className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                      activeBelanjaSubSheet === 'persediaan'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-950 border border-slate-700'
                    }`}
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>3_BELANJA_PERSEDIAAN ({persediaanExpenses.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveBelanjaSubSheet('pemeliharaan');
                      setEditingExpenseRowId(null);
                    }}
                    className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                      activeBelanjaSubSheet === 'pemeliharaan'
                        ? 'bg-cyan-600 text-white shadow'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-950 border border-slate-700'
                    }`}
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>4_BELANJA_PEMELIHARAAN ({pemeliharaanExpenses.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveBelanjaSubSheet('ekstra');
                      setEditingExpenseRowId(null);
                    }}
                    className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                      activeBelanjaSubSheet === 'ekstra'
                        ? 'bg-purple-600 text-white shadow'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-950 border border-slate-700'
                    }`}
                  >
                    <PackagePlus className="w-3.5 h-3.5" />
                    <span>5_BARANG_EKSTRA ({barangEkstraItems.length})</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-60">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchBelanjaQuery}
                      onChange={(e) => setSearchBelanjaQuery(e.target.value)}
                      placeholder="Cari UPT, Uraian, No Bukti..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadDatabase}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh .xlsx</span>
                  </button>
                </div>
              </div>

              {activeBelanjaSubSheet !== 'ekstra' ? (
                <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden text-slate-900">
                  <div className="px-4 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      <div>
                        <span className="font-black text-xs uppercase tracking-wide block">
                          {activeBelanjaSubSheet === 'persediaan'
                            ? 'SHEET 3_BELANJA_PERSEDIAAN: EDIT LANGSUNG DATA BELANJA PERSEDIAAN'
                            : 'SHEET 4_BELANJA_PEMELIHARAAN: EDIT LANGSUNG DATA PEMELIHARAAN & BAST'}
                        </span>
                        <span className="text-[10px] text-slate-300 font-normal">
                          Klik tombol <b>Edit</b> pada baris mana saja untuk mengubah nominal / uraian / status agar langsung terubah di aplikasi
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs border border-slate-800 whitespace-nowrap">
                      <thead className="sticky top-0 z-20 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-tight">
                        <tr>
                          <th className="border border-slate-700 py-2 px-2.5 text-center">No</th>
                          <th className="border border-slate-700 py-2 px-3">Nama UPT Sekolah</th>
                          <th className="border border-slate-700 py-2 px-2.5 text-center">TW</th>
                          <th className="border border-slate-700 py-2 px-2.5">Tanggal</th>
                          <th className="border border-slate-700 py-2 px-3">No. Bukti</th>
                          <th className="border border-slate-700 py-2 px-3">Rekening / Jenis</th>
                          <th className="border border-slate-700 py-2 px-3">Uraian Belanja</th>
                          <th className="border border-slate-700 py-2 px-3">Toko / Rekanan</th>
                          <th className="border border-slate-700 py-2 px-3 text-right bg-emerald-900">Saldo Awal (Rp)</th>
                          <th className="border border-slate-700 py-2 px-3 text-right bg-emerald-900">Keluar SA (Rp)</th>
                          <th className="border border-slate-700 py-2 px-3 text-right bg-indigo-900">Belanja LRA (Rp)</th>
                          <th className="border border-slate-700 py-2 px-3 text-right bg-rose-900">Keluar Belanja (Rp)</th>
                          <th className="border border-slate-700 py-2 px-3 text-center">Status SPJ</th>
                          <th className="border border-slate-700 py-2 px-3 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white text-slate-900 divide-y divide-slate-200">
                        {(activeBelanjaSubSheet === 'persediaan' ? persediaanExpenses : pemeliharaanExpenses)
                          .filter((exp) => {
                            if (!searchBelanjaQuery.trim()) return true;
                            const q = searchBelanjaQuery.toLowerCase();
                            return (
                              (exp.schoolName || '').toLowerCase().includes(q) ||
                              (exp.uraian || '').toLowerCase().includes(q) ||
                              (exp.noBukti || '').toLowerCase().includes(q) ||
                              (exp.kodeRekening || '').toLowerCase().includes(q)
                            );
                          })
                          .map((exp, idx) => {
                            const isEditingRow = editingExpenseRowId === exp.id;
                            const firstItem = exp.rincianItems && exp.rincianItems[0];
                            const saMasuk = firstItem ? firstItem.nilaiSaldoAwal || 0 : exp.nilaiSaldoAwal || 0;
                            const saKeluar = firstItem ? firstItem.pengeluaranSaldoAwal || 0 : exp.pengeluaranSaldoAwal || 0;
                            const blMasuk = firstItem ? firstItem.nilaiBelanjaLra || exp.subtotal : exp.subtotal;
                            const blKeluar = firstItem ? firstItem.pengeluaranBelanja || 0 : exp.pengeluaranBelanja || 0;

                            return (
                              <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                                <td className="border border-slate-300 py-1.5 px-2.5 text-center font-bold text-slate-600 bg-slate-50">
                                  {idx + 1}
                                </td>
                                <td className="border border-slate-300 py-1.5 px-3 font-bold text-slate-900">
                                  {exp.schoolName || schoolInfo.namaSekolah}
                                </td>
                                <td className="border border-slate-300 py-1.5 px-2.5 text-center font-bold">
                                  {exp.triwulan}
                                </td>
                                <td className="border border-slate-300 py-1.5 px-2.5 font-mono text-[11px]">
                                  {exp.tanggal}
                                </td>
                                <td className="border border-slate-300 py-1.5 px-3 font-mono text-[11px]">
                                  {exp.noBukti}
                                </td>
                                <td className="border border-slate-300 py-1.5 px-3 font-semibold text-slate-800 max-w-[200px] truncate" title={exp.kodeRekening}>
                                  {exp.kodeRekening}
                                </td>
                                <td className="border border-slate-300 py-1.5 px-3">
                                  {isEditingRow ? (
                                    <input
                                      type="text"
                                      value={editExpUraian}
                                      onChange={(e) => setEditExpUraian(e.target.value)}
                                      className="border border-indigo-500 rounded px-2 py-1 text-xs w-48 bg-white text-slate-900"
                                    />
                                  ) : (
                                    <span className="font-medium">{exp.uraian}</span>
                                  )}
                                </td>
                                <td className="border border-slate-300 py-1.5 px-3">
                                  {isEditingRow ? (
                                    <input
                                      type="text"
                                      value={editExpToko}
                                      onChange={(e) => setEditExpToko(e.target.value)}
                                      className="border border-indigo-500 rounded px-2 py-1 text-xs w-36 bg-white text-slate-900"
                                    />
                                  ) : (
                                    <span>{exp.penerimaToko || '-'}</span>
                                  )}
                                </td>
                                <td className="border border-slate-300 py-1.5 px-3 text-right font-mono">
                                  {isEditingRow ? (
                                    <input
                                      type="number"
                                      value={editExpSaldoAwal}
                                      onChange={(e) => setEditExpSaldoAwal(Number(e.target.value) || 0)}
                                      className="border border-indigo-500 rounded px-2 py-1 text-xs w-28 text-right bg-white text-slate-900"
                                    />
                                  ) : (
                                    formatRupiah(saMasuk)
                                  )}
                                </td>
                                <td className="border border-slate-300 py-1.5 px-3 text-right font-mono">
                                  {isEditingRow ? (
                                    <input
                                      type="number"
                                      value={editExpKeluarSaldoAwal}
                                      onChange={(e) => setEditExpKeluarSaldoAwal(Number(e.target.value) || 0)}
                                      className="border border-indigo-500 rounded px-2 py-1 text-xs w-28 text-right bg-white text-slate-900"
                                    />
                                  ) : (
                                    formatRupiah(saKeluar)
                                  )}
                                </td>
                                <td className="border border-slate-300 py-1.5 px-3 text-right font-mono font-bold text-indigo-900 bg-indigo-50/40">
                                  {isEditingRow ? (
                                    <input
                                      type="number"
                                      value={editExpBelanjaLra}
                                      onChange={(e) => setEditExpBelanjaLra(Number(e.target.value) || 0)}
                                      className="border border-indigo-500 rounded px-2 py-1 text-xs w-28 text-right bg-white text-slate-900"
                                    />
                                  ) : (
                                    formatRupiah(blMasuk)
                                  )}
                                </td>
                                <td className="border border-slate-300 py-1.5 px-3 text-right font-mono text-rose-900 bg-rose-50/40">
                                  {isEditingRow ? (
                                    <input
                                      type="number"
                                      value={editExpKeluarBelanja}
                                      onChange={(e) => setEditExpKeluarBelanja(Number(e.target.value) || 0)}
                                      className="border border-indigo-500 rounded px-2 py-1 text-xs w-28 text-right bg-white text-slate-900"
                                    />
                                  ) : (
                                    formatRupiah(blKeluar)
                                  )}
                                </td>
                                <td className="border border-slate-300 py-1.5 px-3 text-center">
                                  {isEditingRow ? (
                                    <select
                                      value={editExpStatus}
                                      onChange={(e) => setEditExpStatus(e.target.value as ExpenseStatus)}
                                      className="border border-indigo-500 rounded px-2 py-1 text-xs bg-white text-slate-900"
                                    >
                                      <option value="Disetujui Kepala Sekolah">Disetujui Kepala Sekolah</option>
                                      <option value="Diverifikasi Bendahara">Diverifikasi Bendahara</option>
                                      <option value="Menunggu Verifikasi">Menunggu Verifikasi</option>
                                      <option value="Draf">Draf</option>
                                    </select>
                                  ) : (
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        exp.status === 'Disetujui Kepala Sekolah'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : 'bg-amber-100 text-amber-800'
                                      }`}
                                    >
                                      {exp.status}
                                    </span>
                                  )}
                                </td>
                                <td className="border border-slate-300 py-1.5 px-2.5 text-center">
                                  {isEditingRow ? (
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleSaveEditedExpenseRow(exp)}
                                        className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] cursor-pointer"
                                      >
                                        Simpan
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingExpenseRowId(null)}
                                        className="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] cursor-pointer"
                                      >
                                        Batal
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleStartEditExpenseRow(exp)}
                                        className="p-1 rounded bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-800 cursor-pointer"
                                        title="Edit baris ini"
                                      >
                                        <Edit className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteExpenseRow(exp.id, exp.uraian)}
                                        className="p-1 rounded bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-800 cursor-pointer"
                                        title="Hapus baris ini"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden text-slate-900">
                  <div className="px-4 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <PackagePlus className="w-4 h-4 text-purple-400" />
                      <div>
                        <span className="font-black text-xs uppercase tracking-wide block">
                          SHEET 5_BARANG_EKSTRA: DATABASE INVENTARIS BARANG EKSTRA ({barangEkstraItems.length} BARIS)
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs border border-slate-800 whitespace-nowrap">
                      <thead className="sticky top-0 z-20 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-tight">
                        <tr>
                          <th className="border border-slate-700 py-2 px-2.5 text-center">No</th>
                          <th className="border border-slate-700 py-2 px-3">Nama UPT Sekolah</th>
                          <th className="border border-slate-700 py-2 px-3">Nama Barang</th>
                          <th className="border border-slate-700 py-2 px-3">Merk / Spesifikasi</th>
                          <th className="border border-slate-700 py-2 px-2.5 text-center">Vol</th>
                          <th className="border border-slate-700 py-2 px-2.5 text-center">Satuan</th>
                          <th className="border border-slate-700 py-2 px-3 text-right">Harga Satuan</th>
                          <th className="border border-slate-700 py-2 px-3 text-right">Total Nilai</th>
                          <th className="border border-slate-700 py-2 px-2.5 text-center">Status</th>
                          <th className="border border-slate-700 py-2 px-2.5 text-center">Hapus</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white text-slate-900 divide-y divide-slate-200">
                        {barangEkstraItems
                          .filter((item) => {
                            if (!searchBelanjaQuery.trim()) return true;
                            const q = searchBelanjaQuery.toLowerCase();
                            return (
                              (item.schoolName || '').toLowerCase().includes(q) ||
                              (item.namaBarang || '').toLowerCase().includes(q) ||
                              (item.spesifikasi || '').toLowerCase().includes(q)
                            );
                          })
                          .map((item, idx) => (
                            <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                              <td className="border border-slate-300 py-1.5 px-2.5 text-center font-bold text-slate-600 bg-slate-50">
                                {idx + 1}
                              </td>
                              <td className="border border-slate-300 py-1.5 px-3 font-bold text-slate-900">
                                {item.schoolName}
                              </td>
                              <td className="border border-slate-300 py-1.5 px-3 font-semibold">
                                {item.namaBarang}
                              </td>
                              <td className="border border-slate-300 py-1.5 px-3 text-slate-600">
                                {item.spesifikasi || '-'}
                              </td>
                              <td className="border border-slate-300 py-1.5 px-2.5 text-center font-mono">
                                {item.volume}
                              </td>
                              <td className="border border-slate-300 py-1.5 px-2.5 text-center">
                                {item.satuan}
                              </td>
                              <td className="border border-slate-300 py-1.5 px-3 text-right font-mono">
                                {formatRupiah(item.hargaSatuan)}
                              </td>
                              <td className="border border-slate-300 py-1.5 px-3 text-right font-mono font-bold text-purple-900">
                                {formatRupiah(item.totalHarga)}
                              </td>
                              <td className="border border-slate-300 py-1.5 px-2.5 text-center">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                                  {item.status}
                                </span>
                              </td>
                              <td className="border border-slate-300 py-1.5 px-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBarangEkstraRow(item.id, item.namaBarang)}
                                  className="p-1 rounded bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-800 cursor-pointer"
                                  title="Hapus Barang Ekstra"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: TABEL 6_AKUN_APLIKASI (DATABASE SPREADSHEET AKUN APLIKASI INI) */}
          {activeTab === 'akun_table' && (
            <div className="space-y-4">
              {/* Filter, Search & Actions Toolbar */}
              <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchAkunQuery}
                      onChange={(e) => setSearchAkunQuery(e.target.value)}
                      placeholder="Cari UPT, Username, NPSN, Pejabat..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <select
                    value={filterAkunRole}
                    onChange={(e) => setFilterAkunRole(e.target.value as any)}
                    className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                  >
                    <option value="ALL">Semua Role ({masterSchools.length})</option>
                    <option value="Admin">
                      Role: Admin ({masterSchools.filter((s) => s.role === 'Admin').length})
                    </option>
                    <option value="Operator BOSP">
                      Role: Operator BOSP ({masterSchools.filter((s) => s.role === 'Operator BOSP').length})
                    </option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setShowPasswords(!showPasswords)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-700 text-slate-200 font-bold transition-all cursor-pointer"
                  >
                    {showPasswords ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                        <span>Sembunyikan Password</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Tampilkan Password</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenAddAccount}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow transition-all cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Tambah Akun Baru</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadAkunOnly}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh Database Akun (.xlsx)</span>
                  </button>
                </div>
              </div>

              {/* Add / Edit Account Inline Form */}
              {showAddAccountForm && (
                <form
                  onSubmit={handleSaveAccountForm}
                  className="p-4 rounded-2xl bg-slate-800/95 border border-indigo-500/50 space-y-3 animate-fadeIn text-xs"
                >
                  <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                    <h4 className="font-black text-white flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-indigo-400" />
                      <span>
                        {editingAccountId
                          ? 'Edit Akun Aplikasi di Database Spreadsheet'
                          : 'Tambah Akun Aplikasi Baru ke Database Spreadsheet'}
                      </span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddAccountForm(false);
                        setEditingAccountId(null);
                      }}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Nama UPT / Satuan Pendidikan *
                      </label>
                      <input
                        type="text"
                        required
                        value={formUpt}
                        onChange={(e) => setFormUpt(e.target.value)}
                        placeholder="Contoh: SD NEGERI 1 RATAHAN"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Username Login (Kolom C) *
                      </label>
                      <input
                        type="text"
                        required
                        value={formUsername}
                        onChange={(e) => setFormUsername(e.target.value)}
                        placeholder="Contoh: sdn1ratahan"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-emerald-300 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Password Login (Kolom D) *
                      </label>
                      <input
                        type="text"
                        required
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        placeholder="Contoh: 40101977"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-amber-300 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Role Akun (Kolom E) *
                      </label>
                      <select
                        value={formRole}
                        onChange={(e) => setFormRole(e.target.value as UserRole)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="Operator BOSP">Operator BOSP</option>
                        <option value="Admin">Admin</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        NPSN / Kode Unit
                      </label>
                      <input
                        type="text"
                        value={formNpsn}
                        onChange={(e) => setFormNpsn(e.target.value)}
                        placeholder="Contoh: 40101977"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Kecamatan
                      </label>
                      <input
                        type="text"
                        value={formKecamatan}
                        onChange={(e) => setFormKecamatan(e.target.value)}
                        placeholder="Contoh: Ratahan"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Nama Operator / Pengurus Barang (Kolom B)
                      </label>
                      <input
                        type="text"
                        value={formNamaPejabat}
                        onChange={(e) => setFormNamaPejabat(e.target.value)}
                        placeholder="Nama Operator / Pengurus Barang"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Nama Kepala Sekolah
                      </label>
                      <input
                        type="text"
                        value={formKepsek}
                        onChange={(e) => setFormKepsek(e.target.value)}
                        placeholder="Nama Kepala Sekolah"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddAccountForm(false);
                        setEditingAccountId(null);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Simpan ke Database Akun</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Spreadsheet Table for 6_AKUN_APLIKASI */}
              <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden text-slate-900">
                <div className="px-4 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-rose-400" />
                    <div>
                      <span className="font-black text-xs uppercase tracking-wide block">
                        SHEET 6_AKUN_APLIKASI: DATABASE SPREADSHEET AKUN LOGIN APLIKASI BOSP
                      </span>
                      <span className="text-[10px] text-slate-300 font-normal">
                        Kolom A–G kompatibel langsung dengan Sistem Login UPT Spreadsheet ({filteredAccounts.length} Akun Ditampilkan)
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] text-rose-300 font-bold bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                    Total: {masterSchools.length} Akun Terdaftar
                  </span>
                </div>

                <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs border border-slate-800 whitespace-nowrap">
                    <thead className="sticky top-0 z-20 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-tight shadow-md">
                      <tr>
                        <th className="border border-slate-700 py-2.5 px-2.5 text-center bg-slate-800">No</th>
                        <th className="border border-slate-700 py-2.5 px-3 bg-slate-800">Kolom A: ID</th>
                        <th className="border border-slate-700 py-2.5 px-3 bg-slate-800">Kolom B: Nama Operator / Pejabat</th>
                        <th className="border border-slate-700 py-2.5 px-3 bg-emerald-900 text-emerald-100">Kolom C: Username</th>
                        <th className="border border-slate-700 py-2.5 px-3 bg-amber-900 text-amber-100">Kolom D: Password</th>
                        <th className="border border-slate-700 py-2.5 px-3 text-center bg-indigo-900 text-indigo-100">Kolom E: Role</th>
                        <th className="border border-slate-700 py-2.5 px-3 bg-slate-800">Kolom F: NAMA UPT</th>
                        <th className="border border-slate-700 py-2.5 px-3 text-center bg-slate-800">NPSN</th>
                        <th className="border border-slate-700 py-2.5 px-3 bg-slate-800">Kecamatan</th>
                        <th className="border border-slate-700 py-2.5 px-3 bg-slate-800">Kepala Sekolah</th>
                        <th className="border border-slate-700 py-2.5 px-3 bg-slate-800">Bendahara BOS</th>
                        <th className="border border-slate-700 py-2.5 px-3 text-center bg-slate-800">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white text-slate-900 divide-y divide-slate-200">
                      {filteredAccounts.map((acc, idx) => {
                        const namaOperator =
                          acc.pengurusBarang ||
                          acc.bendahara ||
                          acc.kepalaSekolah ||
                          `Operator ${acc.upt}`;
                        const isAdminRole = acc.role === 'Admin';
                        return (
                          <tr key={acc.id + acc.upt + idx} className="hover:bg-slate-50 transition-colors">
                            <td className="border border-slate-300 py-1.5 px-2.5 text-center font-bold text-slate-600 bg-slate-50">
                              {idx + 1}
                            </td>
                            <td className="border border-slate-300 py-1.5 px-3 font-mono text-[11px] text-slate-600">
                              {acc.id}
                            </td>
                            <td className="border border-slate-300 py-1.5 px-3 font-semibold text-slate-800">
                              {namaOperator}
                            </td>
                            <td className="border border-slate-300 py-1.5 px-3 font-mono font-bold text-emerald-800 bg-emerald-50/50">
                              {acc.username}
                            </td>
                            <td className="border border-slate-300 py-1.5 px-3 font-mono font-bold text-amber-900 bg-amber-50/50">
                              {showPasswords ? acc.password : '••••••••'}
                            </td>
                            <td className="border border-slate-300 py-1.5 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                  isAdminRole
                                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                    : 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                                }`}
                              >
                                {acc.role}
                              </span>
                            </td>
                            <td className="border border-slate-300 py-1.5 px-3 font-black text-slate-900">
                              {acc.upt}
                            </td>
                            <td className="border border-slate-300 py-1.5 px-3 text-center font-mono text-slate-700">
                              {acc.npsn || '-'}
                            </td>
                            <td className="border border-slate-300 py-1.5 px-3 text-slate-700">
                              {acc.kecamatan || '-'}
                            </td>
                            <td className="border border-slate-300 py-1.5 px-3 text-slate-700">
                              {acc.kepalaSekolah || '-'}
                            </td>
                            <td className="border border-slate-300 py-1.5 px-3 text-slate-700">
                              {acc.bendahara || '-'}
                            </td>
                            <td className="border border-slate-300 py-1.5 px-2.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleCopyCredential(acc)}
                                  className="p-1 rounded bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 transition-colors cursor-pointer"
                                  title="Salin Username & Password"
                                >
                                  {copiedId === acc.id ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditAccount(acc)}
                                  className="p-1 rounded bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-800 transition-colors cursor-pointer"
                                  title="Edit Akun"
                                >
                                  <Edit className="w-3.5 h-3.5" />
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
            </div>
          )}

          {activeTab === 'import' && (
            <div className="space-y-6">
              {/* Mode Sinkronisasi Penuh Toggle */}
              <div className="p-4 rounded-2xl bg-slate-800/90 border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-black text-white block">
                    Mode Penerapan Perubahan Spreadsheet ke Aplikasi
                  </span>
                  <span className="text-[11px] text-slate-300 block">
                    Jika dicentang, baris yang Anda ubah atau hapus di Spreadsheet akan menggantikan data lama di aplikasi secara penuh (tidak tertimpa balik oleh data lama).
                  </span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-950 px-3.5 py-2 rounded-xl border border-emerald-500/40 text-xs font-bold text-emerald-300 shrink-0">
                  <input
                    type="checkbox"
                    checked={replaceAllOnImport}
                    onChange={(e) => setReplaceAllOnImport(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span>Sinkronisasi Penuh (Ganti Data Sesuai Spreadsheet)</span>
                </label>
              </div>

              {/* Cara 1: Tarik Langsung dari Google Spreadsheet / Apps Script */}
              <div className="p-5 rounded-2xl bg-slate-800/70 border border-indigo-500/40 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      <RotateCw className="w-4 h-4 text-indigo-400" />
                      Cara 1: Tarik Perubahan Langsung dari Google Spreadsheet Online
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Setelah Anda mengubah angka, akun, atau rincian di Google Sheets, klik tombol di bawah untuk menarik seluruh 6 lembar kerja (<code className="text-emerald-300">1_PANEL_ADMIN_UPT</code> s/d <code className="text-emerald-300">6_AKUN_APLIKASI</code>) ke aplikasi.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handlePullFromGasInModal}
                    disabled={isPullingRemote}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 cursor-pointer flex items-center gap-2 shrink-0"
                  >
                    <RotateCw className={`w-4 h-4 ${isPullingRemote ? 'animate-spin' : ''}`} />
                    <span>{isPullingRemote ? 'Menarik Data...' : 'Tarik via Web App Apps Script'}</span>
                  </button>
                </div>

                <div className="pt-3 border-t border-slate-700/70 flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={sheetLinkInput}
                    onChange={(e) => setSheetLinkInput(e.target.value)}
                    placeholder="Atau tempel Link Google Spreadsheet (https://docs.google.com/spreadsheets/d/.../edit)..."
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <button
                    type="button"
                    onClick={handlePullFromSheetLinkInModal}
                    disabled={isPullingRemote}
                    className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-xs shadow cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Tarik dari Link Spreadsheet</span>
                  </button>
                </div>
              </div>

              {/* Cara 2: Upload File Excel (.xlsx) */}
              <div className="p-6 rounded-2xl border-2 border-dashed border-slate-700 bg-slate-950/40 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-md">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="max-w-lg mx-auto space-y-1">
                  <h3 className="text-sm font-black text-white">
                    Cara 2: Upload File Database Spreadsheet Excel (.xlsx) yang Sudah Diedit
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Sistem mendeteksi perubahan pada ke-6 lembar kerja: <b>1_PANEL_ADMIN_UPT</b>, <b>2_REKAPAN_SE_DINAS</b>,{' '}
                    <b>3_BELANJA_PERSEDIAAN</b>, <b>4_BELANJA_PEMELIHARAAN</b>, <b>5_BARANG_EKSTRA</b>, dan <b>6_AKUN_APLIKASI</b> secara otomatis.
                  </p>
                </div>

                <div className="flex items-center justify-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleFileChange}
                    className="hidden"
                    id="upload-master-database-input"
                  />
                  <label
                    htmlFor="upload-master-database-input"
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 cursor-pointer transition-all inline-flex items-center gap-2"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Pilih File Excel Database (.xlsx)</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs border border-slate-700 cursor-pointer transition-all inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Template</span>
                  </button>
                </div>

                {isProcessing && (
                  <div className="flex items-center justify-center gap-2 text-xs text-emerald-400 font-bold animate-pulse pt-2">
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Menganalisis lembar kerja spreadsheet...</span>
                  </div>
                )}
              </div>

              {/* Import Detection Result Preview */}
              {importResult && (
                <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-white flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Hasil Deteksi Lembar Kerja Spreadsheet
                    </h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                      {importResult.sheetsFound.length} Lembar Terdeteksi
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-700/80 space-y-1">
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">
                        Belanja Persediaan
                      </span>
                      <p className="text-base font-black text-emerald-400">
                        {importResult.persediaanCount} Transaksi
                      </p>
                      <span className="text-[10px] text-slate-400">Termasuk Rekap Dinas</span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-700/80 space-y-1">
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">
                        Belanja Pemeliharaan
                      </span>
                      <p className="text-base font-black text-cyan-400">
                        {importResult.pemeliharaanCount} Transaksi
                      </p>
                      <span className="text-[10px] text-slate-400">Siap diterapkan</span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-700/80 space-y-1">
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">
                        Barang Ekstra
                      </span>
                      <p className="text-base font-black text-purple-400">
                        {importResult.barangEkstraCount} Barang
                      </p>
                      <span className="text-[10px] text-slate-400">Siap diterapkan</span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-900/80 border border-rose-500/40 space-y-1">
                      <span className="text-[10px] text-rose-300 block font-semibold uppercase">
                        Akun &amp; UPT
                      </span>
                      <p className="text-base font-black text-rose-400">
                        {importResult.akunCount || 0} Akun
                      </p>
                      <span className="text-[10px] text-slate-400">Termasuk Panel Admin</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-700/60">
                    <button
                      type="button"
                      onClick={() => setImportResult(null)}
                      className="px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyImport}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-600/30 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        Terapkan Perubahan ke Aplikasi (
                        {importResult.persediaanCount +
                          importResult.pemeliharaanCount +
                          importResult.barangEkstraCount +
                          (importResult.akunCount || 0)}{' '}
                        Data)
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'structure' && (
            <div className="space-y-4">
              <h3 className="text-xs font-black text-white">
                Skema Relasi Kolom Database Spreadsheet (6 Lembar Kerja Utama)
              </h3>
              <div className="space-y-3 text-xs">
                {/* 1 */}
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-amber-300">1. Sheet: 1_PANEL_ADMIN_UPT</span>
                    <span className="text-[10px] text-slate-400 font-mono">17 Kolom</span>
                  </div>
                  <p className="text-slate-400 text-[11.5px]">
                    No, Nama UPT Sekolah, NPSN, Kecamatan, Jenjang, Kepala Sekolah, NIP Kepala Sekolah,
                    Bendahara BOS, NIP Bendahara, Pengurus Barang, NIP Pengurus Barang, Pagu Tahunan (Rp),
                    Total Belanja LRA (Rp), Sisa Pagu (Rp), Serapan (%), Total Transaksi, Status Approval.
                  </p>
                </div>

                {/* 2 */}
                <div className="p-4 rounded-xl bg-slate-800/60 border border-indigo-500/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-indigo-300">
                      2. Sheet: 2_REKAPAN_SE_DINAS (Tabel Matriks Laporan Menu Rekapan Dinas)
                    </span>
                    <span className="text-[10px] text-emerald-300 font-mono">
                      Header Bertingkat 3 Baris (Per Jenis Persediaan = 7 Sub-Kolom)
                    </span>
                  </div>
                  <p className="text-slate-300 text-[11.5px] leading-relaxed">
                    <b>Baris Header 1:</b> NO | NAMA UPT / SATUAN PENDIDIKAN | [JENIS PERSEDIAAN 1..N (7 Kolom)] | TOTAL MASUK | TOTAL KELUAR | TOTAL SALDO AKHIR
                    <br />
                    <b>Baris Header 2:</b> SALDO AWAL (3 Kolom) | BELANJA (3 Kolom) | SALDO AKHIR (Rowspan 2)
                    <br />
                    <b>Baris Header 3:</b> Masuk | Keluar | Sisa | Masuk | Keluar | Sisa | Saldo Akhir
                    <br />
                    <b>Baris Footer:</b> JUMLAH TOTAL SE-KABUPATEN
                  </p>
                </div>

                {/* 3 */}
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-emerald-300">3. Sheet: 3_BELANJA_PERSEDIAAN</span>
                    <span className="text-[10px] text-slate-400 font-mono">30 Kolom</span>
                  </div>
                  <p className="text-slate-400 text-[11.5px]">
                    No, ID Transaksi, Nama UPT Sekolah, NPSN, Tanggal SPJ, No Bukti, Triwulan, Sumber Dana,
                    Komponen BOS, Kode Rekening Persediaan, Uraian Belanja, Penerima / Nama Toko, NPWP Toko,
                    Metode Bayar, Volume, Satuan, Harga Satuan, Subtotal, Saldo Awal 1 Jan, Belanja LRA,
                    Pengeluaran Saldo Awal, Pengeluaran Belanja, Hibah Masuk, Hibah Keluar, Saldo Akhir,
                    Jenis Pajak, Nilai Pajak, Total Bersih, Status SPJ, Catatan.
                  </p>
                </div>

                {/* 4 */}
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-cyan-300">4. Sheet: 4_BELANJA_PEMELIHARAAN</span>
                    <span className="text-[10px] text-slate-400 font-mono">20 Kolom</span>
                  </div>
                  <p className="text-slate-400 text-[11.5px]">
                    No, ID Transaksi, Nama UPT Sekolah, NPSN, Tanggal SPJ, No Bukti Kas, No BAST Pemeliharaan,
                    Tanggal BAST, Triwulan, Sumber Dana, Kode Rekening Pemeliharaan, Jenis Pekerjaan /
                    Pemeliharaan, Nilai Jasa (Rp), Nilai Barang (Rp), Total Belanja LRA (Rp), Nilai Pengakuan
                    BAST (Rp), Pengeluaran Belanja (Rp), Pengeluaran BAST Di Luar Belanja (Rp), Rekanan /
                    Bengkel, Keterangan, Status SPJ.
                  </p>
                </div>

                {/* 5 */}
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-purple-300">5. Sheet: 5_BARANG_EKSTRA</span>
                    <span className="text-[10px] text-slate-400 font-mono">16 Kolom</span>
                  </div>
                  <p className="text-slate-400 text-[11.5px]">
                    No, ID Barang, Nama UPT Sekolah, NPSN, Tahun Anggaran, Tanggal Perolehan, Nama Barang,
                    Merk / Spesifikasi, Volume, Satuan, Harga Satuan, Total Nilai Perolehan, Kondisi, Sumber
                    Dana, Keterangan / Lokasi, Status.
                  </p>
                </div>

                {/* 6 */}
                <div className="p-4 rounded-xl bg-slate-800/60 border border-rose-500/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-rose-300">
                      6. Sheet: 6_AKUN_APLIKASI (Database Akun Login Aplikasi &amp; Users)
                    </span>
                    <span className="text-[10px] text-rose-300 font-mono">16 Kolom (Kolom A–G Login)</span>
                  </div>
                  <p className="text-slate-300 text-[11.5px]">
                    <b>Kolom A:</b> ID | <b>Kolom B:</b> Nama | <b>Kolom C:</b> Username | <b>Kolom D:</b> Password |{' '}
                    <b>Kolom E:</b> Role (Admin / Operator BOSP) | <b>Kolom F:</b> NAMA UPT | <b>Kolom G:</b> Waktu_Dibuat |{' '}
                    NPSN, Kecamatan, Kepala Sekolah, NIP Kepala Sekolah, Bendahara BOS, NIP Bendahara,
                    Pengurus Barang, NIP Pengurus Barang, Status Akun.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Format Resmi XLSX Sesuai Laporan Menu Rekapan Dinas &amp; Juknis BOSP</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadDatabase}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh Spreadsheet (.xlsx)</span>
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

      {/* Modal Apps Script Rekapan Se-Dinas */}
      <AppsScriptModal
        isOpen={appsScriptModalOpen}
        onClose={() => setAppsScriptModalOpen(false)}
        schoolInfo={schoolInfo}
        expenses={expenses}
        barangEkstraItems={barangEkstraItems}
        onApplyMasterDatabase={(res, rep) => applyParsedDatabaseResult(res, rep ?? true)}
        onNotify={onNotify}
      />
    </div>
  );
};
