const TOKEN_KEY = 'eurotech_access_token';
const USER_KEY = 'eurotech_user';
const ROLE_KEY = 'eurotech_role';

export const storage = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },
  removeToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  },

  getUser<T = any>(): T | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  setUser(user: any): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  removeUser(): void {
    localStorage.removeItem(USER_KEY);
  },

  getRole(): string | null {
    return localStorage.getItem(ROLE_KEY);
  },
  setRole(role: string): void {
    localStorage.setItem(ROLE_KEY, role);
  },
  removeRole(): void {
    localStorage.removeItem(ROLE_KEY);
  },

  clearAll(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ROLE_KEY);
  },
};
