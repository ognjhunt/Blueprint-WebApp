// Add this to server/tests/utils/validation.test.ts
// Add this to server/tests/utils/validation.test.ts
import { validateWaitlistData, validateMappingConfirmationData, MappingConfirmationData, ValidationError } from '../../utils/validation'; // Ensure ValidationError is imported if used in assertions, though not strictly needed for these tests

// Test suite for the validateWaitlistData function
describe('validateWaitlistData', () => {
  // Base valid data structure for waitlist validation tests
  const validData = {
    name: 'John Doe',
    email: 'john.doe@example.com',
    company: 'Test Co',
    city: 'Test City',
    state: 'TS',
    offWaitlistUrl: 'http://example.com/off-waitlist',
    message: 'Hello',
    companyWebsite: 'http://testco.com',
    companyAddress: '123 Test St',
  };

  // Test case: Input data is valid. Expect no errors.
  test('should return an empty array for valid data', () => {
    expect(validateWaitlistData(validData)).toEqual([]);
  });

  // Test case: Request body is null. Expect a 'requestBody missing' error.
  test('should return an error if requestBody is null', () => {
    const errors = validateWaitlistData(null);
    expect(errors.length).toBe(1);
    expect(errors[0].field).toBe('requestBody');
    expect(errors[0].message).toBe('Request body is missing.');
  });

  // Test case: Request body is undefined. Expect a 'requestBody missing' error.
  test('should return an error if requestBody is undefined', () => {
     const errors = validateWaitlistData(undefined);
     expect(errors.length).toBe(1);
     expect(errors[0].field).toBe('requestBody');
     expect(errors[0].message).toBe('Request body is missing.');
  });

  // Test case: Multiple required fields are missing. Expect an error for each.
  test('should return an error for each missing required field', () => {
    const data = { ...validData };
    // @ts-expect-error
    delete data.name;
    // @ts-expect-error
    delete data.email;
    const errors = validateWaitlistData(data);
    expect(errors.length).toBe(2);
    expect(errors.find(e => e.field === 'name')).toBeDefined();
    expect(errors.find(e => e.field === 'email')).toBeDefined();
  });

  // Test case: Required fields are present but consist of only whitespace/empty strings.
  test('should return an error for fields that are present but empty strings', () => {
     const data = {
         ...validData,
         name: ' ',
         company: ''
     };
    const errors = validateWaitlistData(data);
    expect(errors.length).toBe(2);
    expect(errors.find(e => e.field === 'name' && e.message.includes('Missing required field'))).toBeDefined();
    expect(errors.find(e => e.field === 'company' && e.message.includes('Missing required field'))).toBeDefined();
  });

  // Test case: Email field has an invalid format.
  test('should return an error for invalid email format', () => {
    const data = { ...validData, email: 'invalid-email' };
    const errors = validateWaitlistData(data);
    expect(errors.length).toBe(1);
    expect(errors[0].field).toBe('email');
    expect(errors[0].message).toBe('Invalid email format.');
  });

  // Test case: Email field is an empty string (which is a 'missing required field' error).
  // It should not also produce an 'invalid email format' error.
  test('should prioritize "missing" error over "invalid format" if email is empty', () => {
     // This tests if both "missing" and "invalid format" errors appear if email is empty.
     // Current logic: "missing" takes precedence if empty. If not empty but invalid, then "invalid format".
    const data = { ...validData, email: '' };
    const errors = validateWaitlistData(data);
    expect(errors.some(e => e.field === 'email' && e.message.includes('Missing required field'))).toBeTruthy();
    // It should not also say "invalid email format" if it's missing
    expect(errors.some(e => e.field === 'email' && e.message.includes('Invalid email format.'))).toBeFalsy();
  });

  // Test case: A subset of required fields are missing.
  test('should correctly validate if only some required fields are missing', () => {
     const data = {
         email: 'only.email@example.com',
         company: 'Only Company Inc.',
     };
     // @ts-expect-error
     const errors = validateWaitlistData(data);
     expect(errors.length).toBe(4); // name, city, state, offWaitlistUrl are missing
     expect(errors.find(e => e.field === 'name')).toBeDefined();
     expect(errors.find(e => e.field === 'city')).toBeDefined();
     expect(errors.find(e => e.field === 'state')).toBeDefined();
     expect(errors.find(e => e.field === 'offWaitlistUrl')).toBeDefined();
     expect(errors.find(e => e.field === 'email')).toBeUndefined();
     expect(errors.find(e => e.field === 'company')).toBeUndefined();
  });

  // Test case: Optional fields (message, companyWebsite, companyAddress) are missing. Expect no errors.
  test('optional fields do not cause errors if missing', () => {
     const data = {
         name: 'John Doe',
         email: 'john.doe@example.com',
         company: 'Test Co',
         city: 'Test City',
         state: 'TS',
         offWaitlistUrl: 'http://example.com/off-waitlist',
         // message, companyWebsite, companyAddress are missing
     };
     expect(validateWaitlistData(data)).toEqual([]);
  });
});

