import { UserAccount, UserProfile, UserRole } from '../types/auth';
import { UptSchoolAccount, normalizeUptKey } from '../data/schoolData';

export const INITIAL_ACCOUNTS: UserAccount[] = [];

export function normalizeUserRole(rawRole?: string, username?: string): UserRole {
  const roleStr = String(rawRole || '').trim().toLowerCase();
  const userStr = String(username || '').trim().toLowerCase();
  if (roleStr === 'admin' || roleStr.includes('admin') || userStr === 'admin' || userStr === 'administrator') {
    return 'Admin';
  }
  return 'Operator BOSP';
}

export function isAdminUser(user: UserProfile | null | undefined): boolean {
  if (!user) return false;
  return normalizeUserRole(user.role, user.username) === 'Admin';
}

export function canEditExpense(user: UserProfile | null | undefined): boolean {
  return isAdminUser(user);
}

export function canApproveExpense(user: UserProfile | null | undefined): boolean {
  return isAdminUser(user);
}

const LEGACY_KEYS = [
  'appsheet_registered_accounts_v1',
  'appsheet_registered_accounts_v2',
  'appsheet_user_session_v1',
  'appsheet_user_session_v2',
];

const STORAGE_KEY_ACCOUNTS = 'appsheet_registered_accounts_v3_clean';
const STORAGE_KEY_SESSION = 'appsheet_user_session_v3_clean';

function purgeLegacyLocalStorage(): void {
  try {
    for (const key of LEGACY_KEYS) {
      localStorage.removeItem(key);
    }
  } catch {
    // ignore storage errors
  }
}

export function loadStoredAccounts(): UserAccount[] {
  try {
    purgeLegacyLocalStorage();
    localStorage.removeItem(STORAGE_KEY_ACCOUNTS);
    return [];
  } catch {
    return [];
  }
}

export function saveStoredAccounts(_accounts: UserAccount[]): void {
  try {
    localStorage.removeItem(STORAGE_KEY_ACCOUNTS);
  } catch (err) {
    console.error('Failed to clear accounts in localStorage', err);
  }
}

export function loadCurrentSession(): UserProfile | null {
  try {
    purgeLegacyLocalStorage();
    const raw = localStorage.getItem(STORAGE_KEY_SESSION);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as UserProfile;
    if (!parsed || ['usr-001', 'usr-002', 'usr-003'].includes(parsed.id)) {
      localStorage.removeItem(STORAGE_KEY_SESSION);
      return null;
    }
    return {
      ...parsed,
      role: normalizeUserRole(parsed.role, parsed.username),
    };
  } catch {
    return null;
  }
}

export function saveCurrentSession(user: UserProfile | null): void {
  try {
    if (user) {
      localStorage.setItem(
        STORAGE_KEY_SESSION,
        JSON.stringify({ ...user, role: normalizeUserRole(user.role, user.username) })
      );
    } else {
      localStorage.removeItem(STORAGE_KEY_SESSION);
    }
  } catch (err) {
    console.error('Failed to save session', err);
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export function validateRegisterForm(
  name: string,
  username: string,
  password: string,
  confirmPassword: string,
  existingAccounts: UserAccount[]
): ValidationResult {
  const errors: Record<string, string> = {};

  if (!name.trim()) {
    errors.name = 'Nama lengkap wajib diisi';
  } else if (name.trim().length < 3) {
    errors.name = 'Nama lengkap minimal 3 karakter';
  }

  const cleanUsername = username.trim().toLowerCase();
  if (!cleanUsername) {
    errors.username = 'Username wajib diisi';
  } else if (cleanUsername.length < 3) {
    errors.username = 'Username minimal 3 karakter';
  } else if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
    errors.username = 'Username hanya boleh huruf, angka, titik, atau strip (tanpa spasi / tanda @)';
  } else if (existingAccounts.some((a) => a.username.toLowerCase() === cleanUsername)) {
    errors.username = 'Username sudah digunakan. Silakan pilih username lain.';
  }

  if (!password) {
    errors.password = 'Kata sandi wajib diisi';
  } else if (password.length < 6) {
    errors.password = 'Kata sandi minimal 6 karakter';
  }

  if (password !== confirmPassword) {
    errors.confirmPassword = 'Konfirmasi kata sandi tidak cocok';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function authenticateUser(
  username: string,
  password: string,
  accounts: UserAccount[]
): UserProfile | null {
  const cleanInput = username.trim().toLowerCase();
  const account = accounts.find(
    (a) => (a.username.toLowerCase() === cleanInput || (a.email && a.email.toLowerCase() === cleanInput)) && a.passwordHash === password
  );

  if (!account) return null;

  return {
    id: account.id,
    username: account.username,
    name: account.name,
    email: account.email,
    nip: account.nip,
    role: account.role,
    schoolName: account.schoolName,
    createdAt: account.createdAt,
  };
}

export interface UptAuthResult {
  success: boolean;
  user?: UserProfile;
  schoolAccount?: UptSchoolAccount;
  error?: string;
}

export function authenticateUptSchool(
  selectedUpt: string,
  username: string,
  password: string,
  schools: UptSchoolAccount[]
): UptAuthResult {
  const cleanUpt = selectedUpt.trim();
  const cleanUser = username.trim().toLowerCase();
  const cleanPass = password.trim();

  if (!cleanUpt) {
    return {
      success: false,
      error: 'Silakan pilih UPT / Satuan Pendidikan terlebih dahulu.',
    };
  }

  if (!cleanUser || !cleanPass) {
    return {
      success: false,
      error: 'Username dan kata sandi wajib diisi sesuai UPT yang dipilih.',
    };
  }

  const targetSchool = schools.find(
    (s) =>
      s.upt.trim().toLowerCase() === cleanUpt.toLowerCase() ||
      s.id === cleanUpt ||
      normalizeUptKey(s.upt) === normalizeUptKey(cleanUpt)
  );

  if (!targetSchool) {
    return {
      success: false,
      error: 'UPT yang dipilih tidak ditemukan dalam daftar sekolah spreadsheet.',
    };
  }

  const expectedUser = targetSchool.username.trim().toLowerCase();
  const expectedPass = targetSchool.password.trim();

  if (cleanUser !== expectedUser || cleanPass !== expectedPass) {
    return {
      success: false,
      error: `Username atau kata sandi tidak sesuai dengan data spreadsheet untuk UPT ${targetSchool.upt}.`,
    };
  }

  const resolvedRole: UserRole = normalizeUserRole(targetSchool.role, targetSchool.username);

  const userProfile: UserProfile = {
    id: targetSchool.id,
    username: targetSchool.username,
    name: targetSchool.pengurusBarang || targetSchool.kepalaSekolah || `Operator ${targetSchool.upt}`,
    nip: targetSchool.nipPengurusBarang || targetSchool.nipKepalaSekolah,
    role: resolvedRole,
    schoolName: targetSchool.upt,
    createdAt: new Date().toISOString(),
  };

  return {
    success: true,
    user: userProfile,
    schoolAccount: targetSchool,
  };
}

