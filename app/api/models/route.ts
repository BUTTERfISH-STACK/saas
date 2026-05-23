import { NextResponse } from 'next/server';

export async function GET() {
  const isProduction = process.env.VERCEL || process.env.NODE_ENV === 'production';
  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

  if (isProduction && ollamaBaseUrl.includes('localhost')) {
    return NextResponse.json(
      {
        models: [],
        error: 'Vercel deployment requires OLLAMA_BASE_URL set to a public Ollama server running your downloaded models (e.g. llama3.2:3b).',
      },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(`${ollamaBaseUrl}/api/tags`, { cache: 'no-store' });

    if (!res.ok) throw new Error('Vellon Core unreachable');

    const data = await res.json();
    const models = (data.models || []).map((m: any) => ({
      name: m.name,
      size: m.size,
      modified: m.modified_at,
    }));

    return NextResponse.json({ models });
  } catch (err) {
    return NextResponse.json(
      { models: [], error: 'Vellon Core unavailable. Local service required.' },
      { status: 503 }
    );
  }
}
