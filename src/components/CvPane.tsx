import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import type { PdfAberto } from '../lib/extractBrowser';
import { faixasNoTexto } from '../lib/marcas';
import type { ExtractedDoc } from '../lib/types';
import { StatusChip, Switch, type Tom } from './ui';

export interface InfoSelecao {
  status: Tom;
  rotuloStatus?: string;
  titulo: string;
  onde: string;
  trecho: string;
}

interface Props {
  file: File | null;
  doc: ExtractedDoc | null;
  pdf: PdfAberto | null;
  busy: boolean;
  error: string | null;
  onFile: (f: File) => void;
  marcados: number[];
  /** Muda a cada "Ver no CV": traz a prévia para a tela. */
  pulso: number;
  info: InfoSelecao | null;
}

const ehPdf = (f?: File) => !!f && (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));

function Pagina({ pdf, n, doc, marcados, onPronta }: {
  pdf: PdfAberto; n: number; doc: ExtractedDoc; marcados: Set<number>; onPronta: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    let vivo = true;
    let tarefa: { cancel: () => void; promise: Promise<void> } | undefined;
    void pdf.getPage(n).then((page) => {
      if (!vivo || !canvas.current) return;
      const [x0, y0, x1, y1] = page.view;
      setDims({ w: x1 - x0, h: y1 - y0 });
      const viewport = page.getViewport({ scale: 2 });
      canvas.current.width = viewport.width;
      canvas.current.height = viewport.height;
      tarefa = page.render({ canvas: canvas.current, viewport });
      tarefa.promise.then(onPronta, () => {});
    });
    return () => {
      vivo = false;
      tarefa?.cancel();
    };
    // onPronta muda a cada render do pai; a página só precisa ser desenhada de novo se o PDF mudar.
  }, [pdf, n]);

  const caixas = dims ? doc.items.flatMap((it, i) => {
    if (it.page !== n || !marcados.has(i)) return [];
    const alt = it.h || 10;
    const larg = it.w || it.str.length * alt * 0.5;
    return [{
      i,
      left: `${(it.x / dims.w) * 100}%`,
      top: `${((dims.h - it.y - alt * 0.85) / dims.h) * 100}%`,
      width: `${(larg / dims.w) * 100}%`,
      height: `${((alt * 1.15) / dims.h) * 100}%`,
    }];
  }) : [];

  return (
    <div className="paper" aria-label={`Página ${n} de ${doc.numPages}`}>
      <canvas ref={canvas} aria-hidden="true" />
      {caixas.map(({ i, ...pos }) => <span key={i} className="mk on" style={pos} />)}
      <span className="pnum" aria-hidden="true">{n} / {doc.numPages}</span>
    </div>
  );
}

/** O texto cru, com os trechos selecionados marcados. */
function Robo({ doc, marcados }: { doc: ExtractedDoc; marcados: number[] }) {
  const partes = useMemo(() => {
    const out: ReactNode[] = [];
    let pos = 0;
    for (const [ini, fim] of faixasNoTexto(doc, marcados)) {
      if (ini > pos) out.push(doc.text.slice(pos, ini));
      out.push(<mark key={ini} className="mk on">{doc.text.slice(ini, fim)}</mark>);
      pos = fim;
    }
    out.push(doc.text.slice(pos));
    return out;
  }, [doc, marcados]);
  return (
    <>
      <p className="cap paper-w">Este é o texto cru como o robô o recebe, na ordem em que ele lê.</p>
      <pre className="robot">{doc.text ? partes : '(nenhum texto extraído)'}</pre>
    </>
  );
}

export function CvPane({ file, doc, pdf, busy, error, onFile, marcados, pulso, info }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const pane = useRef<HTMLElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState(false);
  const [robo, setRobo] = useState(false);
  const [prontas, setProntas] = useState(0);
  const marcadosSet = useMemo(() => new Set(marcados), [marcados]);

  // Rola só a coluna do CV até o primeiro trecho marcado, sem mexer no diagnóstico.
  useEffect(() => {
    const sc = scroller.current;
    const el = sc?.querySelector('.mk.on');
    if (!sc || !el) return;
    const r = el.getBoundingClientRect();
    const s = sc.getBoundingClientRect();
    sc.scrollTo({ top: sc.scrollTop + r.top - s.top - s.height / 3, behavior: 'smooth' });
  }, [marcados, robo, prontas]);

  // "Ver no CV" no celular: a prévia fica abaixo do diagnóstico.
  useEffect(() => {
    const r = pane.current?.getBoundingClientRect();
    if (pulso && r && (r.top < 0 || r.top > window.innerHeight * 0.6)) pane.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [pulso]);

  useEffect(() => setProntas(0), [pdf]);

  function aceitar(f?: File) {
    if (ehPdf(f)) onFile(f!);
  }
  const soltar = {
    onDragOver: (e: DragEvent) => { e.preventDefault(); setOver(true); },
    onDragLeave: () => setOver(false),
    onDrop: (e: DragEvent) => { e.preventDefault(); setOver(false); aceitar(e.dataTransfer.files[0]); },
  };
  const escolher = (
    <input ref={input} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { aceitar(e.target.files?.[0]); e.target.value = ''; }} />
  );

  if (!doc) {
    return (
      <section ref={pane} className="cvpane" aria-label="Seu currículo" {...soltar}>
        <div className="cvhead">
          <div>
            <h2 className="h4">Seu currículo</h2>
            <div className="cap">{busy ? 'Lendo o arquivo…' : 'Nenhum arquivo ainda'}</div>
          </div>
        </div>
        <div className="cvscroll centro">
          <div className={`drop${over ? ' over' : ''}`}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></svg>
            <h3 className="h3">{busy ? 'Analisando…' : 'Arraste o PDF aqui'}</h3>
            <p className="sm muted">Somente PDF. Até 2 páginas é o ideal.</p>
            {error && <p role="alert" className="erro">{error}</p>}
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => input.current?.click()}>Escolher arquivo</button>
            {escolher}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section ref={pane} className={`cvpane${over ? ' over' : ''}`} aria-label="Seu currículo" {...soltar}>
      <div className="cvhead">
        <div className="cvhead-t">
          <h2 className="h4">Seu currículo</h2>
          <div className="cap nome-arquivo">{file?.name} · {doc.numPages} página{doc.numPages > 1 ? 's' : ''}</div>
        </div>
        <div className="rowf cvhead-a">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => input.current?.click()}>Trocar PDF</button>
          {escolher}
          <Switch rotulo="Ver como o robô lê" ligado={robo} onChange={setRobo} />
        </div>
      </div>
      {error && <p role="alert" className="erro cvaviso">{error}</p>}
      <div ref={scroller} className="cvscroll">
        {robo || !pdf
          ? <Robo doc={doc} marcados={marcados} />
          : Array.from({ length: doc.numPages }, (_, i) => (
            <Pagina key={i} pdf={pdf} n={i + 1} doc={doc} marcados={marcadosSet} onPronta={() => setProntas((p) => p + 1)} />
          ))}
      </div>
      <div className="cvfoot" aria-live="polite">
        {info ? (
          <div className="rowf topo">
            <StatusChip status={info.status} rotulo={info.rotuloStatus} />
            <div className="cvfoot-t">
              <div className="lbl">{info.titulo}</div>
              <div className="cap">{info.onde}</div>
              {info.trecho && <div className="sm">{info.trecho}</div>}
            </div>
          </div>
        ) : (
          <p className="sm muted">Escolha “Ver no CV” em um item do diagnóstico para marcar o trecho aqui.</p>
        )}
      </div>
    </section>
  );
}
