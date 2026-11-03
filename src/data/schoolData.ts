import { UserRole } from '../types/auth';

export const LOGIN_YEARS = ['2025', '2026', '2027'] as const;

export interface UptSchoolAccount {
  id: string;
  upt: string; // Nama UPT / Satuan Pendidikan
  npsn: string;
  kecamatan: string;
  username: string;
  password: string;
  role: UserRole;
  kepalaSekolah?: string;
  nipKepalaSekolah?: string;
  pengurusBarang?: string;
  nipPengurusBarang?: string;
  bendahara?: string;
  nipBendahara?: string;
}

export const DEFAULT_UPT_SCHOOLS: UptSchoolAccount[] = [
  {
    id: 'upt-1',
    upt: 'SMP NEGERI 1 RATAHAN',
    npsn: '40101977',
    kecamatan: 'Ratahan',
    username: 'smpn1ratahan',
    password: '40101977',
    role: 'Operator BOSP',
    kepalaSekolah: 'VENTJE R. TULANDI, S.Pd',
    nipKepalaSekolah: '196804121994121004',
    pengurusBarang: 'DEISY M. KOMALING, S.Pd',
    nipPengurusBarang: '198206152009022003',
    bendahara: 'MARIA S. KAWULUR, S.Pd',
    nipBendahara: '198001102008012015',
  },
  {
    id: 'upt-2',
    upt: 'SMP NEGERI 2 RATAHAN',
    npsn: '40102065',
    kecamatan: 'Pasan',
    username: 'smpn2ratahan',
    password: '40102065',
    role: 'Operator BOSP',
    kepalaSekolah: 'JERRY K. MOKODOMPIT, S.Pd',
    nipKepalaSekolah: '197008211997021002',
    pengurusBarang: 'RINI A. GOSAL, S.Pd',
    nipPengurusBarang: '198503122010012008',
    bendahara: 'STELLA R. KINDANGEN, S.Pd',
    nipBendahara: '198111042009022001',
  },
  {
    id: 'upt-3',
    upt: 'SMP NEGERI 3 RATAHAN',
    npsn: '40102059',
    kecamatan: 'Ratahan',
    username: 'smpn3ratahan',
    password: '40102059',
    role: 'Operator BOSP',
    kepalaSekolah: 'SONNY H. TOMBENG, S.Pd',
    nipKepalaSekolah: '196905141995121003',
    pengurusBarang: 'NOVA L. WULUR, S.Pd',
    nipPengurusBarang: '198611202011012005',
    bendahara: 'CHRISTIANI T. RUNTU, S.Pd',
    nipBendahara: '198304182009022004',
  },
  {
    id: 'upt-4',
    upt: 'SMP NEGERI 4 RATAHAN',
    npsn: '40103491',
    kecamatan: 'Ratahan Timur',
    username: 'smpn4ratahan',
    password: '40103491',
    role: 'Operator BOSP',
    kepalaSekolah: 'MAXI E. KANDOU, S.Pd',
    nipKepalaSekolah: '197102091998021001',
    pengurusBarang: 'ESTER M. LUMENTA, S.Pd',
    nipPengurusBarang: '198707072014022002',
    bendahara: 'DIANA P. POLII, S.Pd',
    nipBendahara: '198409222010012006',
  },
  {
    id: 'upt-5',
    upt: 'SMP NEGERI 6 RATAHAN',
    npsn: '40103657',
    kecamatan: 'Ratahan',
    username: 'smpn6ratahan',
    password: '40103657',
    role: 'Operator BOSP',
    kepalaSekolah: 'HERRY J. MANOPPO, S.Pd',
    nipKepalaSekolah: '197210151999031005',
    pengurusBarang: 'YULIANA S. TAROREH, S.Pd',
    nipPengurusBarang: '198805192015032001',
    bendahara: 'GRACE N. SUMUAL, S.Pd',
    nipBendahara: '198512012011012003',
  },
  {
    id: 'upt-6',
    upt: 'SMP NEGERI 1 TOULUAAN',
    npsn: '40102058',
    kecamatan: 'Touluaan',
    username: 'smpn1touluaan',
    password: '40102058',
    role: 'Operator BOSP',
    kepalaSekolah: 'JEFFRY A. TANOD, S.Pd',
    nipKepalaSekolah: '196709181993031006',
    pengurusBarang: 'MELISA R. PANGEMANAN, S.Pd',
    nipPengurusBarang: '198902142015032004',
    bendahara: 'FENNY L. MONIAGA, S.Pd',
    nipBendahara: '198208092009022002',
  },
  {
    id: 'upt-7',
    upt: 'SMP NEGERI 2 TOULUAAN',
    npsn: '40101972',
    kecamatan: 'Touluaan',
    username: 'smpn2touluaan',
    password: '40101972',
    role: 'Operator BOSP',
    kepalaSekolah: 'MEYGEVER ONSU,S.Pd.,M.Pd',
    nipKepalaSekolah: '196605051991032013',
    pengurusBarang: 'PRISILIA DEBORA MANGKANG, S.Pd',
    nipPengurusBarang: '199304302020122013',
    bendahara: 'YOSEP TOMPUNU, A.Ma.TE',
    nipBendahara: '198005122014111002',
  },
  {
    id: 'upt-8',
    upt: 'SMP NEGERI 3 TOULUAAN',
    npsn: '40101973',
    kecamatan: 'Touluaan Selatan',
    username: 'smpn3touluaan',
    password: '40101973',
    role: 'Operator BOSP',
    kepalaSekolah: 'RONNY B. RORONG, S.Pd',
    nipKepalaSekolah: '196911251996011002',
    pengurusBarang: 'LIDYA K. TAMPI, S.Pd',
    nipPengurusBarang: '199006112019032005',
    bendahara: 'HELENA D. KAWENGIAN, S.Pd',
    nipBendahara: '198307152010012007',
  },
  {
    id: 'upt-9',
    upt: 'SMP NEGERI 4 TOULUAAN',
    npsn: '40101974',
    kecamatan: 'Silian Raya',
    username: 'smpn4touluaan',
    password: '40101974',
    role: 'Operator BOSP',
    kepalaSekolah: 'ALEXANDER W. TULUNG, S.Pd',
    nipKepalaSekolah: '197003301997021003',
    pengurusBarang: 'NATALIA S. KOROMPIS, S.Pd',
    nipPengurusBarang: '199112242019032008',
    bendahara: 'VERONIKA M. PONTOH, S.Pd',
    nipBendahara: '198405022010012004',
  },
  {
    id: 'upt-10',
    upt: 'SMP NEGERI 5 TOULUAAN',
    npsn: '40103660',
    kecamatan: 'Touluaan',
    username: 'smpn5touluaan',
    password: '40103660',
    role: 'Operator BOSP',
    kepalaSekolah: 'DANIEL P. LUMOPA, S.Pd',
    nipKepalaSekolah: '197306122000031004',
    pengurusBarang: 'FRISKA E. SUPIT, S.Pd',
    nipPengurusBarang: '199208172020122009',
    bendahara: 'MEITY R. KALANGI, S.Pd',
    nipBendahara: '198601282011012005',
  },
  {
    id: 'upt-11',
    upt: 'SMP NEGERI 1 TOMBATU',
    npsn: '40101979',
    kecamatan: 'Tombatu',
    username: 'smpn1tombatu',
    password: '40101979',
    role: 'Operator BOSP',
    kepalaSekolah: 'ROBERT M. KOUNTUL, S.Pd',
    nipKepalaSekolah: '196807041994121002',
    pengurusBarang: 'SINTIA V. MOKOGINTA, S.Pd',
    nipPengurusBarang: '198810102014022003',
    bendahara: 'ANITA C. RUNTUWENE, S.Pd',
    nipBendahara: '198103192008012011',
  },
  {
    id: 'upt-12',
    upt: 'SMP NEGERI 2 TOMBATU',
    npsn: '40101976',
    kecamatan: 'Tombatu Timur',
    username: 'smpn2tombatu',
    password: '40101976',
    role: 'Operator BOSP',
    kepalaSekolah: 'EDWIN L. MANDAGI, S.Pd',
    nipKepalaSekolah: '197109191998021004',
    pengurusBarang: 'CHRISTY N. WOWOR, S.Pd',
    nipPengurusBarang: '199004052015032006',
    bendahara: 'JULIANA B. TUMBELAKA, S.Pd',
    nipBendahara: '198311122009022005',
  },
  {
    id: 'upt-13',
    upt: 'SMP NEGERI 5 TOMBATU',
    npsn: '40103651',
    kecamatan: 'Tombatu',
    username: 'smpn5tombatu',
    password: '40103651',
    role: 'Operator BOSP',
    kepalaSekolah: 'FREDDY S. DOTULONG, S.Pd',
    nipKepalaSekolah: '197204221999031002',
    pengurusBarang: 'STEPHANIE R. LASUT, S.Pd',
    nipPengurusBarang: '199107192019032004',
    bendahara: 'OLIVIA K. MANGINDAAN, S.Pd',
    nipBendahara: '198506302010012009',
  },
  {
    id: 'upt-14',
    upt: 'SMP NEGERI 6 TOMBATU',
    npsn: '40103653',
    kecamatan: 'Tombatu Utara',
    username: 'smpn6tombatu',
    password: '40103653',
    role: 'Operator BOSP',
    kepalaSekolah: 'HENNY M. RUNTUNUWU, S.Pd',
    nipKepalaSekolah: '197012081997022001',
    pengurusBarang: 'GABRIELA P. SONDAKH, S.Pd',
    nipPengurusBarang: '199301152020122011',
    bendahara: 'MARGARETHA T. PAAT, S.Pd',
    nipBendahara: '198609142011012007',
  },
  {
    id: 'upt-15',
    upt: 'SMP NEGERI 1 BELANG',
    npsn: '40101975',
    kecamatan: 'Belang',
    username: 'smpn1belang',
    password: '40101975',
    role: 'Operator BOSP',
    kepalaSekolah: 'ABDUL R. MODEONG, S.Pd',
    nipKepalaSekolah: '196908171995121001',
    pengurusBarang: 'NURHAYATI S. GOBEL, S.Pd',
    nipPengurusBarang: '198703252011012004',
    bendahara: 'SITI F. MAMONTO, S.Pd',
    nipBendahara: '198205202009022003',
  },
  {
    id: 'upt-16',
    upt: 'SMP NEGERI 1 RATATOTOK',
    npsn: '40102071',
    kecamatan: 'Ratatotok',
    username: 'smpn1ratatotok',
    password: '40102071',
    role: 'Operator BOSP',
    kepalaSekolah: 'HENDRA K. SUMENDAP, S.Pd',
    nipKepalaSekolah: '197105111998021003',
    pengurusBarang: 'DEWI A. PAPUTUNGAN, S.Pd',
    nipPengurusBarang: '198911032015032002',
    bendahara: 'RATNA M. KOROMPOT, S.Pd',
    nipBendahara: '198402162010012005',
  },
  {
    id: 'upt-17',
    upt: 'SMP NEGERI 1 PUSOMAEN',
    npsn: '40103493',
    kecamatan: 'Pusomaen',
    username: 'smpn1pusomaen',
    password: '40103493',
    role: 'Operator BOSP',
    kepalaSekolah: 'JOHANIS T. SALINDEHO, S.Pd',
    nipKepalaSekolah: '197001291996011003',
    pengurusBarang: 'MERCY L. TAMPONGANGOY, S.Pd',
    nipPengurusBarang: '199009212019032007',
    bendahara: 'ELIZABETH R. SANGIAN, S.Pd',
    nipBendahara: '198508112011012002',
  },
  {
    id: 'upt-18',
    upt: 'SD NEGERI 1 RATAHAN',
    npsn: '40102246',
    kecamatan: 'Ratahan',
    username: 'sdn1ratahan',
    password: '40102246',
    role: 'Operator BOSP',
    kepalaSekolah: 'SELFIE M. TOMBOKAN, S.Pd',
    nipKepalaSekolah: '196810121991032008',
    pengurusBarang: 'ANGELINA R. WENAS, S.Pd',
    nipPengurusBarang: '199103082019032006',
    bendahara: 'JENNY S. KAUNANG, S.Pd',
    nipBendahara: '198204142008012012',
  },
  {
    id: 'upt-19',
    upt: 'SD NEGERI 2 RATAHAN',
    npsn: '40102249',
    kecamatan: 'Ratahan',
    username: 'sdn2ratahan',
    password: '40102249',
    role: 'Operator BOSP',
    kepalaSekolah: 'MARTJE L. RUNTUWAROUW, S.Pd',
    nipKepalaSekolah: '196902281992032005',
    pengurusBarang: 'PRISKA D. MANOPO, S.Pd',
    nipPengurusBarang: '199205192020122007',
    bendahara: 'YANTI M. LUMINTANG, S.Pd',
    nipBendahara: '198309252009022006',
  },
  {
    id: 'upt-20',
    upt: 'SD INPRES TOSURAYA',
    npsn: '40101875',
    kecamatan: 'Ratahan',
    username: 'sditosuraya',
    password: '40101875',
    role: 'Operator BOSP',
    kepalaSekolah: 'RITA C. MOKODASER, S.Pd',
    nipKepalaSekolah: '197007151993032004',
    pengurusBarang: 'GLORIA V. KAWENGIAN, S.Pd',
    nipPengurusBarang: '199308222020122014',
    bendahara: 'SILVIA N. TULANDI, S.Pd',
    nipBendahara: '198412102010012008',
  },
  {
    id: 'upt-21',
    upt: 'SD INPRES LOWU',
    npsn: '40101922',
    kecamatan: 'Ratahan',
    username: 'sdilowu',
    password: '40101922',
    role: 'Operator BOSP',
    kepalaSekolah: 'FEMMY A. KINDANGEN, S.Pd',
    nipKepalaSekolah: '197111041994032003',
    pengurusBarang: 'CHINTYA M. RORONG, S.Pd',
    nipPengurusBarang: '199210112020122010',
    bendahara: 'DEBBY L. GOSAL, S.Pd',
    nipBendahara: '198507072011012004',
  },
  {
    id: 'upt-22',
    upt: 'SD INPRES RASI',
    npsn: '40101953',
    kecamatan: 'Ratahan',
    username: 'sdirasi',
    password: '40101953',
    role: 'Operator BOSP',
    kepalaSekolah: 'YOULA E. WULUR, S.Pd',
    nipKepalaSekolah: '196806201991032009',
    pengurusBarang: 'MONICA S. LUMENTA, S.Pd',
    nipPengurusBarang: '199106182019032009',
    bendahara: 'KARLA P. POLII, S.Pd',
    nipBendahara: '198302192009022007',
  },
  {
    id: 'upt-23',
    upt: 'SD NEGERI INPRES RANOKETANG',
    npsn: '40101906',
    kecamatan: 'Touluaan',
    username: 'sdiranoketang',
    password: '40101906',
    role: 'Operator BOSP',
    kepalaSekolah: 'MEIKE S. TANOD, S.Pd',
    nipKepalaSekolah: '196904101992032006',
    pengurusBarang: 'NOVITA R. ONSU, S.Pd',
    nipPengurusBarang: '199311052020122015',
    bendahara: 'LINDA K. MANGKANG, S.Pd',
    nipBendahara: '198408232010012003',
  },
  {
    id: 'upt-24',
    upt: 'SD INPRES LOBU',
    npsn: '40101920',
    kecamatan: 'Touluaan',
    username: 'sdilobu',
    password: '40101920',
    role: 'Operator BOSP',
    kepalaSekolah: 'ALTJE M. PANGEMANAN, S.Pd',
    nipKepalaSekolah: '197009121993032007',
    pengurusBarang: 'TIRSA E. TOMPUNU, S.Pd',
    nipPengurusBarang: '199202272020122008',
    bendahara: 'ESTERLITA B. TAMPI, S.Pd',
    nipBendahara: '198510152011012006',
  },
  {
    id: 'upt-25',
    upt: 'SD NEGERI 1 TOMBATU',
    npsn: '40102247',
    kecamatan: 'Tombatu',
    username: 'sdn1tombatu',
    password: '40102247',
    role: 'Operator BOSP',
    kepalaSekolah: 'CORRY N. KOUNTUL, S.Pd',
    nipKepalaSekolah: '196812011991032004',
    pengurusBarang: 'MEGAWATI L. MANDAGI, S.Pd',
    nipPengurusBarang: '199108142019032003',
    bendahara: 'ROSALINA P. WOWOR, S.Pd',
    nipBendahara: '198207292008012014',
  },
  {
    id: 'upt-26',
    upt: 'SD NEGERI 2 TOMBATU',
    npsn: '40102194',
    kecamatan: 'Tombatu',
    username: 'sdn2tombatu',
    password: '40102194',
    role: 'Operator BOSP',
    kepalaSekolah: 'DORTJE S. DOTULONG, S.Pd',
    nipKepalaSekolah: '196907231992032008',
    pengurusBarang: 'STELLA M. LASUT, S.Pd',
    nipPengurusBarang: '199212092020122012',
    bendahara: 'MARIA V. SONDAKH, S.Pd',
    nipBendahara: '198403112010012009',
  },
  {
    id: 'upt-27',
    upt: 'SD NEGERI PISA',
    npsn: '40101858',
    kecamatan: 'Touluaan',
    username: 'sdnpisa',
    password: '40101858',
    role: 'Operator BOSP',
    kepalaSekolah: 'HELMI R. LUMOPA, S.Pd',
    nipKepalaSekolah: '197103161994032005',
    pengurusBarang: 'REGINA C. SUPIT, S.Pd',
    nipPengurusBarang: '199304122020122016',
    bendahara: 'THERESIA A. KALANGI, S.Pd',
    nipBendahara: '198605182011012008',
  },
  {
    id: 'upt-28',
    upt: 'SD NEGERI 1 BELANG',
    npsn: '40102202',
    kecamatan: 'Belang',
    username: 'sdn1belang',
    password: '40102202',
    role: 'Operator BOSP',
    kepalaSekolah: 'FARIDA S. MODEONG, S.Pd',
    nipKepalaSekolah: '196809051991032007',
    pengurusBarang: 'HASNA M. GOBEL, S.Pd',
    nipPengurusBarang: '199011282019032005',
    bendahara: 'RAHMAWATI D. MAMONTO, S.Pd',
    nipBendahara: '198306142009022008',
  },
  {
    id: 'upt-29',
    upt: 'SD NEGERI 2 BELANG',
    npsn: '40102218',
    kecamatan: 'Belang',
    username: 'sdn2belang',
    password: '40102218',
    role: 'Operator BOSP',
    kepalaSekolah: 'NURLAILA K. PAPUTUNGAN, S.Pd',
    nipKepalaSekolah: '197005191993032006',
    pengurusBarang: 'FITRIA R. KOROMPOT, S.Pd',
    nipPengurusBarang: '199207032020122009',
    bendahara: 'SURYANI L. MODEONG, S.Pd',
    nipBendahara: '198501222010012007',
  },
  {
    id: 'upt-30',
    upt: 'DINAS PENDIDIKAN',
    npsn: '40100001',
    kecamatan: 'Ratahan',
    username: 'admin_disdik',
    password: 'admin123',
    role: 'Admin',
    kepalaSekolah: 'SARAH I. KINDANGEN, S.Pd, M.Pd',
    nipKepalaSekolah: '19830923 200902 2 004',
    pengurusBarang: 'YOSEP TOMPUNU, A.Ma.TE',
    nipPengurusBarang: '19800512 201411 1 002',
    bendahara: 'MELANI N.E. ANGGORONGGANG, S.Th',
    nipBendahara: '19821104 200902 2 001',
  },
];

