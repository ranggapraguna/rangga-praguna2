export type Triwulan = 'TW1' | 'TW2' | 'TW3' | 'TW4';

export type BOSSource = 
  | 'BOS Reguler' 
  | 'BOS Kinerja' 
  | 'BOS Daerah (BOSDA)' 
  | 'BOP PAUD/Kesetaraan'
  | 'APBD'
  | 'HIBAH';

export const BOS_SOURCE_OPTIONS: readonly BOSSource[] = [
  'BOS Reguler',
  'BOS Kinerja',
  'BOS Daerah (BOSDA)',
  'BOP PAUD/Kesetaraan',
  'APBD',
  'HIBAH',
] as const;

export type KomponenBOS =
  | '1. Penerimaan Peserta Didik Baru (PPDB)'
  | '2. Pengembangan Perpustakaan & Buku Teks'
  | '3. Pelaksanaan Pembelajaran & Ekstrakurikuler'
  | '4. Asesmen & Evaluasi Pembelajaran (ANBK/Ujian)'
  | '5. Administrasi Kegiatan Sekolah & ATK'
  | '6. Langganan Daya & Jasa (Listrik, Internet, Air)'
  | '7. Pemeliharaan Sarana & Prasarana Sekolah'
  | '8. Penyediaan Alat Multimedia Pembelajaran'
  | '9. Pembayaran Honor Tenaga Pendidik/Kependidikan';

