# Como documentar candidaturas para a calibração (Fase 4)

A Fase 4 compara o que o app previu com o que aconteceu de verdade. Para isso, cada candidatura
sua vira uma pasta com três arquivos: o texto da vaga, o CV que você enviou e um `meta.json` com o
resultado. Com 20 casos ou mais dá para medir o acerto do app (o plano não define meta antes disso).

Tudo fica só no seu computador: a pasta `fixtures/candidaturas/` está no `.gitignore` e nunca vai
para o git, porque tem dados pessoais. As pastas são o formato de entrada: o comando `importar` as lê e grava no banco
(`data/ats.db`), onde o histórico passa a viver. Depois da importação, o resultado de cada candidatura (quando a resposta
chegar) pode ser atualizado pela API (`PUT /api/candidaturas/{id}`), sem mexer nas pastas.

## Antes de começar

- A pasta `fixtures/candidaturas/_modelo/` tem um `vaga.txt` e um `meta.json` de exemplo: copie-a
  para cada caso novo. Pastas que começam com `_` são ignoradas pela calibração. Como tudo ali fica
  fora do git, num clone novo o modelo não existe: crie-o com os exemplos dos passos 2 e 5.
- Só coloque candidaturas suas. Não guarde CVs de outras pessoas nem nome ou e-mail de recrutadores.

## Passo a passo, para cada candidatura

### 1. Crie a pasta do caso

Copie `_modelo` e renomeie no formato `AAAA-MM-plataforma-empresa-cargo`, em minúsculas, sem
acento e sem espaço:

```
fixtures/candidaturas/2026-10-gupy-acme-dev-java-jr/
```

O nome da pasta já registra o mês, a plataforma e a empresa: o `meta.json` não precisa repetir.

- **Plataforma** é onde você **enviou** a candidatura: `gupy`, `linkedin`, `workday`, `inhire`,
  `greenhouse` ou `outra`. Uma vaga vista no LinkedIn que manda para a Gupy é `gupy`.
- **Empresa** numa palavra só: junte as palavras (`acmetech`, não `acme-tech`). O que vem depois
  dela é o cargo, que pode ter hífens.
- Se você se candidatou duas vezes à mesma empresa no mesmo mês, acrescente `-2` no fim.

### 2. Salve o texto da vaga em `vaga.txt`

- **Copie no dia em que se candidatar**: as vagas saem do ar e o texto se perde.
- **Copie a página inteira**: título, local, modelo de trabalho, descrição, requisitos, diferenciais
  e benefícios. O app ignora o que não é requisito.
- **Mantenha as quebras de linha**: um item de lista por linha, como aparece no anúncio.
- **Gupy**: copie do título até o fim da página, inclusive as linhas "Local de trabalho" e
  "Modelo de trabalho".
- **LinkedIn**: o texto de "Sobre a vaga" não traz o título nem o local, que ficam no topo da
  página. Escreva o título na primeira linha e o local na segunda (ex.: `São Paulo, SP (Híbrido)`).
  Sem isso, o app não sabe o cargo nem a senioridade da vaga.
- Salve em UTF-8 (o padrão do VS Code e do Bloco de Notas).
- Se você não tem mais o texto completo, salve o que tiver e escreva "texto incompleto" em
  `observacoes`.

### 3. Salve o CV em `cv.pdf`

- Use **exatamente o arquivo que você enviou** para aquela vaga, não a versão mais recente do CV.
- Se você enviou DOCX, exporte o mesmo arquivo para PDF (o app só lê PDF) e escreva "enviado como
  DOCX" em `observacoes`.
- Se a plataforma preencheu um formulário a partir do CV (o perfil da Gupy, por exemplo) e você
  corrigiu campos à mão, conte isso em `observacoes`: o ATS viu o perfil corrigido, não só o PDF.

### 4. Anote as perguntas do formulário

Muitas candidaturas têm perguntas de triagem ("Você reside em São Paulo?", "Tem inglês avançado?").
Tire um print antes de enviar e depois passe cada pergunta e a sua resposta para o campo `perguntas`
do `meta.json`. É opcional, mas é o que mostra se o bloco "A plataforma deve perguntar" do app
acertou.

### 5. Preencha o `meta.json`

```json
{
  "resultado": "sem_retorno",
  "observacoes": "",
  "etapa": "",
  "dias_ate_resposta": null,
  "perguntas": [
    { "pergunta": "Você tem disponibilidade para trabalho híbrido em São Paulo?", "resposta": "sim" }
  ]
}
```

Só `resultado` é obrigatório. Mês, plataforma e empresa vêm do nome da pasta; se o `meta.json` também
tiver `plataforma`, vale o nome da pasta.

