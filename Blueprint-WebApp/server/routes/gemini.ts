import express from 'express';
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = express.Router();

// Initialize Gemini-pro-vision
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

router.post('/analyze', async (req, res) => {
  try {
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ error: "Image URL is required" });
    }

    // Convert image to base64
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');

    // Initialize the model
    const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });

    // Create the prompt and image data
    const prompt = "Analyze this floor plan and provide insights about the layout, potential hotspots, and suggestions for improvement. Focus on spatial organization, traffic flow, and areas that could benefit from AR enhancements.";
    
    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: "image/jpeg"
      }
    };

    // Generate content
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const analysis = response.text();

    res.json({ analysis });
  } catch (error) {
    console.error('Error analyzing floor plan:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to analyze floor plan' 
    });
  }
});

export default router;