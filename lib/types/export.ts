export type TailoredContact = { name?: string; email?: string; phone?: string; location?: string };
export type TailoredExperience = { company: string; title: string; bullets: string[]; dates?: string };
export type TailoredResume = { contact: TailoredContact; experience: TailoredExperience[]; skills?: string[]; summary?: string };

export type ExportBody = {
  format: 'pdf' | 'docx';
  template: 'classic' | 'modern' | 'minimal';
  options?: { includeSummary?: boolean; includeSkills?: boolean };
  session_snapshot: { tailored: TailoredResume; [k: string]: any };
};
