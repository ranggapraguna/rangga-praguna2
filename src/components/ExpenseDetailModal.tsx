import React from 'react';
import { X, Printer } from 'lucide-react';
import { SchoolExpense, ExpenseStatus, REKENING_PEMELIHARAAN_OPTIONS } from '../types';
import { formatRupiah } from '../utils/budgetCalculations';

interface ExpenseDetailModalProps {
  expense: SchoolExpense | null;
  onClose: () => void;
  onEdit: (exp: SchoolExpense) => void;
  onDelete: (id: string) => void;
  onPrint: (exp: SchoolExpense) => void;
  onUpdateStatus: (id: string, newStatus: ExpenseStatus) => void;
  isAdmin?: boolean;
}

export const ExpenseDetailModal: React.FC<ExpenseDetailModalProps> = ({
  expense,
  onClose,
}) => {
  if (!expense) return null;

  const rawItems: NonNullable<SchoolExpense['rincianItems']> =
    expense.rincianItems && expense.rincianItems.length > 0
      ? expense.rincianItems
      : [
          {
            id: expense.id,
            kodeRekening: expense.kodeRekening || expense.uraian || '-',
            saldoAwal: expense.saldoAwal || 'Bukan Saldo Awal',
            saldoAwalMasuk: expense.saldoAwal || 'Bukan Saldo Awal',
            saldoAwalKeluar: 'Bukan Saldo Awal',
            isHibah: false,
            nilaiMasuk: expense.nilaiMasuk ?? expense.subtotal ?? 0,
            nilaiKeluar: expense.nilaiKeluar ?? 0,
            sisaNilai:
              expense.sisaNilai ??
              (expense.nilaiMasuk ?? expense.subtotal ?? 0) - (expense.nilaiKeluar ?? 0),
          },
        ];

  const mergedRows = Object.values(
    rawItems.reduce<
      Record<
        string,
        {
          id: string;
          kodeRekening: string;
          nominalSaldoAwal: number;
          nominalBelanjaLra: number;
          nominalPengeluaranSaldoAwal: number;
          nominalPengeluaranBelanja: number;
          nominalHibahMasuk: number;
          nominalHibahKeluar: number;
          sisaNilai: number;
        }
      >
    >((acc, item) => {
      const masukType = item.saldoAwalMasuk || item.saldoAwal || 'Bukan Saldo Awal';
      const keluarType = item.saldoAwalKeluar || 'Bukan Saldo Awal';
      const hibah = Boolean(item.isHibah);

      const keyNorm = (item.kodeRekening || '').trim().toLowerCase();
      const isPemeliharaan =
        expense.kategoriBelanja === 'pemeliharaan' ||
        (item as any).isPemeliharaan ||
        item.jenisPemeliharaan !== undefined ||
        item.nilaiJasa !== undefined ||
        item.nilaiBarang !== undefined ||
        (REKENING_PEMELIHARAAN_OPTIONS as readonly string[]).some(
          (opt) => opt.trim().toLowerCase() === keyNorm
        ) ||
        keyNorm.startsWith('belanja pemeliharaan');

      const nominalPengakuanBast =
        item.nilaiPengakuanBast !== undefined
          ? Number(item.nilaiPengakuanBast) || 0
          : Number(item.nilaiBarang) || 0;
      const nominalPengeluaranBast =
        item.pengeluaranBast !== undefined
          ? Number(item.pengeluaranBast) || 0
          : Number(item.nilaiBarang) || 0;

      const nominalSaldoAwal =
        item.nilaiSaldoAwal !== undefined
          ? item.nilaiSaldoAwal
          : !hibah && masukType === 'Saldo Awal'
          ? item.nilaiMasuk
          : 0;

      // Di Panel Admin: Nilai Belanja LRA pemeliharaan diambil dari Nilai Pengakuan BAST pemeliharaan
      const nominalBelanjaLra = isPemeliharaan
        ? nominalPengakuanBast
        : item.nilaiBelanjaLra !== undefined
        ? item.nilaiBelanjaLra
        : !hibah && masukType === 'Bukan Saldo Awal'
        ? item.nilaiMasuk
        : 0;

      const nominalPengeluaranSaldoAwal =
        item.pengeluaranSaldoAwal !== undefined
          ? item.pengeluaranSaldoAwal
          : !hibah && keluarType === 'Saldo Awal'
          ? item.nilaiKeluar
          : 0;

      // Di Panel Admin: Nilai Pengeluaran Belanja pemeliharaan diambil dari Nilai BAST di luar belanja
      const nominalPengeluaranBelanja = isPemeliharaan
        ? nominalPengeluaranBast
        : item.pengeluaranBelanja !== undefined
        ? item.pengeluaranBelanja
        : !hibah && keluarType === 'Bukan Saldo Awal'
        ? item.nilaiKeluar
        : 0;
      const nominalHibahMasuk =
        item.hibahMasuk !== undefined
          ? item.hibahMasuk
          : hibah
          ? item.nilaiMasuk
          : 0;
      const nominalHibahKeluar =
        item.hibahKeluar !== undefined
          ? item.hibahKeluar
          : hibah
          ? item.nilaiKeluar
          : 0;

      const existing = acc[item.kodeRekening];
      if (!existing) {
        const totalMasuk = nominalSaldoAwal + nominalBelanjaLra + nominalHibahMasuk;
        const totalKeluar =
          nominalPengeluaranSaldoAwal + nominalPengeluaranBelanja + nominalHibahKeluar;
        acc[item.kodeRekening] = {
          id: item.id,
          kodeRekening: item.kodeRekening,
          nominalSaldoAwal,
          nominalBelanjaLra,
          nominalPengeluaranSaldoAwal,
          nominalPengeluaranBelanja,
          nominalHibahMasuk,
          nominalHibahKeluar,
          sisaNilai: totalMasuk - totalKeluar,
        };
      } else {
        existing.nominalSaldoAwal += nominalSaldoAwal;
        existing.nominalBelanjaLra += nominalBelanjaLra;
        existing.nominalPengeluaranSaldoAwal += nominalPengeluaranSaldoAwal;
        existing.nominalPengeluaranBelanja += nominalPengeluaranBelanja;
        existing.nominalHibahMasuk += nominalHibahMasuk;
        existing.nominalHibahKeluar += nominalHibahKeluar;
        const totalMasuk =
          existing.nominalSaldoAwal + existing.nominalBelanjaLra + existing.nominalHibahMasuk;
        const totalKeluar =
          existing.nominalPengeluaranSaldoAwal +
          existing.nominalPengeluaranBelanja +
          existing.nominalHibahKeluar;
        existing.sisaNilai = totalMasuk - totalKeluar;
      }
      return acc;
    }, {})
  );

  const totals = mergedRows.reduce(
    (acc, row) => ({
      nominalSaldoAwal: acc.nominalSaldoAwal + row.nominalSaldoAwal,
      nominalBelanjaLra: acc.nominalBelanjaLra + row.nominalBelanjaLra,
      nominalPengeluaranSaldoAwal:
        acc.nominalPengeluaranSaldoAwal + row.nominalPengeluaranSaldoAwal,
      nominalPengeluaranBelanja:
        acc.nominalPengeluaranBelanja + row.nominalPengeluaranBelanja,
      nominalHibahMasuk: acc.nominalHibahMasuk + row.nominalHibahMasuk,
      nominalHibahKeluar: acc.nominalHibahKeluar + row.nominalHibahKeluar,
      sisaNilai: acc.sisaNilai + row.sisaNilai,
    }),
    {
      nominalSaldoAwal: 0,
      nominalBelanjaLra: 0,
      nominalPengeluaranSaldoAwal: 0,
      nominalPengeluaranBelanja: 0,
      nominalHibahMasuk: 0,
      nominalHibahKeluar: 0,
      sisaNilai: 0,
    }
  );

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn print:static print:bg-white print:p-0 print:block"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl max-w-5xl w-full shadow-2xl border border-slate-300 overflow-hidden my-6 relative print:shadow-none print:border-none print:my-0 print:max-w-none print:rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Lampiran Laporan Gabungan & Close Button */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white border-b border-slate-800 print:bg-white print:text-slate-900 print:border-slate-800 print:px-0 print:py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs sm:text-sm font-black uppercase tracking-wide">
              LAMPIRAN LAPORAN PERSEDIAAN {expense.schoolName ? `— ${expense.schoolName}` : ''}
            </span>
            <span className="px-2.5 py-0.5 rounded-md text-xs font-extrabold bg-emerald-500 text-slate-950 print:border print:border-slate-800 print:bg-transparent print:text-slate-900">
              {expense.combinedQuarterLabel || expense.triwulan.replace('TW', 'TW ')}
            </span>
            {expense.mergedCount && expense.mergedCount > 1 && (
              <span className="text-[11px] font-semibold text-emerald-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700 print:hidden">
                Gabungan {expense.mergedCount} Laporan Triwulan
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-all print:hidden cursor-pointer"
            aria-label="Tutup tabel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabel Lampiran Gabungan Beserta Isinya */}
        <div className="p-4 sm:p-5 overflow-x-auto max-h-[80vh] print:max-h-none print:overflow-visible print:p-0">
          <div className="overflow-x-auto bg-white border border-slate-800 shadow-xs print:shadow-none">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-white text-slate-900 font-serif text-[10px] font-bold uppercase tracking-tight">
                  <th
                    rowSpan={2}
                    className="border border-slate-800 py-2.5 px-2.5 text-center align-middle min-w-[200px]"
                  >
                    JENIS PERSEDIAAN
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-slate-800 py-2.5 px-2 text-center align-middle leading-tight"
                  >
                    SALDO AWAL
                    <br />
                    PER 1 JANUARI
                    <br />
                    2026
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-slate-800 py-2.5 px-2 text-center align-middle"
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
                    className="border border-slate-800 py-2.5 px-2 text-center align-middle leading-tight"
                  >
                    SALDO
                    <br />
                    AKHIR
                  </th>
                </tr>
                <tr className="bg-white text-slate-900 font-serif text-[10px] font-bold uppercase tracking-tight">
                  <th className="border border-slate-800 py-1.5 px-2 text-center align-middle leading-tight">
                    SALDO
                    <br />
                    AWAL
                  </th>
                  <th className="border border-slate-800 py-1.5 px-2 text-center align-middle">
                    BELANJA
                  </th>
                  <th className="border border-slate-800 py-1.5 px-2 text-center align-middle">
                    MASUK
                  </th>
                  <th className="border border-slate-800 py-1.5 px-2 text-center align-middle">
                    KELUAR
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white text-slate-900">
                {mergedRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="border border-slate-800 py-2 px-2.5 text-left text-slate-900">
                      {row.kodeRekening}
                    </td>
                    <td className="border border-slate-800 py-2 px-2 text-right whitespace-nowrap">
                      {row.nominalSaldoAwal > 0 ? formatRupiah(row.nominalSaldoAwal) : ''}
                    </td>
                    <td className="border border-slate-800 py-2 px-2 text-right whitespace-nowrap">
                      {row.nominalBelanjaLra > 0 ? formatRupiah(row.nominalBelanjaLra) : ''}
                    </td>
                    <td className="border border-slate-800 py-2 px-2 text-right whitespace-nowrap">
                      {row.nominalPengeluaranSaldoAwal > 0
                        ? formatRupiah(row.nominalPengeluaranSaldoAwal)
                        : ''}
                    </td>
                    <td className="border border-slate-800 py-2 px-2 text-right whitespace-nowrap">
                      {row.nominalPengeluaranBelanja > 0
                        ? formatRupiah(row.nominalPengeluaranBelanja)
                        : ''}
                    </td>
                    <td className="border border-slate-800 py-2 px-2 text-right whitespace-nowrap">
                      {row.nominalHibahMasuk > 0 ? formatRupiah(row.nominalHibahMasuk) : ''}
                    </td>
                    <td className="border border-slate-800 py-2 px-2 text-right whitespace-nowrap">
                      {row.nominalHibahKeluar > 0 ? formatRupiah(row.nominalHibahKeluar) : ''}
                    </td>
                    <td className="border border-slate-800 py-2 px-2 text-right font-semibold whitespace-nowrap">
                      {row.sisaNilai !== 0 ? formatRupiah(row.sisaNilai) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 text-slate-900 font-bold">
                  <td className="border border-slate-800 py-2 px-2.5 text-center uppercase">
                    JUMLAH
                  </td>
                  <td className="border border-slate-800 py-2 px-2 text-right whitespace-nowrap">
                    {totals.nominalSaldoAwal > 0 ? formatRupiah(totals.nominalSaldoAwal) : '-'}
                  </td>
                  <td className="border border-slate-800 py-2 px-2 text-right whitespace-nowrap">
                    {totals.nominalBelanjaLra > 0 ? formatRupiah(totals.nominalBelanjaLra) : '-'}
                  </td>
                  <td className="border border-slate-800 py-2 px-2 text-right whitespace-nowrap">
                    {totals.nominalPengeluaranSaldoAwal > 0
                      ? formatRupiah(totals.nominalPengeluaranSaldoAwal)
                      : '-'}
                  </td>
                  <td className="border border-slate-800 py-2 px-2 text-right whitespace-nowrap">
                    {totals.nominalPengeluaranBelanja > 0
                      ? formatRupiah(totals.nominalPengeluaranBelanja)
                      : '-'}
                  </td>
                  <td className="border border-slate-800 py-2 px-2 text-right whitespace-nowrap">
                    {totals.nominalHibahMasuk > 0 ? formatRupiah(totals.nominalHibahMasuk) : '-'}
                  </td>
                  <td className="border border-slate-800 py-2 px-2 text-right whitespace-nowrap">
                    {totals.nominalHibahKeluar > 0 ? formatRupiah(totals.nominalHibahKeluar) : '-'}
                  </td>
                  <td className="border border-slate-800 py-2 px-2 text-right font-black text-emerald-800 whitespace-nowrap">
                    {totals.sisaNilai !== 0 ? formatRupiah(totals.sisaNilai) : '-'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Tombol Cetak di Bawah Tabel */}
          <div className="mt-4 flex items-center justify-end print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

