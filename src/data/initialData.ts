import { SchoolInfo, SchoolExpense } from '../types';

export const INITIAL_SCHOOL_INFO: SchoolInfo = {
  namaSekolah: 'SMP NEGERI 2 TOULUAAN',
  npsn: '40103456',
  alamat: 'Kec. Touluaan',
  kecamatan: 'Touluaan',
  kabupaten: 'Kabupaten Minahasa Tenggara',
  provinsi: 'Sulawesi Utara',
  kepalaSekolah: 'MEYGEVER ONSU,S.Pd.,M.Pd',
  nipKepalaSekolah: '196605051991032013',
  bendahara: 'YOSEP TOMPUNU, A.Ma.TE',
  nipBendahara: '198005122014111002',
  bendaharaBarang: 'PRISILIA DEBORA MANGKANG, S.Pd',
  nipBendaharaBarang: '199304302020122013',
  tahunAnggaran: 2026,
  totalPaguTahunan: 0,
  paguPerTriwulan: {
    TW1: 0,
    TW2: 0,
    TW3: 0,
    TW4: 0,
  },
};

export const INITIAL_EXPENSES: SchoolExpense[] = [];

