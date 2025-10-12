import { NextResponse } from 'next/server';
import { renderHTML } from '../../../lib/pdf-service-v2';
import { htmlToDocxSafe } from '../../../lib/html-to-docx';
import { normalizeTailored } from '../../../lib/export-normalize';

export const runtime = 'nodejs';

type ExportBody = {
  format: 'pdf' | 'docx';
  template: 'classic' | 'modern' | 'minimal';
  options?: { includeSummary?: boolean; includeSkills?: boolean };
  session_snapshot: any; // UI preview JSON
};

export async function POST(req: Request) {
  try {
    const body = await req.json() as ExportBody;

    if (!body?.session_snapshot) {
      return NextResponse.json({ code: 'bad_request', message: 'Missing session_snapshot' }, { status: 400 });
    }

    // Accept both shapes:
    //  - { tailored: {...} }
    //  - {...}   (if user passed the tailored directly)
    const rawTailored = body.session_snapshot?.tailored ?? body.session_snapshot;
    
    // Guard to surface bad payloads
    if (!rawTailored || typeof rawTailored !== 'object') {
      console.error('Export bad payload snapshot shape', JSON.stringify(body).slice(0, 1000));
      return NextResponse.json({ code: 'bad_snapshot', message: 'Invalid snapshot shape' }, { status: 400 });
    }
    
    const tailored = normalizeTailored(rawTailored); // <- never undefined now

    const html = await renderHTML(tailored, body.template, {
      includeSummary: body.options?.includeSummary ?? true,
      includeSkills: body.options?.includeSkills ?? true
    });

    if (body.format === 'docx') {
      const docx = await htmlToDocxSafe(html);
      return new Response(new Uint8Array(docx), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': 'attachment; filename="resume.docx"',
          'Cache-Control': 'no-store',
        },
      });
    }

    if (body.format === 'pdf') {
      const r = await fetch(`${process.env.PDF_RENDERER_URL}/render-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-renderer-key': process.env.RENDERER_KEY || '',
        },
        body: JSON.stringify({ html }),
        // @ts-ignore
        timeout: 30000,
      });

      const ct = (r.headers.get('content-type') || '').toLowerCase();
      if (!r.ok || !ct.startsWith('application/pdf')) {
        const text = await r.text().catch(() => '');
        return NextResponse.json({ code: 'pdf_generation_failed', message: text.slice(0, 400) }, { status: 502 });
      }

      const pdf = Buffer.from(await r.arrayBuffer());
      return new Response(pdf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="resume.pdf"',
          'Cache-Control': 'no-store',
        },
      });
    }

    return NextResponse.json({ code: 'bad_request', message: 'Unknown format' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ code: 'export_exception', message: String(e?.message || e) }, { status: 500 });
  }
}