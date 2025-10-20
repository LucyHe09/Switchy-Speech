import { Request, Response } from "express";
import { generateTranslation } from "./geminiClient";

export const translateWithGemini = async (req: Request, res: Response) => {
  try {
    const { text, targetLanguage } = req.body || {};

    if (!text || typeof text !== "string") {
      return res.status(422).json({ error: "`text` (string) is required in the request body" });
    }

    // Basic length guard to avoid sending huge requests to the LLM.
    if (text.length > 50_000) {
      return res.status(413).json({ error: "Input too large" });
    }

    const target = typeof targetLanguage === "string" && targetLanguage.length ? targetLanguage : "en";

    const translation = await generateTranslation(text, target);

    return res.json({ translation });
  } catch (err: any) {
    console.error("translateWithGemini error:", err);
    const message = err?.message || "Unknown error";
    return res.status(500).json({ error: message });
  }
};
