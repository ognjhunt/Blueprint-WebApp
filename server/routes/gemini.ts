import express from 'express';
import { PredictionServiceClient } from '@google-cloud/aiplatform';

const router = express.Router();

// Initialize Vertex AI client
const predictionClient = new PredictionServiceClient({
  apiEndpoint: `${process.env.GCP_LOCATION || 'us-central1'}-aiplatform.googleapis.com`
});

const projectId = process.env.GCP_PROJECT_ID;
const location = process.env.GCP_LOCATION || 'us-central1';
const publisher = 'google';
const model = 'gemini-pro-vision';

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

    const prompt = "Analyze this floor plan and provide insights about the layout, potential hotspots, and suggestions for improvement. Focus on spatial organization, traffic flow, and areas that could benefit from AR enhancements. Format the response with clear sections using markdown headings.";

    // Get the full model path
    const modelName = `projects/${projectId}/locations/${location}/publishers/${publisher}/models/${model}`;

    // Create the predict request
    const request = {
      endpoint: modelName,
      instances: [{
        content: {
          text: prompt,
          image: {
            bytesBase64Encoded: base64Image,
            mimeType: "image/jpeg"
          }
        }
      }],
      parameters: {
        temperature: 0.4,
        maxOutputTokens: 2048,
        topP: 1
      }
    };

    // Call predict API
    const [response] = await predictionClient.predict(request);

    if (!response || !response.predictions || !response.predictions[0]) {
      throw new Error('No analysis was generated');
    }

    const analysis = response.predictions[0].structValue?.fields?.content?.stringValue;
    
    if (!analysis) {
      throw new Error('Invalid response format from model');
    }

    res.json({ analysis });
  } catch (error) {
    console.error('Error analyzing floor plan:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to analyze floor plan' 
    });
  }
});

export default router;
