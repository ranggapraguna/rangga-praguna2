import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  Save, 
  X, 
  RotateCcw, 
  Download, 
  Check, 
  ShieldCheck,
  Database,
  Loader2
} from 'lucide-react';
import { SchoolInfo, SchoolExpense } from '../types';
import { exportExpensesToCSV } from '../utils/storage';
import { UptSchoolAccount, loadUptSchools, normalizeUptKey } from '../data/schoolData';

interface SchoolSettingsViewProps {
  schoolInfo: SchoolInfo;
  allExpenses: SchoolExpense[];
  masterSchools?: UptSchoolAccount[];
  isAdmin?: boolean;
  onSave: (info: SchoolInfo, previousUptName?: string) => Promise<boolean | void> | void;
  onResetDemoData: () => void;
  onClose: () => void;
  onOpenDatabaseSpreadsheet?: () => void;
}

export const SchoolSettingsView: React.FC<SchoolSettingsViewProps> = ({
  schoolInfo,
  allExpenses,
  masterSchools: propMasterSchools,
  onSave,
  onResetDemoData,
  onClose,
  onOpenDatabaseSpreadsheet,
}) => {
  const schoolsList = useMemo(() => {
    return propMasterSchools && propMasterSchools.length > 0
      ? propMasterSchools
      : loadUptSchools();
  }, [propMasterSchools, schoolInfo]);

  const [originalUptName, setOriginalUptName] = useState<string>(schoolInfo.namaSekolah || '');
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const [formData, setFormData] = useState<SchoolInfo>(() => {
    const norm = normalizeUptKey(schoolInfo.namaSekolah || '');
    const matched = schoolsList.find((s) => normalizeUptKey(s.upt) === norm);
    return {
      ...schoolInfo,
      namaSekolah: matched?.upt || schoolInfo.namaSekolah,
      npsn: matched?.npsn && matched.npsn !== '-' ? matched.npsn : schoolInfo.npsn,
      kecamatan: matched?.kecamatan || schoolInfo.kecamatan,
      kepalaSekolah: matched?.kepalaSekolah || schoolInfo.kepalaSekolah || '',
      nipKepalaSekolah: matched?.nipKepalaSekolah || schoolInfo.nipKepalaSekolah || '',
      bendahara: matched?.bendahara || schoolInfo.bendahara || '',
      nipBendahara: matched?.nipBendahara || schoolInfo.nipBendahara || '',
      bendaharaBarang: matched?.pengurusBarang || schoolInfo.bendaharaBarang || '',
      nipBendaharaBarang: matched?.nipPengurusBarang || schoolInfo.nipBendaharaBarang || '',
    };
  });

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  // Sync formData when schoolInfo or masterSchools finishes loading from Google Spreadsheet (if user hasn't typed yet)
  useEffect(() => {
    if (isDirty) return;
    const norm = normalizeUptKey(schoolInfo.namaSekolah || '');
    const matched = schoolsList.find((s) => normalizeUptKey(s.upt) === norm);
    setOriginalUptName(matched?.upt || schoolInfo.namaSekolah || '');
    setFormData({
      ...schoolInfo,
      namaSekolah: matched?.upt || schoolInfo.namaSekolah,
      npsn: matched?.npsn && matched.npsn !== '-' ? matched.npsn : schoolInfo.npsn,
      kecamatan: matched?.kecamatan || schoolInfo.kecamatan,
      kepalaSekolah: matched?.kepalaSekolah ?? schoolInfo.kepalaSekolah ?? '',
      nipKepalaSekolah: matched?.nipKepalaSekolah ?? schoolInfo.nipKepalaSekolah ?? '',
      bendahara: matched?.bendahara ?? schoolInfo.bendahara ?? '',
      nipBendahara: matched?.nipBendahara ?? schoolInfo.nipBendahara ?? '',
      bendaharaBarang: matched?.pengurusBarang ?? schoolInfo.bendaharaBarang ?? '',
      nipBendaharaBarang: matched?.nipPengurusBarang ?? schoolInfo.nipBendaharaBarang ?? '',
    });
  }, [schoolInfo, schoolsList, isDirty]);

  const handleSelectDatabaseUpt = (uptName: string) => {
    const norm = normalizeUptKey(uptName);
    const matched = schoolsList.find((s) => normalizeUptKey(s.upt) === norm);
    if (!matched) return;
    setOriginalUptName(matched.upt);
    setIsDirty(true);
    setFormData((prev) => ({
      ...prev,
      namaSekolah: matched.upt,
      npsn: matched.npsn && matched.npsn !== '-' ? matched.npsn : prev.npsn,
      kecamatan: matched.kecamatan || prev.kecamatan,
      alamat: matched.kecamatan ? `Kec. ${matched.kecamatan}` : prev.alamat,
      kepalaSekolah: matched.kepalaSekolah || '',
      nipKepalaSekolah: matched.nipKepalaSekolah || '',
      bendahara: matched.bendahara || '',
      nipBendahara: matched.nipBendahara || '',
      bendaharaBarang: matched.pengurusBarang || '',
      nipBendaharaBarang: matched.nipPengurusBarang || '',
    }));
  };

  const updateField = <K extends keyof SchoolInfo>(key: K, value: SchoolInfo[K]) => {
    setIsDirty(true);
    setSavedSuccess(false);
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccess(false);
    try {
      await onSave(formData, originalUptName);
      setOriginalUptName(formData.namaSekolah);
      setIsDirty(false);
      setSavedSuccess(true);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                Data Umum - Profil Sekolah &amp; Pejabat Pengelola
              </h2>
              <p className="text-xs text-slate-300">
                Terhubung langsung 2 arah dengan Database Spreadsheet (Sheet 1_PANEL_ADMIN_UPT &amp; 6_AKUN_APLIKASI)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all"
            aria-label="Tutup pengaturan"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-6">
          {/* Database UPT Selector Banner */}
          <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <label className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-emerald-600" />
                <span>Pilih UPT / Satuan Pendidikan pada Database Spreadsheet:</span>
              </label>
              <p className="text-[11px] text-emerald-800">
                Perubahan yang Anda simpan di bawah ini otomatis memperbarui baris UPT ini di <b>1_PANEL_ADMIN_UPT</b> &amp; <b>6_AKUN_APLIKASI</b>.
              </p>
            </div>
            <select
              value={
                schoolsList.find(
                  (s) => normalizeUptKey(s.upt) === normalizeUptKey(originalUptName || formData.namaSekolah)
                )?.upt || ''
              }
              onChange={(e) => {
                if (e.target.value) handleSelectDatabaseUpt(e.target.value);
              }}
              className="bg-white border border-emerald-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-[240px]"
            >
              <option value="">-- Pilih UPT dari Database ({schoolsList.length} UPT) --</option>
              {schoolsList.map((s) => (
                <option key={s.id || s.upt} value={s.upt}>
                  {s.upt} ({s.npsn || '-'})
                </option>
              ))}
            </select>
          </div>

          {savedSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>
                  Data Umum untuk <b>{formData.namaSekolah}</b> berhasil disimpan dan disinkronkan ke Database Spreadsheet (1_PANEL_ADMIN_UPT &amp; 6_AKUN_APLIKASI)!
                </span>
              </div>
              {onOpenDatabaseSpreadsheet && (
                <button
                  type="button"
                  onClick={onOpenDatabaseSpreadsheet}
                  className="px-3 py-1.5 rounded-lg bg-white text-emerald-800 font-bold text-[11px] hover:bg-emerald-50 shrink-0 cursor-pointer"
                >
                  Lihat di Database Spreadsheet
                </button>
              )}
            </div>
          )}

          {/* Section 1: Data Lembaga Sekolah */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-emerald-600" />
              1. Identitas Lembaga &amp; Sekolah
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Satuan Pendidikan</label>
                <input
                  type="text"
                  value={formData.namaSekolah}
                  onChange={(e) => updateField('namaSekolah', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">NPSN</label>
                <input
                  type="text"
                  value={formData.npsn}
                  onChange={(e) => updateField('npsn', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Alamat Lengkap</label>
                <input
                  type="text"
                  value={formData.alamat}
                  onChange={(e) => updateField('alamat', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kecamatan</label>
                <input
                  type="text"
                  value={formData.kecamatan}
                  onChange={(e) => updateField('kecamatan', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kabupaten / Kota</label>
                <input
                  type="text"
                  value={formData.kabupaten}
                  onChange={(e) => updateField('kabupaten', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Pejabat Penandatangan SPJ & Bendahara Pengurus Barang */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              2. Pejabat Pengelola Dana BOSP &amp; Pengurus Barang
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Kepala Sekolah */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-800 block">Kepala Satuan Pendidikan</span>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Nama Lengkap &amp; Gelar:</label>
                  <input
                    type="text"
                    value={formData.kepalaSekolah}
                    onChange={(e) => updateField('kepalaSekolah', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">NIP Kepala Sekolah:</label>
                  <input
                    type="text"
                    value={formData.nipKepalaSekolah}
                    onChange={(e) => updateField('nipKepalaSekolah', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Bendahara Sekolah */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-800 block">Bendahara Dana BOSP</span>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Nama Lengkap &amp; Gelar:</label>
                  <input
                    type="text"
                    value={formData.bendahara}
                    onChange={(e) => updateField('bendahara', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">NIP Bendahara:</label>
                  <input
                    type="text"
                    value={formData.nipBendahara}
                    onChange={(e) => updateField('nipBendahara', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Bendahara Pengurus Barang */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-800 block">Bendahara Pengurus Barang</span>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Nama Lengkap &amp; Gelar:</label>
                  <input
                    type="text"
                    value={formData.bendaharaBarang || ''}
                    onChange={(e) => updateField('bendaharaBarang', e.target.value)}
                    placeholder="Nama Pengurus Barang"
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">NIP Bendahara Pengurus Barang:</label>
                  <input
                    type="text"
                    value={formData.nipBendaharaBarang || ''}
                    onChange={(e) => updateField('nipBendaharaBarang', e.target.value)}
                    placeholder="NIP Pengurus Barang"
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Data Management & Export */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Download className="w-4 h-4 text-emerald-600" />
              3. Manajemen Data &amp; Ekspor
            </h3>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => exportExpensesToCSV(allExpenses)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg border border-slate-200 transition-all"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>Unduh Seluruh Data (CSV / Excel)</span>
              </button>

              <button
                type="button"
                onClick={() => setConfirmResetOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg border border-rose-200 transition-all ml-auto cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Bersihkan Semua Laporan Belanja</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 transition-all cursor-pointer"
          >
            Tutup
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs sm:text-sm font-bold rounded-xl shadow transition-all active:scale-95 cursor-pointer"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : savedSuccess ? (
              <Check className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>
              {isSaving
                ? 'Menyimpan ke Database Spreadsheet...'
                : savedSuccess
                ? 'Tersimpan di Database!'
                : 'Simpan Pengaturan & Sinkron Database'}
            </span>
          </button>
        </div>
      </form>

      {/* Modal Konfirmasi Bersihkan Semua Data */}
      {confirmResetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-rose-200 max-w-md w-full p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-rose-900">
                  Bersihkan Semua Laporan Belanja?
                </h3>
                <p className="text-xs text-slate-500">
                  Tindakan ini akan mengosongkan seluruh data transaksi belanja di aplikasi.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-rose-50 p-3 rounded-xl border border-rose-100">
              Apakah Anda yakin ingin menghapus seluruh data belanja? Data yang sudah dihapus tidak dapat dipulihkan kembali.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmResetOpen(false);
                  onResetDemoData();
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Ya, Bersihkan Semua</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
