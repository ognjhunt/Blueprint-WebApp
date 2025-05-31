import React from 'react';
import { render, fireEvent, waitFor, screen, act } from '@testing-library/react';
import SignIn from '@/pages/SignIn'; // Adjust path as necessary
import { AuthProvider, useAuth } from '@/contexts/AuthContext'; // Needed for mocking
import { useToast } from '@/hooks/use-toast';
import { GoogleOAuthProvider } from '@react-oauth/google';

// Mock wouter's useLocation
let mockSetLocation;
jest.mock('wouter', () => {
  const originalModule = jest.requireActual('wouter');
  mockSetLocation = jest.fn();
  return {
    ...originalModule,
    useLocation: () => [null, mockSetLocation],
  };
});

// Mock useAuth
const mockSignIn = jest.fn();
const mockSignInWithGoogle = jest.fn(); // Not directly called by SignIn's logic, but good to have if GoogleLogin component itself uses it from context directly.
// For this test, we'll mostly care about the props passed to GoogleLogin component

jest.mock('@/contexts/AuthContext', () => ({
  ...jest.requireActual('@/contexts/AuthContext'),
  useAuth: () => ({
    signIn: mockSignIn,
    signInWithGoogle: mockSignInWithGoogle, // if GoogleLogin was using this directly
    // Add other auth context values if needed by SignIn component
  }),
}));

// Mock useToast
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

// Mock GoogleLogin component to control its behavior
jest.mock('@react-oauth/google', () => ({
  ...jest.requireActual('@react-oauth/google'), // Keep GoogleOAuthProvider
  GoogleLogin: jest.fn(({ onSuccess, onError }) => (
    <div>
      <button onClick={() => onSuccess('mockCredentialResponse')}>Simulate Google Success</button>
      <button onClick={onError}>Simulate Google Error</button>
    </div>
  )),
}));


describe('SignIn Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset window.location.search for returnUrl tests
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, search: '', href: '' },
    });
  });

  const renderSignInPage = () => {
    // Wrapping with AuthProvider just in case any deeper component relies on it,
    // though useAuth is mocked directly for the SignIn page's direct consumption.
    // GoogleOAuthProvider is necessary for GoogleLogin.
    return render(
      <GoogleOAuthProvider clientId="test-client-id">
        <AuthProvider>
          <SignIn />
        </AuthProvider>
      </GoogleOAuthProvider>
    );
  };

  describe('Email/Password Sign In', () => {
    it('should successfully sign in and redirect to dashboard', async () => {
      mockSignIn.mockResolvedValueOnce(undefined);
      renderSignInPage();

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
      });

      expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Welcome back!',
        description: "You've successfully signed in.",
      });
      expect(mockSetLocation).toHaveBeenCalledWith('/dashboard');
    });

    it('should successfully sign in and redirect to returnUrl if present', async () => {
      const returnUrl = '/previous-page';
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { ...window.location, search: \`?returnUrl=\${encodeURIComponent(returnUrl)}\`, href: '' },
      });
      mockSignIn.mockResolvedValueOnce(undefined);
      renderSignInPage();

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
      });

      expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Welcome back!',
        description: "You've successfully signed in.",
      });
      // Check if window.location.href was set for external redirects
      expect(window.location.href).toBe(decodeURIComponent(returnUrl));
    });

    it('should show validation error for invalid email', async () => {
      renderSignInPage();
      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'invalid-email' } });
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
      });

      // Wait for form validation message to appear
      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
      });
      expect(mockSignIn).not.toHaveBeenCalled();
    });

    it('should show validation error for short password', async () => {
      renderSignInPage();
      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'short' } });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
      });

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument();
      });
      expect(mockSignIn).not.toHaveBeenCalled();
    });

    it('should display an error toast if signIn from AuthContext fails', async () => {
      const errorMessage = 'Invalid credentials';
      mockSignIn.mockRejectedValueOnce(new Error(errorMessage));
      renderSignInPage();

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
      });

      expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123');
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Authentication failed',
          description: errorMessage,
          variant: 'destructive',
        });
      });
      expect(mockSetLocation).not.toHaveBeenCalled();
    });
  });

  describe('Google Sign In', () => {
    it('should handle Google sign-in success and redirect', async () => {
      renderSignInPage();

      await act(async () => {
        fireEvent.click(screen.getByText('Simulate Google Success'));
      });

      // The actual call to signInWithGoogle (from AuthContext) would happen inside the GoogleLogin component's onSuccess.
      // Here, we're testing the SignIn page's reaction to that success.
      await waitFor(() => {
         expect(mockToast).toHaveBeenCalledWith({
          title: 'Welcome back!',
          description: "You've successfully signed in with Google.",
        });
      });
      expect(mockSetLocation).toHaveBeenCalledWith('/dashboard');
    });

    it('should handle Google sign-in error', async () => {
      renderSignInPage();

      await act(async () => {
        fireEvent.click(screen.getByText('Simulate Google Error'));
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Authentication failed',
          description: 'Failed to sign in with Google.',
          variant: 'destructive',
        });
      });
      expect(mockSetLocation).not.toHaveBeenCalled();
    });
  });
});