const STORAGE_KEY_UPT_SCHOOLS = 'bosp_upt_schools_spreadsheet_v1';

export function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function generateSlugUsername(uptName: string): string {
  return uptName
    .toLowerCase()
    .replace(/negeri/g, 'n')
    .replace(/inpres/g, 'i')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Pure parser for DATA_SEKOLAH CSV / Spreadsheet text
 */
export function parseSchoolSpreadsheetCsv(rawText: string): UptSchoolAccount[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  // Detect delimiter from first non-empty line
  const firstLine = lines[0];
  let delimiter = ',';
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  if (tabCount > commaCount && tabCount >= semiCount) {
    delimiter = '\t';
  } else if (semiCount > commaCount) {
    delimiter = ';';
  }

  // Locate header row
  let headerRowIdx = -1;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const cols = splitCsvLine(lines[i], delimiter).map((c) => c.toUpperCase().trim());
    const hasSchoolCol = cols.some(
      (c) =>
        c.includes('UPT') ||
        c.includes('SEKOLAH') ||
        c.includes('SATUAN PENDIDIKAN') ||
        c.includes('NAMA') ||
        c.includes('USERNAME')
    );
    if (hasSchoolCol) {
      headerRowIdx = i;
      headers = cols;
      break;
    }
  }

  const findCol = (keywords: string[]): number => {
    for (const kw of keywords) {
      const idx = headers.findIndex((h) => h === kw || h.includes(kw));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const uptIdx = headerRowIdx !== -1 ? findCol(['UPT', 'NAMA SEKOLAH', 'SATUAN PENDIDIKAN', 'SEKOLAH', 'NAMA']) : 1;
  const npsnIdx = headerRowIdx !== -1 ? findCol(['NPSN', 'KODE']) : 2;
  const kecIdx = headerRowIdx !== -1 ? findCol(['KECAMATAN', 'WILAYAH', 'ALAMAT']) : 3;
  const userIdx = headerRowIdx !== -1 ? findCol(['USERNAME', 'USER', 'ID PENGGUNA', 'LOGIN']) : 4;
  const passIdx = headerRowIdx !== -1 ? findCol(['PASSWORD', 'SANDI', 'KATA SANDI', 'PASS']) : 5;
  const roleIdx = headerRowIdx !== -1 ? findCol(['ROLE', 'PERAN', 'LEVEL', 'AKSES']) : 6;
  const kepsekIdx = headerRowIdx !== -1 ? findCol(['KEPALA_SEKOLAH', 'KEPALA SEKOLAH', 'KEPSEK']) : 7;
  const nipKepsekIdx = headerRowIdx !== -1 ? findCol(['NIP_KEPALA_SEKOLAH', 'NIP KEPALA', 'NIP KEPSEK']) : 8;
  const pengurusIdx = headerRowIdx !== -1 ? findCol(['PENGURUS_BARANG', 'PENGURUS BARANG', 'BENDAHARA BARANG']) : 9;
  const nipPengurusIdx = headerRowIdx !== -1 ? findCol(['NIP_PENGURUS_BARANG', 'NIP PENGURUS', 'NIP BARANG']) : 10;
  const bendaharaIdx = headerRowIdx !== -1 ? findCol(['BENDAHARA', 'BENDAHARA BOSP']) : 11;
  const nipBendaharaIdx = headerRowIdx !== -1 ? findCol(['NIP_BENDAHARA', 'NIP BENDAHARA']) : 12;

  const startRow = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;
  const parsed: UptSchoolAccount[] = [];

  for (let i = startRow; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], delimiter);
    if (cols.length < 2) continue;

    const uptName = (uptIdx !== -1 && cols[uptIdx] ? cols[uptIdx] : cols[1] || cols[0] || '').trim();
    if (!uptName || uptName.toUpperCase() === 'UPT' || uptName.toUpperCase() === 'NAMA SEKOLAH') continue;

    const npsn = (npsnIdx !== -1 && cols[npsnIdx] ? cols[npsnIdx] : '').trim();
    const kecamatan = (kecIdx !== -1 && cols[kecIdx] ? cols[kecIdx] : 'Minahasa Tenggara').trim();
    const username = (
      userIdx !== -1 && cols[userIdx]
        ? cols[userIdx]
        : npsn || generateSlugUsername(uptName)
    ).trim();
    const password = (
      passIdx !== -1 && cols[passIdx]
        ? cols[passIdx]
        : npsn || '123456'
    ).trim();

    const rawRole = (roleIdx !== -1 && cols[roleIdx] ? cols[roleIdx] : '').trim().toLowerCase();
    const role: UserRole =
      rawRole.includes('admin') || username.toLowerCase().includes('admin') || uptName.toUpperCase().includes('DINAS')
        ? 'Admin'
        : 'Operator BOSP';

    parsed.push({
      id: `upt-${parsed.length + 1}`,
      upt: uptName,
      npsn: npsn || '-',
      kecamatan: kecamatan || 'Minahasa Tenggara',
      username,
      password,
      role,
      kepalaSekolah: kepsekIdx !== -1 ? cols[kepsekIdx]?.trim() : undefined,
      nipKepalaSekolah: nipKepsekIdx !== -1 ? cols[nipKepsekIdx]?.trim() : undefined,
      pengurusBarang: pengurusIdx !== -1 ? cols[pengurusIdx]?.trim() : undefined,
      nipPengurusBarang: nipPengurusIdx !== -1 ? cols[nipPengurusIdx]?.trim() : undefined,
      bendahara: bendaharaIdx !== -1 ? cols[bendaharaIdx]?.trim() : undefined,
      nipBendahara: nipBendaharaIdx !== -1 ? cols[nipBendaharaIdx]?.trim() : undefined,
    });
  }

  return parsed;
}

