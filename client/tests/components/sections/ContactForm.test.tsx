import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ContactForm from '@/components/sections/ContactForm';

const addDocMock = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 'mockDocId' }));
const loaderLoadMock = vi.hoisted(() => vi.fn().mockResolvedValue(null));
const getGoogleMapsApiKeyMock = vi.hoisted(() => vi.fn(() => null));

vi.mock('@googlemaps/js-api-loader', () => ({
  Loader: vi.fn().mockImplementation(() => ({
    load: loaderLoadMock,
  })),
}));

vi.mock('@/lib/firebase', () => ({
  db: {},
}));
vi.mock('@/lib/client-env', () => ({
  getGoogleMapsApiKey: () => getGoogleMapsApiKeyMock(),
}));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: addDocMock,
  serverTimestamp: vi.fn(),
}));
vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('mock-uuid-token'),
}));

describe('ContactForm', () => {
  const fillForm = (data: {
    name?: string;
    email?: string;
    company?: string;
    message?: string;
  }) => {
    if (data.name !== undefined) {
      fireEvent.change(screen.getByLabelText(/Full Name/i), {
        target: { value: data.name },
      });
    }
    if (data.email !== undefined) {
      fireEvent.change(screen.getByLabelText(/Business Email/i), {
        target: { value: data.email },
      });
    }
    if (data.company !== undefined) {
      fireEvent.change(screen.getByLabelText(/Company Name/i), {
        target: { value: data.company },
      });
    }
    if (data.message !== undefined) {
      fireEvent.change(screen.getByLabelText(/Tell Us About Your Vision/i), {
        target: { value: data.message },
      });
    }
  };

  const clickSubmit = async () => {
    fireEvent.click(
      screen.getByRole('button', { name: /Join AI Pilot Program/i }),
    );
    await waitFor(() => {});
  };

  beforeEach(() => {
    getGoogleMapsApiKeyMock.mockReturnValue(null);
    addDocMock.mockClear();
    loaderLoadMock.mockClear();
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    window.alert = vi.fn();
  });

  describe('validateForm() - through UI interaction', () => {
    it('should show no validation errors for valid data', async () => {
      render(<ContactForm />);
      fillForm({
        name: 'John Doe',
        email: 'john.doe@example.com',
        company: 'Example Corp',
      });
      await clickSubmit();

      expect(screen.queryByText('Name is required')).not.toBeInTheDocument();
      expect(
        screen.queryByText('Valid email is required'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('Company name is required'),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/Welcome to the Future!/i)).toBeInTheDocument();
    });

    it('should show error for empty name', async () => {
      render(<ContactForm />);
      fillForm({ name: '' });
      await clickSubmit();
      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });

    it('should show error for name less than 2 characters', async () => {
      render(<ContactForm />);
      fillForm({ name: 'J' });
      await clickSubmit();
      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });

    it('should show error for invalid email', async () => {
      render(<ContactForm />);
      fillForm({ email: 'invalid-email' });
      await clickSubmit();
      expect(screen.getByText('Valid email is required')).toBeInTheDocument();
    });

    it('should show error for empty email', async () => {
      render(<ContactForm />);
      fillForm({ email: '' });
      await clickSubmit();
      expect(screen.getByText('Valid email is required')).toBeInTheDocument();
    });

    it('should show error for empty company', async () => {
      render(<ContactForm />);
      fillForm({ company: '' });
      await clickSubmit();
      expect(screen.getByText('Company name is required')).toBeInTheDocument();
    });

    it('should show error for company name less than 2 chars', async () => {
      render(<ContactForm />);
      fillForm({ company: 'C' });
      await clickSubmit();
      expect(screen.getByText('Company name is required')).toBeInTheDocument();
    });

    it('should show multiple errors for multiple empty fields', async () => {
      render(<ContactForm />);
      await clickSubmit();
      expect(screen.getByText('Name is required')).toBeInTheDocument();
      expect(screen.getByText('Valid email is required')).toBeInTheDocument();
      expect(screen.getByText('Company name is required')).toBeInTheDocument();
    });
  });

  describe('handleSubmit()', () => {
    it('should not submit if validation fails', async () => {
      render(<ContactForm />);
      await clickSubmit();
      expect(addDocMock).not.toHaveBeenCalled();
    });

    it('should call Firestore and API on successful submission', async () => {
      render(<ContactForm />);
      fillForm({
        name: 'John Doe',
        email: 'john.doe@example.com',
        company: 'Example Corp',
      });

      await clickSubmit();

      expect(addDocMock).toHaveBeenCalledTimes(3);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/contact-webhook',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    it('should surface submission errors when Firestore fails', async () => {
      addDocMock.mockRejectedValueOnce(new Error('Firestore down'));
      render(<ContactForm />);
      fillForm({
        name: 'John Doe',
        email: 'john.doe@example.com',
        company: 'Example Corp',
      });

      await clickSubmit();

      expect(window.alert).toHaveBeenCalledWith(
        expect.stringContaining('Firestore down'),
      );
    });

    it('should show success message and clear form on success', async () => {
      render(<ContactForm />);
      fillForm({
        name: 'John Doe',
        email: 'john.doe@example.com',
        company: 'Example Corp',
      });

      await clickSubmit();

      expect(screen.getByText(/Welcome to the Future!/i)).toBeInTheDocument();

      fireEvent.click(
        screen.getByRole('button', { name: /Submit Another Request/i }),
      );

      expect(screen.getByLabelText(/Full Name/i)).toHaveValue('');
      expect(screen.getByLabelText(/Business Email/i)).toHaveValue('');
      expect(screen.getByLabelText(/Company Name/i)).toHaveValue('');
    });
  });

  describe('Google Places Autocomplete integration', () => {
    it('loads the Google Places client when an API key is provided', async () => {
      getGoogleMapsApiKeyMock.mockReturnValue('test-key');

      global.google = {
        maps: {
          places: {
            AutocompleteService: class {
              getPlacePredictions() {}
            },
            PlacesService: class {},
            PlacesServiceStatus: { OK: 'OK' },
          },
        },
      } as never;

      render(<ContactForm />);

      await waitFor(() => {
        expect(loaderLoadMock).toHaveBeenCalled();
      });
    });
  });
});
