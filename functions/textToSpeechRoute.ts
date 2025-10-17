// import express from "express";
// import textToSpeech from "@google-cloud/text-to-speech";

// const router = express.Router();
// const client = new textToSpeech.TextToSpeechClient();

// // POST /text-to-speech
// router.post("/text-to-speech", async (req, res) => {
//   try {
//     const { text, voice, audioConfig } = req.body;
//     if (!text || !text.trim()) return res.status(400).json({ error: "Missing text" });

//     const request = {
//       input: { text },
//       voice: voice || { languageCode: "en-US", ssmlGender: "NEUTRAL" },
//       audioConfig: audioConfig || { audioEncoding: "MP3" },
//     };

//     const [response] = await client.synthesizeSpeech(request);
//     if (!response || !response.audioContent) {
//       return res.status(500).json({ error: "No audio returned from TTS" });
//     }

//     const base64 = Buffer.from(response.audioContent).toString("base64");
//     res.json({ audioContent: base64 });
//   } catch (err: any) {
//     console.error("TTS error:", err);
//     res.status(500).json({ error: "Text-to-speech failed", details: err.message || err });
//   }
// });

// export default router;
