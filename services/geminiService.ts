
import { GoogleGenAI, Type } from "@google/genai";
import { APP_CONFIG } from '../constants';
import { SalesData, InventoryData, SupplierData, LogisticsData } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const getChainAnalysis = async (
  prompt: string, 
  sales: SalesData[], 
  inventory: InventoryData[], 
  suppliers: SupplierData[], 
  logistics: LogisticsData[]
) => {
  const context = `
    Current Supply Chain Context:
    1. Sales Data: ${JSON.stringify(sales)}
    2. Inventory: ${JSON.stringify(inventory)}
    3. Suppliers: ${JSON.stringify(suppliers)}
    4. Logistics: ${JSON.stringify(logistics)}

    Role: You are 'ChainMind', a professional GenAI assistant for Supply Chain Managers.
    Tone: Professional, supportive, and clear. Use Hinglish (mixture of Hindi and English).
    Formatting Instructions: 
    - DO NOT use excessive '#' or '*' symbols. 
    - Use simple, clean text. 
    - Use single bold points (e.g. **Point**) only for emphasis.
    - Keep responses concise and easy to read for a non-technical manager.
    - No nested bullet points or multiple levels of headings.
    
    User Query: ${prompt}
  `;

  try {
    const response = await ai.models.generateContent({
      model: APP_CONFIG.MODELS.text,
      contents: context,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "I'm sorry, I encountered an error while analyzing your supply chain data. Please try again.";
  }
};

export const getSystemSummary = async (
  sales: SalesData[], 
  inventory: InventoryData[], 
  suppliers: SupplierData[] = [], 
  logistics: LogisticsData[] = []
) => {
  const prompt = `
    Context:
    Sales: ${JSON.stringify(sales)}
    Inventory: ${JSON.stringify(inventory)}
    Logistics: ${JSON.stringify(logistics)}

    Analyze the current data and provide a summary for the dashboard:
    1. Next 7-day Demand Forecast (Provide a single total number and explanation).
    2. Stockout Risk (High/Medium/Low and days left).
    3. Procurement Recommendation (Supplier choice and order quantity).
    4. Logistics Insight (Best route).

    Output format: Return JSON only. 
    Important: Keep explanations short and avoid special formatting characters inside the JSON values.
    Schema:
    {
      "forecast": { "number": number, "explanation": "text" },
      "risk": { "level": "text", "days": number, "explanation": "text" },
      "procurement": { "units": number, "supplier": "text", "reason": "text", "timing": "text" },
      "logistics": { "route": "text", "delays": "text", "advice": "text" }
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: APP_CONFIG.MODELS.text,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Summary Error:", error);
    return null;
  }
};

export const getSupplierComparison = async (
  suppliers: SupplierData[],
  urgent: boolean = false
) => {
  const prompt = `
    Task: Compare the following suppliers for an ${urgent ? 'URGENT' : 'standard'} procurement request.
    Suppliers: ${JSON.stringify(suppliers)}

    Parameters to weigh: 
    - Cost (Standard vs Premium)
    - Reliability (High/Medium/Low)
    - Lead Time (Speed of delivery)

    Provide a side-by-side comparison and a clear winner for the current context.
    Output format: JSON only.
    Schema:
    {
      "comparison": [
        { "name": "string", "score": number, "pros": ["string"], "cons": ["string"], "rank": number }
      ],
      "winner": {
        "name": "string",
        "reasoning": "string (Hinglish)"
      },
      "urgentAdvice": "string (Hinglish advice for the manager)"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: APP_CONFIG.MODELS.text,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Comparison Error:", error);
    return null;
  }
};
