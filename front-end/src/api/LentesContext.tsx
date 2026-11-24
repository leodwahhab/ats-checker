import { createContext, useContext, type ReactNode } from 'react';
import type { Lentes } from './tipos';

const Contexto = createContext<Lentes | null>(null);

/** As lentes vêm da API (GET /api/lentes) uma vez, quando o app abre. */
export function LentesProvider({ lentes, children }: { lentes: Lentes; children: ReactNode }) {
  return <Contexto.Provider value={lentes}>{children}</Contexto.Provider>;
}

export function useLentes(): Lentes {
  const l = useContext(Contexto);
  if (!l) throw new Error('useLentes fora do LentesProvider');
  return l;
}
