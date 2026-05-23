import { z } from 'zod';

const DEFAULT_MODEL = 'llama3.2:3b';

const chatRequestSchema = z.object({
  messages: z.array(z.any()),
  model: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, model = DEFAULT_MODEL } = chatRequestSchema.parse(body);

    const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

    // On Vercel/production, we require a remote Ollama URL (user must expose Ollama publicly)
    const isProduction = process.env.VERCEL || process.env.NODE_ENV === 'production';
    if (isProduction && ollamaBaseUrl.includes('localhost')) {
      return new Response(
        JSON.stringify({
          error: 'Configuration required for Vercel',
          detail: 'The Vercel deployment requires OLLAMA_BASE_URL to be set to a publicly accessible Ollama server (e.g. running on a VPS). Localhost will never work from Vercel.\n\nSee docs for how to expose your local models.',
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const ollamaUrl = ollamaBaseUrl + '/api/chat';

    const ollamaMessages = messages.map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    }));

    const systemPrompt = `You are VellonCVs, an expert private AI career coach and ATS optimization specialist.

You help users rewrite and optimize their CVs/resumes for maximum impact and ATS compatibility.
Rules you MUST follow:
- Be truthful: NEVER invent jobs, titles, dates, companies, degrees, or metrics.
- Only use information the user has provided in the conversation or uploaded CV.
- When the user has not uploaded a CV yet, ask for it or guide them.
- Prefer strong action verbs, quantification, and clean ATS-friendly language.

You run entirely within the Vellon private intelligence layer. Be helpful, precise, and protective of the user’s career data.`;

    const ollamaPayload = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...ollamaMessages,
      ],
      stream: true,
      options: {
        temperature: 0.4,
      },
    };

    const ollamaRes = await fetch(ollamaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ollamaPayload),
    });

    if (!ollamaRes.ok) {
      const errText = await ollamaRes.text();
      throw new Error(`Vellon Core error: ${errText}`);
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = ollamaRes.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value);
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              const data = JSON.parse(line);
              if (data.message?.content) {
                controller.enqueue(encoder.encode(`0:${JSON.stringify(data.message.content)}\n`));
              }
              if (data.done) {
                controller.enqueue(encoder.encode('d:{"finishReason":"stop"}\n'));
              }
            } catch {}
          }
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Vercel-AI-Data-Stream': 'v1',
      },
    });
  } catch (error: any) {
    console.error('VellonCVs chat error:', error);

    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('fetch failed')) {
      return new Response(
        JSON.stringify({
          error: 'Vellon Core unavailable',
          detail: 'The private AI engine is not responding.\nPlease ensure the local service is running.',
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Failed to generate response', detail: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
