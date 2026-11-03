import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  validateRegisterForm, 
  authenticateUser, 
  authenticateUptSchool,
  INITIAL_ACCOUNTS,
  normalizeUserRole,
  isAdminUser,
  canEditExpense,
  canApproveExpense
} from './auth';
import { 
  LOGIN_YEARS,
  DEFAULT_UPT_SCHOOLS, 
  parseSchoolSpreadsheetCsv, 
  normalizeUptKey, 
  mergeSheetSchoolsWithLocal,
  filterUptSchools
} from '../data/schoolData';
import { UserAccount, UserProfile } from '../types/auth';

const MOCK_OPERATOR_ACCOUNTS: UserAccount[] = [
  {
    id: 'usr-test-1',
    username: 'operator_bosp',
    name: 'Rian Kurniawan, S.Pd.',
    nip: '19901115 201801 1 002',
    role: 'Operator BOSP',
    schoolName: 'SD NEGERI 01 NUSANTARA',
    passwordHash: 'operator123',
    createdAt: '2026-01-01T08:00:00Z',
  },
];

test('INITIAL_ACCOUNTS is empty (local user accounts cleaned)', () => {
  assert.equal(INITIAL_ACCOUNTS.length, 0);
});

test('normalizeUserRole resolves Admin and Operator BOSP roles accurately', () => {
  assert.equal(normalizeUserRole('Admin', 'user1'), 'Admin');
  assert.equal(normalizeUserRole('Administrator BOSP', 'user2'), 'Admin');
  assert.equal(normalizeUserRole('Operator BOSP', 'admin'), 'Admin');
  assert.equal(normalizeUserRole('Operator BOSP', 'operator_1'), 'Operator BOSP');
  assert.equal(normalizeUserRole(undefined, 'operator_1'), 'Operator BOSP');
});

test('isAdminUser, canEditExpense, and canApproveExpense grant edit & approve rights strictly to Admin', () => {
  const adminProfile: UserProfile = {
    id: 'adm-1',
    username: 'admin_sekolah',
    name: 'Administrator BOSP',
    role: 'Admin',
    schoolName: 'SD NEGERI 01 NUSANTARA',
    createdAt: '2026-01-01T00:00:00Z',
  };

  const operatorProfile: UserProfile = {
    id: 'op-1',
    username: 'operator_sekolah',
    name: 'Operator BOSP',
    role: 'Operator BOSP',
    schoolName: 'SD NEGERI 01 NUSANTARA',
    createdAt: '2026-01-01T00:00:00Z',
  };

  assert.equal(isAdminUser(adminProfile), true);
  assert.equal(canEditExpense(adminProfile), true);
  assert.equal(canApproveExpense(adminProfile), true);

  assert.equal(isAdminUser(operatorProfile), false);
  assert.equal(canEditExpense(operatorProfile), false);
  assert.equal(canApproveExpense(operatorProfile), false);
});

test('authenticateUser returns valid Operator BOSP profile for matching credentials', () => {
  const result = authenticateUser('operator_bosp', 'operator123', MOCK_OPERATOR_ACCOUNTS);
  assert.ok(result);
  assert.equal(result.name, 'Rian Kurniawan, S.Pd.');
  assert.equal(result.username, 'operator_bosp');
  assert.equal(result.role, 'Operator BOSP');
});

test('authenticateUser fails for wrong password or empty local accounts', () => {
  const emptyLocalCheck = authenticateUser('bendahara', 'bendahara123', INITIAL_ACCOUNTS);
  assert.equal(emptyLocalCheck, null);

  const wrongPass = authenticateUser('operator_bosp', 'wrongpass', MOCK_OPERATOR_ACCOUNTS);
  assert.equal(wrongPass, null);

  const notFound = authenticateUser('pengguna_tidak_ada', 'any', MOCK_OPERATOR_ACCOUNTS);
  assert.equal(notFound, null);
});

test('validateRegisterForm catches missing fields and invalid username', () => {
  const empty = validateRegisterForm('', '', '', '', MOCK_OPERATOR_ACCOUNTS);
  assert.equal(empty.valid, false);
  assert.ok(empty.errors.name);
  assert.ok(empty.errors.username);
  assert.ok(empty.errors.password);

  // Username with spaces or invalid symbols
  const invalidUser = validateRegisterForm('Operator Baru', 'user with space', '123456', '123456', MOCK_OPERATOR_ACCOUNTS);
  assert.equal(invalidUser.valid, false);
  assert.ok(invalidUser.errors.username);

  // Duplicate username
  const duplicate = validateRegisterForm('Operator Duplikat', 'operator_bosp', '123456', '123456', MOCK_OPERATOR_ACCOUNTS);
  assert.equal(duplicate.valid, false);
  assert.ok(duplicate.errors.username.includes('sudah digunakan'));

  // Password mismatch
  const mismatch = validateRegisterForm('Operator Baru', 'op_baru', 'password123', 'password999', MOCK_OPERATOR_ACCOUNTS);
  assert.equal(mismatch.valid, false);
  assert.ok(mismatch.errors.confirmPassword);

  // Valid registration without email
  const valid = validateRegisterForm('Ahmad Fauzi, M.Pd.', 'ahmad_fauzi', 'pass123', 'pass123', INITIAL_ACCOUNTS);
  assert.equal(valid.valid, true);
  assert.equal(Object.keys(valid.errors).length, 0);
});

