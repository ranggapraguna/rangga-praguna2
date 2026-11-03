import React, { useState, useRef } from 'react';
import { 
  Save, 
  X, 
  Calculator, 
  Sparkles, 
  Check, 
  Calendar,
  FileText,
  Plus,
  Trash2,
  Printer,
  Wrench,
  Package,
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { 
  parsePersediaanExcel, 
  downloadPersediaanExcelTemplate 
} from '../utils/excelImport';
import { 
  SchoolExpense, 
  Triwulan, 
  BOSSource, 
  BOS_SOURCE_OPTIONS,
  KomponenBOS, 
  KodeRekening, 
  REKENING_PERSEDIAAN_OPTIONS,
  REKENING_PEMELIHARAAN_OPTIONS,
  JenisSaldoAwal,
  JenisMasukPemeliharaan,
  JenisKeluarPemeliharaan,
  TaxType, 
  PaymentMethod, 
  SchoolInfo,
  RincianRekeningItem,
  normalizeRekeningPersediaan
} from '../types';
import { 
  formatRupiah, 
  generateNextReceiptNumber,
  getTriwulanFromDate,
  resolvePemeliharaanItemsWithTriwulan,
  sortQuarters,
  formatCombinedQuarterLabel
} from '../utils/budgetCalculations';

interface ExpenseFormViewProps {
  existingExpense?: SchoolExpense | null;
  defaultQuarter?: Triwulan;
  schoolInfo: SchoolInfo;
  allExpenses: SchoolExpense[];
  onSave: (expense: SchoolExpense) => void;
  onAutoSave?: (expense: SchoolExpense) => void;
  onCancel: () => void;
  inputMode?: 'persediaan' | 'pemeliharaan';
  onInputModeChange?: (mode: 'persediaan' | 'pemeliharaan') => void;
  onOpenDatabaseSpreadsheet?: () => void;
}

const DEFAULT_KOMPONEN: KomponenBOS = '5. Administrasi Kegiatan Sekolah & ATK';

const REKENING_OPTIONS: readonly KodeRekening[] = REKENING_PERSEDIAAN_OPTIONS;

interface FormDraftStorage {
  triwulan?: Triwulan;
  sumberDana?: BOSSource;
  tanggal?: string;
  kodeRekening?: KodeRekening;
  saldoAwalMasuk?: JenisSaldoAwal;
  saldoAwalKeluar?: JenisSaldoAwal;
  isHibah?: boolean;
  belanjaMasuk?: number;
  belanjaKeluar?: number;
  tanggalPemeliharaan?: string;
  kodeRekeningPemeliharaan?: string;
  jenisPemeliharaan?: string;
  nominalJasaPemeliharaan?: number;
  nominalBarangPemeliharaan?: number;
  keteranganPemeliharaan?: string;
  persediaanItemsByQuarter?: Record<Triwulan, RincianRekeningItem[]>;
  pemeliharaanItems?: RincianRekeningItem[];
}

export const ExpenseFormView: React.FC<ExpenseFormViewProps> = ({
  existingExpense,
  defaultQuarter = 'TW1',
  schoolInfo,
  allExpenses,
  onSave,
  onAutoSave,
  onCancel,
  inputMode: controlledInputMode,
  onInputModeChange,
  onOpenDatabaseSpreadsheet,
}) => {
  const isDinas =
    Boolean(schoolInfo?.namaSekolah?.toUpperCase().includes('DINAS PENDIDIKAN'));

  const draftStorageKey = React.useMemo(() => {
    const schoolKey = (schoolInfo?.npsn || schoolInfo?.namaSekolah || 'default')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_');
    return `bosp_form_draft_v2_${schoolKey}_${schoolInfo?.tahunAnggaran || '2026'}`;
  }, [schoolInfo?.npsn, schoolInfo?.namaSekolah, schoolInfo?.tahunAnggaran]);

  const savedDraft = React.useMemo<FormDraftStorage>(() => {
    try {
      const raw = localStorage.getItem(draftStorageKey);
      if (raw) {
        return JSON.parse(raw) as FormDraftStorage;
      }
    } catch {
      // ignore storage parse error
    }
    return {};
  }, [draftStorageKey]);

  const [triwulan, setTriwulan] = useState<Triwulan>(
    existingExpense?.triwulan || savedDraft.triwulan || defaultQuarter
  );
  const [sumberDana, setSumberDana] = useState<BOSSource>(
    existingExpense?.sumberDana ||
      savedDraft.sumberDana ||
      (existingExpense?.isHibah ? 'HIBAH' : isDinas ? 'APBD' : 'BOS Reguler')
  );
  const [tanggal, setTanggal] = useState<string>(
    existingExpense?.tanggal ||
      savedDraft.tanggal ||
      `${schoolInfo.tahunAnggaran}${new Date().toISOString().slice(4, 10)}`
  );
  const [noBukti, setNoBukti] = useState<string>(
    existingExpense?.noBukti ||
      generateNextReceiptNumber(
        allExpenses,
        existingExpense?.triwulan || savedDraft.triwulan || defaultQuarter,
        schoolInfo.tahunAnggaran
      )
  );
  const [kodeRekening, setKodeRekening] = useState<KodeRekening>(() => {
    if (existingExpense?.kodeRekening) {
      const norm = normalizeRekeningPersediaan(existingExpense.kodeRekening);
      if (REKENING_OPTIONS.includes(norm)) return norm;
    }
    if (savedDraft.kodeRekening && REKENING_OPTIONS.includes(savedDraft.kodeRekening)) {
      return savedDraft.kodeRekening;
    }
    return 'Alat/Bahan untuk Kegiatan Kantor- Alat Tulis Kantor';
  });

  // State untuk Menu 4: 2 Combo Box Saldo Awal (Masuk & Keluar), Nilai Masuk & Keluar Belanja
  const [saldoAwalMasuk, setSaldoAwalMasuk] = useState<JenisSaldoAwal>(
    existingExpense?.saldoAwalMasuk ||
      existingExpense?.saldoAwal ||
      savedDraft.saldoAwalMasuk ||
      'Bukan Saldo Awal'
  );
  const [saldoAwalKeluar, setSaldoAwalKeluar] = useState<JenisSaldoAwal>(
    existingExpense?.saldoAwalKeluar || savedDraft.saldoAwalKeluar || 'Bukan Saldo Awal'
  );
  const [isHibah, setIsHibah] = useState<boolean>(
    existingExpense?.sumberDana === 'HIBAH' ||
      Boolean(existingExpense?.isHibah) ||
      Boolean(savedDraft.isHibah)
  );

  const [belanjaMasuk, setBelanjaMasuk] = useState<number>(savedDraft.belanjaMasuk || 0);
  const [belanjaKeluar, setBelanjaKeluar] = useState<number>(savedDraft.belanjaKeluar || 0);

  const [internalInputMode, setInternalInputMode] = useState<'persediaan' | 'pemeliharaan'>(() => {
    if (existingExpense?.kategoriBelanja === 'pemeliharaan') return 'pemeliharaan';
    if (
      existingExpense?.kodeRekening &&
      (REKENING_PEMELIHARAAN_OPTIONS as readonly string[]).includes(existingExpense.kodeRekening)
    ) {
      return 'pemeliharaan';
    }
    return controlledInputMode || 'persediaan';
  });

  const inputMode = controlledInputMode ?? internalInputMode;
  const setInputMode = (m: 'persediaan' | 'pemeliharaan') => {
    setInternalInputMode(m);
    onInputModeChange?.(m);
  };

  // State khusus Form Penginputan Belanja Pemeliharaan (Tanggal, Jenis Pemeliharaan, Jasa, Barang, Keterangan)
  const [tanggalPemeliharaan, setTanggalPemeliharaan] = useState<string>(
    existingExpense?.tanggal ??
      savedDraft.tanggalPemeliharaan ??
      `${schoolInfo.tahunAnggaran}${new Date().toISOString().slice(4, 10)}`
  );
  const [kodeRekeningPemeliharaan, setKodeRekeningPemeliharaan] = useState<string>(
    existingExpense?.kodeRekening &&
      (REKENING_PEMELIHARAAN_OPTIONS as readonly string[]).includes(existingExpense.kodeRekening)
      ? existingExpense.kodeRekening
      : savedDraft.kodeRekeningPemeliharaan || REKENING_PEMELIHARAAN_OPTIONS[0]
  );
  const [jenisPemeliharaan, setJenisPemeliharaan] = useState<string>(
    savedDraft.jenisPemeliharaan || ''
  );
  const [nominalJasaPemeliharaan, setNominalJasaPemeliharaan] = useState<number>(
    savedDraft.nominalJasaPemeliharaan || 0
  );
  const [nominalBarangPemeliharaan, setNominalBarangPemeliharaan] = useState<number>(
    savedDraft.nominalBarangPemeliharaan || 0
  );
  const [keteranganPemeliharaan, setKeteranganPemeliharaan] = useState<string>(
    savedDraft.keteranganPemeliharaan || ''
  );

  const normalizeRincianItem = (it: RincianRekeningItem): RincianRekeningItem => {
    const masukType: JenisSaldoAwal = it.saldoAwalMasuk || it.saldoAwal || 'Bukan Saldo Awal';
    const keluarType: JenisSaldoAwal = it.saldoAwalKeluar || 'Bukan Saldo Awal';
    const hibah = Boolean(it.isHibah);

    const hasExplicitJasaBarang =
      it.nilaiJasa !== undefined || it.nilaiBarang !== undefined;

    if (hasExplicitJasaBarang) {
      const nilaiJasa = Number(it.nilaiJasa) || 0;
      const nilaiBarang = Number(it.nilaiBarang) || 0;
      const totalJasaTambahBarang = nilaiJasa + nilaiBarang;
      return {
        ...it,
        nilaiJasa,
        nilaiBarang,
        saldoAwal: masukType,
        saldoAwalMasuk: masukType,
        saldoAwalKeluar: keluarType,
        isHibah: false,
        nilaiSaldoAwal: 0,
        nilaiBelanjaLra: totalJasaTambahBarang,
        nilaiPengakuanBast: nilaiBarang,
        pengeluaranSaldoAwal: 0,
        pengeluaranBelanja: totalJasaTambahBarang,
        pengeluaranBast: nilaiBarang,
        hibahMasuk: 0,
        hibahKeluar: 0,
        nilaiMasuk: totalMasukItemFromJasaBarang(totalJasaTambahBarang),
        nilaiKeluar: totalMasukItemFromJasaBarang(totalJasaTambahBarang),
        sisaNilai: 0,
      };
    }

    const nilaiPengakuanBast = it.nilaiPengakuanBast || 0;
    const pengeluaranBast = it.pengeluaranBast || 0;

    const nilaiSaldoAwal =
      it.nilaiSaldoAwal !== undefined
        ? it.nilaiSaldoAwal
        : !hibah && masukType === 'Saldo Awal'
        ? it.nilaiMasuk || 0
        : 0;
    const nilaiBelanjaLra =
      it.nilaiBelanjaLra !== undefined
        ? it.nilaiBelanjaLra
        : !hibah && masukType === 'Bukan Saldo Awal' && nilaiPengakuanBast === 0
        ? it.nilaiMasuk || 0
        : 0;
    const pengeluaranSaldoAwal =
      it.pengeluaranSaldoAwal !== undefined
        ? it.pengeluaranSaldoAwal
        : !hibah && keluarType === 'Saldo Awal'
        ? it.nilaiKeluar || 0
        : 0;
    const pengeluaranBelanja =
      it.pengeluaranBelanja !== undefined
        ? it.pengeluaranBelanja
        : !hibah && keluarType === 'Bukan Saldo Awal' && pengeluaranBast === 0
        ? it.nilaiKeluar || 0
        : 0;
    const hibahMasuk =
      it.hibahMasuk !== undefined ? it.hibahMasuk : hibah ? it.nilaiMasuk || 0 : 0;
    const hibahKeluar =
      it.hibahKeluar !== undefined ? it.hibahKeluar : hibah ? it.nilaiKeluar || 0 : 0;

    const totalMasukItem =
      nilaiSaldoAwal + nilaiBelanjaLra + nilaiPengakuanBast + hibahMasuk;
    const totalKeluarItem =
      pengeluaranSaldoAwal + pengeluaranBelanja + pengeluaranBast + hibahKeluar;

    return {
      ...it,
      kodeRekening: normalizeRekeningPersediaan(it.kodeRekening),
      saldoAwal: masukType,
      saldoAwalMasuk: masukType,
      saldoAwalKeluar: keluarType,
      isHibah: hibah,
      nilaiSaldoAwal,
      nilaiBelanjaLra,
      nilaiPengakuanBast,
      pengeluaranSaldoAwal,
      pengeluaranBelanja,
      pengeluaranBast,
      hibahMasuk,
      hibahKeluar,
      nilaiMasuk: totalMasukItem,
      nilaiKeluar: totalKeluarItem,
      sisaNilai: totalMasukItem - totalKeluarItem,
    };
  };

  function totalMasukItemFromJasaBarang(total: number): number {
    return total;
  }

  const mergeRincianItemIntoList = (
    list: RincianRekeningItem[],
    incomingRaw: RincianRekeningItem
  ): RincianRekeningItem[] => {
    const incoming = normalizeRincianItem(incomingRaw);
    const existingIndex = list.findIndex((item) => item.kodeRekening === incoming.kodeRekening);

    if (existingIndex === -1) {
      return [...list, incoming];
    }

    return list.map((item, idx) => {
      if (idx !== existingIndex) return item;

      const nilaiSaldoAwal = (item.nilaiSaldoAwal || 0) + (incoming.nilaiSaldoAwal || 0);
      const nilaiBelanjaLra = (item.nilaiBelanjaLra || 0) + (incoming.nilaiBelanjaLra || 0);
      const nilaiPengakuanBast =
        (item.nilaiPengakuanBast || 0) + (incoming.nilaiPengakuanBast || 0);
      const pengeluaranSaldoAwal =
        (item.pengeluaranSaldoAwal || 0) + (incoming.pengeluaranSaldoAwal || 0);
      const pengeluaranBelanja =
        (item.pengeluaranBelanja || 0) + (incoming.pengeluaranBelanja || 0);
      const pengeluaranBast = (item.pengeluaranBast || 0) + (incoming.pengeluaranBast || 0);
      const hibahMasuk = (item.hibahMasuk || 0) + (incoming.hibahMasuk || 0);
      const hibahKeluar = (item.hibahKeluar || 0) + (incoming.hibahKeluar || 0);
      const nilaiJasa = (item.nilaiJasa || 0) + (incoming.nilaiJasa || 0);
      const nilaiBarang = (item.nilaiBarang || 0) + (incoming.nilaiBarang || 0);

      const isPemItem =
        item.nilaiJasa !== undefined ||
        item.nilaiBarang !== undefined ||
        incoming.nilaiJasa !== undefined ||
        incoming.nilaiBarang !== undefined;

      const totalMasukItem = isPemItem
        ? nilaiBelanjaLra
        : nilaiSaldoAwal + nilaiBelanjaLra + nilaiPengakuanBast + hibahMasuk;
      const totalKeluarItem = isPemItem
        ? nilaiBelanjaLra
        : pengeluaranSaldoAwal + pengeluaranBelanja + pengeluaranBast + hibahKeluar;

      return {
        ...item,
        tanggalPemeliharaan: incoming.tanggalPemeliharaan || item.tanggalPemeliharaan,
        nilaiJasa,
        nilaiBarang,
        saldoAwal: incoming.saldoAwalMasuk || item.saldoAwal,
        saldoAwalMasuk: incoming.saldoAwalMasuk || item.saldoAwalMasuk,
        saldoAwalKeluar: incoming.saldoAwalKeluar || item.saldoAwalKeluar,
        isHibah: incoming.isHibah ?? item.isHibah,
        nilaiSaldoAwal,
        nilaiBelanjaLra,
        nilaiPengakuanBast,
        pengeluaranSaldoAwal,
        pengeluaranBelanja,
        pengeluaranBast,
        hibahMasuk,
        hibahKeluar,
        nilaiMasuk: totalMasukItem,
        nilaiKeluar: totalKeluarItem,
        sisaNilai: totalMasukItem - totalKeluarItem,
        keteranganPemeliharaan:
          incoming.keteranganPemeliharaan || item.keteranganPemeliharaan,
      };
    });
  };

  const isPemeliharaanExpense = (exp: SchoolExpense): boolean => {
    if (exp.kategoriBelanja === 'pemeliharaan') return true;
    if (
      exp.kodeRekening &&
      (REKENING_PEMELIHARAAN_OPTIONS as readonly string[]).includes(exp.kodeRekening)
    ) {
      return true;
    }
    return Boolean(
      exp.rincianItems?.some(
        (it) => it.nilaiJasa !== undefined || it.nilaiBarang !== undefined
      )
    );
  };

  const extractItemsFromExpenseRecord = (exp: SchoolExpense): RincianRekeningItem[] => {
    if (exp.rincianItems && exp.rincianItems.length > 0) {
      return exp.rincianItems.map((it) => normalizeRincianItem(it));
    }
    return [
      normalizeRincianItem({
        id: `item-${exp.id}`,
        kodeRekening: exp.kodeRekening,
        tanggalPemeliharaan: exp.tanggal,
        saldoAwal: exp.saldoAwal || 'Bukan Saldo Awal',
        saldoAwalMasuk: exp.saldoAwalMasuk || exp.saldoAwal || 'Bukan Saldo Awal',
        saldoAwalKeluar: exp.saldoAwalKeluar || 'Bukan Saldo Awal',
        isHibah: exp.isHibah || false,
        nilaiSaldoAwal: exp.nilaiSaldoAwal,
        nilaiBelanjaLra: exp.nilaiBelanjaLra,
        pengeluaranSaldoAwal: exp.pengeluaranSaldoAwal,
        pengeluaranBelanja: exp.pengeluaranBelanja,
        hibahMasuk: exp.hibahMasuk,
        hibahKeluar: exp.hibahKeluar,
        nilaiMasuk: exp.nilaiMasuk ?? exp.subtotal ?? 0,
        nilaiKeluar: exp.nilaiKeluar ?? exp.totalBersih ?? 0,
        sisaNilai: exp.sisaNilai ?? 0,
      }),
    ];
  };

  const buildPersediaanByQuarterFromExpenses = (
    expenseList: SchoolExpense[]
  ): Record<Triwulan, RincianRekeningItem[]> => {
    const result: Record<Triwulan, RincianRekeningItem[]> = {
      TW1: [],
      TW2: [],
      TW3: [],
      TW4: [],
    };
    const persediaanList = expenseList.filter((e) => !isPemeliharaanExpense(e));
    for (const q of ['TW1', 'TW2', 'TW3', 'TW4'] as Triwulan[]) {
      const matching = persediaanList.filter((e) => e.triwulan === q);
      let merged: RincianRekeningItem[] = [];
      for (const exp of matching) {
        for (const it of extractItemsFromExpenseRecord(exp)) {
          merged = mergeRincianItemIntoList(merged, it);
        }
      }
      result[q] = merged;
    }
    return result;
  };

  const buildPemeliharaanFromExpenses = (
    expenseList: SchoolExpense[]
  ): RincianRekeningItem[] => {
    const pemList = expenseList.filter((e) => isPemeliharaanExpense(e));
    const items: RincianRekeningItem[] = [];
    for (const exp of pemList) {
      for (const it of extractItemsFromExpenseRecord(exp)) {
        items.push(normalizeRincianItem(it));
      }
    }
    return items;
  };

  const [persediaanItemsByQuarter, setPersediaanItemsByQuarter] = useState<
    Record<Triwulan, RincianRekeningItem[]>
  >(() => {
    const fromExpenses = buildPersediaanByQuarterFromExpenses(allExpenses);
    const fromDraft = savedDraft.persediaanItemsByQuarter;
    const initial: Record<Triwulan, RincianRekeningItem[]> = {
      TW1:
        fromDraft?.TW1 && fromDraft.TW1.length > 0
          ? fromDraft.TW1.map(normalizeRincianItem)
          : fromExpenses.TW1,
      TW2:
        fromDraft?.TW2 && fromDraft.TW2.length > 0
          ? fromDraft.TW2.map(normalizeRincianItem)
          : fromExpenses.TW2,
      TW3:
        fromDraft?.TW3 && fromDraft.TW3.length > 0
          ? fromDraft.TW3.map(normalizeRincianItem)
          : fromExpenses.TW3,
      TW4:
        fromDraft?.TW4 && fromDraft.TW4.length > 0
          ? fromDraft.TW4.map(normalizeRincianItem)
          : fromExpenses.TW4,
    };

    if (existingExpense && !isPemeliharaanExpense(existingExpense)) {
      const q = existingExpense.triwulan || defaultQuarter;
      initial[q] = extractItemsFromExpenseRecord(existingExpense).reduce<RincianRekeningItem[]>(
        (acc, it) => mergeRincianItemIntoList(acc, it),
        []
      );
    }
    return initial;
  });

  const [pemeliharaanItems, setPemeliharaanItems] = useState<RincianRekeningItem[]>(() => {
    if (existingExpense && isPemeliharaanExpense(existingExpense)) {
      return extractItemsFromExpenseRecord(existingExpense);
    }
    if (savedDraft.pemeliharaanItems && savedDraft.pemeliharaanItems.length > 0) {
      return savedDraft.pemeliharaanItems.map(normalizeRincianItem);
    }
    return buildPemeliharaanFromExpenses(allExpenses);
  });

  // Sync with existingExpense when user explicitly clicks Edit from Riwayat SPJ
  const lastEditedExpenseIdRef = useRef<string | null>(existingExpense?.id || null);
  React.useEffect(() => {
    if (existingExpense && existingExpense.id !== lastEditedExpenseIdRef.current) {
      lastEditedExpenseIdRef.current = existingExpense.id;
      if (isPemeliharaanExpense(existingExpense)) {
        setInternalInputMode('pemeliharaan');
        onInputModeChange?.('pemeliharaan');
        setPemeliharaanItems(extractItemsFromExpenseRecord(existingExpense));
      } else {
        const q = existingExpense.triwulan || defaultQuarter;
        setTriwulan(q);
        setInternalInputMode('persediaan');
        onInputModeChange?.('persediaan');
        setPersediaanItemsByQuarter((prev) => ({
          ...prev,
          [q]: extractItemsFromExpenseRecord(existingExpense).reduce<RincianRekeningItem[]>(
            (acc, it) => mergeRincianItemIntoList(acc, it),
            []
          ),
        }));
      }
    } else if (!existingExpense) {
      lastEditedExpenseIdRef.current = null;
    }
  }, [existingExpense]);

  const prevDefaultQuarterRef = useRef<Triwulan>(defaultQuarter);
  React.useEffect(() => {
    if (defaultQuarter !== prevDefaultQuarterRef.current) {
      prevDefaultQuarterRef.current = defaultQuarter;
      if (!existingExpense) {
        setTriwulan(defaultQuarter);
      }
    }
  }, [defaultQuarter, existingExpense]);

  // Hydrate from allExpenses if allExpenses loads from server/spreadsheet or is cleared
  const isLocalUpdatingRef = useRef<boolean>(false);
  const prevExpensesCountRef = useRef<number>(allExpenses.length);
  React.useEffect(() => {
    if (isLocalUpdatingRef.current) {
      prevExpensesCountRef.current = allExpenses.length;
      return;
    }

    if (allExpenses.length === 0 && prevExpensesCountRef.current > 0) {
      // User clicked "Hapus Semua Data"
      setPersediaanItemsByQuarter({ TW1: [], TW2: [], TW3: [], TW4: [] });
      setPemeliharaanItems([]);
      try {
        localStorage.removeItem(draftStorageKey);
      } catch {
        // ignore
      }
    } else if (allExpenses.length > 0) {
      const fromExpensesPersediaan = buildPersediaanByQuarterFromExpenses(allExpenses);
      const fromExpensesPemeliharaan = buildPemeliharaanFromExpenses(allExpenses);

      setPersediaanItemsByQuarter((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const q of ['TW1', 'TW2', 'TW3', 'TW4'] as Triwulan[]) {
          if (prev[q].length === 0 && fromExpensesPersediaan[q].length > 0) {
            next[q] = fromExpensesPersediaan[q];
            changed = true;
          }
        }
        return changed ? next : prev;
      });

      setPemeliharaanItems((prev) => {
        if (prev.length === 0 && fromExpensesPemeliharaan.length > 0) {
          return fromExpensesPemeliharaan;
        }
        return prev;
      });
    }
    prevExpensesCountRef.current = allExpenses.length;
  }, [allExpenses, draftStorageKey]);

  // Persist all draft state to localStorage so clicking other menus NEVER loses table rows or inputs
  React.useEffect(() => {
    try {
      const draftToSave: FormDraftStorage = {
        triwulan,
        sumberDana,
        tanggal,
        kodeRekening,
        saldoAwalMasuk,
        saldoAwalKeluar,
        isHibah,
        belanjaMasuk,
        belanjaKeluar,
        tanggalPemeliharaan,
        kodeRekeningPemeliharaan,
        jenisPemeliharaan,
        nominalJasaPemeliharaan,
        nominalBarangPemeliharaan,
        keteranganPemeliharaan,
        persediaanItemsByQuarter,
        pemeliharaanItems,
      };
      localStorage.setItem(draftStorageKey, JSON.stringify(draftToSave));
    } catch {
      // ignore quota errors
    }
  }, [
    draftStorageKey,
    triwulan,
    sumberDana,
    tanggal,
    kodeRekening,
    saldoAwalMasuk,
    saldoAwalKeluar,
    isHibah,
    belanjaMasuk,
    belanjaKeluar,
    tanggalPemeliharaan,
    kodeRekeningPemeliharaan,
    jenisPemeliharaan,
    nominalJasaPemeliharaan,
    nominalBarangPemeliharaan,
    keteranganPemeliharaan,
    persediaanItemsByQuarter,
    pemeliharaanItems,
  ]);

  const buildExpenseObject = (
    mode: 'persediaan' | 'pemeliharaan',
    targetQuarter: Triwulan,
    finalItems: RincianRekeningItem[]
  ): SchoolExpense => {
    const matchedExisting =
      existingExpense &&
      ((mode === 'pemeliharaan' && isPemeliharaanExpense(existingExpense)) ||
        (mode === 'persediaan' &&
          !isPemeliharaanExpense(existingExpense) &&
          existingExpense.triwulan === targetQuarter))
        ? existingExpense
        : mode === 'pemeliharaan'
        ? allExpenses.find((e) => isPemeliharaanExpense(e)) || null
        : allExpenses.find((e) => !isPemeliharaanExpense(e) && e.triwulan === targetQuarter) ||
          null;

    const finalSaldoAwal = finalItems.reduce((sum, item) => sum + (item.nilaiSaldoAwal || 0), 0);
    const finalBelanjaLra = finalItems.reduce((sum, item) => sum + (item.nilaiBelanjaLra || 0), 0);
    const finalPengakuanBast = finalItems.reduce(
      (sum, item) => sum + (item.nilaiPengakuanBast || 0),
      0
    );
    const finalPengeluaranSaldoAwal = finalItems.reduce(
      (sum, item) => sum + (item.pengeluaranSaldoAwal || 0),
      0
    );
    const finalPengeluaranBelanja = finalItems.reduce(
      (sum, item) => sum + (item.pengeluaranBelanja || 0),
      0
    );
    const finalPengeluaranBast = finalItems.reduce(
      (sum, item) => sum + (item.pengeluaranBast || 0),
      0
    );
    const finalHibahMasuk = finalItems.reduce((sum, item) => sum + (item.hibahMasuk || 0), 0);
    const finalHibahKeluar = finalItems.reduce((sum, item) => sum + (item.hibahKeluar || 0), 0);

    const finalMasuk =
      mode === 'pemeliharaan'
        ? finalBelanjaLra
        : finalSaldoAwal + finalBelanjaLra + finalPengakuanBast + finalHibahMasuk;
    const finalKeluar =
      mode === 'pemeliharaan'
        ? finalBelanjaLra
        : finalPengeluaranSaldoAwal +
          finalPengeluaranBelanja +
          finalPengeluaranBast +
          finalHibahKeluar;
    const finalSisa = finalMasuk - finalKeluar;

    const primaryRekening =
      finalItems[0]?.kodeRekening ||
      (mode === 'pemeliharaan' ? kodeRekeningPemeliharaan : kodeRekening);
    const primarySaldoAwal = finalItems[0]?.saldoAwalMasuk || saldoAwalMasuk;
    const summaryUraian = finalItems
      .map(
        (i) =>
          `${i.kodeRekening}${
            i.keteranganPemeliharaan
              ? ` [${i.keteranganPemeliharaan}]`
              : i.isHibah
              ? ' (HIBAH)'
              : ` (${i.saldoAwalMasuk || i.saldoAwal})`
          }`
      )
      .join(', ');
    const nominalUtama = finalKeluar > 0 ? finalKeluar : finalMasuk;

    let effectiveTanggal = tanggal;
    let effectiveTriwulan: Triwulan = targetQuarter;
    let effectiveMergedQuarters: Triwulan[] | undefined = undefined;
    let effectiveCombinedQuarterLabel: string | undefined = undefined;

    if (mode === 'pemeliharaan') {
      const resolvedItems = resolvePemeliharaanItemsWithTriwulan(
        finalItems,
        tanggalPemeliharaan || tanggal,
        defaultQuarter
      );
      effectiveTanggal =
        resolvedItems.find((it) => it.resolvedTanggal)?.resolvedTanggal ||
        tanggalPemeliharaan ||
        tanggal ||
        `${schoolInfo.tahunAnggaran}-01-01`;
      const distinctQuarters = sortQuarters(
        resolvedItems.map((it) => it.resolvedTriwulan)
      );
      effectiveTriwulan =
        distinctQuarters[0] || getTriwulanFromDate(effectiveTanggal, defaultQuarter);
      effectiveMergedQuarters =
        distinctQuarters.length > 0 ? distinctQuarters : [effectiveTriwulan];
      effectiveCombinedQuarterLabel = formatCombinedQuarterLabel(effectiveMergedQuarters);
    }

    return {
      id: matchedExisting ? matchedExisting.id : `exp-${mode}-${targetQuarter}-${schoolInfo.tahunAnggaran}`,
      tahunAnggaran: matchedExisting?.tahunAnggaran || schoolInfo.tahunAnggaran,
      schoolName: matchedExisting?.schoolName || schoolInfo.namaSekolah,
      npsn: matchedExisting?.npsn || schoolInfo.npsn,
      noBukti:
        matchedExisting?.noBukti ||
        generateNextReceiptNumber(allExpenses, effectiveTriwulan, schoolInfo.tahunAnggaran),
      tanggal: effectiveTanggal,
      triwulan: effectiveTriwulan,
      mergedQuarters: effectiveMergedQuarters,
      combinedQuarterLabel: effectiveCombinedQuarterLabel,
      sumberDana:
        mode === 'pemeliharaan'
          ? matchedExisting?.sumberDana || (isDinas ? 'APBD' : 'BOS Reguler')
          : sumberDana,
      komponen:
        matchedExisting?.komponen ||
        (mode === 'pemeliharaan'
          ? '7. Pemeliharaan Sarana & Prasarana Sekolah'
          : DEFAULT_KOMPONEN),
      kodeRekening: primaryRekening,
      kategoriBelanja: mode,
      saldoAwal: primarySaldoAwal,
      saldoAwalMasuk: finalItems[0]?.saldoAwalMasuk || saldoAwalMasuk,
      saldoAwalKeluar: finalItems[0]?.saldoAwalKeluar || saldoAwalKeluar,
      isHibah: sumberDana === 'HIBAH' || finalItems.some((i) => i.isHibah) || isHibah,
      uraian: matchedExisting?.uraian || summaryUraian,
      penerimaToko: matchedExisting?.penerimaToko || '-',
      npwpPenerima: matchedExisting?.npwpPenerima,
      metodePembayaran: (matchedExisting?.metodePembayaran || 'Kas Tunai Bendahara') as PaymentMethod,
      volume: 1,
      satuan: 'Paket',
      hargaSatuan: nominalUtama,
      subtotal: nominalUtama,
      nilaiSaldoAwal: finalSaldoAwal,
      nilaiBelanjaLra: finalBelanjaLra,
      pengeluaranSaldoAwal: finalPengeluaranSaldoAwal,
      pengeluaranBelanja: finalPengeluaranBelanja,
      hibahMasuk: finalHibahMasuk,
      hibahKeluar: finalHibahKeluar,
      nilaiMasuk: finalMasuk,
      nilaiKeluar: finalKeluar,
      sisaNilai: finalSisa,
      rincianItems: finalItems,
      tipePajak: (matchedExisting?.tipePajak || 'Tanpa Pajak') as TaxType,
      nilaiPajak: 0,
      totalBersih: nominalUtama,
      status: matchedExisting?.status || 'Menunggu Verifikasi',
      buktiFotoUrl: matchedExisting?.buktiFotoUrl,
      catatan: matchedExisting?.catatan,
      createdAt: matchedExisting ? matchedExisting.createdAt : new Date().toISOString(),
    };
  };

  const triggerSilentAutoSave = (
    mode: 'persediaan' | 'pemeliharaan',
    targetQuarter: Triwulan,
    items: RincianRekeningItem[]
  ) => {
    if (!onAutoSave) return;
    isLocalUpdatingRef.current = true;
    const built = buildExpenseObject(mode, targetQuarter, items);
    setTimeout(() => {
      onAutoSave(built);
      setTimeout(() => {
        isLocalUpdatingRef.current = false;
      }, 50);
    }, 0);
  };

  const rincianItems: RincianRekeningItem[] =
    inputMode === 'pemeliharaan'
      ? pemeliharaanItems
      : persediaanItemsByQuarter[triwulan] || [];

  const setRincianItems = (
    updater:
      | RincianRekeningItem[]
      | ((prev: RincianRekeningItem[]) => RincianRekeningItem[])
  ) => {
    if (inputMode === 'pemeliharaan') {
      setPemeliharaanItems((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        triggerSilentAutoSave('pemeliharaan', triwulan, next);
        return next;
      });
    } else {
      setPersediaanItemsByQuarter((prev) => {
        const currentList = prev[triwulan] || [];
        const nextList = typeof updater === 'function' ? updater(currentList) : updater;
        triggerSilentAutoSave('persediaan', triwulan, nextList);
        return {
          ...prev,
          [triwulan]: nextList,
        };
      });
    }
  };

  const [errors, setErrors] = useState<Record<string, string>>({});

  // State & Handlers untuk Tombol Upload Dokumen Excel (Belanja Persediaan)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importModalData, setImportModalData] = useState<{
    items: RincianRekeningItem[];
    fileName: string;
    sheetName: string;
    totalFound: number;
  } | null>(null);
  const [importModeChoice, setImportModeChoice] = useState<'replace' | 'merge'>('replace');
  const [importNotification, setImportNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isParsingExcel, setIsParsingExcel] = useState<boolean>(false);

  const handleTriggerUploadExcel = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingExcel(true);
    setImportNotification(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const result = parsePersediaanExcel(buffer);

        if (result.error || result.items.length === 0) {
          setImportNotification({
            type: 'error',
            message: result.error || 'Tidak ditemukan data rincian persediaan yang valid di dalam file.',
          });
          setIsParsingExcel(false);
          return;
        }

        setImportModalData({
          items: result.items,
          fileName: file.name,
          sheetName: result.sheetName,
          totalFound: result.totalRowsFound,
        });
        setImportModeChoice(rincianItems.length > 0 ? 'replace' : 'replace');
        setIsParsingExcel(false);
      } catch (err: any) {
        setImportNotification({
          type: 'error',
          message: `Gagal membaca file: ${err?.message || 'Format tidak valid'}`,
        });
        setIsParsingExcel(false);
      }
    };

    reader.onerror = () => {
      setImportNotification({
        type: 'error',
        message: 'Gagal membuka file dokumen.',
      });
      setIsParsingExcel(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const handleSumberDanaChange = (newSource: BOSSource) => {
    setSumberDana(newSource);
    const hibahActive = newSource === 'HIBAH';
    setIsHibah(hibahActive);

    // Otomatis sinkronisasi baris rincian belanja persediaan jika sumber dana HIBAH dipilih
    if (hibahActive) {
      setRincianItems((prev) =>
        prev.map((it) => {
          const totalIn =
            (it.nilaiSaldoAwal || 0) + (it.nilaiBelanjaLra || 0) + (it.hibahMasuk || 0);
          const totalOut =
            (it.pengeluaranSaldoAwal || 0) +
            (it.pengeluaranBelanja || 0) +
            (it.hibahKeluar || 0);
          return {
            ...it,
            isHibah: true,
            nilaiSaldoAwal: 0,
            nilaiBelanjaLra: 0,
            pengeluaranSaldoAwal: 0,
            pengeluaranBelanja: 0,
            hibahMasuk: totalIn,
            hibahKeluar: totalOut,
            nilaiMasuk: totalIn,
            nilaiKeluar: totalOut,
            sisaNilai: totalIn - totalOut,
          };
        })
      );
    } else {
      // Jika dialihkan kembali dari HIBAH ke non-HIBAH (misal APBD / BOS)
      setRincianItems((prev) =>
        prev.map((it) => {
          if (!it.isHibah) return it;
          const totalIn = (it.hibahMasuk || 0) + (it.nilaiBelanjaLra || 0);
          const totalOut = (it.hibahKeluar || 0) + (it.pengeluaranBelanja || 0);
          return {
            ...it,
            isHibah: false,
            saldoAwal: it.saldoAwalMasuk || 'Bukan Saldo Awal',
            saldoAwalMasuk: it.saldoAwalMasuk || 'Bukan Saldo Awal',
            saldoAwalKeluar: it.saldoAwalKeluar || 'Bukan Saldo Awal',
            nilaiSaldoAwal: 0,
            nilaiBelanjaLra: totalIn,
            pengeluaranSaldoAwal: 0,
            pengeluaranBelanja: totalOut,
            hibahMasuk: 0,
            hibahKeluar: 0,
            nilaiMasuk: totalIn,
            nilaiKeluar: totalOut,
            sisaNilai: totalIn - totalOut,
          };
        })
      );
    }
  };

  const handleConfirmImport = () => {
    if (!importModalData) return;

    const itemsToImport = (importModalData.items || []).map((it) => {
      if (sumberDana === 'HIBAH') {
        const totalIn = (it.nilaiSaldoAwal || 0) + (it.nilaiBelanjaLra || 0) + (it.hibahMasuk || 0);
        const totalOut = (it.pengeluaranSaldoAwal || 0) + (it.pengeluaranBelanja || 0) + (it.hibahKeluar || 0);
        return {
          ...it,
          isHibah: true,
          nilaiSaldoAwal: 0,
          nilaiBelanjaLra: 0,
          pengeluaranSaldoAwal: 0,
          pengeluaranBelanja: 0,
          hibahMasuk: totalIn,
          hibahKeluar: totalOut,
          nilaiMasuk: totalIn,
          nilaiKeluar: totalOut,
          sisaNilai: totalIn - totalOut,
        };
      }
      return it;
    });

    if (importModeChoice === 'replace') {
      setRincianItems(itemsToImport);
    } else {
      let merged = [...rincianItems];
      for (const it of itemsToImport) {
        merged = mergeRincianItemIntoList(merged, it);
      }
      setRincianItems(merged);
    }

    setImportNotification({
      type: 'success',
      message: `Berhasil mengimpor ${importModalData.items.length} rincian persediaan dari file "${importModalData.fileName}".`,
    });
    setImportModalData(null);
  };

  const handleDownloadTemplate = () => {
    downloadPersediaanExcelTemplate();
  };

  // Totals for each column in the table
  const totalSaldoAwal = rincianItems.reduce((sum, item) => sum + (item.nilaiSaldoAwal || 0), 0);
  const totalBelanjaLra = rincianItems.reduce((sum, item) => sum + (item.nilaiBelanjaLra || 0), 0);
  const totalPengakuanBast = rincianItems.reduce(
    (sum, item) => sum + (item.nilaiPengakuanBast || 0),
    0
  );
  const totalPengeluaranSaldoAwal = rincianItems.reduce(
    (sum, item) => sum + (item.pengeluaranSaldoAwal || 0),
    0
  );
  const totalPengeluaranBelanja = rincianItems.reduce(
    (sum, item) => sum + (item.pengeluaranBelanja || 0),
    0
  );
  const totalPengeluaranBast = rincianItems.reduce(
    (sum, item) => sum + (item.pengeluaranBast || 0),
    0
  );
  const totalHibahMasuk = rincianItems.reduce((sum, item) => sum + (item.hibahMasuk || 0), 0);
  const totalHibahKeluar = rincianItems.reduce((sum, item) => sum + (item.hibahKeluar || 0), 0);
  const totalSisa =
    totalSaldoAwal +
    totalBelanjaLra +
    totalPengakuanBast +
    totalHibahMasuk -
    (totalPengeluaranSaldoAwal +
      totalPengeluaranBelanja +
      totalPengeluaranBast +
      totalHibahKeluar);

  const totalJasaPemeliharaan = rincianItems.reduce(
    (sum, item) => sum + (item.nilaiJasa ?? 0),
    0
  );
  const totalBarangPemeliharaan = rincianItems.reduce(
    (sum, item) => sum + (item.nilaiBarang ?? 0),
    0
  );

  // Auto-generate receipt number internally if quarter changes
  const handleQuarterChange = (newQ: Triwulan) => {
    setTriwulan(newQ);
    if (!existingExpense) {
      setNoBukti(generateNextReceiptNumber(allExpenses, newQ, schoolInfo.tahunAnggaran));
    }
  };

  const buildNewRincianItem = (): RincianRekeningItem => {
    const masukNominal = belanjaMasuk || 0;
    const keluarNominal = belanjaKeluar || 0;

    const hibahActive = sumberDana === 'HIBAH' || isHibah;

    const nilaiSaldoAwal = !hibahActive && saldoAwalMasuk === 'Saldo Awal' ? masukNominal : 0;
    const nilaiBelanjaLra = !hibahActive && saldoAwalMasuk === 'Bukan Saldo Awal' ? masukNominal : 0;
    const pengeluaranSaldoAwal = !hibahActive && saldoAwalKeluar === 'Saldo Awal' ? keluarNominal : 0;
    const pengeluaranBelanja =
      !hibahActive && saldoAwalKeluar === 'Bukan Saldo Awal' ? keluarNominal : 0;
    const hibahMasuk = hibahActive ? masukNominal : 0;
    const hibahKeluar = hibahActive ? keluarNominal : 0;

    const totalMasukItem = nilaiSaldoAwal + nilaiBelanjaLra + hibahMasuk;
    const totalKeluarItem = pengeluaranSaldoAwal + pengeluaranBelanja + hibahKeluar;

    return {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kodeRekening,
      saldoAwal: saldoAwalMasuk,
      saldoAwalMasuk,
      saldoAwalKeluar,
      isHibah: hibahActive,
      nilaiSaldoAwal,
      nilaiBelanjaLra,
      pengeluaranSaldoAwal,
      pengeluaranBelanja,
      hibahMasuk,
      hibahKeluar,
      nilaiMasuk: totalMasukItem,
      nilaiKeluar: totalKeluarItem,
      sisaNilai: totalMasukItem - totalKeluarItem,
    };
  };

  // Handler Tombol Tambah di Menu Nomor 4
  const handleAddRincianItem = () => {
    if (belanjaMasuk <= 0 && belanjaKeluar <= 0) {
      setErrors((prev) => ({
        ...prev,
        nilaiBelanja: 'Masukkan nominal Belanja Masuk atau Belanja Keluar terlebih dahulu',
      }));
      return;
    }

    const newItem = buildNewRincianItem();

    setRincianItems((prev) => mergeRincianItemIntoList(prev, newItem));
    setBelanjaMasuk(0);
    setBelanjaKeluar(0);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.nilaiBelanja;
      return next;
    });
  };

  const handleRemoveRincianItem = (id: string) => {
    setRincianItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Sample presets for quick testing with Rekening Belanja Persediaan
  const handleApplyPreset = (presetType: 'atk' | 'kertas' | 'listrik' | 'mamin') => {
    let selectedRekening: KodeRekening = 'Alat/Bahan untuk Kegiatan Kantor- Alat Tulis Kantor';
    let masuk = 0;
    let keluar = 0;
    let jenisMasuk: JenisSaldoAwal = 'Bukan Saldo Awal';
    let jenisKeluar: JenisSaldoAwal = 'Bukan Saldo Awal';
    let hibah = false;

    if (presetType === 'atk') {
      selectedRekening = 'Alat/Bahan untuk Kegiatan Kantor- Alat Tulis Kantor';
      masuk = 1000000;
      keluar = 660000;
      jenisMasuk = 'Bukan Saldo Awal';
      jenisKeluar = 'Bukan Saldo Awal';
    } else if (presetType === 'kertas') {
      selectedRekening = 'Alat/Bahan untuk Kegiatan Kantor- Kertas dan Cover';
      masuk = 2000000;
      keluar = 1500000;
      jenisMasuk = 'Saldo Awal';
      jenisKeluar = 'Saldo Awal';
    } else if (presetType === 'listrik') {
      selectedRekening = 'Alat/Bahan untuk Kegiatan Kantor- Alat Listrik';
      masuk = 1500000;
      keluar = 1250000;
      jenisMasuk = 'Bukan Saldo Awal';
      jenisKeluar = 'Bukan Saldo Awal';
    } else if (presetType === 'mamin') {
      selectedRekening = 'Makanan dan Minuman Rapat';
      masuk = 4000000;
      keluar = 3400000;
      jenisMasuk = 'Bukan Saldo Awal';
      jenisKeluar = 'Bukan Saldo Awal';
      hibah = false;
    }

    setKodeRekening(selectedRekening);
    setSaldoAwalMasuk(jenisMasuk);
    setSaldoAwalKeluar(jenisKeluar);
    setIsHibah(hibah);
    setBelanjaMasuk(masuk);
    setBelanjaKeluar(keluar);
  };

  const buildNewPemeliharaanItem = (): RincianRekeningItem => {
    const jasaNominal = nominalJasaPemeliharaan || 0;
    const barangNominal = nominalBarangPemeliharaan || 0;
    const tglItem = tanggalPemeliharaan.trim();

    // Nilai Belanja LRA untuk Rekening Belanja Pemeliharaan = Total Nilai Jasa + Barang
    // Nilai Pengakuan BAST & BAST Diluar Belanja = Total Nilai Barang
    const totalJasaTambahBarang = jasaNominal + barangNominal;
    const nilaiBelanjaLra = totalJasaTambahBarang;
    const nilaiPengakuanBast = barangNominal;
    const pengeluaranBelanja = totalJasaTambahBarang;
    const pengeluaranBast = barangNominal;

    const totalMasukItem = totalJasaTambahBarang;
    const totalKeluarItem = totalJasaTambahBarang;

    return {
      id: `item-pem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tanggalPemeliharaan: tglItem,
      kodeRekening: kodeRekeningPemeliharaan,
      jenisPemeliharaan: jenisPemeliharaan.trim() || kodeRekeningPemeliharaan,
      nilaiJasa: jasaNominal,
      nilaiBarang: barangNominal,
      saldoAwal: 'Bukan Saldo Awal',
      saldoAwalMasuk: 'Bukan Saldo Awal',
      saldoAwalKeluar: 'Bukan Saldo Awal',
      isHibah: false,
      nilaiSaldoAwal: 0,
      nilaiBelanjaLra,
      nilaiPengakuanBast,
      pengeluaranSaldoAwal: 0,
      pengeluaranBelanja,
      pengeluaranBast,
      hibahMasuk: 0,
      hibahKeluar: 0,
      nilaiMasuk: totalMasukItem,
      nilaiKeluar: totalKeluarItem,
      sisaNilai: totalMasukItem - totalKeluarItem,
      keteranganPemeliharaan: keteranganPemeliharaan.trim() || undefined,
    };
  };

  const handleAddPemeliharaanItem = () => {
    if (!jenisPemeliharaan.trim() && nominalJasaPemeliharaan <= 0 && nominalBarangPemeliharaan <= 0) {
      setErrors((prev) => ({
        ...prev,
        nilaiBelanja: 'Masukkan Jenis Pemeliharaan terlebih dahulu',
      }));
      return;
    }

    const hasExistingDate = rincianItems.some(
      (it) => it.tanggalPemeliharaan && it.tanggalPemeliharaan.trim()
    );
    if (!hasExistingDate && !tanggalPemeliharaan.trim()) {
      setErrors((prev) => ({
        ...prev,
        nilaiBelanja:
          'Masukkan Tanggal pada baris pertama pemeliharaan untuk menentukan Triwulan (TW) secara otomatis',
      }));
      return;
    }

    const newItem = buildNewPemeliharaanItem();
    setRincianItems((prev) => [...prev, newItem]);
    setTanggalPemeliharaan('');
    setJenisPemeliharaan('');
    setNominalJasaPemeliharaan(0);
    setNominalBarangPemeliharaan(0);
    setKeteranganPemeliharaan('');
    setErrors((prev) => {
      const next = { ...prev };
      delete next.nilaiBelanja;
      return next;
    });
  };

  const handleApplyPemeliharaanPreset = (
    preset: 'suku_cadang_contoh' | 'kendaraan' | 'komputer' | 'pendingin' | 'gedung' | 'bbm'
  ) => {
    if (preset === 'suku_cadang_contoh') {
      const rek = 'Belanja Pemeliharaan Suku Cadang Lainya';
      setKodeRekeningPemeliharaan(rek);
      const sampleRows: Array<{
        tgl: string;
        jenis: string;
        jasa: number;
        barang: number;
        ket?: string;
      }> = [
        { tgl: '2026-02-10', jenis: 'Belanja Service Laptop dan Printer', jasa: 0, barang: 0 },
        { tgl: '', jenis: 'fleksibel head & timing belt printer', jasa: 0, barang: 250000 },
        { tgl: '', jenis: 'Hardisk laptop', jasa: 0, barang: 450000 },
        { tgl: '2026-05-19', jenis: 'Belanja Service Laptop', jasa: 50000, barang: 0 },
        { tgl: '', jenis: 'roler kertas', jasa: 0, barang: 100000 },
        { tgl: '', jenis: 'Timing belt', jasa: 0, barang: 85000 },
        { tgl: '', jenis: 'Flexsibel head', jasa: 0, barang: 75000 },
        { tgl: '', jenis: 'SSD Laptop', jasa: 0, barang: 450000 },
      ];
      const built: RincianRekeningItem[] = sampleRows.map((r, idx) => {
        const totalRow = r.jasa + r.barang;
        return {
          id: `item-pem-sample-${Date.now()}-${idx}`,
          tanggalPemeliharaan: r.tgl,
          kodeRekening: rek,
          jenisPemeliharaan: r.jenis,
          nilaiJasa: r.jasa,
          nilaiBarang: r.barang,
          saldoAwal: 'Bukan Saldo Awal',
          saldoAwalMasuk: 'Bukan Saldo Awal',
          saldoAwalKeluar: 'Bukan Saldo Awal',
          isHibah: false,
          nilaiSaldoAwal: 0,
          nilaiBelanjaLra: totalRow,
          nilaiPengakuanBast: r.barang,
          pengeluaranSaldoAwal: 0,
          pengeluaranBelanja: totalRow,
          pengeluaranBast: r.barang,
          hibahMasuk: 0,
          hibahKeluar: 0,
          nilaiMasuk: totalRow,
          nilaiKeluar: totalRow,
          sisaNilai: 0,
          keteranganPemeliharaan: r.ket,
        };
      });
      setRincianItems(built);
      setTanggalPemeliharaan('');
      setJenisPemeliharaan('');
      setNominalJasaPemeliharaan(0);
      setNominalBarangPemeliharaan(0);
      setKeteranganPemeliharaan('');
      return;
    }

    setTanggalPemeliharaan(tanggal);
    if (preset === 'kendaraan') {
      setKodeRekeningPemeliharaan(
        'Belanja Pemeliharaan Alat Angkutan-Alat Angkutan Darat Bermotor-Kendaraan Dinas Bermotor Perorangan'
      );
      setJenisPemeliharaan('Pemeliharaan Kendaraan Dinas Operasional');
      setNominalJasaPemeliharaan(1000000);
      setNominalBarangPemeliharaan(1500000);
      setKeteranganPemeliharaan('DOKUMEN PEMELIHARAAN PRINT');
    } else if (preset === 'komputer') {
      setKodeRekeningPemeliharaan(
        'Belanja Pemeliharaan Komputer-Komputer Unit-Personal Computer'
      );
      setJenisPemeliharaan('Pemeliharaan Personal Computer / Laptop');
      setNominalJasaPemeliharaan(500000);
      setNominalBarangPemeliharaan(1000000);
      setKeteranganPemeliharaan('Servis & Suku Cadang PC');
    } else if (preset === 'pendingin') {
      setKodeRekeningPemeliharaan(
        'Belanja Pemeliharaan Alat Kantor dan Rumah Tangga-Alat Rumah Tangga-Alat Pendingin'
      );
      setJenisPemeliharaan('Pemeliharaan AC / Alat Pendingin Ruangan');
      setNominalJasaPemeliharaan(450000);
      setNominalBarangPemeliharaan(750000);
      setKeteranganPemeliharaan('Pemeliharaan AC Kantor');
    } else if (preset === 'gedung') {
      setKodeRekeningPemeliharaan(
        'Belanja Pemeliharaan Bangunan Gedung-Bangunan Gedung Tempat Kerja-Bangunan Gedung Kantor'
      );
      setJenisPemeliharaan('Pemeliharaan Bangunan Gedung Kantor');
      setNominalJasaPemeliharaan(2000000);
      setNominalBarangPemeliharaan(3000000);
      setKeteranganPemeliharaan('Pemeliharaan Gedung Kantor');
    } else if (preset === 'bbm') {
      setKodeRekeningPemeliharaan('Belanja Bahan-Bahan Bakar dan Pelumas');
      setJenisPemeliharaan('Belanja Bahan Bakar & Pelumas');
      setNominalJasaPemeliharaan(0);
      setNominalBarangPemeliharaan(1800000);
      setKeteranganPemeliharaan('BBM & Pelumas Operasional');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (inputMode === 'persediaan' && !tanggal) {
      newErrors.tanggal = 'Tanggal transaksi wajib diisi';
    }

    // Jika ada input nominal yang belum diklik Tambah, otomatis gabungkan ke daftar
    let finalItems = [...rincianItems];
    if (inputMode === 'pemeliharaan') {
      if (jenisPemeliharaan.trim() || nominalJasaPemeliharaan > 0 || nominalBarangPemeliharaan > 0) {
        finalItems = [...finalItems, buildNewPemeliharaanItem()];
        setRincianItems(finalItems);
        setJenisPemeliharaan('');
        setNominalJasaPemeliharaan(0);
        setNominalBarangPemeliharaan(0);
      }
    } else {
      if (belanjaMasuk > 0 || belanjaKeluar > 0) {
        finalItems = mergeRincianItemIntoList(finalItems, buildNewRincianItem());
        setRincianItems(finalItems);
        setBelanjaMasuk(0);
        setBelanjaKeluar(0);
      }
    }

    if (finalItems.length === 0) {
      newErrors.nilaiBelanja =
        inputMode === 'pemeliharaan'
          ? 'Silakan isi Tanggal, Jenis Pemeliharaan, Jasa / Barang, dan Keterangan lalu klik tombol Tambah terlebih dahulu'
          : 'Silakan isi Belanja Masuk / Belanja Keluar lalu klik tombol Tambah terlebih dahulu';
    } else if (inputMode === 'pemeliharaan') {
      const hasAnyDate =
        finalItems.some((it) => it.tanggalPemeliharaan && it.tanggalPemeliharaan.trim()) ||
        Boolean(tanggalPemeliharaan.trim());
      if (!hasAnyDate) {
        newErrors.nilaiBelanja =
          'Silakan isi Tanggal pada Nilai Masuk & Keluar Pemeliharaan agar sistem dapat menentukan Triwulan (TW) secara otomatis';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const newExpense = buildExpenseObject(inputMode, triwulan, finalItems);
    onSave(newExpense);
  };

  const formatCellNominal = (val?: number) => {
    if (!val || val === 0) return '';
    return formatRupiah(val);
  };

  const formatNominalPemeliharaan = (val?: number) => {
    if (!val || val === 0) return '';
    return new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  const formatTanggalTabelPemeliharaan = (dateStr?: string) => {
    if (!dateStr || !dateStr.trim()) return '';
    const trimmed = dateStr.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split('-');
      return `${d}/${m}/${y}`;
    }
    return trimmed;
  };

  const groupedPemeliharaanItems = React.useMemo(() => {
    const groups: { kodeRekening: string; items: RincianRekeningItem[] }[] = [];
    for (const item of rincianItems) {
      const key = item.kodeRekening || kodeRekeningPemeliharaan;
      let existing = groups.find((g) => g.kodeRekening === key);
      if (!existing) {
        existing = { kodeRekening: key, items: [] };
        groups.push(existing);
      }
      existing.items.push(item);
    }
    return groups;
  }, [rincianItems, kodeRekeningPemeliharaan]);

  return (
    <div className="max-w-5xl mx-auto pb-12 space-y-4">
      {/* Top Mode Switcher Bar: Input Belanja Persediaan vs Tombol Input Pemeliharaan */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              inputMode === 'pemeliharaan'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {inputMode === 'pemeliharaan' ? (
              <Wrench className="w-5 h-5" />
            ) : (
              <Package className="w-5 h-5" />
            )}
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">
              {inputMode === 'pemeliharaan'
                ? 'Mode: Penginputan Belanja Pemeliharaan'
                : 'Mode: Penginputan Belanja Persediaan'}
            </h3>
            <p className="text-[11px] text-slate-500">
              Pilih jenis penginputan belanja yang ingin dicatat ke dalam laporan rekonsiliasi.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setInputMode('persediaan')}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              inputMode === 'persediaan'
                ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/20'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Input Belanja Persediaan</span>
          </button>

          <button
            type="button"
            onClick={() => setInputMode('pemeliharaan')}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              inputMode === 'pemeliharaan'
                ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-500/30'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>Input Pemeliharaan</span>
          </button>
        </div>
      </div>

      {/* Form Container */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Form Header */}
        <div
          className={`bg-gradient-to-r text-white p-5 sm:p-6 flex items-center justify-between ${
            inputMode === 'pemeliharaan'
              ? 'from-amber-950 via-slate-900 to-slate-800'
              : 'from-slate-900 to-slate-800'
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded text-xs font-bold border ${
                  inputMode === 'pemeliharaan'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                }`}
              >
                {existingExpense
                  ? 'EDIT DATA BELANJA'
                  : inputMode === 'pemeliharaan'
                  ? 'FORM INPUT BELANJA PEMELIHARAAN'
                  : 'FORM INPUT BELANJA BARU'}
              </span>
              <span className="text-xs text-slate-400 font-mono">AppSheet View</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold mt-1 text-white">
              {existingExpense
                ? 'Ubah Data Transaksi Belanja'
                : inputMode === 'pemeliharaan'
                ? 'Penginputan Belanja Pemeliharaan'
                : 'Penginputan Belanja Persediaan'}
            </h2>
            <p className="text-xs text-slate-300">
              {schoolInfo.namaSekolah} • Tahun Anggaran {schoolInfo.tahunAnggaran}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onOpenDatabaseSpreadsheet && (
              <button
                type="button"
                onClick={onOpenDatabaseSpreadsheet}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 transition-all cursor-pointer shadow-xs active:scale-95"
                title="Buka / Unduh Database Spreadsheet Master 5 Sheet"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Database Spreadsheet</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                const nextMode = inputMode === 'pemeliharaan' ? 'persediaan' : 'pemeliharaan';
                setInputMode(nextMode);
              }}
              className={`hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
                inputMode === 'pemeliharaan'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>
                {inputMode === 'pemeliharaan'
                  ? 'Ke Input Persediaan'
                  : 'Input Pemeliharaan'}
              </span>
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-all"
              aria-label="Tutup form"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Sample Presets bar for fast testing */}
        {inputMode === 'persediaan' ? (
          <div className="bg-emerald-50/70 border-b border-emerald-100 p-3 sm:px-6 flex items-center justify-between gap-2 overflow-x-auto">
            <span className="text-xs font-semibold text-emerald-950 flex items-center gap-1.5 shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Contoh Cepat Persediaan:
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handleApplyPreset('atk')}
                className="text-[11px] px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-900 font-medium rounded border border-emerald-200 transition-all shadow-xs"
              >
                Alat Tulis Kantor (ATK)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('kertas')}
                className="text-[11px] px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-900 font-medium rounded border border-emerald-200 transition-all shadow-xs"
              >
                Kertas & Cover (Saldo Awal)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('listrik')}
                className="text-[11px] px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-900 font-medium rounded border border-emerald-200 transition-all shadow-xs"
              >
                Alat Listrik
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('mamin')}
                className="text-[11px] px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-900 font-medium rounded border border-emerald-200 transition-all shadow-xs"
              >
                Makanan & Minuman Rapat
              </button>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 pl-2 border-l border-emerald-200">
              <button
                type="button"
                onClick={handleTriggerUploadExcel}
                disabled={isParsingExcel}
                className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                title="Upload dokumen Excel (.xlsx, .xls, .csv) ke tabel persediaan"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{isParsingExcel ? 'Memproses...' : 'Upload Dokumen'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-emerald-50/70 border-b border-emerald-100 p-3 sm:px-6 flex items-center justify-between gap-2 overflow-x-auto">
            <span className="text-xs font-semibold text-emerald-950 flex items-center gap-1.5 shrink-0">
              <Wrench className="w-3.5 h-3.5 text-emerald-600" />
              Contoh Cepat Pemeliharaan:
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handleApplyPemeliharaanPreset('suku_cadang_contoh')}
                className="text-[11px] px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded border border-emerald-700 transition-all shadow-xs"
              >
                Contoh Suku Cadang Lainya (Sesuai Gambar)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPemeliharaanPreset('kendaraan')}
                className="text-[11px] px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-900 font-medium rounded border border-emerald-200 transition-all shadow-xs"
              >
                Pemeliharaan Kendaraan Dinas
              </button>
              <button
                type="button"
                onClick={() => handleApplyPemeliharaanPreset('komputer')}
                className="text-[11px] px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-900 font-medium rounded border border-emerald-200 transition-all shadow-xs"
              >
                Pemeliharaan Komputer / PC
              </button>
              <button
                type="button"
                onClick={() => handleApplyPemeliharaanPreset('pendingin')}
                className="text-[11px] px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-900 font-medium rounded border border-emerald-200 transition-all shadow-xs"
              >
                Pemeliharaan AC / Pendingin
              </button>
              <button
                type="button"
                onClick={() => handleApplyPemeliharaanPreset('gedung')}
                className="text-[11px] px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-900 font-medium rounded border border-emerald-200 transition-all shadow-xs"
              >
                Pemeliharaan Gedung Kantor
              </button>
              <button
                type="button"
                onClick={() => handleApplyPemeliharaanPreset('bbm')}
                className="text-[11px] px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-900 font-medium rounded border border-emerald-200 transition-all shadow-xs"
              >
                Bahan Bakar & Pelumas
              </button>
            </div>
          </div>
        )}

        {/* Form Body */}
        <div className="p-5 sm:p-6 space-y-6">
          {inputMode === 'persediaan' ? (
            <>
              {/* Section 1: Triwulan & Sumber Dana (Hanya untuk Belanja Persediaan) */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  1. Periode Triwulan & Sumber Dana
                </h3>

                {/* Triwulan Radio Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Pilih Triwulan Belanja <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(['TW1', 'TW2', 'TW3', 'TW4'] as Triwulan[]).map((q) => {
                      const isSelected = triwulan === q;
                      return (
                        <button
                          key={q}
                          type="button"
                          onClick={() => handleQuarterChange(q)}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'border-emerald-600 bg-emerald-50/80 ring-2 ring-emerald-500/20'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                          aria-pressed={isSelected}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-extrabold ${isSelected ? 'text-emerald-800' : 'text-slate-800'}`}>
                              {q}
                            </span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                          </div>
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            {q === 'TW1' && 'Jan - Mar'}
                            {q === 'TW2' && 'Apr - Jun'}
                            {q === 'TW3' && 'Jul - Sep'}
                            {q === 'TW4' && 'Okt - Des'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sumber Dana & Tanggal Transaksi */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Sumber Dana <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={sumberDana}
                      onChange={(e) => handleSumberDanaChange(e.target.value as BOSSource)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                    >
                      {BOS_SOURCE_OPTIONS.map((src) => (
                        <option key={src} value={src}>
                          {src}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tanggal Transaksi <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={tanggal}
                      onChange={(e) => setTanggal(e.target.value)}
                      className={`w-full bg-slate-50 border rounded-lg p-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                        errors.tanggal ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
                      }`}
                    />
                    {errors.tanggal && <p className="text-[10px] text-rose-600 mt-0.5">{errors.tanggal}</p>}
                  </div>
                </div>
              </div>

              {/* Section 2: Kode Rekening Belanja Persediaan */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  2. Kode Rekening Belanja
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kode Rekening Belanja Persediaan ({REKENING_OPTIONS.length} Rekening) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={kodeRekening}
                    onChange={(e) => setKodeRekening(e.target.value as KodeRekening)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {REKENING_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Section 4: Nilai Masuk & Keluar Belanja */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Calculator className="w-4 h-4 text-emerald-600" />
                    4. Nilai Masuk & Keluar Belanja
                  </h3>

                  {/* Centang box HIBAH disembunyikan sesuai permintaan; fungsi digantikan oleh Sumber Dana "HIBAH" */}
                  {(sumberDana === 'HIBAH' || isHibah) && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-xs font-bold shadow-2xs">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                      Sumber Dana: HIBAH
                    </span>
                  )}
                </div>

                {/* 2 Pasang Input: (Combo Box Saldo Awal Masuk + Belanja Masuk) & (Combo Box Saldo Awal Keluar + Belanja Keluar) + Tombol Tambah */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                  {/* Kelompok Belanja Masuk */}
                  <div className="md:col-span-5 space-y-2.5 p-3 bg-white rounded-lg border border-slate-200 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800">
                        Belanja Masuk
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500">
                        {isHibah
                          ? 'Masuk ke Kolom HIBAH (MASUK)'
                          : saldoAwalMasuk === 'Saldo Awal'
                          ? 'Masuk ke Kolom SALDO AWAL'
                          : 'Masuk ke Kolom BELANJA LRA'}
                      </span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Kategori Saldo Awal (Belanja Masuk)
                      </label>
                      <select
                        value={saldoAwalMasuk}
                        onChange={(e) => setSaldoAwalMasuk(e.target.value as JenisSaldoAwal)}
                        disabled={isHibah}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                      >
                        <option value="Saldo Awal">Saldo Awal</option>
                        <option value="Bukan Saldo Awal">Bukan Saldo Awal</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Nominal Belanja Masuk (Rp)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={belanjaMasuk || ''}
                        onChange={(e) => setBelanjaMasuk(parseFloat(e.target.value) || 0)}
                        placeholder="Masukkan nominal uang masuk"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Kelompok Belanja Keluar */}
                  <div className="md:col-span-5 space-y-2.5 p-3 bg-white rounded-lg border border-slate-200 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-800">
                        Belanja Keluar
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500">
                        {isHibah
                          ? 'Masuk ke Kolom HIBAH (KELUAR)'
                          : saldoAwalKeluar === 'Saldo Awal'
                          ? 'Masuk ke PENGELUARAN (SALDO AWAL)'
                          : 'Masuk ke PENGELUARAN (BELANJA)'}
                      </span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Kategori Saldo Awal (Belanja Keluar)
                      </label>
                      <select
                        value={saldoAwalKeluar}
                        onChange={(e) => setSaldoAwalKeluar(e.target.value as JenisSaldoAwal)}
                        disabled={isHibah}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                      >
                        <option value="Saldo Awal">Saldo Awal</option>
                        <option value="Bukan Saldo Awal">Bukan Saldo Awal</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Nominal Belanja Keluar (Rp)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={belanjaKeluar || ''}
                        onChange={(e) => setBelanjaKeluar(parseFloat(e.target.value) || 0)}
                        placeholder="Masukkan nominal uang keluar"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Tombol Tambah */}
                  <div className="md:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddRincianItem}
                      className="w-full flex items-center justify-center gap-1.5 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Tambah</span>
                    </button>
                  </div>
                </div>

                {errors.nilaiBelanja && (
                  <p className="text-[11px] text-rose-600 font-medium">{errors.nilaiBelanja}</p>
                )}

                {/* Banner Notifikasi Import Dokumen Excel */}
                {importNotification && (
                  <div
                    className={`mt-3 p-3 rounded-xl border flex items-center justify-between gap-3 animate-fadeIn ${
                      importNotification.type === 'success'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-xs'
                        : 'bg-rose-50 border-rose-300 text-rose-950 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs">
                      {importNotification.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      <span className="font-semibold">{importNotification.message}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setImportNotification(null)}
                      className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-black/5 transition-colors cursor-pointer"
                      aria-label="Tutup notifikasi"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Toolbar Tabel: Tombol Upload Dokumen & Template Excel */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5 bg-slate-50/90 border border-slate-200 rounded-xl p-3 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      Tabel Rincian Belanja Persediaan
                    </span>
                    <span className="px-2 py-0.5 text-[11px] font-extrabold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                      {rincianItems.length} Baris
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadTemplate}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-all shadow-2xs cursor-pointer active:scale-95"
                      title="Unduh contoh template file Excel (.xlsx) untuk diisi"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-500" />
                      <span>Template Excel</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleTriggerUploadExcel}
                      disabled={isParsingExcel}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs transition-all active:scale-95 cursor-pointer ring-1 ring-emerald-500/30 disabled:opacity-50"
                      title="Upload dokumen file Excel (.xlsx, .xls, .csv) untuk mengimpor rincian belanja langsung ke tabel"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isParsingExcel ? 'Memproses...' : 'Upload Dokumen'}</span>
                    </button>
                  </div>
                </div>

                {/* Tabel Model Persediaan Sesuai Gambar Referensi */}
                <div className="mt-2 overflow-x-auto bg-white border border-slate-800 shadow-xs">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-white text-slate-900 font-serif text-[11px] font-bold uppercase tracking-tight">
                        <th
                          rowSpan={2}
                          className="border border-slate-800 py-3 px-3 text-center align-middle min-w-[240px]"
                        >
                          JENIS PERSEDIAAN
                        </th>
                        <th
                          rowSpan={2}
                          className="border border-slate-800 py-3 px-2 text-center align-middle min-w-[120px] leading-tight"
                        >
                          SALDO AWAL
                          <br />
                          PER 1 JANUARI
                          <br />
                          2026
                        </th>
                        <th
                          rowSpan={2}
                          className="border border-slate-800 py-3 px-2 text-center align-middle min-w-[110px]"
                        >
                          BELANJA LRA
                        </th>
                        <th
                          colSpan={2}
                          className="border border-slate-800 py-1.5 px-2 text-center align-middle"
                        >
                          PENGELUARAN
                        </th>
                        <th
                          colSpan={2}
                          className="border border-slate-800 py-1.5 px-2 text-center align-middle"
                        >
                          HIBAH
                        </th>
                        <th
                          rowSpan={2}
                          className="border border-slate-800 py-3 px-2 text-center align-middle min-w-[100px] leading-tight"
                        >
                          SALDO
                          <br />
                          AKHIR
                        </th>
                        <th
                          rowSpan={2}
                          className="border border-slate-800 py-3 px-2 text-center align-middle w-10"
                        >
                          AKSI
                        </th>
                      </tr>
                      <tr className="bg-white text-slate-900 font-serif text-[11px] font-bold uppercase tracking-tight">
                        <th className="border border-slate-800 py-2 px-2 text-center align-middle min-w-[95px] leading-tight">
                          SALDO
                          <br />
                          AWAL
                        </th>
                        <th className="border border-slate-800 py-2 px-2 text-center align-middle min-w-[110px]">
                          BELANJA
                        </th>
                        <th className="border border-slate-800 py-2 px-2 text-center align-middle min-w-[85px]">
                          MASUK
                        </th>
                        <th className="border border-slate-800 py-2 px-2 text-center align-middle min-w-[85px]">
                          KELUAR
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white text-slate-900">
                      {rincianItems.length === 0 ? (
                        <tr>
                          <td
                            colSpan={9}
                            className="border border-slate-800 py-6 px-4 text-center text-slate-400 italic"
                          >
                            Belum ada rincian persediaan. Pilih Kode Rekening, atur kategori Saldo Awal / HIBAH, isi nominal Belanja Masuk atau Keluar, lalu klik tombol <strong>Tambah</strong>.
                          </td>
                        </tr>
                      ) : (
                        rincianItems.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                            <td className="border border-slate-800 py-2 px-2.5 text-left font-normal text-slate-900">
                              {item.kodeRekening}
                            </td>
                            <td className="border border-slate-800 py-2 px-2.5 text-right whitespace-nowrap">
                              {formatCellNominal(item.nilaiSaldoAwal)}
                            </td>
                            <td className="border border-slate-800 py-2 px-2.5 text-right whitespace-nowrap">
                              {formatCellNominal(item.nilaiBelanjaLra)}
                            </td>
                            <td className="border border-slate-800 py-2 px-2.5 text-right whitespace-nowrap">
                              {formatCellNominal(item.pengeluaranSaldoAwal)}
                            </td>
                            <td className="border border-slate-800 py-2 px-2.5 text-right whitespace-nowrap">
                              {formatCellNominal(item.pengeluaranBelanja)}
                            </td>
                            <td className="border border-slate-800 py-2 px-2.5 text-right whitespace-nowrap">
                              {formatCellNominal(item.hibahMasuk)}
                            </td>
                            <td className="border border-slate-800 py-2 px-2.5 text-right whitespace-nowrap">
                              {formatCellNominal(item.hibahKeluar)}
                            </td>
                            <td className="border border-slate-800 py-2 px-2.5 text-right font-semibold whitespace-nowrap">
                              {item.sisaNilai && item.sisaNilai !== 0
                                ? formatRupiah(item.sisaNilai)
                                : '-'}
                            </td>
                            <td className="border border-slate-800 py-2 px-1.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveRincianItem(item.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                title="Hapus baris"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {rincianItems.length > 0 && (
                      <tfoot>
                        <tr className="bg-slate-100 font-bold text-slate-900">
                          <td className="border border-slate-800 py-2 px-2.5 text-left uppercase text-[11px]">
                            JUMLAH TOTAL
                          </td>
                          <td className="border border-slate-800 py-2 px-2.5 text-right whitespace-nowrap">
                            {totalSaldoAwal > 0 ? formatRupiah(totalSaldoAwal) : '-'}
                          </td>
                          <td className="border border-slate-800 py-2 px-2.5 text-right whitespace-nowrap">
                            {totalBelanjaLra > 0 ? formatRupiah(totalBelanjaLra) : '-'}
                          </td>
                          <td className="border border-slate-800 py-2 px-2.5 text-right whitespace-nowrap">
                            {totalPengeluaranSaldoAwal > 0
                              ? formatRupiah(totalPengeluaranSaldoAwal)
                              : '-'}
                          </td>
                          <td className="border border-slate-800 py-2 px-2.5 text-right whitespace-nowrap">
                            {totalPengeluaranBelanja > 0
                              ? formatRupiah(totalPengeluaranBelanja)
                              : '-'}
                          </td>
                          <td className="border border-slate-800 py-2 px-2.5 text-right whitespace-nowrap">
                            {totalHibahMasuk > 0 ? formatRupiah(totalHibahMasuk) : '-'}
                          </td>
                          <td className="border border-slate-800 py-2 px-2.5 text-right whitespace-nowrap">
                            {totalHibahKeluar > 0 ? formatRupiah(totalHibahKeluar) : '-'}
                          </td>
                          <td className="border border-slate-800 py-2 px-2.5 text-right whitespace-nowrap">
                            {totalSisa !== 0 ? formatRupiah(totalSisa) : '-'}
                          </td>
                          <td className="border border-slate-800"></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {/* Tombol Cetak di Bawah Tabel */}
                <div className="mt-3 flex items-center justify-end print:hidden">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Cetak</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* TAMPILAN PENGINPUTAN BELANJA PEMELIHARAAN */}
              {/* Section 1: Kode Rekening Belanja Pemeliharaan (Terpisah dari Jenis Pemeliharaan) */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  Kode Rekening Belanja
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kode Rekening Belanja Pemeliharaan ({REKENING_PEMELIHARAAN_OPTIONS.length} Rekening) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={kodeRekeningPemeliharaan}
                    onChange={(e) => setKodeRekeningPemeliharaan(e.target.value as KodeRekening)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {REKENING_PEMELIHARAAN_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Nilai Masuk & Keluar Belanja (Khusus Pemeliharaan) */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Calculator className="w-4 h-4 text-emerald-600" />
                    Nilai Masuk & Keluar Belanja (Input Pemeliharaan)
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                      TW Otomatis Sesuai Tanggal Input
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                      Mode Input Pemeliharaan
                    </span>
                  </div>
                </div>

                {/* Form Input Pemeliharaan: 1. Tanggal, 2. Jenis Pemeliharaan (Ketik Manual), 3. Jasa, 4. Barang, 5. Keterangan + Tombol Tambah */}
                <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    {/* 1. Kolom Tanggal (Menentukan masuk di TW berapa) */}
                    <div className="md:col-span-3">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                          1. Tanggal
                        </label>
                        <div className="flex items-center gap-1.5">
                          {tanggalPemeliharaan ? (
                            <>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                {getTriwulanFromDate(tanggalPemeliharaan).replace('TW', 'TW ')}
                              </span>
                              <button
                                type="button"
                                onClick={() => setTanggalPemeliharaan('')}
                                className="text-[10px] text-rose-600 hover:underline font-semibold"
                                title="Kosongkan tanggal untuk baris sub-item"
                              >
                                Kosongkan
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-medium">
                              Sub-item (Ikut Tanggal Atas)
                            </span>
                          )}
                        </div>
                      </div>
                      <input
                        type="date"
                        value={tanggalPemeliharaan}
                        onChange={(e) => setTanggalPemeliharaan(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    {/* 2. Kolom Jenis Pemeliharaan (Dapat Diketik Manual) */}
                    <div className="md:col-span-9">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                        2. Jenis Pemeliharaan <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={jenisPemeliharaan}
                        onChange={(e) => setJenisPemeliharaan(e.target.value)}
                        placeholder="Ketik manual jenis pemeliharaan (contoh: Belanja Service Laptop dan Printer / Hardisk laptop / SSD Laptop)..."
                        className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    {/* 3. Kolom Jasa */}
                    <div className="md:col-span-3">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                        3. Jasa (Rp)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={nominalJasaPemeliharaan || ''}
                        onChange={(e) => setNominalJasaPemeliharaan(parseFloat(e.target.value) || 0)}
                        placeholder="Nominal Jasa (Rp)"
                        className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    {/* 4. Kolom Barang */}
                    <div className="md:col-span-3">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                        4. Barang (Rp)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={nominalBarangPemeliharaan || ''}
                        onChange={(e) => setNominalBarangPemeliharaan(parseFloat(e.target.value) || 0)}
                        placeholder="Nominal Barang (Rp)"
                        className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    {/* 5. Kolom Keterangan */}
                    <div className="md:col-span-4">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                        5. Keterangan
                      </label>
                      <input
                        type="text"
                        value={keteranganPemeliharaan}
                        onChange={(e) => setKeteranganPemeliharaan(e.target.value)}
                        placeholder="Masukkan keterangan pemeliharaan..."
                        className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    {/* Tombol Tambah */}
                    <div className="md:col-span-2">
                      <button
                        type="button"
                        onClick={handleAddPemeliharaanItem}
                        className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Tambah</span>
                      </button>
                    </div>
                  </div>
                </div>

                {errors.nilaiBelanja && (
                  <p className="text-[11px] text-rose-600 font-medium">{errors.nilaiBelanja}</p>
                )}

                {/* Tabel Hasil Penginputan Pemeliharaan Sesuai Gambar Referensi */}
                <div className="mt-4 overflow-x-auto bg-white border border-slate-900 shadow-xs">
                  <table className="w-full border-collapse text-xs font-sans">
                    <tbody className="bg-white text-slate-950">
                      {/* Header Kolom Utama */}
                      <tr className="bg-white text-slate-950 text-xs font-bold uppercase">
                        <th className="border border-slate-900 py-3 px-2.5 text-center align-middle w-28">
                          TANGGAL
                        </th>
                        <th className="border border-slate-900 py-3 px-3 text-center align-middle min-w-[260px]">
                          JENIS PEMELIHARAAN
                        </th>
                        <th className="border border-slate-900 py-3 px-2.5 text-center align-middle w-44">
                          JASA
                        </th>
                        <th className="border border-slate-900 py-3 px-2.5 text-center align-middle w-44">
                          BARANG
                        </th>
                        <th className="border border-slate-900 py-3 px-3 text-center align-middle min-w-[140px]">
                          KETERANGAN
                        </th>
                        <th className="border border-slate-900 py-3 px-2 text-center align-middle w-10 print:hidden">
                          AKSI
                        </th>
                      </tr>

                      {groupedPemeliharaanItems.length === 0 ? (
                        <>
                          {/* Baris Hijau Nama Rekening Belanja Pemeliharaan */}
                          <tr className="bg-[#e2efda]">
                            <td
                              colSpan={5}
                              className="border border-slate-900 py-1 px-2 text-left font-bold text-slate-950 bg-[#e2efda]"
                            >
                              {kodeRekeningPemeliharaan}
                            </td>
                            <td className="border border-slate-900 bg-[#e2efda] print:hidden"></td>
                          </tr>
                          {/* Baris Kosong Pemisah */}
                          <tr className="h-5">
                            <td className="border border-slate-900 py-0.5 px-2">&nbsp;</td>
                            <td className="border border-slate-900 py-0.5 px-2">&nbsp;</td>
                            <td className="border border-slate-900 py-0.5 px-2">&nbsp;</td>
                            <td className="border border-slate-900 py-0.5 px-2">&nbsp;</td>
                            <td className="border border-slate-900 py-0.5 px-2">&nbsp;</td>
                            <td className="border border-slate-900 py-0.5 px-1.5 print:hidden">&nbsp;</td>
                          </tr>
                          <tr>
                            <td
                              colSpan={6}
                              className="border border-slate-900 py-5 px-4 text-center text-slate-400 italic"
                            >
                              Belum ada rincian pemeliharaan. Ketik <strong>Jenis Pemeliharaan</strong>, isi <strong>Tanggal</strong> (opsional untuk sub-item), <strong>Jasa</strong>, <strong>Barang</strong>, dan <strong>Keterangan</strong>, lalu klik tombol <strong>Tambah</strong>.
                            </td>
                          </tr>
                          {/* Baris Kosong Pemisah Sebelum JUMLAH */}
                          <tr className="h-5">
                            <td className="border border-slate-900 py-0.5 px-2">&nbsp;</td>
                            <td className="border border-slate-900 py-0.5 px-2">&nbsp;</td>
                            <td className="border border-slate-900 py-0.5 px-2">&nbsp;</td>
                            <td className="border border-slate-900 py-0.5 px-2">&nbsp;</td>
                            <td className="border border-slate-900 py-0.5 px-2">&nbsp;</td>
                            <td className="border border-slate-900 py-0.5 px-1.5 print:hidden">&nbsp;</td>
                          </tr>
                          {/* Baris JUMLAH */}
                          <tr className="bg-white font-bold text-slate-950">
                            <td
                              colSpan={2}
                              className="border border-slate-900 py-1 px-2 text-center uppercase"
                            >
                              JUMLAH
                            </td>
                            <td className="border border-slate-900 py-1 px-2 text-right whitespace-nowrap">
                              {formatNominalPemeliharaan(0)}
                            </td>
                            <td className="border border-slate-900 py-1 px-2 text-right whitespace-nowrap">
                              {formatNominalPemeliharaan(0)}
                            </td>
                            <td className="border border-slate-900 py-1 px-2"></td>
                            <td className="border border-slate-900 py-1 px-1.5 print:hidden"></td>
                          </tr>
                          {/* Baris TOTAL (Hijau Muda #e2efda sesuai gambar) */}
                          <tr className="font-bold text-slate-950">
                            <td className="border border-slate-900 py-1 px-2 bg-white"></td>
                            <td className="border border-slate-900 py-1 px-2 text-right uppercase bg-[#e2efda]">
                              TOTAL
                            </td>
                            <td
                              colSpan={2}
                              className="border border-slate-900 py-1 px-2 text-center whitespace-nowrap bg-[#e2efda]"
                            >
                              {formatNominalPemeliharaan(0)}
                            </td>
                            <td className="border border-slate-900 py-1 px-2 bg-white"></td>
                            <td className="border border-slate-900 py-1 px-1.5 bg-white print:hidden"></td>
                          </tr>
                        </>
                      ) : (
                        <>
                          {groupedPemeliharaanItems.map((group, gIdx) => {
                            const groupTotalJasa = group.items.reduce(
                              (sum, it) => sum + (it.nilaiJasa ?? 0),
                              0
                            );
                            const groupTotalBarang = group.items.reduce(
                              (sum, it) => sum + (it.nilaiBarang ?? 0),
                              0
                            );
                            const groupTotalAll = groupTotalJasa + groupTotalBarang;

                            return (
                              <React.Fragment key={`pem-group-${gIdx}`}>
                                {/* Baris Hijau Nama Rekening Belanja Pemeliharaan */}
                                <tr className="bg-[#e2efda]">
                                  <td
                                    colSpan={5}
                                    className="border border-slate-900 py-1 px-2 text-left font-bold text-slate-950 bg-[#e2efda]"
                                  >
                                    {group.kodeRekening}
                                  </td>
                                  <td className="border border-slate-900 bg-[#e2efda] print:hidden"></td>
                                </tr>

                                {/* Baris Kosong Pemisah Di Bawah Nama Rekening */}
                                <tr className="h-5">
                                  <td className="border border-slate-900 py-0.5 px-2">&nbsp;</td>
                                  <td className="border border-slate-900 py-0.5 px-2">&nbsp;</td>
                                  <td className="border border-slate-900 py-0.5 px-2">&nbsp;</td>
                                  <td className="border border-slate-900 py-0.5 px-2">&nbsp;</td>
                                  <td className="border border-slate-900 py-0.5 px-2">&nbsp;</td>
                                  <td className="border border-slate-900 py-0.5 px-1.5 print:hidden">&nbsp;</td>
                                </tr>

                                {/* Daftar Item Rincian Pemeliharaan */}
                                {group.items.map((item) => {
                                  const nilaiJasaRow = item.nilaiJasa ?? 0;
                                  const nilaiBarangRow = item.nilaiBarang ?? 0;
                                  return (
                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                      <td className="border border-slate-900 py-1 px-2 text-center whitespace-nowrap text-slate-950">
                                        {formatTanggalTabelPemeliharaan(item.tanggalPemeliharaan)}
                                      </td>
                                      <td className="border border-slate-900 py-1 px-2 text-left text-slate-950">
                                        {item.jenisPemeliharaan || item.kodeRekening}
                                      </td>
                                      <td className="border border-slate-900 py-1 px-2 text-right whitespace-nowrap text-slate-950">
                                        {formatNominalPemeliharaan(nilaiJasaRow)}
                                      </td>
                                      <td className="border border-slate-900 py-1 px-2 text-right whitespace-nowrap text-slate-950">
                                        {formatNominalPemeliharaan(nilaiBarangRow)}
                                      </td>
                                      <td className="border border-slate-900 py-1 px-2 text-left text-slate-950">
                                        {item.keteranganPemeliharaan || ''}
                                      </td>
                                      <td className="border border-slate-900 py-1 px-1.5 text-center print:hidden">
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveRincianItem(item.id)}
                                          className="p-0.5 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                          title="Hapus baris"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}

                                {/* Baris Kosong Pemisah Sebelum JUMLAH per Rekening */}
                                <tr className="h-5">
                                  <td className="border border-slate-900 py-0.5 px-2">&nbsp;</td>
                                  <td className="border border-slate-900 py-0.5 px-2">&nbsp;</td>
                                  <td className="border border-slate-900 py-0.5 px-2">&nbsp;</td>
                                  <td className="border border-slate-900 py-0.5 px-2">&nbsp;</td>
                                  <td className="border border-slate-900 py-0.5 px-2">&nbsp;</td>
                                  <td className="border border-slate-900 py-0.5 px-1.5 print:hidden">&nbsp;</td>
                                </tr>

                                {/* Baris JUMLAH per Rekening Belanja Pemeliharaan */}
                                <tr className="bg-white font-bold text-slate-950">
                                  <td
                                    colSpan={2}
                                    className="border border-slate-900 py-1 px-2 text-center uppercase"
                                  >
                                    JUMLAH
                                  </td>
                                  <td className="border border-slate-900 py-1 px-2 text-right whitespace-nowrap">
                                    {formatNominalPemeliharaan(groupTotalJasa)}
                                  </td>
                                  <td className="border border-slate-900 py-1 px-2 text-right whitespace-nowrap">
                                    {formatNominalPemeliharaan(groupTotalBarang)}
                                  </td>
                                  <td className="border border-slate-900 py-1 px-2"></td>
                                  <td className="border border-slate-900 py-1 px-1.5 print:hidden"></td>
                                </tr>

                                {/* Baris TOTAL per Rekening Belanja Pemeliharaan (Hijau Muda #e2efda sesuai gambar) */}
                                <tr className="font-bold text-slate-950">
                                  <td className="border border-slate-900 py-1 px-2 bg-white"></td>
                                  <td className="border border-slate-900 py-1 px-2 text-right uppercase bg-[#e2efda]">
                                    TOTAL
                                  </td>
                                  <td
                                    colSpan={2}
                                    className="border border-slate-900 py-1 px-2 text-center whitespace-nowrap bg-[#e2efda]"
                                  >
                                    {formatNominalPemeliharaan(groupTotalAll)}
                                  </td>
                                  <td className="border border-slate-900 py-1 px-2 bg-white"></td>
                                  <td className="border border-slate-900 py-1 px-1.5 bg-white print:hidden"></td>
                                </tr>

                                {/* Baris Kosong Pemisah Antar Rekening Belanja Pemeliharaan */}
                                {gIdx < groupedPemeliharaanItems.length - 1 && (
                                  <tr className="h-5">
                                    <td className="border border-slate-900 py-0.5 px-2">&nbsp;</td>
                                    <td className="border border-slate-900 py-0.5 px-2">&nbsp;</td>
                                    <td className="border border-slate-900 py-0.5 px-2">&nbsp;</td>
                                    <td className="border border-slate-900 py-0.5 px-2">&nbsp;</td>
                                    <td className="border border-slate-900 py-0.5 px-2">&nbsp;</td>
                                    <td className="border border-slate-900 py-0.5 px-1.5 print:hidden">&nbsp;</td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}

                          {/* Jika terdapat lebih dari 1 Rekening Belanja Pemeliharaan, tampilkan juga Total Keseluruhan di paling bawah */}
                          {groupedPemeliharaanItems.length > 1 && (
                            <>
                              <tr className="h-5">
                                <td className="border border-slate-900 py-0.5 px-2">&nbsp;</td>
                                <td className="border border-slate-900 py-0.5 px-2">&nbsp;</td>
                                <td className="border border-slate-900 py-0.5 px-2">&nbsp;</td>
                                <td className="border border-slate-900 py-0.5 px-2">&nbsp;</td>
                                <td className="border border-slate-900 py-0.5 px-2">&nbsp;</td>
                                <td className="border border-slate-900 py-0.5 px-1.5 print:hidden">&nbsp;</td>
                              </tr>
                              <tr className="bg-slate-100 font-bold text-slate-950">
                                <td
                                  colSpan={2}
                                  className="border border-slate-900 py-1 px-2 text-center uppercase"
                                >
                                  JUMLAH SELURUH REKENING
                                </td>
                                <td className="border border-slate-900 py-1 px-2 text-right whitespace-nowrap">
                                  {formatNominalPemeliharaan(totalJasaPemeliharaan)}
                                </td>
                                <td className="border border-slate-900 py-1 px-2 text-right whitespace-nowrap">
                                  {formatNominalPemeliharaan(totalBarangPemeliharaan)}
                                </td>
                                <td className="border border-slate-900 py-1 px-2"></td>
                                <td className="border border-slate-900 py-1 px-1.5 print:hidden"></td>
                              </tr>
                              <tr className="font-bold text-slate-950">
                                <td className="border border-slate-900 py-1 px-2 bg-white"></td>
                                <td className="border border-slate-900 py-1 px-2 text-right uppercase bg-[#c6e0b4]">
                                  TOTAL KESELURUHAN
                                </td>
                                <td
                                  colSpan={2}
                                  className="border border-slate-900 py-1 px-2 text-center whitespace-nowrap bg-[#c6e0b4]"
                                >
                                  {formatNominalPemeliharaan(
                                    totalJasaPemeliharaan + totalBarangPemeliharaan
                                  )}
                                </td>
                                <td className="border border-slate-900 py-1 px-2 bg-white"></td>
                                <td className="border border-slate-900 py-1 px-1.5 bg-white print:hidden"></td>
                              </tr>
                            </>
                          )}
                        </>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Tombol Cetak di Bawah Tabel */}
                <div className="mt-3 flex items-center justify-end print:hidden">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Cetak</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Form Footer Buttons */}
        <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 transition-all"
          >
            Batal
          </button>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow transition-all active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>
                {existingExpense
                  ? 'Simpan Perubahan'
                  : inputMode === 'pemeliharaan'
                  ? 'Simpan Belanja Pemeliharaan (Save)'
                  : 'Simpan Belanja (Save)'}
              </span>
            </button>
          </div>
        </div>
        {/* Hidden File Input for Excel Import */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx, .xls, .csv"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Modal Konfirmasi Import Dokumen Excel */}
        {importModalData && (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
            role="dialog"
            aria-modal="true"
          >
            <div
              className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 animate-scaleUp"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-600 rounded-lg">
                    <FileSpreadsheet className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white uppercase tracking-wide">
                      Konfirmasi Import Dokumen Excel
                    </h4>
                    <p className="text-xs text-slate-300">
                      File: <span className="font-semibold text-emerald-400">{importModalData.fileName}</span> (Sheet: {importModalData.sheetName})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setImportModalData(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                  aria-label="Tutup modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-xs font-semibold text-emerald-950">
                      Ditemukan <strong className="text-emerald-800">{importModalData.totalFound} baris data persediaan</strong> siap diimpor ke tabel.
                    </span>
                  </div>
                </div>

                {/* Import Mode Selection if table already has items */}
                {rincianItems.length > 0 && (
                  <div className="space-y-2 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Metode Import ke Tabel:
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer hover:border-emerald-400 transition-colors">
                        <input
                          type="radio"
                          name="importMode"
                          value="replace"
                          checked={importModeChoice === 'replace'}
                          onChange={() => setImportModeChoice('replace')}
                          className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-900">
                            Ganti Seluruh Rincian di Tabel (Rekomendasi)
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Hapus {rincianItems.length} baris yang saat ini ada di tabel dan ganti dengan {importModalData.items.length} baris dari file Excel ini.
                          </p>
                        </div>
                      </label>

                      <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer hover:border-emerald-400 transition-colors">
                        <input
                          type="radio"
                          name="importMode"
                          value="merge"
                          checked={importModeChoice === 'merge'}
                          onChange={() => setImportModeChoice('merge')}
                          className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-900">
                            Gabungkan / Tambahkan ke Tabel Saat Ini
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Jika rekening sudah ada di tabel, nominalnya akan dijumlahkan. Rekening baru akan ditambahkan sebagai baris baru.
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {/* Preview Table of Imported Items */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Pratinjau Data Dokumen ({importModalData.items.length} Baris):
                    </span>
                  </div>
                  <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-56">
                    <table className="w-full text-[11px] border-collapse">
                      <thead className="bg-slate-100 text-slate-800 font-bold sticky top-0">
                        <tr>
                          <th className="py-2 px-2 text-center w-8 border-b">No</th>
                          <th className="py-2 px-2 text-left border-b min-w-[200px]">Jenis Persediaan</th>
                          <th className="py-2 px-2 text-right border-b">Saldo Awal</th>
                          <th className="py-2 px-2 text-right border-b">Belanja LRA</th>
                          <th className="py-2 px-2 text-right border-b">Pengeluaran</th>
                          <th className="py-2 px-2 text-right border-b">Saldo Akhir</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {importModalData.items.map((it, idx) => (
                          <tr key={it.id} className="hover:bg-slate-50/70">
                            <td className="py-1.5 px-2 text-center text-slate-500">{idx + 1}</td>
                            <td className="py-1.5 px-2 text-left font-medium text-slate-900">
                              {it.kodeRekening}
                            </td>
                            <td className="py-1.5 px-2 text-right whitespace-nowrap">
                              {it.nilaiSaldoAwal ? formatRupiah(it.nilaiSaldoAwal) : '-'}
                            </td>
                            <td className="py-1.5 px-2 text-right whitespace-nowrap">
                              {it.nilaiBelanjaLra ? formatRupiah(it.nilaiBelanjaLra) : '-'}
                            </td>
                            <td className="py-1.5 px-2 text-right whitespace-nowrap">
                              {(it.pengeluaranBelanja || 0) + (it.pengeluaranSaldoAwal || 0) > 0
                                ? formatRupiah((it.pengeluaranSaldoAwal || 0) + (it.pengeluaranBelanja || 0))
                                : '-'}
                            </td>
                            <td className="py-1.5 px-2 text-right font-bold whitespace-nowrap text-emerald-800">
                              {it.sisaNilai !== 0 ? formatRupiah(it.sisaNilai) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 bg-slate-50 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setImportModalData(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Impor ke Tabel ({importModalData.items.length} Baris)</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};
