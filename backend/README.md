# ATS CV Checker: backend

API em Java com a regra de negócio do verificador de CV: leitura do PDF, análise de formato para ATS e,
nas próximas etapas, ranqueamento por vaga e histórico de candidaturas.

> **Status da migração:** o front-end (`../front-end`) ainda tem a lógica em TypeScript. Aqui já estão
> portados a extração do PDF, a análise de formato e a leitura da vaga (`Vaga.parseJob`). O ranking (avaliação,
> faixa, lentes), a persistência e a API HTTP vêm a seguir.

## Requisitos

- JDK 25
- Maven 3.9 (não há wrapper ainda)

## Comandos

```powershell
mvn test            # testes (unitários e de paridade com o TypeScript)
mvn spring-boot:run # sobe a API em 127.0.0.1:8080
```

## Estrutura

| Pacote | O que tem |
|---|---|
| `br.com.atscv.extracao` | `PdfExtractor`: lê o PDF com PDFBox (trechos de texto com posição, imagens, gerador). |
| `br.com.atscv.formato` | Análise de formato: seções, estrutura (experiência, formação...), contato, colunas, margens, `Analyzer`. |
| `br.com.atscv.ranking` | Leitura da vaga (`Vaga`, `Requisitos`, `Condicoes`), dicionário de skills (`Dicionario`), léxicos e cargos. Os dados estão em `src/main/resources/ranking/*.json`, exportados do dicionário original. |
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