| Campo | Obrigatório | O que colocar |
|---|---|---|
| `resultado` | sim | `passou_triagem`, `reprovado` ou `sem_retorno` (passo 6). |
| `data` | não | Só se você souber o dia exato, no formato `AAAA-MM-DD`. Sem ele, vale o mês da pasta. |
| `observacoes` | não | Texto livre: "chamado para teste técnico", "texto incompleto", "enviado como DOCX". |
| `etapa` | não | Até onde você chegou: `triagem`, `teste`, `entrevista RH`, `entrevista técnica`, `proposta`. |
| `dias_ate_resposta` | não | Dias entre a candidatura e a primeira resposta (`0` = no mesmo dia). Uma reprovação em minutos ou horas costuma ser automática. |
| `perguntas` | não | Lista de `{ "pergunta": "...", "resposta": "..." }`, uma por pergunta do formulário. |

Campos opcionais podem ficar vazios (`""`, `null` ou `[]`), e um valor que sobrou do modelo
(`"AAAA-MM-DD"`) conta como vazio. O JSON usa aspas duplas e não aceita vírgula depois do último
item: o VS Code marca em vermelho quando algo está errado, e o comando `importar` diz qual caso
corrigir.

### 6. Decida o resultado e atualize quando houver resposta

- **`passou_triagem`**: qualquer sinal de que você avançou depois da candidatura: convite para teste
  ou entrevista, contato do recrutador, ou a plataforma mostrando você numa etapa seguinte. Vale
  **mesmo que você tenha sido reprovado depois**: a calibração mede a triagem. "Seu currículo foi
  visualizado" não conta como avanço.
- **`reprovado`**: e-mail ou status de reprovação ("não seguiremos com a sua candidatura",
  "processo encerrado") antes de qualquer etapa seguinte. Anote em `dias_ate_resposta` quanto tempo
  levou.
- **`sem_retorno`**: nenhuma resposta. Comece todo caso assim e mude quando a resposta chegar. Vaga
  cancelada ou encerrada sem retorno também é `sem_retorno` (escreva isso em `observacoes`).
  `sem_retorno` conta como desconhecido, não como reprovação.

### 7. Confira a pasta

- [ ] O nome segue `AAAA-MM-plataforma-empresa-cargo`.
- [ ] Os três arquivos se chamam exatamente `vaga.txt`, `cv.pdf` e `meta.json`.
- [ ] O `vaga.txt` tem o título na primeira linha.
- [ ] O `cv.pdf` é o arquivo que foi enviado.
- [ ] O `meta.json` abre sem erro no VS Code.

Se quiser, abra o app, envie o `cv.pdf` e cole o `vaga.txt` para ver o que ele
prevê. Só não mude os arquivos do caso por causa do resultado do app: o caso precisa registrar o
que aconteceu.

## Quantos casos e quais

- **20 ou mais.** Abaixo disso o relatório serve para achar erros, não para medir acerto.
- **Misture resultados**: reprovações e avanços ensinam coisas diferentes.
- **Misture plataformas**: as lentes de Gupy, LinkedIn e Workday precisam de casos de cada uma.
- **Candidaturas antigas valem** se você ainda tem o texto da vaga (às vezes a página continua no ar
  pelo link do e-mail de confirmação) e o CV exato que enviou.
- Cada candidatura é um caso, mesmo quando o CV é o mesmo em várias vagas.

## Gere o relatório

```powershell
mvn spring-boot:run "-Dspring-boot.run.arguments=importar --pasta=fixtures/candidaturas"
mvn spring-boot:run "-Dspring-boot.run.arguments=calibrar --saida=data/relatorio-calibracao.md"
```

O `importar` confere cada pasta (nome, `meta.json`, `vaga.txt` e `cv.pdf`) e grava no banco; uma pasta com
problema aparece no terminal e fica de fora até ser corrigida. O `calibrar` roda o app com a vaga e o CV de cada
candidatura do banco nas quatro lentes, com as regras de hoje, e grava o relatório em `data/relatorio-calibracao.md`,
também fora do git.

O relatório põe a previsão ao lado do resultado real, na lente da plataforma de cada caso, diz qual
versão do CV foi enviada (pelo nome, quando é um dos PDFs de referência) e destaca:

- `passou_triagem` que o app classificou como Not fit;
- `reprovado` que o app classificou como Top fit;
- vaga em que nenhum requisito foi lido (texto incompleto ou anúncio que é só um modelo);
- perguntas do formulário que o app não previu, e previsões que não viraram pergunta.

Esses casos destacados guiam os ajustes no dicionário e nas regras.

## Estrutura final

```
fixtures/candidaturas/
├── _modelo/                              ignorada pela calibração
├── 2026-09-gupy-acme-dev-java-jr/
│   ├── vaga.txt
│   ├── cv.pdf
│   └── meta.json
└── 2026-10-linkedin-beta-backend-jr/
    ├── vaga.txt
    ├── cv.pdf
    └── meta.json
```
