import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Printer,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Layers,
  Building,
  Search,
  X,
  Calendar,
} from 'lucide-react';
import {
  SchoolExpense,
  SchoolInfo,
  Triwulan,
  REKENING_PERSEDIAAN_OPTIONS,
  REKENING_PEMELIHARAAN_OPTIONS,
  BarangEkstraItem,
} from '../types';
import { UserProfile } from '../types/auth';
import { loadBarangEkstraItems } from '../utils/storage';
import { loadUptSchools, normalizeUptKey } from '../data/schoolData';
import { filterExpenseByQuarters } from '../utils/budgetCalculations';

const ALL_QUARTERS: {
  id: Triwulan;
  label: string;
  period: string;
  startLabel: string;
  startLabelStockOpname: string;
  endMonthIndex: number; // 0-indexed month (2=Mar, 5=Jun, 8=Sep, 11=Dec)
  endMonthName: string;
}[] = [
  {
    id: 'TW1',
    label: 'Triwulan 1 (TW1)',
    period: '1 Jan - 31 Mar',
    startLabel: '1 JANUARI',
    startLabelStockOpname: '01 JANUARI',
    endMonthIndex: 2,
    endMonthName: 'MARET',
  },
  {
    id: 'TW2',
    label: 'Triwulan 2 (TW2)',
    period: '1 Apr - 30 Jun',
    startLabel: '1 APRIL',
    startLabelStockOpname: '01 APRIL',
    endMonthIndex: 5,
    endMonthName: 'JUNI',
  },
  {
    id: 'TW3',
    label: 'Triwulan 3 (TW3)',
    period: '1 Jul - 30 Sep',
    startLabel: '1 JULI',
    startLabelStockOpname: '01 JULI',
    endMonthIndex: 8,
    endMonthName: 'SEPTEMBER',
  },
  {
    id: 'TW4',
    label: 'Triwulan 4 (TW4)',
    period: '1 Okt - 31 Des',
    startLabel: '1 OKTOBER',
    startLabelStockOpname: '01 OKTOBER',
    endMonthIndex: 11,
    endMonthName: 'DESEMBER',
  },
];

const computeCutOffDate = (quarters: Triwulan[], tahun: number): string => {
  const sorted = ALL_QUARTERS.filter((q) => quarters.includes(q.id));
  if (sorted.length === 0) return `31 Desember ${tahun}`;
  const lastQuarter = sorted[sorted.length - 1];
  const lastDay = new Date(tahun, lastQuarter.endMonthIndex + 1, 0).getDate();
  const monthCapitalized =
    lastQuarter.endMonthName.charAt(0) +
    lastQuarter.endMonthName.slice(1).toLowerCase();
  return `${lastDay} ${monthCapitalized} ${tahun}`;
};

const buildPeriodeTahunAnggaran = (
  quarters: Triwulan[],
  tahunAnggaran: number,
  variant: 'rekon' | 'stock_opname' | 'barang_ekstra' | 'reklas_barang_ekstra' | 'kib_barang_ekstra' | 'rekon_gabung_sekolah' = 'rekon',
  isDinasPendidikanRekon: boolean = false
): string => {
  const sorted = ALL_QUARTERS.filter((q) => quarters.includes(q.id));
  if (sorted.length === 0) {
    return `TAHUN ANGGARAN ${tahunAnggaran}`;
  }
  const firstQuarter = sorted[0];
  const lastQuarter = sorted[sorted.length - 1];
  const lastDayOfEndMonth = new Date(
    tahunAnggaran,
    lastQuarter.endMonthIndex + 1,
    0
  ).getDate();

  if (variant === 'barang_ekstra' || variant === 'reklas_barang_ekstra' || variant === 'kib_barang_ekstra') {
    if (sorted.length === 1 || sorted.length === ALL_QUARTERS.length) {
      return `PER ${lastDayOfEndMonth} ${lastQuarter.endMonthName} ${tahunAnggaran}`;
    }
    return `PER ${firstQuarter.startLabel} - ${lastDayOfEndMonth} ${lastQuarter.endMonthName} ${tahunAnggaran}`;
  }

  if (variant === 'stock_opname') {
    return `PER ${firstQuarter.startLabelStockOpname} - ${lastDayOfEndMonth} ${lastQuarter.endMonthName} ${tahunAnggaran}`;
  }

  if (isDinasPendidikanRekon || variant === 'rekon_gabung_sekolah') {
    return `TAHUN ANGGARAN PER ${lastDayOfEndMonth} ${lastQuarter.endMonthName} ${tahunAnggaran}`;
  }

  return `TAHUN ANGGARAN PER ${firstQuarter.startLabel} - ${lastDayOfEndMonth} ${lastQuarter.endMonthName} ${tahunAnggaran}`;
};

const DINAS_REKON_MAIN_ROWS: { label: string; aliases: string[] }[] = [
  { label: 'Bahan-Bahan Bangunan dan Konstruksi', aliases: ['BAHAN BANGUNAN & KONSTRUKSI'] },
  { label: 'Bahan-Bahan Kimia', aliases: ['BAHAN KIMIA'] },
  { label: '', aliases: [] },
  { label: 'Bahan-Bahan Baku', aliases: ['BAHAN BAKU'] },
  { label: 'Bahan-Bahan Kimia Nuklir', aliases: ['BAHAN KIMIA NUKLIR'] },
  { label: 'Bahan-Barang dalam Proses', aliases: ['BARANG DALAM PROSES', 'PERSEDIAAN DALAM PROSES'] },
  { label: 'Bahan-Bahan/Bibit Tanaman', aliases: ['BAHAN/ BIBIT TANAMAN'] },
  { label: 'Bahan-Isi Tabung Pemadam Kebakaran', aliases: ['ISI TABUNG PEMADAM KEBAKARAN'] },
  { label: 'Bahan-Isi Tabung Gas', aliases: ['ISI TABUNG GAS'] },
  { label: 'Bahan-Bahan/Bibit Ternak/Bibit Ikan', aliases: ['BAHAN/ BIBIT TERNAK/ BIBIT IKAN'] },
  { label: 'Bahan-Bahan Lainnya', aliases: ['BAHAN LAINNYA'] },
  { label: 'Suku Cadang-Suku Cadang Alat Angkutan', aliases: ['SUKU CADANG ALAT ANGKUTAN'] },
  { label: 'Suku Cadang-Suku Cadang Alat Besar', aliases: ['SUKU CADANG ALAT BESAR'] },
  { label: 'Suku Cadang-Suku Cadang Alat Kedokteran', aliases: ['SUKU CADANG ALAT KEDOKTERAN'] },
  { label: 'Suku Cadang-Suku Cadang Alat Laboratorium', aliases: ['SUKU CADANG ALAT LABORATORIUM'] },
  { label: 'Suku Cadang-Suku Cadang Alat Pemancar', aliases: ['SUKU CADANG ALAT PEMANCAR'] },
  { label: 'Suku Cadang-Suku Cadang Alat Studio dan Komunikasi', aliases: ['SUKU CADANG ALAT STUDIO & KOMUNIKASI'] },
  { label: 'Suku Cadang-Suku Cadang Alat Pertanian', aliases: ['SUKU CADANG ALAT PERTANIAN'] },
  { label: 'Suku Cadang-Suku Cadang Alat Bengkel', aliases: ['SUKU CADANG ALAT BENGKEL'] },
  { label: 'Suku Cadang-Persediaan dari Belanja Bantuan Sosial', aliases: ['PERSEDIAAN DARI BELANJA BANTUAN SOSIAL'] },
  { label: 'Suku Cadang-Suku Cadang Lainnya', aliases: ['SUKU CADANG ALAT PERSENJATAAN'] },
  { label: 'Alat/Bahan untuk Kegiatan Kantor- Alat Tulis Kantor', aliases: ['ALAT/ BAHAN UNTUK KEGIATAN KANTOR (ATK)'] },
  { label: 'Alat/Bahan untuk Kegiatan Kantor- Kertas dan Cover', aliases: ['ALAT/ BAHAN UNTUK KEGIATAN KANTOR (KERTAS & COVER)'] },
  { label: 'Alat/Bahan untuk Kegiatan Kantor- Bahan Cetak', aliases: ['ALAT/ BAHAN UNTUK KEGIATAN KANTOR (BAHAN CETAK)'] },
  { label: 'Alat/Bahan untuk Kegiatan Kantor- Benda Pos', aliases: ['ALAT/ BAHAN UNTUK KEGIATAN KANTOR (PERANGKO, MATERAI & BENDA POS LAINNYA)'] },
  { label: 'Alat/Bahan untuk Kegiatan Kantor- Bahan Komputer', aliases: ['ALAT/ BAHAN UNTUK KEGIATAN KANTOR (BAHAN KOMPUTER)'] },
  { label: 'Alat/Bahan untuk Kegiatan Kantor- Perabot Kantor', aliases: ['ALAT/ BAHAN UNTUK KEGIATAN KANTOR (PERABOT KANTOR)'] },
  { label: 'Alat/Bahan untuk Kegiatan Kantor- Alat Listrik', aliases: ['ALAT/ BAHAN UNTUK KEGIATAN KANTOR (ALAT LISTRIK)'] },
  { label: 'Alat/Bahan untuk Kegiatan Kantor- Perlengkapan Dinas', aliases: ['ALAT/ BAHAN UNTUK KEGIATAN KANTOR (PERLENGKAPAN DINAS)'] },
  { label: 'Alat/Bahan untuk Kegiatan Kantor- Suvenir/Cendera Mata', aliases: ['ALAT/ BAHAN UNTUK KEGIATAN KANTOR (SUVENIR/ CENDERA MATA)'] },
  { label: 'Alat/Bahan untuk Kegiatan Kantor- Alat/Bahan untuk Kegiatan Kantor Lainnya', aliases: ['ALAT/ BAHAN UNTUK KEGIATAN KANTOR LAINNYA'] },
  { label: 'Belanja Makanan dan Minuman Rapat', aliases: ['Makanan dan Minuman Rapat', 'BELANJA MAKANAN DAN MINUMAN RAPAT', 'MAKANAN DAN MINUMAN RAPAT'] },
  { label: 'Belanja Makanan dan Minuman Jamuan Tamu', aliases: ['Makanan dan Minuman Jamuan Tamu', 'BELANJA MAKANAN DAN MINUMAN JAMUAN TAMU', 'MAKANAN DAN MINUMAN JAMUAN TAMU'] },
  { label: 'Perlengkapan Pendukung Olahraga (Alat/ Bahan Untuk Kegiatan Kantor)', aliases: ['ALAT/ BAHAN UNTUK KEGIATAN KANTOR (PERLENGKAPAN PENDUKUNG OLAH RAGA)'] },
  { label: 'Belanja Persediaan untuk Dijual/Diserahkan-Persediaan untuk Dijual/Diserahkan kepada Masyarakat', aliases: ['BARANG UNTUK DIJUAL/ DISERAHKAN KEPADA MASYARAKAT'] },
  { label: 'Belanja Persediaan untuk Dijual/Diserahkan-Persediaan untuk Dijual/Diserahkan Lainnya', aliases: ['BARANG UNTUK DIJUAL/ DISERAHKAN LAINNYA'] },
  { label: 'Natura dan Pakan-Natura', aliases: ['NATURA', 'PAKAN', 'PAKAN LAINNYA'] },
  { label: 'Belanja Pemeliharaan Alat Kantor dan Rumah Tangga-Alat Rumah Tangga-Alat Pendingin', aliases: [] },
  { label: 'Penambah Daya Tahan Tubuh', aliases: ['OBAT', 'OBAT-OBATAN LAINNYA'] },
  { label: 'Makanan dan Minuman pada Fasilitas Pelayanan Urusan Pendidikan', aliases: [] },
  { label: 'Pakaian Dinas KDH dan WKDH', aliases: [] },
  { label: 'Pakaian Sipil Harian (PSH)', aliases: [] },
  { label: 'Pakaian Sipil Lengkap (PSL)', aliases: [] },
  { label: 'Belanja Pakaian Dinas Harian (PDH)', aliases: [] },
  { label: 'Pakaian Dinas Lapangan (PDL)', aliases: ['ALAT/ BAHAN UNTUK KEGIATAN KANTOR (KAPORLAP & PERLENGKAPAN SATWA)'] },
  { label: 'Pakaian Sipil Resmi (PSR)', aliases: [] },
  { label: 'Pakaian Dinas Upacara (PDU)', aliases: [] },
  { label: 'Pakaian KORPRI', aliases: [] },
  { label: 'Pakaian Adat Daerah', aliases: [] },
  { label: 'Pakaian Batik Tradisional', aliases: [] },
  { label: 'Belanja Pakaian Olahraga', aliases: [] },
  { label: 'Pakaian Paskibraka', aliases: [] },
  { label: 'Komponen-Komponen Lainnya', aliases: ['KOMPONEN LAINNYA', 'KOMPONEN PERALATAN', 'KOMPONEN RAMBU-RAMBU', 'KOMPONEN JEMBATAN BAJA', 'KOMPONEN JEMBATAN PRAKTEKAN'] },
  { label: 'Pipa-Pipa Plastik PVC (UPVC)', aliases: ['PIPA PLASTIK PVC (UPVC)'] },
  { label: 'Pipa-Pipa Lainnya', aliases: ['PIPA LAINNYA', 'PIPA AIR BESI TUANG (DCI)', 'PIPA ASBES SEMEN (APC)', 'PIPA BAJA', 'PIPA BETON PRAKTEKAN', 'PIPA FIBER GLASS'] },
  { label: 'Komponen Bekas dan Pipa Bekas-Komponen Bekas', aliases: ['KOMPONEN BEKAS'] },
  { label: 'Komponen Bekas dan Pipa Bekas-Pipa Bekas', aliases: ['PIPA BEKAS'] },
  { label: 'Komponen Bekas dan Pipa Bekas-Komponen Bekas dan Pipa Bekas Lainnya', aliases: ['KOMPONEN BEKAS DAN PIPA BEKAS LAINNYA'] },
];

const DINAS_REKON_BOSP_ROWS: { label: string; aliases: string[] }[] = [
  { label: 'Belanja barjas BOS', aliases: ['BELANJA BARJAS BOS'] },
  { label: 'Belanja barjas BOP PAUD', aliases: ['BELANJA BARJAS BOP PAUD'] },
];

const DINAS_REKON_EXTRA_ROWS: { label: string; aliases: string[]; keterangan?: string }[] = [
  { label: 'Belanja Bahan-Bahan Bakar dan Pelumas', aliases: ['BAHAN BAKAR & PELUMAS'] },
  {
    label: 'Belanja Pemeliharaan Alat Angkutan-Alat Angkutan Darat Bermotor-Kendaraan Dinas Bermotor Perorangan',
    aliases: [],
  },
  {
    label: 'Belanja Pemeliharaan Komputer-Komputer Unit-Personal Computer',
    aliases: [],
  },
  {
    label: 'Belanja Pemeliharaan Alat Kantor dan Rumah Tangga-Alat Rumah Tangga-Alat Pendingin',
    aliases: [],
  },
  {
    label: 'Belanja Pemeliharaan Bangunan Gedung-Bangunan Gedung Tempat Kerja-Bangunan Gedung Kantor',
    aliases: [],
  },
  {
    label: 'Belanja Pemeliharaan Suku Cadang Lainya',
    aliases: ['Belanja Pemeliharaan Suku Cadang Lainnya'],
  },
];

// Baris Tabel 1: BOP TK, SKB (BA Rekon Gabung Sekolah) sesuai file CSV
const BA_REKON_GABUNG_PAUD_ROWS: { label: string; aliases: string[] }[] = [
  {
    label: 'Bahan-Bahan Bangunan dan Konstruksi',
    aliases: [
      'BAHAN BANGUNAN & KONSTRUKSI',
      'Belanja Pemeliharaan Bangunan Gedung-Bangunan Gedung Tempat Kerja-Bangunan Gedung Tempat Pendidikan',
      'Belanja Pemeliharaan Bangunan Gedung-Bangunan Gedung Tempat Kerja-Bangunan Gedung Kantor',
    ],
  },
  {
    label: 'Bahan-Bahan Bakar dan Pelumas',
    aliases: ['BAHAN BAKAR & PELUMAS', 'Belanja Bahan-Bahan Bakar dan Pelumas'],
  },
  {
    label: 'Bahan-Bahan Baku',
    aliases: [
      'BAHAN BAKU',
      'BAHAN KIMIA',
      'BAHAN KIMIA NUKLIR',
      'BAHAN LAINNYA',
      'BAHAN PELEDAK',
      'BAHAN/ BIBIT TANAMAN',
      'BAHAN/ BIBIT TERNAK/ BIBIT IKAN',
      'BARANG DALAM PROSES',
      'PERSEDIAAN DALAM PROSES',
      'PERSEDIAAN DALAM PROSES LAINNYA',
      'ISI TABUNG GAS',
      'ISI TABUNG PEMADAM KEBAKARAN',
    ],
  },
  {
    label: 'Suku Cadang-Suku Cadang Lainnya',
    aliases: [
      'SUKU CADANG ALAT ANGKUTAN',
      'SUKU CADANG ALAT BENGKEL',
      'SUKU CADANG ALAT BESAR',
      'SUKU CADANG ALAT KEDOKTERAN',
      'SUKU CADANG ALAT LABORATORIUM',
      'SUKU CADANG ALAT PEMANCAR',
      'SUKU CADANG ALAT PERSENJATAAN',
      'SUKU CADANG ALAT PERTANIAN',
      'SUKU CADANG ALAT STUDIO & KOMUNIKASI',
      'PERSEDIAAN DARI BELANJA BANTUAN SOSIAL',
      'Belanja Pemeliharaan Suku Cadang Lainya',
      'Belanja Pemeliharaan Suku Cadang Lainnya',
      'Belanja Pemeliharaan Alat Angkutan-Alat Angkutan Darat Bermotor-Kendaraan Dinas Bermotor Perorangan',
    ],
  },
  {
    label: 'Alat/Bahan untuk Kegiatan Kantor- Alat Tulis Kantor',
    aliases: ['ALAT/ BAHAN UNTUK KEGIATAN KANTOR (ATK)'],
  },
  {
    label: 'Alat/Bahan untuk Kegiatan Kantor- Kertas dan Cover',
    aliases: ['ALAT/ BAHAN UNTUK KEGIATAN KANTOR (KERTAS & COVER)'],
  },
  {
    label: 'Alat/Bahan untuk Kegiatan Kantor- Bahan Cetak',
    aliases: ['ALAT/ BAHAN UNTUK KEGIATAN KANTOR (BAHAN CETAK)'],
  },
  {
    label: 'Alat/Bahan untuk Kegiatan Kantor- Benda Pos',
    aliases: [],
  },
  {
    label: 'Alat/Bahan untuk Kegiatan Kantor- Bahan Komputer',
    aliases: [
      'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (BAHAN KOMPUTER)',
      'Belanja Pemeliharaan Komputer-Komputer Unit-Personal Computer',
    ],
  },
  {
    label: 'Alat/Bahan untuk Kegiatan Kantor- Perabot Kantor',
    aliases: [
      'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (PERABOT KANTOR)',
      'Belanja Pemeliharaan Alat Kantor dan Rumah Tangga-Alat Rumah Tangga-Meubelair',
    ],
  },
  {
    label: 'Alat/Bahan untuk Kegiatan Kantor- Alat Listrik',
    aliases: ['ALAT/ BAHAN UNTUK KEGIATAN KANTOR (ALAT LISTRIK)'],
  },
  {
    label: 'Alat/Bahan untuk Kegiatan Kantor- Perlengkapan Dinas',
    aliases: [
      'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (PERLENGKAPAN DINAS)',
      'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (KAPORLAP & PERLENGKAPAN SATWA)',
    ],
  },
  {
    label: 'Alat/Bahan untuk Kegiatan Kantor- Perlengkapan Pendukung Olahraga',
    aliases: [
      'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (PERLENGKAPAN PENDUKUNG OLAH RAGA)',
      'Perlengkapan Pendukung Olahraga (Alat/ Bahan Untuk Kegiatan Kantor)',
    ],
  },
  {
    label: 'Alat/Bahan untuk Kegiatan Kantor- Suvenir/Cendera Mata',
    aliases: ['ALAT/ BAHAN UNTUK KEGIATAN KANTOR (SUVENIR/ CENDERA MATA)'],
  },
  {
    label: 'alat/ bahan untuk kegiatan kantor (perangko, materai & benda pos lainnya)',
    aliases: ['ALAT/ BAHAN UNTUK KEGIATAN KANTOR (PERANGKO, MATERAI & BENDA POS LAINNYA)'],
  },
  {
    label: 'Alat/Bahan untuk Kegiatan Kantor- Alat/Bahan untuk Kegiatan Kantor Lainnya',
    aliases: [
      'ALAT/ BAHAN UNTUK KEGIATAN KANTOR LAINNYA',
      'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (PERSEDIAAN DOKUMEN/ ADMISTRASI TENDER)',
      'BARANG UNTUK DIJUAL/ DISERAHKAN KEPADA MASYARAKAT',
      'BARANG UNTUK DIJUAL/ DISERAHKAN LAINNYA',
      'PERSEDIAAN PENELITIAN BIOLOGI',
      'PERSEDIAAN PENELITIAN BIOLOGI LAINNYA',
      'PERSEDIAAN PENELITIAN LAINNYA',
      'PERSEDIAAN PENELITIAN TEKNOLOGI',
      'PERSEDIAAN UNTUK TUJUAN STRATEGIS/ BERJAGA-JAGA',
      'PERSEDIAAN UNTUK TUJUAN STRATEGIS/ BERJAGA-JAGA LAINNYA',
      'Belanja Pemeliharaan Alat Kantor dan Rumah Tangga-Alat Kantor-Alat Kantor Lainnya',
      'Belanja Pemeliharaan Alat Kantor dan Rumah Tangga-Alat Rumah Tangga-Alat Pendingin',
      'Belanja Pemeliharaan Peralatan dan Mesin Lainnya',
    ],
  },
  {
    label: 'Obat-Obatan-Obat',
    aliases: ['OBAT', 'OBAT-OBATAN LAINNYA', 'Obat-Obatan Lainya', 'Obat-Obatan-Obat Lainya', 'Penambah Daya Tahan Tubuh'],
  },
  {
    label: 'NATURA',
    aliases: ['Natura dan Pakan-Natura', 'PAKAN', 'PAKAN LAINNYA'],
  },
  {
    label: 'Makanan dan Minuman Rapat',
    aliases: [
      'Belanja Makanan dan Minuman Rapat',
      'Belanja Makanan dan Minuman Jamuan Tamu',
      'Makanan dan Minuman pada Fasilitas Pelayanan Urusan Pendidikan',
    ],
  },
  {
    label: 'PIPA PLASTIK PVC (UPVC)',
    aliases: [
      'Pipa-Pipa Plastik PVC (UPVC)',
      'PIPA LAINNYA',
      'PIPA PLASTIK LAINYA',
      'Pipa-Pipa Lainnya',
      'PIPA AIR BESI TUANG (DCI)',
      'PIPA ASBES SEMEN (APC)',
      'PIPA BAJA',
      'PIPA BEKAS',
      'PIPA BETON PRAKTEKAN',
      'PIPA FIBER GLASS',
    ],
  },
  { label: '', aliases: [] },
  {
    label: 'KOMPONEN PERALATAN',
    aliases: [
      'KOMPONEN LAINNYA',
      'Komponen-Komponen Lainnya',
      'KOMPONEN RAMBU-RAMBU',
      'KOMPONEN JEMBATAN BAJA',
      'KOMPONEN JEMBATAN PRAKTEKAN',
      'KOMPONEN BEKAS',
      'KOMPONEN BEKAS DAN PIPA BEKAS LAINNYA',
      'ATACHMENT',
    ],
  },
];

