export interface ContactInfo {
  email: boolean;
  phone: boolean;
  linkedin: 'ok' | 'broken' | 'missing';
  github: boolean;
  location: boolean;
}

const UFS = 'AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO';

export function detectContact(text: string): ContactInfo {
  const flat = text.replace(/\n/g, ' ');
  const email = /[\w.+-]+@[\w-]+\.[\w.-]+/.test(flat);
  const phone = /(\+?55\s?)?\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}/.test(flat);
  const github = /github\.com\/[\w-]+/i.test(flat);
  const location = new RegExp(`[A-Za-zÀ-ú ]{3,}\\s*[-,/–]\\s*(${UFS})\\b`).test(flat);

  let linkedin: ContactInfo['linkedin'] = 'missing';
  const m = /linkedin\.com\/in\/(\S*)(\s+(\S+))?/i.exec(flat);
  if (m) {
    const slug = m[1];
    const next = m[3] ?? '';
    // URL partida: termina em hífen/barra, ou a continuação parece resto de slug.
    const brokenEnd = /[-/]$/.test(slug);
    const continues = slug.length < 14 && /^[a-z0-9][\w-]*\/?$/i.test(next) && next.includes('-');
    linkedin = brokenEnd || continues ? 'broken' : 'ok';
  }
  return { email, phone, linkedin, github, location };
}
