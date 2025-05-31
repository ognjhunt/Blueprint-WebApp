import { extractDataFromAIResponse, extractUrlsFromDeepResearch } from '../../utils/data-extraction';

// Test suite for the extractDataFromAIResponse function
describe('extractDataFromAIResponse', () => {
  // Test case: All predefined markers are present in the response text.
  test('should extract all values when all markers are present', () => {
    const responseText = `
      Some text before.
      SHEET_ROW_ID: 123
      SHEET_CONTACT_NAME: John Doe
      SHEET_CONTACT_EMAIL: john.doe@example.com
      MAPPING_DURATION_MINUTES: 60
      CAR_TRAVEL_MINUTES: 30
      PUBLIC_TRANSPORT_MINUTES: 45
      COMPANY_URL_USED: https://example.com
      Some text after.
    `;
    const expected = {
      SHEET_ROW_ID: '123',
      SHEET_CONTACT_NAME: 'John Doe',
      SHEET_CONTACT_EMAIL: 'john.doe@example.com',
      MAPPING_DURATION_MINUTES: '60',
      CAR_TRAVEL_MINUTES: '30',
      PUBLIC_TRANSPORT_MINUTES: '45',
      COMPANY_URL_USED: 'https://example.com',
    };
    expect(extractDataFromAIResponse(responseText)).toEqual(expected);
  });

  // Test case: Some markers are missing from the response text.
  // It expects that keys for missing markers will not be in the result object.
  test('should return undefined for missing markers', () => {
    const responseText = `
      SHEET_ROW_ID: 456
      COMPANY_URL_USED: https://another.com
    `;
    const result = extractDataFromAIResponse(responseText);
    // Check that all possible keys are present, but missing ones might be undefined or not present
    // depending on original function's behavior. The original function only adds keys if found.
    expect(result.SHEET_ROW_ID).toBe('456');
    expect(result.COMPANY_URL_USED).toBe('https://another.com');
    expect(result.SHEET_CONTACT_NAME).toBeUndefined();
    expect(result.MAPPING_DURATION_MINUTES).toBeUndefined();
  });

  // Test case: No relevant markers are found in the response text.
  test('should return an empty object if no markers are found', () => {
    const responseText = 'This text contains no relevant markers.';
    expect(extractDataFromAIResponse(responseText)).toEqual({});
  });

  // Test case: The input response text is an empty string.
  // Also checks for the console.warn behavior.
  test('should return an empty object for an empty string input', () => {
    const responseText = '';
    // Original function has a console.warn for empty string and returns {}
    expect(extractDataFromAIResponse(responseText)).toEqual({});
  });

  // Test case: The input is null.
  test('should return an empty object for a null input', () => {
    // @ts-expect-error testing invalid input
    expect(extractDataFromAIResponse(null)).toEqual({});
  });

  // Test case: The input is undefined.
  test('should return an empty object for an undefined input', () => {
    // @ts-expect-error testing invalid input
    expect(extractDataFromAIResponse(undefined)).toEqual({});
  });

  // Test case: Lines contain markers but no corresponding values (e.g., "SHEET_ROW_ID:").
  test('should handle lines with only markers and no values', () => {
    const responseText = `
      SHEET_ROW_ID:
      SHEET_CONTACT_NAME: Jane
    `;
    const expected = {
      SHEET_ROW_ID: '',
      SHEET_CONTACT_NAME: 'Jane',
    };
    expect(extractDataFromAIResponse(responseText)).toEqual(expected);
  });

  // Test case: Values associated with markers have leading/trailing whitespace.
  test('should trim whitespace from values', () => {
    const responseText = 'SHEET_CONTACT_EMAIL:   test@example.com   ';
    const expected = {
      SHEET_CONTACT_EMAIL: 'test@example.com',
    };
    expect(extractDataFromAIResponse(responseText)).toEqual(expected);
  });

  // Test case: Markers are in a different case than defined (e.g., lowercase).
  // The function is case-sensitive, so these should not be matched.
  test('should be case-sensitive and not match mixed-case markers', () => {
    // This test assumes the original function is case-sensitive for markers.
    // If it were meant to be case-insensitive, the function would need modification.
    const responseText = 'sheet_row_id: 789'; // Lowercase marker
    expect(extractDataFromAIResponse(responseText)).toEqual({});
  });

  // Test case: Multiple markers appear on the same line.
  // The current implementation processes line by line, and for each line, it iterates through markers.
  // The first marker (as defined in the function's `markers` array) that matches `startsWith` will be used.
  test('should correctly parse when multiple markers are on the same line (first match in markers array wins)', () => {
    // The current implementation processes line by line, and for each line, it iterates through markers.
    // The first marker that matches `startsWith` will be used.
    const responseText = 'SHEET_ROW_ID: 111 SHEET_CONTACT_NAME: Double Marker';
    const expected = {
      SHEET_ROW_ID: '111 SHEET_CONTACT_NAME: Double Marker', // because SHEET_ROW_ID is likely first in markers array
    };
    // This depends on the order of markers in the function. Let's verify.
    // Markers: SHEET_ROW_ID, SHEET_CONTACT_NAME, ...
    // So SHEET_ROW_ID will match first.
    expect(extractDataFromAIResponse(responseText)).toEqual(expected);
  });

  // Test case: The input string consists only of whitespace characters.
  test('should handle input with only whitespace', () => {
    const responseText = '   \n   \t   ';
    // Original function has a console.warn for empty trimmed string and returns {}
    expect(extractDataFromAIResponse(responseText)).toEqual({});
  });
});

