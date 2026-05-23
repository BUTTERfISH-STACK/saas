import { NextRequest } from 'next/server';

const PYTHON_BACKEND = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  
  try {
    const res = await fetch(`${PYTHON_BACKEND}/orchestrate/resume`, {
      method: 'POST',
      body: formData,
    });
    
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch (error: any) {
    return Response.json(
      { success: false, message: 'Failed to reach Vellon Core orchestrator. Is the Python backend running on port 8000?' },
      { status: 503 }
    );
  }
}
