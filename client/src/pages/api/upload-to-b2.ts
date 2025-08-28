import type { Request, Response } from "express";
import multer from "multer";
// @ts-ignore - library has no types
import B2 from "backblaze-b2";

const upload = multer({ storage: multer.memoryStorage() });

const b2 = new B2({
  applicationKeyId: process.env.B2_KEY_ID || "",
  applicationKey: process.env.B2_APP_KEY || "",
});

export default function handler(req: Request, res: Response) {
  upload.single("file")(req, res, async (err: any) => {
    if (err) {
      console.error("Multer error:", err);
      return res.status(500).json({ error: "File upload failed" });
    }

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    try {
      if (!process.env.B2_BUCKET_ID) {
        return res.status(500).json({ error: "Missing B2 configuration" });
      }

      await b2.authorize();
      const { data } = await b2.getUploadUrl({
        bucketId: process.env.B2_BUCKET_ID,
      });

      const fileName = `models/${Date.now()}_${file.originalname}`;
      await b2.uploadFile({
        uploadUrl: data.uploadUrl,
        uploadAuthToken: data.authorizationToken,
        fileName,
        data: file.buffer,
        contentType: file.mimetype,
      });

      const bucketName = process.env.B2_BUCKET_NAME || "objectModels-dev";
      const publicUrl = `https://f005.backblazeb2.com/file/${bucketName}/${fileName}`;

      res.status(200).json({ url: publicUrl, fileName });
    } catch (error) {
      console.error("B2 upload error:", error);
      res.status(500).json({ error: "Failed to upload to B2" });
    }
  });
}
