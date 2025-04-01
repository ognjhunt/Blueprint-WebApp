// --------------------------
// lines above remain unchanged
// --------------------------

import type { NextApiRequest, NextApiResponse } from "next";
import { google } from "googleapis";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.status(405).end("Method Not Allowed");
    return;
  }

  try {
    // Create an authentication client using your service account credentials.
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        // Replace literal "\n" with actual newline characters.
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // Ensure you have your spreadsheet ID set in your environment variables.
    const spreadsheetId = process.env.SPREADSHEET_ID;
    if (!spreadsheetId) {
      throw new Error("Spreadsheet ID not provided in environment variables");
    }

    // Destructure the expected fields from the request body.
    const {
      Company,
      Website,
      Target,
      Email,
      Phone,
      "Have we Outreached?": haveWeOutreached,
      "Outreach Message": outreachMessage,
      Location,
      "Contact Name": contactName,
    } = req.body;

    // Append a new row to your sheet (adjust the range as necessary).
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Sheet1!A1", // Update this range if needed.
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            Company,
            Website,
            Target,
            Email,
            Phone,
            haveWeOutreached,
            outreachMessage,
            Location,
            contactName,
          ],
        ],
      },
    });

    res.status(200).json({ message: "Success" });
  } catch (error: any) {
    console.error("Sheets API Error:", error);
    res.status(500).json({ message: "Error", error: error.message });
  }
}

// --------------------------
// lines below remain unchanged
// --------------------------
