import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { text, lang = 'ur' } = await req.json();
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    if (!apiKey) {
      // If no key provided in environment, signal client to use browser speech synthesis fallback
      return NextResponse.json({ useClientFallback: true }, { status: 200 });
    }

    // Default multilingual voice ID from ElevenLabs
    const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ useClientFallback: true });
    }

    const audioBuffer = await response.arrayBuffer();
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json({ useClientFallback: true });
  }
}
