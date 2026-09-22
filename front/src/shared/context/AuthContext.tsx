
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
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => storage.getUser<User>());
  const [role, setRole] = useState<UserRole | null>(() => (storage.getRole() as UserRole) || null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Initial sync from tab-scoped sessionStorage
    const token = storage.getToken();
    const storedUser = storage.getUser<User>();
    const storedRole = storage.getRole() as UserRole;

    if (!token || !storedUser) {
      setUser(null);
      setRole(null);
      setIsLoading(false);
      return;
    }

    // Populate active tab state
    setUser(storedUser);
    setRole(storedRole || storedUser.role);

    // Verify token with backend to ensure session is authentic and unexpired
    apiClient.get('/auth/profile')
      .then((res: any) => {
        if (res.data?.user) {
          const freshUser = res.data.user;
          setUser(freshUser);
          setRole(freshUser.role);
          storage.setUser(freshUser);
          storage.setRole(freshUser.role);
        }
      })
      .catch((err: any) => {
        // If 401/403 or invalid token, terminate session immediately
        if (err?.status === 401 || err?.status === 403) {
          storage.clearAll();
          setUser(null);
          setRole(null);
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = async (credentials: LoginCredentials) => {
    const rawId = (credentials.identifier || credentials.email || credentials.username || credentials.passportNumber || '').trim();
    
    const body: Record<string, any> = { 
      password: credentials.password,
      expectedRole: credentials.expectedRole,
      portalRole: credentials.portalRole,
    };
    if (rawId.includes('@')) {
      body.email = rawId;
    } else if (rawId.toUpperCase().startsWith('EUR')) {
      body.username = rawId;
    } else {
      body.loginIdentifier = rawId;
      body.passportNumber = rawId;
    }

    if (credentials.rememberMe && rawId) {
      storage.saveRememberMe(rawId);
    } else if (credentials.rememberMe === false) {
      storage.clearRememberMe();
    }

    try {
      const res = await apiClient.post('/auth/login', body);
      if (res.success && res.data) {
        const { user: authUser, accessToken } = res.data;

        // Strict defense-in-depth portal validation
        if (credentials.expectedRole && authUser.role !== 'ADMIN') {
          const isMatching = 
            (credentials.expectedRole === 'AGENT_TUR_OPERATOR' && (authUser.role === 'AGENT_TUR_OPERATOR' || authUser.role === 'AGENT')) ||
            (credentials.expectedRole === 'CORPORATE_HR' && (authUser.role === 'CORPORATE_HR' || authUser.role === 'CORPORATE')) ||
            (credentials.expectedRole === 'INDIVIDUAL' && authUser.role === 'INDIVIDUAL');

          if (!isMatching) {
            storage.clearAll();
            throw new Error('Invalid email, passport number or password.');
          }
        }

        storage.setToken(accessToken);
        storage.setUser(authUser);
        storage.setRole(authUser.role);
        setUser(authUser);
        setRole(authUser.role);
        return;
      }
    } catch (error: any) {
      // Ensure failed logins rethrow to display error toast
      storage.clearAll();
      setUser(null);
      setRole(null);
      throw error;
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
    if (!user) {
      storage.setRole(newRole);
      setRole(newRole);
    }
  };

  const refreshUser = async () => {
    try {
      const res: any = await apiClient.get('/auth/profile');
      if (res.data?.user) {
        const freshUser = res.data.user;
        setUser(freshUser);
        storage.setUser(freshUser);
      }
    } catch (err) {
      console.warn('Failed to refresh user profile:', err);
    }
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
        refreshUser,
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
