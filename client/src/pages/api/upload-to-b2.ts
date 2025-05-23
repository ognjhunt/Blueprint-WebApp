// /api/upload-to-b2.ts
import B2 from "backblaze-b2";
import { IncomingForm, File, Fields } from "formidable";
import fs from "fs";

const b2 = new B2({
  applicationKeyId: "00550218f7653950000000002",
  applicationKey: "K005uyFTIjJ2mxwupnkSdfl2UYt0tIU",
});

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const form = new IncomingForm({ multiples: false });

  form.parse(req, async (err, fields: Fields, files: {file?: File | File[]}) => {
    if (err) {
      return res.status(500).json({ error: "Failed to parse form data" });
    }

    try {
      // Authorize with B2
      await b2.authorize();

      if (!files.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;
      
      const fileBuffer = fs.readFileSync(uploadedFile.filepath);

      // Get upload URL
      const response = await b2.getUploadUrl({
        bucketId: "d570327198bfd72685d30915", // Your bucket ID
      });

      // Upload file
      const uploadResponse = await b2.uploadFile({
        uploadUrl: response.data.uploadUrl,
        uploadAuthToken: response.data.authorizationToken,
        fileName: `uploads/${fields.blueprintId}/${fields.category}/${fields.filename}`,
        data: fileBuffer,
        mime: uploadedFile.mimetype,
      });

      // Construct the public URL
      const publicUrl = `https://f005.backblazeb2.com/file/uploadedFiles-dev/uploads/${fields.blueprintId}/${fields.category}/${fields.filename}`;

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

export const config = {
  api: {
    bodyParser: false,
  },
};
