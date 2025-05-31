// Set environment variables first
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
// process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH = 'path/to/mock/serviceAccountKey.json'; // Example

process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
// process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH = 'path/to/mock/serviceAccountKey.json'; // Example

import '../mocks/external-services'; // THEN import mocks to ensure vi.mock is hoisted and applied

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import processMappingConfirmationHandler from '../../routes/mapping-confirmation';
import {
  mockOpenAIResponsesCreate,
  mockFirestoreSet,
  mockFirestoreDoc,
  mockFirestoreCollection,
  mockStorageFileSave,
  mockStorageFile,
  mockStorageBucket,
  mockFirebaseServerTimestamp,
  resetAllMocks,
  // We need to be able to access the mock for firebase-admin's apps array if the handler checks its length
  mockFirebaseAdminApps
} from '../mocks/external-services';

// Note: Actual utility functions (extractors, validators, calculators, prompt builders)
// are imported and used by the handler. Their own unit tests cover their specific logic.
// This test suite focuses on the handler's integration of these utilities and its control flow.

// Helper function to create a mock Express Request object
const mockRequest = (body: any): any => ({ body });

// Helper function to create a mock Express Response object
const mockResponse = (): any => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res); // Chainable status
  res.json = vi.fn().mockReturnValue(res);   // Chainable json
  return res;
};

