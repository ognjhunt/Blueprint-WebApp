import React from 'react';
import { render, fireEvent, waitFor, screen, act } from '@testing-library/react';
import SettingsPage from '@/pages/Settings'; // Adjust path as necessary
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import * as firebaseFirestore from 'firebase/firestore';
import * as firebaseStorage from 'firebase/storage';

// Mock wouter
jest.mock('wouter', () => ({
  useLocation: jest.fn().mockReturnValue([null, jest.fn()]),
}));

// Mock useAuth
const mockCurrentUser = {
  uid: 'test-user-uid',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: 'http://example.com/photo.jpg',
};
jest.mock('@/contexts/AuthContext', () => ({
  ...jest.requireActual('@/contexts/AuthContext'),
  useAuth: () => ({
    currentUser: mockCurrentUser,
    // Add other auth context values if needed by Settings component
  }),
}));

// Mock useToast
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

// Mock Firebase Firestore
const mockGetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
  ...jest.requireActual('firebase/firestore'),
  doc: jest.fn((db, collection, id) => ({ path: `\${collection}/\${id}` })), // Mock doc to return a simple object
  getDoc: (...args) => mockGetDoc(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
}));

// Mock Firebase Storage
const mockStorageRef = jest.fn();
const mockUploadBytesResumable = jest.fn();
const mockGetDownloadURL = jest.fn();
jest.mock('firebase/storage', () => ({
  ...jest.requireActual('firebase/storage'),
  ref: (...args) => mockStorageRef(...args),
  uploadBytesResumable: (...args) => mockUploadBytesResumable(...args),
  getDownloadURL: (...args) => mockGetDownloadURL(...args),
  storage: {}, // Mock storage object if Settings.jsx imports it directly
}));


