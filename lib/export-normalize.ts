export type TailoredContact = {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  [k: string]: any;
};

export type TailoredExperience = {
  company?: string;
  role?: string;
  title?: string;
  dates?: string;
  location?: string;
  bullets: string[];
  [k: string]: any;
};

export type TailoredProject = { name: string; bullets: string[] };
export type TailoredAdditionalSection = { heading: string; lines: string[] };

export type TailoredResume = {
  contact: TailoredContact;
  summary?: string;
  skills: string[];
  experience: TailoredExperience[];
  education: string[];
  certifications: string[];
  projects: TailoredProject[];
  additional_sections: TailoredAdditionalSection[];
};

export function coerceArray<T>(v: any, def: T[] = []): T[] {
  return Array.isArray(v) ? v : def;
}

export function coerceStringArray(v: any, splitter: RegExp = /[\n\r•;,]+/): string[] {
  if (Array.isArray(v)) {
    return v
      .map(item => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }
  if (typeof v === 'string') {
    return v
      .split(splitter)
      .map(item => item.trim())
      .filter(Boolean);
  }
  return [];
}

type NormalizeOptions = {
  fallbackContact?: Record<string, any>;
  fallbackEducation?: any;
  fallbackCertifications?: any;
  fallbackProjects?: any;
  fallbackAdditional?: any;
};

const toContact = (primary: any, fallback?: any): TailoredContact => {
  const src = (primary && typeof primary === 'object' ? primary : null) ||
    (fallback && typeof fallback === 'object' ? fallback : {}) ||
    {};

  const contact: TailoredContact = { ...src };

  const first = typeof src.first_name === 'string' ? src.first_name.trim() : '';
  const last = typeof src.last_name === 'string' ? src.last_name.trim() : '';
  const full = typeof src.full_name === 'string' ? src.full_name.trim() : '';
  const name = typeof src.name === 'string' ? src.name.trim() : (full || [first, last].filter(Boolean).join(' ')).trim();
  if (name) contact.name = name;

  if (typeof src.email === 'string') contact.email = src.email.trim();
  else if (typeof src.mail === 'string') contact.email = src.mail.trim();

  if (typeof src.phone === 'string') contact.phone = src.phone.trim();
  else if (typeof src.phone_number === 'string') contact.phone = src.phone_number.trim();

  if (typeof src.location === 'string') {
    contact.location = src.location.trim();
  } else {
    const locParts = [src.city, src.state || src.region, src.country]
      .map(part => (typeof part === 'string' ? part.trim() : ''))
      .filter(Boolean);
    if (locParts.length) contact.location = locParts.join(', ');
  }

  return contact;
};

const normalizeExperience = (items: any[]): TailoredExperience[] => {
  return coerceArray<any>(items).map(exp => {
    if (!exp || typeof exp !== 'object') return null;
    const company =
      typeof exp.company === 'string' ? exp.company.trim() :
      typeof exp.employer === 'string' ? exp.employer.trim() : '';

    const role =
      typeof exp.role === 'string' ? exp.role.trim() :
      typeof exp.title === 'string' ? exp.title.trim() : '';

    const dates =
      typeof exp.dates === 'string' ? exp.dates.trim() :
      [exp.start_date, exp.end_date]
        .map(part => (typeof part === 'string' ? part.trim() : ''))
        .filter(Boolean)
        .join(' – ');

    const location =
      typeof exp.location === 'string' ? exp.location.trim() :
      [exp.city, exp.state]
        .map(part => (typeof part === 'string' ? part.trim() : ''))
        .filter(Boolean)
        .join(', ');

    const bullets = coerceStringArray(
      Array.isArray(exp.bullets) && exp.bullets.length ? exp.bullets :
      Array.isArray(exp.highlights) ? exp.highlights :
      exp.description
    );

    return {
      ...exp,
      company,
      role,
      title: role || (typeof exp.title === 'string' ? exp.title.trim() : undefined),
      dates,
      location,
      bullets,
    } as TailoredExperience;
  }).filter((exp): exp is TailoredExperience => Boolean(exp));
};

const normalizeProjects = (items: any): TailoredProject[] => {
  return coerceArray<any>(items).map(project => {
    if (!project || typeof project !== 'object') return null;
    const name = typeof project.name === 'string'
      ? project.name.trim()
      : typeof project.title === 'string'
        ? project.title.trim()
        : '';
    if (!name) return null;
    const bullets = coerceStringArray(project.bullets ?? project.highlights);
    return { name, bullets };
  }).filter((p): p is TailoredProject => Boolean(p));
};

const normalizeAdditionalSections = (items: any): TailoredAdditionalSection[] => {
  return coerceArray<any>(items).map(section => {
    if (!section || typeof section !== 'object') return null;
    const heading = typeof section.heading === 'string'
      ? section.heading.trim()
      : typeof section.title === 'string'
        ? section.title.trim()
        : '';
    if (!heading) return null;
    const lines = coerceStringArray(section.lines ?? section.items);
    if (!lines.length) return null;
    return { heading, lines };
  }).filter((s): s is TailoredAdditionalSection => Boolean(s));
};

export function normalizeTailored(raw: any, opts: NormalizeOptions = {}): TailoredResume {
  const snapshot = raw?.preview_sections_json ?? raw?.tailored ?? raw;

  const contact = toContact(snapshot?.contact, opts.fallbackContact);
  const summary = typeof snapshot?.summary === 'string' ? snapshot.summary.trim() : '';
  const skills = coerceStringArray(snapshot?.skills_section ?? snapshot?.skills);
  const experience = normalizeExperience(snapshot?.experience);
  const education = coerceStringArray(snapshot?.education ?? opts.fallbackEducation);
  const certifications = coerceStringArray(snapshot?.certifications ?? opts.fallbackCertifications);
  const projects = normalizeProjects(snapshot?.projects ?? opts.fallbackProjects);
  const additional_sections = normalizeAdditionalSections(snapshot?.additional_sections ?? opts.fallbackAdditional);

  return {
    contact,
    summary,
    skills,
    experience,
    education,
    certifications,
    projects,
    additional_sections,
  };
}
