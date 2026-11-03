import React, { useMemo, useState, useEffect } from 'react';
import { 
  Building2, 
  FileSpreadsheet, 
  Printer, 
  Search, 
  ShieldCheck, 
  Building,
  Download,
  Code2,
  Wifi
} from 'lucide-react';
import { SchoolExpense, SchoolInfo, Triwulan, REKENING_PERSEDIAAN_OPTIONS, normalizeRekeningPersediaan } from '../types';
import { UserProfile } from '../types/auth';
import { 
  formatRupiah, 
  consolidateExpensesBySchoolAndQuarters, 
  buildMergedPersediaanTableRows,
  formatCombinedQuarterLabel,
  filterExpenseByQuarters
} from '../utils/budgetCalculations';
import { loadUptSchools, normalizeUptKey } from '../data/schoolData';
import { exportExpensesToCSV } from '../utils/storage';
import * as XLSX from 'xlsx';
import { AppsScriptModal } from './AppsScriptModal';
import { checkRekapanGasConnection, getRekapanGasUrl } from '../utils/googleAppsScriptCode';

interface DinasRekapViewProps {
  schoolInfo: SchoolInfo;
  currentUser: UserProfile;
  expenses: SchoolExpense[];
  onSelectExpense: (exp: SchoolExpense) => void;
  onPrintReceipt: (exp: SchoolExpense) => void;
  onOpenGoogleSheets: () => void;
  onOpenDatabaseSpreadsheet?: () => void;
}

const ALL_QUARTERS: Triwulan[] = ['TW1', 'TW2', 'TW3', 'TW4'];

// Standar lengkap seluruh rekening / jenis persediaan sesuai format rekap dinas & input belanja persediaan
const STANDARD_JENIS_PERSEDIAAN: readonly string[] = REKENING_PERSEDIAAN_OPTIONS;

