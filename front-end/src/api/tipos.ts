// Tipos do contrato da API. São mantidos à mão e batem com o JSON do backend (ver README do front-end).

export type SkillCategoria =
  | 'linguagem' | 'framework' | 'frontend' | 'mobile' | 'banco' | 'cloud' | 'devops'
  | 'teste' | 'dados' | 'ferramenta' | 'metodologia' | 'pratica';

export interface SkillDef {
  id: string;
  rotulo: string;
  categoria: SkillCategoria;
  /** Outras grafias, além do rótulo. */
  aliases: string[];
  /** Quem tem esta skill também tem estas (PostgreSQL → SQL). Pedir uma destas e ter esta conta como atende. */
  implica?: string[];
  /** Skills próximas (MySQL ↔ MariaDB): contam como parcial. */
  relacionadas?: string[];
  /**
   * Padrão próprio, sensível a maiúsculas, para grafias ambíguas (Go, R, C).
   * Quando existe, substitui o rótulo na busca; os aliases continuam valendo.
   */
  regex?: string;
  /**
   * Conceito amplo (containers, back-end, lógica de programação). Pode ser comprovado por quem o
   * implica, mas não serve de ponte para "parcial": ter Java não deixa Go parcial.
   */
  conceito?: boolean;
}

/** Informativo: tecnologia citada nas atividades da vaga; aparece, mas não entra na faixa. */
export type ReqTipo = 'obrigatorio' | 'desejavel' | 'informativo';
/** De onde veio a classificação obrigatório/desejável. */
export type ReqTipoFonte = 'marcador' | 'secao' | 'heuristica' | 'padrao' | 'usuario';
/** Em que parte da vaga a linha estava. */
export type ReqOrigem = 'requisitos' | 'diferenciais' | 'atividades' | 'sem_secao' | 'usuario';

export type NivelFormacao = 'medio' | 'tecnico' | 'graduacao' | 'pos' | 'mestrado' | 'doutorado';
export type NivelIdioma = 'basico' | 'intermediario' | 'avancado' | 'fluente' | 'nativo';
export type Senioridade = 'estagio' | 'junior' | 'pleno' | 'senior' | 'especialista';
export type Modelo = 'remoto' | 'hibrido' | 'presencial';

export interface Local {
  cidade?: string;
  uf?: string;
  /** A linha de onde o local foi lido. */
  trecho: string;
}

export type EliminatoriaTipo = 'local' | 'idioma' | 'formacao' | 'certificacao' | 'disponibilidade' | 'documento';

/** Trecho da vaga que costuma virar pergunta de triagem (4.8 do plano). */
export interface Eliminatoria {
  id: string;
  tipo: EliminatoriaTipo;
  /** O que a plataforma deve perguntar, em poucas palavras: "Trabalho híbrido em São Paulo - SP". */
  rotulo: string;
  /** A linha da vaga de onde veio. */
  trecho: string;
  /** Requisito obrigatório de onde veio (idioma, formação e certificação). */
  requisitoId?: string;
}

export type Component =
  | { tipo: 'skill'; ids: string[]; modo: 'todas' | 'alguma' }
  | { tipo: 'anos'; minimo: number; skillIds: string[]; familia?: string }
  | { tipo: 'formacao'; nivelMinimo: NivelFormacao; area: 'ti' | 'qualquer'; aceitaCursando: boolean }
  | { tipo: 'idioma'; idioma: string; nivelMinimo: NivelIdioma }
  | { tipo: 'cargo'; familia: string }
  | { tipo: 'nao_reconhecido'; termos: string[] };

export interface Requirement {
  id: string;
  /** A linha original da vaga. */
  texto: string;
  tipo: ReqTipo;
  tipoFonte: ReqTipoFonte;
  origem: ReqOrigem;
  componentes: Component[];
}

export interface JobSpec {
  titulo?: string;
  familia?: string;
  senioridade?: Senioridade;
  /** A vaga separa requisitos e diferenciais em seções? */
  temSecoes: boolean;
  requisitos: Requirement[];
  /** Linhas comportamentais (comunicação, proatividade…): não dá para comprovar pelo CV. */
  naoAvaliaveis: string[];
  /** Termos técnicos que não estão no dicionário. */
  termosNaoReconhecidos: string[];
  modelo?: Modelo;
  local?: Local;
  /**
   * Eliminatórias prováveis lidas do texto (local, disponibilidade, documentos). As que vêm de
   * requisitos obrigatórios (idioma, formação, certificação) são calculadas a cada rank.
   */
  eliminatorias: Eliminatoria[];
  /** Trecho que indica vaga afirmativa (exclusiva ou preferencial para um grupo). Só informativo. */
  afirmativa?: string;
  /** Idioma em que a vaga foi escrita. */
  idioma?: IdiomaTexto;
  /** País da vaga, quando o local diz ("Brasil", "Portugal"). */
  pais?: string;
}