export const REKENING_PERSEDIAAN_OPTIONS = [
  'Bahan-Bahan Bangunan dan Konstruksi',
  'Bahan-Bahan Kimia',
  'Bahan-Bahan Bakar dan Pelumas',
  'Bahan-Bahan Baku',
  'Bahan-Bahan Kimia Nuklir',
  'Bahan-Barang dalam Proses',
  'Bahan-Bahan/Bibit Tanaman',
  'Bahan-Isi Tabung Pemadam Kebakaran',
  'Bahan-Isi Tabung Gas',
  'Bahan-Bahan/Bibit Ternak/Bibit Ikan',
  'Bahan-Bahan Lainnya',
  'Suku Cadang-Suku Cadang Alat Angkutan',
  'Suku Cadang-Suku Cadang Alat Besar',
  'Suku Cadang-Suku Cadang Alat Kedokteran',
  'Suku Cadang-Suku Cadang Alat Laboratorium',
  'Suku Cadang-Suku Cadang Alat Pemancar',
  'Suku Cadang-Suku Cadang Alat Studio dan Komunikasi',
  'Suku Cadang-Suku Cadang Alat Pertanian',
  'Suku Cadang-Suku Cadang Alat Bengkel',
  'Suku Cadang-Persediaan dari Belanja Bantuan Sosial',
  'Suku Cadang-Suku Cadang Lainnya',
  'Alat/Bahan untuk Kegiatan Kantor- Alat Tulis Kantor',
  'Alat/Bahan untuk Kegiatan Kantor- Kertas dan Cover',
  'Alat/Bahan untuk Kegiatan Kantor- Bahan Cetak',
  'Alat/Bahan untuk Kegiatan Kantor- Benda Pos',
  'Alat/Bahan untuk Kegiatan Kantor-Persediaan Dokumen/Administrasi Tender',
  'Alat/Bahan untuk Kegiatan Kantor- Bahan Komputer',
  'Alat/Bahan untuk Kegiatan Kantor- Perabot Kantor',
  'Alat/Bahan untuk Kegiatan Kantor- Alat Listrik',
  'Alat/Bahan untuk Kegiatan Kantor- Perlengkapan Dinas',
  'Alat/Bahan untuk Kegiatan Kantor- Kaporlap dan Perlengkapan Satwa',
  'Alat/Bahan untuk Kegiatan Kantor- Perlengkapan Pendukung Olahraga',
  'Alat/Bahan untuk Kegiatan Kantor- Suvenir/Cendera Mata',
  'Alat/Bahan untuk Kegiatan Kantor- Alat/Bahan untuk Kegiatan Kantor Lainnya',
  'Obat-Obatan-Obat',
  'Obat-Obatan-Obat-Obatan Lainnya',
  'Barang untuk Dijual/Diserahkan kepada Masyarakat',
  'Barang untuk Dijual/Diserahkan kepada Pihak Ketiga/Pihak Lain',
  'Persediaan untuk Tujuan Strategis/Berjaga-jaga-Persediaan untuk Tujuan Strategis/Berjaga-jaga',
  'Persediaan untuk Tujuan Strategis/Berjaga-jaga-Persediaan untuk Tujuan Strategis/Berjaga-jaga Lainnya',
  'Natura dan Pakan-Natura',
  'Natura dan Pakan-Pakan',
  'Natura dan Pakan-Natura dan Pakan Lainnya',
  'Persediaan Penelitian-Persediaan Penelitian Biologi',
  'Persediaan Penelitian-Persediaan Penelitian Biologi Lainnya',
  'Persediaan Penelitian-Persediaan Penelitian Teknologi',
  'Persediaan Penelitian-Persediaan Penelitian Lainnya',
  'Persediaan Dalam Proses-Persediaan Dalam Proses',
  'Persediaan Dalam Proses-Persediaan Dalam Proses Lainnya',
  'Makanan dan Minuman Rapat',
  'Makanan dan Minuman Jamuan Tamu',
  'Penambah Daya Tahan Tubuh',
  'Makanan dan Minuman pada Fasilitas Pelayanan Urusan Pendidikan',
  'Makanan dan Minuman pada Fasilitas Pelayanan Urusan Kesehatan',
  'Makanan dan Minuman pada Fasilitas Pelayanan Urusan Sosial',
  'Makanan dan Minuman Aktivitas Lapangan',
  'Pakaian Dinas KDH dan WKDH',
  'Pakaian Dinas dan Atribut Pimpinan dan Anggota DPRD',
  'Pakaian Sipil Harian (PSH)',
  'Pakaian Sipil Lengkap (PSL)',
  'Pakaian Dinas Harian (PDH)',
  'Pakaian Dinas Lapangan (PDL)',
  'Pakaian Sipil Resmi (PSR)',
  'Pakaian Dinas Upacara (PDU)',
  'Pakaian Penyelamatan',
  'Pakaian Siaga',
  'Pakaian Teknik',
  'Pakaian Pelatihan Kerja',
  'Pakaian Kerja Laboratorium',
  'Pakaian Kerja Bengkel',
  'Pakaian KORPRI',
  'Pakaian Adat Daerah',
  'Pakaian Batik Tradisional',
  'Pakaian Olahraga',
  'Pakaian Paskibraka',
  'Pakaian Jas/Safari',
  'Komponen-Komponen Jembatan Baja',
  'Komponen-Komponen Jembatan Pratekan',
  'Komponen-Komponen Peralatan',
  'Komponen-Komponen Rambu-Rambu',
  'Komponen-Attachment',
  'Komponen-Komponen Lainnya',
  'Pipa-Pipa Air Besi Tuang (DCI)',
  'Pipa-Pipa Asbes Semen (ACP)',
  'Pipa-Pipa Baja',
  'Pipa-Pipa Beton Pratekan',
  'Pipa-Pipa Fiber Glass',
  'Pipa-Pipa Plastik PVC (UPVC)',
  'Pipa-Pipa Lainnya',
  'Komponen Bekas dan Pipa Bekas-Komponen Bekas',
  'Komponen Bekas dan Pipa Bekas-Pipa Bekas',
  'Komponen Bekas dan Pipa Bekas-Komponen Bekas dan Pipa Bekas Lainnya',
];

