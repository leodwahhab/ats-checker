export interface TextItem {
  str: string;
  x: number;
  y: number;
  page: number;
  hasEOL: boolean;
  /** Largura e altura do trecho, em pontos do PDF (para marcar o trecho na prévia). */
  w?: number;
  h?: number;
}

export interface ExtractedDoc {
  numPages: number;
  pageWidth: number;
  pageHeight?: number;
  producer: string;
  imageCount: number;
  items: TextItem[];
  /** Texto na ordem do stream do PDF, como um parser ingênuo de ATS o leria. */
  text: string;
}

export type Status = 'pass' | 'warn' | 'fail';

export interface CheckResult {
  id: string;
  title: string;
  status: Status;
  weight: number;
  detail: string;
  fix?: string;
  /** Índices em ExtractedDoc.items dos trechos que a checagem aponta no CV. */
  itens?: number[];
}

export interface Periodo {
  inicio: string;
  fim: string;
  atual: boolean;
}

export interface ExperienceEntry {
  cargo?: string;
  empresa?: string;
  periodo?: Periodo;
  local?: string;
  resumo?: string;
  responsabilidades: string[];
  tecnologias?: string;
}

export interface EducationEntry {
  nivel: string;
  curso?: string;
  instituicao?: string;
  status?: string;
  statusInferido: boolean;
  periodo?: Periodo;
}

export interface CertificationEntry {
  nome: string;
  emissor?: string;
  data?: string;
}

export interface LanguageEntry {
  idioma: string;
  nivel?: string;
}

export interface SkillGroup {
  categoria: string;
  itens: string[];
}

export interface Structured {
  experiencia: ExperienceEntry[];
  formacao: EducationEntry[];
  certificacoes: CertificationEntry[];
  idiomas: LanguageEntry[];
  habilidades: SkillGroup[];
  resumo?: string;
  cabecalho: string[];
  /** Linhas de contato do topo (e-mail, telefone, links). */
  contato: string[];
  projetos: string[];
}

export interface Analysis {
  structured: Structured;
  formatScore: number;
  checks: CheckResult[];
  robotText: string;
  /** O PDF é o "Salvar como PDF" do perfil do LinkedIn (a Gupy diz ler melhor esse formato). */
  exportLinkedin: boolean;
}
