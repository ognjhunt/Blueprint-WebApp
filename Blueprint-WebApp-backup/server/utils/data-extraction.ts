/**
 * Extracts structured data from an AI response string based on predefined markers.
 * @param {string} responseText The raw text response from the AI.
 * @returns {{ [key: string]: string }} An object containing the extracted key-value pairs.
 *                                     Returns an empty object if the input is invalid or no markers are found.
 */
export function extractDataFromAIResponse(responseText: string): {
  [key: string]: string;
} {
  const extractedData: { [key: string]: string } = {};
  if (typeof responseText !== "string" || !responseText.trim()) {
    console.warn(
      "extractDataFromAIResponse received invalid input or empty string.",
    );
    return extractedData; // Return empty if no valid text
  }
  const lines = responseText.split("\n");
  const markers = [
    "SHEET_ROW_ID:",
    "SHEET_CONTACT_NAME:",
    "SHEET_CONTACT_EMAIL:",
    "MAPPING_DURATION_MINUTES:",
    "CAR_TRAVEL_MINUTES:",
    "PUBLIC_TRANSPORT_MINUTES:",
    "COMPANY_URL_USED:",
  ];

  lines.forEach((line) => {
    const trimmedLine = line.trim(); // Trim the line once
    for (const marker of markers) {
      if (trimmedLine.startsWith(marker)) {
        const key = marker
          .substring(0, marker.length - 1)
          .replace(/ /g, "_")
          .toUpperCase();
        const value = trimmedLine.substring(marker.length).trim(); // Use trimmedLine here
        extractedData[key] = value;
        break;
      }
    }
  });
  return extractedData;
}

/**
 * Extracts key URLs from a markdown text string, looking for a specific section.
 * @param {string} markdownText The markdown text, expected to contain a "### Key URLs Found:" section.
 * @returns {{ [key: string]: string }} An object mapping Firestore field names to extracted URLs.
 *                                     Returns an empty object if the section is not found or no valid URLs are listed.
 */
export function extractUrlsFromDeepResearch(markdownText: string): {
  [key: string]: string;
} {
  const urls: { [key: string]: string } = {};
  if (typeof markdownText !== "string" || !markdownText) {
    return urls;
  }
  const lines = markdownText.split("\n");
  let inKeyUrlsSection = false;

  // Define mappings from the text labels in markdown to Firestore field names
  const keyMappings: { [key: string]: string } = {
    Menu: "menu_url",
    Reservations: "reservations_url",
    "Wait List": "wait_list_url",
    "Online Ordering": "online_ordering_url",
    Reviews: "reviews_url",
    "Loyalty Program": "loyalty_program_url",
    "Specials/Promotions": "specials_promotions_url",
    "Events/Calendar": "events_url",
    // Add other mappings if needed
  };

  // Regex to find lines like "- Menu: http://example.com" or "- Menu: N/A"
  // It also handles potential markdown links like "- Menu: [Visit Here](http://example.com)"
  const itemRegex = /^\s*-\s*([^:]+):\s*(.*)/;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("### Key URLs Found:")) {
      inKeyUrlsSection = true;
      continue;
    }

    // If we encounter another H3 or a completely different section, stop processing Key URLs.
    // This condition might need adjustment based on the variability of the AI's output.
    if (
      inKeyUrlsSection &&
      (trimmedLine.startsWith("### ") || trimmedLine === "")
    ) {
      // If it's an empty line immediately after "### Key URLs Found:", don't break yet.
      // If it's another heading, or several empty lines, then break.
      // For simplicity, we'll break on any other H3.
      if (
        trimmedLine.startsWith("### ") &&
        !trimmedLine.startsWith("### Key URLs Found:")
      ) {
        inKeyUrlsSection = false; // Exit the section
        break;
      }
    }

    if (inKeyUrlsSection) {
      const match = trimmedLine.match(itemRegex);
      if (match) {
        const keyName = match[1].trim(); // e.g., "Menu"
        let value = match[2].trim(); // e.g., "http://example.com" or "[Text](url)" or "N/A"

        if (value.toLowerCase() !== "n/a" && value !== "") {
          // Extract URL if it's in markdown format [Text](URL)
          const markdownLinkMatch = value.match(
            /\[.*?\]\((https?:\/\/[^\s)]+)\)/,
          );
          if (markdownLinkMatch && markdownLinkMatch[1]) {
            value = markdownLinkMatch[1];
          }

          // Ensure it's a plausible URL (basic check)
          if (value.startsWith("http://") || value.startsWith("https://")) {
            if (keyMappings[keyName]) {
              urls[keyMappings[keyName]] = value;
            }
          }
        }
      }
    }
  }
  return urls;
}
