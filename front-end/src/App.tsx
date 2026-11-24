import { useEffect, useMemo, useRef, useState } from 'react';
import { api, ErroApi, type PedidoDeEdicao } from './api/cliente';
import type {
  Analysis, BuscaDeMarca, Candidatura, CvDetalhe, FonteEvidencia, JobSpec, LenteId, RankingResult, ReqTipo, SkillDef,
} from './api/tipos';
import { CvPane, type InfoSelecao } from './components/CvPane';
import { faixaDoFormato, FormatTab } from './components/FormatTab';
import { Historico } from './components/Historico';
import { JobCard } from './components/JobCard';
import { SalvarCandidatura } from './components/SalvarCandidatura';
import { Topbar, type Vista } from './components/Topbar';
import type { RequirementHandlers } from './components/ranking/RequirementsTable';
import { VagaTab } from './components/ranking/VagaTab';
import { mesmaSelecao, tomDoFormato, type Marcador, type Selecao } from './components/ui';
import { abrirPdf, type PdfAberto } from './pdfPreview';

type Aba = 'formato' | 'vaga';

/** Seção do CV onde procurar o trecho de cada tipo de evidência. */
const SECAO: Partial<Record<FonteEvidencia, string>> = {
  habilidades: 'habilidades', experiencia: 'experiencia', resumo: 'resumo', certificacoes: 'certificacoes',
  projetos: 'projetos', formacao: 'formacao', idiomas: 'idiomas',
};

const mensagem = (e: unknown) => (e instanceof ErroApi ? e.message : 'Algo deu errado. Tente de novo.');

