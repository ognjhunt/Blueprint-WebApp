import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock authentication and routing hooks used by the Home component
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('wouter', () => ({
  useLocation: vi.fn(),
}));

// Mock heavy child components so Home can render in tests
vi.mock('@/components/Nav', () => ({ default: () => <div data-testid="nav" /> }));
vi.mock('@/components/sections/Hero', () => ({ default: () => <div data-testid="hero" /> }));
vi.mock('@/components/sections/Features', () => ({ default: () => <div data-testid="features" /> }));
vi.mock('@/components/ui/button', () => ({
  Button: (props: any) => <button {...props} />,
}));
vi.mock('@/components/sections/ContactForm', () => ({
  default: () => <div id="contactForm" />,
}));
vi.mock('@/components/ui/card', () => ({
  Card: (props: any) => <div {...props} />,
  CardContent: (props: any) => <div {...props} />,
}));
vi.mock('@/components/Footer', () => ({ default: () => <div data-testid="footer" /> }));
vi.mock('@/components/sections/Testimonials', () => ({ default: () => <div data-testid="testimonials" /> }));
vi.mock('@/components/sections/LocationShowcase', () => ({ default: () => <div data-testid="location-showcase" /> }));

// Import the Home component and mocked hooks after mocks are set up
import Home from '@/pages/Home';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';

// Cast the mocked hooks to Vitest Mock type for convenience
const mockUseAuth = useAuth as Mock;
const mockUseLocation = useLocation as Mock;

beforeEach(() => {
  mockUseAuth.mockReset();
  mockUseLocation.mockReset();
});

describe('Home', () => {
  it('redirects to /dashboard for authenticated users', async () => {
    mockUseAuth.mockReturnValue({ currentUser: { uid: 'user123' } });
    const setLocation = vi.fn();
    mockUseLocation.mockReturnValue(['/', setLocation]);

    render(<Home />);

    await waitFor(() => {
      expect(setLocation).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('does not redirect for anonymous users', async () => {
    mockUseAuth.mockReturnValue({ currentUser: null });
    const setLocation = vi.fn();
    mockUseLocation.mockReturnValue(['/', setLocation]);

    render(<Home />);

    await waitFor(() => {
      expect(setLocation).not.toHaveBeenCalled();
    });
  });

  it('scrolls to the contact form when CTA is clicked', () => {
    mockUseAuth.mockReturnValue({ currentUser: null });
    mockUseLocation.mockReturnValue(['/', vi.fn()]);

    render(<Home />);

    const contactForm = document.getElementById('contactForm') as any;
    contactForm.scrollIntoView = vi.fn();

    fireEvent.click(screen.getByText('Start Your AR Journey'));

    expect(contactForm.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
  });
});

