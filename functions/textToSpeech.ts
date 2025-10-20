type Ref<T> = { current: T | null };

/**
 * Web-only client: call server TTS endpoint and play returned base64 MP3 via HTMLAudioElement.
 * No node / google-cloud code here.
 */
export async function playTextToSpeech(
  text: string,
  webAudioRef: Ref<HTMLAudioElement>,
  setIsSpeaking: (v: boolean) => void
) {
  if (!text || !text.trim()) return;

  setIsSpeaking(true);

  try {
    const root = (process.env.LOCAL_DEV_IP && process.env.LOCAL_DEV_IP.length)
      ? process.env.LOCAL_DEV_IP
      : "localhost";
    const serverUrl = `http://${root}:4000`;

    const resp = await fetch(`${serverUrl}/text-to-speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        voice: { languageCode: "en-US", ssmlGender: "NEUTRAL" },
        audioConfig: { audioEncoding: "MP3" },
      }),
    });

    if (!resp.ok) {
      console.error("TTS server error:", resp.status, await resp.text());
      setIsSpeaking(false);
      return;
    }

    const json = await resp.json();
    const base64 = json?.audioContent;
    if (!base64) {
      console.error("No audio returned from TTS endpoint", json);
      setIsSpeaking(false);
      return;
    }

    const dataUri = `data:audio/mp3;base64,${base64}`;
    const audioEl = new (globalThis as any).Audio(dataUri) as HTMLAudioElement;

    audioEl.onended = () => {
      setIsSpeaking(false);
      webAudioRef.current = null;
    };
    audioEl.onerror = (e: any) => {
      console.error("Web audio playback error:", e);
      setIsSpeaking(false);
      webAudioRef.current = null;
    };

    webAudioRef.current = audioEl;
    await audioEl.play();
  } catch (e) {
    console.error("playTextToSpeech error:", e);
    setIsSpeaking(false);
    if (webAudioRef.current) webAudioRef.current = null;
  }
}

export async function stopTextToSpeech(
  webAudioRef: Ref<HTMLAudioElement>,
  setIsSpeaking: (v: boolean) => void
) {
  try {
    if (webAudioRef.current) {
      try {
        webAudioRef.current.pause();
        webAudioRef.current.src = "";
      } catch {
        /* ignore */
      } finally {
        webAudioRef.current = null;
      }
    }
  } catch (e) {
    console.error("stopTextToSpeech error:", e);
  } finally {
    setIsSpeaking(false);
  }
}