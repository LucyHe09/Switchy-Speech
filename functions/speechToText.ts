import { Request, Response } from "express";
import { v1p1beta1 } from "@google-cloud/speech";

const client = new v1p1beta1.SpeechClient();

export const speechToText = async (req: Request, res: Response) => {
  const data = req.body;
  const audioBase64 = data?.audioUrl; // expect plain base64 (no data:* prefix)
  const audioConfig = data?.config;

  if (!audioBase64) return res.status(422).send("No audio URL was provided.");
  if (!audioConfig)
    return res.status(422).send("No audio config was provided.");

  try {
    // Build request compatible with v1p1beta1
    const request: any = {
      config: {
        encoding: audioConfig.encoding || "LINEAR16",
        sampleRateHertz: audioConfig.sampleRateHertz || 44100,
        languageCode: audioConfig.languageCode || "en-US",
        alternativeLanguageCodes: ["zh-CN"],
        enableAutomaticPunctuation: audioConfig.enableAutomaticPunctuation ?? true,
        // add other config fields as needed
      },
      audio: {
        content: audioBase64,
      },
    };

    const [response] = await client.recognize(request);
    return res.json(response);
  } catch (err) {
    console.error("Error converting speech to text: ", err);
    res.status(500).send(err);
    return err;
  }
};