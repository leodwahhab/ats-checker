import { useMemo, useRef, useState } from 'react';
import { analyze } from './lib/analyze';
import { abrirPdf, type PdfAberto } from './lib/extractBrowser';
import { localizar } from './lib/marcas';
import {
  adicionarRequisito, alterarTipo, dicionario, parseJob, promoverTermo, rank, removerRequisito, termosAusentes,
} from './lib/ranking';
import type { FonteEvidencia, JobSpec, LenteId, SkillDef } from './lib/ranking/types';
import type { SectionKey } from './lib/sections';
import type { Analysis, ExtractedDoc } from './lib/types';
import { CvPane, type InfoSelecao } from './components/CvPane';
import { faixaDoFormato, FormatTab } from './components/FormatTab';
import { JobCard } from './components/JobCard';
import { Topbar } from './components/Topbar';
import type { RequirementHandlers } from './components/ranking/RequirementsTable';
import { VagaTab } from './components/ranking/VagaTab';
import { mesmaSelecao, tomDoFormato, type Marcador, type Selecao } from './components/ui';

type Aba = 'formato' | 'vaga';

/** Seção do CV onde procurar o trecho de cada tipo de evidência. */
const SECAO: Partial<Record<FonteEvidencia, SectionKey>> = {
  habilidades: 'habilidades', experiencia: 'experiencia', resumo: 'resumo', certificacoes: 'certificacoes',
  projetos: 'projetos', formacao: 'formacao', idiomas: 'idiomas',
};

