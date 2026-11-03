/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  SchoolExpense, 
  SchoolInfo, 
  Triwulan, 
  ExpenseStatus,
  BarangEkstraItem
} from './types';
import { UserProfile, UserAccount, UserRole } from './types/auth';
import { filterExpensesByYear, filterExpensesForUser, getExpenseYear } from './utils/budgetCalculations';
import { 
  loadSchoolExpenses, 
  saveSchoolExpenses, 
  clearAllSchoolExpenses,
  loadSchoolInfo, 
  saveSchoolInfo,
  loadBarangEkstraItems,
  saveBarangEkstraItems,
  purgeAllLocalDatabaseStorage,
  pushSharedStateToServer
} from './utils/storage';
import { 
  loadStoredAccounts, 
  loadCurrentSession, 
  saveCurrentSession,
  isAdminUser
} from './utils/auth';
import { INITIAL_SCHOOL_INFO } from './data/initialData';
import {
  UptSchoolAccount,
  loadUptSchools,
  saveUptSchools,
  normalizeUptKey,
  generateSlugUsername,
  inferKecamatanFromUpt,
} from './data/schoolData';
import { ParseMasterDatabaseResult } from './utils/databaseSpreadsheet';
import {
  syncAllDataToRekapanGas,
  syncAccountsOnlyToRekapanGas,
  pullAllDataFromRekapanGas,
} from './utils/googleAppsScriptCode';
import { AppHeader } from './components/AppHeader';
import { SidebarNav, ReportVariant } from './components/SidebarNav';
import { ActiveTab } from './components/BottomNavBar';
import { DashboardView } from './components/DashboardView';
import { ExpenseListView } from './components/ExpenseListView';
import { ExpenseFormView } from './components/ExpenseFormView';
import { ReceiptPrintView, ReklasSubView } from './components/ReceiptPrintView';
import { SchoolSettingsView } from './components/SchoolSettingsView';
import { ExpenseDetailModal } from './components/ExpenseDetailModal';
import { AuthModal } from './components/AuthModal';
import { LoginScreen } from './components/LoginScreen';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { AdminPanelView } from './components/AdminPanelView';
import { DinasRekapView } from './components/DinasRekapView';
import { CetakLaporanView } from './components/CetakLaporanView';
import { BarangEkstraView } from './components/BarangEkstraView';
import { DatabaseSpreadsheetModal } from './components/DatabaseSpreadsheetModal';
import { CheckCircle2 } from 'lucide-react';

