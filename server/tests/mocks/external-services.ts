// Simple mock functions that don't depend on external testing frameworks
const createMockFn = () => {
  const fn = (...args: any[]) => {};
  fn.mockClear = () => {};
  fn.mockImplementation = (impl: any) => fn;
  return fn;
};

// Mock OpenAI
export const mockOpenAIResponsesCreate = createMockFn();

// Mock Anthropic
export const mockAnthropicMessagesCreate = createMockFn();

// Mock Firebase Admin
export const mockFirestoreSet = createMockFn();
export const mockFirestoreDoc = createMockFn();
export const mockFirestoreCollection = createMockFn();
export const mockStorageFileSave = createMockFn();
export const mockStorageFile = createMockFn();
export const mockStorageBucket = createMockFn();
export const mockFirebaseAdminApps = [{}];
export const mockFirebaseInitializeApp = createMockFn();
export const mockFirebaseServerTimestamp = createMockFn();

// Simplified mock implementations
export const mockFirebaseAdmin = {
  apps: mockFirebaseAdminApps,
  initializeApp: mockFirebaseInitializeApp,
  firestore: () => ({
    collection: mockFirestoreCollection,
    doc: mockFirestoreDoc,
    FieldValue: {
      serverTimestamp: mockFirebaseServerTimestamp,
    }
  }),
  storage: () => ({
    bucket: mockStorageBucket,
  })
};

// Helper to reset all mocks
export function resetAllMocks() {
  mockOpenAIResponsesCreate.mockClear();
  mockAnthropicMessagesCreate.mockClear();
  mockFirestoreSet.mockClear();
  mockFirestoreDoc.mockClear();
  mockFirestoreCollection.mockClear();
  mockStorageFileSave.mockClear();
  mockStorageFile.mockClear();
  mockStorageBucket.mockClear();
  mockFirebaseInitializeApp.mockClear();
  mockFirebaseServerTimestamp.mockClear();
}