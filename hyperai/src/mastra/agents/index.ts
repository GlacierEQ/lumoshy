import { createQwen } from 'qwen-ai-provider';

import { Agent } from '@mastra/core/agent';
import { weatherTool } from '../tools';
const qwen = createQwen({
  apiKey: process.env.QWEN_API_KEY || "sk-bc977c4e31e542f1a34159cb42478198",
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
});
export const weatherAgent = new Agent({
  name: 'Weather Agent',
  instructions: `
      You are a helpful weather assistant that provides accurate weather information.

      Your primary function is to help users get weather details for specific locations. When responding:
      - Always ask for a location if none is provided
      - If the location name isn’t in English, please translate it
      - If giving a location with multiple parts (e.g. "New York, NY"), use the most relevant part (e.g. "New York")
      - Include relevant details like humidity, wind conditions, and precipitation
      - Keep responses concise but informative

      Use the weatherTool to fetch current weather data.
`,
model: qwen('qwen-plus-2024-12-20'),
tools: { weatherTool },
});
