import { useLocation } from 'wouter';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

// Temporary mock implementation without Firebase auth
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  // For now, we'll allow access to all protected routes
  return <>{children}</>;
}