export const LEGACY_REKENING_PERSEDIAAN_MAP: Record<string, string> = {
  'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (ALAT LISTRIK)': 'Alat/Bahan untuk Kegiatan Kantor- Alat Listrik',
  'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (ATK)': 'Alat/Bahan untuk Kegiatan Kantor- Alat Tulis Kantor',
  'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (BAHAN CETAK)': 'Alat/Bahan untuk Kegiatan Kantor- Bahan Cetak',
  'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (BAHAN KOMPUTER)': 'Alat/Bahan untuk Kegiatan Kantor- Bahan Komputer',
  'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (KAPORLAP & PERLENGKAPAN SATWA)': 'Alat/Bahan untuk Kegiatan Kantor- Kaporlap dan Perlengkapan Satwa',
  'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (KERTAS & COVER)': 'Alat/Bahan untuk Kegiatan Kantor- Kertas dan Cover',
  'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (PERABOT KANTOR)': 'Alat/Bahan untuk Kegiatan Kantor- Perabot Kantor',
  'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (PERANGKO, MATERAI & BENDA POS LAINNYA)': 'Alat/Bahan untuk Kegiatan Kantor- Benda Pos',
  'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (PERLENGKAPAN DINAS)': 'Alat/Bahan untuk Kegiatan Kantor- Perlengkapan Dinas',
  'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (PERLENGKAPAN PENDUKUNG OLAH RAGA)': 'Alat/Bahan untuk Kegiatan Kantor- Perlengkapan Pendukung Olahraga',
  'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (PERSEDIAAN DOKUMEN/ ADMISTRASI TENDER)': 'Alat/Bahan untuk Kegiatan Kantor-Persediaan Dokumen/Administrasi Tender',
  'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (SUVENIR/ CENDERA MATA)': 'Alat/Bahan untuk Kegiatan Kantor- Suvenir/Cendera Mata',
  'ALAT/ BAHAN UNTUK KEGIATAN KANTOR LAINNYA': 'Alat/Bahan untuk Kegiatan Kantor- Alat/Bahan untuk Kegiatan Kantor Lainnya',
  'ATACHMENT': 'Komponen-Attachment',
  'BAHAN BAKAR & PELUMAS': 'Bahan-Bahan Bakar dan Pelumas',
  'BAHAN BAKU': 'Bahan-Bahan Baku',
  'BAHAN BANGUNAN & KONSTRUKSI': 'Bahan-Bahan Bangunan dan Konstruksi',
  'BAHAN KIMIA': 'Bahan-Bahan Kimia',
  'BAHAN KIMIA NUKLIR': 'Bahan-Bahan Kimia Nuklir',
  'BAHAN LAINNYA': 'Bahan-Bahan Lainnya',
  'BAHAN PELEDAK': 'Bahan-Bahan Lainnya',
  'BAHAN/ BIBIT TANAMAN': 'Bahan-Bahan/Bibit Tanaman',
  'BAHAN/ BIBIT TERNAK/ BIBIT IKAN': 'Bahan-Bahan/Bibit Ternak/Bibit Ikan',
  'BARANG DALAM PROSES': 'Bahan-Barang dalam Proses',
  'BARANG UNTUK DIJUAL/ DISERAHKAN KEPADA MASYARAKAT': 'Barang untuk Dijual/Diserahkan kepada Masyarakat',
  'BARANG UNTUK DIJUAL/ DISERAHKAN LAINNYA': 'Barang untuk Dijual/Diserahkan kepada Pihak Ketiga/Pihak Lain',
  'BELANJA MAKANAN DAN MINUMAN JAMUAN TAMU': 'Makanan dan Minuman Jamuan Tamu',
  'BELANJA MAKANAN DAN MINUMAN RAPAT': 'Makanan dan Minuman Rapat',
  'ISI TABUNG GAS': 'Bahan-Isi Tabung Gas',
  'ISI TABUNG PEMADAM KEBAKARAN': 'Bahan-Isi Tabung Pemadam Kebakaran',
  'KOMPONEN BEKAS': 'Komponen Bekas dan Pipa Bekas-Komponen Bekas',
  'KOMPONEN BEKAS DAN PIPA BEKAS LAINNYA': 'Komponen Bekas dan Pipa Bekas-Komponen Bekas dan Pipa Bekas Lainnya',
  'KOMPONEN JEMBATAN BAJA': 'Komponen-Komponen Jembatan Baja',
  'KOMPONEN JEMBATAN PRAKTEKAN': 'Komponen-Komponen Jembatan Pratekan',
  'KOMPONEN LAINNYA': 'Komponen-Komponen Lainnya',
  'KOMPONEN PERALATAN': 'Komponen-Komponen Peralatan',
  'KOMPONEN RAMBU-RAMBU': 'Komponen-Komponen Rambu-Rambu',
  'NATURA': 'Natura dan Pakan-Natura',
  'OBAT': 'Obat-Obatan-Obat',
  'OBAT-OBATAN LAINNYA': 'Obat-Obatan-Obat-Obatan Lainnya',
  'PAKAN': 'Natura dan Pakan-Pakan',
  'PAKAN LAINNYA': 'Natura dan Pakan-Natura dan Pakan Lainnya',
  'PERSEDIAAN DALAM PROSES': 'Persediaan Dalam Proses-Persediaan Dalam Proses',
  'PERSEDIAAN DALAM PROSES LAINNYA': 'Persediaan Dalam Proses-Persediaan Dalam Proses Lainnya',
  'PERSEDIAAN DARI BELANJA BANTUAN SOSIAL': 'Suku Cadang-Persediaan dari Belanja Bantuan Sosial',
  'PERSEDIAAN PENELITIAN BIOLOGI': 'Persediaan Penelitian-Persediaan Penelitian Biologi',
  'PERSEDIAAN PENELITIAN BIOLOGI LAINNYA': 'Persediaan Penelitian-Persediaan Penelitian Biologi Lainnya',
  'PERSEDIAAN PENELITIAN LAINNYA': 'Persediaan Penelitian-Persediaan Penelitian Lainnya',
  'PERSEDIAAN PENELITIAN TEKNOLOGI': 'Persediaan Penelitian-Persediaan Penelitian Teknologi',
  'PERSEDIAAN UNTUK TUJUAN STRATEGIS/ BERJAGA-JAGA': 'Persediaan untuk Tujuan Strategis/Berjaga-jaga-Persediaan untuk Tujuan Strategis/Berjaga-jaga',
  'PERSEDIAAN UNTUK TUJUAN STRATEGIS/ BERJAGA-JAGA LAINNYA': 'Persediaan untuk Tujuan Strategis/Berjaga-jaga-Persediaan untuk Tujuan Strategis/Berjaga-jaga Lainnya',
  'PIPA AIR BESI TUANG (DCI)': 'Pipa-Pipa Air Besi Tuang (DCI)',
  'PIPA ASBES SEMEN (APC)': 'Pipa-Pipa Asbes Semen (ACP)',
  'PIPA BAJA': 'Pipa-Pipa Baja',
  'PIPA BEKAS': 'Komponen Bekas dan Pipa Bekas-Pipa Bekas',
  'PIPA BETON PRAKTEKAN': 'Pipa-Pipa Beton Pratekan',
  'PIPA FIBER GLASS': 'Pipa-Pipa Fiber Glass',
  'PIPA LAINNYA': 'Pipa-Pipa Lainnya',
  'PIPA PLASTIK PVC (UPVC)': 'Pipa-Pipa Plastik PVC (UPVC)',
  'SUKU CADANG ALAT ANGKUTAN': 'Suku Cadang-Suku Cadang Alat Angkutan',
  'SUKU CADANG ALAT BENGKEL': 'Suku Cadang-Suku Cadang Alat Bengkel',
  'SUKU CADANG ALAT BESAR': 'Suku Cadang-Suku Cadang Alat Besar',
  'SUKU CADANG ALAT KEDOKTERAN': 'Suku Cadang-Suku Cadang Alat Kedokteran',
  'SUKU CADANG ALAT LABORATORIUM': 'Suku Cadang-Suku Cadang Alat Laboratorium',
  'SUKU CADANG ALAT PEMANCAR': 'Suku Cadang-Suku Cadang Alat Pemancar',
  'SUKU CADANG ALAT PERSENJATAAN': 'Suku Cadang-Suku Cadang Lainnya',
  'SUKU CADANG ALAT PERTANIAN': 'Suku Cadang-Suku Cadang Alat Pertanian',
  'SUKU CADANG ALAT STUDIO & KOMUNIKASI': 'Suku Cadang-Suku Cadang Alat Studio dan Komunikasi',
};

