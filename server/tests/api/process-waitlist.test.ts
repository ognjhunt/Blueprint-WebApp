// Set environment variables before any imports that might use them
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key'; // If anthropic client is also instantiated at module level

import '../mocks/external-services'; // Import mocks first to ensure vi.mock is hoisted and applied
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import processWaitlistHandler from '../../routes/process-waitlist';
import {
  mockOpenAIResponsesCreate,
  // mockAnthropicMessagesCreate, // Not currently used by the active code path in handler
  resetAllMocks
} from '../mocks/external-services';
// No need to mock validateWaitlistData or buildWaitlistAIProomp as they are part of the flow being tested.

// Helper function to create a mock Express Request object
const mockRequest = (body: any): any => ({ body });

// Helper function to create a mock Express Response object
const mockResponse = (): any => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res); // Chainable status
  res.json = vi.fn().mockReturnValue(res);   // Chainable json
  return res;
};

// Test suite for the processWaitlistHandler API endpoint
describe('processWaitlistHandler API Endpoint', () => {
  let req: any; // To hold the mock request object for each test
  let res: any; // To hold the mock response object for each test

  // Base valid data for testing the waitlist handler
  const validWaitlistData = {
    name: 'Test User Valid', // Ensure it's defined for split
    email: 'valid@example.com',
    company: 'TestCorp',
    city: 'Testville',
    state: 'TS',
    message: 'Hello Blueprint',
    companyWebsite: 'http://testcorp.com',
    companyAddress: '123 Test St',
    offWaitlistUrl: 'http://blueprint.com/signup',
  };

  // Before each test, reset all mocks and create a fresh response object
  beforeEach(() => {
    resetAllMocks();
    res = mockResponse();
    // Environment variables for API keys are set at the top of the file
  });

  // After each test, clear all mock call history and implementations
  afterEach(() => {
    vi.clearAllMocks();
  });

  // Test case: Successful processing of a valid waitlist signup using OpenAI.
  test('should handle valid waitlist signup successfully (OpenAI)', async () => {
    req = mockRequest(validWaitlistData);
    const mockAiResponse = { output_text: "MCP tasks completed successfully." }; // Simulate a successful AI response
    mockOpenAIResponsesCreate.mockResolvedValue(mockAiResponse); // Configure the mock for OpenAI

    await processWaitlistHandler(req, res); // Execute the handler

    // Assertions
    expect(res.status).not.toHaveBeenCalled(); // Expect default 200 OK, so status not explicitly set
    expect(res.json).toHaveBeenCalledWith({ success: true, response: mockAiResponse });
    expect(mockOpenAIResponsesCreate).toHaveBeenCalledTimes(1); // Ensure OpenAI API was called once

    // Optionally, verify details of the prompt passed to OpenAI
    const expectedPromptContent = `Blueprint Waitlist Automation: Process new signup for ${validWaitlistData.name} from ${validWaitlistData.company}.`;
    expect(mockOpenAIResponsesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'o4-mini', // Check if the correct model is used
        input: expect.stringContaining(expectedPromptContent), // Check if prompt contains key info
      })
    );
  });

  // Test case: Name field is missing. Expect a 400 error.
  test('should return 400 if name is missing', async () => {
    const invalidData = { ...validWaitlistData, name: undefined };
    req = mockRequest(invalidData);
    await processWaitlistHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: "Validation failed",
      errors: expect.arrayContaining([expect.objectContaining({ field: 'name', message: 'Missing required field: name' })]),
    }));
    expect(mockOpenAIResponsesCreate).not.toHaveBeenCalled();
  });

  // Test case: Email field has an invalid format. Expect a 400 error.
  test('should return 400 if email is an invalid format', async () => {
    const invalidData = { ...validWaitlistData, email: "invalid-email-format" };
    req = mockRequest(invalidData);
    await processWaitlistHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: "Validation failed",
      errors: expect.arrayContaining([expect.objectContaining({ field: 'email', message: 'Invalid email format.' })]),
    }));
    expect(mockOpenAIResponsesCreate).not.toHaveBeenCalled();
  });

  // Test case: Multiple required fields are missing. Expect a 400 error with multiple error objects.
  test('should return 400 if multiple required fields are missing', async () => {
    const invalidData = {
        company: "Only Corp", // Only company is provided
        // name, email, city, state, offWaitlistUrl are missing
    };
    req = mockRequest(invalidData);
    await processWaitlistHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    const responseJson = res.json.mock.calls[0][0];
    expect(responseJson.error).toBe('Validation failed');
    // Expecting 5 errors: name, email, city, state, offWaitlistUrl
    expect(responseJson.errors.length).toBe(5);
    expect(responseJson.errors.find((e:any) => e.field === 'name')).toBeDefined();
    expect(responseJson.errors.find((e:any) => e.field === 'email')).toBeDefined();
    expect(responseJson.errors.find((e:any) => e.field === 'city')).toBeDefined();
    expect(responseJson.errors.find((e:any) => e.field === 'state')).toBeDefined();
    expect(responseJson.errors.find((e:any) => e.field === 'offWaitlistUrl')).toBeDefined();
    expect(mockOpenAIResponsesCreate).not.toHaveBeenCalled();
  });

  // Test case: OpenAI API call fails after successful validation.
  // Expects a 500 error.
  test('should return 500 if OpenAI API call fails (after successful validation)', async () => {
    req = mockRequest(validWaitlistData);
    const apiError = new Error('OpenAI API Error');
    mockOpenAIResponsesCreate.mockRejectedValue(apiError); // Simulate API call rejection

    await processWaitlistHandler(req, res);

    // Assertions
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to process waitlist signup' });
    expect(mockOpenAIResponsesCreate).toHaveBeenCalledTimes(1); // Ensure it was called
  });

  // The previous placeholder test for "eventually return 400" is now covered by the specific validation tests above.
  // The test 'should currently call OpenAI even if required fields are missing/empty (pre-refactor behavior)'
  // has also been correctly removed as the handler now validates first.
});