export function App() {
  const [file, setFile] = useState<File | null>(null);
  const [doc, setDoc] = useState<ExtractedDoc | null>(null);
  const [pdf, setPdf] = useState<PdfAberto | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobText, setJobText] = useState('');

  // Estado da vaga: tudo só em memória (Q22). Reler a vaga descarta as edições.
  const [job, setJob] = useState<JobSpec | null>(null);
  const [vagaLida, setVagaLida] = useState('');
  const [editado, setEditado] = useState(false);
  const [declarados, setDeclarados] = useState<Record<string, boolean>>({});
  const [respostas, setRespostas] = useState<Record<string, boolean>>({});
  const [extras, setExtras] = useState<SkillDef[]>([]);
  const [limiar, setLimiar] = useState(0.5);
  const [lente, setLente] = useState<LenteId>('nucleo');

  // Tela: aba escolhida, item marcado no CV e o painel "Sobre as lentes".
  const [abaEscolhida, setAbaEscolhida] = useState<Aba | null>(null);
  const [sel, setSel] = useState<Selecao | null>(null);
  const [pulso, setPulso] = useState(0);
  const [sobre, setSobre] = useState(false);
  const leitura = useRef(0);
  const fecharAnterior = useRef<(() => void) | null>(null);

  const dict = useMemo(() => dicionario(extras), [extras]);

  async function run(f: File) {
    const vez = ++leitura.current;
    setBusy(true);
    setError(null);
    try {
      const lido = await abrirPdf(f);
      if (vez !== leitura.current) return lido.fechar();
      fecharAnterior.current?.();
      fecharAnterior.current = lido.fechar;
      setFile(f);
      setDoc(lido.doc);
      setPdf(lido.pdf);
      setAnalysis(analyze(lido.doc));
      setSel(null);
    } catch {
      setError('Não foi possível ler este arquivo. Ele é um PDF válido e não está protegido por senha?');
    } finally {
      if (vez === leitura.current) setBusy(false);
    }
  }

  function lerVaga(texto: string) {
    setExtras([]);
    setDeclarados({});
    setRespostas({});
    setEditado(false);
    setVagaLida(texto);
    setSel(null);
    const novo = texto.trim() ? parseJob(texto, dicionario()) : null;
    setJob(novo);
    // Com vaga, a tela abre no ranqueamento (Q20).
    if (novo) setAbaEscolhida('vaga');
  }

  function onFile(f: File) {
    void run(f);
    if (jobText.trim() && !job) lerVaga(jobText);
  }

  function onLerVaga(): boolean {
    if (editado && !window.confirm('Reler a vaga descarta as suas edições nos requisitos. Continuar?')) return false;
    lerVaga(jobText);
    return true;
  }

  function editar(novo: JobSpec) {
    setJob(novo);
    setEditado(true);
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
    onTipo: (id, tipo) => job && editar(alterarTipo(job, id, tipo)),
    onRemover: (id) => job && editar(removerRequisito(job, id)),
    onAdicionar: (texto, tipo) => job && editar(adicionarRequisito(job, texto, tipo, dict)),
    onDeclarar: responder(setDeclarados),
    onPromover: (termo) => {
      if (!job) return;
      const { job: novo, skill } = promoverTermo(job, termo);
      setExtras((atual) => (atual.some((s) => s.id === skill.id) ? atual : [...atual, skill]));
      editar(novo);
    },
  };

  const semTexto = analysis?.formatScore === 0;
  const ranking = useMemo(
    () => (analysis && job
      ? rank(analysis.structured, job, {
        limiarDesejaveis: limiar, declarados, respostas, skillsExtras: extras, lente,
        arquivo: { semTexto: analysis.formatScore === 0, exportLinkedin: analysis.exportLinkedin },
      }, dict)
      : null),
    [analysis, job, limiar, declarados, respostas, extras, lente, dict],
  );
  const ausentes = useMemo(
    () => (analysis && job ? termosAusentes(analysis.robotText, vagaLida, dict) : []),
    [analysis, job, vagaLida, dict],
  );

  // Onde cada requisito e cada checagem aparecem no PDF.
  const marcasReq = useMemo(() => {
    const out = new Map<string, number[]>();
    if (!doc || !ranking) return out;
    for (const r of ranking.requisitos) {
      const itens = new Set<number>();
      for (const e of r.evidencias) {
        if (e.fonte !== 'declarado') localizar(doc, e.trecho, SECAO[e.fonte]).forEach((i) => itens.add(i));
      }
      out.set(r.requisito.id, [...itens]);
    }
    return out;
  }, [doc, ranking]);
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

  const aba: Aba = abaEscolhida ?? (ranking ? 'vaga' : 'formato');
  const trocarAba = (a: Aba) => { setAbaEscolhida(a); setSel(null); };
  const faltam = ranking?.requisitos.filter((r) => r.requisito.tipo === 'obrigatorio' && r.status !== 'atende').length ?? 0;
  const resumoVaga = ranking
    ? (ranking.vazio ? 'Nenhum requisito lido' : `${ranking.lente.rotulo} · ${faltam} a comprovar`)
    : job ? 'Envie o PDF' : 'Cole a vaga para ver';

  return (
    <div className="app">
      <Topbar lente={lente} sobreAberto={sobre} onSobre={setSobre} />

      <main className={`main${analysis ? '' : ' inicio'}`}>
        <CvPane
          file={file} doc={doc} pdf={pdf} busy={busy} error={error} onFile={onFile}
          marcados={marcados} pulso={pulso} info={info}
        />

        <section className="dxpane" aria-label="Diagnóstico">
          {file && analysis && (
            <div className="card plain filecard">
              <div className="lbl">Seu currículo</div>
              <div className="cap nome-arquivo">{file.name}{doc && ` · ${doc.numPages} página${doc.numPages > 1 ? 's' : ''}`}</div>
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
                <VagaTab
                  ranking={ranking} job={job} semTexto={semTexto}
                  limiar={limiar} onLimiar={setLimiar} lente={lente} onLente={setLente} onSobreLentes={() => setSobre(true)}
                  ausentes={ausentes} handlers={handlers} onResponder={responder(setRespostas)} m={marcador}
                />
              ) : (
                <section className="card flat anim-in" role="tabpanel" id="painel-vaga" aria-labelledby="aba-vaga">
                  <h2 className="h3">Sem vaga, analisamos só o formato</h2>
                  <p className="sm muted">Cole o texto da vaga acima e escolha “Ler a vaga” para ver a faixa, os requisitos e o que falta comprovar.</p>
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
              <p className="sm muted espaco">O PDF não sai do seu computador e fechar a página apaga tudo.</p>
            </section>
          )}
        </section>
      </main>

      <footer className="foot">
        O score de formato é uma estimativa deste app. A faixa segue regras documentadas pelas plataformas (Gupy, LinkedIn, Workday) e
        aproximações marcadas como tal; não é a nota oficial de nenhum ATS. Nada é salvo: fechar a página apaga tudo.
      </footer>
    </div>
  );
}
