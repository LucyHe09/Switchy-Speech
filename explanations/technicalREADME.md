# Switchy Speech — Technical README

This document explains the tech stack, file map, end-to-end user flows (record → transcribe → translate → TTS), API contracts, common edge cases, debugging tips, and suggested small improvements. It's written for a junior developer joining the codebase.

## Table of contents
- Tech stack
- Project layout and important files
- End-to-end user flow (step-by-step)
- API contracts
- Local development notes (server & client)
- Edge cases and QA checklist
- Debugging tips
- Suggested small improvements
- Next steps for contributors


## Tech stack
- Backend: Node.js + TypeScript with Express.
  - Uses Google Cloud SDKs on the server (`@google-cloud/speech`, optionally `@google-cloud/text-to-speech`).
  - Server entry: `index.ts` at project root.
- Client: Expo (React Native) + TypeScript.
  - Located in `client/` and supports web, iOS, and Android builds.
  - Uses `expo-av` for audio recording/playback and `expo-file-system` for reading files.
- LLM/translation: `translateWithGemini` (server-side) is mounted at `/translate-with-gemini` and likely calls the Gemini model.
- Environment: expects Google credentials on the server (service account JSON or environment variables) and local dev IP/host config via `process.env.LOCAL_DEV_IP` when running on device/web.


## Project layout (important files)
- Root
  - `index.ts` — Express server bootstrapping and route registration.
  - `functions/`
    - `speechToText.ts` — handler for POST `/speech-to-text` (calls Google Speech-to-Text).
    - `translateWithGemini.ts` — handler for POST `/translate-with-gemini` (LLM translation; implementation not shown here).
    - `textToSpeechRoute.ts` — commented example of Google Text-to-Speech route (can be enabled).
    - `geminiClient.ts`, `textToSpeech.ts` — auxiliary utilities.
- `client/`
  - `app/index.tsx` — main screen UI and orchestration for record/transcribe/translate/TTS.
  - `functions/recordSpeech.tsx` — prepares and starts recordings using `expo-av`.
  - `functions/transcribeSpeech.tsx` — stops recording, reads recording as base64, posts to `/speech-to-text` and parses transcript.
  - `functions/textToSpeech.ts` — web-only helper that posts to `/text-to-speech` and plays returned base64 MP3 via an HTMLAudioElement.
  - `hooks/useWebFocus.ts` — small hook detecting browser focus (used to manage mic permissions on web).


## End-to-end user flow
This describes the happy path: user records, the app transcribes, user requests translation, optional TTS playback.

1) Recording
   - UI calls `startRecording()` which invokes `recordSpeech(audioRecordingRef, setIsRecording, alreadyReceivedPermission)`.
   - `recordSpeech` uses `Audio.Recording` from `expo-av`, requests permissions (except web), prepares platform-specific recording options, and starts recording.

2) Stop + Transcribe
   - UI calls `stopRecording()` which calls `transcribeSpeech(audioRecordingRef)`.
   - `transcribeSpeech` stops/unloads the recording and reads the recorded file URI to base64:
     - Web: fetch the blob and convert to base64 (strip `data:*;base64,` prefix).
     - Mobile: `FileSystem.readAsStringAsync(recordingUri, { encoding: Base64 })`.
   - Builds `audioConfig` (encoding, sampleRateHertz, languageCode, etc.) and POSTs to server `/speech-to-text` with `{ audioUrl: base64, config }`.

3) Server STT
   - `index.ts` routes the request to `functions/speechToText.ts`.
   - `speechToText.ts` builds a request compatible with `v1p1beta1.SpeechClient.recognize()` and sends it to Google.
   - Server returns Google's response JSON to the client.

4) Client reads transcript
   - `transcribeSpeech` extracts `results[0].alternatives[0].transcript` and returns it to the UI.
   - UI sets `transcribedSpeech` state and displays the content.

5) Translation
   - UI calls `translateText()` which POSTs `{ text: transcribedSpeech, targetLanguage }` to `/translate-with-gemini`.
   - Server uses Gemini (or other LLM) to translate, returns JSON, and client sets `translationResult`.

6) Text-to-Speech (optional, web-focused)
   - Client `playTextToSpeech()` posts `{ text, voice, audioConfig }` to `/text-to-speech`.
   - Server (when enabled) synthesizes speech with Google TTS and returns `{ audioContent: "<base64 mp3>" }`.
   - Client constructs `data:audio/mp3;base64,<base64>` and plays via `new Audio(dataUri)`.


