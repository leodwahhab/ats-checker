import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { api, ErroApi } from './api/cliente';
import { LentesProvider } from './api/LentesContext';
import type { Lentes } from './api/tipos';
import './styles.css';

/** Carrega as lentes da API antes de mostrar o app; sem a API, explica o que fazer. */
function Raiz() {
  const [lentes, setLentes] = useState<Lentes | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    api.lentes().then(setLentes).catch((e) => setErro(e instanceof ErroApi ? e.message : 'Não foi possível iniciar o app.'));
  }, []);

  if (erro) {
    return (
      <main className="main inicio">
        <section className="card flat" role="alert">
          <h1 className="h3">A API não respondeu</h1>
          <p className="sm">{erro}</p>
          <p className="sm muted">Suba o backend com <code>mvn spring-boot:run</code>, na pasta <code>backend</code>, e recarregue a página.</p>
        </section>
      </main>
    );
  }
  if (!lentes) return <main className="main inicio"><p className="sm muted" role="status">Carregando…</p></main>;
  return <LentesProvider lentes={lentes}><App /></LentesProvider>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><Raiz /></StrictMode>);
