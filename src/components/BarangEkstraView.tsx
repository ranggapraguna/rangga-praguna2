import React, { useState, useMemo, useRef, useEffect } from 'react';
import { PackagePlus, Plus, Trash2, Edit3, CheckCircle, Clock, ShieldCheck, AlertCircle, Search, X, FileSpreadsheet } from 'lucide-react';
import { BarangEkstraItem, SchoolInfo } from '../types';
import { formatRupiah } from '../utils/budgetCalculations';

interface BarangEkstraViewProps {
  items: BarangEkstraItem[];
  schoolInfo: SchoolInfo;
  isAdmin: boolean;
  onSaveItem: (item: BarangEkstraItem) => void;
  onDeleteItem: (id: string) => void;
  onUpdateStatus: (id: string, status: BarangEkstraItem['status']) => void;
  onOpenDatabaseSpreadsheet?: () => void;
}

export const BarangEkstraView: React.FC<BarangEkstraViewProps> = ({
  items,
  schoolInfo,
  isAdmin,
  onSaveItem,
  onDeleteItem,
  onUpdateStatus,
  onOpenDatabaseSpreadsheet,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTargetItem, setDeleteTargetItem] = useState<BarangEkstraItem | null>(null);

  // Filter & Search state
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved'>('all');
  const [tahunFilter, setTahunFilter] = useState<string>('all');
  const [uptFilter, setUptFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>();
    items.forEach(i => {
      if (i.tahunAnggaran) yearsSet.add(String(i.tahunAnggaran));
    });
    yearsSet.add(String(schoolInfo.tahunAnggaran));
    return Array.from(yearsSet).sort().reverse();
  }, [items, schoolInfo.tahunAnggaran]);

  const availableUptList = useMemo(() => {
    const setUpt = new Set<string>(['DINAS PENDIDIKAN']);
    items.forEach(i => {
      const name =
        i.schoolName === 'DINAS PENDIDIKAN KAB. MINAHASA TENGGARA' ||
        i.schoolName === 'DINAS PENDIDIKAN KABUPATEN MINAHASA TENGGARA' ||
        (i.schoolName && i.schoolName.toUpperCase().startsWith('DINAS PENDIDIKAN'))
          ? 'DINAS PENDIDIKAN'
          : i.schoolName;
      if (name) setUpt.add(name);
    });
    return Array.from(setUpt).sort((a, b) => {
      if (a === 'DINAS PENDIDIKAN') return -1;
      if (b === 'DINAS PENDIDIKAN') return 1;
      return a.localeCompare(b);
    });
  }, [items]);

  const [uptDropdownOpen, setUptDropdownOpen] = useState(false);
  const [uptSearchTerm, setUptSearchTerm] = useState('');
  const uptDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (uptDropdownRef.current && !uptDropdownRef.current.contains(e.target as Node)) {
        setUptDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredUptOptions = useMemo(() => {
    if (!uptSearchTerm.trim()) return availableUptList;
    const q = uptSearchTerm.toLowerCase();
    return availableUptList.filter(u => u.toLowerCase().includes(q));
  }, [availableUptList, uptSearchTerm]);

  const [namaBarang, setNamaBarang] = useState('');
  const [spesifikasi, setSpesifikasi] = useState('');
  const [volume, setVolume] = useState<number>(1);
  const [satuan, setSatuan] = useState('Unit');
  const [hargaSatuan, setHargaSatuan] = useState<number>(0);
  const [kondisi, setKondisi] = useState<'Baik' | 'Kurang Baik' | 'Rusak Berat'>('Baik');
  const [sumberPerolehan, setSumberPerolehan] = useState('BOS Reguler');
  const [tanggalPerolehan, setTanggalPerolehan] = useState(new Date().toISOString().slice(0, 10));
  const [keterangan, setKeterangan] = useState('');

  const handleOpenAdd = () => {
    setEditingId(null);
    setNamaBarang('');
    setSpesifikasi('');
    setVolume(1);
    setSatuan('Unit');
    setHargaSatuan(0);
    setKondisi('Baik');
    setSumberPerolehan('BOS Reguler');
    setTanggalPerolehan(new Date().toISOString().slice(0, 10));
    setKeterangan('');
    setShowForm(true);
  };

  const handleOpenEdit = (item: BarangEkstraItem) => {
    if (!isAdmin && item.status === 'Disetujui Kepala Sekolah') {
      alert('Item yang sudah disetujui oleh Admin tidak dapat diubah oleh Operator BOS.');
      return;
    }
    setEditingId(item.id);
    setNamaBarang(item.namaBarang);
    setSpesifikasi(item.spesifikasi || '');
    setVolume(item.volume);
    setSatuan(item.satuan);
    setHargaSatuan(item.hargaSatuan);
    setKondisi(item.kondisi);
    setSumberPerolehan(item.sumberPerolehan);
    setTanggalPerolehan(item.tanggalPerolehan);
    setKeterangan(item.keterangan || '');
    setShowForm(true);
  };

  const handleDeleteClick = (item: BarangEkstraItem) => {
    if (!isAdmin && item.status === 'Disetujui Kepala Sekolah') {
      alert('Item yang sudah disetujui oleh Admin tidak dapat dihapus oleh Operator BOS.');
      return;
    }
    setDeleteTargetItem(item);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaBarang.trim()) return;

    const totalHarga = Number(volume) * Number(hargaSatuan);
    const newItem: BarangEkstraItem = {
      id: editingId || `be-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      tahunAnggaran: schoolInfo.tahunAnggaran,
      schoolName: schoolInfo.namaSekolah,
      npsn: schoolInfo.npsn,
      namaBarang: namaBarang.trim(),
      spesifikasi: spesifikasi.trim(),
      volume: Number(volume) || 1,
      satuan: satuan.trim() || 'Unit',
      hargaSatuan: Number(hargaSatuan) || 0,
      totalHarga,
      kondisi,
      sumberPerolehan,
      tanggalPerolehan,
      keterangan: keterangan.trim(),
      status: isAdmin ? 'Disetujui Kepala Sekolah' : 'Menunggu Verifikasi',
      createdAt: new Date().toISOString(),
    };

    onSaveItem(newItem);
    setShowForm(false);
  };

  // Filtered items list
  const filteredItems = useMemo(() => {
    return items
      .map((item) => {
        if (
          item.schoolName === 'DINAS PENDIDIKAN KAB. MINAHASA TENGGARA' ||
          item.schoolName === 'DINAS PENDIDIKAN KABUPATEN MINAHASA TENGGARA' ||
          (item.schoolName && item.schoolName.toUpperCase().startsWith('DINAS PENDIDIKAN'))
        ) {
          return { ...item, schoolName: 'DINAS PENDIDIKAN' };
        }
        return item;
      })
      .filter((item) => {
        if (statusFilter === 'pending' && item.status === 'Disetujui Kepala Sekolah') return false;
        if (statusFilter === 'approved' && item.status !== 'Disetujui Kepala Sekolah') return false;
        if (tahunFilter !== 'all' && String(item.tahunAnggaran) !== tahunFilter) return false;
        if (isAdmin && uptFilter !== 'all' && item.schoolName !== uptFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = item.namaBarang.toLowerCase().includes(q);
          const matchSpec = (item.spesifikasi || '').toLowerCase().includes(q);
          const matchSumber = (item.sumberPerolehan || '').toLowerCase().includes(q);
          const matchSchool = (item.schoolName || '').toLowerCase().includes(q);
          if (!matchName && !matchSpec && !matchSumber && !matchSchool) return false;
        }
        return true;
      });
  }, [items, statusFilter, tahunFilter, uptFilter, searchQuery, isAdmin]);

  // Total Nilai: Hanya barang ekstra yang berstatus Disetujui (Approved)
  const totalApprovedNilai = useMemo(() => {
    return items
      .map((item) => {
        if (
          item.schoolName === 'DINAS PENDIDIKAN KAB. MINAHASA TENGGARA' ||
          item.schoolName === 'DINAS PENDIDIKAN KABUPATEN MINAHASA TENGGARA' ||
          (item.schoolName && item.schoolName.toUpperCase().startsWith('DINAS PENDIDIKAN'))
        ) {
          return { ...item, schoolName: 'DINAS PENDIDIKAN' };
        }
        return item;
      })
      .filter((item) => {
        if (item.status !== 'Disetujui Kepala Sekolah') return false;
        if (tahunFilter !== 'all' && String(item.tahunAnggaran) !== tahunFilter) return false;
        if (isAdmin && uptFilter !== 'all' && item.schoolName !== uptFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = item.namaBarang.toLowerCase().includes(q);
          const matchSpec = (item.spesifikasi || '').toLowerCase().includes(q);
          const matchSumber = (item.sumberPerolehan || '').toLowerCase().includes(q);
          const matchSchool = (item.schoolName || '').toLowerCase().includes(q);
          if (!matchName && !matchSpec && !matchSumber && !matchSchool) return false;
        }
        return true;
      })
      .reduce((acc, i) => acc + (i.totalHarga || 0), 0);
  }, [items, tahunFilter, uptFilter, searchQuery, isAdmin]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-800 via-emerald-900 to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-2 border border-emerald-400/30">
            <PackagePlus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Manajemen Barang Ekstra / Non-Persediaan Standar</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">
            Input &amp; Pendataan Barang Ekstra
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            Kelola inventaris barang ekstra, sumbangan, atau aset pendukung sekolah di luar persediaan rutin BOSP.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {onOpenDatabaseSpreadsheet && (
            <button
              type="button"
              onClick={onOpenDatabaseSpreadsheet}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 font-bold text-xs sm:text-sm rounded-xl shadow transition-all cursor-pointer"
              title="Buka / Unduh Database Spreadsheet Master"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Database Spreadsheet</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Barang Ekstra</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap w-full lg:w-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Semua ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'pending'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            Menunggu Verifikasi ({items.filter(i => i.status !== 'Disetujui Kepala Sekolah').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('approved')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'approved'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            Disetujui / Approved ({items.filter(i => i.status === 'Disetujui Kepala Sekolah').length})
          </button>

          <select
            value={tahunFilter}
            onChange={(e) => setTahunFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="all">Semua Tahun Barang</option>
            {availableYears.map(yr => (
              <option key={yr} value={yr}>Tahun {yr}</option>
            ))}
          </select>

          {/* Filter UPT hanya ditampilkan untuk akun Admin, disembunyikan untuk akun Operator BOSP */}
          {isAdmin && (
            <div className="relative" ref={uptDropdownRef}>
              <button
                type="button"
                onClick={() => setUptDropdownOpen(!uptDropdownOpen)}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 flex items-center gap-2 hover:bg-slate-100 transition-all cursor-pointer min-w-[180px] max-w-[220px] justify-between"
              >
                <span className="truncate">{uptFilter === 'all' ? 'Semua UPT / Sekolah' : uptFilter}</span>
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>

              {uptDropdownOpen && (
                <div className="absolute left-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-3 animate-fadeIn text-xs">
                  <div className="relative mb-2">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={uptSearchTerm}
                      onChange={(e) => setUptSearchTerm(e.target.value)}
                      placeholder="Cari nama UPT / Sekolah..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setUptFilter('all');
                        setUptDropdownOpen(false);
                        setUptSearchTerm('');
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl font-medium transition-all cursor-pointer ${
                        uptFilter === 'all' ? 'bg-emerald-50 text-emerald-800 font-bold' : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      Semua UPT / Sekolah
                    </button>
                    {filteredUptOptions.map((upt) => (
                      <button
                        key={upt}
                        type="button"
                        onClick={() => {
                          setUptFilter(upt);
                          setUptDropdownOpen(false);
                          setUptSearchTerm('');
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl font-medium transition-all cursor-pointer truncate ${
                          uptFilter === upt ? 'bg-emerald-50 text-emerald-800 font-bold' : 'hover:bg-slate-100 text-slate-700'
                        }`}
                        title={upt}
                      >
                        {upt}
                      </button>
                    ))}
                    {filteredUptOptions.length === 0 && (
                      <div className="py-4 text-center text-slate-400 text-xs">
                        Tidak ada UPT yang cocok.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama barang, spesifikasi, sumber..."
            className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-8 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Modal / Form Input */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 border border-slate-200 max-h-[90vh] overflow-y-auto animate-fadeIn">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <PackagePlus className="w-5 h-5 text-emerald-600" />
                <span>{editingId ? 'Edit Barang Ekstra' : 'Form Input Barang Ekstra Baru'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg px-2 py-0.5 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Nama Barang Ekstra *</label>
                  <input
                    type="text"
                    required
                    value={namaBarang}
                    onChange={(e) => setNamaBarang(e.target.value)}
                    placeholder="Contoh: Meja Kerja Kayu Jati / Proyektor Portabel"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Spesifikasi / Merek / Tipe</label>
                  <input
                    type="text"
                    value={spesifikasi}
                    onChange={(e) => setSpesifikasi(e.target.value)}
                    placeholder="Contoh: Epson EB-S41 / Kayu Jati Kelas I"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Volume</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Satuan</label>
                  <input
                    type="text"
                    required
                    value={satuan}
                    onChange={(e) => setSatuan(e.target.value)}
                    placeholder="Unit / Buah / Set / Lembar"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Harga Satuan (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={hargaSatuan}
                    onChange={(e) => setHargaSatuan(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold text-emerald-700"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kondisi Barang</label>
                  <select
                    value={kondisi}
                    onChange={(e) => setKondisi(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-semibold"
                  >
                    <option value="Baik">Baik</option>
                    <option value="Kurang Baik">Kurang Baik</option>
                    <option value="Rusak Berat">Rusak Berat</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Sumber Perolehan</label>
                  <input
                    type="text"
                    value={sumberPerolehan}
                    onChange={(e) => setSumberPerolehan(e.target.value)}
                    placeholder="BOS Reguler / APBD / Hibah Komite / Donasi"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tanggal Perolehan</label>
                  <input
                    type="date"
                    value={tanggalPerolehan}
                    onChange={(e) => setTanggalPerolehan(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Keterangan / Catatan</label>
                  <textarea
                    rows={2}
                    value={keterangan}
                    onChange={(e) => setKeterangan(e.target.value)}
                    placeholder="Catatan tambahan lokasi penyimpanan atau asal usul barang..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow transition-all"
                >
                  Simpan Barang Ekstra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTargetItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4 animate-fadeIn">
            <h3 className="text-base font-black text-slate-900">Konfirmasi Hapus Barang Ekstra</h3>
            <p className="text-xs text-slate-600">
              Apakah Anda yakin ingin menghapus barang ekstra <strong className="text-slate-900">{deleteTargetItem.namaBarang}</strong>? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetItem(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteItem(deleteTargetItem.id);
                  setDeleteTargetItem(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs shadow cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 bg-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold">Daftar Barang Ekstra / Non-Persediaan</h3>
            <p className="text-xs text-slate-300">
              Menampilkan {filteredItems.length} dari {items.length} item • Tahun Anggaran {schoolInfo.tahunAnggaran}
            </p>
          </div>
          <span 
            className="text-xs font-black bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-lg border border-emerald-400/30"
            title="Hanya mengakumulasi nilai barang ekstra yang sudah disetujui (Approved)"
          >
            Total Nilai: {formatRupiah(totalApprovedNilai)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[11px]">
              <tr>
                <th className="py-3 px-3.5">No</th>
                <th className="py-3 px-3.5">Nama &amp; Spesifikasi Barang</th>
                <th className="py-3 px-3.5 text-center">Volume</th>
                <th className="py-3 px-3.5 text-right">Harga Satuan</th>
                <th className="py-3 px-3.5 text-right">Total Harga</th>
                <th className="py-3 px-3.5 text-center">Kondisi</th>
                <th className="py-3 px-3.5">Nama UPT / Sekolah</th>
                <th className="py-3 px-3.5">Sumber / Tgl</th>
                <th className="py-3 px-3.5 text-center">Status</th>
                <th className="py-3 px-3.5 text-center">Aksi (Approve, Edit, Hapus)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <AlertCircle className="w-8 h-8 text-slate-300" />
                      <p className="font-semibold text-slate-600">Tidak ada data Barang Ekstra yang cocok dengan filter.</p>
                      <p className="text-[11px] text-slate-400">Coba ubah kriteria filter atau klik "Tambah Barang Ekstra".</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
                  const isApproved = item.status === 'Disetujui Kepala Sekolah';
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3.5 font-bold text-slate-600">{idx + 1}</td>
                      <td className="py-3 px-3.5">
                        <span className="font-bold text-slate-900 block">{item.namaBarang}</span>
                        {item.spesifikasi && (
                          <span className="text-[11px] text-slate-500 block">{item.spesifikasi}</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-center font-semibold text-slate-800">
                        {item.volume} {item.satuan}
                      </td>
                      <td className="py-3 px-3.5 text-right font-semibold text-slate-700">
                        {formatRupiah(item.hargaSatuan)}
                      </td>
                      <td className="py-3 px-3.5 text-right font-black text-emerald-800">
                        {formatRupiah(item.totalHarga)}
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            item.kondisi === 'Baik'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.kondisi === 'Kurang Baik'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {item.kondisi}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 font-bold text-slate-800 max-w-[160px] truncate" title={item.schoolName}>
                        {item.schoolName || '-'}
                      </td>
                      <td className="py-3 px-3.5 text-slate-600">
                        <span className="block font-semibold">{item.sumberPerolehan}</span>
                        <span className="text-[10px] text-slate-400">{item.tanggalPerolehan}</span>
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        {isApproved ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                            <CheckCircle className="w-3 h-3" />
                            Disetujui
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[11px]">
                            <Clock className="w-3 h-3" />
                            Menunggu
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => onUpdateStatus(item.id, isApproved ? 'Menunggu Verifikasi' : 'Disetujui Kepala Sekolah')}
                              title={isApproved ? 'Batalkan Persetujuan' : 'Approve Barang Ekstra'}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                                isApproved
                                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                              }`}
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>{isApproved ? 'Unapprove' : 'Approve'}</span>
                            </button>
                          )}
                          {isApproved ? (
                            <button
                              type="button"
                              disabled
                              title="Barang sudah di-approve, tidak dapat di-edit"
                              className="p-1.5 bg-slate-100 text-slate-300 rounded-lg cursor-not-allowed opacity-50"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(item)}
                              title="Edit Barang Ekstra"
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          {isApproved ? (
                            <button
                              type="button"
                              disabled
                              title="Barang sudah di-approve, tidak dapat dihapus"
                              className="p-1.5 bg-slate-100 text-slate-300 rounded-lg cursor-not-allowed opacity-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleDeleteClick(item)}
                              title="Hapus Barang Ekstra"
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-all cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
