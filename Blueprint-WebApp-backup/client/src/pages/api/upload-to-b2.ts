// import B2 from "backblaze-b2";
// import { IncomingForm } from "formidable";
// import fs from "fs";
// import { NextApiRequest, NextApiResponse } from "next";

// // Disable body parser for file uploads
// export const config = {
//   api: {
//     bodyParser: false,
//   },
// };

// // Initialize B2 with credentials
// const b2 = new B2({
//   applicationKeyId: "00550218f7653950000000002",
//   applicationKey: "K005uyFTIjJ2mxwupnkSdfl2UYt0tIU",
// });

// export default async function handler(
//   req: NextApiRequest,
//   res: NextApiResponse,
// ) {
//   // Check if request method is POST
//   if (req.method !== "POST") {
//     return res.status(405).json({ error: "Method not allowed" });
//   }

//   try {
//     // Create form parser
//     const form = new IncomingForm({
//       multiples: false,
//       maxFileSize: 50 * 1024 * 1024, // 50MB limit
//     });

//     // Parse form data
//     const [fields, files] = await new Promise<[any, any]>((resolve, reject) => {
//       form.parse(req, (err, fields, files) => {
//         if (err) reject(err);
//         else resolve([fields, files]);
//       });
//     });

//     // Check if we have files
//     if (!files.file) {
//       return res.status(400).json({ error: "No file uploaded" });
//     }

//     // Get the uploaded file
//     const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;

//     // Read file content
//     const fileBuffer = fs.readFileSync(uploadedFile.filepath);

//     // Clean up temp file
//     fs.unlinkSync(uploadedFile.filepath);

//     // Authorize with B2
//     await b2.authorize();

//     // Get upload URL
//     const response = await b2.getUploadUrl({
//       bucketId: "d570327198bfd72685d30915", // Your bucket ID
//     });

//     // Extract field values (they might be arrays)
//     const blueprintId = Array.isArray(fields.blueprintId)
//       ? fields.blueprintId[0]
//       : fields.blueprintId;
//     const category = Array.isArray(fields.category)
//       ? fields.category[0]
//       : fields.category;
//     const filename = Array.isArray(fields.filename)
//       ? fields.filename[0]
//       : fields.filename;

//     // Upload file to B2
//     const uploadResponse = await b2.uploadFile({
//       uploadUrl: response.data.uploadUrl,
//       uploadAuthToken: response.data.authorizationToken,
//       fileName: `uploads/${blueprintId}/${category}/${filename}`,
//       data: fileBuffer,
//       mime: uploadedFile.mimetype || "application/octet-stream",
//     });

//     // Construct the public URL
//     const publicUrl = `https://f005.backblazeb2.com/file/uploadedFiles-dev/uploads/${blueprintId}/${category}/${filename}`;

//     // Return success response
//     res.status(200).json({
//       url: publicUrl,
//       fileId: uploadResponse.data.fileId,
//     });
//   } catch (error) {
//     console.error("B2 upload error:", error);
//     res.status(500).json({
//       error: "Failed to upload to B2",
//       details: error instanceof Error ? error.message : "Unknown error",
//     });
//   }
// }
