import { Request, Response } from "express";
import multer from "multer";

import { sendEmail } from "../utils/email";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

type RequestWithFile = Request & { file?: Express.Multer.File };

export default function applyHandler(req: Request, res: Response) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  upload.single("resume")(req, res, async (uploadError: unknown) => {
    if (uploadError) {
      const errorMessage =
        uploadError instanceof Error ? uploadError.message : "Failed to upload file";
      return res.status(400).json({ error: errorMessage });
    }

    try {
      const { name, portfolio, notes, role, email, contactEmail } = req.body ?? {};

      const applicantName = typeof name === "string" ? name.trim() : "";
      const applicantPortfolio = typeof portfolio === "string" ? portfolio.trim() : "";
      const applicantNotes = typeof notes === "string" ? notes.trim() : "";
      const jobRole = typeof role === "string" ? role.trim() : "";
      const jobEmail =
        typeof email === "string" && email.trim().length > 0
          ? email.trim()
          : "apply@tryblueprint.io";
      const applicantEmail = typeof contactEmail === "string" ? contactEmail.trim() : "";

      if (!applicantName || !applicantPortfolio || !jobRole || !jobEmail || !applicantEmail) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const file = (req as RequestWithFile).file ?? null;
      const attachmentSummary = file ? file.originalname : "No file attached";

      const subject = `Application for ${jobRole}: ${applicantName}`;
      const summaryLines = [
        `Name: ${applicantName}`,
        `Applicant email: ${applicantEmail}`,
        `Portfolio: ${applicantPortfolio}`,
        `Attachment: ${attachmentSummary}`,
      ];

      if (applicantNotes) {
        summaryLines.push(`Notes: ${applicantNotes}`);
      }

      const { sent } = await sendEmail({
        to: jobEmail,
        subject,
        text: summaryLines.join("\n"),
        attachments: file
          ? [
              {
                filename: file.originalname,
                content: file.buffer,
                contentType: file.mimetype,
              },
            ]
          : undefined,
      });

      const firstName = applicantName.split(" ")[0] || applicantName;
      const confirmationSubject = `Thanks for applying for the ${jobRole} role`;
      const confirmationText = [
        `Hi ${firstName},`,
        "",
        "Thanks for applying to collaborate with Blueprint.",
        `We’ll review your materials for the ${jobRole} role and reach out if the fit is right.`,
        "",
        "Appreciate you taking the time to share your work.",
        "",
        "The Blueprint Team",
      ].join("\n");

      const confirmationHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Thanks for applying</title>
  </head>
  <body style="margin:0;padding:0;background-color:#0b0b0b;font-family:Arial,Helvetica,sans-serif;color:#f8fafc;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0b0b0b;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background-color:#111827;border-radius:12px;padding:32px;">
            <tr>
              <td style="text-align:center;padding-bottom:16px;">
                <span style="display:inline-block;font-size:14px;letter-spacing:0.3em;color:#94a3b8;text-transform:uppercase;">Blueprint</span>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:16px;">
                <h1 style="margin:0 0 12px;font-size:26px;color:#f8fafc;">Thanks for applying</h1>
                <p style="margin:0 0 12px;font-size:16px;color:#cbd5f5;">Hi ${firstName},</p>
                <p style="margin:0 0 12px;font-size:16px;color:#cbd5f5;">
                  Thanks for applying to collaborate with Blueprint. We’ll review your materials for the ${jobRole} role and reach out if the fit is right.
                </p>
                <p style="margin:0 0 12px;font-size:16px;color:#cbd5f5;">Appreciate you taking the time to share your work.</p>
                <p style="margin:0;font-size:16px;color:#cbd5f5;">The Blueprint Team</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

      const confirmationResult = await sendEmail({
        to: applicantEmail,
        subject: confirmationSubject,
        text: confirmationText,
        html: confirmationHtml,
        replyTo: "ohstnhunt@gmail.com",
      });

      return res
        .status(sent ? 200 : 202)
        .json({ success: true, sent, confirmationSent: confirmationResult.sent });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Failed to process application" });
    }
  });
}
