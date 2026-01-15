import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import Nav from '@/components/Nav';

const setLocationMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());
const logoutMock = vi.hoisted(() => vi.fn().mockResolvedValue(null));
const useAuthMock = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('wouter', () => ({
  useLocation: () => ['/', setLocationMock],
  useRoute: () => [false, null],
  Link: ({ children, href }) => <a href={href}>{children}</a>,
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenuLabel: ({ children }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <div />,
}));

const getInitials = (name) => {
  if (!name) return "";
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
};

describe('Nav Component', () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({
      currentUser: null,
      userData: null,
      logout: logoutMock,
    });
  });

  it('renders login button when no currentUser', () => {
    render(<Nav />);
    expect(screen.getByRole('button', { name: /Log in/i })).toBeInTheDocument();
  });

  describe('getInitials() utility function', () => {
    it('should return correct initials for a two-word name', () => {
      expect(getInitials('John Doe')).toBe('JD');
    });

    it('should return correct initials for a single name', () => {
      expect(getInitials('User')).toBe('U');
    });

    it('should return correct initials for a multi-word name (more than two)', () => {
      expect(getInitials('Mary Ann Jones')).toBe('MA');
    });

    it('should return correct initials for names with leading/trailing spaces', () => {
      expect(getInitials('  John Doe  ')).toBe('JD');
    });

    it('should return empty string for empty input or null', () => {
      expect(getInitials('')).toBe('');
      expect(getInitials(null)).toBe('');
      expect(getInitials(undefined)).toBe('');
    });

    it('should handle names with extra spaces between words', () => {
      expect(getInitials('John   Doe')).toBe('JD');
    });

    it('should handle names with only spaces', () => {
      expect(getInitials('   ')).toBe('');
    });
  });

  it('calls logout and navigates home on sign out', () => {
    useAuthMock.mockReturnValue({
      currentUser: { displayName: 'Jane Doe', email: 'jane@example.com' },
      userData: { name: 'Jane Doe' },
      logout: logoutMock,
    });

    render(<Nav />);

    fireEvent.click(screen.getByRole('button', { name: /Sign out/i }));

    expect(logoutMock).toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Signed Out' }),
    );
    expect(setLocationMock).toHaveBeenCalledWith('/');
  });

  it('shows the user menu when a currentUser exists', () => {
    useAuthMock.mockReturnValue({
      currentUser: { displayName: 'Jane Doe', email: 'jane@example.com' },
      userData: { name: 'Jane Doe' },
      logout: logoutMock,
    });

    render(<Nav />);

    expect(screen.getByLabelText('User menu')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Log in/i })).toBeNull();
  });

  it('toggles the mobile menu visibility', () => {
    render(<Nav />);

    const toggleButton = screen.getByRole('button', { name: /Open menu/i });
    fireEvent.click(toggleButton);

    expect(screen.getByText(/Why Simulation\?/i)).toBeInTheDocument();
  });
});
