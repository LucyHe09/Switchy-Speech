import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error("Missing GEMINI_API_KEY in environment");
}

// Instantiate the official client; it will pick up credentials from env.
const ai = new GoogleGenAI({ apiKey: API_KEY });

/**
 * Generate text using Gemini. `contents` will be the prompt.
 * Returns the model's text output (string).
 */
export async function generateTranslation(
  text: string,
  targetLanguage = "en"
): Promise<string> {
  const prompt = `
You are an expert Chinese-English code-switching translator. Your task is to translate mixed Chinese and English (Chinglish) into fluent, natural English.

Rules:
- If Chinese words/phrases appear, translate them to natural English based on context
- Integrate Chinese translations smoothly with existing English parts
- Maintain the original meaning and intent
- Keep names, numbers, and proper nouns accurate
- If the input is already good English, make minimal improvements for fluency
- Do NOT output any Chinese characters or Pinyin in the final translation
- Return ONLY the final fluent English sentence

Input text: "${text}"

Fluent English translation:`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  // `response` may expose text in different fields depending on SDK version.
  const textOut = (response as any)?.text || (response as any)?.output?.[0]?.content || (response as any)?.output?.[0]?.text || (response as any)?.outputs?.[0]?.content;

  if (!textOut) {
    throw new Error("No text returned from Gemini client");
  }

  return String(textOut).trim();
}

export default ai;
