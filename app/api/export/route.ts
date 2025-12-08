import { NextRequest, NextResponse } from 'next/server';
import { renderHTML, htmlToPDF } from '../../../lib/pdf-service-v2';
import { htmlToDocxSafe } from '../../../lib/html-to-docx';
import { normalizeTailored } from '../../../lib/export-normalize';
import { enforceGuards } from '../../../lib/guards';
import { getConfig } from '../../../lib/config';

export const runtime = 'nodejs';

type ExportBody = {
  format: 'pdf' | 'docx';
  template: 'classic' | 'modern' | 'minimal';
  options?: { includeSummary?: boolean; includeSkills?: boolean };
  session_snapshot: any; // UI preview JSON
};

export async function POST(req: NextRequest) {
  try {
    const guard = enforceGuards(req);
    if (!guard.ok) return guard.res;

    const cfg = getConfig();
    if (cfg.pauseExport) {
      return NextResponse.json(
        { code: 'export_paused', message: 'Exporting is temporarily disabled by the administrator.' },
        { status: 503 }
      );
    }

    const body = await req.json() as ExportBody;

    if (!body?.session_snapshot) {
      return NextResponse.json({ code: 'bad_request', message: 'Missing session_snapshot' }, { status: 400 });
    }

    const template = body.template || 'minimal';
    if (!['classic', 'modern', 'minimal'].includes(template)) {
      return NextResponse.json({ code: 'bad_template', message: 'Unsupported template requested' }, { status: 400 });
    }

    const format = body.format || 'pdf';
    if (!['pdf', 'docx'].includes(format)) {
      return NextResponse.json({ code: 'bad_format', message: 'Unsupported export format requested' }, { status: 400 });
    }

    const snapshot = body.session_snapshot;
    if (!snapshot || typeof snapshot !== 'object') {
      console.error('Export bad payload snapshot shape', JSON.stringify(body).slice(0, 1000));
      return NextResponse.json({ code: 'bad_snapshot', message: 'Invalid snapshot shape' }, { status: 400 });
    }

    const tailored = normalizeTailored(snapshot, {
      fallbackContact: snapshot?.original_sections_json?.contact ?? snapshot?.contact,
      fallbackEducation: snapshot?.original_sections_json?.education,
      fallbackCertifications: snapshot?.original_sections_json?.certifications,
      fallbackProjects: snapshot?.original_sections_json?.projects,
      fallbackAdditional: snapshot?.original_sections_json?.additional_sections,
    });

    const html = await renderHTML(tailored, template as 'classic' | 'modern' | 'minimal', {
      includeSummary: body.options?.includeSummary ?? true,
      includeSkills: body.options?.includeSkills ?? true
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
      const pdfBuffer = await htmlToPDF(html);
      const pdf = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
      return new Response(new Uint8Array(pdf), {
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
