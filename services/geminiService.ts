
import { GoogleGenAI } from "@google/genai";
import { Cow, InseminationRecord } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getCattleAdvice = async (cows: Cow[], inseminations: InseminationRecord[], query: string) => {
  const context = `
    You are an expert livestock veterinarian and dairy farm consultant. 
    A farmer is asking for advice. Here is their current herd data:
    Total Cows: ${cows.length}
    Cows: ${cows.map(c => `${c.name} (Tag: ${c.tagNumber}, DOB: ${c.dob})`).join(', ')}
    Insemination Records: ${inseminations.map(i => {
      const cow = cows.find(c => c.id === i.cowId);
      return `Cow ${cow?.name} was inseminated on ${i.date}. Confirmed: ${i.isConfirmed}`;
    }).join('; ')}

    Provide practical, supportive, and scientifically sound advice for a dairy farmer. 
    Keep responses concise and easy to understand.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: query,
      config: {
        systemInstruction: context,
        temperature: 0.7,
      },
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "I'm having trouble connecting to the AI consultant right now. Please try again later.";
  }
};
