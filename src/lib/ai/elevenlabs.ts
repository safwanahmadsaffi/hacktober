/**
 * DukaanVoice AI - ElevenLabs Natural Voice & Audio Feedback Integration
 * Provides crystal-clear voice responses for counter sales, billing totals,
 * and low-stock verbal alerts in Urdu and English.
 */

export async function speakText(text: string, lang: 'ur' | 'en' = 'ur'): Promise<void> {
  if (typeof window === 'undefined') return;

  // 1. Try ElevenLabs API endpoint if key is configured
  try {
    const res = await fetch('/api/ai/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang }),
    });

    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 0 && blob.type.includes('audio')) {
        const audio = new Audio(URL.createObjectURL(blob));
        await audio.play();
        return;
      }
    }
  } catch (err) {
    // Continue to browser Web Speech API
  }

  // 2. High-speed local browser Web Speech API fallback
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'ur' ? 'ur-PK' : 'en-US';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }
}