## API contracts
- POST /speech-to-text
  - Request JSON:
    - `audioUrl`: string — base64 audio content (no `data:` prefix)
    - `config`: object — fields like `encoding`, `sampleRateHertz`, `languageCode`, `alternativeLanguageCodes`, `enableAutomaticPunctuation`.
  - Success: returns the raw Google Speech `recognize` response JSON (contains `results`, each with `alternatives` and `transcript`).
  - Errors:
    - 422 when `audioUrl` or `config` is missing.
    - 500 for Google/other errors.

- POST /translate-with-gemini
  - Request JSON:
    - `text`: string
    - `targetLanguage`: string (e.g., "en")
  - Success: JSON containing translation, typically `{ translation: string }` (client expects `json.translation`).
  - Errors: server-defined; client logs and displays simple error text if the response is not ok.

- POST /text-to-speech (optional)
  - Request JSON:
    - `text`: string
    - `voice`: object (optional) e.g. `{ languageCode: "en-US", ssmlGender: "NEUTRAL" }`
    - `audioConfig`: object e.g. `{ audioEncoding: "MP3" }`
  - Success: `{ audioContent: "<base64 mp3>" }`.
  - Errors: 400 for missing text, 500 for TTS failures.


## Local development notes
- Server
  - Runs at port 4000 by default.
  - Express JSON limit increased to `50mb` in `index.ts` to accept larger base64 payloads.
  - Ensure Google credentials are available to the server, typically via `GOOGLE_APPLICATION_CREDENTIALS` environment variable pointing to your service account JSON (e.g., `switchy2-<id>.json`).

- Client (Expo)
  - For web, `process.env.LOCAL_DEV_IP` can be set when your dev machine is reachable at an IP (useful for mobile devices or remote browsers).
  - On device or emulator, `localhost` may not be the correct host. Use emulator-specific hosts (Android emulator `10.0.2.2`) or your machine IP.


## Edge cases and QA checklist
- Mic permissions denied (web & mobile).
- Recording format vs encoding mismatch (e.g., web WebM but server expects LINEAR16).
- Very large recordings may exceed memory/JSON body limits—test with long clips.
- Google API rate limits, authentication errors (missing/invalid credentials).
- Partial or empty `results` from Google Speech.
- Network issues between mobile devices and host (CORS, wrong host, blocked ports).

Quick QA tests:
- Test short recorded clip on web, mobile emulator, and a physical device.
- Intentionally send a small invalid body to `/speech-to-text` and verify 422 handling.
- Test `/translate-with-gemini` with short and long inputs.
- Test TTS route if enabled by sending a short sentence and verifying playback.


## Debugging tips
- Log server responses (`console.log(response)`) in `speechToText.ts` to inspect Google payloads.
- Confirm the base64 uploaded from client is raw base64 (no data: prefix) — otherwise Google will reject it.
- If recognition quality is poor, confirm sample rate and encoding match recorded audio.
- When mobile can't reach the server, swap `localhost` for your machine IP and ensure firewall/port 4000 is open.


## Suggested small improvements (low-risk)
- Add validation and clearer error responses in `speechToText.ts` (detailed 4xx payload errors rather than generic 500s).
- Normalize or convert audio to a single encoding on the client before sending (e.g., convert to LINEAR16 if possible), or add explicit per-platform encoding sanity checks server-side.
- Add server-side file size check and early rejection with helpful message.
- Enable and secure `textToSpeechRoute.ts` if you want direct TTS support. Use environment flags to allow enabling for local dev only.
- Add a small integration test script (node script or jest) that posts a static base64 audio clip to `/speech-to-text` and asserts a non-empty transcript.


## Next steps for contributors
- Read `functions/translateWithGemini.ts` to understand or tune LLM prompts.
- If TTS is needed, enable `functions/textToSpeechRoute.ts` and install `@google-cloud/text-to-speech` on the server side.
- Improve error handling and add unit/integration tests for endpoints.


---

If you want, I can now:
- Add the API contract section to `README` as JSON examples (more explicit),
- Implement one of the small improvements (validation or enabling TTS), or
- Generate a tiny integration test that posts a short base64 audio file to `/speech-to-text`.

Which would you like next?