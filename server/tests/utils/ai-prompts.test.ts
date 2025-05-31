// Add this to server/tests/utils/ai-prompts.test.ts
// Add this to server/tests/utils/ai-prompts.test.ts
// Make sure to import MappingConfirmationDataForPrompt and Phase1ExtractedData
import {
  buildWaitlistAIProomp,
  buildMappingConfirmationPhase1AIProomp,
  MappingConfirmationDataForPrompt, // This is the interface for data passed to Phase 1 prompt builder
  buildMappingConfirmationPhase2AIProomp,
  Phase1ExtractedData, // Interface for data extracted from Phase 1 AI response
  MappingConfirmationDataForPrompt as MappingConfDataForPromptP2 // Alias for clarity in Phase 2 tests
} from '../../utils/ai-prompts';

// Test suite for the buildWaitlistAIProomp function
describe('buildWaitlistAIProomp', () => {
  // Base data structure for waitlist prompt tests
  const baseData = {
    name: 'Jane Doe',
    email: 'jane@example.com',
    company: 'Acme Corp',
    city: 'Anytown',
    state: 'AS',
    offWaitlistUrl: 'http://example.com/signup',
  };

  // Test case: All required fields are provided.
  // Checks for inclusion of key data points and structure.
  test('should build the prompt correctly with all required data', () => {
    const prompt = buildWaitlistAIProomp(baseData);
    expect(prompt).toContain(`Process new signup for Jane Doe from Acme Corp.`);
    expect(prompt).toContain(`Name="Jane Doe"`);
    expect(prompt).toContain(`Email="jane@example.com"`);
    expect(prompt).toContain(`Company="Acme Corp"`);
    expect(prompt).toContain(`City="Anytown"`);
    expect(prompt).toContain(`State="AS"`);
    expect(prompt).toContain(`Address=""`); // Default empty
    expect(prompt).toContain(`Website=""`); // Default empty
    expect(prompt).toContain(`Additional Comments=""`); // Default empty
    expect(prompt).toContain(new Date().toISOString().split("T")[0]); // Check for current date
    expect(prompt).toContain(`Evaluate for Blueprint pilot program criteria: customer-facing business, retail/hospitality type, physical presence with foot traffic, located in or near Durham NC area.`);
    expect(prompt).toContain(`Hey Jane,`); // Check first name extraction
    expect(prompt).toContain(baseData.offWaitlistUrl);
    expect(prompt).toContain(`Post on X and tag us @tryblueprintapp`);
  });

  // Test case: Optional fields (message, companyWebsite, companyAddress) are included in the input.
  // Checks if these optional fields are correctly placed in the prompt.
  test('should include optional fields when provided', () => {
    const dataWithOptional = {
      ...baseData,
      message: 'This is a test message.',
      companyWebsite: 'http://acme.com',
      companyAddress: '123 Main St, Anytown, AS',
    };
    const prompt = buildWaitlistAIProomp(dataWithOptional);
    expect(prompt).toContain(`Address="123 Main St, Anytown, AS"`);
    expect(prompt).toContain(`Website="http://acme.com"`);
    expect(prompt).toContain(`Additional Comments="This is a test message."`);
  });

  // Test case: Name is a single word (e.g., "Madonna").
  // Checks if the first name extraction for email greeting handles this.
  test('should correctly extract first name for email greeting (single name)', () => {
     const dataSingleName = { ...baseData, name: 'Madonna' };
     const prompt = buildWaitlistAIProomp(dataSingleName);
     expect(prompt).toContain('Hey Madonna,');
  });

  // Test case: Name contains multiple spaces between words.
  // Checks if first name extraction is robust to varied spacing.
  test('should correctly extract first name for email greeting (multiple spaces in name)', () => {
     const dataMultiSpaceName = { ...baseData, name: 'Charles   Montgomery    Burns' };
     const prompt = buildWaitlistAIProomp(dataMultiSpaceName);
     // split(" ")[0] will take "Charles"
     expect(prompt).toContain('Hey Charles,');
  });

  // Test case: Verifies that the current date and time are included in the prompt.
  // Date is checked for exact match (YYYY-MM-DD). Time is checked with a regex for format.
  // Mocking Date object might be needed for more precise time matching if required.
  test('should include current date and time in the prompt', () => {
     const prompt = buildWaitlistAIProomp(baseData);
     const currentDate = new Date().toISOString().split("T")[0];
     // const currentTime = new Date().toLocaleTimeString(); // Hard to match exactly without mocking
     expect(prompt).toContain(`Date of Waitlist="${currentDate}"`);
     // Check for pattern of time, e.g., using a regex if more precision is needed
     expect(prompt).toMatch(/Time of Waitlist="\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM)?"/);
  });
});