export default function App() {
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>(loadSchoolInfo);
  const [expenses, setExpenses] = useState<SchoolExpense[]>(loadSchoolExpenses);
  const [barangEkstraItems, setBarangEkstraItems] = useState<BarangEkstraItem[]>(loadBarangEkstraItems);
  const [masterSchools, setMasterSchools] = useState<UptSchoolAccount[]>(loadUptSchools);
  const lastServerUpdatedAtRef = useRef<string>('');
  const gasSyncTimeoutRef = useRef<number | null>(null);
  const isPullingSpreadsheetRef = useRef<boolean>(false);
  const lastLocalMutationAtRef = useRef<number>(0);

  const scheduleBackgroundGasSync = useCallback(
    (
      nextExpenses: SchoolExpense[],
      nextBarangEkstra: BarangEkstraItem[],
      nextSchoolInfo: SchoolInfo,
      nextSchools?: UptSchoolAccount[]
    ) => {
      if (gasSyncTimeoutRef.current) {
        window.clearTimeout(gasSyncTimeoutRef.current);
      }
      gasSyncTimeoutRef.current = window.setTimeout(() => {
        syncAllDataToRekapanGas({
          schoolInfo: nextSchoolInfo,
          expenses: nextExpenses,
          barangEkstraItems: nextBarangEkstra,
          masterSchools: nextSchools || loadUptSchools(),
        }).catch(() => {
          // Background sync - ignore network errors
        });
      }, 200);
    },
    []
  );

  // Pull all 6 sheets exclusively from Google Spreadsheet Database (No Local Database)
  useEffect(() => {
    let isMounted = true;
    purgeAllLocalDatabaseStorage();

    const syncFromGoogleSpreadsheet = async () => {
      if (isPullingSpreadsheetRef.current) return;
      // Do not overwrite local state if user just saved changes within the last 20 seconds
      if (Date.now() - lastLocalMutationAtRef.current < 20000) return;
      isPullingSpreadsheetRef.current = true;
      try {
        const initialInfo = loadSchoolInfo();
        const res = await pullAllDataFromRekapanGas(initialInfo);
        if (!isMounted || !res.success || !res.parsed) return;
        // Re-check after async pull completes so in-flight pulls never clobber a just-saved edit
        if (Date.now() - lastLocalMutationAtRef.current < 20000) return;

        const currentInfo = loadSchoolInfo();
        const parsed = res.parsed;
        const sheetsUpper = (parsed.sheetsFound || []).map((s) => s.toUpperCase());

        if (
          sheetsUpper.some(
            (s) =>
              s.includes('PERSEDIAAN') ||
              s.includes('PEMELIHARAAN') ||
              s.includes('REKAP')
          ) ||
          parsed.importedExpenses.length > 0
        ) {
          const sortedExpenses = parsed.importedExpenses
            .map((item) => ({
              ...item,
              tahunAnggaran: item.tahunAnggaran || getExpenseYear(item) || currentInfo.tahunAnggaran,
            }))
            .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
          saveSchoolExpenses(sortedExpenses);
          setExpenses(sortedExpenses);
        }

        if (
          sheetsUpper.some((s) => s.includes('EKSTRA')) ||
          parsed.importedBarangEkstra.length > 0
        ) {
          saveBarangEkstraItems(parsed.importedBarangEkstra);
          setBarangEkstraItems(parsed.importedBarangEkstra);
        }

        if (parsed.importedAccounts && parsed.importedAccounts.length > 0) {
          saveUptSchools(parsed.importedAccounts, false);
          setMasterSchools(parsed.importedAccounts);

          const sessionUser = loadCurrentSession();
          const currentNorm = normalizeUptKey(currentInfo.namaSekolah || sessionUser?.schoolName || '');
          const matched = parsed.importedAccounts.find(
            (s) => normalizeUptKey(s.upt) === currentNorm
          );
          if (matched) {
            const nextInfo: SchoolInfo = {
              ...currentInfo,
              namaSekolah: matched.upt || currentInfo.namaSekolah,
              npsn: matched.npsn && matched.npsn !== '-' ? matched.npsn : currentInfo.npsn,
              kecamatan: matched.kecamatan || currentInfo.kecamatan,
              kepalaSekolah: matched.kepalaSekolah || currentInfo.kepalaSekolah,
              nipKepalaSekolah: matched.nipKepalaSekolah || currentInfo.nipKepalaSekolah,
              bendahara: matched.bendahara || currentInfo.bendahara,
              nipBendahara: matched.nipBendahara || currentInfo.nipBendahara,
              bendaharaBarang: matched.pengurusBarang || currentInfo.bendaharaBarang,
              nipBendaharaBarang: matched.nipPengurusBarang || currentInfo.nipBendaharaBarang,
            };
            saveSchoolInfo(nextInfo);
            setSchoolInfo(nextInfo);
          }
        }
      } catch {
        // Ignore network errors during background spreadsheet pull
      } finally {
        isPullingSpreadsheetRef.current = false;
      }
    };

    syncFromGoogleSpreadsheet();

    const handleFocus = () => {
      syncFromGoogleSpreadsheet();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const handleSaveBarangEkstra = (item: BarangEkstraItem) => {
    lastLocalMutationAtRef.current = Date.now();
    setBarangEkstraItems((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing && existing.status === 'Disetujui Kepala Sekolah') {
        showToast('Barang yang sudah di-approve tidak dapat diubah.', 'info');
        return prev;
      }
      const updated = existing
        ? prev.map((i) => (i.id === item.id ? item : i))
        : [item, ...prev];
      saveBarangEkstraItems(updated);
      pushSharedStateToServer({
        barangEkstraItems: updated,
        isDirectSave: true,
      }).then((state) => {
        if (state?.updatedAt) lastServerUpdatedAtRef.current = state.updatedAt;
      });
      scheduleBackgroundGasSync(expenses, updated, schoolInfo);
      return updated;
    });
    showToast('Data Barang Ekstra berhasil disimpan & disinkronkan.');
  };

  const handleDeleteBarangEkstra = (id: string) => {
    lastLocalMutationAtRef.current = Date.now();
    setBarangEkstraItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target && target.status === 'Disetujui Kepala Sekolah') {
        showToast('Barang yang sudah di-approve tidak dapat dihapus.', 'info');
        return prev;
      }
      const updated = prev.filter((i) => i.id !== id);
      saveBarangEkstraItems(updated);
      pushSharedStateToServer({
        barangEkstraItems: updated,
        deletedBarangEkstraIds: [id],
      }).then((state) => {
        if (state?.updatedAt) lastServerUpdatedAtRef.current = state.updatedAt;
      });
      scheduleBackgroundGasSync(expenses, updated, schoolInfo);
      return updated;
    });
    showToast('Data Barang Ekstra berhasil dihapus.', 'info');
  };

  const handleUpdateBarangEkstraStatus = (id: string, status: BarangEkstraItem['status']) => {
    lastLocalMutationAtRef.current = Date.now();
    setBarangEkstraItems((prev) => {
      const updated = prev.map((i) => (i.id === id ? { ...i, status } : i));
      saveBarangEkstraItems(updated);
      pushSharedStateToServer({
        barangEkstraItems: updated,
        isDirectSave: true,
      }).then((state) => {
        if (state?.updatedAt) lastServerUpdatedAtRef.current = state.updatedAt;
      });
      scheduleBackgroundGasSync(expenses, updated, schoolInfo);
      return updated;
    });
    showToast(
      status === 'Disetujui Kepala Sekolah'
        ? 'Barang Ekstra berhasil di-Approve & disinkronkan.'
        : 'Status Barang Ekstra diubah menjadi Menunggu (Batal Approve).'
    );
  };

  // Authentication State
  const [accounts] = useState<UserAccount[]>(loadStoredAccounts);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(loadCurrentSession);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  
  // Google Sheets Modal State
  const [googleSheetsModalOpen, setGoogleSheetsModalOpen] = useState(false);
  const [databaseSpreadsheetModalOpen, setDatabaseSpreadsheetModalOpen] = useState(false);

  // Navigation & Filtering State
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedReportVariant, setSelectedReportVariant] = useState<ReportVariant>('rekon');
  const [selectedReklasSubView, setSelectedReklasSubView] = useState<ReklasSubView>('ba_reklas');
  const [expenseInputMode, setExpenseInputMode] = useState<'persediaan' | 'pemeliharaan'>('persediaan');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeQuarterFilter, setActiveQuarterFilter] = useState<string[]>([
    'TW1',
    'TW2',
    'TW3',
    'TW4',
  ]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const isAdmin = isAdminUser(currentUser);
  // Filter per Tahun Anggaran aktif
  const yearFilteredExpenses = filterExpensesByYear(expenses, schoolInfo.tahunAnggaran);
  // Hak akses: Admin melihat semua inputan, Operator BOS HANYA melihat inputan sekolah masing-masing
  const activeYearExpenses = filterExpensesForUser(yearFilteredExpenses, currentUser, schoolInfo.namaSekolah);
  const pendingApprovalCount = activeYearExpenses.filter((e) => e.status !== 'Disetujui Kepala Sekolah').length;

  // Modals & Selected items
  const [selectedExpenseForDetail, setSelectedExpenseForDetail] = useState<SchoolExpense | null>(null);
  const [editingExpense, setEditingExpense] = useState<SchoolExpense | null>(null);
  const [expenseForReceipt, setExpenseForReceipt] = useState<SchoolExpense | null>(null);
  const [formDefaultQuarter, setFormDefaultQuarter] = useState<Triwulan>('TW1');

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  // Automatically scroll to top when changing active tab
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeTab]);

  const showToast = (text: string, type: 'success' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Auth Handlers
  const handleOpenAuth = (mode: 'login' | 'register') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  const handleLoginSuccess = (user: UserProfile, schoolAccount?: UptSchoolAccount, loginYear?: string) => {
    setCurrentUser(user);
    saveCurrentSession(user);
    setSelectedExpenseForDetail(null);
    setEditingExpense(null);
    setExpenseForReceipt(null);

    const matchedSchool =
      schoolAccount ||
      loadUptSchools().find(
        (s) => s.upt.toLowerCase() === (user.schoolName || '').toLowerCase()
      );

    const resolvedYear = loginYear ? Number(loginYear) || schoolInfo.tahunAnggaran : schoolInfo.tahunAnggaran;
    if (matchedSchool) {
      const updatedInfo: SchoolInfo = {
        ...schoolInfo,
        tahunAnggaran: resolvedYear,
        namaSekolah: matchedSchool.upt,
        npsn: matchedSchool.npsn || schoolInfo.npsn,
        kecamatan: matchedSchool.kecamatan || schoolInfo.kecamatan,
        alamat: matchedSchool.kecamatan ? `Kec. ${matchedSchool.kecamatan}` : schoolInfo.alamat,
        kepalaSekolah: matchedSchool.kepalaSekolah || schoolInfo.kepalaSekolah,
        nipKepalaSekolah: matchedSchool.nipKepalaSekolah || schoolInfo.nipKepalaSekolah,
        bendahara: matchedSchool.bendahara || schoolInfo.bendahara,
        nipBendahara: matchedSchool.nipBendahara || schoolInfo.nipBendahara,
        bendaharaBarang: matchedSchool.pengurusBarang || schoolInfo.bendaharaBarang,
        nipBendaharaBarang: matchedSchool.nipPengurusBarang || schoolInfo.nipBendaharaBarang,
      };
      setSchoolInfo(updatedInfo);
      saveSchoolInfo(updatedInfo);
    } else if (loginYear) {
      const updatedInfo: SchoolInfo = {
        ...schoolInfo,
        tahunAnggaran: resolvedYear,
      };
      setSchoolInfo(updatedInfo);
      saveSchoolInfo(updatedInfo);
    }

    if (isAdminUser(user)) {
      setActiveTab('dashboard');
      showToast(`Selamat datang Admin ${user.name} (${user.schoolName})!`);
    } else {
      setActiveTab('dashboard');
      showToast(`Selamat datang kembali, ${user.name} - ${user.schoolName}!`);
    }
  };

  const handleSwitchRole = (newRole: UserRole) => {
    if (!currentUser) return;
    const updatedUser: UserProfile = {
      ...currentUser,
      role: newRole,
    };
    setCurrentUser(updatedUser);
    saveCurrentSession(updatedUser);
    if (newRole === 'Admin') {
      setActiveTab('admin');
      showToast('Mode Tampilan Khusus Admin diaktifkan (Hak Akses Edit & Approve).');
    } else {
      if (activeTab === 'admin') {
        setActiveTab('dashboard');
      }
      showToast('Mode Operator BOSP diaktifkan.');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    saveCurrentSession(null);
    setActiveTab('dashboard');
    showToast('Anda telah keluar dari sistem.', 'info');
  };

  // Sync state to LocalStorage + Shared Server DB + Google Apps Script Spreadsheet
  const updateExpenses = (newExpenses: SchoolExpense[], deletedIds?: string[]) => {
    lastLocalMutationAtRef.current = Date.now();
    setExpenses(newExpenses);
    saveSchoolExpenses(newExpenses);
    pushSharedStateToServer({
      expenses: newExpenses,
      deletedExpenseIds: deletedIds,
      isDirectSave: !deletedIds || deletedIds.length === 0,
    }).then((state) => {
      if (state && Array.isArray(state.expenses)) {
        lastServerUpdatedAtRef.current = state.updatedAt || '';
        saveSchoolExpenses(state.expenses);
        setExpenses(state.expenses);
      }
    });
    scheduleBackgroundGasSync(newExpenses, barangEkstraItems, schoolInfo);
  };

  const updateSchoolInfo = async (newInfo: SchoolInfo, previousUptName?: string) => {
    lastLocalMutationAtRef.current = Date.now();
    const cleanedInfo: SchoolInfo = {
      ...newInfo,
      namaSekolah: (newInfo.namaSekolah || schoolInfo.namaSekolah || '').trim(),
      npsn: (newInfo.npsn || schoolInfo.npsn || '-').trim(),
      kecamatan: (newInfo.kecamatan || schoolInfo.kecamatan || '').trim(),
      alamat: (newInfo.alamat || schoolInfo.alamat || '').trim(),
      kabupaten: (newInfo.kabupaten || schoolInfo.kabupaten || '').trim(),
      kepalaSekolah: (newInfo.kepalaSekolah ?? '').trim(),
      nipKepalaSekolah: (newInfo.nipKepalaSekolah ?? '').trim(),
      bendahara: (newInfo.bendahara ?? '').trim(),
      nipBendahara: (newInfo.nipBendahara ?? '').trim(),
      bendaharaBarang: (newInfo.bendaharaBarang ?? '').trim(),
      nipBendaharaBarang: (newInfo.nipBendaharaBarang ?? '').trim(),
    };

    setSchoolInfo(cleanedInfo);
    saveSchoolInfo(cleanedInfo);

    // Match the school in 6_AKUN_APLIKASI & 1_PANEL_ADMIN_UPT by previous UPT name, new UPT name, NPSN, or logged-in school
    const currentList = loadUptSchools();
    const prevNorm = normalizeUptKey(previousUptName || schoolInfo.namaSekolah || '');
    const targetNorm = normalizeUptKey(cleanedInfo.namaSekolah || currentUser?.schoolName || '');
    const targetNpsn =
      cleanedInfo.npsn && cleanedInfo.npsn !== '-' ? cleanedInfo.npsn.toLowerCase() : '';

    let foundMatch = false;
    const updatedSchools = currentList.map((s) => {
      const sNorm = normalizeUptKey(s.upt);
      const sNpsn = s.npsn && s.npsn !== '-' ? s.npsn.trim().toLowerCase() : '';
      const isMatch =
        (prevNorm && sNorm === prevNorm) ||
        (targetNorm && sNorm === targetNorm) ||
        (targetNpsn && sNpsn && sNpsn === targetNpsn);

      if (isMatch && !foundMatch) {
        foundMatch = true;
        return {
          ...s,
          upt: cleanedInfo.namaSekolah || s.upt,
          npsn: cleanedInfo.npsn || s.npsn,
          kecamatan: cleanedInfo.kecamatan || s.kecamatan || inferKecamatanFromUpt(cleanedInfo.namaSekolah),
          kepalaSekolah: cleanedInfo.kepalaSekolah,
          nipKepalaSekolah: cleanedInfo.nipKepalaSekolah,
          bendahara: cleanedInfo.bendahara,
          nipBendahara: cleanedInfo.nipBendahara,
          pengurusBarang: cleanedInfo.bendaharaBarang,
          nipPengurusBarang: cleanedInfo.nipBendaharaBarang,
        };
      }
      return s;
    });

    if (!foundMatch && cleanedInfo.namaSekolah) {
      updatedSchools.push({
        id: cleanedInfo.npsn && cleanedInfo.npsn !== '-' ? cleanedInfo.npsn : `upt-${updatedSchools.length + 1}`,
        upt: cleanedInfo.namaSekolah,
        npsn: cleanedInfo.npsn || '-',
        kecamatan: cleanedInfo.kecamatan || inferKecamatanFromUpt(cleanedInfo.namaSekolah),
        username: generateSlugUsername(cleanedInfo.namaSekolah),
        password: cleanedInfo.npsn && cleanedInfo.npsn !== '-' ? cleanedInfo.npsn : '123456',
        role: normalizeUptKey(cleanedInfo.namaSekolah) === 'DINAS PENDIDIKAN' ? 'Admin' : 'Operator BOSP',
        kepalaSekolah: cleanedInfo.kepalaSekolah,
        nipKepalaSekolah: cleanedInfo.nipKepalaSekolah,
        bendahara: cleanedInfo.bendahara,
        nipBendahara: cleanedInfo.nipBendahara,
        pengurusBarang: cleanedInfo.bendaharaBarang,
        nipPengurusBarang: cleanedInfo.nipBendaharaBarang,
      });
    }

    saveUptSchools(updatedSchools, false);
    setMasterSchools(updatedSchools);

    // If school name or NPSN was changed, also keep existing expenses & barang ekstra in sync for that school
    let nextExpenses = expenses;
    if (prevNorm && targetNorm && prevNorm !== targetNorm) {
      let expensesChanged = false;
      nextExpenses = expenses.map((exp) => {
        if (normalizeUptKey(exp.schoolName || '') === prevNorm) {
          expensesChanged = true;
          return {
            ...exp,
            schoolName: cleanedInfo.namaSekolah,
            npsn: cleanedInfo.npsn || exp.npsn,
          };
        }
        return exp;
      });
      if (expensesChanged) {
        setExpenses(nextExpenses);
        saveSchoolExpenses(nextExpenses);
      }

      setBarangEkstraItems((prevEkstra) => {
        let ekstraChanged = false;
        const updatedEkstra = prevEkstra.map((item) => {
          if (normalizeUptKey(item.schoolName || '') === prevNorm) {
            ekstraChanged = true;
            return {
              ...item,
              schoolName: cleanedInfo.namaSekolah,
              npsn: cleanedInfo.npsn || item.npsn,
            };
          }
          return item;
        });
        if (ekstraChanged) {
          saveBarangEkstraItems(updatedEkstra);
        }
        return ekstraChanged ? updatedEkstra : prevEkstra;
      });
    }

    if (
      currentUser &&
      (normalizeUptKey(currentUser.schoolName || '') === targetNorm ||
        (prevNorm && normalizeUptKey(currentUser.schoolName || '') === prevNorm))
    ) {
      const nextUser: UserProfile = {
        ...currentUser,
        schoolName: cleanedInfo.namaSekolah || currentUser.schoolName,
        name: cleanedInfo.bendaharaBarang || cleanedInfo.kepalaSekolah || currentUser.name,
        nip: cleanedInfo.nipBendaharaBarang || cleanedInfo.nipKepalaSekolah || currentUser.nip,
      };
      setCurrentUser(nextUser);
      saveCurrentSession(nextUser);
    }

    // Immediately sync 1_PANEL_ADMIN_UPT & 6_AKUN_APLIKASI to Google Spreadsheet Database
    const syncRes = await syncAccountsOnlyToRekapanGas({
      schoolInfo: cleanedInfo,
      expenses: nextExpenses,
      masterSchools: updatedSchools,
    });

    if (syncRes.success) {
      showToast(
        `Data Umum "${cleanedInfo.namaSekolah}" berhasil diperbarui di Database Spreadsheet (1_PANEL_ADMIN_UPT & 6_AKUN_APLIKASI)!`
      );
    } else {
      showToast(
        `Data Umum "${cleanedInfo.namaSekolah}" berhasil disimpan di aplikasi & dikirim ke antrean Database Spreadsheet.`
      );
    }
    return syncRes.success;
  };

  // Handlers for expense CRUD
  const handleSaveExpense = (rawSavedExpense: SchoolExpense) => {
    const savedExpense: SchoolExpense = {
      ...rawSavedExpense,
      tahunAnggaran: rawSavedExpense.tahunAnggaran || schoolInfo.tahunAnggaran,
      schoolName: rawSavedExpense.schoolName || schoolInfo.namaSekolah,
      npsn: rawSavedExpense.npsn || schoolInfo.npsn,
    };
    const existing = expenses.find((e) => e.id === savedExpense.id);
    if (existing && !isAdmin && existing.status === 'Disetujui Kepala Sekolah') {
      showToast(
        'Inputan yang sudah di-Approve oleh Admin tidak dapat diubah oleh Operator BOS.',
        'info'
      );
      return;
    }

    const isEditing = Boolean(existing);
    let updated: SchoolExpense[];

    if (isEditing) {
      updated = expenses.map((e) => (e.id === savedExpense.id ? savedExpense : e));
      showToast('Data inputan belanja berhasil diperbarui & disinkronkan.');
    } else {
      updated = [savedExpense, ...expenses];
      showToast(`Transaksi baru (${savedExpense.triwulan}) berhasil disimpan & disinkronkan.`);
    }

    updateExpenses(updated);
    setEditingExpense(null);
    setActiveTab(isAdmin ? 'admin' : 'list');
  };

  const handleDeleteExpense = (id: string, sourceIds?: string[]) => {
    // Akun Operator BOS dan Admin dapat menghapus inputan belanja (termasuk laporan gabungan TW)
    const idsList = sourceIds && sourceIds.length > 0 ? sourceIds : [id];
    const idsToDelete = new Set(idsList);
    const updated = expenses.filter((e) => !idsToDelete.has(e.id));
    updateExpenses(updated, idsList);
    showToast('Data inputan belanja berhasil dihapus.', 'info');
  };

  const handleUpdateStatus = (id: string, newStatus: ExpenseStatus, sourceIds?: string[]) => {
    const idsToUpdate = new Set(sourceIds && sourceIds.length > 0 ? sourceIds : [id]);
    const updated = expenses.map((e) => (idsToUpdate.has(e.id) ? { ...e, status: newStatus } : e));
    updateExpenses(updated);
    if (
      selectedExpenseForDetail &&
      (selectedExpenseForDetail.id === id || idsToUpdate.has(selectedExpenseForDetail.id))
    ) {
      setSelectedExpenseForDetail({ ...selectedExpenseForDetail, status: newStatus });
    }
    showToast(`Status SPJ berhasil diubah menjadi "${newStatus}".`);
  };

  const handleApproveExpense = (id: string, sourceIds?: string[]) => {
    const idsToApprove = new Set(sourceIds && sourceIds.length > 0 ? sourceIds : [id]);
    const target = expenses.find((e) => idsToApprove.has(e.id));
    const updated = expenses.map((e) =>
      idsToApprove.has(e.id) ? { ...e, status: 'Disetujui Kepala Sekolah' as ExpenseStatus } : e
    );
    updateExpenses(updated);
    if (
      selectedExpenseForDetail &&
      (selectedExpenseForDetail.id === id || idsToApprove.has(selectedExpenseForDetail.id))
    ) {
      setSelectedExpenseForDetail({
        ...selectedExpenseForDetail,
        status: 'Disetujui Kepala Sekolah',
      });
    }
    showToast(`Inputan belanja ${target?.noBukti || ''} berhasil di-Approve oleh Admin!`);
  };

  const handleBulkApproveExpenses = (ids: string[]) => {
    const idSet = new Set(ids);
    const updated = expenses.map((e) =>
      idSet.has(e.id) ? { ...e, status: 'Disetujui Kepala Sekolah' as ExpenseStatus } : e
    );
    updateExpenses(updated);
    showToast(`Berhasil menyetujui (Approve) ${ids.length} inputan belanja sekolah!`);
  };

  const handleClearAllExpenses = () => {
    clearAllSchoolExpenses();
    setExpenses([]);
    setSelectedExpenseForDetail(null);
    setEditingExpense(null);
    setExpenseForReceipt(null);
    pushSharedStateToServer({
      clearAllExpenses: true,
      expenses: [],
    }).then((state) => {
      if (state?.updatedAt) lastServerUpdatedAtRef.current = state.updatedAt;
    });
    scheduleBackgroundGasSync([], barangEkstraItems, schoolInfo);
    showToast('Semua data inputan belanja yang sudah ada berhasil dihapus.');
  };

  const handleResetDemoData = () => {
    handleClearAllExpenses();
    setSchoolInfo(INITIAL_SCHOOL_INFO);
    saveSchoolInfo(INITIAL_SCHOOL_INFO);
  };

  // Navigation helpers
  const handleOpenNewExpense = (tw?: Triwulan) => {
    setEditingExpense(null);
    const validQuarters = activeQuarterFilter.filter((q): q is Triwulan =>
      ['TW1', 'TW2', 'TW3', 'TW4'].includes(q)
    );
    if (tw) {
      setFormDefaultQuarter(tw);
    } else if (
      validQuarters.length > 0 &&
      validQuarters.length < 4 &&
      !activeQuarterFilter.includes('Semua')
    ) {
      setFormDefaultQuarter(validQuarters[0]);
    } else {
      setFormDefaultQuarter('TW1');
    }
    setActiveTab('form');
  };

  const handleEditExpense = (exp: SchoolExpense) => {
    const actualExp =
      exp.sourceExpenseIds && exp.sourceExpenseIds.length > 0
        ? expenses.find((e) => exp.sourceExpenseIds!.includes(e.id)) || exp
        : expenses.find((e) => e.id === exp.id) || exp;
    if (!isAdmin && actualExp.status === 'Disetujui Kepala Sekolah') {
      showToast(
        'Inputan yang sudah di-Approve oleh Admin tidak dapat diedit oleh Operator BOS.',
        'info'
      );
      return;
    }
    setEditingExpense(actualExp);
    setActiveTab('form');
  };

  const handlePrintReceipt = (exp: SchoolExpense) => {
    setExpenseForReceipt(exp);
    setActiveTab('receipt');
  };

  const handleImportExpenses = (importedList: SchoolExpense[]) => {
    // Merge: update existing by ID, prepend new ones
    const existingMap = new Map(expenses.map(e => [e.id, e]));
    importedList.forEach(item => {
      existingMap.set(item.id, {
        ...item,
        tahunAnggaran: item.tahunAnggaran || getExpenseYear(item) || schoolInfo.tahunAnggaran,
      });
    });
    const merged = Array.from(existingMap.values()).sort(
      (a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()
    );
    updateExpenses(merged);
    showToast(`Berhasil mengimpor ${importedList.length} transaksi dari Google Sheets.`);
  };

  const handleUpdateMasterSchools = (updatedSchools: UptSchoolAccount[]) => {
    lastLocalMutationAtRef.current = Date.now();
    saveUptSchools(updatedSchools, false);
    setMasterSchools(updatedSchools);

    // If current school's officials or account were updated in Sheet 6 / Sheet 1, sync schoolInfo & currentUser immediately
    let nextSchoolInfo = schoolInfo;
    const currentNorm = normalizeUptKey(currentUser?.schoolName || schoolInfo.namaSekolah || '');
    const matched = updatedSchools.find((s) => normalizeUptKey(s.upt) === currentNorm);
    if (matched) {
      nextSchoolInfo = {
        ...schoolInfo,
        namaSekolah: matched.upt || schoolInfo.namaSekolah,
        npsn: matched.npsn || schoolInfo.npsn,
        kecamatan: matched.kecamatan || schoolInfo.kecamatan,
        kepalaSekolah: matched.kepalaSekolah || schoolInfo.kepalaSekolah,
        nipKepalaSekolah: matched.nipKepalaSekolah || schoolInfo.nipKepalaSekolah,
        bendahara: matched.bendahara || schoolInfo.bendahara,
        nipBendahara: matched.nipBendahara || schoolInfo.nipBendahara,
        bendaharaBarang: matched.pengurusBarang || schoolInfo.bendaharaBarang,
        nipBendaharaBarang: matched.nipPengurusBarang || schoolInfo.nipBendaharaBarang,
      };
      setSchoolInfo(nextSchoolInfo);
      saveSchoolInfo(nextSchoolInfo);

      if (currentUser) {
        const nextUser: UserProfile = {
          ...currentUser,
          username: matched.username || currentUser.username,
          name: matched.pengurusBarang || matched.kepalaSekolah || currentUser.name,
          role: matched.role || currentUser.role,
          schoolName: matched.upt || currentUser.schoolName,
          nip: matched.nipPengurusBarang || currentUser.nip,
        };
        setCurrentUser(nextUser);
        saveCurrentSession(nextUser);
      }
    }

    pushSharedStateToServer({
      uptSchools: updatedSchools,
      schoolInfo: nextSchoolInfo,
      replaceAllUptSchools: true,
      isDirectSave: true,
    }).then((state) => {
      if (state?.updatedAt) lastServerUpdatedAtRef.current = state.updatedAt;
    });

    // Fast lightweight sync of 6_AKUN_APLIKASI & 1_PANEL_ADMIN_UPT to Google Spreadsheet immediately (0ms delay)
    syncAccountsOnlyToRekapanGas({
      schoolInfo: nextSchoolInfo,
      expenses,
      masterSchools: updatedSchools,
    }).catch(() => {
      // Ignore background network error
    });
  };

  const handleApplyMasterDatabase = (
    result: ParseMasterDatabaseResult,
    replaceAll: boolean = true
  ) => {
    const sheetsUpper = (result.sheetsFound || []).map((s) => s.toUpperCase());
    const hasExpenseSheets =
      sheetsUpper.some(
        (s) =>
          s.includes('PERSEDIAAN') ||
          s.includes('PEMELIHARAAN') ||
          s.includes('REKAP') ||
          s.includes('INLINE_')
      ) || result.importedExpenses.length > 0;

    const hasEkstraSheet =
      sheetsUpper.some((s) => s.includes('EKSTRA') || s.includes('INLINE_')) ||
      result.importedBarangEkstra.length > 0;

    let nextExpenses = expenses;
    if (hasExpenseSheets) {
      if (replaceAll) {
        nextExpenses = result.importedExpenses
          .map((item) => ({
            ...item,
            tahunAnggaran: item.tahunAnggaran || getExpenseYear(item) || schoolInfo.tahunAnggaran,
          }))
          .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
      } else {
        const existingMap = new Map(expenses.map((e) => [e.id, e]));
        result.importedExpenses.forEach((item) => {
          existingMap.set(item.id, {
            ...item,
            tahunAnggaran: item.tahunAnggaran || getExpenseYear(item) || schoolInfo.tahunAnggaran,
          });
        });
        nextExpenses = Array.from(existingMap.values()).sort(
          (a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()
        );
      }
      setExpenses(nextExpenses);
      saveSchoolExpenses(nextExpenses);
    }

    let nextEkstra = barangEkstraItems;
    if (hasEkstraSheet) {
      if (replaceAll) {
        nextEkstra = result.importedBarangEkstra;
      } else {
        const map = new Map(barangEkstraItems.map((i) => [i.id, i]));
        result.importedBarangEkstra.forEach((i) => map.set(i.id, i));
        nextEkstra = Array.from(map.values());
      }
      setBarangEkstraItems(nextEkstra);
      saveBarangEkstraItems(nextEkstra);
    }

    let nextSchools = loadUptSchools();
    if (result.importedAccounts && result.importedAccounts.length > 0) {
      nextSchools = result.importedAccounts;
      saveUptSchools(nextSchools, false);
    }

    let nextSchoolInfo = schoolInfo;
    const currentNorm = normalizeUptKey(currentUser?.schoolName || schoolInfo.namaSekolah || '');
    const matchedSchool = nextSchools.find((s) => normalizeUptKey(s.upt) === currentNorm);
    const updatedPagu =
      result.importedPaguTahunan && result.importedPaguTahunan > 0
        ? result.importedPaguTahunan
        : schoolInfo.totalPaguTahunan;

    if (matchedSchool || updatedPagu !== schoolInfo.totalPaguTahunan) {
      nextSchoolInfo = {
        ...schoolInfo,
        totalPaguTahunan: updatedPagu,
        namaSekolah: matchedSchool?.upt || schoolInfo.namaSekolah,
        npsn: matchedSchool?.npsn || schoolInfo.npsn,
        kecamatan: matchedSchool?.kecamatan || schoolInfo.kecamatan,
        kepalaSekolah: matchedSchool?.kepalaSekolah || schoolInfo.kepalaSekolah,
        nipKepalaSekolah: matchedSchool?.nipKepalaSekolah || schoolInfo.nipKepalaSekolah,
        bendahara: matchedSchool?.bendahara || schoolInfo.bendahara,
        nipBendahara: matchedSchool?.nipBendahara || schoolInfo.nipBendahara,
        bendaharaBarang: matchedSchool?.pengurusBarang || schoolInfo.bendaharaBarang,
        nipBendaharaBarang: matchedSchool?.nipPengurusBarang || schoolInfo.nipBendaharaBarang,
      };
      setSchoolInfo(nextSchoolInfo);
      saveSchoolInfo(nextSchoolInfo);
    }

    pushSharedStateToServer({
      expenses: nextExpenses,
      barangEkstraItems: nextEkstra,
      uptSchools: nextSchools,
      schoolInfo: nextSchoolInfo,
      replaceAllExpenses: replaceAll && hasExpenseSheets,
      replaceAllBarangEkstra: replaceAll && hasEkstraSheet,
      replaceAllUptSchools: Boolean(result.importedAccounts && result.importedAccounts.length > 0),
      isDirectSave: true,
    }).then((state) => {
      if (state?.updatedAt) {
        lastServerUpdatedAtRef.current = state.updatedAt;
      }
    });

    scheduleBackgroundGasSync(nextExpenses, nextEkstra, nextSchoolInfo);
  };

  // GATEKEEPER: Jika belum login, tidak bisa masuk ke halaman web / dashboard / data belanja
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950">
        {toastMessage && (
          <div 
            className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-2.5 animate-fadeIn text-xs sm:text-sm font-medium"
            role="status"
            aria-live="polite"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage.text}</span>
          </div>
        )}
        <LoginScreen
          accounts={accounts}
          schoolInfo={schoolInfo}
          onLoginSuccess={handleLoginSuccess}
        />
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-slate-100 flex flex-col text-slate-900 font-sans antialiased transition-all duration-300 ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'}`}>
      {/* Toast Notification Floating Banner */}
      {toastMessage && (
        <div 
          className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-2.5 animate-fadeIn text-xs sm:text-sm font-medium"
          role="status"
          aria-live="polite"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* App Header (with School Name, Google Sheets Live Sync, Quarter selector, Search, and User Auth) */}
      <AppHeader
        schoolInfo={schoolInfo}
        currentUser={currentUser}
        onOpenAuth={handleOpenAuth}
        onLogout={handleLogout}
        activeQuarterFilter={activeQuarterFilter}
        onQuarterFilterChange={(tw) => {
          setActiveQuarterFilter(tw);
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenSettings={() => setActiveTab('settings')}
        onOpenGoogleSheets={() => setGoogleSheetsModalOpen(true)}
        onOpenDatabaseSpreadsheet={() => setDatabaseSpreadsheetModalOpen(true)}
        onNewExpense={() => handleOpenNewExpense()}
        onOpenAdminPanel={() => setActiveTab('admin')}
        onSwitchRole={handleSwitchRole}
      />

      {/* Main Container */}
      <main className={`flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 pb-24 sm:pb-12 ${selectedExpenseForDetail ? 'print:hidden' : ''}`}>
        {activeTab === 'admin' && isAdmin && currentUser && (
          <AdminPanelView
            schoolInfo={schoolInfo}
            currentUser={currentUser}
            expenses={activeYearExpenses}
            barangEkstraItems={barangEkstraItems}
            onApproveExpense={handleApproveExpense}
            onBulkApproveExpenses={handleBulkApproveExpenses}
            onUpdateStatus={handleUpdateStatus}
            onEditExpense={handleEditExpense}
            onDeleteExpense={handleDeleteExpense}
            onSelectExpense={(exp) => setSelectedExpenseForDetail(exp)}
            onPrintReceipt={handlePrintReceipt}
            onOpenGoogleSheets={() => setGoogleSheetsModalOpen(true)}
            onOpenDatabaseSpreadsheet={() => setDatabaseSpreadsheetModalOpen(true)}
            onClearAllExpenses={handleClearAllExpenses}
            onSaveBarangEkstra={handleSaveBarangEkstra}
            onDeleteBarangEkstra={handleDeleteBarangEkstra}
            onUpdateBarangEkstraStatus={handleUpdateBarangEkstraStatus}
          />
        )}

        {activeTab === 'rekap_dinas' && isAdmin && currentUser && (
          <DinasRekapView
            schoolInfo={schoolInfo}
            currentUser={currentUser}
            expenses={activeYearExpenses}
            onSelectExpense={(exp) => setSelectedExpenseForDetail(exp)}
            onPrintReceipt={handlePrintReceipt}
            onOpenGoogleSheets={() => setGoogleSheetsModalOpen(true)}
            onOpenDatabaseSpreadsheet={() => setDatabaseSpreadsheetModalOpen(true)}
          />
        )}

        {(activeTab === 'dashboard' || (activeTab === 'admin' && !isAdmin)) && (
          <DashboardView
            schoolInfo={schoolInfo}
            expenses={activeYearExpenses}
            onSelectQuarter={(tw) => {
              setActiveQuarterFilter([tw]);
              setActiveTab('list');
            }}
            onNewExpenseWithQuarter={(tw) => handleOpenNewExpense(tw)}
            onViewExpenseDetail={(exp) => setSelectedExpenseForDetail(exp)}
            onNavigateToList={() => setActiveTab('list')}
          />
        )}

        {activeTab === 'list' && (
          <ExpenseListView
            expenses={activeYearExpenses}
            activeQuarterFilter={activeQuarterFilter}
            onQuarterFilterChange={setActiveQuarterFilter}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onNewExpense={() => handleOpenNewExpense()}
            onSelectExpense={(exp) => setSelectedExpenseForDetail(exp)}
            onEditExpense={handleEditExpense}
            onDeleteExpense={handleDeleteExpense}
            onPrintReceipt={handlePrintReceipt}
            onOpenGoogleSheets={() => setGoogleSheetsModalOpen(true)}
            isAdmin={isAdmin}
            onApproveExpense={handleApproveExpense}
            onClearAllExpenses={handleClearAllExpenses}
          />
        )}

        {activeTab === 'form' && (
          <ExpenseFormView
            existingExpense={editingExpense}
            defaultQuarter={formDefaultQuarter}
            schoolInfo={schoolInfo}
            allExpenses={activeYearExpenses}
            inputMode={expenseInputMode}
            onInputModeChange={setExpenseInputMode}
            onOpenDatabaseSpreadsheet={() => setDatabaseSpreadsheetModalOpen(true)}
            onSave={handleSaveExpense}
            onCancel={() => {
              setEditingExpense(null);
              setActiveTab(isAdmin ? 'admin' : 'list');
            }}
          />
        )}

        {activeTab === 'cetak_laporan' && (
          <CetakLaporanView
            initialExpense={expenseForReceipt}
            allExpenses={activeYearExpenses}
            allYearExpenses={yearFilteredExpenses}
            schoolInfo={schoolInfo}
            isAdmin={isAdmin}
            currentUser={currentUser}
            barangEkstraItems={barangEkstraItems}
            currentVariant={selectedReportVariant}
            onVariantChange={setSelectedReportVariant}
            reklasSubView={selectedReklasSubView}
            onReklasSubViewChange={setSelectedReklasSubView}
            onBack={() => setActiveTab(isAdmin ? 'admin' : 'dashboard')}
          />
        )}

        {activeTab === 'barang_ekstra' && (
          <BarangEkstraView
            items={barangEkstraItems.filter(i => {
              const targetUpt = (currentUser?.schoolName || schoolInfo.namaSekolah || '').trim().toLowerCase();
              const itemUpt = (i.schoolName || '').trim().toLowerCase();
              if (!targetUpt) return true;
              return itemUpt === targetUpt || normalizeUptKey(i.schoolName || '') === normalizeUptKey(currentUser?.schoolName || schoolInfo.namaSekolah || '');
            })}
            schoolInfo={schoolInfo}
            isAdmin={isAdmin}
            onSaveItem={handleSaveBarangEkstra}
            onDeleteItem={handleDeleteBarangEkstra}
            onUpdateStatus={handleUpdateBarangEkstraStatus}
            onOpenDatabaseSpreadsheet={() => setDatabaseSpreadsheetModalOpen(true)}
          />
        )}

        {(activeTab === 'receipt' || activeTab === 'stock_opname') && (
          <ReceiptPrintView
            key={activeTab}
            variant={activeTab === 'stock_opname' ? 'stock_opname' : 'rekon'}
            initialExpense={expenseForReceipt}
            allExpenses={activeYearExpenses}
            schoolInfo={schoolInfo}
            onBack={() => setActiveTab(isAdmin ? 'admin' : 'dashboard')}
          />
        )}

        {activeTab === 'settings' && (
          <SchoolSettingsView
            schoolInfo={schoolInfo}
            allExpenses={activeYearExpenses}
            masterSchools={masterSchools}
            isAdmin={isAdmin}
            onSave={updateSchoolInfo}
            onResetDemoData={handleResetDemoData}
            onClose={() => setActiveTab(isAdmin ? 'admin' : 'dashboard')}
            onOpenDatabaseSpreadsheet={() => setDatabaseSpreadsheetModalOpen(true)}
          />
        )}
      </main>

      {/* Left Collapsible Sidebar Navigation */}
      <SidebarNav
        activeTab={activeTab === 'admin' && !isAdmin ? 'dashboard' : activeTab}
        onTabChange={(tab) => {
          if (tab === 'form' && activeTab !== 'form') {
            setEditingExpense(null);
          }
          if (tab === 'receipt' || tab === 'stock_opname') {
            setExpenseForReceipt(null);
          }
          setActiveTab(tab);
        }}
        expenseCount={activeYearExpenses.length}
        isAdmin={isAdmin}
        pendingApprovalCount={pendingApprovalCount}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        reportVariant={selectedReportVariant}
        onSelectReportVariant={(variant, subView) => {
          setSelectedReportVariant(variant);
          if (subView) {
            setSelectedReklasSubView(subView);
          }
          setActiveTab('cetak_laporan');
        }}
        reklasSubView={selectedReklasSubView}
        expenseInputMode={expenseInputMode}
        onSelectExpenseInputMode={(mode) => {
          setExpenseInputMode(mode);
          setEditingExpense(null);
          setActiveTab('form');
        }}
      />

      {/* Detail Modal */}
      {selectedExpenseForDetail && (
        <ExpenseDetailModal
          expense={selectedExpenseForDetail}
          onClose={() => setSelectedExpenseForDetail(null)}
          onEdit={(exp) => {
            setSelectedExpenseForDetail(null);
            handleEditExpense(exp);
          }}
          onDelete={(id) => {
            handleDeleteExpense(id);
            setSelectedExpenseForDetail(null);
          }}
          onPrint={(exp) => {
            setSelectedExpenseForDetail(null);
            handlePrintReceipt(exp);
          }}
          onUpdateStatus={handleUpdateStatus}
          isAdmin={isAdmin}
        />
      )}

      {/* Auth Modal (Menu Login UPT Sekolah) */}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authModalMode}
        accounts={accounts}
        schoolName={schoolInfo.namaSekolah}
        schoolYear={String(schoolInfo.tahunAnggaran)}
        onLoginSuccess={handleLoginSuccess}
        onClose={() => setAuthModalOpen(false)}
      />

      {/* Google Sheets & Drive Modal */}
      <GoogleSheetsModal
        isOpen={googleSheetsModalOpen}
        onClose={() => setGoogleSheetsModalOpen(false)}
        schoolInfo={schoolInfo}
        expenses={yearFilteredExpenses.length > 0 ? yearFilteredExpenses : expenses}
        barangEkstraItems={barangEkstraItems}
        onImportExpenses={handleImportExpenses}
        onApplyMasterDatabase={handleApplyMasterDatabase}
        onSyncSuccessNotification={(msg) => showToast(msg, 'success')}
      />

      {/* Database Spreadsheet Master Modal (Panel Admin, Rekap Dinas, Input Belanja) */}
      <DatabaseSpreadsheetModal
        isOpen={databaseSpreadsheetModalOpen}
        onClose={() => setDatabaseSpreadsheetModalOpen(false)}
        schoolInfo={schoolInfo}
        expenses={yearFilteredExpenses.length > 0 ? yearFilteredExpenses : expenses}
        barangEkstraItems={barangEkstraItems}
        onImportExpenses={handleImportExpenses}
        onApplyMasterDatabase={handleApplyMasterDatabase}
        onUpdateMasterSchools={handleUpdateMasterSchools}
        onImportBarangEkstra={(newItems) => {
          setBarangEkstraItems((prev) => {
            const map = new Map(prev.map((i) => [i.id, i]));
            newItems.forEach((i) => map.set(i.id, i));
            const merged = Array.from(map.values());
            saveBarangEkstraItems(merged);
            pushSharedStateToServer({
              barangEkstraItems: merged,
              isDirectSave: true,
            }).then((state) => {
              if (state?.updatedAt) lastServerUpdatedAtRef.current = state.updatedAt;
            });
            scheduleBackgroundGasSync(expenses, merged, schoolInfo);
            return merged;
          });
        }}
        onOpenGoogleSheets={() => setGoogleSheetsModalOpen(true)}
        onNotify={(msg, type) => showToast(msg, type)}
      />
    </div>
  );
}

