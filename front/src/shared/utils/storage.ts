const TOKEN_KEY = 'eurotech_access_token';
const USER_KEY = 'eurotech_user';
const ROLE_KEY = 'eurotech_role';
const DOSSIER_KEY = 'eurotech_active_dossier_id';
const REMEMBER_IDENTIFIER_KEY = 'eurotech_remembered_identifier';
const REMEMBER_ENABLED_KEY = 'eurotech_remember_enabled';

export const storage = {
  // Tab-scoped token storage
  getToken(): string | null {
    return sessionStorage.getItem(TOKEN_KEY);
  },
  setToken(token: string): void {
    sessionStorage.setItem(TOKEN_KEY, token);
  },
  removeToken(): void {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  },

  // Tab-scoped user object
  getUser<T = any>(): T | null {
    const raw = sessionStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  setUser(user: any): void {
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  removeUser(): void {
    sessionStorage.removeItem(USER_KEY);
    localStorage.removeItem(USER_KEY);
  },

  // Tab-scoped role
  getRole(): string | null {
    return sessionStorage.getItem(ROLE_KEY);
  },
  setRole(role: string): void {
    sessionStorage.setItem(ROLE_KEY, role);
  },
  removeRole(): void {
    sessionStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(ROLE_KEY);
  },

  // Tab-scoped active dossier
  getActiveDossierId(): string | null {
    return sessionStorage.getItem(DOSSIER_KEY);
  },
  setActiveDossierId(id: string): void {
    sessionStorage.setItem(DOSSIER_KEY, id);
  },
  removeActiveDossierId(): void {
    sessionStorage.removeItem(DOSSIER_KEY);
    localStorage.removeItem(DOSSIER_KEY);
  },

  // Remember Me helpers (Persistent across browser restarts, stores ONLY public identifier like email or passport number)
  saveRememberMe(identifier: string): void {
    localStorage.setItem(REMEMBER_IDENTIFIER_KEY, identifier);
    localStorage.setItem(REMEMBER_ENABLED_KEY, 'true');
  },
  getRememberedIdentifier(): string | null {
    return localStorage.getItem(REMEMBER_IDENTIFIER_KEY);
  },
  isRememberEnabled(): boolean {
    return localStorage.getItem(REMEMBER_ENABLED_KEY) === 'true';
  },
  clearRememberMe(): void {
    localStorage.removeItem(REMEMBER_IDENTIFIER_KEY);
    localStorage.removeItem(REMEMBER_ENABLED_KEY);
  },

  // Total session revocation
  clearAll(): void {
    sessionStorage.clear();
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(DOSSIER_KEY);
  },
};