describe('Settings Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Provide a default mock implementation for getDoc to prevent errors in tests that don't explicitly set it.
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        displayName: 'Default User',
        email: 'default@example.com',
        photoURL: 'http://example.com/default.jpg',
        bio: 'Default bio',
        jobTitle: 'Default Job',
        company: 'Default Company',
        timeZone: 'UTC',
        language: 'en',
        phoneNumber: '123-456-7890',
        planType: 'free',
        accountSettings: { email2FA: false, sms2FA: false, securityAlerts: true, loginAttempts: true },
        notificationSettings: { emailNotifications: true, pushNotifications: true, blueprintChanges: true, teamUpdates: true, usageAlerts: true, marketingEmails: false, weeklyDigest: true, securityNotifications: true },
        apiKeys: [],
        integrations: [],
      }),
    });
  });

  const renderSettingsPage = async () => {
    let utils;
    // Use act to ensure all initial effects run
    await act(async () => {
      utils = render(
        // AuthProvider might not be strictly necessary if useAuth is fully mocked,
        // but good for completeness if SettingsPage has deeper dependencies.
        <AuthProvider>
          <SettingsPage />
        </AuthProvider>
      );
    });
    // Wait for loading to complete (assuming SettingsPage has a loading state or async operations on mount)
    // If SettingsPage shows "Loading..." text, you can use:
    // await waitFor(() => expect(screen.queryByText(/loading/i)).toBeNull(), { timeout: 3000 });
    // For now, let's assume a short delay for initial data fetching mock to resolve
    await act(() => new Promise(resolve => setTimeout(resolve, 50))); // Small delay for async effects
    return utils;
  };


  describe('Fetching User Settings', () => {
    it('should fetch and display user settings on mount', async () => {
      const fetchedData = {
        displayName: 'Fetched User',
        email: 'fetched@example.com', // Email is from currentUser, but other fields from DB
        photoURL: 'http://example.com/fetched.jpg',
        bio: 'Fetched bio',
        jobTitle: 'Fetched Job',
        company: 'Fetched Company',
        timeZone: 'America/New_York',
        language: 'es',
        phoneNumber: '987-654-3210',
        accountSettings: { email2FA: true, sms2FA: false, securityAlerts: false, loginAttempts: true },
        notificationSettings: { emailNotifications: false, pushNotifications: true, marketingEmails: true, weeklyDigest: false },
        // apiKeys and integrations will be tested separately if populated
      };
      mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => fetchedData });

      await renderSettingsPage();

      // Wait for the specific data to appear
      await waitFor(() => {
        expect(screen.getByLabelText(/full name/i)).toHaveValue(fetchedData.displayName);
      });
      expect(screen.getByLabelText(/email/i)).toHaveValue(mockCurrentUser.email); // Email comes from currentUser
      expect(screen.getByLabelText(/bio/i)).toHaveValue(fetchedData.bio);
      expect(screen.getByLabelText(/job title/i)).toHaveValue(fetchedData.jobTitle);
      expect(screen.getByLabelText(/company/i)).toHaveValue(fetchedData.company);
      expect(screen.getByLabelText(/phone number/i)).toHaveValue(fetchedData.phoneNumber);

      // Check a few specific settings
      // Need to find a way to check Select components' values if not directly by label
      // For Switches, check their state
      // This requires elements to be uniquely identifiable, e.g., by aria-label or data-testid
      // For now, we confirm getDoc was called. Detailed field checks might need more specific selectors.
      expect(mockGetDoc).toHaveBeenCalled();
    });

    it('should handle missing user document by using defaults (from currentUser or predefined)', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false, data: () => null });
      await renderSettingsPage();

      await waitFor(() => {
         // Check if it falls back to currentUser's displayName or empty string
        expect(screen.getByLabelText(/full name/i)).toHaveValue(mockCurrentUser.displayName || '');
      });
      expect(screen.getByLabelText(/email/i)).toHaveValue(mockCurrentUser.email);
      // Other fields should have their default initial values from the component's state
      expect(screen.getByLabelText(/bio/i)).toHaveValue('');
    });
  });

  describe('Saving User Settings', () => {
    it('should save updated profile settings', async () => {
      await renderSettingsPage();

      const newName = 'Updated Name';
      const newBio = 'Updated Bio';

      fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: newName } });
      fireEvent.change(screen.getByLabelText(/bio/i), { target: { value: newBio } });

      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await act(async () => {
        fireEvent.click(screen.getAllByRole('button', { name: /save changes/i })[0]); // Assuming first save button is for profile
      });

      await waitFor(() => {
        expect(mockUpdateDoc).toHaveBeenCalledWith(
          expect.anything(), // Firestore doc ref
          expect.objectContaining({
            displayName: newName,
            bio: newBio,
            // other fields from profileSettings state should also be here
          })
        );
      });
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Settings updated',
        description: 'Your settings have been saved successfully.',
      });
    });

    it('should save updated account settings (e.g., 2FA)', async () => {
        await renderSettingsPage();
        // Click on "Account" tab if not already active
        // This depends on how tabs are implemented. For now, assume it's accessible or default.
        // If using ShadCN tabs, they are role="tab"
        const accountTab = screen.getByRole('tab', { name: /account/i });
        fireEvent.click(accountTab);

        // Wait for the content of the account tab to be visible
        // Example: find a switch for Email 2FA. This requires the switch to be identifiable.
        // Let's assume the switch for Email Authentication has a unique role or accessible name.
        // For ShadCN Switch, it's role="switch" and can be found by its associated label.
        let email2FASwitch;
        await waitFor(() => {
            // The label "Email Authentication" is inside a div, not directly labeling the switch.
            // We need a more robust selector, or to add data-testid to the switch.
            // For now, let's assume we can get it by finding its label text and then the switch.
            const labelElement = screen.getByText("Email Authentication").closest('div.flex');
            if (labelElement) {
                 email2FASwitch = labelElement.querySelector('[role="switch"]');
            }
            expect(email2FASwitch).toBeInTheDocument();
        });

        const initialChecked = email2FASwitch.getAttribute('aria-checked') === 'true';

        fireEvent.click(email2FASwitch); // Toggle the switch

        mockUpdateDoc.mockResolvedValueOnce(undefined);

        // There might be multiple "Save Changes" buttons if each section has one.
        // Ensure we click the correct one, or that there's a global save.
        // Based on Settings.jsx, there's a save button in each section's CardHeader.
        // Let's find the one in the Account section.
        const accountSaveButton = screen.getByRole('button', { name: /save changes/i });
        // This might need to be more specific if multiple save buttons are rendered.
        // For now, assuming there's one visible save button after switching tab.

        await act(async () => {
            fireEvent.click(accountSaveButton);
        });

        await waitFor(() => {
            expect(mockUpdateDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    accountSettings: expect.objectContaining({
                        email2FA: !initialChecked, // The toggled value
                    }),
                })
            );
        });
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Settings updated' }));
    });


    it('should show an error toast if saving settings fails', async () => {
      await renderSettingsPage();
      const errorMessage = 'Failed to save';
      mockUpdateDoc.mockRejectedValueOnce(new Error(errorMessage));

      fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Test Save Fail' } });

      await act(async () => {
        fireEvent.click(screen.getAllByRole('button', { name: /save changes/i })[0]);
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error saving settings',
          description: 'There was a problem saving your settings. Please try again.',
          variant: 'destructive',
        });
      });
    });
  });

  describe('Profile Picture Upload', () => {
    it('should upload a new profile picture and update user photoURL', async () => {
      await renderSettingsPage();

      const file = new File(['(⌐□_□)'], 'chucknorris.png', { type: 'image/png' });
      const downloadURL = 'http://example.com/new-photo.jpg';

      // Mock storage functions
      const mockUploadTask = {
        on: jest.fn((event, progressCb, errorCb, completeCb) => {
          if (event === 'state_changed') {
            // Simulate some progress
            progressCb({ bytesTransferred: 50, totalBytes: 100 });
            // Simulate completion
            completeCb();
          }
          return jest.fn(); // Return unsubscribe function
        }),
        snapshot: { ref: 'mockRef' },
      };
      (firebaseStorage.uploadBytesResumable as jest.Mock).mockReturnValue(mockUploadTask);
      (firebaseStorage.getDownloadURL as jest.Mock).mockResolvedValue(downloadURL);
      mockUpdateDoc.mockResolvedValueOnce(undefined); // For updating user doc

      // Find the hidden file input. The button itself doesn't have 'Upload profile picture' as accessible name.
      // We need to click the button that triggers the file input.
      // Let's assume the button has an aria-label or is found by its visual icon if possible.
      // For now, we'll find the button that triggers the hidden input.
      // The button is an Avatar with an Upload icon.
      const uploadButton = screen.getByRole('button', { name: /upload profile picture/i }); // The button around the Avatar

      // The actual file input is hidden. We need to mock its 'files' property.
      const fileInput = uploadButton.parentElement.querySelector('input[type="file"]');


      await act(async () => {
        // Simulate file selection
         Object.defineProperty(fileInput, 'files', {
          value: [file],
        });
        fireEvent.change(fileInput); // Trigger the change event
      });

      await waitFor(() => {
        expect(firebaseStorage.uploadBytesResumable).toHaveBeenCalledWith(expect.anything(), file);
      });
      await waitFor(() => {
        expect(firebaseStorage.getDownloadURL).toHaveBeenCalledWith('mockRef');
      });
      await waitFor(() => {
        expect(mockUpdateDoc).toHaveBeenCalledWith(
          expect.anything(), // User doc ref
          { photoURL: downloadURL }
        );
      });
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Profile Picture Updated',
          description: 'Your new profile picture has been saved.',
        });
      });

      // Verify avatar image source is updated (this depends on how AvatarImage src is bound)
      // const avatarImg = screen.getByAltText(mockCurrentUser.displayName).closest('img');
      // await waitFor(() => expect(avatarImg).toHaveAttribute('src', downloadURL));
    });

    it('should show an error if non-image file is selected', async () => {
      await renderSettingsPage();
      const file = new File(['text content'], 'document.txt', { type: 'text/plain' });

      const uploadButton = screen.getByRole('button', { name: /upload profile picture/i });
      const fileInput = uploadButton.parentElement.querySelector('input[type="file"]');

      await act(async () => {
        Object.defineProperty(fileInput, 'files', { value: [file] });
        fireEvent.change(fileInput);
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Invalid File Type',
          description: 'Please select an image file (e.g., JPG, PNG, GIF).',
          variant: 'destructive',
        });
      });
      expect(firebaseStorage.uploadBytesResumable).not.toHaveBeenCalled();
    });
  });

  describe('API Key Management (Simulated - State Change)', () => {
    it('should add a new API key to the list (state change)', async () => {
        await renderSettingsPage();

        // Navigate to API & Integrations tab
        const apiTab = screen.getByRole('tab', { name: /api & integrations/i });
        fireEvent.click(apiTab);

        let generateKeyButton;
        await waitFor(() => {
            generateKeyButton = screen.getByRole('button', { name: /generate new key/i });
            expect(generateKeyButton).toBeInTheDocument();
        });
        fireEvent.click(generateKeyButton); // This opens the AlertDialog

        // Dialog interactions
        let keyNameInput;
        await waitFor(() => {
            keyNameInput = screen.getByLabelText(/key name/i);
            expect(keyNameInput).toBeInTheDocument();
        });
        fireEvent.change(keyNameInput, { target: { value: 'Test API Key' } });

        const confirmGenerateButton = screen.getByRole('button', { name: /generate key/i });
        fireEvent.click(confirmGenerateButton);

        await waitFor(() => {
            expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'API Key generated' }));
        });

        // Now, save the settings to persist this change
        mockUpdateDoc.mockResolvedValueOnce(undefined);
        const saveButton = screen.getAllByRole('button', { name: /save changes/i })[0]; // Assuming global save or visible save in section
        await act(async () => {
            fireEvent.click(saveButton);
        });

        await waitFor(() => {
            expect(mockUpdateDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    apiKeys: expect.arrayContaining([
                        expect.objectContaining({ name: 'Test API Key' })
                    ])
                })
            );
        });
    });
  });

});