export type IdiomaTexto = 'pt' | 'en';

export type FonteEvidencia =
  | 'habilidades' | 'experiencia' | 'resumo' | 'cabecalho' | 'certificacoes' | 'projetos' | 'formacao' | 'idiomas'
  | 'declarado';

export interface Evidence {
  fonte: FonteEvidencia;
  /** "Habilidades · Back-end", "Experiência · Revizia". */
  rotulo: string;
  trecho: string;
  /** Na seção Habilidades (explícita) ou em outro lugar do CV (implícita). */
  explicita: boolean;
  /** Índice da experiência, quando a fonte é uma experiência. */
  entrada?: number;
}

export type ReqStatus = 'atende' | 'parcial' | 'nao_atende' | 'nao_verificavel';

export interface ComponentResult {
  status: ReqStatus;
  motivo: string;
  evidencias: Evidence[];
}

export interface RequirementResult {
  requisito: Requirement;
  status: ReqStatus;
  motivo: string;
  componentes: ComponentResult[];
  evidencias: Evidence[];
  /** O status veio de uma resposta "tenho / não tenho" do usuário. */
  declarado: boolean;
}

export type FaixaId = 'top' | 'maybe' | 'not';

export type DimensaoId = 'cargo' | 'senioridade' | 'local';

/** Dimensões do número secundário (4.7). Status "nao_verificavel" = sem dado: sai do número. */
export interface Dimensao {
  id: DimensaoId;
  rotulo: string;
  peso: number;
  status: ReqStatus;
  motivo: string;
}

export interface EliminatoriaResult extends Eliminatoria {
  /** true = atende, false = não atende, undefined = sem resposta. */
  resposta?: boolean;
  /** O que o CV mostra sobre o assunto, quando dá para ler. */
  noCv?: string;
}

export type AvisoTipo =
  | 'so_implicita' | 'so_certificacoes' | 'habilidades_demais' | 'idioma_cv' | 'lacuna' | 'sem_experiencia';

export interface Aviso {
  tipo: AvisoTipo;
  texto: string;
}

export interface RankingResult {
  faixa: FaixaId;
  rotuloFaixa: string;
  /** Número 0–100 secundário (pesos do app, não de plataforma). */
  numero: number;
  resumo: string;
  comoMelhorar: string[];
  requisitos: RequirementResult[];
  /** Cobertura de 0 a 1; null quando não há requisitos daquele tipo. */
  cobertura: { obrigatorios: number | null; desejaveis: number | null };
  /** A vaga não tem nenhum requisito: não há faixa para mostrar. */
  vazio: boolean;
  /** A classificação obrigatório/desejável foi toda automática (vaga sem seções). */
  classificacaoAutomatica: boolean;
  dimensoes: Dimensao[];
  eliminatorias: EliminatoriaResult[];
  avisos: Aviso[];
  /** Tempo de experiência lido do CV. */
  experiencia: { mesesTotais: number; mesesEstagio: number; comData: number; semData: number };
  /** Como a plataforma da lente escolhida apresentaria o resultado (4.9). */
  lente: ResultadoLente;
}

// ---------- Lentes (Fase 3) ----------

export type LenteId = 'nucleo' | 'gupy' | 'linkedin' | 'workday';

/** Página oficial em que uma regra se baseia. */
export interface FonteDoc {
  rotulo: string;
  url: string;
}

/** Uma frase e a página oficial que a sustenta. */
export interface ComFonte {
  texto: string;
  fonte: FonteDoc;
}

export interface LensConfig {
  id: LenteId;
  nome: string;
  /** O que a lente simula, em uma frase. */
  descricao: string;
  /** Fontes do CV aceitas como evidência; sem valor, todas. */
  fontes?: FonteEvidencia[];
  /** Rótulos da faixa nesta lente (o Workday usa notas). */
  rotulos: Record<FaixaId, string>;
  /** Regras que a documentação não define por completo (Q23): selo "aproximação" com link. */
  aproximacoes: ComFonte[];
  /** O que a plataforma documenta e vale para qualquer CV (dicas, limites do recurso). */
  notas: ComFonte[];
  /** Páginas oficiais em que a lente se baseia. */
  documentacao: FonteDoc[];
}