// Baris Tabel 2: SEKOLAH DASAR (BA Rekon Gabung Sekolah) sesuai file CSV
const BA_REKON_GABUNG_SD_ROWS: { label: string; aliases: string[] }[] = [
  {
    label: 'Bahan-Bahan Bangunan dan Konstruksi',
    aliases: [
      'BAHAN BANGUNAN & KONSTRUKSI',
      'Belanja Pemeliharaan Bangunan Gedung-Bangunan Gedung Tempat Kerja-Bangunan Gedung Tempat Pendidikan',
      'Belanja Pemeliharaan Bangunan Gedung-Bangunan Gedung Tempat Kerja-Bangunan Gedung Kantor',
    ],
  },
  {
    label: 'Bahan-Bahan Bakar dan Pelumas',
    aliases: ['BAHAN BAKAR & PELUMAS', 'Belanja Bahan-Bahan Bakar dan Pelumas'],
  },
  {
    label: 'Bahan-Bahan Baku',
    aliases: [
      'BAHAN BAKU',
      'BAHAN KIMIA',
      'BAHAN KIMIA NUKLIR',
      'BAHAN LAINNYA',
      'BAHAN PELEDAK',
      'BAHAN/ BIBIT TANAMAN',
      'BAHAN/ BIBIT TERNAK/ BIBIT IKAN',
      'BARANG DALAM PROSES',
      'PERSEDIAAN DALAM PROSES',
      'PERSEDIAAN DALAM PROSES LAINNYA',
      'ISI TABUNG GAS',
      'ISI TABUNG PEMADAM KEBAKARAN',
    ],
  },
  {
    label: 'Suku Cadang-Suku Cadang Lainnya',
    aliases: [
      'SUKU CADANG ALAT ANGKUTAN',
      'SUKU CADANG ALAT BENGKEL',
      'SUKU CADANG ALAT BESAR',
      'SUKU CADANG ALAT KEDOKTERAN',
      'SUKU CADANG ALAT LABORATORIUM',
      'SUKU CADANG ALAT PEMANCAR',
      'SUKU CADANG ALAT PERSENJATAAN',
      'SUKU CADANG ALAT PERTANIAN',
      'SUKU CADANG ALAT STUDIO & KOMUNIKASI',
      'PERSEDIAAN DARI BELANJA BANTUAN SOSIAL',
      'Belanja Pemeliharaan Suku Cadang Lainya',
      'Belanja Pemeliharaan Suku Cadang Lainnya',
      'Belanja Pemeliharaan Alat Angkutan-Alat Angkutan Darat Bermotor-Kendaraan Dinas Bermotor Perorangan',
    ],
  },
  {
    label: 'Alat/Bahan untuk Kegiatan Kantor- Alat Tulis Kantor',
    aliases: ['ALAT/ BAHAN UNTUK KEGIATAN KANTOR (ATK)'],
  },
  {
    label: 'Alat/Bahan untuk Kegiatan Kantor- Kertas dan Cover',
    aliases: ['ALAT/ BAHAN UNTUK KEGIATAN KANTOR (KERTAS & COVER)'],
  },
  {
    label: 'Alat/Bahan untuk Kegiatan Kantor- Bahan Cetak',
    aliases: ['ALAT/ BAHAN UNTUK KEGIATAN KANTOR (BAHAN CETAK)'],
  },
  {
    label: 'Alat/Bahan untuk Kegiatan Kantor- Benda Pos',
    aliases: [
      'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (PERANGKO, MATERAI & BENDA POS LAINNYA)',
      'alat/ bahan untuk kegiatan kantor (perangko, materai & benda pos lainnya)',
    ],
  },
  {
    label: 'Alat/Bahan untuk Kegiatan Kantor- Bahan Komputer',
    aliases: [
      'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (BAHAN KOMPUTER)',
      'Belanja Pemeliharaan Komputer-Komputer Unit-Personal Computer',
    ],
  },
  {
    label: 'Alat/Bahan untuk Kegiatan Kantor- Perabot Kantor',
    aliases: [
      'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (PERABOT KANTOR)',
      'Belanja Pemeliharaan Alat Kantor dan Rumah Tangga-Alat Rumah Tangga-Meubelair',
    ],
  },
  {
    label: 'Alat/Bahan untuk Kegiatan Kantor- Alat Listrik',
    aliases: ['ALAT/ BAHAN UNTUK KEGIATAN KANTOR (ALAT LISTRIK)'],
  },
  {
    label: 'Alat/Bahan untuk Kegiatan Kantor- Perlengkapan Dinas',
    aliases: [
      'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (PERLENGKAPAN DINAS)',
      'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (KAPORLAP & PERLENGKAPAN SATWA)',
    ],
  },
  {
    label: 'Alat/Bahan untuk Kegiatan Kantor- Perlengkapan Pendukung Olahraga',
    aliases: [
      'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (PERLENGKAPAN PENDUKUNG OLAH RAGA)',
      'Perlengkapan Pendukung Olahraga (Alat/ Bahan Untuk Kegiatan Kantor)',
    ],
  },
  {
    label: 'Alat/Bahan untuk Kegiatan Kantor- Suvenir/Cendera Mata',
    aliases: ['ALAT/ BAHAN UNTUK KEGIATAN KANTOR (SUVENIR/ CENDERA MATA)'],
  },
  {
    label: 'Alat/Bahan untuk Kegiatan Kantor- Alat/Bahan untuk Kegiatan Kantor Lainnya',
    aliases: [
      'ALAT/ BAHAN UNTUK KEGIATAN KANTOR LAINNYA',
      'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (PERSEDIAAN DOKUMEN/ ADMISTRASI TENDER)',
      'BARANG UNTUK DIJUAL/ DISERAHKAN KEPADA MASYARAKAT',
      'BARANG UNTUK DIJUAL/ DISERAHKAN LAINNYA',
      'PERSEDIAAN PENELITIAN BIOLOGI',
      'PERSEDIAAN PENELITIAN BIOLOGI LAINNYA',
      'PERSEDIAAN PENELITIAN LAINNYA',
      'PERSEDIAAN PENELITIAN TEKNOLOGI',
      'PERSEDIAAN UNTUK TUJUAN STRATEGIS/ BERJAGA-JAGA',
      'PERSEDIAAN UNTUK TUJUAN STRATEGIS/ BERJAGA-JAGA LAINNYA',
      'Belanja Pemeliharaan Alat Kantor dan Rumah Tangga-Alat Kantor-Alat Kantor Lainnya',
      'Belanja Pemeliharaan Alat Kantor dan Rumah Tangga-Alat Rumah Tangga-Alat Pendingin',
      'Belanja Pemeliharaan Peralatan dan Mesin Lainnya',
    ],
  },
  {
    label: 'Obat-Obatan Lainya',
    aliases: ['OBAT', 'OBAT-OBATAN LAINNYA', 'Obat-Obatan-Obat', 'Obat-Obatan-Obat Lainya', 'Penambah Daya Tahan Tubuh'],
  },
  {
    label: 'NATURA',
    aliases: ['Natura dan Pakan-Natura', 'PAKAN', 'PAKAN LAINNYA'],
  },
  {
    label: 'Makanan dan Minuman Rapat',
    aliases: [
      'Belanja Makanan dan Minuman Rapat',
      'Belanja Makanan dan Minuman Jamuan Tamu',
      'Makanan dan Minuman pada Fasilitas Pelayanan Urusan Pendidikan',
    ],
  },
  {
    label: 'PIPA PLASTIK PVC (UPVC)',
    aliases: [
      'Pipa-Pipa Plastik PVC (UPVC)',
      'PIPA LAINNYA',
      'PIPA PLASTIK LAINYA',
      'Pipa-Pipa Lainnya',
      'PIPA AIR BESI TUANG (DCI)',
      'PIPA ASBES SEMEN (APC)',
      'PIPA BAJA',
      'PIPA BEKAS',
      'PIPA BETON PRAKTEKAN',
      'PIPA FIBER GLASS',
    ],
  },
  { label: '', aliases: [] },
  {
    label: 'KOMPONEN PERALATAN',
    aliases: [
      'KOMPONEN LAINNYA',
      'Komponen-Komponen Lainnya',
      'KOMPONEN RAMBU-RAMBU',
      'KOMPONEN JEMBATAN BAJA',
      'KOMPONEN JEMBATAN PRAKTEKAN',
      'KOMPONEN BEKAS',
      'KOMPONEN BEKAS DAN PIPA BEKAS LAINNYA',
      'ATACHMENT',
    ],
  },
  { label: '', aliases: [] },
];

// Baris Tabel 3: SMPN (BA Rekon Gabung Sekolah) sesuai file CSV
const BA_REKON_GABUNG_SMP_ROWS: { label: string; aliases: string[] }[] = [
  {
    label: 'Bahan-Bahan Bangunan dan Konstruksi',
    aliases: [
      'BAHAN BANGUNAN & KONSTRUKSI',
      'Belanja Pemeliharaan Bangunan Gedung-Bangunan Gedung Tempat Kerja-Bangunan Gedung Tempat Pendidikan',
      'Belanja Pemeliharaan Bangunan Gedung-Bangunan Gedung Tempat Kerja-Bangunan Gedung Kantor',
    ],
  },
  {
    label: 'Bahan-Bahan Bakar dan Pelumas',
    aliases: ['BAHAN BAKAR & PELUMAS', 'Belanja Bahan-Bahan Bakar dan Pelumas'],
  },
  {
    label: 'Bahan-Bahan Baku',
    aliases: [
      'BAHAN BAKU',
      'BAHAN KIMIA',
      'BAHAN KIMIA NUKLIR',
      'BAHAN LAINNYA',
      'BAHAN PELEDAK',
      'BAHAN/ BIBIT TANAMAN',
      'BAHAN/ BIBIT TERNAK/ BIBIT IKAN',
      'BARANG DALAM PROSES',
      'PERSEDIAAN DALAM PROSES',
      'PERSEDIAAN DALAM PROSES LAINNYA',
      'ISI TABUNG GAS',
      'ISI TABUNG PEMADAM KEBAKARAN',
    ],
  },
  {
    label: 'Suku Cadang-Suku Cadang Lainnya',
    aliases: [
      'SUKU CADANG ALAT ANGKUTAN',
      'SUKU CADANG ALAT BENGKEL',
      'SUKU CADANG ALAT BESAR',
      'SUKU CADANG ALAT KEDOKTERAN',
      'SUKU CADANG ALAT LABORATORIUM',
      'SUKU CADANG ALAT PEMANCAR',
      'SUKU CADANG ALAT PERSENJATAAN',
      'SUKU CADANG ALAT PERTANIAN',
      'SUKU CADANG ALAT STUDIO & KOMUNIKASI',
      'PERSEDIAAN DARI BELANJA BANTUAN SOSIAL',
      'Belanja Pemeliharaan Suku Cadang Lainya',
      'Belanja Pemeliharaan Suku Cadang Lainnya',
      'Belanja Pemeliharaan Alat Angkutan-Alat Angkutan Darat Bermotor-Kendaraan Dinas Bermotor Perorangan',
    ],
  },
  {
    label: 'Alat/Bahan untuk Kegiatan Kantor- Alat Tulis Kantor',
    aliases: ['ALAT/ BAHAN UNTUK KEGIATAN KANTOR (ATK)'],
  },
  {
    label: 'Alat/Bahan untuk Kegiatan Kantor- Kertas dan Cover',
    aliases: ['ALAT/ BAHAN UNTUK KEGIATAN KANTOR (KERTAS & COVER)'],
  },
  {
    label: 'Alat/Bahan untuk Kegiatan Kantor- Bahan Cetak',
    aliases: ['ALAT/ BAHAN UNTUK KEGIATAN KANTOR (BAHAN CETAK)'],
  },
  {
    label: 'Alat/Bahan untuk Kegiatan Kantor- Benda Pos',
    aliases: [
      'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (PERANGKO, MATERAI & BENDA POS LAINNYA)',
      'alat/ bahan untuk kegiatan kantor (perangko, materai & benda pos lainnya)',
    ],
  },
  {
    label: 'Alat/Bahan untuk Kegiatan Kantor- Bahan Komputer',
    aliases: [
      'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (BAHAN KOMPUTER)',
      'Belanja Pemeliharaan Komputer-Komputer Unit-Personal Computer',
    ],
  },
  {
    label: 'Alat/Bahan untuk Kegiatan Kantor- Perabot Kantor',
    aliases: [
      'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (PERABOT KANTOR)',
      'Belanja Pemeliharaan Alat Kantor dan Rumah Tangga-Alat Rumah Tangga-Meubelair',
    ],
  },
  {
    label: 'Alat/Bahan untuk Kegiatan Kantor- Alat Listrik',
    aliases: ['ALAT/ BAHAN UNTUK KEGIATAN KANTOR (ALAT LISTRIK)'],
  },
  {
    label: 'Alat/Bahan untuk Kegiatan Kantor- Perlengkapan Dinas',
    aliases: [
      'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (PERLENGKAPAN DINAS)',
      'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (KAPORLAP & PERLENGKAPAN SATWA)',
    ],
  },
  {
    label: 'Alat/Bahan untuk Kegiatan Kantor- Perlengkapan Pendukung Olahraga',
    aliases: [
      'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (PERLENGKAPAN PENDUKUNG OLAH RAGA)',
      'Perlengkapan Pendukung Olahraga (Alat/ Bahan Untuk Kegiatan Kantor)',
    ],
  },
  {
    label: 'Alat/Bahan untuk Kegiatan Kantor- Suvenir/Cendera Mata',
    aliases: ['ALAT/ BAHAN UNTUK KEGIATAN KANTOR (SUVENIR/ CENDERA MATA)'],
  },
  {
    label: 'Alat/Bahan untuk Kegiatan Kantor- Alat/Bahan untuk Kegiatan Kantor Lainnya',
    aliases: [
      'ALAT/ BAHAN UNTUK KEGIATAN KANTOR LAINNYA',
      'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (PERSEDIAAN DOKUMEN/ ADMISTRASI TENDER)',
      'BARANG UNTUK DIJUAL/ DISERAHKAN KEPADA MASYARAKAT',
      'BARANG UNTUK DIJUAL/ DISERAHKAN LAINNYA',
      'PERSEDIAAN PENELITIAN BIOLOGI',
      'PERSEDIAAN PENELITIAN BIOLOGI LAINNYA',
      'PERSEDIAAN PENELITIAN LAINNYA',
      'PERSEDIAAN PENELITIAN TEKNOLOGI',
      'PERSEDIAAN UNTUK TUJUAN STRATEGIS/ BERJAGA-JAGA',
      'PERSEDIAAN UNTUK TUJUAN STRATEGIS/ BERJAGA-JAGA LAINNYA',
      'Belanja Pemeliharaan Alat Kantor dan Rumah Tangga-Alat Kantor-Alat Kantor Lainnya',
      'Belanja Pemeliharaan Alat Kantor dan Rumah Tangga-Alat Rumah Tangga-Alat Pendingin',
      'Belanja Pemeliharaan Peralatan dan Mesin Lainnya',
    ],
  },
  {
    label: 'Obat-Obatan-Obat Lainya',
    aliases: ['OBAT', 'OBAT-OBATAN LAINNYA', 'Obat-Obatan-Obat', 'Obat-Obatan Lainya', 'Penambah Daya Tahan Tubuh'],
  },
  {
    label: 'Natura dan Pakan-Natura',
    aliases: ['NATURA', 'PAKAN', 'PAKAN LAINNYA'],
  },
  {
    label: 'Makanan dan Minuman Rapat',
    aliases: [
      'Belanja Makanan dan Minuman Rapat',
      'Belanja Makanan dan Minuman Jamuan Tamu',
      'Makanan dan Minuman pada Fasilitas Pelayanan Urusan Pendidikan',
    ],
  },
  {
    label: 'PIPA PLASTIK PVC (UPVC)',
    aliases: ['Pipa-Pipa Plastik PVC (UPVC)'],
  },
  {
    label: 'PIPA PLASTIK LAINYA',
    aliases: [
      'PIPA LAINNYA',
      'Pipa-Pipa Lainnya',
      'PIPA AIR BESI TUANG (DCI)',
      'PIPA ASBES SEMEN (APC)',
      'PIPA BAJA',
      'PIPA BEKAS',
      'PIPA BETON PRAKTEKAN',
      'PIPA FIBER GLASS',
    ],
  },
  {
    label: 'KOMPONEN PERALATAN',
    aliases: [
      'KOMPONEN LAINNYA',
      'Komponen-Komponen Lainnya',
      'KOMPONEN RAMBU-RAMBU',
      'KOMPONEN JEMBATAN BAJA',
      'KOMPONEN JEMBATAN PRAKTEKAN',
      'KOMPONEN BEKAS',
      'KOMPONEN BEKAS DAN PIPA BEKAS LAINNYA',
      'ATACHMENT',
    ],
  },
  { label: '', aliases: [] },
];

const classifySchoolForRekonGabung = (
  expense: SchoolExpense,
  fallbackSchoolName: string
): 'PAUD' | 'SD' | 'SMP' | 'DINAS' => {
  const rawName = (expense.schoolName || fallbackSchoolName || '').trim();
  const upper = rawName.toUpperCase();
  const norm = normalizeUptKey(rawName);
  if (norm === 'DINAS PENDIDIKAN' || upper.includes('DINAS PENDIDIKAN')) {
    return 'DINAS';
  }
  if (
    /\b(TK|TKN|TKS|PAUD|KB|SPS|TPA|SKB|PKBM)\b/.test(upper) ||
    upper.includes('SANGGAR KEGIATAN BELAJAR') ||
    upper.includes('SANGGAR') ||
    upper.includes('TAMAN KANAK')
  ) {
    return 'PAUD';
  }
  if (
    /\b(SD|SDN|SDS|SDI|MI|MIN|MIS)\b/.test(upper) ||
    upper.includes('SEKOLAH DASAR') ||
    upper.startsWith('SD')
  ) {
    return 'SD';
  }
  if (
    /\b(SMP|SMPN|SMPS|MTS|MTSN|MTSS)\b/.test(upper) ||
    upper.includes('SEKOLAH MENENGAH PERTAMA') ||
    upper.startsWith('SMP')
  ) {
    return 'SMP';
  }
  if (expense.sumberDana === 'BOP PAUD/Kesetaraan') {
    return 'PAUD';
  }
  return 'SMP';
};

export type ReklasSubView = 'ba_reklas' | 'lampiran_1' | 'lampiran_2';

const REKLAS_SUB_VIEW_OPTIONS: { id: ReklasSubView; label: string }[] = [
  { id: 'ba_reklas', label: '1. BA Reklas Barang Ekstra' },
  { id: 'lampiran_1', label: '2. Lampiran 1' },
  { id: 'lampiran_2', label: '3. Lampiran 2' },
];

interface ReceiptPrintViewProps {
  variant?: 'rekon' | 'stock_opname' | 'barang_ekstra' | 'reklas_barang_ekstra' | 'kib_barang_ekstra' | 'rekon_gabung_sekolah';
  reklasSubView?: ReklasSubView;
  onReklasSubViewChange?: (sub: ReklasSubView) => void;
  initialExpense: SchoolExpense | null;
  allExpenses: SchoolExpense[];
  schoolInfo: SchoolInfo;
  onBack: () => void;
  isAdmin?: boolean;
  currentUser?: UserProfile | null;
  barangEkstraItems?: BarangEkstraItem[];
  selectedUpt?: string;
  onUptChange?: (upt: string) => void;
  initialShowOnlyFilledRows?: boolean;
  onShowOnlyFilledRowsChange?: (val: boolean) => void;
}

interface StockOpnameRowCustom {
  satuan?: string;
  fisikBarang?: number;
  kondisiBarang?: string;
}

const formatNominalRekonsiliasi = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const NAMA_HARI_ID = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
];

const NAMA_BULAN_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const angkaKeKataId = (n: number): string => {
  const satuan = [
    '',
    'Satu',
    'Dua',
    'Tiga',
    'Empat',
    'Lima',
    'Enam',
    'Tujuh',
    'Delapan',
    'Sembilan',
    'Sepuluh',
    'Sebelas',
  ];
  if (n < 12) return satuan[n];
  if (n < 20) return `${angkaKeKataId(n - 10)} Belas`;
  if (n < 100) return `${angkaKeKataId(Math.floor(n / 10))} Puluh ${satuan[n % 10]}`.trim();
  if (n < 200) return `Seratus ${angkaKeKataId(n - 100)}`.trim();
  if (n < 1000) return `${angkaKeKataId(Math.floor(n / 100))} Ratus ${angkaKeKataId(n % 100)}`.trim();
  if (n < 2000) return `Seribu ${angkaKeKataId(n - 1000)}`.trim();
  if (n < 1000000) return `${angkaKeKataId(Math.floor(n / 1000))} Ribu ${angkaKeKataId(n % 1000)}`.trim();
  return String(n);
};

export const parseReportDateComponents = (dateStr: string) => {
  if (!dateStr || !dateStr.includes('-')) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(monthIdx) || isNaN(day)) return null;
  const dateObj = new Date(year, monthIdx, day);
  const dayName = NAMA_HARI_ID[dateObj.getDay()] || 'Senin';
  const monthName = NAMA_BULAN_ID[monthIdx] || 'Januari';
  const dayPad = String(day).padStart(2, '0');
  const yearWords = angkaKeKataId(year);
  return {
    year,
    monthIdx,
    day,
    dayName,
    monthName,
    dayPad,
    yearWords,
    dateObj,
  };
};

export const formatOpeningParagraph = (
  dateStr: string,
  variant: 'rekon' | 'stock_opname' | 'barang_ekstra' | 'reklas_barang_ekstra' | 'kib_barang_ekstra' | 'rekon_gabung_sekolah' = 'rekon',
  isStockOpname: boolean = false,
  isDinasPendidikanRekon: boolean = false
): string => {
  const parsed = parseReportDateComponents(dateStr);
  if (!parsed) {
    return 'Pada hari ini, kami yang bertanda tangan di bawah ini :';
  }
  const { dayName, dayPad, monthName, yearWords } = parsed;

  if (variant === 'reklas_barang_ekstra') {
    return `Pada hari ini ${dayName} Tanggal ${angkaKeKataId(parsed.day)} Bulan ${monthName} Tahun ${yearWords}, kami yang bertanda tangan di bawah ini`;
  }
  if (variant === 'barang_ekstra') {
    return `Pada hari ini ${dayName} tanggal ${dayPad} bulan ${monthName} tahun ${yearWords.toLowerCase()}, kami yang bertanda tangan di bawah ini :`;
  }
  if (isStockOpname) {
    return `Pada hari ini ${dayName} tanggal ${dayPad} bulan ${monthName} Tahun ${yearWords}, kami yang bertanda tangan di bawah ini`;
  }
  if (isDinasPendidikanRekon) {
    return `Pada Hari Ini ${dayName} tanggal ${dayPad} ${monthName} Tahun ${yearWords}, Kami Yang Bertanda Tangan di Bawah Ini :`;
  }
  return `Pada hari ini ${dayName} tanggal ${dayPad} bulan ${monthName} tahun ${yearWords}, kami yang bertanda tangan di bawah ini :`;
};