const CANONICAL_REKENING_BY_UPPER = new Map<string, string>(
  REKENING_PERSEDIAAN_OPTIONS.map((r) => [r.toUpperCase(), r])
);

const CANONICAL_REKENING_BY_COMPACT = new Map<string, string>(
  REKENING_PERSEDIAAN_OPTIONS.map((r) => [r.replace(/\s+/g, ' ').replace(/\s*-\s*/g, '-').toUpperCase(), r])
);

export const REKENING_PEMELIHARAAN_OPTIONS = [
  'Belanja Bahan-Bahan Bakar dan Pelumas',
  'Belanja Pemeliharaan Alat Angkutan-Alat Angkutan Darat Bermotor-Kendaraan Dinas Bermotor Perorangan',
  'Belanja Pemeliharaan Komputer-Komputer Unit-Personal Computer',
  'Belanja Pemeliharaan Alat Kantor dan Rumah Tangga-Alat Rumah Tangga-Alat Pendingin',
  'Belanja Pemeliharaan Bangunan Gedung-Bangunan Gedung Tempat Kerja-Bangunan Gedung Kantor',
  'Belanja Pemeliharaan Bangunan Gedung-Bangunan Gedung Tempat Kerja-Bangunan Gedung Tempat Pendidikan',
  'Belanja Pemeliharaan Alat Kantor dan Rumah Tangga-Alat Kantor-Alat Kantor Lainnya',
  'Belanja Pemeliharaan Alat Kantor dan Rumah Tangga-Alat Rumah Tangga-Meubelair',
  'Belanja Pemeliharaan Peralatan dan Mesin Lainnya',
  'Belanja Pemeliharaan Suku Cadang Lainya',
] as const;