export const DinasRekapView: React.FC<DinasRekapViewProps> = ({
  schoolInfo,
  currentUser,
  expenses,
  onSelectExpense,
  onPrintReceipt,
  onOpenGoogleSheets,
  onOpenDatabaseSpreadsheet,
}) => {
  const [selectedQuarters, setSelectedQuarters] = useState<Triwulan[]>(['TW1', 'TW2', 'TW3', 'TW4']);
  const [selectedKategori, setSelectedKategori] = useState<string>('Semua');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'matrix' | 'summary'>('matrix');
  const [hanyaBarisTerisi, setHanyaBarisTerisi] = useState<boolean>(false);
  const [appsScriptModalOpen, setAppsScriptModalOpen] = useState<boolean>(false);
  const [gasConnected, setGasConnected] = useState<boolean>(true);

  useEffect(() => {
    checkRekapanGasConnection(getRekapanGasUrl()).then((res) => {
      setGasConnected(res.connected);
    });
  }, []);

  const masterSchools = useMemo(() => loadUptSchools(), [schoolInfo, expenses]);

  // Filter raw expenses by selected quarters (untuk Pemeliharaan berdasarkan Tanggal rincian)
  const quarterFilteredExpenses = useMemo(() => {
    return expenses
      .map((e) => filterExpenseByQuarters(e, selectedQuarters))
      .filter((e): e is SchoolExpense => e !== null);
  }, [expenses, selectedQuarters]);

  // Helper to categorize school type
  const getSchoolCategory = (schoolName: string): 'DINAS PENDIDIKAN' | 'SMP' | 'SD' | 'TK & SKB' => {
    const upper = schoolName.toUpperCase();
    if (upper.includes('DINAS PENDIDIKAN')) return 'DINAS PENDIDIKAN';
    if (upper.includes('TK') || upper.includes('PAUD') || upper.includes('SKB') || upper.includes('SANGGAR')) return 'TK & SKB';
    if (upper.includes('SD') || upper.includes('SEKOLAH DASAR')) return 'SD';
    return 'SMP';
  };

  // Consolidated map per school
  const consolidatedSchools = useMemo(() => {
    const consolidated = consolidateExpensesBySchoolAndQuarters(quarterFilteredExpenses, selectedQuarters);
    const map = new Map<string, {
      schoolName: string;
      kecamatan: string;
      npsn: string;
      category: 'DINAS PENDIDIKAN' | 'SMP' | 'SD' | 'TK & SKB';
      rowsMap: Map<string, { saMasuk: number; saKeluar: number; saSisa: number; blMasuk: number; blKeluar: number; blSisa: number; saldoAkhir: number }>;
      totalSaldoAkhir: number;
      totalMasuk: number;
      totalKeluar: number;
      expenseRef?: SchoolExpense;
    }>();

    consolidated.forEach((exp) => {
      const name = (exp.schoolName || 'UPT Sekolah').trim();
      const norm = normalizeUptKey(name);
      const matchedMaster = masterSchools.find((s) => normalizeUptKey(s.upt) === norm);
      const kecamatan = matchedMaster?.kecamatan || 'Minahasa Tenggara';
      const npsn = exp.npsn || matchedMaster?.npsn || '-';
      const category = getSchoolCategory(name);

      const { rows } = buildMergedPersediaanTableRows([exp]);
      const rowsMap = new Map<string, {
        saMasuk: number;
        saKeluar: number;
        saSisa: number;
        blMasuk: number;
        blKeluar: number;
        blSisa: number;
        saldoAkhir: number;
      }>();
      
      let tMasuk = 0;
      let tKeluar = 0;
      let tSaldo = 0;

      rows.forEach((r) => {
        const canonicalKode = normalizeRekeningPersediaan(r.kodeRekening);
        const saMasuk = r.nominalSaldoAwal;
        const saKeluar = r.nominalPengeluaranSaldoAwal;
        const saSisa = saMasuk - saKeluar;
        const blMasuk = r.nominalBelanjaLra + r.nominalHibahMasuk;
        const blKeluar = r.nominalPengeluaranBelanja + r.nominalHibahKeluar;
        const blSisa = blMasuk - blKeluar;
        const saldoAkhir = r.sisaNilai;

        const prev = rowsMap.get(canonicalKode);
        if (prev) {
          rowsMap.set(canonicalKode, {
            saMasuk: prev.saMasuk + saMasuk,
            saKeluar: prev.saKeluar + saKeluar,
            saSisa: prev.saSisa + saSisa,
            blMasuk: prev.blMasuk + blMasuk,
            blKeluar: prev.blKeluar + blKeluar,
            blSisa: prev.blSisa + blSisa,
            saldoAkhir: prev.saldoAkhir + saldoAkhir,
          });
        } else {
          rowsMap.set(canonicalKode, {
            saMasuk,
            saKeluar,
            saSisa,
            blMasuk,
            blKeluar,
            blSisa,
            saldoAkhir,
          });
        }
        tMasuk += saMasuk + blMasuk;
        tKeluar += saKeluar + blKeluar;
        tSaldo += saldoAkhir;
      });

      map.set(norm, {
        schoolName: name,
        kecamatan,
        npsn,
        category,
        rowsMap,
        totalSaldoAkhir: tSaldo,
        totalMasuk: tMasuk,
        totalKeluar: tKeluar,
        expenseRef: exp,
      });
    });

    let list = Array.from(map.values());
    if (selectedKategori !== 'Semua') {
      list = list.filter((item) => item.category === selectedKategori);
    }
    return list.sort((a, b) => a.schoolName.localeCompare(b.schoolName));
  }, [quarterFilteredExpenses, selectedQuarters, selectedKategori, masterSchools]);

  // Combine standard list with any dynamic inputs
  const allJenisPersediaan = useMemo(() => {
    const setRek = new Set<string>(STANDARD_JENIS_PERSEDIAAN);
    consolidatedSchools.forEach((school) => {
      school.rowsMap.forEach((_, kode) => {
        setRek.add(kode);
      });
    });
    return Array.from(setRek);
  }, [consolidatedSchools]);

  // If "Hanya Baris Terisi" is checked, filter out columns where every school has 0 values
  const displayedJenisPersediaan = useMemo(() => {
    if (!hanyaBarisTerisi) return allJenisPersediaan;
    return allJenisPersediaan.filter((jenis) => {
      return consolidatedSchools.some((school) => {
        const d = school.rowsMap.get(jenis);
        if (!d) return false;
        return d.saMasuk > 0 || d.saKeluar > 0 || d.blMasuk > 0 || d.blKeluar > 0 || d.saldoAkhir !== 0;
      });
    });
  }, [allJenisPersediaan, consolidatedSchools, hanyaBarisTerisi]);

  // Filtered list by search query
  const filteredSchools = useMemo(() => {
    if (!searchQuery.trim()) return consolidatedSchools;
    const q = searchQuery.toLowerCase();
    return consolidatedSchools.filter((item) =>
      item.schoolName.toLowerCase().includes(q) ||
      item.npsn.toLowerCase().includes(q) ||
      item.kecamatan.toLowerCase().includes(q)
    );
  }, [consolidatedSchools, searchQuery]);

  const grandTotals = useMemo(() => {
    let totMasuk = 0;
    let totKeluar = 0;
    let totSaldo = 0;
    filteredSchools.forEach((s) => {
      totMasuk += s.totalMasuk;
      totKeluar += s.totalKeluar;
      totSaldo += s.totalSaldoAkhir;
    });
    return { totMasuk, totKeluar, totSaldo, totalSekolah: filteredSchools.length };
  }, [filteredSchools]);

  const handleDownloadExcelRekap = () => {
    let dataRekapArray: any[][] = [];
    dataRekapArray.push(["REKAPITULASI PERSEDIAAN SE-DINAS PENDIDIKAN KABUPATEN MINAHASA TENGGARA"]);
    dataRekapArray.push([`Periode: ${formatCombinedQuarterLabel(selectedQuarters)} | Kategori Filter: ${selectedKategori}`]);
    dataRekapArray.push([]);

    let header1 = ["NO", "NAMA UPT / SATUAN PENDIDIKAN"];
    let header2 = ["", ""];
    let header3 = ["", ""];

    displayedJenisPersediaan.forEach((jenis) => {
      header1.push(jenis, "", "", "", "", "", "");
      header2.push("SALDO AWAL", "", "", "BELANJA", "", "", "SALDO AKHIR");
      header3.push("Masuk", "Keluar", "Sisa", "Masuk", "Keluar", "Sisa", "Saldo Akhir");
    });

    header1.push("TOTAL MASUK", "TOTAL KELUAR", "TOTAL SALDO AKHIR");
    header2.push("", "", "");
    header3.push("", "", "");

    dataRekapArray.push(header1);
    dataRekapArray.push(header2);
    dataRekapArray.push(header3);

    filteredSchools.forEach((school, idx) => {
      let row: any[] = [idx + 1, school.schoolName];
      displayedJenisPersediaan.forEach((jenis) => {
        const d = school.rowsMap.get(jenis) || { saMasuk: 0, saKeluar: 0, saSisa: 0, blMasuk: 0, blKeluar: 0, blSisa: 0, saldoAkhir: 0 };
        row.push(d.saMasuk, d.saKeluar, d.saSisa, d.blMasuk, d.blKeluar, d.blSisa, d.saldoAkhir);
      });
      row.push(school.totalMasuk, school.totalKeluar, school.totalSaldoAkhir);
      dataRekapArray.push(row);
    });

    let totRow: any[] = ["JUMLAH TOTAL SE-KABUPATEN", ""];
    displayedJenisPersediaan.forEach((jenis) => {
      let tSaM = 0, tSaK = 0, tSaS = 0, tBlM = 0, tBlK = 0, tBlS = 0, tSk = 0;
      filteredSchools.forEach((s) => {
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
      totRow.push(tSaM, tSaK, tSaS, tBlM, tBlK, tBlS, tSk);
    });
    totRow.push(grandTotals.totMasuk, grandTotals.totKeluar, grandTotals.totSaldo);
    dataRekapArray.push(totRow);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(dataRekapArray);
    XLSX.utils.book_append_sheet(wb, ws, "RekonPersediaan");
    XLSX.writeFile(wb, "Rekapitulasi_Persediaan.xlsx");
  };

  return (
    <div className="space-y-6">
      {/* Admin Header Banner */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 rounded-2xl p-5 text-white shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              REKAPAN SE-DINAS PENDIDIKAN
            </span>
            <button
              type="button"
              onClick={() => setAppsScriptModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-teal-500/20 hover:bg-teal-500/30 text-teal-200 border border-teal-400/40 transition-colors cursor-pointer"
              title="Terhubung ke Web App Google Apps Script: Klik untuk lihat status & sinkronisasi"
            >
              <Wifi className={`w-3.5 h-3.5 ${gasConnected ? 'text-emerald-400' : 'text-amber-400'}`} />
              <span>Apps Script Terhubung (AKfycbwf...9q4AV)</span>
            </button>
            <span className="text-xs text-slate-300 font-medium">
              Kabupaten Minahasa Tenggara • TA {schoolInfo.tahunAnggaran}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            Matriks Rekapitulasi Persediaan Se-Kabupaten (Per Jenis Rekening)
          </h2>
          <p className="text-xs text-slate-300">
            Seluruh inputan UPT Satuan Pendidikan digabungkan ke dalam 1 tabel master matriks berdasarkan jenis persediaan.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'matrix' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              Matriks Rekap
            </button>
            <button
              type="button"
              onClick={() => setViewMode('summary')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'summary' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              Ringkasan Sekolah
            </button>
          </div>

          {onOpenDatabaseSpreadsheet && (
            <button
              type="button"
              onClick={onOpenDatabaseSpreadsheet}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700/80 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl shadow border border-emerald-500/40 transition-all cursor-pointer active:scale-95"
              title="Buka / Unduh Database Spreadsheet Master 5 Sheet"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
              <span>Database Spreadsheet</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setAppsScriptModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl shadow border border-teal-400/40 transition-all cursor-pointer active:scale-95"
            title="Buka Kode & Panduan Google Apps Script (.gs) untuk Otomasi Rekapan Se-Dinas"
          >
            <Code2 className="w-4 h-4 text-teal-200" />
            <span>Apps Script Rekapan</span>
          </button>

          <button
            type="button"
            onClick={onOpenGoogleSheets}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Google Sheets</span>
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-slate-400 uppercase">Total UPT Berinputan</span>
          <div className="text-2xl font-black text-slate-900">
            {grandTotals.totalSekolah} <span className="text-xs font-medium text-slate-500">Sekolah</span>
          </div>
          <p className="text-[11px] text-emerald-600 font-medium">Periode {formatCombinedQuarterLabel(selectedQuarters)}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-slate-400 uppercase">Total Persediaan Masuk</span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 truncate">
            {formatRupiah(grandTotals.totMasuk)}
          </div>
          <p className="text-[11px] text-slate-500">Akumulasi Se-Kabupaten</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-slate-400 uppercase">Total Pengeluaran</span>
          <div className="text-xl sm:text-2xl font-black text-rose-600 truncate">
            {formatRupiah(grandTotals.totKeluar)}
          </div>
          <p className="text-[11px] text-slate-500">Pengeluaran Se-Kabupaten</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-slate-400 uppercase">Total Saldo Akhir Se-Dinas</span>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 truncate">
            {formatRupiah(grandTotals.totSaldo)}
          </div>
          <p className="text-[11px] text-emerald-600 font-bold">Saldo Akhir Gabungan</p>
        </div>
      </div>

      {/* Filter & Toolbar Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Triwulan Multi-Check / Quick Select */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            {ALL_QUARTERS.map((tw) => {
              const isChecked = selectedQuarters.includes(tw);
              return (
                <button
                  key={tw}
                  type="button"
                  onClick={() => {
                    setSelectedQuarters((prev) =>
                      prev.includes(tw) ? prev.filter((q) => q !== tw) : [...prev, tw]
                    );
                  }}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    isChecked
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 bg-white'
                  }`}
                >
                  {tw}
                </button>
              );
            })}
          </div>

          {/* Kategori Satuan Pendidikan Filter */}
          <select
            aria-label="Filter Kategori Satuan Pendidikan"
            value={selectedKategori}
            onChange={(e) => setSelectedKategori(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="Semua">Semua Kategori (Dinas, SMP, SD, TK & SKB)</option>
            <option value="DINAS PENDIDIKAN">1. Dinas Pendidikan</option>
            <option value="SMP">2. SMP (Sekolah Menengah Pertama)</option>
            <option value="SD">3. SD (Sekolah Dasar)</option>
            <option value="TK & SKB">4. TK & SKB (Taman Kanak & Sanggar Kegiatan Belajar)</option>
          </select>

          {/* Checkbox: Hanya Baris Terisi */}
          <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-50 px-3 py-2 rounded-xl border border-slate-300 font-bold text-slate-800 hover:bg-slate-100 transition-colors">
            <input
              type="checkbox"
              checked={hanyaBarisTerisi}
              onChange={(e) => setHanyaBarisTerisi(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
            <span>Hanya Kolom/Rekening Terisi</span>
          </label>
        </div>

        {/* Search input & CSV export */}
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari sekolah atau NPSN..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            type="button"
            onClick={handleDownloadExcelRekap}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow transition-all cursor-pointer shrink-0"
            title="Download File Excel Rekap Se-Dinas sesuai pilihan filter"
          >
            <Download className="w-4 h-4 text-white" />
            <span>Download Excel Rekap</span>
          </button>
        </div>
      </div>

      {/* VIEW MODE: MATRIX SE-DINAS (FORMAT SEPERTI LAMPIRAN EXCEL UPT DENGAN TOTAL MASUK & KELUAR DI KANAN) */}
      {viewMode === 'matrix' ? (
        <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              <div>
                <span className="font-black text-sm uppercase tracking-wide block">
                  TABEL MATRIKS REKAPITULASI PERSEDIAAN SE-DINAS PENDIDIKAN
                </span>
                <span className="text-[11px] text-slate-300 font-normal">
                  {hanyaBarisTerisi ? 'Menampilkan hanya rekening belanja yang memiliki nilai terisi.' : 'Menampilkan seluruh rekening belanja standar secara lengkap.'}
                </span>
              </div>
            </div>
            <span className="text-xs text-emerald-300 font-bold bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
              Periode: {formatCombinedQuarterLabel(selectedQuarters)}
            </span>
          </div>

          <div className="overflow-x-auto max-h-[650px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs border border-slate-800 whitespace-nowrap">
              <thead className="sticky top-0 z-20 bg-slate-100 text-slate-900 font-serif text-[10px] font-bold uppercase tracking-tight shadow-md">
                {/* Row 1: Account Name */}
                <tr>
                  <th rowSpan={3} className="border border-slate-700 py-3 px-3 text-center align-middle bg-slate-200">
                    NO
                  </th>
                  <th rowSpan={3} className="border border-slate-700 py-3 px-4 text-center align-middle min-w-[220px] bg-slate-200">
                    NAMA UPT / SATUAN PENDIDIKAN
                  </th>
                  {displayedJenisPersediaan.length === 0 ? (
                    <th className="border border-slate-700 py-3 px-4 text-center align-middle">
                      JENIS PERSEDIAAN
                    </th>
                  ) : (
                    displayedJenisPersediaan.map((jenis) => (
                      <th key={`r1-${jenis}`} colSpan={7} className="border border-slate-700 py-1.5 px-2 text-center align-middle bg-slate-900 text-white font-black text-[10px]">
                        {jenis}
                      </th>
                    ))
                  )}
                  <th rowSpan={3} className="border border-slate-700 py-3 px-3 text-center align-middle bg-emerald-100 text-emerald-950">
                    TOTAL MASUK
                  </th>
                  <th rowSpan={3} className="border border-slate-700 py-3 px-3 text-center align-middle bg-rose-100 text-rose-950">
                    TOTAL KELUAR
                  </th>
                  <th rowSpan={3} className="border border-slate-700 py-3 px-3 text-center align-middle bg-slate-300">
                    TOTAL SALDO AKHIR
                  </th>
                </tr>
                {/* Row 2: Group Headers */}
                <tr>
                  {displayedJenisPersediaan.length === 0 ? (
                    <th className="border border-slate-700 py-1.5 px-2 text-center">Saldo Akhir</th>
                  ) : (
                    displayedJenisPersediaan.map((jenis) => (
                      <React.Fragment key={`r2-${jenis}`}>
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
                  {displayedJenisPersediaan.length === 0 ? null : (
                    displayedJenisPersediaan.map((jenis) => (
                      <React.Fragment key={`r3-${jenis}`}>
                        <th className="border border-slate-700 py-1 px-1 text-center text-[9px] bg-emerald-50 font-bold">Masuk</th>
                        <th className="border border-slate-700 py-1 px-1 text-center text-[9px] bg-emerald-50 font-bold">Keluar</th>
                        <th className="border border-slate-700 py-1 px-1 text-center text-[9px] bg-emerald-100 font-bold border-r border-slate-700">Sisa</th>
                        <th className="border border-slate-700 py-1 px-1 text-center text-[9px] bg-slate-50 font-bold">Masuk</th>
                        <th className="border border-slate-700 py-1 px-1 text-center text-[9px] bg-slate-50 font-bold">Keluar</th>
                        <th className="border border-slate-700 py-1 px-1 text-center text-[9px] bg-slate-200 font-bold border-r border-slate-700">Sisa</th>
                      </React.Fragment>
                    ))
                  )}
                </tr>
              </thead>
              <tbody className="bg-white text-slate-900">
                {filteredSchools.length === 0 ? (
                  <tr>
                    <td colSpan={2 + (displayedJenisPersediaan.length * 7) + 3} className="py-12 text-center text-slate-500">
                      Tidak ada data sekolah yang sesuai dengan filter pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredSchools.map((school, idx) => (
                    <tr key={school.npsn + school.schoolName} className="hover:bg-slate-50 transition-colors">
                      <td className="border border-slate-700 py-2 px-3 text-center font-bold text-slate-600 bg-slate-50">
                        {idx + 1}
                      </td>
                      <td className="border border-slate-700 py-2 px-4 font-bold text-slate-900 bg-slate-50/80">
                        <div className="flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate max-w-[200px]" title={school.schoolName}>
                            {school.schoolName}
                          </span>
                        </div>
                      </td>

                      {displayedJenisPersediaan.map((jenis) => {
                        const dataItem = school.rowsMap.get(jenis) || { saMasuk: 0, saKeluar: 0, saSisa: 0, blMasuk: 0, blKeluar: 0, blSisa: 0, saldoAkhir: 0 };
                        return (
                          <React.Fragment key={`cell-${school.npsn}-${jenis}`}>
                            <td className="border border-slate-700 py-2 px-2 text-right">
                              {dataItem.saMasuk > 0 ? formatRupiah(dataItem.saMasuk) : '-'}
                            </td>
                            <td className="border border-slate-700 py-2 px-2 text-right">
                              {dataItem.saKeluar > 0 ? formatRupiah(dataItem.saKeluar) : '-'}
                            </td>
                            <td className="border border-slate-700 py-2 px-2 text-right font-semibold bg-emerald-50/40 border-r border-slate-700">
                              {dataItem.saSisa !== 0 ? formatRupiah(dataItem.saSisa) : '-'}
                            </td>
                            <td className="border border-slate-700 py-2 px-2 text-right">
                              {dataItem.blMasuk > 0 ? formatRupiah(dataItem.blMasuk) : '-'}
                            </td>
                            <td className="border border-slate-700 py-2 px-2 text-right">
                              {dataItem.blKeluar > 0 ? formatRupiah(dataItem.blKeluar) : '-'}
                            </td>
                            <td className="border border-slate-700 py-2 px-2 text-right font-semibold bg-slate-50 border-r border-slate-700">
                              {dataItem.blSisa !== 0 ? formatRupiah(dataItem.blSisa) : '-'}
                            </td>
                            <td className="border border-slate-700 py-2 px-2 text-right font-black bg-rose-50/80 text-rose-950">
                              {dataItem.saldoAkhir !== 0 ? formatRupiah(dataItem.saldoAkhir) : '-'}
                            </td>
                          </React.Fragment>
                        );
                      })}

                      <td className="border border-slate-700 py-2 px-3 text-right font-semibold text-emerald-900 bg-emerald-50">
                        {formatRupiah(school.totalMasuk)}
                      </td>
                      <td className="border border-slate-700 py-2 px-3 text-right font-semibold text-rose-800 bg-rose-50">
                        {formatRupiah(school.totalKeluar)}
                      </td>
                      <td className="border border-slate-700 py-2 px-3 text-right font-black text-emerald-800 bg-slate-100">
                        {formatRupiah(school.totalSaldoAkhir)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredSchools.length > 0 && (
                <tfoot className="bg-slate-200 text-slate-900 font-extrabold sticky bottom-0 z-10 shadow-lg">
                  <tr>
                    <td colSpan={2} className="border border-slate-800 py-2.5 px-4 text-center uppercase">
                      JUMLAH TOTAL SE-KABUPATEN
                    </td>
                    {displayedJenisPersediaan.map((jenis) => {
                      let tSaM = 0, tSaK = 0, tSaS = 0, tBlM = 0, tBlK = 0, tBlS = 0, tSk = 0;
                      filteredSchools.forEach((s) => {
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
                        <React.Fragment key={`tot-${jenis}`}>
                          <td className="border border-slate-800 py-2 px-2 text-right">{tSaM > 0 ? formatRupiah(tSaM) : '-'}</td>
                          <td className="border border-slate-800 py-2 px-2 text-right">{tSaK > 0 ? formatRupiah(tSaK) : '-'}</td>
                          <td className="border border-slate-800 py-2 px-2 text-right bg-emerald-100">{tSaS !== 0 ? formatRupiah(tSaS) : '-'}</td>
                          <td className="border border-slate-800 py-2 px-2 text-right">{tBlM > 0 ? formatRupiah(tBlM) : '-'}</td>
                          <td className="border border-slate-800 py-2 px-2 text-right">{tBlK > 0 ? formatRupiah(tBlK) : '-'}</td>
                          <td className="border border-slate-800 py-2 px-2 text-right bg-slate-300">{tBlS !== 0 ? formatRupiah(tBlS) : '-'}</td>
                          <td className="border border-slate-800 py-2 px-2 text-right font-black bg-rose-200 text-rose-950">{tSk !== 0 ? formatRupiah(tSk) : '-'}</td>
                        </React.Fragment>
                      );
                    })}
                    <td className="border border-slate-800 py-2 px-3 text-right font-bold text-emerald-950 bg-emerald-100">
                      {formatRupiah(grandTotals.totMasuk)}
                    </td>
                    <td className="border border-slate-800 py-2 px-3 text-right font-bold text-rose-950 bg-rose-100">
                      {formatRupiah(grandTotals.totKeluar)}
                    </td>
                    <td className="border border-slate-800 py-2 px-3 text-right font-black text-emerald-900 bg-slate-300">
                      {formatRupiah(grandTotals.totSaldo)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      ) : (
        /* SUMMARY LIST VIEW */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-400" />
              <span className="font-black text-sm uppercase tracking-wide">
                Daftar Ringkasan Per UPT Sekolah ({filteredSchools.length} Sekolah)
              </span>
            </div>
            <span className="text-xs text-emerald-300 font-bold bg-slate-800 px-3 py-1 rounded-xl border border-slate-700">
              Periode: {formatCombinedQuarterLabel(selectedQuarters)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4 text-center w-12">No</th>
                  <th className="py-3 px-4">Nama UPT / Satuan Pendidikan</th>
                  <th className="py-3 px-4">NPSN / Kategori</th>
                  <th className="py-3 px-4 text-center">Periode Gabungan</th>
                  <th className="py-3 px-4 text-right">Total Masuk</th>
                  <th className="py-3 px-4 text-right">Total Keluar</th>
                  <th className="py-3 px-4 text-right">Saldo Akhir</th>
                  <th className="py-3 px-4 text-center">Aksi Laporan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSchools.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      Tidak ada data rekapitulasi UPT sekolah yang sesuai dengan filter.
                    </td>
                  </tr>
                ) : (
                  filteredSchools.map((item, idx) => (
                    <tr key={item.npsn + item.schoolName} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-center font-bold text-slate-500">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <Building className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>{item.schoolName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono text-slate-700 font-semibold">{item.npsn}</div>
                        <div className="text-[11px] text-emerald-700 font-bold">{item.category}</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          {formatCombinedQuarterLabel(selectedQuarters)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-800">
                        {formatRupiah(item.totalMasuk)}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-rose-600">
                        {formatRupiah(item.totalKeluar)}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-700 text-sm">
                        {formatRupiah(item.totalSaldoAkhir)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {item.expenseRef ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onSelectExpense(item.expenseRef!)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg transition-colors cursor-pointer"
                            >
                              Detail
                            </button>
                            <button
                              type="button"
                              onClick={() => onPrintReceipt(item.expenseRef!)}
                              className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors cursor-pointer"
                              title="Cetak Berita Acara Rekon"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Belum ada input</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredSchools.length > 0 && (
                <tfoot className="bg-slate-100 font-extrabold text-slate-900 border-t border-slate-300">
                  <tr>
                    <td colSpan={4} className="py-3 px-4 text-center uppercase tracking-wider">
                      Jumlah Total Se-Kabupaten ({filteredSchools.length} UPT Sekolah)
                    </td>
                    <td className="py-3 px-4 text-right">
                      {formatRupiah(grandTotals.totMasuk)}
                    </td>
                    <td className="py-3 px-4 text-right text-rose-600">
                      {formatRupiah(grandTotals.totKeluar)}
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-800 text-base">
                      {formatRupiah(grandTotals.totSaldo)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Modal Kode & Panduan Google Apps Script Rekapan Se-Dinas */}
      <AppsScriptModal
        isOpen={appsScriptModalOpen}
        onClose={() => setAppsScriptModalOpen(false)}
        schoolInfo={schoolInfo}
        expenses={expenses}
      />
    </div>
  );
};