// Test suite for the buildMappingConfirmationPhase1AIProomp function
describe('buildMappingConfirmationPhase1AIProomp', () => {
  // Base data for Phase 1 mapping confirmation prompt tests
  const baseData: MappingConfirmationDataForPrompt = {
    company_name: 'Tech Solutions Inc.',
    contact_name: 'Alex Ray',
    contact_phone_number: '555-0001',
    address: '456 Innovation Dr, Techville, TS, 12345, USA',
    company_url: 'http://techsolutions.example.com',
    chosen_date_of_mapping: '2025-07-15',
    chosen_time_of_mapping: '14:30',
    estimated_square_footage: 2000,
  };
  const mappingDuration = 2000 / 100 + 15; // Calculated duration for 2000 sq ft is 35 mins

  // Test case: All required data for Phase 1 prompt is provided.
  // Checks for inclusion of all key data points and structural elements.
  test('should build Phase 1 prompt correctly with all required data', () => {
    const prompt = buildMappingConfirmationPhase1AIProomp(baseData, mappingDuration);

    expect(prompt).toContain(`Initial Mapping Setup for ${baseData.company_name}`);
    expect(prompt).toContain(`- Company: ${baseData.company_name}`);
    expect(prompt).toContain(`- Contact (from Webhook): ${baseData.contact_name} (${baseData.contact_phone_number})`);
    expect(prompt).toContain(`- Address: ${baseData.address}`);
    expect(prompt).toContain(`- Website: ${baseData.company_url}`);
    expect(prompt).toContain(`- Mapping Date: ${baseData.chosen_date_of_mapping}`);
    expect(prompt).toContain(`- Mapping Time: ${baseData.chosen_time_of_mapping}`);
    expect(prompt).toContain(`- Est. Square Footage: ${baseData.estimated_square_footage}`);

    expect(prompt).toContain(`find the row where the 'Website' column matches "${baseData.company_url}"`);
    expect(prompt).toContain(`use "${baseData.contact_name}" as [SheetContactName]`);

    expect(prompt).toContain(`"Chosen Date of Mapping" = "${baseData.chosen_date_of_mapping}"`);
    expect(prompt).toContain(`"Chosen Time of Mapping" = "${baseData.chosen_time_of_mapping}"`);

    const displayAddress = baseData.address.replace(", USA", "");
    expect(prompt).toContain(`We've confirmed a Blueprint Mapping for ${baseData.company_name} at ${displayAddress}`);
    expect(prompt).toContain(`approximately ${mappingDuration} minutes.`);

    expect(prompt).toContain(`Event Title: "Blueprint Mapping: ${baseData.company_name}"`);
    expect(prompt).toContain(`Location: ${baseData.address}`);
    expect(prompt).toContain(`Start: ${baseData.chosen_date_of_mapping} ${baseData.chosen_time_of_mapping}`);

    expect(prompt).toContain(`Subject: "REMINDER: Blueprint Mapping for ${baseData.company_name} is Today!"`);
    expect(prompt).toContain(`at ${displayAddress}.`);

    expect(prompt).toContain(`To: ${baseData.contact_phone_number}`);
    expect(prompt).toContain(`Message: "Hi ${baseData.contact_name}! Your Blueprint Mapping for ${baseData.company_name} is confirmed for ${baseData.chosen_date_of_mapping} at ${baseData.chosen_time_of_mapping} (${displayAddress}).`);

    expect(prompt).toContain(`Origin: "1005 Crete St, Durham, NC 27707"`);
    expect(prompt).toContain(`Destination: "${baseData.address}"`);

    expect(prompt).toContain(`Est. Mapping Duration: ${mappingDuration} mins`);
    expect(prompt).toContain(`Next: Phase 2 (Deep Research) for ${baseData.company_url}.`);

    expect(prompt).toContain(`SHEET_ROW_ID:[SheetRowID]`);
    expect(prompt).toContain(`COMPANY_URL_USED:${baseData.company_url}`);
    expect(prompt).toContain(`MAPPING_DURATION_MINUTES:${mappingDuration}`);
  });

  // Test case: company_url is not provided in the input data.
  // Checks if the prompt correctly defaults to "Not provided" for website/company_url fields.
  test('should use "Not provided" for company_url if missing', () => {
    const dataNoUrl = { ...baseData, company_url: undefined };
    const prompt = buildMappingConfirmationPhase1AIProomp(dataNoUrl, mappingDuration);
    expect(prompt).toContain('- Website: Not provided');
    // It should still try to match with "Not provided" in the Google Sheet step.
    expect(prompt).toContain(`find the row where the 'Website' column matches "Not provided"`);
    expect(prompt).toContain('COMPANY_URL_USED:Not provided');
    expect(prompt).toContain('Next: Phase 2 (Deep Research) for Not provided.');
  });

  // Test case: A custom mapping duration is passed to the function.
  // Checks if this custom duration is correctly used in the prompt.
  test('should correctly use provided calculatedMappingDuration', () => {
     const customDuration = 123;
     const prompt = buildMappingConfirmationPhase1AIProomp(baseData, customDuration);
     expect(prompt).toContain(`approximately ${customDuration} minutes.`);
     expect(prompt).toContain(`Est. Mapping Duration: ${customDuration} mins`);
     expect(prompt).toContain(`MAPPING_DURATION_MINUTES:${customDuration}`);
  });
});

