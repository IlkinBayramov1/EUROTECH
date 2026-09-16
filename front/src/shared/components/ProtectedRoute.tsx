import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types/auth.types';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  redirectPath?: string;
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  allowedRoles,
  redirectPath = '/',
  children,
}) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#002B49', fontWeight: 600 }}>Loading EuroTech Portal...</div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to={redirectPath} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    // Normalize role comparison
    const userRole = user.role;
    const isAllowed = allowedRoles.some((r) => {
      if (r === userRole) return true;
      if ((r === 'AGENT' || r === 'AGENT_TUR_OPERATOR') && (userRole === 'AGENT' || userRole === 'AGENT_TUR_OPERATOR')) return true;
      if ((r === 'CORPORATE' || r === 'CORPORATE_HR') && (userRole === 'CORPORATE' || userRole === 'CORPORATE_HR')) return true;
      if (userRole === 'ADMIN') return true;
      return false;
    });

    if (!isAllowed) {
      return <Navigate to={redirectPath} replace />;
    }
  }

  return children ? <>{children}</> : <Outlet />;
};
