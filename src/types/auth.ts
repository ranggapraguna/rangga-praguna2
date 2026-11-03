export type UserRole = 'Operator BOSP' | 'Admin';

export interface UserProfile {
  id: string;
  username: string; // ID Pengguna / Username (tanpa format email)
  name: string;
  nip?: string;
  role: UserRole;
  schoolName: string;
  createdAt: string;
  email?: string; // Opsional
}

export interface UserAccount extends UserProfile {
  passwordHash: string; // Password / Hash kata sandi
}

export interface AuthState {
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
}
