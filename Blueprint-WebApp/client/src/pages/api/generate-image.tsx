import { Request, Response } from "express";

export default async function handler(
  req: Request,
  res: Response,
) {
  if (req.method === "POST") {
    try {
      const response = await fetch(
        "https://api.lumalabs.ai/dream-machine/v1/generations/image",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.LUMAAI_API_KEY}`,
          },
          body: JSON.stringify(req.body),
        },
      );
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  } else if (req.method === "GET") {
    // Polling: use the "id" query parameter to get the current generation status
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: "Missing generation id" });
    }
    try {
      const response = await fetch(
        `https://api.lumalabs.ai/dream-machine/v1/generations/${id}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.LUMAAI_API_KEY}`,
          },
        },
      );
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
