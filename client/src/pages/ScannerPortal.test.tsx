import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ScannerPortal from './ScannerPortal'; // Adjust path as needed
import { AuthProvider } from '@/contexts/AuthContext';
import { MemoryRouter } from 'wouter';

// --- Mocks ---

// Mock child components
vi.mock('@/components/Nav', () => ({ default: () => <div data-testid="nav-mock" /> }));
vi.mock('@/components/Footer', () => ({ default: () => <div data-testid="footer-mock" /> }));
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }) => open ? <div data-testid="dialog-mock">{children}</div> : null,
  DialogTrigger: ({ children }) => <div data-testid="dialog-trigger-mock">{children}</div>,
  DialogContent: ({ children }) => <div data-testid="dialog-content-mock">{children}</div>,
  DialogHeader: ({ children }) => <div data-testid="dialog-header-mock">{children}</div>,
  DialogTitle: ({ children }) => <div data-testid="dialog-title-mock">{children}</div>,
  DialogDescription: ({ children }) => <div data-testid="dialog-description-mock">{children}</div>,
  DialogFooter: ({ children }) => <div data-testid="dialog-footer-mock">{children}</div>,
  DialogClose: ({ children }) => <button data-testid="dialog-close-mock">{children}</button>,
}));
vi.mock('@/components/ui/button', () => ({ Button: ({ children, ...props }) => <button {...props}>{children}</button> }));
vi.mock('@/components/ui/input', () => ({ Input: (props) => <input {...props} /> }));
vi.mock('@/components/ui/label', () => ({ Label: ({ children, ...props }) => <label {...props}>{children}</label> }));
vi.mock('@/components/ui/progress', () => ({ Progress: (props) => <div data-testid="progress-mock" {...props} /> }));
vi.mock('@/components/ui/select', () => ({
    Select: ({ children }) => <div data-testid="select-mock">{children}</div>,
    SelectTrigger: ({ children }) => <div data-testid="select-trigger-mock">{children}</div>,
    SelectValue: ({ placeholder }) => <span data-testid="select-value-mock">{placeholder}</span>,
    SelectContent: ({ children }) => <div data-testid="select-content-mock">{children}</div>,
    SelectItem: ({ children, value }) => <div data-testid={`select-item-${value}`}>{children}</div>,
}));
vi.mock('@/components/ui/card', () => ({
    Card: ({ children, ...props }) => <div data-testid="card-mock" {...props}>{children}</div>,
    CardHeader: ({ children }) => <div data-testid="card-header-mock">{children}</div>,
    CardTitle: ({ children }) => <div data-testid="card-title-mock">{children}</div>,
    CardDescription: ({ children }) => <div data-testid="card-description-mock">{children}</div>,
    CardContent: ({ children }) => <div data-testid="card-content-mock">{children}</div>,
    CardFooter: ({ children }) => <div data-testid="card-footer-mock">{children}</div>,
}));
vi.mock('@/components/ui/badge', () => ({ Badge: ({children}) => <span data-testid="badge-mock">{children}</span>}));


// Mock AuthContext
const mockCurrentUser = { uid: 'test-user-id', email: 'test@example.com', displayName: 'Test User' };
vi.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => <div data-testid="mock-auth-provider">{children}</div>,
  useAuth: () => ({
    currentUser: mockCurrentUser,
    loading: false,
    // Add other functions/values if needed by ScannerPortal
  }),
}));

// Define mock functions BEFORE they are used in vi.mock factory
const mockDoc = vi.fn();
const mockCollection = vi.fn();
const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockArrayUnion = vi.fn();
const mockServerTimestamp = vi.fn();
const mockGetDocs = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockOnSnapshot = vi.fn();

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual('firebase/firestore'); // Keep if you need other non-mocked fs functions
  return {
    ...actual, // Spread actual to keep any other exports from 'firebase/firestore'
    doc: (...args) => mockDoc(...args), // Call the hoisted function
    collection: (...args) => mockCollection(...args),
    addDoc: (...args) => mockAddDoc(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
    setDoc: (...args) => mockSetDoc(...args),
    arrayUnion: (...args) => mockArrayUnion(...args),
    serverTimestamp: (...args) => mockServerTimestamp(...args),
    getDocs: (...args) => mockGetDocs(...args),
    query: (...args) => mockQuery(...args),
    where: (...args) => mockWhere(...args),
    onSnapshot: (...args) => mockOnSnapshot(...args),
  };
});

// Define Firebase Storage mock functions BEFORE vi.mock factory
const mockStorageRef = vi.fn();
const mockUploadBytesResumable = vi.fn();
const mockGetDownloadURL = vi.fn();

