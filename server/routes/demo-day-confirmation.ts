import { Request, Response } from "express";
import * as admin from "firebase-admin";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin"; // Adjusted path and import to use dbAdmin as db

interface DemoDayConfirmationData {
    userId: string;
    blueprintId: string;
    mappingDate: string;
    mappingTime: string;
    demoDayDate: string;
    demoDayTime: string;
    organizationName: string;
    contactName: string;
    email: string;
}

export default async function demoDayConfirmationHandler(req: Request, res: Response) {
    try {
        const {
            userId,
            blueprintId,
            mappingDate,
            mappingTime,
            demoDayDate,
            demoDayTime,
            organizationName,
            contactName,
            email,
        }: DemoDayConfirmationData = req.body;

        // Basic Validation
        if (!userId || !blueprintId || !demoDayDate || !demoDayTime || !organizationName) {
            return res.status(400).json({ error: "Missing required fields for demo day confirmation." });
        }

        console.log(`Demo Day Confirmation for User ID: ${userId}, Blueprint ID: ${blueprintId}`);
        console.log(`Org: ${organizationName}, Contact: ${contactName}, Email: ${email}`);
        console.log(`Mapping: ${mappingDate} at ${mappingTime}`);
        console.log(`Demo Day: ${demoDayDate} at ${demoDayTime}`);

        // Example: Log to Firestore (optional, could be a different collection or just log)
        // await db.collection("demoDayConfirmations").add({
        //     userId,
        //     blueprintId,
        //     organizationName,
        //     contactName,
        //     email,
        //     mappingDate,
        //     mappingTime,
        //     demoDayDate,
        //     demoDayTime,
        //     confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
        // });

        // Placeholder for sending notifications or other actions (e.g., Zapier webhook)
        // For example, sending a simple Slack message or email to the team.
        // This part would typically involve another SDK or HTTP request to a service.
        console.log("TODO: Implement Demo Day notification logic here (e.g., email team, update CRM).");


        // Respond with success
        res.status(200).json({
            success: true,
            message: "Demo Day confirmation processed.",
            data: req.body,
        });

    } catch (error: any) {
        console.error("Error processing demo day confirmation:", error);
        res.status(500).json({
            error: "Failed to process demo day confirmation.",
            details: error.message,
        });
    }
}
