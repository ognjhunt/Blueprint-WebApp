import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import * as firebaseAuth from '@/lib/firebase'; // To mock firebase functions

// Mock wouter's useLocation
jest.mock('wouter', () => ({
  useLocation: jest.fn().mockReturnValue([null, jest.fn()]),
}));

// Mock firebase module
jest.mock('@/lib/firebase', () => ({
  __esModule: true, // this property makes it work for ES modules
  ...jest.requireActual('@/lib/firebase'), // import and retain default behavior
  loginWithEmailAndPassword: jest.fn(),
  registerWithEmailAndPassword: jest.fn(),
  signInWithGoogle: jest.fn(),
  logOut: jest.fn(),
  getUserData: jest.fn(),
  onAuthStateChanged: jest.fn().mockImplementation((auth, callback) => {
    // Simulate no user initially
    Promise.resolve().then(() => callback(null));
    // Return a mock unsubscribe function
    return jest.fn();
  }),
  auth: {}, // Mock auth object
}));

const TestConsumerComponent = () => {
  const auth = useAuth();
  if (auth.loading) return <div>Loading...</div>;
  return (
    <div>
      <span>User: {auth.currentUser?.email}</span>
      <span>UserData: {JSON.stringify(auth.userData)}</span>
      <button onClick={() => auth.signIn('test@example.com', 'password')}>SignIn</button>
      <button onClick={() => auth.signUp('new@example.com', 'password', 'New User')}>SignUp</button>
      <button onClick={() => auth.signInWithGoogle()}>SignInWithGoogle</button>
      <button onClick={() => auth.logout()}>Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  let mockSetLocation;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    mockSetLocation = jest.fn();
    const ActualWouter = jest.requireActual('wouter');
    ActualWouter.useLocation = jest.fn().mockReturnValue([null, mockSetLocation]);

    // Default mock for onAuthStateChanged to ensure it's always set
    (firebaseAuth.onAuthStateChanged as jest.Mock).mockImplementation((auth, callback) => {
      Promise.resolve().then(() => callback(null)); // Simulate no user initially
      return jest.fn(); // Mock unsubscribe
    });
  });

  // Test successful sign-in
  it('should sign in a user and fetch user data successfully', async () => {
    const mockUser = { uid: '123', email: 'test@example.com' };
    const mockUserData = { id: '123', name: 'Test User', email: 'test@example.com' };

    (firebaseAuth.loginWithEmailAndPassword as jest.Mock).mockResolvedValue(mockUser);
    (firebaseAuth.getUserData as jest.Mock).mockResolvedValue(mockUserData);
    (firebaseAuth.onAuthStateChanged as jest.Mock).mockImplementation((auth, callback) => {
      // Simulate user being authenticated after some async operation
       Promise.resolve().then(() => callback(mockUser));
      return jest.fn();
    });

    let component;
    await act(async () => {
      component = render(
        <AuthProvider>
          <TestConsumerComponent />
        </AuthProvider>
      );
    });

    // Wait for loading to complete
    await waitFor(() => expect(component.queryByText('Loading...')).toBeNull());

    await act(async () => {
      component.getByText('SignIn').click();
    });

    expect(firebaseAuth.loginWithEmailAndPassword).toHaveBeenCalledWith('test@example.com', 'password');
    expect(firebaseAuth.getUserData).toHaveBeenCalledWith('123');

    // Wait for state updates
    await waitFor(() => {
      expect(component.getByText(\`User: test@example.com\`)).toBeInTheDocument();
      expect(component.getByText(\`UserData: ${JSON.stringify(mockUserData)}\`)).toBeInTheDocument();
    });
    expect(mockSetLocation).toHaveBeenCalledWith('/dashboard');
  });

  // Test sign-in failure
  it('should handle sign-in failure', async () => {
    const error = { code: 'auth/user-not-found', message: 'User not found' };
    (firebaseAuth.loginWithEmailAndPassword as jest.Mock).mockRejectedValue(error);

    let component;
    await act(async () => {
      component = render(
        <AuthProvider>
          <TestConsumerComponent />
        </AuthProvider>
      );
    });
    await waitFor(() => expect(component.queryByText('Loading...')).toBeNull());

    await expect(act(async () => {
      component.getByText('SignIn').click();
    })).rejects.toThrow('No account found with this email'); // Check against the mapped error message

    expect(firebaseAuth.loginWithEmailAndPassword).toHaveBeenCalledWith('test@example.com', 'password');
    expect(firebaseAuth.getUserData).not.toHaveBeenCalled();
    expect(component.getByText('User:')).toBeInTheDocument(); // No user
    expect(component.getByText('UserData: null')).toBeInTheDocument();
  });

  // Test successful sign-up
  it('should sign up a new user and fetch user data', async () => {
    const mockUser = { uid: '456', email: 'new@example.com' };
    const mockUserData = { id: '456', name: 'New User', email: 'new@example.com' };

    (firebaseAuth.registerWithEmailAndPassword as jest.Mock).mockResolvedValue(mockUser);
    (firebaseAuth.getUserData as jest.Mock).mockResolvedValue(mockUserData);
     (firebaseAuth.onAuthStateChanged as jest.Mock).mockImplementation((auth, callback) => {
       Promise.resolve().then(() => callback(mockUser));
      return jest.fn();
    });

    let component;
    await act(async () => {
      component = render(
        <AuthProvider>
          <TestConsumerComponent />
        </AuthProvider>
      );
    });
    await waitFor(() => expect(component.queryByText('Loading...')).toBeNull());

    await act(async () => {
      component.getByText('SignUp').click();
    });

    expect(firebaseAuth.registerWithEmailAndPassword).toHaveBeenCalledWith('new@example.com', 'password', 'New User');
    expect(firebaseAuth.getUserData).toHaveBeenCalledWith('456');

    await waitFor(() => {
      expect(component.getByText(\`User: new@example.com\`)).toBeInTheDocument();
      expect(component.getByText(\`UserData: ${JSON.stringify(mockUserData)}\`)).toBeInTheDocument();
    });
    expect(mockSetLocation).toHaveBeenCalledWith('/');
  });

  // Test sign-up failure (e.g., email already in use)
  it('should handle sign-up failure', async () => {
    const error = { code: 'auth/email-already-in-use', message: 'Email already in use' };
    (firebaseAuth.registerWithEmailAndPassword as jest.Mock).mockRejectedValue(error);

    let component;
    await act(async () => {
      component = render(
        <AuthProvider>
          <TestConsumerComponent />
        </AuthProvider>
      );
    });
    await waitFor(() => expect(component.queryByText('Loading...')).toBeNull());

    await expect(act(async () => {
      component.getByText('SignUp').click();
    })).rejects.toThrow('An account with this email already exists');

    expect(firebaseAuth.registerWithEmailAndPassword).toHaveBeenCalledWith('new@example.com', 'password', 'New User');
    expect(firebaseAuth.getUserData).not.toHaveBeenCalled();
  });

  // Test successful Google Sign-In
  it('should sign in with Google and fetch user data', async () => {
    const mockUser = { uid: '789', email: 'googleuser@example.com' };
    const mockUserData = { id: '789', name: 'Google User', email: 'googleuser@example.com' };

    (firebaseAuth.signInWithGoogle as jest.Mock).mockResolvedValue(mockUser);
    (firebaseAuth.getUserData as jest.Mock).mockResolvedValue(mockUserData);
    (firebaseAuth.onAuthStateChanged as jest.Mock).mockImplementation((auth, callback) => {
       Promise.resolve().then(() => callback(mockUser));
      return jest.fn();
    });

    let component;
    await act(async () => {
      component = render(
        <AuthProvider>
          <TestConsumerComponent />
        </AuthProvider>
      );
    });
    await waitFor(() => expect(component.queryByText('Loading...')).toBeNull());

    await act(async () => {
      component.getByText('SignInWithGoogle').click();
    });

    expect(firebaseAuth.signInWithGoogle).toHaveBeenCalled();
    expect(firebaseAuth.getUserData).toHaveBeenCalledWith('789');

    await waitFor(() => {
      expect(component.getByText(\`User: googleuser@example.com\`)).toBeInTheDocument();
      expect(component.getByText(\`UserData: ${JSON.stringify(mockUserData)}\`)).toBeInTheDocument();
    });
    // Note: Google Sign-In in the current AuthContext doesn't explicitly call setLocation,
    // so we don't check mockSetLocation here unless that behavior is added.
  });

  // Test Google Sign-In failure
  it('should handle Google sign-in failure', async () => {
    const error = { code: 'auth/popup-closed-by-user', message: 'Popup closed' };
    (firebaseAuth.signInWithGoogle as jest.Mock).mockRejectedValue(error);

    let component;
    await act(async () => {
      component = render(
        <AuthProvider>
          <TestConsumerComponent />
        </AuthProvider>
      );
    });
    await waitFor(() => expect(component.queryByText('Loading...')).toBeNull());

    await expect(act(async () => {
      component.getByText('SignInWithGoogle').click();
    })).rejects.toThrow('Google sign-in was cancelled');

    expect(firebaseAuth.signInWithGoogle).toHaveBeenCalled();
    expect(firebaseAuth.getUserData).not.toHaveBeenCalled();
  });

  // Test successful logout
  it('should log out a user successfully', async () => {
    // First, simulate a logged-in user
    const mockUser = { uid: '123', email: 'test@example.com' };
    const mockUserData = { id: '123', name: 'Test User', email: 'test@example.com' };
    (firebaseAuth.onAuthStateChanged as jest.Mock).mockImplementation((auth, callback) => {
      Promise.resolve().then(() => callback(mockUser)); // Simulate user logged in initially
      return jest.fn();
    });
    (firebaseAuth.getUserData as jest.Mock).mockResolvedValue(mockUserData); // For initial load

    let component;
    await act(async () => {
      component = render(
        <AuthProvider>
          <TestConsumerComponent />
        </AuthProvider>
      );
    });

    // Wait for initial user to be set
    await waitFor(() => expect(component.getByText(\`User: test@example.com\`)).toBeInTheDocument());

    // Mock onAuthStateChanged for logout transition
    (firebaseAuth.onAuthStateChanged as jest.Mock).mockImplementation((auth, callback) => {
      Promise.resolve().then(() => callback(null)); // Simulate user becomes null after logout
      return jest.fn();
    });
    (firebaseAuth.logOut as jest.Mock).mockResolvedValue(undefined);

    await act(async () => {
      component.getByText('Logout').click();
    });

    expect(firebaseAuth.logOut).toHaveBeenCalled();
    await waitFor(() => {
      expect(component.getByText('User:')).toBeInTheDocument(); // No user
      expect(component.getByText('UserData: null')).toBeInTheDocument();
    });
  });

  // Test logout failure
  it('should handle logout failure', async () => {
    // Simulate a logged-in user
     const mockUser = { uid: '123', email: 'test@example.com' };
    (firebaseAuth.onAuthStateChanged as jest.Mock).mockImplementation((auth, callback) => {
      Promise.resolve().then(() => callback(mockUser));
      return jest.fn();
    });
    (firebaseAuth.getUserData as jest.Mock).mockResolvedValue({}); // For initial load

    const error = { code: 'auth/network-request-failed', message: 'Network error' };
    (firebaseAuth.logOut as jest.Mock).mockRejectedValue(error);

    let component;
    await act(async () => {
      component = render(
        <AuthProvider>
          <TestConsumerComponent />
        </AuthProvider>
      );
    });
    await waitFor(() => expect(component.queryByText('Loading...')).toBeNull());

    // Ensure user is initially "logged in" for the test
    await waitFor(() => expect(component.getByText(\`User: test@example.com\`)).toBeInTheDocument());

    await expect(act(async () => {
      component.getByText('Logout').click();
    })).rejects.toThrow('Failed to sign out. Please try again.');

    expect(firebaseAuth.logOut).toHaveBeenCalled();
    // User state should remain unchanged if logout fails
    expect(component.getByText(\`User: test@example.com\`)).toBeInTheDocument();
  });

  it('should correctly map auth error codes to messages', async () => {
      const mockSignInError = { code: 'auth/wrong-password', message: 'Wrong password' };
      (firebaseAuth.loginWithEmailAndPassword as jest.Mock).mockRejectedValue(mockSignInError);

      let component;
      await act(async () => {
        component = render(
          <AuthProvider>
            <TestConsumerComponent />
          </AuthProvider>
        );
      });
      await waitFor(() => expect(component.queryByText('Loading...')).toBeNull());

      await expect(act(async () => {
        component.getByText('SignIn').click();
      })).rejects.toThrow('Invalid password'); // This is the mapped message

      const mockSignUpError = { code: 'auth/weak-password', message: 'Password is too weak' };
      (firebaseAuth.registerWithEmailAndPassword as jest.Mock).mockRejectedValue(mockSignUpError);
      await expect(act(async () => {
        component.getByText('SignUp').click();
      })).rejects.toThrow('Password is too weak');
  });

  it('should handle redirect from sessionStorage after sign in', async () => {
    const mockUser = { uid: '123', email: 'test@example.com' };
    const mockUserData = { id: '123', name: 'Test User', email: 'test@example.com' };
    const redirectPath = '/custom-redirect';

    jest.spyOn(window.sessionStorage.__proto__, 'getItem').mockReturnValue(redirectPath);
    jest.spyOn(window.sessionStorage.__proto__, 'removeItem');

    (firebaseAuth.loginWithEmailAndPassword as jest.Mock).mockResolvedValue(mockUser);
    (firebaseAuth.getUserData as jest.Mock).mockResolvedValue(mockUserData);
    (firebaseAuth.onAuthStateChanged as jest.Mock).mockImplementation((auth, callback) => {
      Promise.resolve().then(() => callback(mockUser));
      return jest.fn();
    });

    let component;
    await act(async () => {
      component = render(
        <AuthProvider>
          <TestConsumerComponent />
        </AuthProvider>
      );
    });
    await waitFor(() => expect(component.queryByText('Loading...')).toBeNull());

    await act(async () => {
      component.getByText('SignIn').click();
    });

    await waitFor(() => {
      expect(sessionStorage.getItem).toHaveBeenCalledWith('redirectAfterAuth');
      expect(sessionStorage.removeItem).toHaveBeenCalledWith('redirectAfterAuth');
      expect(mockSetLocation).toHaveBeenCalledWith(redirectPath);
    });
  });

});
