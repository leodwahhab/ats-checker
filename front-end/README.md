# ATS CV Checker: front-end

Interface do verificador de CV para ATS (React + Vite). Ela só apresenta: toda a regra de negócio (leitura do PDF,
formato, leitura da vaga, ranking com as lentes, histórico) fica na API em `../backend`.

## Como rodar

Suba o backend (na pasta `../backend`) e depois o front:

```powershell
cd ../backend; mvn spring-boot:run   # API em 127.0.0.1:8080
cd ../front-end; npm install; npm run dev   # interface em http://localhost:5173
```

O Vite encaminha `/api` para `127.0.0.1:8080` (ver `vite.config.ts`), então não há CORS no desenvolvimento.

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento. |
| `npm run build` | Confere os tipos e gera `dist/`. |
| `npm run typecheck` | Só confere os tipos. |

## O que tem aqui

| Caminho | O que é |
|---|---|
| `src/api/cliente.ts` | Cliente `fetch` da API; erros `problem+json` viram `ErroApi` com a mensagem em português. |
| `src/api/tipos.ts` | Tipos do contrato da API, escritos à mão (veja abaixo). |
| `src/api/LentesContext.tsx` | As lentes e as fontes oficiais, lidas de `GET /api/lentes` quando o app abre. |
| `src/App.tsx` | Estado da tela: envia o CV, lê a vaga, pede o ranking (com uma espera curta ao mexer no limiar) e as marcas do PDF. |
| `src/components/Historico.tsx`, `SalvarCandidatura.tsx` | Histórico de candidaturas e o botão de salvar a análise atual. |
| `src/pdfPreview.ts` | Abre o PDF com o `pdf.js` só para desenhar a prévia; a leitura do texto é da API. |
| `src/formato.ts` | Só apresentação (duração por extenso, lista com "e", faixas do texto do robô). |

## Tipos da API

Os tipos de `src/api/tipos.ts` são mantidos à mão e batem com o JSON do backend (`br.com.atscv.api.Dtos` e
`br.com.atscv.ranking.Tipos`). O OpenAPI do backend (`/api/openapi`) tem os enums certos, mas não marca nenhum campo
como obrigatório e perde o discriminador `tipo` dos componentes de requisito, o que quebraria o `switch` com
verificação de tipos do front. Gerar os tipos a partir dele exige anotar no backend quais campos podem ser nulos.
Ao mudar um DTO no backend, atualize o tipo correspondente aqui.

## Privacidade

O PDF é enviado para a API que roda no seu computador e fica no banco local (`../backend/data/ats.db`, fora do git).
Nada vai para a nuvem.