/**
 * Menormalisasi nama Rekening Persediaan (baik format lama maupun huruf besar/kecil)
 * agar selalu sesuai 100% dengan daftar standar REKENING_PERSEDIAAN_OPTIONS pada Menu Input & Menu Rekapan Se-Dinas.
 */
export function normalizeRekeningPersediaan(raw: string | undefined | null): string {
  if (!raw) return 'Alat/Bahan untuk Kegiatan Kantor- Alat Tulis Kantor';
  const trimmed = String(raw).trim();
  if (!trimmed) return 'Alat/Bahan untuk Kegiatan Kantor- Alat Tulis Kantor';

  // Jika rekening pemeliharaan, biarkan apa adanya
  if ((REKENING_PEMELIHARAAN_OPTIONS as readonly string[]).includes(trimmed)) {
    return trimmed;
  }

  const upper = trimmed.toUpperCase().replace(/\s+/g, ' ');
  if (CANONICAL_REKENING_BY_UPPER.has(upper)) {
    return CANONICAL_REKENING_BY_UPPER.get(upper)!;
  }

  if (LEGACY_REKENING_PERSEDIAAN_MAP[upper]) {
    return LEGACY_REKENING_PERSEDIAAN_MAP[upper];
  }

  const compactUpper = upper.replace(/\s*-\s*/g, '-');
  if (CANONICAL_REKENING_BY_COMPACT.has(compactUpper)) {
    return CANONICAL_REKENING_BY_COMPACT.get(compactUpper)!;
  }

  return trimmed;
}

export type KodeRekening = string;

export type JenisSaldoAwal = 'Saldo Awal' | 'Bukan Saldo Awal';

export type TaxType = 
  | 'Tanpa Pajak' 
  | 'PPN 11%' 
  | 'PPh 21 (Honor 5%)' 
  | 'PPh 22 (Barang 1.5%)' 
  | 'PPh 23 (Jasa 2%)';

export type PaymentMethod = 
  | 'Transfer Bank BPD/BRI' 
  | 'Kas Tunai Bendahara' 
  | 'SIPLah (Marketplace Kemdikbud)' 
  | 'CMS (Corporate Banking)';

export type ExpenseStatus = 
  | 'Draf' 
  | 'Menunggu Verifikasi' 
  | 'Diverifikasi Bendahara' 
  | 'Disetujui Kepala Sekolah';