export function normalizeUptKey(upt: string): string {
  const raw = String(upt || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/^UPT\s+/, '')
    .replace(/^SMP NEGERI\b/, 'SMPN')
    .replace(/^SD NEGERI INPRES\b/, 'SD INPRES')
    .replace(/^SDN INPRES\b/, 'SD INPRES')
    .replace(/^SD NEGERI\b/, 'SDN');
  if (raw.startsWith('DINAS PENDIDIKAN')) {
    return 'DINAS PENDIDIKAN';
  }
  return raw;
}

export function inferKecamatanFromUpt(uptName: string): string {
  const upper = uptName.toUpperCase();
  if (upper.includes('RATAHAN TIMUR') || upper.includes('WIOI')) return 'Ratahan Timur';
  if (upper.includes('RATAHAN') || upper.includes('TOSURAYA') || upper.includes('LOWU') || upper.includes('RASI')) return 'Ratahan';
  if (upper.includes('TOULUAAN SELATAN') || upper.includes('KALANGI') || upper.includes('SUHUYON')) return 'Touluaan Selatan';
  if (upper.includes('TOULUAAN') || upper.includes('RANOKETANG') || upper.includes('LOBU') || upper.includes('PISA') || upper.includes('KALAIT')) return 'Touluaan';
  if (upper.includes('TOMBATU UTARA') || upper.includes('KUYANGA') || upper.includes('WINORANGIAN')) return 'Tombatu Utara';
  if (upper.includes('TOMBATU TIMUR') || upper.includes('MOLOMPAR') || upper.includes('MUNDUNG')) return 'Tombatu Timur';
  if (upper.includes('TOMBATU') || upper.includes('KALI') || upper.includes('PANGU') || upper.includes('BENTENAN')) return 'Tombatu';
  if (upper.includes('BELANG') || upper.includes('BUKU') || upper.includes('WATULINEY') || upper.includes('BORGO') || upper.includes('TABABO') || upper.includes('PONIKI')) return 'Belang';
  if (upper.includes('RATATOTOK') || upper.includes('BASAAN') || upper.includes('SOYOWAN') || upper.includes('MOREAH')) return 'Ratatotok';
  if (upper.includes('PUSOMAEN') || upper.includes('MINANGA') || upper.includes('MANGKIT') || upper.includes('TUMBAK') || upper.includes('TATENGESAN')) return 'Pusomaen';
  if (upper.includes('SILIAN')) return 'Silian Raya';
  if (upper.includes('LIWUTUNG') || upper.includes('MAULIT') || upper.includes('PONIKI') || upper.includes('TOLOMBUKAN')) return 'Pasan';
  return 'Minahasa Tenggara';
}