// Test suite for the validateMappingConfirmationData function
describe('validateMappingConfirmationData', () => {
  // Base valid data structure for mapping confirmation tests
  const validData: MappingConfirmationData = {
    company_name: 'Valid Corp',
    contact_name: 'Jane Tester',
    contact_phone_number: '555-1234',
    address: '123 Main St',
    chosen_date_of_mapping: '2024-12-01',
    chosen_time_of_mapping: '10:00 AM',
    estimated_square_footage: 1000,
    company_url: 'http://validcorp.com',
    blueprint_id: 'bp_123xyz',
  };

  // Test case: Input data is valid. Expect no errors.
  test('should return an empty array for valid data', () => {
    expect(validateMappingConfirmationData(validData)).toEqual([]);
  });

  // Test case: Request body is null. Expect a 'requestBody missing' error.
  test('should return an error if requestBody is null', () => {
    const errors = validateMappingConfirmationData(null);
    expect(errors.length).toBe(1);
    expect(errors[0].field).toBe('requestBody');
  });

  // Test case: Multiple required fields are missing.
  // Provides only 'company_name' and checks that all other required fields are reported as errors.
  test('should return an error for each missing required field', () => {
    const data: Partial<MappingConfirmationData> = {
        company_name: "Test Only" // Provide at least one field
    };
    const errors = validateMappingConfirmationData(data as MappingConfirmationData);
    // Expect errors for all fields not in 'data' that are in requiredFields
    const requiredFields: Array<keyof MappingConfirmationData> = [
        'contact_name', 'contact_phone_number', 'address', 'chosen_date_of_mapping',
        'chosen_time_of_mapping', 'estimated_square_footage', 'company_url', 'blueprint_id'
    ];
    expect(errors.length).toBe(requiredFields.length);
    requiredFields.forEach(field => {
        expect(errors.find(e => e.field === field)).toBeDefined();
    });
  });

  // Test case: Required fields are present but are empty strings or strings with only spaces.
  test('should return an error for empty string required fields', () => {
    const data: MappingConfirmationData = {
      ...validData,
      company_name: ' ',
      blueprint_id: '',
    };
    const errors = validateMappingConfirmationData(data);
    expect(errors.length).toBe(2);
    expect(errors.find(e => e.field === 'company_name')).toBeDefined();
    expect(errors.find(e => e.field === 'blueprint_id')).toBeDefined();
  });

  // Test case: 'estimated_square_footage' is provided as a non-numeric string.
  test('should return an error if estimated_square_footage is not a number', () => {
    const data = { ...validData, estimated_square_footage: 'not-a-number' };
    const errors = validateMappingConfirmationData(data);
    expect(errors.length).toBe(1);
    expect(errors[0].field).toBe('estimated_square_footage');
    expect(errors[0].message).toBe('Estimated square footage must be a number.');
  });

  // Test case: 'estimated_square_footage' is a negative number.
  test('should return an error if estimated_square_footage is negative', () => {
    const data = { ...validData, estimated_square_footage: -100 };
    const errors = validateMappingConfirmationData(data);
    expect(errors.length).toBe(1);
    expect(errors[0].field).toBe('estimated_square_footage');
    expect(errors[0].message).toBe('Estimated square footage cannot be negative.');
  });

  // Test case: 'estimated_square_footage' is zero. This should be valid.
  test('should pass if estimated_square_footage is zero', () => {
     const data = { ...validData, estimated_square_footage: 0 };
     expect(validateMappingConfirmationData(data)).toEqual([]);
  });

  // Test case: 'estimated_square_footage' is a string that can be coerced to a valid number.
  test('should pass if estimated_square_footage is a string number like "500"', () => {
     const data = { ...validData, estimated_square_footage: "500" };
     expect(validateMappingConfirmationData(data)).toEqual([]);
  });

  // Test case: Multiple validation errors occur simultaneously (missing fields and invalid type).
  test('should correctly identify multiple validation errors', () => {
     const data = {
         ...validData,
         company_name: '', // missing
         contact_name: '   ', // missing (empty after trim)
         estimated_square_footage: 'abc' // not a number
     };
     const errors = validateMappingConfirmationData(data);
     expect(errors.length).toBe(3);
     expect(errors.find(e => e.field === 'company_name')).toBeDefined();
     expect(errors.find(e => e.field === 'contact_name')).toBeDefined();
     expect(errors.find(e => e.field === 'estimated_square_footage' && e.message.includes('must be a number'))).toBeDefined();
  });
});