export const ReceiptPrintView: React.FC<ReceiptPrintViewProps> = ({
  variant = 'rekon',
  reklasSubView,
  onReklasSubViewChange,
  initialExpense,
  allExpenses,
  schoolInfo,
  onBack,
  isAdmin = false,
  currentUser = null,
  barangEkstraItems,
  selectedUpt,
  onUptChange,
  initialShowOnlyFilledRows = true,
  onShowOnlyFilledRowsChange,
}) => {
  const isStockOpname = variant === 'stock_opname';

  // Sub-view state for Berita Acara Reklas Barang Ekstra (1. BA Reklas Barang Ekstra, 2. Lampiran 1, 3. Lampiran 2)
  const [internalReklasSubView, setInternalReklasSubView] = useState<ReklasSubView>(
    reklasSubView || 'ba_reklas'
  );
  const activeReklasSubView = reklasSubView !== undefined ? reklasSubView : internalReklasSubView;
  const handleSelectReklasSubView = (sub: ReklasSubView) => {
    setInternalReklasSubView(sub);
    if (onReklasSubViewChange) {
      onReklasSubViewChange(sub);
    }
  };
  const [isReklasSubDropdownOpen, setIsReklasSubDropdownOpen] = useState(false);
  const reklasSubDropdownRef = useRef<HTMLDivElement>(null);

  // Internal UPT state synced with selectedUpt prop
  const [internalUpt, setInternalUpt] = useState<string>(() => {
    if (selectedUpt) return selectedUpt;
    if (initialExpense?.schoolName) return initialExpense.schoolName;
    if (!isAdmin && currentUser?.schoolName) return currentUser.schoolName;
    return 'Semua';
  });

  const activeUpt = selectedUpt !== undefined ? selectedUpt : internalUpt;

  const handleSelectUpt = (upt: string) => {
    setInternalUpt(upt);
    if (onUptChange) {
      onUptChange(upt);
    }
  };

  const [isReceiptUptModalOpen, setIsReceiptUptModalOpen] = useState(false);
  const [receiptUptSearchInput, setReceiptUptSearchInput] = useState('');
  const receiptUptRef = useRef<HTMLDivElement>(null);
  const receiptUptInputRef = useRef<HTMLInputElement>(null);

  const masterSchools = useMemo(() => loadUptSchools(), [schoolInfo, allExpenses]);

  const receiptAvailableUpts = useMemo(() => {
    const setUpt = new Set<string>(['DINAS PENDIDIKAN']);
    masterSchools.forEach((s) => {
      if (s.upt) setUpt.add(s.upt);
    });
    allExpenses.forEach((e) => {
      if (e.schoolName) setUpt.add(e.schoolName);
    });
    const items = barangEkstraItems && barangEkstraItems.length > 0 ? barangEkstraItems : loadBarangEkstraItems();
    items.forEach((b) => {
      if (b.schoolName) setUpt.add(b.schoolName);
    });
    return Array.from(setUpt).sort((a, b) => {
      if (a === 'DINAS PENDIDIKAN') return -1;
      if (b === 'DINAS PENDIDIKAN') return 1;
      return a.localeCompare(b);
    });
  }, [masterSchools, allExpenses, barangEkstraItems]);

  const receiptFilteredUptOptions = useMemo(() => {
    if (!receiptUptSearchInput.trim()) return receiptAvailableUpts;
    const q = receiptUptSearchInput.trim().toLowerCase();
    const normQ = normalizeUptKey(receiptUptSearchInput).toLowerCase();
    return receiptAvailableUpts.filter((u) => {
      const uLower = u.toLowerCase();
      const normULower = normalizeUptKey(u).toLowerCase();
      return uLower.includes(q) || normULower.includes(q) || (normQ && normULower.includes(normQ));
    });
  }, [receiptAvailableUpts, receiptUptSearchInput]);

  // Close UPT and Reklas sub-view dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (receiptUptRef.current && !receiptUptRef.current.contains(event.target as Node)) {
        setIsReceiptUptModalOpen(false);
      }
      if (reklasSubDropdownRef.current && !reklasSubDropdownRef.current.contains(event.target as Node)) {
        setIsReklasSubDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Multi-select checkable TW state: defaults to initialExpense's mergedQuarters or triwulan if opened from a specific item, else all TWs
  const [selectedQuarters, setSelectedQuarters] = useState<Triwulan[]>(() =>
    initialExpense?.mergedQuarters && initialExpense.mergedQuarters.length > 0
      ? initialExpense.mergedQuarters
      : initialExpense?.triwulan
      ? [initialExpense.triwulan]
      : ['TW1', 'TW2', 'TW3', 'TW4']
  );
  const [isComboOpen, setIsComboOpen] = useState<boolean>(false);
  const comboRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const handleTriggerDatePicker = () => {
    if (dateInputRef.current) {
      try {
        if ('showPicker' in HTMLInputElement.prototype) {
          dateInputRef.current.showPicker();
        } else {
          dateInputRef.current.focus();
        }
      } catch {
        dateInputRef.current?.focus();
      }
    }
  };

  const [showOnlyFilledRows, setShowOnlyFilledRows] = useState<boolean>(
    initialShowOnlyFilledRows ?? true
  );

  // Per-row optional overrides for Stock Opname table (Satuan, Fisik Barang Hasil, Kondisi Barang)
  const [stockOpnameCustomRows, setStockOpnameCustomRows] = useState<
    Record<string, StockOpnameRowCustom>
  >({});

  const tahunAnggaranBerjalan =
    Number(schoolInfo.tahunAnggaran) || new Date().getFullYear();

  // Sync selectedQuarters if initialExpense prop changes
  useEffect(() => {
    if (initialExpense?.mergedQuarters && initialExpense.mergedQuarters.length > 0) {
      setSelectedQuarters(initialExpense.mergedQuarters);
    } else if (initialExpense?.triwulan) {
      setSelectedQuarters([initialExpense.triwulan]);
    }
  }, [initialExpense]);

  // Close combo box dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (comboRef.current && !comboRef.current.contains(target)) {
        setIsComboOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleQuarter = (tw: Triwulan) => {
    setSelectedQuarters((prev) => {
      const exists = prev.includes(tw);
      const next = exists ? prev.filter((q) => q !== tw) : [...prev, tw];
      return ALL_QUARTERS.map((q) => q.id).filter((id) => next.includes(id));
    });
  };

  const toggleAllQuarters = () => {
    setSelectedQuarters((prev) =>
      prev.length === ALL_QUARTERS.length
        ? []
        : ALL_QUARTERS.map((q) => q.id)
    );
  };

  // Combo box button display label
  const comboButtonLabel = useMemo(() => {
    if (selectedQuarters.length === 0) {
      return 'Pilih Filter Triwulan...';
    }
    if (selectedQuarters.length === 1) {
      const found = ALL_QUARTERS.find((q) => q.id === selectedQuarters[0]);
      return `Filter: ${found ? found.label : selectedQuarters[0]}`;
    }
    if (selectedQuarters.length === ALL_QUARTERS.length) {
      return 'Semua Triwulan (TW1 - TW4)';
    }
    return `Gabungan: ${selectedQuarters.join(', ')}`;
  }, [selectedQuarters]);

  // Values derived directly from Profil Sekolah (schoolInfo)
  const defaultPemda =
    schoolInfo.kabupaten &&
    schoolInfo.kabupaten.trim().toLowerCase() !== 'kota bandung' &&
    schoolInfo.kabupaten.trim().toLowerCase() !== 'pemerintah kota bandung'
      ? schoolInfo.kabupaten.toUpperCase().startsWith('PEMERINTAH')
        ? schoolInfo.kabupaten.toUpperCase()
        : schoolInfo.kabupaten.toUpperCase().startsWith('KABUPATEN') ||
          schoolInfo.kabupaten.toUpperCase().startsWith('KOTA')
        ? `PEMERINTAH ${schoolInfo.kabupaten.toUpperCase()}`
        : `PEMERINTAH KABUPATEN ${schoolInfo.kabupaten.toUpperCase()}`
      : 'PEMERINTAH KABUPATEN MINAHASA TENGGARA';

  const defaultNamaSekolah = initialExpense?.schoolName
    ? initialExpense.schoolName.toUpperCase()
    : schoolInfo.namaSekolah
    ? schoolInfo.namaSekolah.toUpperCase()
    : 'SMP NEGERI 2 TOULUAAN';

  // Pengurus Barang mengikuti data Bendahara Barang di Profil Sekolah
  const defaultNamaPengurusBarang =
    schoolInfo.bendaharaBarang?.trim() || 'PRISILIA DEBORA MANGKANG, S.Pd';
  const defaultNipPengurusBarang =
    schoolInfo.nipBendaharaBarang?.trim() || '199304302020122013';

  // Kepala Sekolah mengikuti data Kepala Sekolah di Profil Sekolah
  const defaultNamaKepalaSekolah =
    schoolInfo.kepalaSekolah?.trim() || 'MEYGEVER ONSU,S.Pd.,M.Pd';
  const defaultNipKepalaSekolah =
    schoolInfo.nipKepalaSekolah?.trim() || '199205132019031006';

  const isDinasPendidikanUpt = useMemo(() => {
    if (activeUpt && activeUpt !== 'Semua') {
      return (
        normalizeUptKey(activeUpt) === 'DINAS PENDIDIKAN' ||
        activeUpt.toUpperCase().includes('DINAS PENDIDIKAN')
      );
    }
    if (!isAdmin && currentUser?.schoolName) {
      return (
        normalizeUptKey(currentUser.schoolName) === 'DINAS PENDIDIKAN' ||
        currentUser.schoolName.toUpperCase().includes('DINAS PENDIDIKAN')
      );
    }
    return (
      normalizeUptKey(defaultNamaSekolah) === 'DINAS PENDIDIKAN' ||
      defaultNamaSekolah.toUpperCase().includes('DINAS PENDIDIKAN')
    );
  }, [activeUpt, isAdmin, currentUser?.schoolName, defaultNamaSekolah]);

  const isDinasPendidikanRekon = variant === 'rekon' && isDinasPendidikanUpt;

  // Editable Berita Acara metadata state
  const [pemerintahDaerah, setPemerintahDaerah] = useState(defaultPemda);
  const [dinasHeader, setDinasHeader] = useState('DINAS PENDIDIKAN');
  const [namaSekolahHeader, setNamaSekolahHeader] = useState(defaultNamaSekolah);
  const [periodeTahunAnggaran, setPeriodeTahunAnggaran] = useState(() =>
    buildPeriodeTahunAnggaran(
      initialExpense?.mergedQuarters && initialExpense.mergedQuarters.length > 0
        ? initialExpense.mergedQuarters
        : initialExpense?.triwulan
        ? [initialExpense.triwulan]
        : ['TW1', 'TW2', 'TW3', 'TW4'],
      tahunAnggaranBerjalan,
      variant,
      variant === 'rekon' &&
        normalizeUptKey(
          selectedUpt ||
            initialExpense?.schoolName ||
            (!isAdmin && currentUser?.schoolName ? currentUser.schoolName : '')
        ) === 'DINAS PENDIDIKAN'
    )
  );
  const [cutOffDate, setCutOffDate] = useState(() =>
    computeCutOffDate(
      initialExpense?.mergedQuarters && initialExpense.mergedQuarters.length > 0
        ? initialExpense.mergedQuarters
        : initialExpense?.triwulan
        ? [initialExpense.triwulan]
        : ['TW1', 'TW2', 'TW3', 'TW4'],
      tahunAnggaranBerjalan
    )
  );

  // Tanggal laporan Berita Acara yang dipilih pengguna (mempengaruhi Hari, Tanggal, dan Tahun)
  const defaultReportDate = `${tahunAnggaranBerjalan}-07-01`;
  const [selectedReportDate, setSelectedReportDate] =
    useState<string>(defaultReportDate);
  const reportDateInfo = useMemo(
    () => parseReportDateComponents(selectedReportDate),
    [selectedReportDate]
  );

  const [labelSaldoAwalHeader, setLabelSaldoAwalHeader] = useState(
    `SALDO AWAL PER 1 JANUARI ${tahunAnggaranBerjalan}`
  );
  const [kalimatPembuka, setKalimatPembuka] = useState(() =>
    formatOpeningParagraph(
      defaultReportDate,
      variant,
      isStockOpname,
      isDinasPendidikanRekon
    )
  );

  const handleReportDateChange = (newDateStr: string) => {
    if (!newDateStr) return;
    setSelectedReportDate(newDateStr);
    const newKalimat = formatOpeningParagraph(
      newDateStr,
      variant,
      isStockOpname,
      isDinasPendidikanRekon
    );
    setKalimatPembuka(newKalimat);
  };

  // Sinkronisasi kalimat pembuka bila variant atau jenis dokumen berganti
  useEffect(() => {
    if (selectedReportDate) {
      setKalimatPembuka(
        formatOpeningParagraph(
          selectedReportDate,
          variant,
          isStockOpname,
          isDinasPendidikanRekon
        )
      );
    }
  }, [variant, isStockOpname, isDinasPendidikanRekon, selectedReportDate]);

  const isReklas = variant === 'reklas_barang_ekstra';
  const defaultNamaPengurusReklas = 'YOSEP TOMPUNU, A.Ma.TE';
  const defaultNipPengurusReklas = '19800512 201411 1 002';
  const defaultNamaPejabatPenatausahaanReklas = 'MELANI N.E. ANGGORONGGANG, S.Th';
  const defaultNipPejabatPenatausahaanReklas = '19821104 200902 2 001';
  const defaultNamaPejabatFooterReklas = 'MELANI N.E. ANGGORONGGANG, S.Th,M.Pd.K';
  const defaultNamaKadisReklas = 'SARAH I. KINDANGEN, S.Pd, M.Pd';
  const defaultNipKadisReklas = '19830923 200902 2 004';

  // Pejabat khusus BA Rekon Kantor UPT DINAS PENDIDIKAN sesuai file BA_REKON_KANTOR
  const defaultNamaPengurusDinasRekon = 'JOSEPH TOMPUNU, A.Ma.TE';
  const defaultNipPengurusDinasRekon = '19800512 201411 1 002';
  const defaultNamaPejabatDinasRekon = 'ASNI A. LUBIS, SE';
  const defaultNipPejabatDinasRekonTop = '1973041 719930 3 2008';
  const defaultNipPejabatDinasRekonFooter = '19730417 199303 2 008';
  const defaultNamaKabidBmdDinasRekon = 'ENRICO R.SARILIM, SH';
  const defaultNipKabidBmdDinasRekon = '19870711 201102 1 001';
  const defaultNamaKabidAkuntansiDinasRekon = 'DEBORA R. PELEALU, S.STP,M.Si';
  const defaultNipKabidAkuntansiDinasRekon = '19940630 201609 2 002';
  const defaultNamaKadisDinasRekon = 'NOLLY MOZES RATELA. S.Pd., M.Ed';
  const defaultNipKadisDinasRekon = '19691111 199603 1 007';

  const [namaPihak1, setNamaPihak1] = useState(
    isReklas
      ? defaultNamaPengurusReklas
      : isDinasPendidikanRekon
      ? defaultNamaPengurusDinasRekon
      : defaultNamaPengurusBarang
  );
  const [nipPihak1, setNipPihak1] = useState(
    isReklas
      ? defaultNipPengurusReklas
      : isDinasPendidikanRekon
      ? defaultNipPengurusDinasRekon
      : defaultNipPengurusBarang
  );
  const [jabatanPihak1, setJabatanPihak1] = useState(
    isReklas
      ? 'Pengurus Barang'
      : variant === 'barang_ekstra'
      ? 'Pengurus Barang'
      : isStockOpname
      ? 'Pengurus Barang Pembantu'
      : 'Pengurus Barang'
  );

  const [namaPihak2, setNamaPihak2] = useState(
    isReklas
      ? defaultNamaPejabatPenatausahaanReklas
      : isDinasPendidikanRekon
      ? defaultNamaPejabatDinasRekon
      : defaultNamaKepalaSekolah
  );
  const [nipPihak2, setNipPihak2] = useState(
    isReklas
      ? defaultNipPejabatPenatausahaanReklas
      : isDinasPendidikanRekon
      ? defaultNipPejabatDinasRekonTop
      : defaultNipKepalaSekolah
  );
  const [jabatanPihak2, setJabatanPihak2] = useState(
    isReklas
      ? 'Pejabat Penatausahaan Barang'
      : isDinasPendidikanRekon
      ? 'Kasubag Umum dan Kepegawaian'
      : 'Kepala Sekolah'
  );

  const [namaPengurusPembantuFooter, setNamaPengurusPembantuFooter] = useState(
    isReklas ? defaultNamaPejabatFooterReklas : defaultNamaPengurusBarang
  );
  const [nipPengurusPembantuFooter, setNipPengurusPembantuFooter] = useState(
    isReklas ? defaultNipPejabatPenatausahaanReklas : defaultNipPengurusBarang
  );

  const [namaPengurusBarangFooter, setNamaPengurusBarangFooter] = useState(
    isReklas
      ? defaultNamaPengurusReklas
      : isDinasPendidikanRekon
      ? defaultNamaPengurusDinasRekon
      : defaultNamaPengurusBarang
  );
  const [nipPengurusBarangFooter, setNipPengurusBarangFooter] = useState(
    isReklas
      ? '198005122014111002'
      : isDinasPendidikanRekon
      ? defaultNipPengurusDinasRekon
      : defaultNipPengurusBarang
  );

  const [namaKepsekFooter, setNamaKepsekFooter] = useState(
    isReklas
      ? defaultNamaKadisReklas
      : isDinasPendidikanRekon
      ? defaultNamaKadisDinasRekon
      : defaultNamaKepalaSekolah
  );
  const [nipKepsekFooter, setNipKepsekFooter] = useState(
    isReklas
      ? defaultNipKadisReklas
      : isDinasPendidikanRekon
      ? defaultNipKadisDinasRekon
      : defaultNipKepalaSekolah
  );

  // Sinkronisasi penandatangan resmi bila membuka varian Reklas Barang Ekstra
  useEffect(() => {
    if (variant === 'reklas_barang_ekstra') {
      setNamaPihak1(defaultNamaPengurusReklas);
      setNipPihak1(defaultNipPengurusReklas);
      setJabatanPihak1('Pengurus Barang');
      setNamaPihak2(defaultNamaPejabatPenatausahaanReklas);
      setNipPihak2(defaultNipPejabatPenatausahaanReklas);
      setJabatanPihak2('Pejabat Penatausahaan Barang');
      setNamaPengurusBarangFooter(defaultNamaPengurusReklas);
      setNipPengurusBarangFooter('198005122014111002');
      setNamaPengurusPembantuFooter(defaultNamaPejabatFooterReklas);
      setNipPengurusPembantuFooter(defaultNipPejabatPenatausahaanReklas);
      setNamaKepsekFooter(defaultNamaKadisReklas);
      setNipKepsekFooter(defaultNipKadisReklas);
    }
  }, [variant]);

  // Sync automatically whenever selectedQuarters or tahunAnggaranBerjalan changes
  useEffect(() => {
    setPeriodeTahunAnggaran(
      buildPeriodeTahunAnggaran(
        selectedQuarters,
        tahunAnggaranBerjalan,
        variant,
        isDinasPendidikanRekon
      )
    );
    setLabelSaldoAwalHeader(`SALDO AWAL PER 1 JANUARI ${tahunAnggaranBerjalan}`);
    setCutOffDate(computeCutOffDate(selectedQuarters, tahunAnggaranBerjalan));
  }, [selectedQuarters, tahunAnggaranBerjalan, variant, isDinasPendidikanRekon]);

  // Sync automatically whenever activeUpt changes to set appropriate principal & inventory keeper
  useEffect(() => {
    if (variant === 'reklas_barang_ekstra') return;
    if (isDinasPendidikanRekon) {
      setNamaSekolahHeader('DINAS PENDIDIKAN');
      setNamaPihak1(defaultNamaPengurusDinasRekon);
      setNipPihak1(defaultNipPengurusDinasRekon);
      setJabatanPihak1('Pengurus Barang');
      setNamaPihak2(defaultNamaPejabatDinasRekon);
      setNipPihak2(defaultNipPejabatDinasRekonTop);
      setJabatanPihak2('Kasubag Umum dan Kepegawaian');
      setNamaPengurusBarangFooter(defaultNamaPengurusDinasRekon);
      setNipPengurusBarangFooter(defaultNipPengurusDinasRekon);
      setNamaPengurusPembantuFooter(defaultNamaPejabatDinasRekon);
      setNipPengurusPembantuFooter(defaultNipPejabatDinasRekonFooter);
      setNamaKepsekFooter(defaultNamaKadisDinasRekon);
      setNipKepsekFooter(defaultNipKadisDinasRekon);
      return;
    }
    if (activeUpt && activeUpt !== 'Semua') {
      const targetSchool = masterSchools.find(
        (s) =>
          s.upt.toLowerCase() === activeUpt.toLowerCase() ||
          normalizeUptKey(s.upt) === normalizeUptKey(activeUpt)
      );
      setJabatanPihak1(isStockOpname ? 'Pengurus Barang Pembantu' : 'Pengurus Barang');
      setJabatanPihak2('Kepala Sekolah');
      if (targetSchool) {
        setNamaSekolahHeader(targetSchool.upt);
        if (targetSchool.pengurusBarang) {
          setNamaPihak1(targetSchool.pengurusBarang);
          setNamaPengurusPembantuFooter(targetSchool.pengurusBarang);
          setNamaPengurusBarangFooter(targetSchool.pengurusBarang);
        }
        if (targetSchool.nipPengurusBarang) {
          setNipPihak1(targetSchool.nipPengurusBarang);
          setNipPengurusPembantuFooter(targetSchool.nipPengurusBarang);
          setNipPengurusBarangFooter(targetSchool.nipPengurusBarang);
        }
        if (targetSchool.kepalaSekolah) {
          setNamaPihak2(targetSchool.kepalaSekolah);
          setNamaKepsekFooter(targetSchool.kepalaSekolah);
        }
        if (targetSchool.nipKepalaSekolah) {
          setNipPihak2(targetSchool.nipKepalaSekolah);
          setNipKepsekFooter(targetSchool.nipKepalaSekolah);
        }
      } else {
        setNamaSekolahHeader(activeUpt);
      }
    } else if (activeUpt === 'Semua') {
      setJabatanPihak1(isStockOpname ? 'Pengurus Barang Pembantu' : 'Pengurus Barang');
      setJabatanPihak2('Kepala Sekolah');
      setNamaSekolahHeader(defaultNamaSekolah);
      setNamaPihak1(defaultNamaPengurusBarang);
      setNipPihak1(defaultNipPengurusBarang);
      setNamaPihak2(defaultNamaKepalaSekolah);
      setNipPihak2(defaultNipKepalaSekolah);
      setNamaPengurusPembantuFooter(defaultNamaPengurusBarang);
      setNipPengurusPembantuFooter(defaultNipPengurusBarang);
      setNamaKepsekFooter(defaultNamaKepalaSekolah);
      setNipKepsekFooter(defaultNipKepalaSekolah);
    }
  }, [
    activeUpt,
    variant,
    isStockOpname,
    isDinasPendidikanRekon,
    masterSchools,
    defaultNamaSekolah,
    defaultNamaPengurusBarang,
    defaultNipPengurusBarang,
    defaultNamaKepalaSekolah,
    defaultNipKepalaSekolah,
  ]);

  // Filter expenses based on checked Triwulan (selectedQuarters) and active UPT school
  // Untuk Belanja Pemeliharaan, Tanggal pada rincian Nilai Masuk & Keluar menentukan masuk di TW berapa
  const filteredExpenses = useMemo(() => {
    if (selectedQuarters.length === 0) return [];
    const hasExplicitDinasPemeliharaan = allExpenses.some((e) => {
      const isPem =
        e.kategoriBelanja === 'pemeliharaan' ||
        Boolean(
          e.rincianItems &&
            e.rincianItems.some(
              (it) => it.nilaiJasa !== undefined || it.nilaiBarang !== undefined
            )
        );
      const upt = (e.schoolName || '').trim();
      return (
        isPem &&
        (normalizeUptKey(upt) === 'DINAS PENDIDIKAN' ||
          upt.toUpperCase().includes('DINAS PENDIDIKAN'))
      );
    });

    const result: SchoolExpense[] = [];
    for (const e of allExpenses) {
      if (activeUpt && activeUpt !== 'Semua') {
        const itemUpt = (e.schoolName || schoolInfo.namaSekolah || '').trim();
        const matchesUpt =
          itemUpt.toLowerCase() === activeUpt.toLowerCase() ||
          normalizeUptKey(itemUpt) === normalizeUptKey(activeUpt);
        const isPemeliharaan =
          e.kategoriBelanja === 'pemeliharaan' ||
          Boolean(
            e.rincianItems &&
              e.rincianItems.some(
                (it) => it.nilaiJasa !== undefined || it.nilaiBarang !== undefined
              )
          );
        if (
          !matchesUpt &&
          !(isDinasPendidikanRekon && isPemeliharaan && !hasExplicitDinasPemeliharaan)
        ) {
          continue;
        }
      } else if (initialExpense?.schoolName && e.schoolName) {
        if (e.schoolName.trim().toLowerCase() !== initialExpense.schoolName.trim().toLowerCase()) {
          continue;
        }
      }
      const quarterFiltered = filterExpenseByQuarters(e, selectedQuarters);
      if (quarterFiltered) {
        result.push(quarterFiltered);
      }
    }
    return result;
  }, [
    allExpenses,
    selectedQuarters,
    initialExpense,
    activeUpt,
    schoolInfo.namaSekolah,
    isDinasPendidikanRekon,
  ]);

  // Filtered approved items for Berita Acara Barang Ekstra
  const rawBarangEkstra = barangEkstraItems && barangEkstraItems.length > 0 ? barangEkstraItems : loadBarangEkstraItems();

  const displayBarangEkstra = useMemo(() => {
    return rawBarangEkstra
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
        // 1. Wajib hanya barang ekstra yang sudah di-approve
        if (item.status !== 'Disetujui Kepala Sekolah') return false;

        // 2. Filter UPT terpilih
        const currentUptFilter = activeUpt || (initialExpense?.schoolName || (currentUser?.role === 'Operator BOSP' ? (currentUser.schoolName || schoolInfo.namaSekolah) : 'Semua'));
        if (currentUptFilter && currentUptFilter !== 'Semua') {
          const itemUpt = (item.schoolName || '').trim();
          return (
            itemUpt.toLowerCase() === currentUptFilter.toLowerCase() ||
          normalizeUptKey(itemUpt) === normalizeUptKey(currentUptFilter)
        );
      }
      return true;
    });
  }, [rawBarangEkstra, activeUpt, initialExpense, currentUser, schoolInfo.namaSekolah]);

  // Data untuk Lampiran 1 (Pembelian Barang Ekstrakomptabel pada Tahun Berjalan)
  const lampiran1BarangEkstra = useMemo(() => {
    const filteredYear = displayBarangEkstra.filter((item) => {
      const yr = Number(
        item.tahunAnggaran ||
          (item.tanggalPerolehan
            ? new Date(item.tanggalPerolehan).getFullYear()
            : tahunAnggaranBerjalan)
      );
      return yr === Number(tahunAnggaranBerjalan);
    });
    return filteredYear.length > 0 ? filteredYear : displayBarangEkstra;
  }, [displayBarangEkstra, tahunAnggaranBerjalan]);

  // Aggregate values per Kode Rekening across filteredExpenses
  const aggregatedMap = useMemo(() => {
    const map: Record<
      string,
      {
        nominalSaldoAwal: number;
        nominalBelanjaLra: number;
        nominalPengakuanBast: number;
        nominalPengeluaranSaldoAwal: number;
        nominalPengeluaranBelanja: number;
        nominalPengeluaranBast: number;
        nominalHibahMasuk: number;
        nominalHibahKeluar: number;
        sisaNilai: number;
        satuanDefault: string;
        hasActivity: boolean;
        isPemeliharaan?: boolean;
      }
    > = {};

    // Initialize all 81 standard options with 0
    for (const rekening of REKENING_PERSEDIAAN_OPTIONS) {
      map[rekening] = {
        nominalSaldoAwal: 0,
        nominalBelanjaLra: 0,
        nominalPengakuanBast: 0,
        nominalPengeluaranSaldoAwal: 0,
        nominalPengeluaranBelanja: 0,
        nominalPengeluaranBast: 0,
        nominalHibahMasuk: 0,
        nominalHibahKeluar: 0,
        sisaNilai: 0,
        satuanDefault: '',
        hasActivity: false,
        isPemeliharaan: false,
      };
    }

    const pemeliharaanKeysSet = new Set<string>(
      REKENING_PEMELIHARAAN_OPTIONS.map((k) => k.trim().toLowerCase())
    );
    pemeliharaanKeysSet.add('belanja pemeliharaan suku cadang lainnya');

    for (const expense of filteredExpenses) {
      const items =
        expense.rincianItems && expense.rincianItems.length > 0
          ? expense.rincianItems
          : [
              {
                id: expense.id,
                kodeRekening: expense.kodeRekening,
                saldoAwal: expense.saldoAwal || 'Bukan Saldo Awal',
                saldoAwalMasuk:
                  expense.saldoAwalMasuk ||
                  expense.saldoAwal ||
                  'Bukan Saldo Awal',
                saldoAwalKeluar: expense.saldoAwalKeluar || 'Bukan Saldo Awal',
                isHibah: Boolean(expense.isHibah),
                nilaiSaldoAwal: expense.nilaiSaldoAwal,
                nilaiBelanjaLra: expense.nilaiBelanjaLra,
                nilaiPengakuanBast: 0,
                pengeluaranSaldoAwal: expense.pengeluaranSaldoAwal,
                pengeluaranBelanja: expense.pengeluaranBelanja,
                pengeluaranBast: 0,
                hibahMasuk: expense.hibahMasuk,
                hibahKeluar: expense.hibahKeluar,
                nilaiMasuk: expense.nilaiMasuk ?? expense.subtotal ?? 0,
                nilaiKeluar: expense.nilaiKeluar ?? 0,
                sisaNilai: expense.sisaNilai ?? 0,
              },
            ];

      for (const item of items) {
        const key = item.kodeRekening;
        if (!key) continue;

        const keyNorm = key.trim().toLowerCase();
        const isPemeliharaanRekening =
          expense.kategoriBelanja === 'pemeliharaan' ||
          item.nilaiJasa !== undefined ||
          item.nilaiBarang !== undefined ||
          pemeliharaanKeysSet.has(keyNorm) ||
          keyNorm.startsWith('belanja pemeliharaan');

        const masukType =
          item.saldoAwalMasuk || item.saldoAwal || 'Bukan Saldo Awal';
        const keluarType = item.saldoAwalKeluar || 'Bukan Saldo Awal';
        const hibah = Boolean(item.isHibah);

        let nominalSaldoAwal = 0;
        let nominalBelanjaLra = 0;
        let nominalPengakuanBast = 0;
        let nominalPengeluaranSaldoAwal = 0;
        let nominalPengeluaranBelanja = 0;
        let nominalPengeluaranBast = 0;
        let nominalHibahMasuk = 0;
        let nominalHibahKeluar = 0;

        if (isPemeliharaanRekening) {
          // Khusus Rekening Belanja Pemeliharaan pada Berita Acara Rekon Persediaan (Akun Dinas):
          // - Nilai Belanja LRA = Total Nilai Jasa + Barang per Rekening Belanja Pemeliharaan
          // - Pengeluaran Belanja = Total Nilai Jasa + Barang per Rekening Belanja Pemeliharaan
          // - Nilai Pengakuan BAST = Total Nilai Barang per Rekening Belanja Pemeliharaan
          // - BAST Diluar Belanja = Total Nilai Barang per Rekening Belanja Pemeliharaan
          const hasExplicitJasaBarang =
            item.nilaiJasa !== undefined || item.nilaiBarang !== undefined;
          const totalNilaiJasa = hasExplicitJasaBarang ? Number(item.nilaiJasa) || 0 : 0;
          const totalNilaiBarang = hasExplicitJasaBarang
            ? Number(item.nilaiBarang) || 0
            : Number(item.nilaiPengakuanBast) ||
              Number(item.pengeluaranBast) ||
              0;
          const totalJasaTambahBarang = hasExplicitJasaBarang
            ? totalNilaiJasa + totalNilaiBarang
            : Number(item.nilaiBelanjaLra) || Number(item.nilaiMasuk) || 0;

          if (isDinasPendidikanRekon) {
            nominalBelanjaLra = totalJasaTambahBarang;
            nominalPengakuanBast = totalNilaiBarang;
            nominalPengeluaranBelanja = totalJasaTambahBarang;
            nominalPengeluaranBast = totalNilaiBarang;
          } else {
            nominalBelanjaLra = totalJasaTambahBarang;
            nominalPengakuanBast = 0;
            nominalPengeluaranBelanja = totalJasaTambahBarang;
            nominalPengeluaranBast = 0;
          }
        } else {
          nominalSaldoAwal =
            item.nilaiSaldoAwal !== undefined
              ? item.nilaiSaldoAwal
              : !hibah && masukType === 'Saldo Awal'
              ? item.nilaiMasuk
              : 0;
          nominalBelanjaLra =
            item.nilaiBelanjaLra !== undefined
              ? item.nilaiBelanjaLra
              : !hibah && masukType === 'Bukan Saldo Awal'
              ? item.nilaiMasuk
              : 0;
          nominalPengakuanBast = item.nilaiPengakuanBast || 0;
          nominalPengeluaranSaldoAwal =
            item.pengeluaranSaldoAwal !== undefined
              ? item.pengeluaranSaldoAwal
              : !hibah && keluarType === 'Saldo Awal'
              ? item.nilaiKeluar
              : 0;
          nominalPengeluaranBelanja =
            item.pengeluaranBelanja !== undefined
              ? item.pengeluaranBelanja
              : !hibah && keluarType === 'Bukan Saldo Awal'
              ? item.nilaiKeluar
              : 0;
          nominalPengeluaranBast = item.pengeluaranBast || 0;
          nominalHibahMasuk =
            item.hibahMasuk !== undefined
              ? item.hibahMasuk
              : hibah
              ? item.nilaiMasuk
              : 0;
          nominalHibahKeluar =
            item.hibahKeluar !== undefined
              ? item.hibahKeluar
              : hibah
              ? item.nilaiKeluar
              : 0;
        }

        if (!map[key]) {
          map[key] = {
            nominalSaldoAwal: 0,
            nominalBelanjaLra: 0,
            nominalPengakuanBast: 0,
            nominalPengeluaranSaldoAwal: 0,
            nominalPengeluaranBelanja: 0,
            nominalPengeluaranBast: 0,
            nominalHibahMasuk: 0,
            nominalHibahKeluar: 0,
            sisaNilai: 0,
            satuanDefault: '',
            hasActivity: false,
            isPemeliharaan: false,
          };
        }

        if (isPemeliharaanRekening) {
          map[key].isPemeliharaan = true;
        }

        map[key].nominalSaldoAwal += nominalSaldoAwal;
        map[key].nominalBelanjaLra += nominalBelanjaLra;
        map[key].nominalPengakuanBast += nominalPengakuanBast;
        map[key].nominalPengeluaranSaldoAwal += nominalPengeluaranSaldoAwal;
        map[key].nominalPengeluaranBelanja += nominalPengeluaranBelanja;
        map[key].nominalPengeluaranBast += nominalPengeluaranBast;
        map[key].nominalHibahMasuk += nominalHibahMasuk;
        map[key].nominalHibahKeluar += nominalHibahKeluar;

        if (!map[key].satuanDefault && expense.satuan) {
          map[key].satuanDefault = expense.satuan;
        }

        const totalMasukPersediaan =
          map[key].nominalSaldoAwal +
          map[key].nominalBelanjaLra +
          map[key].nominalPengakuanBast +
          map[key].nominalHibahMasuk;
        const totalKeluarPersediaan =
          map[key].nominalPengeluaranSaldoAwal +
          map[key].nominalPengeluaranBelanja +
          map[key].nominalPengeluaranBast +
          map[key].nominalHibahKeluar;
        map[key].sisaNilai = totalMasukPersediaan - totalKeluarPersediaan;
        if (
          map[key].nominalBelanjaLra > 0 ||
          totalMasukPersediaan > 0 ||
          totalKeluarPersediaan > 0 ||
          map[key].sisaNilai !== 0
        ) {
          map[key].hasActivity = true;
        }
      }
    }

    return map;
  }, [filteredExpenses, isDinasPendidikanRekon]);

  const tableRows = useMemo(() => {
    const allKeys = Array.from(
      new Set([
        ...REKENING_PERSEDIAAN_OPTIONS,
        ...Object.keys(aggregatedMap),
      ])
    );

    const rows = allKeys.map((kodeRekening) => {
      const data = aggregatedMap[kodeRekening] || {
        nominalSaldoAwal: 0,
        nominalBelanjaLra: 0,
        nominalPengakuanBast: 0,
        nominalPengeluaranSaldoAwal: 0,
        nominalPengeluaranBelanja: 0,
        nominalPengeluaranBast: 0,
        nominalHibahMasuk: 0,
        nominalHibahKeluar: 0,
        sisaNilai: 0,
        satuanDefault: '',
        hasActivity: false,
      };
      return {
        kodeRekening,
        ...data,
      };
    });

    if (showOnlyFilledRows) {
      return rows.filter(
        (r) =>
          r.nominalSaldoAwal > 0 ||
          r.nominalBelanjaLra > 0 ||
          r.nominalPengakuanBast > 0 ||
          r.nominalPengeluaranSaldoAwal > 0 ||
          r.nominalPengeluaranBelanja > 0 ||
          r.nominalPengeluaranBast > 0 ||
          r.nominalHibahMasuk > 0 ||
          r.nominalHibahKeluar > 0 ||
          r.sisaNilai !== 0
      );
    }

    return rows;
  }, [aggregatedMap, showOnlyFilledRows]);

  // Data agregasi khusus untuk BA Rekon Gabung Sekolah (Tabel 1: BOP TK, SKB | Tabel 2: SEKOLAH DASAR | Tabel 3: SMPN)
  const rekonGabungSekolahData = useMemo(() => {
    type GroupCellData = {
      nominalSaldoAwal: number;
      nominalBelanjaLra: number;
      nominalPengeluaranSaldoAwal: number;
      nominalPengeluaranBelanja: number;
      nominalHibahMasuk: number;
      nominalHibahKeluar: number;
      sisaNilai: number;
    };

    const groupMaps: Record<'PAUD' | 'SD' | 'SMP', Record<string, GroupCellData>> = {
      PAUD: {},
      SD: {},
      SMP: {},
    };

    const pemeliharaanKeysSet = new Set<string>(
      REKENING_PEMELIHARAAN_OPTIONS.map((k) => k.trim().toLowerCase())
    );
    pemeliharaanKeysSet.add('belanja pemeliharaan suku cadang lainnya');

    if (selectedQuarters.length > 0) {
      for (const rawExp of allExpenses) {
        const expense = filterExpenseByQuarters(rawExp, selectedQuarters);
        if (!expense) continue;

        const schoolGroup = classifySchoolForRekonGabung(expense, schoolInfo.namaSekolah);
        if (schoolGroup === 'DINAS') continue;

        const targetMap = groupMaps[schoolGroup];
        const items =
          expense.rincianItems && expense.rincianItems.length > 0
            ? expense.rincianItems
            : [
                {
                  id: expense.id,
                  kodeRekening: expense.kodeRekening,
                  saldoAwal: expense.saldoAwal || 'Bukan Saldo Awal',
                  saldoAwalMasuk:
                    expense.saldoAwalMasuk ||
                    expense.saldoAwal ||
                    'Bukan Saldo Awal',
                  saldoAwalKeluar: expense.saldoAwalKeluar || 'Bukan Saldo Awal',
                  isHibah: Boolean(expense.isHibah),
                  nilaiSaldoAwal: expense.nilaiSaldoAwal,
                  nilaiBelanjaLra: expense.nilaiBelanjaLra,
                  pengeluaranSaldoAwal: expense.pengeluaranSaldoAwal,
                  pengeluaranBelanja: expense.pengeluaranBelanja,
                  hibahMasuk: expense.hibahMasuk,
                  hibahKeluar: expense.hibahKeluar,
                  nilaiMasuk: expense.nilaiMasuk ?? expense.subtotal ?? 0,
                  nilaiKeluar: expense.nilaiKeluar ?? 0,
                  sisaNilai: expense.sisaNilai ?? 0,
                  nilaiJasa: undefined,
                  nilaiBarang: undefined,
                },
              ];

        for (const item of items) {
          const key = item.kodeRekening;
          if (!key) continue;

          const keyNorm = key.trim().toLowerCase();
          const isPemeliharaanRekening =
            expense.kategoriBelanja === 'pemeliharaan' ||
            item.nilaiJasa !== undefined ||
            item.nilaiBarang !== undefined ||
            pemeliharaanKeysSet.has(keyNorm) ||
            keyNorm.startsWith('belanja pemeliharaan');

          const masukType =
            item.saldoAwalMasuk || item.saldoAwal || 'Bukan Saldo Awal';
          const keluarType = item.saldoAwalKeluar || 'Bukan Saldo Awal';
          const hibah = Boolean(item.isHibah);

          let nominalSaldoAwal = 0;
          let nominalBelanjaLra = 0;
          let nominalPengeluaranSaldoAwal = 0;
          let nominalPengeluaranBelanja = 0;
          let nominalHibahMasuk = 0;
          let nominalHibahKeluar = 0;

          if (isPemeliharaanRekening) {
            const hasExplicitJasaBarang =
              item.nilaiJasa !== undefined || item.nilaiBarang !== undefined;
            const totalNilaiJasa = hasExplicitJasaBarang ? Number(item.nilaiJasa) || 0 : 0;
            const totalNilaiBarang = hasExplicitJasaBarang ? Number(item.nilaiBarang) || 0 : 0;
            const totalJasaTambahBarang = hasExplicitJasaBarang
              ? totalNilaiJasa + totalNilaiBarang
              : Number(item.nilaiBelanjaLra) || Number(item.nilaiMasuk) || 0;

            nominalBelanjaLra = totalJasaTambahBarang;
            nominalPengeluaranBelanja = totalJasaTambahBarang;
          } else {
            nominalSaldoAwal =
              item.nilaiSaldoAwal !== undefined
                ? item.nilaiSaldoAwal
                : !hibah && masukType === 'Saldo Awal'
                ? item.nilaiMasuk
                : 0;
            nominalBelanjaLra =
              item.nilaiBelanjaLra !== undefined
                ? item.nilaiBelanjaLra
                : !hibah && masukType === 'Bukan Saldo Awal'
                ? item.nilaiMasuk
                : 0;
            nominalPengeluaranSaldoAwal =
              item.pengeluaranSaldoAwal !== undefined
                ? item.pengeluaranSaldoAwal
                : !hibah && keluarType === 'Saldo Awal'
                ? item.nilaiKeluar
                : 0;
            nominalPengeluaranBelanja =
              item.pengeluaranBelanja !== undefined
                ? item.pengeluaranBelanja
                : !hibah && keluarType === 'Bukan Saldo Awal'
                ? item.nilaiKeluar
                : 0;
            nominalHibahMasuk =
              item.hibahMasuk !== undefined
                ? item.hibahMasuk
                : hibah
                ? item.nilaiMasuk
                : 0;
            nominalHibahKeluar =
              item.hibahKeluar !== undefined
                ? item.hibahKeluar
                : hibah
                ? item.nilaiKeluar
                : 0;
          }

          if (!targetMap[key]) {
            targetMap[key] = {
              nominalSaldoAwal: 0,
              nominalBelanjaLra: 0,
              nominalPengeluaranSaldoAwal: 0,
              nominalPengeluaranBelanja: 0,
              nominalHibahMasuk: 0,
              nominalHibahKeluar: 0,
              sisaNilai: 0,
            };
          }

          targetMap[key].nominalSaldoAwal += nominalSaldoAwal;
          targetMap[key].nominalBelanjaLra += nominalBelanjaLra;
          targetMap[key].nominalPengeluaranSaldoAwal += nominalPengeluaranSaldoAwal;
          targetMap[key].nominalPengeluaranBelanja += nominalPengeluaranBelanja;
          targetMap[key].nominalHibahMasuk += nominalHibahMasuk;
          targetMap[key].nominalHibahKeluar += nominalHibahKeluar;

          const totalMasuk =
            targetMap[key].nominalSaldoAwal +
            targetMap[key].nominalBelanjaLra +
            targetMap[key].nominalHibahMasuk;
          const totalKeluar =
            targetMap[key].nominalPengeluaranSaldoAwal +
            targetMap[key].nominalPengeluaranBelanja +
            targetMap[key].nominalHibahKeluar;
          targetMap[key].sisaNilai = totalMasuk - totalKeluar;
        }
      }
    }

    const buildGroupTable = (
      groupKey: 'PAUD' | 'SD' | 'SMP',
      rowConfigs: { label: string; aliases: string[] }[]
    ) => {
      const map = groupMaps[groupKey];
      const matchedNormalizedKeys = new Set<string>();

      const resolvedRows = rowConfigs.map((cfg) => {
        if (!cfg.label) {
          return {
            label: '',
            isBlank: true,
            nominalSaldoAwal: 0,
            nominalBelanjaLra: 0,
            nominalPengeluaranSaldoAwal: 0,
            nominalPengeluaranBelanja: 0,
            nominalHibahMasuk: 0,
            nominalHibahKeluar: 0,
            sisaNilai: 0,
          };
        }

        const matchKeys = [cfg.label, ...cfg.aliases].map((k) => k.trim().toLowerCase());
        let nominalSaldoAwal = 0;
        let nominalBelanjaLra = 0;
        let nominalPengeluaranSaldoAwal = 0;
        let nominalPengeluaranBelanja = 0;
        let nominalHibahMasuk = 0;
        let nominalHibahKeluar = 0;
        let sisaNilai = 0;

        for (const [k, val] of Object.entries(map)) {
          const kNorm = k.trim().toLowerCase();
          if (matchKeys.includes(kNorm) && !matchedNormalizedKeys.has(kNorm)) {
            matchedNormalizedKeys.add(kNorm);
            nominalSaldoAwal += val.nominalSaldoAwal;
            nominalBelanjaLra += val.nominalBelanjaLra;
            nominalPengeluaranSaldoAwal += val.nominalPengeluaranSaldoAwal;
            nominalPengeluaranBelanja += val.nominalPengeluaranBelanja;
            nominalHibahMasuk += val.nominalHibahMasuk;
            nominalHibahKeluar += val.nominalHibahKeluar;
            sisaNilai += val.sisaNilai;
          }
        }

        return {
          label: cfg.label,
          isBlank: false,
          nominalSaldoAwal,
          nominalBelanjaLra,
          nominalPengeluaranSaldoAwal,
          nominalPengeluaranBelanja,
          nominalHibahMasuk,
          nominalHibahKeluar,
          sisaNilai,
        };
      });

      // Tambahkan baris rekening kustom (jika ada) yang belum terpetakan agar SUB TOTAL 100% akurat
      for (const [k, val] of Object.entries(map)) {
        const kNorm = k.trim().toLowerCase();
        const hasVal =
          val.nominalSaldoAwal > 0 ||
          val.nominalBelanjaLra > 0 ||
          val.nominalPengeluaranSaldoAwal > 0 ||
          val.nominalPengeluaranBelanja > 0 ||
          val.nominalHibahMasuk > 0 ||
          val.nominalHibahKeluar > 0 ||
          val.sisaNilai !== 0;
        if (!matchedNormalizedKeys.has(kNorm) && hasVal) {
          matchedNormalizedKeys.add(kNorm);
          resolvedRows.push({
            label: k,
            isBlank: false,
            ...val,
          });
        }
      }

      const totals = resolvedRows.reduce(
        (acc, r) => ({
          nominalSaldoAwal: acc.nominalSaldoAwal + r.nominalSaldoAwal,
          nominalBelanjaLra: acc.nominalBelanjaLra + r.nominalBelanjaLra,
          nominalPengeluaranSaldoAwal:
            acc.nominalPengeluaranSaldoAwal + r.nominalPengeluaranSaldoAwal,
          nominalPengeluaranBelanja:
            acc.nominalPengeluaranBelanja + r.nominalPengeluaranBelanja,
          nominalHibahMasuk: acc.nominalHibahMasuk + r.nominalHibahMasuk,
          nominalHibahKeluar: acc.nominalHibahKeluar + r.nominalHibahKeluar,
          sisaNilai: acc.sisaNilai + r.sisaNilai,
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

      const displayRows = showOnlyFilledRows
        ? resolvedRows.filter(
            (r) =>
              !r.isBlank &&
              (r.nominalSaldoAwal > 0 ||
                r.nominalBelanjaLra > 0 ||
                r.nominalPengeluaranSaldoAwal > 0 ||
                r.nominalPengeluaranBelanja > 0 ||
                r.nominalHibahMasuk > 0 ||
                r.nominalHibahKeluar > 0 ||
                r.sisaNilai !== 0)
          )
        : resolvedRows;

      return { rows: displayRows, totals };
    };

    const paud = buildGroupTable('PAUD', BA_REKON_GABUNG_PAUD_ROWS);
    const sd = buildGroupTable('SD', BA_REKON_GABUNG_SD_ROWS);
    const smp = buildGroupTable('SMP', BA_REKON_GABUNG_SMP_ROWS);

    const bosSdSmpTotals = {
      nominalSaldoAwal: sd.totals.nominalSaldoAwal + smp.totals.nominalSaldoAwal,
      nominalBelanjaLra: sd.totals.nominalBelanjaLra + smp.totals.nominalBelanjaLra,
      nominalPengeluaranSaldoAwal:
        sd.totals.nominalPengeluaranSaldoAwal + smp.totals.nominalPengeluaranSaldoAwal,
      nominalPengeluaranBelanja:
        sd.totals.nominalPengeluaranBelanja + smp.totals.nominalPengeluaranBelanja,
      nominalHibahMasuk: sd.totals.nominalHibahMasuk + smp.totals.nominalHibahMasuk,
      nominalHibahKeluar: sd.totals.nominalHibahKeluar + smp.totals.nominalHibahKeluar,
      sisaNilai: sd.totals.sisaNilai + smp.totals.sisaNilai,
    };

    return { paud, sd, smp, bosSdSmpTotals };
  }, [allExpenses, selectedQuarters, schoolInfo.namaSekolah, showOnlyFilledRows]);

  // Data agregasi khusus format BA Rekon Kantor UPT DINAS PENDIDIKAN
  const dinasRekonData = useMemo(() => {
    const resolveRowValues = (label: string, aliases: string[]) => {
      if (!label) {
        return {
          label: '',
          nominalSaldoAwal: 0,
          nominalBelanjaLra: 0,
          nominalPengakuanBast: 0,
          nominalPengeluaranSaldoAwal: 0,
          nominalPengeluaranBelanja: 0,
          nominalPengeluaranBast: 0,
          nominalHibahMasuk: 0,
          nominalHibahKeluar: 0,
          sisaNilai: 0,
        };
      }
      const matchKeys = [label, ...aliases].map((k) => k.trim().toLowerCase());
      let nominalSaldoAwal = 0;
      let nominalBelanjaLra = 0;
      let nominalPengakuanBast = 0;
      let nominalPengeluaranSaldoAwal = 0;
      let nominalPengeluaranBelanja = 0;
      let nominalPengeluaranBast = 0;
      let nominalHibahMasuk = 0;
      let nominalHibahKeluar = 0;
      let sisaNilai = 0;

      for (const [key, val] of Object.entries(aggregatedMap)) {
        if (matchKeys.includes(key.trim().toLowerCase())) {
          nominalSaldoAwal += val.nominalSaldoAwal;
          nominalBelanjaLra += val.nominalBelanjaLra;
          nominalPengakuanBast += val.nominalPengakuanBast;
          nominalPengeluaranSaldoAwal += val.nominalPengeluaranSaldoAwal;
          nominalPengeluaranBelanja += val.nominalPengeluaranBelanja;
          nominalPengeluaranBast += val.nominalPengeluaranBast;
          nominalHibahMasuk += val.nominalHibahMasuk;
          nominalHibahKeluar += val.nominalHibahKeluar;
          sisaNilai += val.sisaNilai;
        }
      }

      return {
        label,
        nominalSaldoAwal,
        nominalBelanjaLra,
        nominalPengakuanBast,
        nominalPengeluaranSaldoAwal,
        nominalPengeluaranBelanja,
        nominalPengeluaranBast,
        nominalHibahMasuk,
        nominalHibahKeluar,
        sisaNilai,
      };
    };

    const rawMainRows = DINAS_REKON_MAIN_ROWS.map((r) => resolveRowValues(r.label, r.aliases));
    const mainRows = showOnlyFilledRows
      ? rawMainRows.filter(
          (r) =>
            r.label &&
            (r.nominalSaldoAwal > 0 ||
              r.nominalBelanjaLra > 0 ||
              r.nominalPengakuanBast > 0 ||
              r.nominalPengeluaranSaldoAwal > 0 ||
              r.nominalPengeluaranBelanja > 0 ||
              r.nominalPengeluaranBast > 0 ||
              r.nominalHibahMasuk > 0 ||
              r.nominalHibahKeluar > 0 ||
              r.sisaNilai !== 0)
        )
      : rawMainRows;

    // Nilai Belanja barjas BOS diambil dari SUB TOTAL BOS SD, SMPN di BA Rekon Gabung Sekolah
    // Nilai Belanja barjas BOP PAUD diambil dari SUB TOTAL BOP PAUD di BA Rekon Gabung Sekolah
    const rawBospRows = DINAS_REKON_BOSP_ROWS.map((r) => {
      const labelNorm = r.label.trim().toLowerCase();
      const isBos = labelNorm.includes('bos') && !labelNorm.includes('paud');
      const isPaud = labelNorm.includes('paud') || labelNorm.includes('bop');

      if (isBos) {
        return {
          label: r.label,
          nominalSaldoAwal: rekonGabungSekolahData.bosSdSmpTotals.nominalSaldoAwal,
          nominalBelanjaLra: rekonGabungSekolahData.bosSdSmpTotals.nominalBelanjaLra,
          nominalPengakuanBast: 0,
          nominalPengeluaranSaldoAwal:
            rekonGabungSekolahData.bosSdSmpTotals.nominalPengeluaranSaldoAwal,
          nominalPengeluaranBelanja:
            rekonGabungSekolahData.bosSdSmpTotals.nominalPengeluaranBelanja,
          nominalPengeluaranBast: 0,
          nominalHibahMasuk: rekonGabungSekolahData.bosSdSmpTotals.nominalHibahMasuk,
          nominalHibahKeluar: rekonGabungSekolahData.bosSdSmpTotals.nominalHibahKeluar,
          sisaNilai: rekonGabungSekolahData.bosSdSmpTotals.sisaNilai,
        };
      }

      if (isPaud) {
        return {
          label: r.label,
          nominalSaldoAwal: rekonGabungSekolahData.paud.totals.nominalSaldoAwal,
          nominalBelanjaLra: rekonGabungSekolahData.paud.totals.nominalBelanjaLra,
          nominalPengakuanBast: 0,
          nominalPengeluaranSaldoAwal:
            rekonGabungSekolahData.paud.totals.nominalPengeluaranSaldoAwal,
          nominalPengeluaranBelanja:
            rekonGabungSekolahData.paud.totals.nominalPengeluaranBelanja,
          nominalPengeluaranBast: 0,
          nominalHibahMasuk: rekonGabungSekolahData.paud.totals.nominalHibahMasuk,
          nominalHibahKeluar: rekonGabungSekolahData.paud.totals.nominalHibahKeluar,
          sisaNilai: rekonGabungSekolahData.paud.totals.sisaNilai,
        };
      }

      return resolveRowValues(r.label, r.aliases);
    });

    const bospRows = showOnlyFilledRows
      ? rawBospRows.filter(
          (r) =>
            r.nominalSaldoAwal > 0 ||
            r.nominalBelanjaLra > 0 ||
            r.nominalPengakuanBast > 0 ||
            r.nominalPengeluaranSaldoAwal > 0 ||
            r.nominalPengeluaranBelanja > 0 ||
            r.nominalPengeluaranBast > 0 ||
            r.nominalHibahMasuk > 0 ||
            r.nominalHibahKeluar > 0 ||
            r.sisaNilai !== 0
        )
      : rawBospRows;

    // Gabungkan baris ekstra standar dengan rekening pemeliharaan lainnya yang memiliki aktivitas
    const standardExtraKeySet = new Set(
      DINAS_REKON_EXTRA_ROWS.flatMap((r) => [r.label, ...r.aliases]).map((k) =>
        k.trim().toLowerCase()
      )
    );
    const additionalPemeliharaanConfigs = REKENING_PEMELIHARAAN_OPTIONS.filter(
      (rek) => !standardExtraKeySet.has(rek.trim().toLowerCase())
    )
      .map((rek) => ({ label: rek, aliases: [] as string[], keterangan: undefined }))
      .filter((cfg) => {
        const resolved = resolveRowValues(cfg.label, cfg.aliases);
        return (
          resolved.nominalBelanjaLra > 0 ||
          resolved.nominalPengakuanBast > 0 ||
          resolved.nominalPengeluaranBelanja > 0 ||
          resolved.nominalPengeluaranBast > 0 ||
          resolved.sisaNilai !== 0
        );
      });

    const rawExtraRows = [...DINAS_REKON_EXTRA_ROWS, ...additionalPemeliharaanConfigs].map((r) => ({
      ...resolveRowValues(r.label, r.aliases),
      keterangan: r.keterangan,
    }));

    const extraRows = showOnlyFilledRows
      ? rawExtraRows.filter(
          (r) =>
            r.nominalSaldoAwal > 0 ||
            r.nominalBelanjaLra > 0 ||
            r.nominalPengakuanBast > 0 ||
            r.nominalPengeluaranSaldoAwal > 0 ||
            r.nominalPengeluaranBelanja > 0 ||
            r.nominalPengeluaranBast > 0 ||
            r.nominalHibahMasuk > 0 ||
            r.nominalHibahKeluar > 0 ||
            r.sisaNilai !== 0
        )
      : rawExtraRows;

    const allPreSubtotal = [...rawMainRows, ...rawBospRows];
    const totals = allPreSubtotal.reduce(
      (acc, r) => ({
        nominalSaldoAwal: acc.nominalSaldoAwal + r.nominalSaldoAwal,
        nominalBelanjaLra: acc.nominalBelanjaLra + r.nominalBelanjaLra,
        nominalPengakuanBast: acc.nominalPengakuanBast + r.nominalPengakuanBast,
        nominalPengeluaranSaldoAwal:
          acc.nominalPengeluaranSaldoAwal + r.nominalPengeluaranSaldoAwal,
        nominalPengeluaranBelanja:
          acc.nominalPengeluaranBelanja + r.nominalPengeluaranBelanja,
        nominalPengeluaranBast: acc.nominalPengeluaranBast + r.nominalPengeluaranBast,
        nominalHibahMasuk: acc.nominalHibahMasuk + r.nominalHibahMasuk,
        nominalHibahKeluar: acc.nominalHibahKeluar + r.nominalHibahKeluar,
        sisaNilai: acc.sisaNilai + r.sisaNilai,
      }),
      {
        nominalSaldoAwal: 0,
        nominalBelanjaLra: 0,
        nominalPengakuanBast: 0,
        nominalPengeluaranSaldoAwal: 0,
        nominalPengeluaranBelanja: 0,
        nominalPengeluaranBast: 0,
        nominalHibahMasuk: 0,
        nominalHibahKeluar: 0,
        sisaNilai: 0,
      }
    );

    return { mainRows, bospRows, extraRows, totals };
  }, [aggregatedMap, showOnlyFilledRows, rekonGabungSekolahData]);

  const subTotals = useMemo(() => {
    return tableRows.reduce(
      (acc, r) => ({
        nominalSaldoAwal: acc.nominalSaldoAwal + r.nominalSaldoAwal,
        nominalBelanjaLra: acc.nominalBelanjaLra + r.nominalBelanjaLra,
        nominalPengeluaranSaldoAwal:
          acc.nominalPengeluaranSaldoAwal + r.nominalPengeluaranSaldoAwal,
        nominalPengeluaranBelanja:
          acc.nominalPengeluaranBelanja + r.nominalPengeluaranBelanja,
        nominalHibahMasuk: acc.nominalHibahMasuk + r.nominalHibahMasuk,
        nominalHibahKeluar: acc.nominalHibahKeluar + r.nominalHibahKeluar,
        sisaNilai: acc.sisaNilai + r.sisaNilai,
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
  }, [tableRows]);

  // Totals for Stock Opname Table
  const stockOpnameSubTotals = useMemo(() => {
    return tableRows.reduce(
      (acc, r) => {
        const custom = stockOpnameCustomRows[r.kodeRekening];
        const saldoKartu = r.sisaNilai;
        const fisikHasil =
          custom?.fisikBarang !== undefined ? custom.fisikBarang : r.sisaNilai;
        const selisih = fisikHasil - saldoKartu;
        return {
          saldoKartu: acc.saldoKartu + saldoKartu,
          fisikHasil: acc.fisikHasil + fisikHasil,
          selisih: acc.selisih + selisih,
        };
      },
      { saldoKartu: 0, fisikHasil: 0, selisih: 0 }
    );
  }, [tableRows, stockOpnameCustomRows]);

  const handleUpdateStockOpnameRow = (
    kodeRekening: string,
    patch: Partial<StockOpnameRowCustom>
  ) => {
    setStockOpnameCustomRows((prev) => ({
      ...prev,
      [kodeRekening]: {
        ...prev[kodeRekening],
        ...patch,
      },
    }));
  };

  const getDocumentFileName = () => {
    if (variant === 'rekon_gabung_sekolah') {
      return `BA_REKON_GABUNG_SD_SMP_TK_${tahunAnggaranBerjalan}`;
    }
    const rawUpt =
      activeUpt && activeUpt !== 'Semua' ? activeUpt : namaSekolahHeader || 'DINAS_PENDIDIKAN';
    const cleanUpt = rawUpt.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
    const prefix =
      variant === 'kib_barang_ekstra'
        ? 'KIB_B_Barang_Ekstrakontabel'
        : variant === 'reklas_barang_ekstra'
        ? activeReklasSubView === 'lampiran_1'
          ? 'Lampiran_1_BA_Reklas_Barang_Ekstra'
          : activeReklasSubView === 'lampiran_2'
          ? 'Lampiran_2_BA_Reklas_Barang_Ekstra'
          : 'BA_Reklas_Barang_Ekstra'
        : variant === 'barang_ekstra'
        ? 'BA_Barang_Ekstrakomptabel'
        : isStockOpname
        ? 'BA_Stock_Opname_Persediaan'
        : 'BA_Rekonsiliasi_Persediaan';
    return `${prefix}_${cleanUpt}_${tahunAnggaranBerjalan}`;
  };

  const handlePrint = () => {
    const el = document.getElementById('printable-receipt');
    if (!el) {
      window.print();
      return;
    }

    // Jika dibuka di tab utama browser (bukan di dalam sandboxed iframe preview),
    // langsung buka dialog printer bawaan browser.
    if (window.self === window.top) {
      window.print();
      return;
    }

    // Jika berada di dalam sandboxed iframe (di mana window.print() diblokir oleh sandbox),
    // buka jendela cetak yang bebas dari sandbox agar Dialog Printer Browser langsung terbuka.
    const printWindow = window.open('', '_blank', 'width=1050,height=780');
    if (!printWindow) {
      window.print();
      return;
    }

    const isLandscape =
      variant === 'kib_barang_ekstra' ||
      variant === 'rekon' ||
      variant === 'rekon_gabung_sekolah';
    const pageSize = isLandscape ? 'A4 landscape' : 'A4 portrait';
    const docTitle = getDocumentFileName();

    const headStyles = Array.from(
      document.querySelectorAll('style, link[rel="stylesheet"]')
    )
      .map((node) => {
        if (node.tagName.toLowerCase() === 'link') {
          const linkEl = node as HTMLLinkElement;
          return `<link rel="stylesheet" href="${linkEl.href}" />`;
        }
        return node.outerHTML;
      })
      .join('\n');

    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${docTitle}</title>
  ${headStyles}
  <style>
    @page {
      size: ${pageSize};
      margin: 12mm;
    }
    html, body {
      background: #ffffff !important;
      color: #000000 !important;
      margin: 0 !important;
      padding: 0 !important;
      font-family: "Times New Roman", Times, Georgia, serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    #printable-receipt {
      width: 100% !important;
      max-width: 100% !important;
      border: none !important;
      box-shadow: none !important;
      padding: 16px 24px !important;
      margin: 0 !important;
      box-sizing: border-box;
    }
    .overflow-x-auto {
      overflow: visible !important;
    }
    thead {
      display: table-row-group !important;
    }
    tfoot {
      display: table-row-group !important;
    }
    tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    @media print {
      #printable-receipt {
        padding: 0 !important;
      }
      thead {
        display: table-row-group !important;
      }
      tfoot {
        display: table-row-group !important;
      }
      tr {
        break-inside: avoid;
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div id="printable-receipt" class="bg-white text-slate-950 font-serif">
    ${el.innerHTML
      .replace(/<thead(\s|>)/gi, '<tbody$1')
      .replace(/<\/thead>/gi, '</tbody>')
      .replace(/<tfoot(\s|>)/gi, '<tbody$1')
      .replace(/<\/tfoot>/gi, '</tbody>')}
  </div>
  <script>
    (function() {
      var hasPrinted = false;
      function openBrowserPrintDialog() {
        if (hasPrinted) return;
        hasPrinted = true;
        setTimeout(function() {
          window.focus();
          window.print();
        }, 150);
      }
      window.addEventListener('afterprint', function() {
        window.close();
      });
      if (document.readyState === 'complete') {
        openBrowserPrintDialog();
      } else {
        window.addEventListener('load', openBrowserPrintDialog);
        setTimeout(openBrowserPrintDialog, 500);
      }
    })();
  </script>
</body>
</html>`);
    printWindow.document.close();
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-12">
      {/* Top Action Bar (Hidden in Print) */}
      <div className="print:hidden bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-all"
              aria-label="Kembali"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {variant === 'rekon_gabung_sekolah'
                  ? 'BA Rekon Gabung Sekolah (BOP TK & SKB, SD, dan SMPN)'
                  : variant === 'kib_barang_ekstra'
                  ? 'Kartu Inventaris Barang (KIB) B - Barang Ekstrakontabel'
                  : variant === 'reklas_barang_ekstra'
                  ? 'Berita Acara Reklas Barang Ekstra'
                  : variant === 'barang_ekstra'
                  ? 'Berita Acara Barang Ekstrakomptabel'
                  : isStockOpname
                  ? 'Berita Acara Stock Opname Fisik Persediaan Barang'
                  : 'Berita Acara Rekonsiliasi Persediaan'}
              </h2>
              <p className="text-xs text-slate-500">
                {variant === 'rekon_gabung_sekolah'
                  ? 'Gabungan Nilai Belanja Sanggar Kegiatan Belajar & TK, Seluruh Sekolah Dasar, dan Seluruh Sekolah SMP'
                  : variant === 'kib_barang_ekstra'
                  ? 'Format Cetak Resmi Kartu Inventaris Barang (KIB) B Barang Ekstrakontabel'
                  : variant === 'reklas_barang_ekstra'
                  ? 'Format Cetak Resmi Berita Acara Reklasifikasi Barang Ekstra Sekolah'
                  : variant === 'barang_ekstra'
                  ? 'Format Cetak Resmi Berita Acara Barang Ekstrakomptabel Sekolah'
                  : isStockOpname
                  ? 'Format Cetak Resmi Berita Acara Stock Opname Persediaan Sekolah'
                  : 'Format Cetak Resmi Rekonsiliasi Persediaan Sekolah'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Tombol Filter UPT dengan Search (Khusus Pengguna Admin) */}
            {isAdmin && (
              <div className="relative" ref={receiptUptRef}>
                <button
                  type="button"
                  onClick={() => {
                    setIsReceiptUptModalOpen((prev) => !prev);
                    setTimeout(() => receiptUptInputRef.current?.focus(), 80);
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                    activeUpt !== 'Semua'
                      ? 'bg-emerald-50 text-emerald-950 border-emerald-400 ring-2 ring-emerald-400/20'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
                  }`}
                  title="Filter UPT Sekolah untuk Berita Acara"
                >
                  <Building className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate max-w-[140px] sm:max-w-[180px]">
                    {activeUpt === 'Semua' ? 'Semua UPT' : activeUpt}
                  </span>
                  <Search className="w-3 h-3 text-emerald-600 shrink-0" />
                </button>

                {isReceiptUptModalOpen && (
                  <div className="absolute left-0 mt-1.5 w-80 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 p-3 text-xs space-y-2 animate-fadeIn">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                      <span className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Filter UPT Berita Acara</span>
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {receiptFilteredUptOptions.length} UPT
                      </span>
                    </div>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        ref={receiptUptInputRef}
                        value={receiptUptSearchInput}
                        onChange={(e) => setReceiptUptSearchInput(e.target.value)}
                        placeholder="Ketik nama UPT sekolah..."
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      {receiptUptSearchInput && (
                        <button
                          type="button"
                          onClick={() => setReceiptUptSearchInput('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                      <button
                        type="button"
                        onClick={() => {
                          handleSelectUpt('Semua');
                          setIsReceiptUptModalOpen(false);
                          setReceiptUptSearchInput('');
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl font-medium transition-all cursor-pointer ${
                          activeUpt === 'Semua'
                            ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200'
                            : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        Semua UPT (Kabupaten)
                      </button>
                      {receiptFilteredUptOptions.map((upt) => (
                        <button
                          key={upt}
                          type="button"
                          onClick={() => {
                            handleSelectUpt(upt);
                            setIsReceiptUptModalOpen(false);
                            setReceiptUptSearchInput('');
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl font-medium transition-all cursor-pointer truncate ${
                            activeUpt === upt
                              ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200'
                              : 'hover:bg-slate-100 text-slate-700'
                          }`}
                          title={upt}
                        >
                          {upt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Filter Sumber Data: Tombol Combo Box dengan Centang (Checkboxes) */}
            <div className="relative" ref={comboRef}>
              <button
                type="button"
                onClick={() => setIsComboOpen((prev) => !prev)}
                className="flex items-center justify-between gap-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-[235px] transition-all cursor-pointer shadow-2xs"
                aria-haspopup="listbox"
                aria-expanded={isComboOpen}
                aria-label="Filter Triwulan Laporan Cetak"
              >
                <span className="flex items-center gap-1.5 truncate">
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">{comboButtonLabel}</span>
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-500 shrink-0 transition-transform duration-150 ${
                    isComboOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isComboOpen && (
                <div
                  className="absolute left-0 sm:right-0 sm:left-auto mt-1.5 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-40 py-2 text-xs animate-fadeIn"
                  role="listbox"
                  aria-multiselectable="true"
                >
                  <div className="px-3 pb-1.5 mb-1 border-b border-slate-100 flex items-center justify-between">
                    <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">
                      Centang Filter Triwulan
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-600">
                      {selectedQuarters.length}/4 dipilih
                    </span>
                  </div>

                  {/* Option: Pilih Semua TW */}
                  <label className="flex items-center justify-between px-3 py-2 hover:bg-emerald-50/60 cursor-pointer select-none transition-colors border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={
                          selectedQuarters.length === ALL_QUARTERS.length
                        }
                        onChange={toggleAllQuarters}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="font-bold text-slate-800">
                        Semua Triwulan (TW1 - TW4)
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {allExpenses.length} input
                    </span>
                  </label>

                  {/* Individual TW Checkboxes */}
                  <div className="py-1 divide-y divide-slate-50">
                    {ALL_QUARTERS.map((q) => {
                      const isChecked = selectedQuarters.includes(q.id);
                      const countInTw = allExpenses.filter(
                        (e) => e.triwulan === q.id
                      ).length;

                      return (
                        <label
                          key={q.id}
                          className={`flex items-center justify-between px-3 py-2 hover:bg-slate-50 cursor-pointer select-none transition-colors ${
                            isChecked ? 'bg-emerald-50/30' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleQuarter(q.id)}
                              className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                            <div>
                              <div
                                className={`font-semibold ${
                                  isChecked
                                    ? 'text-emerald-950'
                                    : 'text-slate-700'
                                }`}
                              >
                                {q.label}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Periode {q.period}
                              </div>
                            </div>
                          </div>
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                              countInTw > 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {countInTw} input
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  {/* Helper Footer inside Dropdown */}
                  <div className="px-3 pt-2 mt-1 border-t border-slate-100 text-[11px] text-slate-500 leading-snug">
                    {selectedQuarters.length === 0 ? (
                      <span className="text-amber-600 font-medium">
                        Centang minimal 1 TW untuk menampilkan data laporan.
                      </span>
                    ) : selectedQuarters.length === 1 ? (
                      <span>
                        Menampilkan inputan khusus{' '}
                        <strong className="text-slate-800">
                          {selectedQuarters[0]}
                        </strong>
                        .
                      </span>
                    ) : (
                      <span>
                        Menggabungkan nilai per jenis rekening belanja dari{' '}
                        <strong className="text-emerald-700">
                          {selectedQuarters.join(' + ')}
                        </strong>
                        .
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Tombol Pilihan 3 Dokumen khusus Berita Acara Reklas Barang Ekstra */}
            {variant === 'reklas_barang_ekstra' && (
              <div className="relative" ref={reklasSubDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsReklasSubDropdownOpen((prev) => !prev)}
                  className="flex items-center justify-between gap-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg px-3 py-1.5 text-xs text-emerald-950 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer shadow-2xs"
                >
                  <span>
                    {REKLAS_SUB_VIEW_OPTIONS.find((o) => o.id === activeReklasSubView)?.label ||
                      '1. BA Reklas Barang Ekstra'}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-emerald-700 transition-transform ${
                      isReklasSubDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isReklasSubDropdownOpen && (
                  <div className="absolute left-0 sm:right-0 sm:left-auto mt-1.5 w-60 bg-white border border-slate-200 rounded-xl shadow-xl z-40 p-1.5 text-xs space-y-1 animate-fadeIn">
                    <div className="px-2.5 py-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      Pilih Tampilan Reklas
                    </div>
                    {REKLAS_SUB_VIEW_OPTIONS.map((opt) => {
                      const isSel = activeReklasSubView === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            handleSelectReklasSubView(opt.id);
                            setIsReklasSubDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg font-bold transition-all cursor-pointer flex items-center justify-between ${
                            isSel
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'hover:bg-emerald-50 text-slate-700 hover:text-emerald-800'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {isSel && (
                            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded">
                              Aktif
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <label
              className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg px-2.5 py-1.5 cursor-pointer select-none transition-all border ${
                showOnlyFilledRows
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300 ring-1 ring-emerald-300/50 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
              title="Centang untuk menyembunyikan baris yang bernilai 0 atau kosong"
            >
              <input
                type="checkbox"
                checked={showOnlyFilledRows}
                onChange={(e) => {
                  const val = e.target.checked;
                  setShowOnlyFilledRows(val);
                  onShowOnlyFilledRowsChange?.(val);
                }}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
              />
              <span>Hanya Baris Terisi</span>
            </label>

            {/* Pemilih Tanggal Kalender Langsung - Seluruh Box Dapat Diklik */}
            <div
              onClick={handleTriggerDatePicker}
              className="relative inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded-lg shadow-sm hover:border-emerald-500 hover:bg-emerald-50/30 transition-all cursor-pointer select-none active:scale-[0.99] group overflow-hidden"
              title="Klik di mana saja pada tombol ini untuk memilih tanggal kalender"
            >
              <Calendar className="w-4 h-4 text-emerald-600 shrink-0 pointer-events-none group-hover:scale-105 transition-transform" />
              <span className="text-xs font-bold text-slate-800 pointer-events-none tracking-wide">
                {reportDateInfo
                  ? `${reportDateInfo.dayPad} ${reportDateInfo.monthName} ${reportDateInfo.year}`
                  : selectedReportDate}
              </span>
              {reportDateInfo && (
                <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 pointer-events-none">
                  {reportDateInfo.dayName}
                </span>
              )}
              {/* Input kalender yang melingkupi 100% seluruh badan tombol */}
              <input
                ref={dateInputRef}
                type="date"
                value={selectedReportDate}
                onChange={(e) => handleReportDateChange(e.target.value)}
                className="full-box-date-input absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                title="Pilih tanggal dalam bentuk kalender"
                tabIndex={-1}
              />
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow transition-all active:scale-95 cursor-pointer"
              aria-label="Cetak Dokumen Ini"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Dokumen (Print/PDF)</span>
            </button>
          </div>
        </div>

        {/* Active Filter Summary Indicator (Hidden in Print) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            {selectedQuarters.length === 0 ? (
              <span className="text-amber-700 font-medium">
                Belum ada Triwulan yang dicentang pada combo box filter.
              </span>
            ) : selectedQuarters.length === 1 ? (
              <span>
                Laporan menampilkan inputan{' '}
                <strong className="text-slate-900">
                  {selectedQuarters[0]}
                </strong>{' '}
                ({filteredExpenses.length} data inputan).
              </span>
            ) : (
              <span>
                Laporan menampilkan gabungan inputan{' '}
                <strong className="text-emerald-700">
                  {selectedQuarters.join(', ')}
                </strong>{' '}
                ({filteredExpenses.length} data inputan digabung nilainya per
                jenis rekening belanja).
              </span>
            )}
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-800">
            <span>Periode Otomatis:</span>
            <span className="font-bold">{periodeTahunAnggaran}</span>
          </div>
        </div>
      </div>

      {/* The Printable Official Document Sheet */}
      <div
        id="printable-receipt"
        className="bg-white p-6 sm:p-10 rounded-xl border border-slate-300 shadow-sm print:shadow-none print:border-none print:p-0 text-slate-950 font-serif"
      >
        {variant === 'reklas_barang_ekstra' ? (
          activeReklasSubView === 'ba_reklas' ? (
            /* ================================================================= */
            /* 1. BA REKLAS BARANG EKSTRA (Sesuai File Lampiran CSV)             */
            /* ================================================================= */
            <div>
              {/* Kop Pemerintah & Dinas Pendidikan */}
              <div className="text-center text-xs sm:text-sm font-bold uppercase leading-snug pb-3 mb-6 border-b-2 border-slate-900">
                <div>{pemerintahDaerah}</div>
                <div>DINAS PENDIDIKAN</div>
                {activeUpt && activeUpt !== 'Semua' && activeUpt !== 'DINAS PENDIDIKAN' && (
                  <div className="text-xs text-slate-700 font-semibold mt-0.5">{activeUpt}</div>
                )}
              </div>

              {/* Judul Berita Acara */}
              <div className="text-center mb-6">
                <h1 className="text-sm sm:text-base font-bold uppercase tracking-wide text-slate-950">
                  BERITA ACARA BARANG EKSTRAKOMPTABEL
                </h1>
                <p className="text-xs sm:text-sm font-bold uppercase text-slate-950 mt-0.5">
                  {periodeTahunAnggaran}
                </p>
              </div>

              {/* Paragraf Pembuka & Penandatangan Pihak 1 & 2 */}
              <div className="text-xs sm:text-[13px] leading-relaxed space-y-4 mb-6 text-slate-950">
                <p>{kalimatPembuka}</p>

                <div className="space-y-3 pl-2 sm:pl-4">
                  {/* Pihak 1: Pengurus Barang */}
                  <table className="text-xs sm:text-[13px] border-collapse">
                    <tbody>
                      <tr>
                        <td className="w-24 py-0.5 align-top">Nama</td>
                        <td className="py-0.5 font-semibold">: {namaPihak1}</td>
                      </tr>
                      <tr>
                        <td className="w-24 py-0.5 align-top">NIP</td>
                        <td className="py-0.5">: {nipPihak1}</td>
                      </tr>
                      <tr>
                        <td className="w-24 py-0.5 align-top">Jabatan</td>
                        <td className="py-0.5">: {jabatanPihak1}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Pihak 2: Pejabat Penatausahaan Barang */}
                  <table className="text-xs sm:text-[13px] border-collapse">
                    <tbody>
                      <tr>
                        <td className="w-24 py-0.5 align-top">Nama</td>
                        <td className="py-0.5 font-semibold">: {namaPihak2}</td>
                      </tr>
                      <tr>
                        <td className="w-24 py-0.5 align-top">NIP</td>
                        <td className="py-0.5">: {nipPihak2}</td>
                      </tr>
                      <tr>
                        <td className="w-24 py-0.5 align-top">Jabatan</td>
                        <td className="py-0.5">: {jabatanPihak2}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Isi Poin 1 & 2 sesuai File CSV */}
                <div className="pt-2 space-y-3">
                  <p>
                    Berdasarkan hasil pemeriksaan fisik Barang Ektrakomptabel per{' '}
                    {cutOffDate.replace(/^PER\s+/i, '').replace(/\s+(\d{4})$/, ' Tahun $1')} maka:
                  </p>

                  <div className="space-y-2.5 pl-1">
                    <div className="flex items-start gap-2">
                      <span className="w-5 shrink-0">1.</span>
                      <span>
                        Pembelian Barang Ektrakomptabel pada Tahun {tahunAnggaranBerjalan} rinciannya
                        sebagaimana terlampir pada lampiran I :
                      </span>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="w-5 shrink-0">2.</span>
                      <span>
                        Rincian Barang Ekstakomptabel yang dikuasai oleh{' '}
                        {activeUpt && activeUpt !== 'Semua' ? activeUpt : 'DINAS PENDIDIKAN'}{' '}
                        sampai pada {cutOffDate.replace(/^PER\s+/i, '')} sebagaimana terlampir pada
                        lampiran II:
                      </span>
                    </div>
                  </div>
                </div>

                <p className="pt-2">
                  Demikian Berita Acara Rekonsiliasi Barang Persediaan ini dibuat untuk keperluan
                  Laporan Keuangan DINAS PENDIDIKAN
                </p>
              </div>

              {/* Tanda Tangan Resmi (3 Penandatangan sesuai File CSV) */}
              <div className="mt-10 pt-4 text-xs sm:text-[13px] text-slate-950 break-inside-avoid">
                {/* Baris Atas: Kiri (Pejabat Penatausahaan Barang) & Kanan (Pengurus Barang) */}
                <div className="grid grid-cols-2 gap-8 text-center">
                  <div className="flex flex-col justify-between min-h-[120px]">
                    <p className="font-normal">Pejabat Penatausahaan Barang</p>
                    <div className="mt-16">
                      <p className="font-bold underline">{namaPengurusPembantuFooter}</p>
                      <p className="mt-0.5">NIP. {nipPengurusPembantuFooter}</p>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between min-h-[120px]">
                    <p className="font-normal">Pengurus Barang</p>
                    <div className="mt-16">
                      <p className="font-bold underline">{namaPengurusBarangFooter}</p>
                      <p className="mt-0.5">NIP. {nipPengurusBarangFooter}</p>
                    </div>
                  </div>
                </div>

                {/* Baris Bawah Tengah: Mengetahui Kepala Dinas Pendidikan */}
                <div className="mt-10 text-center flex flex-col items-center justify-between min-h-[120px]">
                  <div>
                    <p className="font-normal">Mengetahui,</p>
                    <p className="font-normal">Kepala Dinas Pendidikan,</p>
                  </div>
                  <div className="mt-16">
                    <p className="font-bold underline">{namaKepsekFooter}</p>
                    <p className="mt-0.5">NIP. {nipKepsekFooter}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : activeReklasSubView === 'lampiran_1' ? (
            /* ================================================================= */
            /* 2. LAMPIRAN 1 (Pembelian Barang Ekstrakomptabel Tahun Berjalan)   */
            /* ================================================================= */
            <div>
              <div className="flex justify-end mb-4 text-xs">
                <div className="text-right border-b border-slate-900 pb-1">
                  <div className="font-bold uppercase">
                    LAMPIRAN I : BERITA ACARA BARANG EKSTRAKOMPTABEL
                  </div>
                  <div className="text-[11px] text-slate-700 uppercase">
                    {periodeTahunAnggaran}
                  </div>
                </div>
              </div>

              <div className="text-center text-xs sm:text-sm font-bold uppercase leading-snug pb-3 mb-5 border-b-2 border-slate-900">
                <div>{pemerintahDaerah}</div>
                <div>DINAS PENDIDIKAN</div>
                {activeUpt && activeUpt !== 'Semua' && activeUpt !== 'DINAS PENDIDIKAN' && (
                  <div className="text-xs text-slate-700 font-semibold mt-0.5">{activeUpt}</div>
                )}
              </div>

              <div className="text-center mb-6">
                <h1 className="text-sm sm:text-base font-bold uppercase tracking-wide text-slate-950">
                  LAMPIRAN I
                </h1>
                <p className="text-xs sm:text-sm font-bold uppercase text-slate-950 mt-0.5">
                  PEMBELIAN BARANG EKSTRAKOMPTABEL PADA TAHUN {tahunAnggaranBerjalan}
                </p>
                <p className="text-xs font-bold uppercase text-slate-800 mt-0.5">
                  {periodeTahunAnggaran}
                </p>
              </div>

              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full border-collapse border border-slate-900 text-[11px] sm:text-xs relative z-0">
                  <tbody>
                    <tr className="bg-white text-slate-950 font-bold text-center">
                      <th className="border border-slate-900 py-2 px-2 w-10">No</th>
                      <th className="border border-slate-900 py-2 px-3 text-left">Jenis Persediaan</th>
                      <th className="border border-slate-900 py-2 px-2 w-20">Jumlah</th>
                      <th className="border border-slate-900 py-2 px-2.5 w-32 text-right">Harga Satuan (Rp)</th>
                      <th className="border border-slate-900 py-2 px-2 w-28">Tahun Pembelian</th>
                      <th className="border border-slate-900 py-2 px-2.5 w-36 text-right">Total Harga (Rp)</th>
                      <th className="border border-slate-900 py-2 px-3 text-left">NAMA UPT</th>
                    </tr>
                    {lampiran1BarangEkstra.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="border border-slate-900 py-6 text-center italic text-slate-500">
                          NIHIL - Belum ada data Pembelian Barang Ekstrakomptabel Tahun {tahunAnggaranBerjalan} yang disetujui.
                        </td>
                      </tr>
                    ) : (
                      lampiran1BarangEkstra.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="border border-slate-900 py-1.5 px-2 text-center font-bold">{idx + 1}</td>
                          <td className="border border-slate-900 py-1.5 px-3 font-semibold text-slate-950 text-left">
                            {item.namaBarang} {item.spesifikasi ? `(${item.spesifikasi})` : ''}
                          </td>
                          <td className="border border-slate-900 py-1.5 px-2 text-center font-medium">
                            {item.volume} {item.satuan || ''}
                          </td>
                          <td className="border border-slate-900 py-1.5 px-2.5 text-right font-medium whitespace-nowrap">
                            {formatNominalRekonsiliasi(item.hargaSatuan)}
                          </td>
                          <td className="border border-slate-900 py-1.5 px-2 text-center">
                            {item.tahunAnggaran || (item.tanggalPerolehan ? new Date(item.tanggalPerolehan).getFullYear() : tahunAnggaranBerjalan)}
                          </td>
                          <td className="border border-slate-900 py-1.5 px-2.5 text-right font-bold whitespace-nowrap">
                            {formatNominalRekonsiliasi(item.totalHarga)}
                          </td>
                          <td className="border border-slate-900 py-1.5 px-3 text-left uppercase text-slate-950">
                            {item.schoolName || (activeUpt !== 'Semua' ? activeUpt : 'DINAS PENDIDIKAN')}
                          </td>
                        </tr>
                      ))
                    )}
                    <tr className="bg-white font-bold text-slate-950">
                      <td colSpan={5} className="border border-slate-900 py-2 px-3 text-center uppercase tracking-wider font-extrabold">
                        JUMLAH
                      </td>
                      <td className="border border-slate-900 py-2 px-2.5 text-right font-black whitespace-nowrap">
                        {lampiran1BarangEkstra.length > 0
                          ? formatNominalRekonsiliasi(
                              lampiran1BarangEkstra.reduce((acc, i) => acc + (i.totalHarga || 0), 0)
                            )
                          : '-'}
                      </td>
                      <td className="border border-slate-900 py-2 px-2"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Tanda Tangan Lampiran 1 */}
              <div className="mt-10 pt-4 text-xs sm:text-[13px] text-slate-950 break-inside-avoid">
                <div className="grid grid-cols-2 gap-8 text-center">
                  <div className="flex flex-col justify-between min-h-[120px]">
                    <p className="font-normal">Pejabat Penatausahaan Barang</p>
                    <div className="mt-16">
                      <p className="font-bold underline">{namaPengurusPembantuFooter}</p>
                      <p className="mt-0.5">NIP. {nipPengurusPembantuFooter}</p>
                    </div>
                  </div>
                  <div className="flex flex-col justify-between min-h-[120px]">
                    <p className="font-normal">Pengurus Barang</p>
                    <div className="mt-16">
                      <p className="font-bold underline">{namaPengurusBarangFooter}</p>
                      <p className="mt-0.5">NIP. {nipPengurusBarangFooter}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-10 text-center flex flex-col items-center justify-between min-h-[120px]">
                  <div>
                    <p className="font-normal">Mengetahui,</p>
                    <p className="font-normal">Kepala Dinas Pendidikan,</p>
                  </div>
                  <div className="mt-16">
                    <p className="font-bold underline">{namaKepsekFooter}</p>
                    <p className="mt-0.5">NIP. {nipKepsekFooter}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ================================================================= */
            /* 3. LAMPIRAN 2 (Rincian Barang Ekstrakomptabel yang Dikuasai)      */
            /* ================================================================= */
            <div>
              <div className="flex justify-end mb-4 text-xs">
                <div className="text-right border-b border-slate-900 pb-1">
                  <div className="font-bold uppercase">
                    LAMPIRAN II : BERITA ACARA BARANG EKSTRAKOMPTABEL
                  </div>
                  <div className="text-[11px] text-slate-700 uppercase">
                    {periodeTahunAnggaran}
                  </div>
                </div>
              </div>

              <div className="text-center text-xs sm:text-sm font-bold uppercase leading-snug pb-3 mb-5 border-b-2 border-slate-900">
                <div>{pemerintahDaerah}</div>
                <div>DINAS PENDIDIKAN</div>
                {activeUpt && activeUpt !== 'Semua' && activeUpt !== 'DINAS PENDIDIKAN' && (
                  <div className="text-xs text-slate-700 font-semibold mt-0.5">{activeUpt}</div>
                )}
              </div>

              <div className="text-center mb-6">
                <h1 className="text-sm sm:text-base font-bold uppercase tracking-wide text-slate-950">
                  LAMPIRAN II
                </h1>
                <p className="text-xs sm:text-sm font-bold uppercase text-slate-950 mt-0.5">
                  RINCIAN BARANG EKSTRAKOMPTABEL YANG DIKUASAI OLEH{' '}
                  {activeUpt && activeUpt !== 'Semua' ? activeUpt : 'DINAS PENDIDIKAN'}
                </p>
                <p className="text-xs font-bold uppercase text-slate-800 mt-0.5">
                  SAMPAI PADA {cutOffDate.replace(/^PER\s+/i, '').toUpperCase()}
                </p>
              </div>

              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full border-collapse border border-slate-900 text-[11px] sm:text-xs relative z-0">
                  <tbody>
                    <tr className="bg-white text-slate-950 font-bold text-center">
                      <th className="border border-slate-900 py-2 px-2 w-10">No</th>
                      <th className="border border-slate-900 py-2 px-3 text-left">Jenis Persediaan</th>
                      <th className="border border-slate-900 py-2 px-2 w-20">Jumlah</th>
                      <th className="border border-slate-900 py-2 px-2.5 w-32 text-right">Harga Satuan (Rp)</th>
                      <th className="border border-slate-900 py-2 px-2 w-28">Tahun Pembelian</th>
                      <th className="border border-slate-900 py-2 px-2.5 w-36 text-right">Total Harga (Rp)</th>
                      <th className="border border-slate-900 py-2 px-3 text-left">NAMA UPT</th>
                    </tr>
                    {displayBarangEkstra.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="border border-slate-900 py-6 text-center italic text-slate-500">
                          NIHIL - Belum ada data Barang Ekstrakomptabel yang disetujui (Approved).
                        </td>
                      </tr>
                    ) : (
                      displayBarangEkstra.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="border border-slate-900 py-1.5 px-2 text-center font-bold">{idx + 1}</td>
                          <td className="border border-slate-900 py-1.5 px-3 font-semibold text-slate-950 text-left">
                            {item.namaBarang} {item.spesifikasi ? `(${item.spesifikasi})` : ''}
                          </td>
                          <td className="border border-slate-900 py-1.5 px-2 text-center font-medium">
                            {item.volume} {item.satuan || ''}
                          </td>
                          <td className="border border-slate-900 py-1.5 px-2.5 text-right font-medium whitespace-nowrap">
                            {formatNominalRekonsiliasi(item.hargaSatuan)}
                          </td>
                          <td className="border border-slate-900 py-1.5 px-2 text-center">
                            {item.tahunAnggaran || (item.tanggalPerolehan ? new Date(item.tanggalPerolehan).getFullYear() : tahunAnggaranBerjalan)}
                          </td>
                          <td className="border border-slate-900 py-1.5 px-2.5 text-right font-bold whitespace-nowrap">
                            {formatNominalRekonsiliasi(item.totalHarga)}
                          </td>
                          <td className="border border-slate-900 py-1.5 px-3 text-left uppercase text-slate-950">
                            {item.schoolName || (activeUpt !== 'Semua' ? activeUpt : 'DINAS PENDIDIKAN')}
                          </td>
                        </tr>
                      ))
                    )}
                    <tr className="bg-white font-bold text-slate-950">
                      <td colSpan={5} className="border border-slate-900 py-2 px-3 text-center uppercase tracking-wider font-extrabold">
                        JUMLAH
                      </td>
                      <td className="border border-slate-900 py-2 px-2.5 text-right font-black whitespace-nowrap">
                        {displayBarangEkstra.length > 0
                          ? formatNominalRekonsiliasi(
                              displayBarangEkstra.reduce((acc, i) => acc + (i.totalHarga || 0), 0)
                            )
                          : '-'}
                      </td>
                      <td className="border border-slate-900 py-2 px-2"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Tanda Tangan Lampiran 2 */}
              <div className="mt-10 pt-4 text-xs sm:text-[13px] text-slate-950 break-inside-avoid">
                <div className="grid grid-cols-2 gap-8 text-center">
                  <div className="flex flex-col justify-between min-h-[120px]">
                    <p className="font-normal">Pejabat Penatausahaan Barang</p>
                    <div className="mt-16">
                      <p className="font-bold underline">{namaPengurusPembantuFooter}</p>
                      <p className="mt-0.5">NIP. {nipPengurusPembantuFooter}</p>
                    </div>
                  </div>
                  <div className="flex flex-col justify-between min-h-[120px]">
                    <p className="font-normal">Pengurus Barang</p>
                    <div className="mt-16">
                      <p className="font-bold underline">{namaPengurusBarangFooter}</p>
                      <p className="mt-0.5">NIP. {nipPengurusBarangFooter}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-10 text-center flex flex-col items-center justify-between min-h-[120px]">
                  <div>
                    <p className="font-normal">Mengetahui,</p>
                    <p className="font-normal">Kepala Dinas Pendidikan,</p>
                  </div>
                  <div className="mt-16">
                    <p className="font-bold underline">{namaKepsekFooter}</p>
                    <p className="mt-0.5">NIP. {nipKepsekFooter}</p>
                  </div>
                </div>
              </div>
            </div>
          )
        ) : variant === 'kib_barang_ekstra' ? (
          /* ===================================================================== */
          /* VARIANT: KARTU INVENTARIS BARANG (KIB) B BARANG EKSTRAKONTABEL         */
          /* ===================================================================== */
          <div>
            {/* Kop KIB B dengan Garis Datar */}
            <div className="text-center text-xs sm:text-sm font-bold uppercase leading-snug pb-3 mb-5 border-b-2 border-slate-900">
              <div>KABUPATEN MINAHASA TENGGARA</div>
              <div className="mt-2 text-sm sm:text-base font-extrabold tracking-wide">
                KARTU INVENTARIS BARANG (KIB) B
              </div>
              <div className="text-xs sm:text-sm font-bold">
                BARANG EKSTRAKONTABEL
              </div>
            </div>

            {/* Metadata Lokasi & Organisasi sesuai File CSV */}
            <div className="text-xs sm:text-[13px] mb-4 text-slate-950">
              <table className="border-collapse text-xs sm:text-[13px]">
                <tbody>
                  <tr>
                    <td className="w-44 py-0.5 font-semibold">Provinsi</td>
                    <td className="py-0.5 font-bold uppercase">: PROVINSI SULAWESI UTARA</td>
                  </tr>
                  <tr>
                    <td className="w-44 py-0.5 font-semibold">Kab./Kota</td>
                    <td className="py-0.5 font-bold uppercase">: KABUPATEN MINAHASA TENGGARA</td>
                  </tr>
                  <tr>
                    <td className="w-44 py-0.5 font-semibold">Bidang</td>
                    <td className="py-0.5 font-semibold">: Bidang Pendidikan dan Kebudayaan</td>
                  </tr>
                  <tr>
                    <td className="w-44 py-0.5 font-semibold">Unit Organisasi</td>
                    <td className="py-0.5 font-semibold">: Dinas Pendidikan</td>
                  </tr>
                  <tr>
                    <td className="w-44 py-0.5 font-semibold">Sub Unit Organisasi</td>
                    <td className="py-0.5 font-bold uppercase">
                      : {activeUpt && activeUpt !== 'Semua' ? activeUpt : namaSekolahHeader}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="mt-3 font-bold text-xs uppercase tracking-wide">
                NO. KODE LOKASI :
              </div>
            </div>

            {/* Tabel 21 Kolom KIB B Barang Ekstrakontabel */}
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full border-collapse border border-slate-900 text-[10px] sm:text-[11px]">
                <tbody>
                  <tr className="bg-white text-slate-950 font-bold text-center">
                    <th className="border border-slate-900 py-1.5 px-1 w-8">No.</th>
                    <th className="border border-slate-900 py-1.5 px-1.5 min-w-[90px]">Nama SKPD</th>
                    <th className="border border-slate-900 py-1.5 px-1.5 min-w-[75px]">Kode Barang</th>
                    <th className="border border-slate-900 py-1.5 px-2 min-w-[120px]">
                      Jenis Barang /<br />Nama Barang
                    </th>
                    <th className="border border-slate-900 py-1.5 px-1.5">
                      Nomor<br />Register
                    </th>
                    <th className="border border-slate-900 py-1.5 px-1.5">
                      Merk/<br />Type
                    </th>
                    <th className="border border-slate-900 py-1.5 px-1.5">
                      Ukuran/<br />CC
                    </th>
                    <th className="border border-slate-900 py-1.5 px-1.5">Bahan</th>
                    <th className="border border-slate-900 py-1.5 px-1.5">
                      Bulan Pem-<br />belian
                    </th>
                    <th className="border border-slate-900 py-1.5 px-1.5">
                      Tahun Pem-<br />belian
                    </th>
                    <th className="border border-slate-900 py-1.5 px-1.5">Nomor Pabrik</th>
                    <th className="border border-slate-900 py-1.5 px-1.5">Nomor Rangka</th>
                    <th className="border border-slate-900 py-1.5 px-1.5">Nomor Mesin</th>
                    <th className="border border-slate-900 py-1.5 px-1.5">Nomor Polisi</th>
                    <th className="border border-slate-900 py-1.5 px-1.5">Nomor BPKB</th>
                    <th className="border border-slate-900 py-1.5 px-1.5">Kondisi</th>
                    <th className="border border-slate-900 py-1.5 px-1.5">
                      Asal<br />usul
                    </th>
                    <th className="border border-slate-900 py-1.5 px-1.5">Jumlah</th>
                    <th className="border border-slate-900 py-1.5 px-1.5 text-right">Harga Satuan</th>
                    <th className="border border-slate-900 py-1.5 px-1.5 text-right">
                      Harga<br />(Rp)
                    </th>
                    <th className="border border-slate-900 py-1.5 px-1.5">Keterangan</th>
                  </tr>
                  {displayBarangEkstra.length === 0 ? (
                    <tr>
                      <td colSpan={21} className="border border-slate-900 py-6 text-center italic text-slate-500">
                        NIHIL - Belum ada data KIB B Barang Ekstrakontabel yang terisi.
                      </td>
                    </tr>
                  ) : (
                    displayBarangEkstra.map((item, idx) => {
                      const parsedTgl = item.tanggalPerolehan
                        ? parseReportDateComponents(item.tanggalPerolehan)
                        : null;
                      const bulanBeli = parsedTgl ? parsedTgl.monthName : '-';
                      const tahunBeli =
                        item.tahunAnggaran ||
                        (parsedTgl ? parsedTgl.year : tahunAnggaranBerjalan);

                      return (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="border border-slate-900 py-1 px-1 text-center font-semibold">
                          {idx + 1}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-left uppercase">
                          {item.schoolName || (activeUpt !== 'Semua' ? activeUpt : namaSekolahHeader)}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-center">-</td>
                        <td className="border border-slate-900 py-1 px-2 text-left font-semibold">
                          {item.namaBarang}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-center">
                          {String(idx + 1).padStart(4, '0')}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-center">
                          {item.spesifikasi || '-'}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-center">-</td>
                        <td className="border border-slate-900 py-1 px-1.5 text-center">-</td>
                        <td className="border border-slate-900 py-1 px-1.5 text-center">
                          {bulanBeli}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-center">
                          {tahunBeli}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-center">-</td>
                        <td className="border border-slate-900 py-1 px-1.5 text-center">-</td>
                        <td className="border border-slate-900 py-1 px-1.5 text-center">-</td>
                        <td className="border border-slate-900 py-1 px-1.5 text-center">-</td>
                        <td className="border border-slate-900 py-1 px-1.5 text-center">-</td>
                        <td className="border border-slate-900 py-1 px-1.5 text-center">
                          {item.kondisi || 'Baik'}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-center">
                          {item.sumberPerolehan || 'Pembelian'}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-center whitespace-nowrap">
                          {item.volume} {item.satuan || ''}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-right whitespace-nowrap">
                          {formatNominalRekonsiliasi(item.hargaSatuan)}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-right font-bold whitespace-nowrap">
                          {formatNominalRekonsiliasi(item.totalHarga)}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-left">
                          {item.keterangan || '-'}
                        </td>
                      </tr>
                    );
                  }))}

                  {/* Baris kosong bernomor (1 s/d 11) sesuai template CSV bila data kurang dari 11 */}
                  {!showOnlyFilledRows &&
                    displayBarangEkstra.length < 11 &&
                    Array.from({ length: 11 - displayBarangEkstra.length }).map((_, i) => {
                      const rowNum = displayBarangEkstra.length + i + 1;
                      return (
                        <tr key={`empty-kib-${rowNum}`} className="h-6">
                          <td className="border border-slate-900 py-1 px-1 text-center">
                            {rowNum}
                          </td>
                          {Array.from({ length: 20 }).map((__, colIdx) => (
                            <td key={colIdx} className="border border-slate-900 py-1 px-1">
                              &nbsp;
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  <tr className="bg-white font-bold text-slate-950">
                    <td
                      colSpan={19}
                      className="border border-slate-900 py-1.5 px-3 text-center font-extrabold"
                    >
                      Total
                    </td>
                    <td className="border border-slate-900 py-1.5 px-1.5 text-right font-black whitespace-nowrap">
                      {displayBarangEkstra.length > 0
                        ? formatNominalRekonsiliasi(
                            displayBarangEkstra.reduce((acc, i) => acc + (i.totalHarga || 0), 0)
                          )
                        : '-'}
                    </td>
                    <td className="border border-slate-900 py-1.5 px-1.5"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Tanda Tangan KIB B sesuai File CSV */}
            <div className="mt-8 pt-2 text-xs sm:text-[13px] text-slate-950 break-inside-avoid">
              <div className="grid grid-cols-2 gap-8 text-center">
                {/* Kiri: MENGETAHUI KEPALA SATUAN SEKOLAH */}
                <div className="flex flex-col justify-between min-h-[120px]">
                  <div>
                    <p className="font-semibold uppercase">MENGETAHUI</p>
                    <p className="font-bold uppercase">KEPALA SATUAN SEKOLAH</p>
                  </div>
                  <div className="mt-16">
                    <p className="font-bold underline">{namaKepsekFooter}</p>
                    <p className="mt-0.5">NIP. {nipKepsekFooter}</p>
                  </div>
                </div>

                {/* Kanan: Tanggal Lokasi & PENGURUS BARANG PEMBANTU */}
                <div className="flex flex-col justify-between min-h-[120px]">
                  <div>
                    <p className="font-normal">
                      {schoolInfo.kecamatan || 'Tambelang'},{' '}
                      {reportDateInfo
                        ? `${reportDateInfo.dayPad} ${reportDateInfo.monthName} ${reportDateInfo.year}`
                        : cutOffDate.replace(/^PER\s+/i, '')}
                    </p>
                    <p className="font-bold uppercase">PENGURUS BARANG PEMBANTU</p>
                  </div>
                  <div className="mt-16">
                    <p className="font-bold underline">{namaPengurusPembantuFooter}</p>
                    <p className="mt-0.5">NIP. {nipPengurusPembantuFooter}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : variant === 'rekon_gabung_sekolah' ? (
          /* ================================================================= */
          /* 6. BA REKON GABUNG SEKOLAH (Sesuai File CSV BA REKON GABUNG)      */
          /*    - Tabel 1: Gabungan Belanja Sanggar Kegiatan Belajar (SKB) & TK */
          /*    - Tabel 2: Gabungan Belanja Seluruh Sekolah Dasar (SD)          */
          /*    - Tabel 3: Gabungan Belanja Seluruh Sekolah SMP (SMPN)          */
          /* ================================================================= */
          <div className="space-y-10">
            {[
              {
                id: 'paud',
                groupTitle: 'BOP TK, SKB',
                rows: rekonGabungSekolahData.paud.rows,
                subTotalLabel: 'SUB TOTAL BOP PAUD',
                subTotals: rekonGabungSekolahData.paud.totals,
                combinedFooter: null as null | {
                  label: string;
                  totals: typeof rekonGabungSekolahData.bosSdSmpTotals;
                },
              },
              {
                id: 'sd',
                groupTitle: 'SEKOLAH DASAR',
                rows: rekonGabungSekolahData.sd.rows,
                subTotalLabel: 'SUB TOTAL',
                subTotals: rekonGabungSekolahData.sd.totals,
                combinedFooter: null as null | {
                  label: string;
                  totals: typeof rekonGabungSekolahData.bosSdSmpTotals;
                },
              },
              {
                id: 'smp',
                groupTitle: 'SMPN',
                rows: rekonGabungSekolahData.smp.rows,
                subTotalLabel: 'SUB TOTAL',
                subTotals: rekonGabungSekolahData.smp.totals,
                combinedFooter: {
                  label: 'SUB TOTAL BOS SD, SMPN',
                  totals: rekonGabungSekolahData.bosSdSmpTotals,
                },
              },
            ].map((section) => (
              <div key={section.id} className="overflow-x-auto print:overflow-visible break-inside-avoid">
                <table className="w-full border-collapse border border-slate-900 text-[10px] sm:text-[11px]">
                  <tbody>
                    <tr className="bg-white text-slate-950 font-bold uppercase">
                      <th
                        rowSpan={2}
                        className="border border-slate-900 py-2 px-2 text-center align-middle min-w-[250px]"
                      >
                        JENIS PERSEDIAAN
                      </th>
                      <th
                        rowSpan={2}
                        className="border border-slate-900 py-2 px-1.5 text-center align-middle leading-tight w-28"
                      >
                        {labelSaldoAwalHeader}
                      </th>
                      <th
                        rowSpan={2}
                        className="border border-slate-900 py-2 px-1.5 text-center align-middle w-28"
                      >
                        PENERIMAAN
                      </th>
                      <th
                        colSpan={2}
                        className="border border-slate-900 py-1.5 px-1.5 text-center align-middle"
                      >
                        PENGELUARAN
                      </th>
                      <th
                        colSpan={2}
                        className="border border-slate-900 py-1.5 px-1.5 text-center align-middle"
                      >
                        HIBAH
                      </th>
                      <th
                        rowSpan={2}
                        className="border border-slate-900 py-2 px-1.5 text-center align-middle leading-tight w-28"
                      >
                        SALDO AKHIR
                      </th>
                    </tr>
                    <tr className="bg-white text-slate-950 font-bold uppercase">
                      <th className="border border-slate-900 py-1.5 px-1.5 text-center align-middle w-24">
                        SALDO AWAL
                      </th>
                      <th className="border border-slate-900 py-1.5 px-1.5 text-center align-middle leading-tight w-32">
                        BELANJA PER {cutOffDate.toUpperCase()}
                      </th>
                      <th className="border border-slate-900 py-1.5 px-1.5 text-center align-middle w-20">
                        MASUK
                      </th>
                      <th className="border border-slate-900 py-1.5 px-1.5 text-center align-middle w-20">
                        KELUAR
                      </th>
                    </tr>

                    {/* Baris Sub-Judul Kelompok Sekolah (BOP TK, SKB / SEKOLAH DASAR / SMPN) */}
                    <tr className="bg-slate-50/60 print:bg-white font-bold text-slate-950 uppercase">
                      <td className="border border-slate-900 py-1.5 px-2 text-center font-extrabold">
                        {section.groupTitle}
                      </td>
                      {Array.from({ length: 7 }).map((_, cIdx) => (
                        <td
                          key={`${section.id}-grp-${cIdx}`}
                          className="border border-slate-900 py-1.5 px-1.5"
                        >
                          &nbsp;
                        </td>
                      ))}
                    </tr>

                    {/* Baris Rincian Jenis Persediaan */}
                    {section.rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="border border-slate-900 py-3 text-center italic text-slate-500"
                        >
                          NIHIL - Tidak ada rincian belanja terisi pada kelompok ini.
                        </td>
                      </tr>
                    ) : (
                      section.rows.map((row, idx) => (
                      <tr key={`${section.id}-row-${idx}`} className="hover:bg-slate-50/70">
                        <td className="border border-slate-900 py-1 px-2 text-left text-slate-950">
                          {row.label || '\u00A0'}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-right whitespace-nowrap">
                          {row.isBlank
                            ? ''
                            : row.nominalSaldoAwal > 0
                            ? formatNominalRekonsiliasi(row.nominalSaldoAwal)
                            : ''}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-right whitespace-nowrap">
                          {row.isBlank
                            ? ''
                            : row.nominalBelanjaLra > 0
                            ? formatNominalRekonsiliasi(row.nominalBelanjaLra)
                            : ''}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-right whitespace-nowrap">
                          {row.isBlank
                            ? ''
                            : row.nominalPengeluaranSaldoAwal > 0
                            ? formatNominalRekonsiliasi(row.nominalPengeluaranSaldoAwal)
                            : '-'}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-right whitespace-nowrap">
                          {row.isBlank
                            ? ''
                            : row.nominalPengeluaranBelanja > 0
                            ? formatNominalRekonsiliasi(row.nominalPengeluaranBelanja)
                            : ''}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-right whitespace-nowrap">
                          {row.isBlank
                            ? ''
                            : row.nominalHibahMasuk > 0
                            ? formatNominalRekonsiliasi(row.nominalHibahMasuk)
                            : '-'}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-right whitespace-nowrap">
                          {row.isBlank
                            ? ''
                            : row.nominalHibahKeluar > 0
                            ? formatNominalRekonsiliasi(row.nominalHibahKeluar)
                            : '-'}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-right whitespace-nowrap">
                          {row.isBlank
                            ? ''
                            : row.sisaNilai !== 0
                            ? formatNominalRekonsiliasi(row.sisaNilai)
                            : '-'}
                        </td>
                      </tr>
                    )))}

                    {/* Baris SUB TOTAL per Tabel */}
                    <tr className="bg-white font-bold text-slate-950">
                      <td className="border border-slate-900 py-1.5 px-2 text-left uppercase font-extrabold">
                        {section.subTotalLabel}
                      </td>
                      <td className="border border-slate-900 py-1.5 px-1.5 text-right whitespace-nowrap">
                        {section.subTotals.nominalSaldoAwal > 0
                          ? formatNominalRekonsiliasi(section.subTotals.nominalSaldoAwal)
                          : '-'}
                      </td>
                      <td className="border border-slate-900 py-1.5 px-1.5 text-right whitespace-nowrap">
                        {section.subTotals.nominalBelanjaLra > 0
                          ? formatNominalRekonsiliasi(section.subTotals.nominalBelanjaLra)
                          : '-'}
                      </td>
                      <td className="border border-slate-900 py-1.5 px-1.5 text-right whitespace-nowrap">
                        {section.subTotals.nominalPengeluaranSaldoAwal > 0
                          ? formatNominalRekonsiliasi(
                              section.subTotals.nominalPengeluaranSaldoAwal
                            )
                          : '-'}
                      </td>
                      <td className="border border-slate-900 py-1.5 px-1.5 text-right whitespace-nowrap">
                        {section.subTotals.nominalPengeluaranBelanja > 0
                          ? formatNominalRekonsiliasi(
                              section.subTotals.nominalPengeluaranBelanja
                            )
                          : '-'}
                      </td>
                      <td className="border border-slate-900 py-1.5 px-1.5 text-right whitespace-nowrap">
                        {section.subTotals.nominalHibahMasuk > 0
                          ? formatNominalRekonsiliasi(section.subTotals.nominalHibahMasuk)
                          : '-'}
                      </td>
                      <td className="border border-slate-900 py-1.5 px-1.5 text-right whitespace-nowrap">
                        {section.subTotals.nominalHibahKeluar > 0
                          ? formatNominalRekonsiliasi(section.subTotals.nominalHibahKeluar)
                          : '-'}
                      </td>
                      <td className="border border-slate-900 py-1.5 px-1.5 text-right whitespace-nowrap">
                        {section.subTotals.sisaNilai !== 0
                          ? formatNominalRekonsiliasi(section.subTotals.sisaNilai)
                          : '-'}
                      </td>
                    </tr>

                    {/* Baris SUB TOTAL BOS SD, SMPN pada Tabel ke-3 (SMPN) */}
                    {section.combinedFooter && (
                      <tr className="bg-slate-50 print:bg-white font-bold text-slate-950">
                        <td className="border border-slate-900 py-1.5 px-2 text-left uppercase font-extrabold">
                          {section.combinedFooter.label}
                        </td>
                        <td className="border border-slate-900 py-1.5 px-1.5 text-right whitespace-nowrap">
                          {section.combinedFooter.totals.nominalSaldoAwal > 0
                            ? formatNominalRekonsiliasi(
                                section.combinedFooter.totals.nominalSaldoAwal
                              )
                            : '-'}
                        </td>
                        <td className="border border-slate-900 py-1.5 px-1.5 text-right whitespace-nowrap">
                          {section.combinedFooter.totals.nominalBelanjaLra > 0
                            ? formatNominalRekonsiliasi(
                                section.combinedFooter.totals.nominalBelanjaLra
                              )
                            : '-'}
                        </td>
                        <td className="border border-slate-900 py-1.5 px-1.5 text-right whitespace-nowrap">
                          {section.combinedFooter.totals.nominalPengeluaranSaldoAwal > 0
                            ? formatNominalRekonsiliasi(
                                section.combinedFooter.totals.nominalPengeluaranSaldoAwal
                              )
                            : '-'}
                        </td>
                        <td className="border border-slate-900 py-1.5 px-1.5 text-right whitespace-nowrap">
                          {section.combinedFooter.totals.nominalPengeluaranBelanja > 0
                            ? formatNominalRekonsiliasi(
                                section.combinedFooter.totals.nominalPengeluaranBelanja
                              )
                            : '-'}
                        </td>
                        <td className="border border-slate-900 py-1.5 px-1.5 text-right whitespace-nowrap">
                          {section.combinedFooter.totals.nominalHibahMasuk > 0
                            ? formatNominalRekonsiliasi(
                                section.combinedFooter.totals.nominalHibahMasuk
                              )
                            : '-'}
                        </td>
                        <td className="border border-slate-900 py-1.5 px-1.5 text-right whitespace-nowrap">
                          {section.combinedFooter.totals.nominalHibahKeluar > 0
                            ? formatNominalRekonsiliasi(
                                section.combinedFooter.totals.nominalHibahKeluar
                              )
                            : '-'}
                        </td>
                        <td className="border border-slate-900 py-1.5 px-1.5 text-right whitespace-nowrap">
                          {section.combinedFooter.totals.sisaNilai !== 0
                            ? formatNominalRekonsiliasi(section.combinedFooter.totals.sisaNilai)
                            : '-'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Centered Government & School Header */}
            <div className="text-center text-xs sm:text-sm font-bold uppercase leading-snug pb-3 mb-6 border-b-2 border-slate-900">
              <div>{pemerintahDaerah}</div>
              {isStockOpname && <div>{dinasHeader}</div>}
              <div>{namaSekolahHeader}</div>
            </div>

            {/* Centered Document Title */}
            <div className="text-center mb-6">
              <h1 className="text-sm sm:text-base font-bold uppercase tracking-wide text-slate-950">
                {variant === 'barang_ekstra'
                  ? 'BERITA ACARA BARANG EKSTRAKOMPTABEL'
                  : isStockOpname
                  ? 'BERITA ACARA STOCK OPNAME FISIK PERSEDIAAN BARANG'
                  : 'BERITA ACARA REKONSILIASI PERSEDIAAN'}
              </h1>
              <p className="text-xs sm:text-sm font-bold uppercase text-slate-950 mt-0.5">
                {periodeTahunAnggaran}
              </p>
            </div>

            {/* Opening Paragraph & Officials List */}
            <div className="text-xs sm:text-[13px] leading-relaxed space-y-3 mb-4 text-slate-950">
              <p>{kalimatPembuka}</p>

              <div className="space-y-3 pl-1">
                {/* Official 1 */}
                <table className="text-xs sm:text-[13px] border-collapse">
                  <tbody>
                    <tr>
                      <td className="w-24 py-0.5 align-top">Nama</td>
                      <td className="py-0.5 font-semibold">: {namaPihak1}</td>
                    </tr>
                    <tr>
                      <td className="w-24 py-0.5 align-top">NIP</td>
                      <td className="py-0.5">: {nipPihak1}</td>
                    </tr>
                    <tr>
                      <td className="w-24 py-0.5 align-top">Jabatan</td>
                      <td className="py-0.5">: {jabatanPihak1}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Official 2 */}
                <table className="text-xs sm:text-[13px] border-collapse">
                  <tbody>
                    <tr>
                      <td className="w-24 py-0.5 align-top">Nama</td>
                      <td className="py-0.5 font-semibold">: {namaPihak2}</td>
                    </tr>
                    <tr>
                      <td className="w-24 py-0.5 align-top">NIP</td>
                      <td className="py-0.5">: {nipPihak2}</td>
                    </tr>
                    <tr>
                      <td className="w-24 py-0.5 align-top">Jabatan</td>
                      <td className="py-0.5">: {jabatanPihak2}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p>
                {variant === 'barang_ekstra'
                  ? `Dengan ini Rincian Barang Ekstakomptabel yang dikuasai oleh ${namaSekolahHeader} sampai pada ${cutOffDate.replace(/^PER\s+/i, '')} adalah sebagai berikut :`
                  : isDinasPendidikanRekon
                  ? 'Berdasarkan hasil pemeriksaan persediaan fisik, serta bukti-bukti yang berada dalam pengurusan/pengolahan ini ditemukan perincian sebagai berikut :'
                  : 'Berdasarkan hasil pemeriksaan persediaan fisik, serta bukti-bukti yang berada dalam pengurusan/pengelolaan ini ditemukan perincian sebagai berikut :'}
              </p>
            </div>

        {/* Document Table: Stock Opname vs Rekonsiliasi Persediaan vs Barang Ekstra */}
        <div className="overflow-x-auto print:overflow-visible">
          {variant === 'barang_ekstra' ? (
            <table className="w-full border-collapse border border-slate-900 text-[11px] sm:text-xs relative z-0">
              <tbody>
                <tr className="bg-white text-slate-950 font-bold text-center">
                  <th className="border border-slate-900 py-2 px-2 w-10">No</th>
                  <th className="border border-slate-900 py-2 px-3 text-left">Jenis Persediaan</th>
                  <th className="border border-slate-900 py-2 px-2 w-20">Jumlah</th>
                  <th className="border border-slate-900 py-2 px-2.5 w-32 text-right">Harga Satuan (Rp)</th>
                  <th className="border border-slate-900 py-2 px-2 w-28">Tahun Pembelian</th>
                  <th className="border border-slate-900 py-2 px-2.5 w-36 text-right">Total Harga (Rp)</th>
                  <th className="border border-slate-900 py-2 px-3 text-left">NAMA UPT</th>
                </tr>
                {displayBarangEkstra.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="border border-slate-900 py-6 text-center italic text-slate-500">
                      NIHIL - Belum ada data Barang Ekstrakomptabel yang disetujui (Approved).
                    </td>
                  </tr>
                ) : (
                  displayBarangEkstra.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="border border-slate-900 py-1.5 px-2 text-center font-bold">{idx + 1}</td>
                      <td className="border border-slate-900 py-1.5 px-3 font-semibold text-slate-950 text-left">
                        {item.namaBarang} {item.spesifikasi ? `(${item.spesifikasi})` : ''}
                      </td>
                      <td className="border border-slate-900 py-1.5 px-2 text-center font-medium">
                        {item.volume} {item.satuan || ''}
                      </td>
                      <td className="border border-slate-900 py-1.5 px-2.5 text-right font-medium whitespace-nowrap">
                        {formatNominalRekonsiliasi(item.hargaSatuan)}
                      </td>
                      <td className="border border-slate-900 py-1.5 px-2 text-center">
                        {item.tahunAnggaran || (item.tanggalPerolehan ? new Date(item.tanggalPerolehan).getFullYear() : tahunAnggaranBerjalan)}
                      </td>
                      <td className="border border-slate-900 py-1.5 px-2.5 text-right font-bold whitespace-nowrap">
                        {formatNominalRekonsiliasi(item.totalHarga)}
                      </td>
                      <td className="border border-slate-900 py-1.5 px-3 text-left uppercase text-slate-950">
                        {item.schoolName || namaSekolahHeader}
                      </td>
                    </tr>
                  ))
                )}
                <tr className="bg-white font-bold text-slate-950">
                  <td colSpan={5} className="border border-slate-900 py-2 px-3 text-center uppercase tracking-wider font-extrabold">
                    JUMLAH
                  </td>
                  <td className="border border-slate-900 py-2 px-2.5 text-right font-black whitespace-nowrap">
                    {displayBarangEkstra.length > 0
                      ? formatNominalRekonsiliasi(displayBarangEkstra.reduce((acc, i) => acc + (i.totalHarga || 0), 0))
                      : '-'}
                  </td>
                  <td className="border border-slate-900 py-2 px-2"></td>
                </tr>
              </tbody>
            </table>
          ) : isStockOpname ? (
            <div className="relative">
              {/* Watermark NIHIL di tengah tabel */}
              <div
                aria-hidden="true"
                className="pointer-events-none select-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden pt-10"
              >
                <span className="text-5xl sm:text-7xl font-extrabold uppercase tracking-[0.3em] text-slate-900/20 print:text-slate-900/25">
                  NIHIL
                </span>
              </div>

              <table className="w-full border-collapse border border-slate-900 text-[11px] sm:text-xs relative z-0">
                <tbody>
                  <tr className="bg-white text-slate-950 font-bold">
                    <th
                      rowSpan={2}
                      className="border border-slate-900 py-2 px-2.5 text-center align-middle min-w-[230px] uppercase"
                    >
                      BEBAN
                    </th>
                    <th
                      rowSpan={2}
                      className="border border-slate-900 py-2 px-2 text-center align-middle w-24"
                    >
                      Satuan
                    </th>
                    <th
                      colSpan={2}
                      className="border border-slate-900 py-1.5 px-2 text-center align-middle"
                    >
                      Jumlah
                    </th>
                    <th
                      rowSpan={2}
                      className="border border-slate-900 py-2 px-2 text-center align-middle w-28"
                    >
                      Selisih
                    </th>
                    <th
                      rowSpan={2}
                      className="border border-slate-900 py-2 px-2 text-center align-middle w-32"
                    >
                      Kondisi Barang
                    </th>
                  </tr>
                  <tr className="bg-white text-slate-950 font-bold">
                    <th className="border border-slate-900 py-1.5 px-2 text-center align-middle w-36">
                      Saldo pada kartu persediaan
                    </th>
                    <th className="border border-slate-900 py-1.5 px-2 text-center align-middle w-36">
                      Fisik Barang Hasil
                    </th>
                  </tr>
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={idx} className="h-9">
                      <td className="border border-slate-900 py-2 px-2 text-left text-slate-950">
                        &nbsp;
                      </td>
                      <td className="border border-slate-900 py-2 px-2 text-center whitespace-nowrap">
                        &nbsp;
                      </td>
                      <td className="border border-slate-900 py-2 px-2 text-right whitespace-nowrap">
                        &nbsp;
                      </td>
                      <td className="border border-slate-900 py-2 px-2 text-right whitespace-nowrap">
                        &nbsp;
                      </td>
                      <td className="border border-slate-900 py-2 px-2 text-right whitespace-nowrap">
                        &nbsp;
                      </td>
                      <td className="border border-slate-900 py-2 px-2 text-center whitespace-nowrap">
                        &nbsp;
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : isDinasPendidikanRekon ? (
            <table className="w-full border-collapse border border-slate-900 text-[10px] sm:text-[11px]">
              <tbody>
                <tr className="bg-white text-slate-950 font-bold uppercase">
                  <th
                    rowSpan={2}
                    className="border border-slate-900 py-2 px-2 text-center align-middle min-w-[230px]"
                  >
                    JENIS PERSEDIAAN
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-slate-900 py-2 px-1.5 text-center align-middle leading-tight w-24"
                  >
                    {labelSaldoAwalHeader}
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-slate-900 py-2 px-1.5 text-center align-middle w-24"
                  >
                    BELANJA LRA
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-slate-900 py-2 px-1.5 text-center align-middle leading-tight w-24"
                  >
                    PENGAKUAN BAST
                  </th>
                  <th
                    colSpan={3}
                    className="border border-slate-900 py-1.5 px-1.5 text-center align-middle"
                  >
                    PENGELUARAN
                  </th>
                  <th
                    colSpan={2}
                    className="border border-slate-900 py-1.5 px-1.5 text-center align-middle"
                  >
                    HIBAH
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-slate-900 py-2 px-1.5 text-center align-middle leading-tight w-24"
                  >
                    SALDO AKHIR
                  </th>
                </tr>
                <tr className="bg-white text-slate-950 font-bold uppercase">
                  <th className="border border-slate-900 py-1.5 px-1.5 text-center align-middle w-20">
                    SALDO AWAL
                  </th>
                  <th className="border border-slate-900 py-1.5 px-1.5 text-center align-middle w-24">
                    BELANJA
                  </th>
                  <th className="border border-slate-900 py-1.5 px-1.5 text-center align-middle leading-tight w-24">
                    BAST DILUAR BELANJA
                  </th>
                  <th className="border border-slate-900 py-1.5 px-1.5 text-center align-middle w-18">
                    MASUK
                  </th>
                  <th className="border border-slate-900 py-1.5 px-1.5 text-center align-middle w-18">
                    KELUAR
                  </th>
                </tr>

                {/* Baris Utama Jenis Persediaan Dinas Pendidikan */}
                {dinasRekonData.mainRows.map((row, idx) => (
                  <tr key={`dinas-main-${idx}`} className="hover:bg-slate-50/70">
                    <td className="border border-slate-900 py-1 px-2 text-left text-slate-950">
                      {row.label || '\u00A0'}
                    </td>
                    <td className="border border-slate-900 py-1 px-1.5 text-right whitespace-nowrap">
                      {row.nominalSaldoAwal > 0
                        ? formatNominalRekonsiliasi(row.nominalSaldoAwal)
                        : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-1.5 text-right whitespace-nowrap">
                      {row.nominalBelanjaLra > 0
                        ? formatNominalRekonsiliasi(row.nominalBelanjaLra)
                        : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-1.5 text-right whitespace-nowrap">
                      {row.nominalPengakuanBast > 0
                        ? formatNominalRekonsiliasi(row.nominalPengakuanBast)
                        : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-1.5 text-right whitespace-nowrap">
                      {row.nominalPengeluaranSaldoAwal > 0
                        ? formatNominalRekonsiliasi(row.nominalPengeluaranSaldoAwal)
                        : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-1.5 text-right whitespace-nowrap">
                      {row.nominalPengeluaranBelanja > 0
                        ? formatNominalRekonsiliasi(row.nominalPengeluaranBelanja)
                        : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-1.5 text-right whitespace-nowrap">
                      {row.nominalPengeluaranBast > 0
                        ? formatNominalRekonsiliasi(row.nominalPengeluaranBast)
                        : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-1.5 text-right whitespace-nowrap">
                      {row.nominalHibahMasuk > 0
                        ? formatNominalRekonsiliasi(row.nominalHibahMasuk)
                        : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-1.5 text-right whitespace-nowrap">
                      {row.nominalHibahKeluar > 0
                        ? formatNominalRekonsiliasi(row.nominalHibahKeluar)
                        : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-1.5 text-right whitespace-nowrap">
                      {row.sisaNilai !== 0
                        ? formatNominalRekonsiliasi(row.sisaNilai)
                        : '-'}
                    </td>
                  </tr>
                ))}

                {/* Baris Pemisah sebelum Belanja barjas BOS & BOP PAUD */}
                {!showOnlyFilledRows && (
                  <>
                    <tr className="h-5">
                      {Array.from({ length: 10 }).map((_, cIdx) => (
                        <td key={`sep1-${cIdx}`} className="border border-slate-900 py-0.5 px-1.5">
                          &nbsp;
                        </td>
                      ))}
                    </tr>
                    <tr className="h-5">
                      {Array.from({ length: 10 }).map((_, cIdx) => (
                        <td key={`sep2-${cIdx}`} className="border border-slate-900 py-0.5 px-1.5">
                          &nbsp;
                        </td>
                      ))}
                    </tr>
                  </>
                )}

                {/* Belanja barjas BOS & Belanja barjas BOP PAUD */}
                {dinasRekonData.bospRows.map((row, idx) => (
                  <tr key={`dinas-bosp-${idx}`} className="hover:bg-slate-50/70">
                    <td className="border border-slate-900 py-1 px-2 text-left text-slate-950">
                      {row.label}
                    </td>
                    <td className="border border-slate-900 py-1 px-1.5 text-right whitespace-nowrap">
                      {row.nominalSaldoAwal > 0
                        ? formatNominalRekonsiliasi(row.nominalSaldoAwal)
                        : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-1.5 text-right whitespace-nowrap">
                      {row.nominalBelanjaLra > 0
                        ? formatNominalRekonsiliasi(row.nominalBelanjaLra)
                        : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-1.5 text-right whitespace-nowrap">
                      {row.nominalPengakuanBast > 0
                        ? formatNominalRekonsiliasi(row.nominalPengakuanBast)
                        : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-1.5 text-right whitespace-nowrap">
                      {row.nominalPengeluaranSaldoAwal > 0
                        ? formatNominalRekonsiliasi(row.nominalPengeluaranSaldoAwal)
                        : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-1.5 text-right whitespace-nowrap">
                      {row.nominalPengeluaranBelanja > 0
                        ? formatNominalRekonsiliasi(row.nominalPengeluaranBelanja)
                        : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-1.5 text-right whitespace-nowrap">
                      {row.nominalPengeluaranBast > 0
                        ? formatNominalRekonsiliasi(row.nominalPengeluaranBast)
                        : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-1.5 text-right whitespace-nowrap">
                      {row.nominalHibahMasuk > 0
                        ? formatNominalRekonsiliasi(row.nominalHibahMasuk)
                        : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-1.5 text-right whitespace-nowrap">
                      {row.nominalHibahKeluar > 0
                        ? formatNominalRekonsiliasi(row.nominalHibahKeluar)
                        : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-1.5 text-right whitespace-nowrap">
                      {row.sisaNilai !== 0
                        ? formatNominalRekonsiliasi(row.sisaNilai)
                        : '-'}
                    </td>
                  </tr>
                ))}

                {/* Baris SUB TOTAL */}
                <tr className="bg-white font-bold text-slate-950">
                  <td className="border border-slate-900 py-1.5 px-2 text-left uppercase">
                    SUB TOTAL
                  </td>
                  <td className="border border-slate-900 py-1.5 px-1.5 text-right whitespace-nowrap">
                    {dinasRekonData.totals.nominalSaldoAwal > 0
                      ? formatNominalRekonsiliasi(dinasRekonData.totals.nominalSaldoAwal)
                      : '-'}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-1.5 text-right whitespace-nowrap">
                    {dinasRekonData.totals.nominalBelanjaLra > 0
                      ? formatNominalRekonsiliasi(dinasRekonData.totals.nominalBelanjaLra)
                      : '-'}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-1.5 text-right whitespace-nowrap">
                    {dinasRekonData.totals.nominalPengakuanBast > 0
                      ? formatNominalRekonsiliasi(dinasRekonData.totals.nominalPengakuanBast)
                      : '-'}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-1.5 text-right whitespace-nowrap">
                    {dinasRekonData.totals.nominalPengeluaranSaldoAwal > 0
                      ? formatNominalRekonsiliasi(
                          dinasRekonData.totals.nominalPengeluaranSaldoAwal
                        )
                      : '-'}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-1.5 text-right whitespace-nowrap">
                    {dinasRekonData.totals.nominalPengeluaranBelanja > 0
                      ? formatNominalRekonsiliasi(
                          dinasRekonData.totals.nominalPengeluaranBelanja
                        )
                      : '-'}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-1.5 text-right whitespace-nowrap">
                    {dinasRekonData.totals.nominalPengeluaranBast > 0
                      ? formatNominalRekonsiliasi(
                          dinasRekonData.totals.nominalPengeluaranBast
                        )
                      : '-'}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-1.5 text-right whitespace-nowrap">
                    {dinasRekonData.totals.nominalHibahMasuk > 0
                      ? formatNominalRekonsiliasi(dinasRekonData.totals.nominalHibahMasuk)
                      : '-'}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-1.5 text-right whitespace-nowrap">
                    {dinasRekonData.totals.nominalHibahKeluar > 0
                      ? formatNominalRekonsiliasi(dinasRekonData.totals.nominalHibahKeluar)
                      : '-'}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-1.5 text-right whitespace-nowrap">
                    {dinasRekonData.totals.sisaNilai !== 0
                      ? formatNominalRekonsiliasi(dinasRekonData.totals.sisaNilai)
                      : '-'}
                  </td>
                </tr>

                {/* Baris Kosong Pemisah Setelah SUB TOTAL */}
                {!showOnlyFilledRows && (
                  <tr className="h-5">
                    {Array.from({ length: 10 }).map((_, cIdx) => (
                      <td key={`sep-after-${cIdx}`} className="border border-slate-900 py-0.5 px-1.5">
                        &nbsp;
                      </td>
                    ))}
                  </tr>
                )}

                {/* Sub-Judul Persediaan di Luar Belanja Barang */}
                {(!showOnlyFilledRows || dinasRekonData.extraRows.length > 0) && (
                  <tr className="bg-white font-bold text-slate-950">
                    <td colSpan={10} className="border border-slate-900 py-1.5 px-2 text-left">
                      Persediaan yang berasal dari belanja diluar belanja barang dan belanja barang diserahkan ke masyarakat
                    </td>
                  </tr>
                )}

                {/* 5 Baris Rincian Persediaan di Luar Belanja Barang */}
                {dinasRekonData.extraRows.map((row, idx) => (
                  <tr key={`dinas-extra-${idx}`} className="hover:bg-slate-50/70">
                    <td className="border border-slate-900 py-1 px-2 text-left text-slate-950">
                      {row.label}
                    </td>
                    <td className="border border-slate-900 py-1 px-1.5 text-right whitespace-nowrap">
                      {row.nominalSaldoAwal > 0
                        ? formatNominalRekonsiliasi(row.nominalSaldoAwal)
                        : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-1.5 text-right whitespace-nowrap">
                      {row.nominalBelanjaLra > 0
                        ? formatNominalRekonsiliasi(row.nominalBelanjaLra)
                        : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-1.5 text-right whitespace-nowrap">
                      {row.nominalPengakuanBast > 0
                        ? formatNominalRekonsiliasi(row.nominalPengakuanBast)
                        : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-1.5 text-right whitespace-nowrap">
                      {row.nominalPengeluaranSaldoAwal > 0
                        ? formatNominalRekonsiliasi(row.nominalPengeluaranSaldoAwal)
                        : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-1.5 text-right whitespace-nowrap">
                      {row.nominalPengeluaranBelanja > 0
                        ? formatNominalRekonsiliasi(row.nominalPengeluaranBelanja)
                        : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-1.5 text-right whitespace-nowrap">
                      {row.nominalPengeluaranBast > 0
                        ? formatNominalRekonsiliasi(row.nominalPengeluaranBast)
                        : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-1.5 text-right whitespace-nowrap">
                      {row.nominalHibahMasuk > 0
                        ? formatNominalRekonsiliasi(row.nominalHibahMasuk)
                        : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-1.5 text-right whitespace-nowrap">
                      {row.nominalHibahKeluar > 0
                        ? formatNominalRekonsiliasi(row.nominalHibahKeluar)
                        : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-1.5 text-right whitespace-nowrap">
                      {row.sisaNilai !== 0
                        ? formatNominalRekonsiliasi(row.sisaNilai)
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full border-collapse border border-slate-900 text-[11px] sm:text-xs">
              <tbody>
                <tr className="bg-white text-slate-950 font-bold uppercase">
                  <th
                    rowSpan={2}
                    className="border border-slate-900 py-2 px-2.5 text-center align-middle min-w-[220px]"
                  >
                    JENIS PERSEDIAAN
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-slate-900 py-2 px-2 text-center align-middle leading-tight w-28"
                  >
                    {labelSaldoAwalHeader}
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-slate-900 py-2 px-2 text-center align-middle w-28"
                  >
                    BELANJA LRA
                  </th>
                  <th
                    colSpan={2}
                    className="border border-slate-900 py-1.5 px-2 text-center align-middle"
                  >
                    PENGELUARAN
                  </th>
                  <th
                    colSpan={2}
                    className="border border-slate-900 py-1.5 px-2 text-center align-middle"
                  >
                    HIBAH
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-slate-900 py-2 px-2 text-center align-middle leading-tight w-28"
                  >
                    SALDO AKHIR
                  </th>
                </tr>
                <tr className="bg-white text-slate-950 font-bold uppercase">
                  <th className="border border-slate-900 py-1.5 px-2 text-center align-middle w-24">
                    SALDO AWAL
                  </th>
                  <th className="border border-slate-900 py-1.5 px-2 text-center align-middle w-28">
                    BELANJA
                  </th>
                  <th className="border border-slate-900 py-1.5 px-2 text-center align-middle w-20">
                    MASUK
                  </th>
                  <th className="border border-slate-900 py-1.5 px-2 text-center align-middle w-20">
                    KELUAR
                  </th>
                </tr>
                {tableRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="border border-slate-900 py-6 text-center italic text-slate-500"
                    >
                      NIHIL - Belum ada mutasi belanja / persediaan yang terisi pada periode ini.
                    </td>
                  </tr>
                ) : (
                  tableRows.map((row) => (
                  <tr key={row.kodeRekening} className="hover:bg-slate-50/70">
                    <td className="border border-slate-900 py-1 px-2 text-left text-slate-950">
                      {row.kodeRekening}
                    </td>
                    <td className="border border-slate-900 py-1 px-2 text-right whitespace-nowrap">
                      {row.nominalSaldoAwal > 0
                        ? formatNominalRekonsiliasi(row.nominalSaldoAwal)
                        : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-2 text-right whitespace-nowrap">
                      {row.nominalBelanjaLra > 0
                        ? formatNominalRekonsiliasi(row.nominalBelanjaLra)
                        : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-2 text-right whitespace-nowrap">
                      {row.nominalPengeluaranSaldoAwal > 0
                        ? formatNominalRekonsiliasi(
                            row.nominalPengeluaranSaldoAwal
                          )
                        : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-2 text-right whitespace-nowrap">
                      {row.nominalPengeluaranBelanja > 0
                        ? formatNominalRekonsiliasi(
                            row.nominalPengeluaranBelanja
                          )
                        : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-2 text-right whitespace-nowrap">
                      {row.nominalHibahMasuk > 0
                        ? formatNominalRekonsiliasi(row.nominalHibahMasuk)
                        : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-2 text-right whitespace-nowrap">
                      {row.nominalHibahKeluar > 0
                        ? formatNominalRekonsiliasi(row.nominalHibahKeluar)
                        : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-2 text-right whitespace-nowrap">
                      {row.sisaNilai !== 0
                        ? formatNominalRekonsiliasi(row.sisaNilai)
                        : '-'}
                    </td>
                  </tr>
                )))}
                <tr className="bg-white font-bold text-slate-950">
                  <td className="border border-slate-900 py-1.5 px-2 text-left uppercase">
                    SUB TOTAL
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right whitespace-nowrap">
                    {subTotals.nominalSaldoAwal > 0
                      ? formatNominalRekonsiliasi(subTotals.nominalSaldoAwal)
                      : '-'}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right whitespace-nowrap">
                    {subTotals.nominalBelanjaLra > 0
                      ? formatNominalRekonsiliasi(subTotals.nominalBelanjaLra)
                      : '-'}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right whitespace-nowrap">
                    {subTotals.nominalPengeluaranSaldoAwal > 0
                      ? formatNominalRekonsiliasi(
                          subTotals.nominalPengeluaranSaldoAwal
                        )
                      : '-'}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right whitespace-nowrap">
                    {subTotals.nominalPengeluaranBelanja > 0
                      ? formatNominalRekonsiliasi(
                          subTotals.nominalPengeluaranBelanja
                        )
                      : '-'}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right whitespace-nowrap">
                    {subTotals.nominalHibahMasuk > 0
                      ? formatNominalRekonsiliasi(subTotals.nominalHibahMasuk)
                      : '-'}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right whitespace-nowrap">
                    {subTotals.nominalHibahKeluar > 0
                      ? formatNominalRekonsiliasi(subTotals.nominalHibahKeluar)
                      : '-'}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right whitespace-nowrap">
                    {subTotals.sisaNilai !== 0
                      ? formatNominalRekonsiliasi(subTotals.sisaNilai)
                      : '-'}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* Signatures Section */}
        {variant === 'barang_ekstra' ? (
          <div className="mt-8 text-xs sm:text-[13px] text-slate-950 break-inside-avoid">
            <div className="grid grid-cols-2 gap-6 text-center">
              {/* Left: Pengurus Barang Pembantu */}
              <div className="flex flex-col justify-between min-h-[115px]">
                <div>
                  <p className="font-normal">&nbsp;</p>
                  <p className="font-normal">Pengurus Barang Pembantu,</p>
                </div>
                <div className="mt-14">
                  <p className="font-bold underline">{namaPengurusPembantuFooter}</p>
                  <p className="mt-0.5">NIP. {nipPengurusPembantuFooter}</p>
                </div>
              </div>

              {/* Right: Mengetahui, Kepala Sekolah */}
              <div className="flex flex-col justify-between min-h-[115px]">
                <div>
                  <p className="font-normal">Mengetahui,</p>
                  <p className="font-normal">Kepala Sekolah,</p>
                </div>
                <div className="mt-14">
                  <p className="font-bold underline">{namaKepsekFooter}</p>
                  <p className="mt-0.5">NIP. {nipKepsekFooter}</p>
                </div>
              </div>
            </div>
          </div>
        ) : isStockOpname ? (
          <div className="mt-8 text-xs sm:text-[13px] text-slate-950 break-inside-avoid">
            <div className="grid grid-cols-2 gap-6 text-center">
              {/* Left: Mengetahui, Kepala Sekolah */}
              <div className="flex flex-col justify-between min-h-[115px]">
                <div>
                  <p className="font-normal">Mengetahui,</p>
                  <p className="font-normal">Kepala Sekolah,</p>
                </div>
                <div className="mt-14">
                  <p className="font-bold underline">{namaKepsekFooter}</p>
                  <p className="mt-0.5">NIP. {nipKepsekFooter}</p>
                </div>
              </div>

              {/* Right: Pengurus Barang */}
              <div className="flex flex-col justify-between min-h-[115px]">
                <div>
                  <p className="font-normal">&nbsp;</p>
                  <p className="font-normal">Pengurus Barang</p>
                </div>
                <div className="mt-14">
                  <p className="font-bold underline">
                    {namaPengurusBarangFooter}
                  </p>
                  <p className="mt-0.5">NIP. {nipPengurusBarangFooter}</p>
                </div>
              </div>
            </div>
          </div>
        ) : isDinasPendidikanRekon ? (
          <div className="mt-10 text-xs sm:text-[13px] text-slate-950 break-inside-avoid space-y-8">
            {/* Baris 1: Pengurus Barang & Kepala Bidang Pengelolaan BMD */}
            <div className="grid grid-cols-2 gap-8 text-center">
              <div className="flex flex-col justify-between min-h-[110px]">
                <p className="font-normal">Pengurus Barang,</p>
                <div className="mt-14">
                  <p className="font-bold underline">{defaultNamaPengurusDinasRekon}</p>
                  <p className="mt-0.5">NIP. {defaultNipPengurusDinasRekon}</p>
                </div>
              </div>

              <div className="flex flex-col justify-between min-h-[110px]">
                <p className="font-normal">Kepala Bidang Pengelolaan BMD,</p>
                <div className="mt-14">
                  <p className="font-bold underline">{defaultNamaKabidBmdDinasRekon}</p>
                  <p className="mt-0.5">NIP. {defaultNipKabidBmdDinasRekon}</p>
                </div>
              </div>
            </div>

            {/* Baris 2: Pejabat Penatausahaan Barang & Kabid Akuntansi */}
            <div className="grid grid-cols-2 gap-8 text-center">
              <div className="flex flex-col justify-between min-h-[110px]">
                <p className="font-normal">Pejabat Penatausahaan Barang,</p>
                <div className="mt-14">
                  <p className="font-bold underline">{defaultNamaPejabatDinasRekon}</p>
                  <p className="mt-0.5">NIP. {defaultNipPejabatDinasRekonFooter}</p>
                </div>
              </div>

              <div className="flex flex-col justify-between min-h-[110px]">
                <p className="font-normal">Kabid Akuntansi,</p>
                <div className="mt-14">
                  <p className="font-bold underline">{defaultNamaKabidAkuntansiDinasRekon}</p>
                  <p className="mt-0.5">NIP. {defaultNipKabidAkuntansiDinasRekon}</p>
                </div>
              </div>
            </div>

            {/* Baris 3 Tengah: Mengetahui Kepala Dinas */}
            <div className="text-center flex flex-col items-center justify-between min-h-[115px]">
              <div>
                <p className="font-normal">Mengetahui :</p>
                <p className="font-normal">Kepala Dinas</p>
              </div>
              <div className="mt-14">
                <p className="font-bold underline">{defaultNamaKadisDinasRekon}</p>
                <p className="mt-0.5">NIP.{defaultNipKadisDinasRekon}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-8 text-xs sm:text-[13px] text-slate-950 break-inside-avoid">
            <div className="grid grid-cols-2 gap-6 text-center">
              {/* Left: Pengurus Barang Pembantu */}
              <div className="flex flex-col justify-between min-h-[110px]">
                <p className="font-normal">Pengurus Barang Pembantu</p>
                <div className="mt-14">
                  <p className="font-bold underline">
                    {namaPengurusPembantuFooter}
                  </p>
                  <p className="mt-0.5">NIP. {nipPengurusPembantuFooter}</p>
                </div>
              </div>

              {/* Right: Pengurus Barang */}
              <div className="flex flex-col justify-between min-h-[110px]">
                <p className="font-normal">Pengurus Barang</p>
                <div className="mt-14">
                  <p className="font-bold underline">
                    {namaPengurusBarangFooter}
                  </p>
                  <p className="mt-0.5">NIP. {nipPengurusBarangFooter}</p>
                </div>
              </div>
            </div>

            {/* Bottom Center: Mengetahui Kepala Sekolah */}
            <div className="mt-8 text-center flex flex-col items-center justify-between min-h-[115px]">
              <div>
                <p>Mengetahui:</p>
                <p>Kepala Sekolah</p>
              </div>
              <div className="mt-14">
                <p className="font-bold underline">{namaKepsekFooter}</p>
                <p className="mt-0.5">NIP. {nipKepsekFooter}</p>
              </div>
            </div>
          </div>
        )}
          </>
        )}
      </div>

      {/* Bottom Print Button (Hidden in Print) */}
      <div className="print:hidden flex items-center justify-end">
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>Cetak</span>
        </button>
      </div>
    </div>
  );
};