export interface SheetUptRow {
  id: string;
  name: string;
  username: string;
  password?: string;
  role: string;
  namaUpt: string;
  npsn?: string;
  kecamatan?: string;
  kepalaSekolah?: string;
  nipKepalaSekolah?: string;
  bendahara?: string;
  nipBendahara?: string;
  pengurusBarang?: string;
  nipPengurusBarang?: string;
}

// In-memory runtime cache of accounts pulled from Google Spreadsheet (Sheet 6_AKUN_APLIKASI)
let runtimeSpreadsheetSchools: UptSchoolAccount[] = [...DEFAULT_UPT_SCHOOLS];

/**
 * Converts live UPT rows from Database Spreadsheet sheet 6_AKUN_APLIKASI (Kolom A-P) directly into UptSchoolAccount[]
 * Strictly uses only rows present in the Google Spreadsheet (no local database appending or overrides).
 */
export function mergeSheetSchoolsWithLocal(
  sheetRows: SheetUptRow[],
  _unusedLocalSchools?: UptSchoolAccount[]
): UptSchoolAccount[] {
  if (!Array.isArray(sheetRows) || sheetRows.length === 0) {
    return runtimeSpreadsheetSchools;
  }

  const converted: UptSchoolAccount[] = [];
  const seenNormKeys = new Set<string>();

  sheetRows.forEach((r, idx) => {
    const rawUpt = String(r.namaUpt || '').trim();
    if (!rawUpt) return;

    const normKey = normalizeUptKey(rawUpt);
    if (seenNormKeys.has(normKey)) return;
    seenNormKeys.add(normKey);

    const sheetUser = String(r.username || '').trim() || generateSlugUsername(rawUpt);
    const sheetPass =
      r.password !== undefined && String(r.password).trim() !== ''
        ? String(r.password).trim()
        : (r.npsn && String(r.npsn).trim()) || String(r.id || '123456').trim();
    const sheetName = String(r.name || '').trim();
    const rawRole = String(r.role || '').trim();
    const resolvedRole: UserRole =
      rawRole.toLowerCase().includes('admin') ||
      sheetUser.toLowerCase().includes('admin') ||
      normKey === 'DINAS PENDIDIKAN'
        ? 'Admin'
        : 'Operator BOSP';

    converted.push({
      id: String(r.id || `upt-${idx + 1}`).trim(),
      upt: normKey === 'DINAS PENDIDIKAN' ? 'DINAS PENDIDIKAN' : rawUpt,
      npsn: (r.npsn && String(r.npsn).trim()) || '-',
      kecamatan: (r.kecamatan && String(r.kecamatan).trim()) || inferKecamatanFromUpt(rawUpt),
      username: sheetUser,
      password: sheetPass,
      role: resolvedRole,
      kepalaSekolah: r.kepalaSekolah ? String(r.kepalaSekolah).trim() : undefined,
      nipKepalaSekolah: r.nipKepalaSekolah ? String(r.nipKepalaSekolah).trim() : undefined,
      bendahara: r.bendahara ? String(r.bendahara).trim() : undefined,
      nipBendahara: r.nipBendahara ? String(r.nipBendahara).trim() : undefined,
      pengurusBarang:
        (r.pengurusBarang && String(r.pengurusBarang).trim()) ||
        sheetName ||
        `Pengurus Barang ${rawUpt}`,
      nipPengurusBarang: r.nipPengurusBarang ? String(r.nipPengurusBarang).trim() : undefined,
    });
  });

  runtimeSpreadsheetSchools = converted;
  return converted;
}

