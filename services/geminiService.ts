
import { GoogleGenAI } from "@google/genai";
import { APP_CONFIG } from '../constants';
import { SalesData, InventoryData, SupplierData, LogisticsData } from '../types';

// Robust initialization
const getAI = () => {
  const key = process.env.API_KEY;
  if (!key || key === '') {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey: key });
};

export const getChainAnalysis = async (
  prompt: string, 
  sales: SalesData[], 
  inventory: InventoryData[], 
  suppliers: SupplierData[], 
  logistics: LogisticsData[]
) => {
  try {
    const ai = getAI();
    const context = `
      Current Supply Chain Context:
      1. Sales Data: ${JSON.stringify(sales)}
      2. Inventory: ${JSON.stringify(inventory)}
      3. Suppliers: ${JSON.stringify(suppliers)}
      4. Logistics: ${JSON.stringify(logistics)}

      Role: You are 'ChainMind', a senior supply chain strategist.
      Language: Hinglish (Hindi + English). 
      Task: Help the manager with tactical decisions. 
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: context + "\nUser Query: " + prompt,
      config: {
        tools: [{ googleMaps: {} }, { googleSearch: {} }]
      }
    });
    
    const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    let text = response.text || "";
    
    if (grounding && grounding.length > 0) {
      text += "\n\n**Related Sources & Locations:**";
      grounding.forEach((chunk: any) => {
        if (chunk.maps) {
          text += `\n- [${chunk.maps.title}](${chunk.maps.uri})`;
        } else if (chunk.web) {
          text += `\n- [${chunk.web.title}](${chunk.web.uri})`;
        }
      });
    }
    
    return text;
  } catch (error: any) {
    if (error.message === "API_KEY_MISSING") {
      return "Opps! Vercel settings mein 'API_KEY' missing hai. Please check environment variables.";
    }
    console.error("Gemini Error:", error);
    return "I encountered an error. Please ensure your API key is valid and active.";
  }
};

export const getSystemSummary = async (
  sales: SalesData[], 
  inventory: InventoryData[], 
  suppliers: SupplierData[] = [], 
  logistics: LogisticsData[] = []
) => {
  try {
    const ai = getAI();
    const prompt = `Context: Sales: ${JSON.stringify(sales)}, Inventory: ${JSON.stringify(inventory)}
    Analyze and return JSON:
    {
      "forecast": { "number": 1200, "explanation": "text" },
      "risk": { "level": "text", "days": 5, "explanation": "text" },
      "procurement": { "units": 500, "supplier": "text", "reason": "text", "timing": "text" },
      "logistics": { "route": "text", "delays": "text", "advice": "text" }
    }`;

    const response = await ai.models.generateContent({
      model: APP_CONFIG.MODELS.text,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text);
  } catch (error) {
    return null;
  }
};

export const getSupplierComparison = async (suppliers: SupplierData[], urgent: boolean = false) => {
  try {
    const ai = getAI();
    const prompt = `Compare suppliers for ${urgent ? 'URGENT' : 'regular'} order: ${JSON.stringify(suppliers)}. Return JSON.`;
    const response = await ai.models.generateContent({
      model: APP_CONFIG.MODELS.text,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text);
  } catch (error) {
    return null;
  }
};
