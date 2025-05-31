interface WaitlistData {
  name?: string;
  email?: string;
  company?: string;
  city?: string;
  state?: string;
  message?: string; // Optional based on original handler
  companyWebsite?: string; // Optional
  companyAddress?: string; // Optional
  offWaitlistUrl?: string;
  [key: string]: any; // Allow other fields
}

/**
 * Represents a validation error.
 * @interface ValidationError
 * @property {string} field - The name of the field that has a validation error.
 * @property {string} message - The error message.
 */
export interface ValidationError { // Added export to make it available if needed by other modules, and JSDoc
  field: string;
  message: string;
}

/**
 * Validates the request body for waitlist signup.
 * @param {WaitlistData | null | undefined} requestBody The request body to validate.
 * @returns {ValidationError[]} An array of validation errors. Returns an empty array if validation passes.
 */
export function validateWaitlistData(
  requestBody: WaitlistData | null | undefined,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const requiredFields: Array<keyof WaitlistData> = [
    'name',
    'email',
    'company',
    'city',
    'state',
    'offWaitlistUrl',
  ];

  if (!requestBody) {
    errors.push({ field: 'requestBody', message: 'Request body is missing.' });
    return errors;
  }

  for (const field of requiredFields) {
    if (
      !requestBody[field] ||
      (typeof requestBody[field] === 'string' && !(requestBody[field] as string).trim())
    ) {
      errors.push({ field, message: `Missing required field: ${field}` });
    }
  }

  if (requestBody.email && typeof requestBody.email === 'string') {
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(requestBody.email)) {
      errors.push({ field: 'email', message: 'Invalid email format.' });
    }
  } else if (requiredFields.includes('email') && (!requestBody.email || !String(requestBody.email).trim())) {
     // This case is already covered by the general required field check,
     // but if email was not required and present, then validated, it would be:
     // errors.push({ field: 'email', message: 'Email must be a string if provided.' });
  }

  return errors;
}

export interface MappingConfirmationData {
  chosen_time_of_mapping?: string;
  chosen_date_of_mapping?: string;
  address?: string;
  company_url?: string;
  company_name?: string;
  contact_name?: string;
  contact_phone_number?: string;
  estimated_square_footage?: number | string; // Allow string as it might come from req.body
  blueprint_id?: string;
  [key: string]: any; // Allow other fields
}

// Assuming ValidationError is already defined from validateWaitlistData (it is, just above)

/**
 * Validates the request body for mapping confirmation.
 * @param {MappingConfirmationData | null | undefined} requestBody The request body to validate.
 * @returns {ValidationError[]} An array of validation errors. Returns an empty array if validation passes.
 */
export function validateMappingConfirmationData(
  requestBody: MappingConfirmationData | null | undefined,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const requiredFields: Array<keyof MappingConfirmationData> = [
    'company_name',
    'contact_name',
    'contact_phone_number',
    'address',
    'chosen_date_of_mapping',
    'chosen_time_of_mapping',
    'estimated_square_footage',
    'company_url',
    'blueprint_id',
  ];

  if (!requestBody) {
    errors.push({ field: 'requestBody', message: 'Request body is missing.' });
    return errors;
  }

  for (const field of requiredFields) {
    const value = requestBody[field];
    if (value === undefined || value === null || String(value).trim() === '') {
      errors.push({ field, message: `Missing required field: ${field}` });
    }
  }

  // Specific validation for estimated_square_footage
  if (requestBody.estimated_square_footage !== undefined && requestBody.estimated_square_footage !== null) {
    const sqFt = Number(requestBody.estimated_square_footage);
    if (isNaN(sqFt)) {
      errors.push({
        field: 'estimated_square_footage',
        message: 'Estimated square footage must be a number.',
      });
    } else if (sqFt < 0) {
      errors.push({
        field: 'estimated_square_footage',
        message: 'Estimated square footage cannot be negative.',
      });
    }
  }
  // If estimated_square_footage is required and missing, the generic check above will catch it.
  // This check is for when it *is* provided but is not valid.

  return errors;
}