export function App() {
  const [vista, setVista] = useState<Vista>('analise');
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [cv, setCv] = useState<CvDetalhe | null>(null);
  const [pdf, setPdf] = useState<PdfAberto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobText, setJobText] = useState('');

  // Estado da vaga: só em memória até virar uma candidatura. Reler a vaga descarta as edições.
  const [job, setJob] = useState<JobSpec | null>(null);
  const [vagaLida, setVagaLida] = useState('');
  const [editado, setEditado] = useState(false);
  const [declarados, setDeclarados] = useState<Record<string, boolean>>({});
  const [respostas, setRespostas] = useState<Record<string, boolean>>({});
  const [extras, setExtras] = useState<SkillDef[]>([]);
  const [limiar, setLimiar] = useState(0.5);
  const [lente, setLente] = useState<LenteId>('nucleo');

  // O que a API devolve para o estado acima.
  const [ranking, setRanking] = useState<RankingResult | null>(null);
  const [ausentes, setAusentes] = useState<string[]>([]);
  const [marcasReq, setMarcasReq] = useState<Map<string, number[]>>(new Map());

  // Tela: aba escolhida, item marcado no CV e o painel "Sobre as lentes".
  const [abaEscolhida, setAbaEscolhida] = useState<Aba | null>(null);
  const [sel, setSel] = useState<Selecao | null>(null);
  const [pulso, setPulso] = useState(0);
  const [sobre, setSobre] = useState(false);
  const leitura = useRef(0);
  const fecharAnterior = useRef<(() => void) | null>(null);

  const analysis: Analysis | null = cv?.analise ?? null;
  const doc = cv?.doc ?? null;

  function zerarVaga() {
    setExtras([]);
    setDeclarados({});
    setRespostas({});
    setEditado(false);
    setSel(null);
  }

  /** Mostra um CV já lido pela API: abre o PDF só para desenhar a prévia. */
  async function mostrarCv(detalhe: CvDetalhe, bytes: ArrayBuffer, nome: string, vez: number) {
    const lido = await abrirPdf(bytes);
    if (vez !== leitura.current) return lido.fechar();
    fecharAnterior.current?.();
    fecharAnterior.current = lido.fechar;
    setNomeArquivo(nome);
    setCv(detalhe);
    setPdf(lido.pdf);
    setSel(null);
  }

  async function run(f: File) {
    const vez = ++leitura.current;
    setBusy(true);
    setError(null);
    try {
      const [detalhe, bytes] = await Promise.all([api.enviarCv(f), f.arrayBuffer()]);
      await mostrarCv(detalhe, bytes, f.name, vez);
    } catch (e) {
      if (vez === leitura.current) setError(e instanceof ErroApi ? e.message : 'Não foi possível ler este arquivo. Ele é um PDF válido e não está protegido por senha?');
    } finally {
      if (vez === leitura.current) setBusy(false);
    }
  }

  async function lerVaga(texto: string) {
    zerarVaga();
    setVagaLida(texto);
    if (!texto.trim()) {
      setJob(null);
      return;
    }
    try {
      const novo = await api.lerVaga(texto);
      setJob(novo);
      // Com vaga, a tela abre no ranqueamento.
      setAbaEscolhida('vaga');
    } catch (e) {
      setError(mensagem(e));
    }
  }

  function onFile(f: File) {
    void run(f);
    if (jobText.trim() && !job) void lerVaga(jobText);
  }

  function onLerVaga(): boolean {
    if (editado && !window.confirm('Reler a vaga descarta as suas edições nos requisitos. Continuar?')) return false;
    void lerVaga(jobText);
    return true;
  }

  async function editar(pedido: Omit<PedidoDeEdicao, 'job' | 'extras'>) {
    if (!job) return;
    try {
      const r = await api.editarVaga({ ...pedido, job, extras });
      if (r.skill) {
        const skill = r.skill;
        setExtras((atual) => (atual.some((s) => s.id === skill.id) ? atual : [...atual, skill]));
      }
      setJob(r.job);
      setEditado(true);
    } catch (e) {
      setError(mensagem(e));
    }
  }

  /** Liga ou desliga uma resposta "tenho / não tenho" ou "sim / não" (null desfaz). */
  const responder = (set: typeof setDeclarados) => (id: string, valor: boolean | null) => {
    setEditado(true);
    set((atual) => {
      const novo = { ...atual };
      if (valor === null) delete novo[id];
      else novo[id] = valor;
      return novo;
    });
  };

  const handlers: RequirementHandlers = {
    onTipo: (id, tipo: ReqTipo) => void editar({ acao: 'alterar_tipo', id, tipo }),
    onRemover: (id) => void editar({ acao: 'remover', id }),
    onAdicionar: (texto, tipo) => void editar({ acao: 'adicionar', texto, tipo }),
    onDeclarar: responder(setDeclarados),
    onPromover: (termo) => void editar({ acao: 'promover', termo }),
  };

  // O ranking é calculado pela API a cada mudança; o limiar (um slider) espera um instante para não inundar o servidor.
  useEffect(() => {
    if (!cv || !job) {
      setRanking(null);
      return;
    }
    const ac = new AbortController();
    const espera = setTimeout(() => {
      api.ranquear({ cvId: cv.cv.id, job, declarados, respostas, extras, limiar, lente }, ac.signal)
        .then(setRanking)
        .catch((e) => { if (!(e instanceof DOMException)) setError(mensagem(e)); });
    }, 120);
    return () => {
      clearTimeout(espera);
      ac.abort();
    };
  }, [cv, job, declarados, respostas, extras, limiar, lente]);

  useEffect(() => {
    if (!cv || !job) {
      setAusentes([]);
      return;
    }
    const ac = new AbortController();
    api.termosAusentes(cv.cv.id, vagaLida, extras, ac.signal).then(setAusentes).catch(() => {});
    return () => ac.abort();
  }, [cv, job, vagaLida, extras]);

  // Onde cada requisito aparece no PDF: a API localiza o trecho de cada evidência.
  useEffect(() => {
    if (!cv || !ranking) {
      setMarcasReq(new Map());
      return;
    }
    const buscas: BuscaDeMarca[] = [];
    const chaves = new Map<string, string[]>();
    for (const r of ranking.requisitos) {
      const lista: string[] = [];
      r.evidencias.forEach((e, i) => {
        if (e.fonte === 'declarado') return;
        const chave = `${r.requisito.id}#${i}`;
        buscas.push({ chave, trecho: e.trecho, secao: SECAO[e.fonte] });
        lista.push(chave);
      });
      chaves.set(r.requisito.id, lista);
    }
    const ac = new AbortController();
    api.marcas(cv.cv.id, buscas, ac.signal).then((porChave) => {
      const out = new Map<string, number[]>();
      for (const [id, lista] of chaves) out.set(id, [...new Set(lista.flatMap((c) => porChave[c] ?? []))]);
      setMarcasReq(out);
    }).catch(() => {});
    return () => ac.abort();
  }, [cv, ranking]);

  const semTexto = analysis?.formatScore === 0;
  const itensDe = (s: Selecao): number[] => (s.tipo === 'req'
    ? marcasReq.get(s.id) ?? []
    : analysis?.checks.find((c) => c.id === s.id)?.itens ?? []);

  const marcador: Marcador = {
    selecao: sel,
    tem: (s) => itensDe(s).length > 0,
    ver: (s) => { setSel(s); setPulso((p) => p + 1); },
    alternar: (s) => setSel(mesmaSelecao(sel, s) ? null : s),
  };
  const marcados = sel ? itensDe(sel) : [];

  let info: InfoSelecao | null = null;
  if (sel?.tipo === 'req') {
    const r = ranking?.requisitos.find((x) => x.requisito.id === sel.id);
    const prova = r?.evidencias.find((e) => e.fonte !== 'declarado');
    if (r) info = { status: r.status, titulo: r.requisito.texto, onde: prova?.rotulo ?? 'Não encontrado no CV', trecho: prova?.trecho ?? r.motivo };
  } else if (sel?.tipo === 'check') {
    const c = analysis?.checks.find((x) => x.id === sel.id);
    if (c) {
      const [status, rotuloStatus] = tomDoFormato(c.status);
      info = { status, rotuloStatus, titulo: c.title, onde: c.itens?.length ? 'Destacado no CV' : 'Sem trecho específico', trecho: c.detail };
    }
  }

  /** Abre uma candidatura do histórico na análise: o CV, a vaga e tudo o que foi editado. */
  async function abrirCandidatura(c: Candidatura) {
    const vez = ++leitura.current;
    setBusy(true);
    setError(null);
    try {
      const [detalhe, bytes] = await Promise.all([api.cv(c.cvId), api.pdf(c.cvId)]);
      await mostrarCv(detalhe, bytes, detalhe.cv.nomeArquivo, vez);
      zerarVaga();
      setJobText(c.vagaTexto);
      setVagaLida(c.vagaTexto);
      setJob(c.estado.job ?? null);
      setDeclarados(c.estado.declarados ?? {});
      setRespostas(c.estado.respostas ?? {});
      setExtras(c.estado.extras ?? []);
      setLimiar(c.estado.limiar ?? 0.5);
      setLente(c.estado.lente ?? 'nucleo');
      setEditado(true);
      setAbaEscolhida('vaga');
      setVista('analise');
    } catch (e) {
      setError(mensagem(e));
    } finally {
      if (vez === leitura.current) setBusy(false);
    }
  }

  const aba: Aba = abaEscolhida ?? (ranking ? 'vaga' : 'formato');
  const trocarAba = (a: Aba) => { setAbaEscolhida(a); setSel(null); };
  const faltam = ranking?.requisitos.filter((r) => r.requisito.tipo === 'obrigatorio' && r.status !== 'atende').length ?? 0;
  const resumoVaga = ranking
    ? (ranking.vazio ? 'Nenhum requisito lido' : `${ranking.lente.rotulo} · ${faltam} a comprovar`)
    : job ? (cv ? 'Calculando…' : 'Envie o PDF') : 'Cole a vaga para ver';
  const estado = useMemo(() => ({ job: job ?? undefined, declarados, respostas, extras, limiar, lente }),
    [job, declarados, respostas, extras, limiar, lente]);

  return (
    <div className="app">
      <Topbar lente={lente} sobreAberto={sobre} onSobre={setSobre} vista={vista} onVista={setVista} />

      {vista === 'historico' ? (
        <main className="main historico">
          <Historico onAbrir={(c) => void abrirCandidatura(c)} />
        </main>
      ) : (
        <main className={`main${analysis ? '' : ' inicio'}`}>
          <CvPane
            nome={nomeArquivo} doc={doc} inicios={cv?.inicios ?? []} pdf={pdf} busy={busy} error={error} onFile={onFile}
            marcados={marcados} pulso={pulso} info={info}
          />

          <section className="dxpane" aria-label="Diagnóstico">
            {nomeArquivo && analysis && (
              <div className="card plain filecard">
                <div className="lbl">Seu currículo</div>
                <div className="cap nome-arquivo">{nomeArquivo}{doc && ` · ${doc.numPages} página${doc.numPages > 1 ? 's' : ''}`}</div>
                <p className="cap">A prévia e a visão do robô ficam no fim da página.</p>
              </div>
            )}

            <JobCard texto={jobText} onTexto={setJobText} job={job} temCv={!!analysis} onLer={onLerVaga} />

            {analysis ? (
              <>
                <div className="tg" role="tablist" aria-label="Diagnóstico">
                  <span className={`tgthumb ${aba === 'formato' ? 'p0' : 'p1'}`} aria-hidden="true" />
                  <button type="button" role="tab" id="aba-formato" aria-controls="painel-formato" aria-selected={aba === 'formato'} className={`tgb${aba === 'formato' ? ' on' : ''}`} onClick={() => trocarAba('formato')}>
                    <span className="tl">1 · Formato e leitura</span>
                    <span className="ts">{analysis.formatScore} de 100 · {faixaDoFormato(analysis.formatScore).rotulo}</span>
                  </button>
                  <button type="button" role="tab" id="aba-vaga" aria-controls="painel-vaga" aria-selected={aba === 'vaga'} className={`tgb${aba === 'vaga' ? ' on' : ''}`} onClick={() => trocarAba('vaga')}>
                    <span className="tl">2 · Vaga</span>
                    <span className="ts">{resumoVaga}</span>
                  </button>
                </div>

                {aba === 'formato' && <FormatTab analysis={analysis} m={marcador} />}
                {aba === 'vaga' && (ranking && job ? (
                  <>
                    <VagaTab
                      ranking={ranking} job={job} semTexto={semTexto}
                      limiar={limiar} onLimiar={setLimiar} lente={lente} onLente={setLente} onSobreLentes={() => setSobre(true)}
                      ausentes={ausentes} handlers={handlers} onResponder={responder(setRespostas)} m={marcador}
                    />
                    <SalvarCandidatura cvId={cv!.cv.id} vagaTexto={vagaLida} estado={estado} onVerHistorico={() => setVista('historico')} />
                  </>
                ) : (
                  <section className="card flat anim-in" role="tabpanel" id="painel-vaga" aria-labelledby="aba-vaga">
                    <h2 className="h3">{job ? 'Calculando o ranking…' : 'Sem vaga, analisamos só o formato'}</h2>
                    <p className="sm muted">
                      {job ? 'A API está avaliando o CV contra a vaga.' : 'Cole o texto da vaga acima e escolha “Ler a vaga” para ver a faixa, os requisitos e o que falta comprovar.'}
                    </p>
                  </section>
                ))}
              </>
            ) : (
              <section className="card flat" aria-labelledby="inicio-t">
                <h2 className="h3" id="inicio-t">Os resultados aparecem aqui</h2>
                <div className="stack espaco">
                  <p className="sm"><span className="lbl">1 · Formato e leitura.</span> Aparece depois que você enviar o PDF.</p>
                  <p className="sm"><span className="lbl">2 · Vaga.</span> Aparece se você colar o texto da vaga. Sem vaga, analisamos só o formato.</p>
                </div>
                <p className="sm muted espaco">O PDF é enviado só para a API que roda no seu computador e fica guardado no banco local, onde você pode consultá-lo no histórico.</p>
              </section>
            )}
          </section>
        </main>
      )}

      <footer className="foot">
        O score de formato é uma estimativa deste app. A faixa segue regras documentadas pelas plataformas (Gupy, LinkedIn, Workday) e
        aproximações marcadas como tal; não é a nota oficial de nenhum ATS. Os currículos e as candidaturas ficam no banco do seu computador, não na nuvem.
      </footer>
    </div>
  );
}