vi.mock('firebase/storage', async () => {
  const actual = await vi.importActual('firebase/storage');
  return {
    ...actual,
    ref: (...args) => mockStorageRef(...args),
    uploadBytesResumable: (...args) => mockUploadBytesResumable(...args),
    getDownloadURL: (...args) => mockGetDownloadURL(...args),
  };
});

// Mock @/lib/firebase (db and auth)
vi.mock('@/lib/firebase', () => ({
  db: { app: { name: '[DEFAULT]' } }, // Mock db object as expected by firestore functions
  auth: {},
}));


// Mock react-hot-toast (useToast)
const mockToast = vi.fn();
vi.mock('react-hot-toast', async () => {
    const actual = await vi.importActual('react-hot-toast');
    return {
        ...actual,
        toast: {
            ...actual.toast,
            success: mockToast,
            error: mockToast,
            loading: mockToast,
            custom: mockToast,
            dismiss: mockToast,
            promise: mockToast,
        },
        useToaster: () => ({ // if useToaster is used directly
            toasts: [],
            handlers: { calculateOffset: vi.fn(), updateHeight: vi.fn(), startPause: vi.fn(), endPause: vi.fn() }
        }),
        Toaster: () => <div data-testid="toaster-mock" /> // Mock Toaster component
    };
});
vi.mock('@/hooks/use-toast', () => ({ // If there's a custom hook like this
    useToast: () => ({
        toast: mockToast,
    }),
}));


// Mock global fetch for Lindy AI
global.fetch = vi.fn();

// Spy on window.alert and window.history.replaceState (if needed, not in plan for ScannerPortal yet)
// const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

// Mock crypto.randomUUID
const mockUUID = 'mock-uuid-12345';
vi.stubGlobal('crypto', {
  ...global.crypto,
  randomUUID: vi.fn(() => mockUUID),
});