export type JenisMasukPemeliharaan = 'Belanja LRA' | 'Pengakuan BAST' | 'Saldo Awal';
export type JenisKeluarPemeliharaan = 'Pengeluaran Belanja' | 'BAST Diluar Belanja' | 'Saldo Awal';

export interface RincianRekeningItem {
  id: string;
  kodeRekening: KodeRekening;
  jenisPemeliharaan?: string;
  tanggalPemeliharaan?: string;
  nilaiJasa?: number;
  nilaiBarang?: number;
  saldoAwal: JenisSaldoAwal;
  saldoAwalMasuk?: JenisSaldoAwal;
  saldoAwalKeluar?: JenisSaldoAwal;
  isHibah?: boolean;
  nilaiSaldoAwal?: number;
  nilaiBelanjaLra?: number;
  nilaiPengakuanBast?: number;
  pengeluaranSaldoAwal?: number;
  pengeluaranBelanja?: number;
  pengeluaranBast?: number;
  hibahMasuk?: number;
  hibahKeluar?: number;
  nilaiMasuk: number;
  nilaiKeluar: number;
  sisaNilai: number;
  keteranganPemeliharaan?: string;
}

export interface SchoolExpense {
  id: string;
  tahunAnggaran?: number;
  schoolName?: string;
  npsn?: string;
  noBukti: string;
  tanggal: string; // YYYY-MM-DD
  triwulan: Triwulan;
  sumberDana: BOSSource;
  komponen: KomponenBOS;
  kodeRekening: KodeRekening;
  kategoriBelanja?: 'persediaan' | 'pemeliharaan';
  saldoAwal?: JenisSaldoAwal;
  saldoAwalMasuk?: JenisSaldoAwal;
  saldoAwalKeluar?: JenisSaldoAwal;
  isHibah?: boolean;
  uraian: string;
  penerimaToko: string;
  npwpPenerima?: string;
  metodePembayaran: PaymentMethod;
  volume: number;
  satuan: string;
  hargaSatuan: number;
  subtotal: number;
  nilaiSaldoAwal?: number;
  nilaiBelanjaLra?: number;
  pengeluaranSaldoAwal?: number;
  pengeluaranBelanja?: number;
  hibahMasuk?: number;
  hibahKeluar?: number;
  nilaiMasuk?: number;
  nilaiKeluar?: number;
  sisaNilai?: number;
  rincianItems?: RincianRekeningItem[];
  tipePajak: TaxType;
  nilaiPajak: number;
  totalBersih: number;
  status: ExpenseStatus;
  buktiFotoUrl?: string;
  catatan?: string;
  createdAt: string;
  mergedQuarters?: Triwulan[];
  combinedQuarterLabel?: string;
  sourceExpenseIds?: string[];
  mergedCount?: number;
}

export interface SchoolInfo {
  namaSekolah: string;
  npsn: string;
  alamat: string;
  kecamatan: string;
  kabupaten: string;
  provinsi: string;
  kepalaSekolah: string;
  nipKepalaSekolah: string;
  bendahara: string;
  nipBendahara: string;
  bendaharaBarang?: string;
  nipBendaharaBarang?: string;
  tahunAnggaran: number;
  totalPaguTahunan: number;
  paguPerTriwulan: Record<Triwulan, number>;
}

export interface QuarterStats {
  pagu: number;
  realisasi: number;
  sisaPagu: number;
  persentaseSerapan: number;
  jumlahTransaksi: number;
  pajakTerpotong: number;
}

export interface BarangEkstraItem {
  id: string;
  tahunAnggaran: number;
  schoolName: string;
  npsn: string;
  namaBarang: string;
  spesifikasi?: string;
  volume: number;
  satuan: string;
  hargaSatuan: number;
  totalHarga: number;
  kondisi: 'Baik' | 'Kurang Baik' | 'Rusak Berat';
  sumberPerolehan: string;
  tanggalPerolehan: string;
  keterangan?: string;
  status: ExpenseStatus;
  createdAt: string;
}
