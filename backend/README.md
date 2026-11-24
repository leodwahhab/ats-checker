# ATS CV Checker: backend

API em Java com a regra de negócio do verificador de CV: leitura do PDF, análise de formato para ATS e,
nas próximas etapas, ranqueamento por vaga e histórico de candidaturas.

> **Status da migração:** o back-end já tem toda a regra de negócio (leitura do PDF, formato, vaga, ranking com as
> 4 lentes), a API HTTP e o histórico em SQLite. O front-end (`../front-end`) ainda usa a lógica em TypeScript; a
> troca para esta API é o próximo passo.

## Requisitos

- JDK 25
- Maven 3.9 (não há wrapper ainda)

## Comandos

```powershell
mvn test            # testes (unitários, de API e de paridade com o TypeScript)
mvn spring-boot:run # sobe a API em 127.0.0.1:8080 (OpenAPI em /api/openapi, Swagger UI em /api/docs)
```

Importar as pastas de candidaturas para o banco e gerar o relatório de calibração (rodam e terminam, sem subir o servidor):

```powershell
mvn spring-boot:run "-Dspring-boot.run.arguments=importar --pasta=fixtures/candidaturas"
mvn spring-boot:run "-Dspring-boot.run.arguments=calibrar --saida=data/relatorio-calibracao.md"
```

Importar de novo não duplica: cada pasta é reconhecida pelo nome. O banco fica em `data/ats.db` (SQLite, fora do git).

## API

| Rota | O que faz |
|---|---|
| `POST /api/cvs` | Envia um PDF (multipart, campo `arquivo`). Devolve o CV, o que se leu dele e a análise de formato. O mesmo arquivo não duplica (hash SHA-256). Limites: 5 MB e 10 páginas. |
| `GET /api/cvs`, `/api/cvs/{id}`, `/api/cvs/{id}/pdf`; `DELETE /api/cvs/{id}` | Lista, detalhe, o PDF guardado e exclusão (409 se há candidaturas usando). |
| `POST /api/vagas/ler` | Lê o texto de uma vaga e devolve requisitos, condições e eliminatórias. |
| `POST /api/vagas/editar` | Altera o tipo, remove, adiciona um requisito ou promove um termo a skill. |
| `POST /api/vagas/termos-ausentes` | Palavras da vaga que o CV não cita. |
| `POST /api/ranking` | Ranqueia um CV contra uma vaga (estado da vaga no corpo; não grava nada). |
| `GET /api/lentes` | As quatro lentes e as páginas oficiais em que se baseiam. |
| `/api/candidaturas` | CRUD do histórico. Ao salvar, guarda a previsão da época (snapshot do ranking) e a versão das regras. |

Erros saem em `application/problem+json`, com a mensagem em português.

## Estrutura

| Pacote | O que tem |
|---|---|
| `br.com.atscv.extracao` | `PdfExtractor`: lê o PDF com PDFBox (trechos de texto com posição, imagens, gerador). |
| `br.com.atscv.formato` | Análise de formato: seções, estrutura (experiência, formação...), contato, colunas, margens, `Analyzer`. |
| `br.com.atscv.ranking` | Ranqueamento: leitura da vaga (`Vaga`, `Requisitos`, `Condicoes`), perfil do CV (`Perfil`), avaliação (`Avaliar`), faixa, dimensões, lentes, avisos e o ponto de entrada `Ranking`; dicionário de skills (`Dicionario`), léxicos e cargos. Os dados estão em `src/main/resources/ranking/*.json`, exportados do dicionário original. |
| `br.com.atscv.api`, `servico`, `persistencia` | API HTTP (controllers, DTOs, erros), regras de aplicação e SQLite (JDBC + Flyway). |
| `br.com.atscv.calibracao` | Importação das pastas de candidaturas e relatório de calibração. |
| `br.com.atscv.comum` | `Js` e `Normalizar`: equivalências com o JavaScript (espaços, `trim`, `fold`). |

## Testes de paridade

O comportamento de referência é o do TypeScript original. Os *golden files* vêm de lá:

```powershell
cd ../front-end
$env:GERAR_GOLDEN = "1"; npx vitest run tests/golden.gen.test.ts
```

- `ParidadeFormatoTest`: a análise do Java, a partir do mesmo `ExtractedDoc` do pdf.js, tem de ser idêntica.
- `ExtracaoPdfTest`: o PDFBox lendo os PDFs chega ao mesmo texto, nota, checagens e estrutura do pdf.js.

Os golden files de `src/test/resources/golden/cvs/` contêm o texto dos seus CVs e ficam fora do git; sem
eles (e sem os PDFs em `fixtures/`), esses testes são pulados.

## Dados pessoais

Ficam fora do git (ver `.gitignore`): `fixtures/*.pdf`, `fixtures/candidaturas/`, `data/` e os golden
files gerados a partir dos CVs.
