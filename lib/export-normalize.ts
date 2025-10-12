export type TailoredContact = {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  [k: string]: any;
};

export type TailoredExperience = {
  company?: string;
  title?: string;
  dates?: string;
  bullets?: string[];
  [k: string]: any;
};

export type TailoredResume = {
  contact: TailoredContact;
  summary?: string;
  skills?: string[];
  experience: TailoredExperience[];
  education?: any[];
  [k: string]: any;
};

export function coerceArray<T>(v: any, def: T[] = []): T[] {
  return Array.isArray(v) ? v : def;
}

export function normalizeTailored(raw: any): TailoredResume {
  const contact = (raw?.contact && typeof raw.contact === 'object') ? raw.contact : {};
  const experience = coerceArray<TailoredExperience>(raw?.experience).map((e: any) => ({
    company: e?.company ?? '',
    title: e?.title ?? '',
    dates: e?.dates ?? '',
    bullets: coerceArray<string>(e?.bullets),
  }));

  return {
    contact,
    summary: typeof raw?.summary === 'string' ? raw.summary : '',
    skills: coerceArray<string>(raw?.skills),
    experience,
    education: coerceArray<any>(raw?.education),
  };
}
