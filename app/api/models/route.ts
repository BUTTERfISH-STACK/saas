import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const base = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const res = await fetch(`${base}/api/tags`, { cache: 'no-store' });

    if (!res.ok) throw new Error('Ollama unreachable');

    const data = await res.json();
    const models = (data.models || []).map((m: any) => ({
      name: m.name,
      size: m.size,
      modified: m.modified_at,
    }));

    return NextResponse.json({ models });
  } catch (err) {
    return NextResponse.json(
      { models: [], error: 'Ollama not reachable. Run: ollama serve' },
      { status: 503 }
    );
  }
}
