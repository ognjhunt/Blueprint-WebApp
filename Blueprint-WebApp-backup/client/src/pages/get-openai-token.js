export default async function handler(req, res) {
  try {
    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${"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"}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini-realtime-preview-2024-12-17",
          voice: "echo",
        }),
      },
    );

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error("Error getting OpenAI token:", error);
    res.status(500).json({ error: "Failed to get OpenAI token" });
  }
}