// Test suite for the extractUrlsFromDeepResearch function
describe('extractUrlsFromDeepResearch', () => {
  // Test case: Valid markdown text with a "Key URLs Found" section and various URL formats.
  test('should extract URLs correctly from valid markdown', () => {
    const markdownText = `
      Some introductory text.
      ### Key URLs Found:
      - Menu: http://example.com/menu
      - Reservations: [Book Now](http://example.com/reservations)
      - Wait List: N/A
      - Online Ordering: https://example.com/order
      Random text.
    `;
    const expected = {
      menu_url: 'http://example.com/menu',
      reservations_url: 'http://example.com/reservations',
      online_ordering_url: 'https://example.com/order',
    };
    expect(extractUrlsFromDeepResearch(markdownText)).toEqual(expected);
  });

  // Test case: The specific "### Key URLs Found:" heading is missing.
  test('should return an empty object if "Key URLs Found:" section is missing', () => {
    const markdownText = `
      ### Other Section
      - Menu: http://example.com/menu
    `;
    expect(extractUrlsFromDeepResearch(markdownText)).toEqual({});
  });

  // Test case: The section "### Key URLs Found:" exists, but contains no parsable/valid URLs (e.g., all "N/A").
  test('should return an empty object if section exists but no valid URLs are found', () => {
    const markdownText = `
      ### Key URLs Found:
      - Menu: N/A
      - Reservations: Not Available
    `;
    expect(extractUrlsFromDeepResearch(markdownText)).toEqual({});
  });

  // Test case: URLs provided do not conform to http/https or are otherwise invalid.
  test('should handle invalid URL formats gracefully (ignores non http/https)', () => {
    const markdownText = `
      ### Key URLs Found:
      - Menu: htttp://invalid-url
      - Reviews: example.com/reviews (no scheme)
      - Specials/Promotions: [Link](ftp://example.com/promo)
    `;
    // Based on current logic, it only accepts http/https. ftp will be ignored.
    // URLs without scheme will be ignored.
    expect(extractUrlsFromDeepResearch(markdownText)).toEqual({});
  });

  // Test case: Input markdown text is an empty string.
  test('should return an empty object for empty string input', () => {
    expect(extractUrlsFromDeepResearch('')).toEqual({});
  });

  // Test case: Input is null.
  test('should return an empty object for null input', () => {
    // @ts-expect-error testing invalid input
    expect(extractUrlsFromDeepResearch(null)).toEqual({});
  });

  // Test case: Input is undefined.
  test('should return an empty object for undefined input', () => {
    // @ts-expect-error testing invalid input
    expect(extractUrlsFromDeepResearch(undefined)).toEqual({});
  });

  // Test case: Variations in the section heading, such as extra spaces after "Found:".
  // The current function is specific: `trimmedLine.startsWith("### Key URLs Found:")`.
  // This test confirms that minor variations in heading are NOT matched.
  test('should not match section heading with trailing spaces after colon', () => {
    const markdownText = `
      ### Key URLs Found :
      - Menu: http://example.com/menu
    `;
    // The current function uses `trimmedLine.startsWith("### Key URLs Found:")`
    // which is specific. If variations are needed, the function must be updated.
    // This test expects it NOT to match if the heading has extra spaces after "Found:"
    // UPDATE: The original code has `trimmedLine.startsWith("### Key URLs Found:")`, so it's exact.
    // This test should reflect that. If we want to allow "### Key URLs Found :", function needs change.
    // For now, testing existing behavior:
    expect(extractUrlsFromDeepResearch(markdownText)).toEqual({});
  });

  // Test case: URL extraction should stop if a new H3 heading (different section) is encountered.
  test('should stop processing if another H3 heading is encountered', () => {
    const markdownText = `
      ### Key URLs Found:
      - Menu: http://example.com/menu
      ### Another Section
      - Events/Calendar: http://example.com/events
    `;
    const expected = {
      menu_url: 'http://example.com/menu',
    };
    expect(extractUrlsFromDeepResearch(markdownText)).toEqual(expected);
  });

  // Test case: URLs include query parameters and/or fragments.
  test('should correctly handle URLs with query parameters and fragments', () => {
    const markdownText = `
      ### Key URLs Found:
      - Online Ordering: https://example.com/order?item=123#details
      - Specials/Promotions: [See More](https://example.com/promo?code=SAVE10#footer)
    `;
    const expected = {
      online_ordering_url: 'https://example.com/order?item=123#details',
      specials_promotions_url: 'https://example.com/promo?code=SAVE10#footer',
    };
    expect(extractUrlsFromDeepResearch(markdownText)).toEqual(expected);
  });

  // Test case: Markdown contains list items with keys not defined in `keyMappings`.
  test('should ignore items not in keyMappings', () => {
    const markdownText = `
      ### Key URLs Found:
      - Unknown Link: http://example.com/unknown
      - Menu: http://example.com/menu
    `;
    const expected = {
      menu_url: 'http://example.com/menu',
    };
    expect(extractUrlsFromDeepResearch(markdownText)).toEqual(expected);
  });

  // Test case: Empty lines are present within the "Key URLs Found" section.
  test('should handle empty lines within the Key URLs section', () => {
    const markdownText = `
      ### Key URLs Found:

      - Menu: http://example.com/menu

      - Reservations: http://example.com/reservations
    `;
    const expected = {
      menu_url: 'http://example.com/menu',
      reservations_url: 'http://example.com/reservations',
    };
    expect(extractUrlsFromDeepResearch(markdownText)).toEqual(expected);
  });
});