// Test suite for the buildMappingConfirmationPhase2AIProomp function
describe('buildMappingConfirmationPhase2AIProomp', () => {
  // Base data for original webhook input for Phase 2 prompt tests
  const originalWebhookData: MappingConfDataForPromptP2 = { // Use alias if declared in same file
    company_name: 'Global Exports Ltd.',
    contact_name: 'Sam Manager',
    contact_phone_number: '555-0002',
    address: '789 Trade Route, Commerce City, CC, 67890, USA',
    company_url: 'http://globalexports.example.com', // Original URL
    chosen_date_of_mapping: '2025-08-20',
    chosen_time_of_mapping: '09:00',
    estimated_square_footage: 5000,
  };

  // Base data for data extracted from Phase 1 AI response
  const phase1Data: Phase1ExtractedData = {
    SHEET_ROW_ID: 'row_789',
    COMPANY_URL_USED: 'http://specific.globalexports.example.com', // URL confirmed/found by AI in Phase 1
    SHEET_CONTACT_NAME: 'Samantha M.',
    SHEET_CONTACT_EMAIL: 's.manager@example.com',
    MAPPING_DURATION_MINUTES: '65', // 5000/100 + 15
    CAR_TRAVEL_MINUTES: '20',
    PUBLIC_TRANSPORT_MINUTES: 'N/A',
  };

  // Test case: All required data from both original webhook and Phase 1 extraction is provided.
  // Checks for correct interpolation of these values, especially prioritizing Phase 1 data where specified (e.g., COMPANY_URL_USED).
  test('should build Phase 2 prompt correctly using data from Phase 1 extraction', () => {
    const prompt = buildMappingConfirmationPhase2AIProomp(originalWebhookData, phase1Data);

    expect(prompt).toContain(`Deep Research & Content Generation for ${originalWebhookData.company_name}`);
    expect(prompt).toContain(`- Company Name: ${originalWebhookData.company_name}`);
    expect(prompt).toContain(`- Company URL: ${phase1Data.COMPANY_URL_USED}`); // Crucially uses Phase 1 URL
    expect(prompt).toContain(`- Company Address: ${originalWebhookData.address}`);
    expect(prompt).toContain(`- Google Sheet Row ID to update: ${phase1Data.SHEET_ROW_ID}`);

    expect(prompt).toContain(`For company at URL: ${phase1Data.COMPANY_URL_USED}`);
    expect(prompt).toContain(`find the row where 'Website' column matches "${phase1Data.COMPANY_URL_USED}"`);

    expect(prompt).toContain(`Title: "${originalWebhookData.company_name} - Blueprint Design Ideas & Research"`);
    expect(prompt).toContain(`Include the direct website link: ${phase1Data.COMPANY_URL_USED}`);
  });

  // Test case: COMPANY_URL_USED is missing (empty string) from phase1ExtractedData.
  // Expects the prompt to use the company_url from the originalWebhookData.
  test('should use original company_url if COMPANY_URL_USED is missing from phase1Data', () => {
    const phase1DataNoUrl = { ...phase1Data, COMPANY_URL_USED: '' }; // COMPANY_URL_USED is empty
    const prompt = buildMappingConfirmationPhase2AIProomp(originalWebhookData, phase1DataNoUrl);
    expect(prompt).toContain(`- Company URL: ${originalWebhookData.company_url}`);
    expect(prompt).toContain(`For company at URL: ${originalWebhookData.company_url}`);
  });

  // Test case: company_url is missing from originalWebhookData AND phase1ExtractedData.COMPANY_URL_USED is empty.
  // Expects the prompt to use the fallback "No website provided..." string.
  test('should use "No website provided..." if both original and phase1 COMPANY_URL_USED are missing', () => {
    const originalDataNoUrl = {...originalWebhookData, company_url: undefined};
    const phase1DataNoUrl = { ...phase1Data, COMPANY_URL_USED: '' };
    const prompt = buildMappingConfirmationPhase2AIProomp(originalDataNoUrl, phase1DataNoUrl);
    const expectedFallbackUrl = "No website provided, conduct general search if possible.";
    expect(prompt).toContain(`- Company URL: ${expectedFallbackUrl}`);
    expect(prompt).toContain(`For company at URL: ${expectedFallbackUrl}`);
  });

  // Test case: SHEET_ROW_ID is missing (empty string) from phase1ExtractedData.
  // Expects the prompt to use "LOOKUP_REQUIRED" for SHEET_ROW_ID and include instructions for lookup.
  test('should use "LOOKUP_REQUIRED" for SHEET_ROW_ID if missing from phase1Data', () => {
    const phase1DataNoSheetId = { ...phase1Data, SHEET_ROW_ID: '' }; // SHEET_ROW_ID is empty
    const prompt = buildMappingConfirmationPhase2AIProomp(originalWebhookData, phase1DataNoSheetId);
    expect(prompt).toContain('- Google Sheet Row ID to update: LOOKUP_REQUIRED');
    expect(prompt).toContain(`(If "LOOKUP_REQUIRED" or "NOT_FOUND", your first step in TASK 2 must be to find the row by Website column matching "${phase1Data.COMPANY_URL_USED}")`);
  });
});