test('authenticateUptSchool enforces UPT selection and matches credentials strictly to selected school', () => {
  // Missing UPT
  const noUpt = authenticateUptSchool('', 'smpn2touluaan', '40101972', DEFAULT_UPT_SCHOOLS);
  assert.equal(noUpt.success, false);
  assert.ok(noUpt.error?.includes('pilih UPT'));

  // Matching UPT, username, and password
  const validLogin = authenticateUptSchool('SMP NEGERI 2 TOULUAAN', 'smpn2touluaan', '40101972', DEFAULT_UPT_SCHOOLS);
  assert.equal(validLogin.success, true);
  assert.equal(validLogin.user?.schoolName, 'SMP NEGERI 2 TOULUAAN');
  assert.equal(validLogin.schoolAccount?.npsn, '40101972');

  // Cross-school credential mismatch (selected SMPN 1 Ratahan, but used SMPN 2 Touluaan credentials)
  const crossSchool = authenticateUptSchool('SMP NEGERI 1 RATAHAN', 'smpn2touluaan', '40101972', DEFAULT_UPT_SCHOOLS);
  assert.equal(crossSchool.success, false);
  assert.ok(crossSchool.error?.includes('SMP NEGERI 1 RATAHAN'));
});

test('parseSchoolSpreadsheetCsv parses CSV rows into UptSchoolAccount list', () => {
  const csvSample = `NO,UPT,NPSN,KECAMATAN,USERNAME,PASSWORD,ROLE
1,SMP NEGERI 2 TOULUAAN,40101972,Touluaan,smpn2touluaan,40101972,Operator BOSP
2,SMP NEGERI 1 RATAHAN,40101977,Ratahan,smpn1ratahan,40101977,Operator BOSP`;

  const parsed = parseSchoolSpreadsheetCsv(csvSample);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].upt, 'SMP NEGERI 2 TOULUAAN');
  assert.equal(parsed[0].username, 'smpn2touluaan');
  assert.equal(parsed[0].password, '40101972');
  assert.equal(parsed[1].upt, 'SMP NEGERI 1 RATAHAN');
});

test('normalizeUptKey and mergeSheetSchoolsWithLocal unify Google Sheet UPT names with local school metadata', () => {
  assert.equal(normalizeUptKey('SMP NEGERI 2 TOULUAAN'), 'SMPN 2 TOULUAAN');
  assert.equal(normalizeUptKey('SMPN 2 TOULUAAN'), 'SMPN 2 TOULUAAN');
  assert.equal(normalizeUptKey('DINAS PENDIDIKAN KAB. MINAHASA TENGGARA'), 'DINAS PENDIDIKAN');

  const merged = mergeSheetSchoolsWithLocal(
    [
      {
        id: '62807',
        name: 'RANGGA PRAGUNA',
        username: 'ADMIN',
        role: 'ADMIN',
        namaUpt: 'DINAS PENDIDIKAN',
      },
      {
        id: '76884',
        name: '',
        username: '',
        role: 'Operator BOSP',
        namaUpt: 'SMPN 2 TOULUAAN',
      },
    ],
    DEFAULT_UPT_SCHOOLS
  );

  assert.equal(merged[0].upt, 'DINAS PENDIDIKAN');
  assert.equal(merged[0].username, 'ADMIN');
  assert.equal(merged[0].role, 'Admin');
  assert.equal(merged[1].upt, 'SMPN 2 TOULUAAN');
  assert.equal(merged[1].npsn, '40101972');
  assert.equal(merged[1].kepalaSekolah, 'MEYGEVER ONSU,S.Pd.,M.Pd');
});

test('filterUptSchools filters UPT list by school name or kecamatan', () => {
  const touluaanList = filterUptSchools(DEFAULT_UPT_SCHOOLS, 'TOULUAAN');
  assert.ok(touluaanList.length >= 5);
  assert.ok(touluaanList.every((s) => s.upt.includes('TOULUAAN') || s.kecamatan.includes('Touluaan')));

  const smpn2 = filterUptSchools(DEFAULT_UPT_SCHOOLS, 'SMPN 2 TOULUAAN');
  assert.equal(smpn2.length, 1);
  assert.equal(smpn2[0].upt, 'SMP NEGERI 2 TOULUAAN');
});




test("LOGIN_YEARS starts from 2025, 2026, 2027", () => {
  assert.deepEqual([...LOGIN_YEARS], ["2025", "2026", "2027"]);
});