export type NotaWorkday = 'A' | 'B' | 'C' | 'D';

export interface ResultadoLente {
  id: LenteId;
  nome: string;
  descricao: string;
  /** Rótulo principal: "Top fit", "Aderência média", "Nota B", "Sem nota". */
  rotulo: string;
  /** Cor do resultado; "neutro" quando não há nota. */
  tom: FaixaId | 'neutro';
  /** Nota do Workday; null quando a requisição fica sem nota. */
  nota?: NotaWorkday | null;
  /** "7 de 9 skills da vaga estão no CV (5 na seção Habilidades)", no LinkedIn. */
  indicador?: string;
  /** Seções do CV que esta lente aceita como evidência; sem valor, todas. */
  fontes?: FonteEvidencia[];
  /** Particularidades da plataforma para este CV e esta vaga; a fonte falta quando a regra é do app. */
  alertas: Array<{ texto: string; fonte?: FonteDoc }>;
  notas: ComFonte[];
  aproximacoes: ComFonte[];
  documentacao: FonteDoc[];
}

// ---------- Leitura do PDF e análise de formato ----------

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

// ---------- O que a API devolve e recebe (ver backend: br.com.atscv.api.Dtos) ----------

export interface CvResumo {
  id: number;
  sha256: string;
  nomeArquivo: string;
  numPaginas: number;
  formatScore: number;
  criadoEm: string;
}

/** O CV, o que se leu do PDF (trechos com posição, para a prévia), a análise de formato e a posição de cada trecho no texto. */
export interface CvDetalhe {
  cv: CvResumo;
  doc: ExtractedDoc;
  analise: Analysis;
  /** Posição de cada trecho (doc.items[i]) dentro de doc.text. */
  inicios: number[];
  jaExistia: boolean;
}

/** Tudo o que o usuário mexe numa vaga; vive só em memória até virar uma candidatura. */
export interface EstadoDaVaga {
  job?: JobSpec;
  declarados?: Record<string, boolean>;
  respostas?: Record<string, boolean>;
  extras?: SkillDef[];
  limiar?: number;
  lente?: LenteId;
}

export type AcaoDeEdicao = 'alterar_tipo' | 'remover' | 'adicionar' | 'promover';

export interface Pergunta {
  pergunta: string;
  resposta: string;
}

export type Plataforma = 'gupy' | 'linkedin' | 'workday' | 'inhire' | 'greenhouse' | 'outra';
export type ResultadoReal = 'passou_triagem' | 'reprovado' | 'sem_retorno';

export interface CandidaturaEntrada {
  cvId: number;
  vagaTexto: string;
  plataforma?: string;
  empresa?: string;
  cargo?: string;
  mes?: string;
  data?: string;
  resultado?: string;
  etapa?: string;
  observacoes?: string;
  diasAteResposta?: number | null;
  perguntas?: Pergunta[];
  estado?: EstadoDaVaga;
  origem?: string;
}

export interface Candidatura {
  id: number;
  cvId: number;
  vagaTexto: string;
  plataforma?: string;
  empresa?: string;
  cargo?: string;
  mes?: string;
  data?: string;
  resultado: string;
  etapa?: string;
  observacoes?: string;
  diasAteResposta?: number;
  perguntas: Pergunta[];
  estado: EstadoDaVaga;
  snapshot?: RankingResult;
  versaoRegras?: string;
  criadoEm: string;
  atualizadoEm: string;
  origem?: string;
}

export interface CandidaturaResumo {
  id: number;
  cvId: number;
  plataforma?: string;
  empresa?: string;
  cargo?: string;
  mes?: string;
  resultado: string;
  etapa?: string;
  faixa?: FaixaId;
  rotuloFaixa?: string;
  numero?: number;
  criadoEm: string;
}

/** As lentes e as páginas oficiais em que se baseiam (GET /api/lentes). */
export interface Lentes {
  verificadoEm: string;
  ordem: LenteId[];
  lentes: Record<LenteId, LensConfig>;
  fontes: Record<string, FonteDoc>;
}

/** Pedidos de marcação do CV: onde cada trecho aparece no PDF (POST /api/cvs/{id}/marcas). */
export interface BuscaDeMarca {
  chave: string;
  trecho: string;
  secao?: string;
}
