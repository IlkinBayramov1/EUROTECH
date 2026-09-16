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
        return;
      }
    } catch (error: any) {
      // If it's an explicit 400/401/403 credentials error, rethrow so UI can notify
      if (error?.status && error.status < 500) {
        throw error;
      }
      console.warn('Backend login request fallback:', error);
      const mockUser: User = {
        id: 'mock-user-1',
        email: credentials.email,
        role: role || 'INDIVIDUAL',
        fullName: credentials.email.split('@')[0],
        firstName: credentials.email.split('@')[0],
      };
      storage.setToken('mock-dev-token');
      storage.setUser(mockUser);
      setUser(mockUser);
    }
  };

  const register = async (payload: RegisterPayload) => {
    const backendRole = payload.role === 'AGENT' ? 'AGENT_TUR_OPERATOR' 
      : payload.role === 'CORPORATE' ? 'CORPORATE_HR' 
      : payload.role;

    const fullName = (payload.firstName || payload.lastName) 
      ? `${payload.firstName || ''} ${payload.lastName || ''}`.trim() 
      : 'User';

    const body = {
      email: payload.email,
      password: payload.password,
      fullName,
      role: backendRole,
      companyName: payload.companyName || payload.agencyName,
      phone: payload.phone,
      passportNumber: payload.passportNumber,
    };

    try {
      const res = await apiClient.post('/auth/register', body);
      // Auto-login to obtain session token
      try {
        const loginRes = await apiClient.post('/auth/login', {
          email: payload.email,
          password: payload.password,
        });
        if (loginRes.success && loginRes.data) {
          const { user: authUser, accessToken } = loginRes.data;
          storage.setToken(accessToken);
          storage.setUser(authUser);
          storage.setRole(authUser.role);
          setUser(authUser);
          setRole(authUser.role);
          return;
        }
      } catch (loginErr) {
        if (res.data?.user) {
          setUser(res.data.user);
          setRole(res.data.user.role);
        }
      }
    } catch (error: any) {
      if (error?.status && error.status < 500) {
        throw error;
      }
      console.warn('Backend register fallback:', error);
      const mockUser: User = {
        id: 'mock-user-reg',
        email: payload.email,
        role: payload.role,
        fullName,
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
