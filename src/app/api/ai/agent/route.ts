import { NextResponse } from 'next/server';
import { queryGemma } from '@/lib/ai/gemma';

export async function POST(req: Request) {
  try {
    const { prompt, lang = 'ur' } = await req.json();
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const systemPrompt = `You are DukaanVoice PK, an intelligent POS assistant for Pakistani retail shopkeepers.
You understand Urdu, Roman Urdu, and English.
You assist with sales bills, stock checks, customer Udhaar, and cash closing.
Always respond with practical, concise answers.`;

    const gemmaRaw = await queryGemma(prompt, systemPrompt);
    let parsed;
    try {
      parsed = JSON.parse(gemmaRaw);
    } catch {
      parsed = {
        intent: 'general',
        urduReply: gemmaRaw,
        englishReply: gemmaRaw,
      };
    }

    return NextResponse.json({
      success: true,
      data: parsed,
      model: 'google/gemma-2-2b-it (open-weights)',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Agent error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
