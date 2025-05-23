// /api/upload-to-b2.ts
import B2 from "backblaze-b2";
import { IncomingForm } from "formidable";
import fs from "fs";

// Define a proper interface for our B2 credentials
interface B2Config {
  applicationKeyId: string;
  applicationKey: string;
}

// Initialize B2 with credentials
const b2 = new B2({
  applicationKeyId: "00550218f7653950000000002",
  applicationKey: "K005uyFTIjJ2mxwupnkSdfl2UYt0tIU",
} as B2Config);

// Define the handler function
export default async function handler(req: any, res: any) {
  // Check if request method is POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Create form parser
  const form = new IncomingForm({ multiples: false });

  // Parse form data
  form.parse(req, async (err: any, fields: any, files: any) => {
    if (err) {
      console.error("Form parsing error:", err);
      return res.status(500).json({ error: "Failed to parse form data" });
    }

    try {
      // Check if we have files
      if (!files.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Get the uploaded file
      const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;
      
      // Read file content
      const fileBuffer = fs.readFileSync(uploadedFile.filepath);

      // Authorize with B2
      await b2.authorize();

      // Get upload URL
      const response = await b2.getUploadUrl({
        bucketId: "d570327198bfd72685d30915", // Your bucket ID
      });

      // Upload file to B2
      const uploadResponse = await b2.uploadFile({
        uploadUrl: response.data.uploadUrl,
        uploadAuthToken: response.data.authorizationToken,
        fileName: `uploads/${fields.blueprintId}/${fields.category}/${fields.filename}`,
        data: fileBuffer,
        mime: uploadedFile.mimetype,
      });

      // Construct the public URL
      const publicUrl = `https://f005.backblazeb2.com/file/uploadedFiles-dev/uploads/${fields.blueprintId}/${fields.category}/${fields.filename}`;

      // Return success response
      res.status(200).json({
        url: publicUrl,
        fileId: uploadResponse.data.fileId,
      });
    } catch (error) {
      console.error("B2 upload error:", error);
      res.status(500).json({ error: "Failed to upload to B2" });
    }
  });
}

// Export configuration for API route
export const config = {
  api: {
    bodyParser: false,
  },
};