// Test suite for the processMappingConfirmationHandler API endpoint
describe('processMappingConfirmationHandler API Endpoint', () => {
  let req: any; // To hold the mock request object for each test
  let res: any; // To hold the mock response object for each test

  // Base valid data for mapping confirmation tests
  const validMappingData = {
    company_name: 'Test Biz',
    contact_name: 'Sam Contact',
    contact_phone_number: '555-1212',
    address: '100 Main St, Testville, TS, USA',
    chosen_date_of_mapping: '2025-01-10',
    chosen_time_of_mapping: '10:00',
    estimated_square_footage: 1500, // duration will be 1500/100 + 15 = 30
    company_url: 'http://testbiz.com',
    blueprint_id: 'bp_test123',
  };

  // Expected data structure extracted from a successful Phase 1 AI call
  const phase1ExtractedDataValid = {
    SHEET_ROW_ID: 'sheet_row_abc',
    SHEET_CONTACT_NAME: 'Sam SheetContact',
    SHEET_CONTACT_EMAIL: 'sam.sheet@example.com',
    MAPPING_DURATION_MINUTES: '30', // Matches calculation from 1500 sq ft
    CAR_TRAVEL_MINUTES: '20',
    PUBLIC_TRANSPORT_MINUTES: '30',
    COMPANY_URL_USED: 'http://testbiz.com',
  };

  // Convert phase1ExtractedData into the text format AI would return
  const mockAiResponseTextCall1 = Object.entries(phase1ExtractedDataValid)
    .map(([key, value]) => `${key}:${value}`)
    .join('\n');

  // Mock response text for the second AI call (Phase 2)
  const mockAiResponseTextCall2 = "Deep research markdown output for call 2...";

  // Before each test, set necessary environment variables (safeguard for module-level SDK instantiations),
  // reset all mocks, create a fresh response object, and ensure Firebase mock appears initialized.
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

    resetAllMocks();
    res = mockResponse();

    // Ensure the mockFirebaseAdminApps array indicates an initialized app state
    if (mockFirebaseAdminApps.length === 0) {
        mockFirebaseAdminApps.push({});
    }
  });

  // After each test, clear all mock history and implementations.
  afterEach(() => {
     vi.clearAllMocks();
  });

  // Test case: Successful processing of a valid mapping confirmation request.
  // Covers the "happy path" including two AI calls and Firebase operations.
  test('should process valid mapping confirmation successfully', async () => {
    req = mockRequest(validMappingData);

    // Mock successful responses for both AI calls
    mockOpenAIResponsesCreate
      .mockResolvedValueOnce({ output_text: mockAiResponseTextCall1 }) // For Call 1
      .mockResolvedValueOnce({ output_text: mockAiResponseTextCall2 }); // For Call 2

    mockFirestoreSet.mockResolvedValue({ writeTime: 'mock-time' }); // Firestore success
    mockStorageFileSave.mockResolvedValue(undefined); // Storage success

    await processMappingConfirmationHandler(req, res);

    expect(res.status).not.toHaveBeenCalled(); // Default 200
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        phase1_extracted_data: expect.objectContaining(phase1ExtractedDataValid),
        phase2_summary: mockAiResponseTextCall2,
        firebase_operations_status: expect.objectContaining({
          storage_upload_path: `gs://mock-bucket/blueprints/${validMappingData.blueprint_id}/deep_research_report.md`,
          firestore_update: expect.objectContaining({ success: true }),
          error: null,
        }),
      })
    );
    expect(mockOpenAIResponsesCreate).toHaveBeenCalledTimes(2); // Ensure both AI calls were made
    expect(mockFirestoreSet).toHaveBeenCalledTimes(1);        // Ensure Firestore was updated
    expect(mockStorageFileSave).toHaveBeenCalledTimes(1);     // Ensure file was saved to Storage
  });

  // Test case: Required fields are missing from the request body.
  // Expects a 400 validation error before any external calls are made.
  test('should return 400 if required fields are missing', async () => {
    const invalidData = { ...validMappingData, blueprint_id: undefined }; // blueprint_id is missing
    req = mockRequest(invalidData);

    await processMappingConfirmationHandler(req, res);

    // Assertions for validation failure
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Validation failed',
        errors: expect.arrayContaining([
          expect.objectContaining({ field: 'blueprint_id', message: 'Missing required field: blueprint_id' })
        ]),
      })
    );
    // Ensure no calls to OpenAI or Firebase were made due to validation failure
    expect(mockOpenAIResponsesCreate).not.toHaveBeenCalled();
    expect(mockFirestoreSet).not.toHaveBeenCalled();
    expect(mockStorageFileSave).not.toHaveBeenCalled();
  });

  // Test case: The first OpenAI API call (Phase 1) fails.
  // Expects a 500 error.
  test('should handle OpenAI API failure on Call 1', async () => {
    req = mockRequest(validMappingData);
    const apiError = new Error('OpenAI API Error Call 1');
    mockOpenAIResponsesCreate.mockRejectedValueOnce(apiError); // Simulate failure for the first call

    await processMappingConfirmationHandler(req, res);

    // Assertions for API failure
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Failed to process mapping confirmation',
        details: apiError.message, // Check if the error message is passed in details
      })
    );
  });

  // Test case: The second OpenAI API call (Phase 2) fails after the first one succeeded.
  // Expects a 500 error.
  test('should handle OpenAI API failure on Call 2', async () => {
    req = mockRequest(validMappingData);
    mockOpenAIResponsesCreate
      .mockResolvedValueOnce({ output_text: mockAiResponseTextCall1 }) // Call 1 is successful
      .mockRejectedValueOnce(new Error('OpenAI API Error Call 2'));    // Call 2 fails

    await processMappingConfirmationHandler(req, res);

    // Assertions for API failure on the second call
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Failed to process mapping confirmation',
        details: 'OpenAI API Error Call 2', // Specific error message from the second failure
      })
    );
  });

  // Test case: The AI response from Call 1 is missing essential data (e.g., SHEET_ROW_ID).
  // Expects a 500 error due to inability to proceed.
  test('should handle AI response missing essential data from Call 1 (e.g. SHEET_ROW_ID)', async () => {
    req = mockRequest(validMappingData);
    const malformedPhase1Data = { ...phase1ExtractedDataValid, SHEET_ROW_ID: undefined }; // SHEET_ROW_ID is missing
    // @ts-expect-error because SHEET_ROW_ID is explicitly undefined for this test
    const malformedTextCall1 = Object.entries(malformedPhase1Data)
        .filter(([key, value]) => value !== undefined) // Simulate data missing the key
        .map(([key, value]) => `${key}:${value}`).join('\n');

    mockOpenAIResponsesCreate
        .mockResolvedValueOnce({ output_text: malformedTextCall1 }); // AI returns malformed data

    await processMappingConfirmationHandler(req, res);

    // Assertions for data integrity failure
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
            error: "AI response for Call 1 did not contain the expected structured data. Check prompt and AI output.",
            details: "SHEET_ROW_ID or COMPANY_URL_USED missing from the AI's explicitly formatted output section."
        })
    );
  });

  // Test case: Firebase Storage operation (file.save) fails.
  // Expects the handler to report the error but still return a 200 overall status (as per current logic).
  test('should handle Firebase Storage failure (file.save rejects)', async () => {
    req = mockRequest(validMappingData);
    mockOpenAIResponsesCreate // Both AI calls succeed
      .mockResolvedValueOnce({ output_text: mockAiResponseTextCall1 })
      .mockResolvedValueOnce({ output_text: mockAiResponseTextCall2 });

    const storageError = new Error('Firebase Storage Save Error');
    mockStorageFileSave.mockRejectedValue(storageError); // Storage save operation fails
    mockFirestoreSet.mockResolvedValue({ writeTime: 'mock-time' }); // Firestore operation would succeed

    await processMappingConfirmationHandler(req, res);

    // Assertions for Firebase Storage failure
    expect(res.status).not.toHaveBeenCalled(); // Handler currently completes with 200 even if Firebase ops fail partially
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        firebase_operations_status: expect.objectContaining({
          storage_upload_path: null, // Or undefined, depending on exact implementation
          error: storageError.message, // Storage error message is reported
        }),
      })
    );
  });

  // Test case: Firebase Firestore operation (doc.set) fails.
  // Expects the handler to report the error but still return a 200 overall status.
  test('should handle Firebase Firestore failure (doc.set rejects)', async () => {
    req = mockRequest(validMappingData);
    mockOpenAIResponsesCreate // Both AI calls succeed
      .mockResolvedValueOnce({ output_text: mockAiResponseTextCall1 })
      .mockResolvedValueOnce({ output_text: mockAiResponseTextCall2 });

    const firestoreError = new Error('Firebase Firestore Set Error');
    mockFirestoreSet.mockRejectedValue(firestoreError); // Firestore set operation fails
    mockStorageFileSave.mockResolvedValue(undefined);    // Storage operation would succeed

    await processMappingConfirmationHandler(req, res);

    // Assertions for Firebase Firestore failure
    expect(res.status).not.toHaveBeenCalled(); // Handler currently completes with 200
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        firebase_operations_status: expect.objectContaining({
          firestore_update: expect.objectContaining({ success: false }),
          error: firestoreError.message, // Firestore error message is reported
        }),
      })
    );
  });

  // Test case: blueprint_id is missing. This is caught by the initial validation.
  // Confirms that Firebase operations are not attempted if validation fails.
  test('should skip Firebase operations if blueprint_id is missing (validation catches this first)', async () => {
    const invalidData = { ...validMappingData, blueprint_id: undefined }; // blueprint_id is missing
    req = mockRequest(invalidData);

    await processMappingConfirmationHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400); // Validation failure is expected
    // Ensure Firebase operations were not called
    expect(mockFirestoreSet).not.toHaveBeenCalled();
    expect(mockStorageFileSave).not.toHaveBeenCalled();
  });

  // Test case: The AI response from Call 1 includes extra text around the structured data.
  // Ensures that `extractDataFromAIResponse` can still parse the core data.
  test('should correctly parse AI response from Call 1 even with extra text', async () => {
    req = mockRequest(validMappingData);
    const noisyAiResponseTextCall1 = `Some preamble from AI.\n${mockAiResponseTextCall1}\nSome concluding remarks.`;
    mockOpenAIResponsesCreate
      .mockResolvedValueOnce({ output_text: noisyAiResponseTextCall1 })
      .mockResolvedValueOnce({ output_text: mockAiResponseTextCall2 });
    mockFirestoreSet.mockResolvedValue({ writeTime: 'mock-time' });
    mockStorageFileSave.mockResolvedValue(undefined);

    await processMappingConfirmationHandler(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        phase1_extracted_data: expect.objectContaining(phase1ExtractedDataValid),
      })
    );
  });

});
