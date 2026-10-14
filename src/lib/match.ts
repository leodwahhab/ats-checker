import { norm } from './normalize';

const STOPWORDS = new Set(
  ('a o as os um uma uns umas de da do das dos em na no nas nos por para com sem sobre entre ate ao aos ' +
    'e ou mas que se como mais menos muito muita ser ter ha tem sao foi sera estar vaga vagas empresa ' +
    'equipe time area anos ano experiencia conhecimento conhecimentos desejavel diferencial requisitos ' +
    'atividades responsabilidades beneficios buscamos procuramos profissional trabalho trabalhar ' +
    'nivel superior ensino completo sera seu sua seus suas nosso nossa nossos nossas voce nos ' +
    'the and of to in for with').split(' '),
);

/** Stemming leve para PT-BR: só plural e sufixos -ção/-ções. */
function stem(w: string): string {
  if (w.length > 5 && /coes$/.test(w)) return w.replace(/coes$/, 'cao');
  if (w.length > 4 && /(ns)$/.test(w)) return w.replace(/ns$/, 'm');
  if (w.length > 4 && /es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && /s$/.test(w)) return w.slice(0, -1);
  return w;
}

export interface Token {
  /** Forma normalizada e sem plural, usada para comparar. */
  raiz: string;
  /** A palavra como apareceu (em minúsculas), usada para exibir. */
  palavra: string;
}

const SEP = /[\s,;:()/\\|•·–—"'!?]+/;

/** Mantém tokens técnicos como c#, c++, node.js, .net. */
export function tokens(text: string): Token[] {
  const out: Token[] = [];
  for (const raw of text.normalize('NFC').split(SEP)) {
    const palavra = raw.replace(/^[.\-]+|[.\-]+$/g, (m, offset: number) => (m === '.' && offset === 0 && /^\.net/i.test(raw) ? m : ''));
    const n = norm(palavra);
    if (n.length < 2 || STOPWORDS.has(n) || /^\d+$/.test(n)) continue;
    out.push({ raiz: stem(n), palavra: palavra.toLowerCase() });
  }
  return out;
}

export const tokenize = (text: string): string[] => tokens(text).map((t) => t.raiz);