// --- Test Suite ---
describe('ScannerPortal', () => {
  const mockBookings = [
    { id: 'booking1', customerName: 'Alice Wonderland', status: 'pending_upload', blueprintId: 'bp1', userId: 'user1', propertyAddress: '123 Main St' },
    { id: 'booking2', customerName: 'Bob The Builder', status: 'pending_upload', userId: 'user2', propertyAddress: '456 Oak Ave' }, // No blueprintId
  ];

  // Re-initialize implementations in beforeEach - MOVED INSIDE DESCRIBE
  beforeEach(async () => {
    vi.clearAllMocks();

    mockDoc.mockImplementation((db, collectionPath, id) => ({
      _path: `${collectionPath}/${id}`,
      id: id,
    }));
    mockCollection.mockImplementation((db, collectionPath) => ({
      _path: collectionPath,
      id: collectionPath,
    }));
    mockArrayUnion.mockImplementation((...args) => args);
    mockServerTimestamp.mockImplementation(() => new Date());
    mockOnSnapshot.mockImplementation(() => () => {});

    // Firebase Storage mock implementations
    mockStorageRef.mockImplementation((storage, path) => ({
      name: path.substring(path.lastIndexOf('/') + 1),
      fullPath: path,
      toString: () => path,
    }));
    mockUploadBytesResumable.mockImplementation((storageRef, file) => ({
      on: (event, progress, error, complete) => {
        setTimeout(() => complete(), 0);
      },
      snapshot: { totalBytes: 100, bytesTransferred: 100, ref: storageRef },
    }));
    mockGetDownloadURL.mockImplementation(async (ref) => `mock-url-for-${ref.name}`);

    // Mock getDocs for bookings
    mockGetDocs.mockResolvedValue({
        docs: mockBookings.map(b => ({ id: b.id, data: () => b, exists: () => true })),
        empty: false,
    });

    // Mock fetch for Lindy AI
    fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ summary: 'AI summary complete' }),
    });
  });

  const renderScannerPortal = () => {
    return render(
      <MemoryRouter>
        <AuthProvider>
          <ScannerPortal />
        </AuthProvider>
      </MemoryRouter>
    );
  };

  describe('handleUpload()', () => {
    it('Successful upload (model and floorplan, existing blueprintId)', async () => {
      const selectedBooking = mockBookings[0]; // Has blueprintId: 'bp1'
      renderScannerPortal();

      // 1. Select a booking
      await act(async () => {
        fireEvent.click(screen.getByText('Select Booking'));
      });
      await waitFor(() => expect(screen.getByTestId(`select-item-${selectedBooking.id}`)).toBeInTheDocument());
      await act(async () => {
          fireEvent.click(screen.getByTestId(`select-item-${selectedBooking.id}`));
      });
      await waitFor(() => expect(screen.getByText(selectedBooking.customerName)).toBeInTheDocument());

      // 2. Open upload dialog
      await act(async () => {
        fireEvent.click(screen.getByText('Upload Files'));
      });
      await waitFor(() => expect(screen.getByTestId('dialog-title-mock')).toHaveTextContent('Upload Scan Files'));

      // 3. Simulate file selection
      const modelFile = new File(['model data'], 'model.glb', { type: 'model/gltf-binary' });
      const floorplanFile = new File(['floorplan data'], 'floorplan.png', { type: 'image/png' });

      const modelInput = screen.getByLabelText(/3D Model/i) as HTMLInputElement;
      const floorplanInput = screen.getByLabelText(/Floor Plan Image/i) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(modelInput, { target: { files: [modelFile] } });
        fireEvent.change(floorplanInput, { target: { files: [floorplanFile] } });
      });

      // 4. Trigger upload
      const uploadButton = screen.getByRole('button', { name: 'Upload & Align' });
      await act(async () => {
        fireEvent.click(uploadButton);
      });

      // 5. Assertions
      await waitFor(() => expect(mockUploadBytesResumable).toHaveBeenCalledTimes(2));
      expect(mockUploadBytesResumable).toHaveBeenCalledWith(expect.objectContaining({ fullPath: expect.stringContaining(`scans/${selectedBooking.id}/${modelFile.name}`) }), modelFile, expect.any(Object));
      expect(mockUploadBytesResumable).toHaveBeenCalledWith(expect.objectContaining({ fullPath: expect.stringContaining(`scans/${selectedBooking.id}/${floorplanFile.name}`) }), floorplanFile, expect.any(Object));

      await waitFor(() => expect(mockGetDownloadURL).toHaveBeenCalledTimes(2));

      // Firestore addDoc for scan record
      await waitFor(() => {
        expect(mockAddDoc).toHaveBeenCalledWith(
          expect.objectContaining({ _path: `blueprints/${selectedBooking.blueprintId}/scans` }),
          expect.objectContaining({
            status: 'ready',
            modelUrl: `mock-url-for-${modelFile.name}`,
            floorplanUrl: `mock-url-for-${floorplanFile.name}`,
            createdAt: expect.any(Date),
            originalModelName: modelFile.name,
            originalFloorplanName: floorplanFile.name,
          })
        );
      });

      // Firestore updateDoc for booking status
      await waitFor(() => {
        expect(mockUpdateDoc).toHaveBeenCalledWith(
          expect.objectContaining({ _path: `bookings/${selectedBooking.id}` }),
          { status: 'processing', scanId: mockAddDoc.mock.results[0].value.id } // Assuming addDoc returns an object with id
        );
      });

      // Firestore updateDoc for blueprint
      const expectedBlueprintPath = `blueprints/${selectedBooking.blueprintId}`;
      await waitFor(() => {
          const updateCallsToBlueprint = mockUpdateDoc.mock.calls.filter(call => call[0]._path === expectedBlueprintPath);
          expect(updateCallsToBlueprint.length).toBeGreaterThanOrEqual(1);
          expect(updateCallsToBlueprint[0][1]).toEqual(expect.objectContaining({
            floorPlan3DUrl: `mock-url-for-${modelFile.name}`,
            floorPlanUrl: `mock-url-for-${floorplanFile.name}`,
            scanCompleted: false, // Initially false
            uploadedFiles: mockArrayUnion(
                expect.stringContaining(modelFile.name),
                expect.stringContaining(floorplanFile.name)
            ),
          }));
      });

      // Firestore updateDoc for user's createdBlueprintIDs (should only happen if blueprintId was new, so not here)
      // This assertion needs refinement based on actual logic for *existing* blueprintId
      // For now, ensure it's NOT called to add THIS blueprintId again if it already exists.
      // This part of the test will be tricky without knowing the user's initial createdBlueprintIDs.
      // We'll assume for an existing blueprint, it's not re-added.

      // Lindy AI Fetch call
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('lindy.ai'), expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(expect.objectContaining({
            propertyAddress: selectedBooking.propertyAddress,
            // other expected properties
          }))
        }));
      });

      // Toast notification
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
          title: 'Upload Complete',
          description: 'Files uploaded successfully. Preparing alignment tool...',
        }));
      });

      // Verify dialog closes and alignment wizard opens (e.g., check for wizard title)
      // This depends on how the alignment wizard is identified.
      // For now, we'll assume the upload dialog closes.
      // await waitFor(() => expect(screen.queryByTestId('dialog-title-mock')).not.toBeInTheDocument()); // This might be too fast
      // A better check would be for an element specific to the alignment wizard.
       await waitFor(() => {
        expect(screen.getByText(/Align 3D Model with Floor Plan/i)).toBeInTheDocument();
      });
    });

    // More handleUpload tests will go here
  });

  // Test suites for Alignment Core Logic will follow
});
