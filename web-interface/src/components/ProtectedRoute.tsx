import { Navigate, useLocation } from 'react-router-dom';
import { ReactNode, useEffect, useState } from 'react';
import { authAPI } from '../services/api';
import { setupDevAuth, isDevMode, DEV_TOKEN } from '../utils/auth-dev';

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    // In development mode, auto-authenticate
    if (isDevMode()) {
      const token = localStorage.getItem('auth_token');
      
      if (!token || token !== DEV_TOKEN) {
        setupDevAuth();
      }
      
      setIsAuthenticated(true);
      setIsChecking(false);
      return;
    }
    
    // Production authentication flow
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
      setIsAuthenticated(false);
      setIsChecking(false);
      return;
    }

    try {
      // Verify token with backend
      const response = await authAPI.verify();
      if (response.success) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
      }
    } catch (error) {
      // Token is invalid
      setIsAuthenticated(false);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
    } finally {
      setIsChecking(false);
    }
  };

  if (isChecking) {
    // Show loading state while checking auth
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Save the attempted location for redirect after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}