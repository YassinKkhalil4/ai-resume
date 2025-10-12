import { NextResponse } from 'next/server';
import { renderHTML } from '../../../lib/pdf-service-v2';  // your existing HTML builder
import { htmlToDocxSafe } from '../../../lib/html-to-docx';        // we'll add in step 3
import { ExportBody } from '../../../lib/types/export';

export const runtime = 'nodejs'; // keep node runtime on Vercel

export async function POST(req: Request) {
  try {
    const { format, template, options, session_snapshot }: ExportBody = await req.json();

    if (!session_snapshot) {
      return NextResponse.json({ code: 'bad_request', message: 'Missing session_snapshot' }, { status: 400 });
    }

    // Build printable HTML from snapshot and selected template
    const html = await renderHTML(session_snapshot.tailored, template, {
      includeSummary: options?.includeSummary ?? true,
      includeSkills: options?.includeSkills ?? true
    });

    if (format === 'docx') {
      const docx = await htmlToDocxSafe(html);
      return new Response(new Uint8Array(docx), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': 'attachment; filename="resume.docx"',
          'Cache-Control': 'no-store',
        },
      });
    }

    if (format === 'pdf') {
      const r = await fetch(`${process.env.PDF_RENDERER_URL}/render-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-renderer-key': process.env.RENDERER_KEY || '',
        },
        body: JSON.stringify({ html }),
        // @ts-ignore: Vercel's fetch supports a timeout init; if your TS complains, remove it.
        timeout: 30000,
      });

      const ct = (r.headers.get('content-type') || '').toLowerCase();
      if (!r.ok || !ct.startsWith('application/pdf')) {
        const body = await r.text().catch(() => '');
        return NextResponse.json(
          { code: 'pdf_generation_failed', message: body.slice(0, 300), status: r.status },
          { status: 502 },
        );
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
    return NextResponse.json(
      { code: 'export_exception', message: String(e?.message || e) },
      { status: 500 },
    );
  }
}