export function filterUptSchools(
  schools: UptSchoolAccount[],
  searchQuery: string
): UptSchoolAccount[] {
  const q = String(searchQuery || '').trim().toLowerCase();
  if (!q) return schools;
  const normQ = normalizeUptKey(searchQuery).toLowerCase();

  return schools.filter((s) => {
    const uptLower = s.upt.toLowerCase();
    const normUptLower = normalizeUptKey(s.upt).toLowerCase();
    const kecLower = (s.kecamatan || '').toLowerCase();
    return (
      uptLower.includes(q) ||
      normUptLower.includes(q) ||
      (normQ && normUptLower.includes(normQ)) ||
      kecLower.includes(q)
    );
  });
}

export function loadUptSchools(): UptSchoolAccount[] {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_UPT_SCHOOLS);
    }
  } catch {
    // ignore
  }
  return runtimeSpreadsheetSchools;
}

export function saveUptSchools(schools: UptSchoolAccount[], _syncToServer: boolean = false): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_UPT_SCHOOLS);
    }
  } catch {
    // ignore
  }
  if (Array.isArray(schools)) {
    runtimeSpreadsheetSchools = schools.map((s) => {
      if (
        s.upt === 'DINAS PENDIDIKAN KAB. MINAHASA TENGGARA' ||
        s.upt === 'DINAS PENDIDIKAN KABUPATEN MINAHASA TENGGARA' ||
        (s.upt.toUpperCase().startsWith('DINAS PENDIDIKAN') && s.upt !== 'DINAS PENDIDIKAN')
      ) {
        return { ...s, upt: 'DINAS PENDIDIKAN' };
      }
      return s;
    });
  }
}

export function resetUptSchoolsToDefault(): UptSchoolAccount[] {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_UPT_SCHOOLS);
    }
  } catch {
    // ignore
  }
  return runtimeSpreadsheetSchools;
}



