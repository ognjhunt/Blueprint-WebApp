// Mock vitest if not available
const vi = {
  fn: () => jest.fn ? jest.fn() : (() => {}),
  mock: () => {},
  mocked: (fn: any) => fn
};

// Use vitest if available, otherwise use jest-like mock
let mockFramework: any;
try {
  mockFramework = require('vitest');
  mockFramework = mockFramework.vi;
} catch {
  try {
    mockFramework = require('@jest/globals');
    mockFramework = mockFramework.jest;
  } catch {
    mockFramework = vi;
  }
}

// Mock OpenAI
export const mockOpenAIResponsesCreate = mockFramework.fn();
mockFramework.mock('openai', () => ({
  __esModule: true,
  default: mockFramework.fn().mockImplementation(() => ({
    responses: {
      create: mockOpenAIResponsesCreate,
    },
  })),
}));

// Mock Anthropic
export const mockAnthropicMessagesCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  Anthropic: vi.fn().mockImplementation(() => ({
    beta: {
      messages: {
        create: mockAnthropicMessagesCreate,
      },
    },
  })),
}));

// Mock Firebase Admin
export const mockFirestoreSet = vi.fn();
export const mockFirestoreDoc = vi.fn((path?: string) => ({ // Added optional path for debugging/assertion
  set: mockFirestoreSet,
  path: path || 'mock/path', // Store path for assertion if needed
}));
export const mockFirestoreCollection = vi.fn((path?: string) => ({ // Added optional path
  doc: mockFirestoreDoc,
  path: path || 'mock/collection', // Store path
}));
export const mockStorageFileSave = vi.fn();
export const mockStorageFile = vi.fn((path?: string) => ({ // Added optional path
  save: mockStorageFileSave,
  name: path || 'mock/file.txt', // Store path
}));
export const mockStorageBucket = vi.fn((name?: string) => ({
  file: mockStorageFile,
  name: name || 'mock-bucket', // Store bucket name
}));
export const mockFirebaseAdminApps = [{}]; // Simulate an initialized app
export const mockFirebaseInitializeApp = vi.fn();
export const mockFirebaseServerTimestamp = vi.fn(() => 'mock-server-timestamp'); // Mock serverTimestamp

const mockFirestoreInstance = {
  collection: mockFirestoreCollection,
  doc: mockFirestoreDoc,
  // Add any other methods called on a Firestore instance if needed
};

const firestoreStaticProperties = {
  FieldValue: {
    serverTimestamp: mockFirebaseServerTimestamp,
    // Add other static FieldValue properties if used (e.g., arrayUnion, deleteField, etc.)
  },
  // Add other static properties of admin.firestore if used
};

// Mock admin.firestore() to return the instance, and also assign static properties to it.
const mockFirestoreFunction = vi.fn(() => mockFirestoreInstance);
Object.assign(mockFirestoreFunction, firestoreStaticProperties);


vi.mock('firebase-admin', async (importOriginal) => {
  try {
    // We don't strictly need 'original' here if we are fully mocking the used parts.
    // const original = await importOriginal() as any;
    return {
      __esModule: true,
      apps: mockFirebaseAdminApps,
      initializeApp: mockFirebaseInitializeApp,
      firestore: mockFirestoreFunction, // Use the composite mock
      storage: vi.fn(() => ({
        bucket: mockStorageBucket,
      })),
      // Add other services like auth() if needed
    };
  } catch (e) {
    // Fallback if original import fails
    console.error("Failed to import original firebase-admin, using pure mock. Error:", e);
    return {
      __esModule: true,
      apps: mockFirebaseAdminApps,
      initializeApp: mockFirebaseInitializeApp,
      firestore: mockFirestoreFunction, // Still use the composite mock in fallback
      storage: vi.fn(() => ({
        bucket: mockStorageBucket,
      })),
    };
  }
});

// Helper to reset all mocks before each test if needed (can be called in beforeEach)
export function resetAllMocks() {
  mockOpenAIResponsesCreate.mockClear();
  mockAnthropicMessagesCreate.mockClear();

  mockFirestoreSet.mockClear();
  mockFirestoreDoc.mockClear(); // Clears the wrapper fn
  // If mockFirestoreDoc's return value's methods need clearing, do it explicitly:
  // e.g., if mockFirestoreDoc = vi.fn(() => ({ set: vi.fn() })), then clear the inner vi.fn()
  // But here, mockFirestoreSet is cleared, which is what mockFirestoreDoc().set uses.

  mockFirestoreCollection.mockClear(); // Clears the wrapper fn

  mockStorageFileSave.mockClear();
  mockStorageFile.mockClear(); // Clears the wrapper fn
  mockStorageBucket.mockClear(); // Clears the wrapper fn

  mockFirebaseInitializeApp.mockClear();
  mockFirebaseServerTimestamp.mockClear();

  // Resetting apps array to simulate fresh state if needed
  mockFirebaseAdminApps.length = 0;
  mockFirebaseAdminApps.push({});


  // vi.mocked(OpenAI) works if OpenAI is a class/function. Here it's a default export.
  // To clear the constructor mock and its instances' method mocks:
  // 1. Ensure the mock for 'openai' itself is stored if needed.
  //    const actualOpenAIMock = vi.mocked(OpenAI); actualOpenAIMock.mockClear();
  // 2. Clear the specific method mocks like mockOpenAIResponsesCreate, which is already done.
}

// Log to confirm mocks are set up when this file is imported
// console.log('External services mocked from server/tests/mocks/external-services.ts');
