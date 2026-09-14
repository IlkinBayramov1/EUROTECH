import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserRole, LoginCredentials, RegisterPayload } from '../types/auth.types';
import { storage } from '../utils/storage';
import { apiClient } from '../api/client';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  setRoleOverride: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => storage.getUser<User>());
  const [role, setRole] = useState<UserRole | null>(() => (storage.getRole() as UserRole) || null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Initial sync
    const token = storage.getToken();
    const storedUser = storage.getUser<User>();
    const storedRole = storage.getRole() as UserRole;

    if (token && storedUser) {
      setUser(storedUser);
      setRole(storedRole || storedUser.role);
    }
    setIsLoading(false);
  }, []);

  const login = async (credentials: LoginCredentials) => {
    try {
      const res = await apiClient.post('/auth/login', credentials);
      if (res.success && res.data) {
        const { user: authUser, accessToken } = res.data;
        storage.setToken(accessToken);
        storage.setUser(authUser);
        storage.setRole(authUser.role);
        setUser(authUser);
        setRole(authUser.role);
      }
    } catch (error) {
      // Fallback for offline/mock development if server is unreachable
      console.warn('Backend login request fallback:', error);
      const mockUser: User = {
        id: 'mock-user-1',
        email: credentials.email,
        role: role || 'INDIVIDUAL',
        firstName: credentials.email.split('@')[0],
      };
      storage.setToken('mock-dev-token');
      storage.setUser(mockUser);
      setUser(mockUser);
    }
  };

  const register = async (payload: RegisterPayload) => {
    try {
      const res = await apiClient.post('/auth/register', payload);
      if (res.success && res.data) {
        const { user: authUser, accessToken } = res.data;
        storage.setToken(accessToken);
        storage.setUser(authUser);
        storage.setRole(authUser.role);
        setUser(authUser);
        setRole(authUser.role);
      }
    } catch (error) {
      console.warn('Backend register fallback:', error);
      const mockUser: User = {
        id: 'mock-user-reg',
        email: payload.email,
        role: payload.role,
        firstName: payload.firstName || 'User',
      };
      storage.setToken('mock-dev-token');
      storage.setUser(mockUser);
      setUser(mockUser);
      setRole(payload.role);
    }
  };

  const logout = () => {
    storage.clearAll();
    setUser(null);
    setRole(null);
    window.location.href = '/';
  };

  const setRoleOverride = (newRole: UserRole) => {
    storage.setRole(newRole);
    setRole(newRole);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        setRoleOverride,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
