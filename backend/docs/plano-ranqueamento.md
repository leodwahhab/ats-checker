# Plano: ranqueamento do currículo por vaga

> **Status:** aprovado. As quatro fases estão implementadas (13/10/2026). A calibração continua a cada lote novo de candidaturas.
> **Data:** 12/10/2026.
> **Base:** decisões Q1–Q26 da sessão de perguntas e fontes oficiais conferidas em 12/10/2026 (seção 14).

## 1. Objetivo

Hoje o app responde se o CV **é legível** por um ATS: score de formato e o bloco "O que o ATS extraiu". Este plano acrescenta a pergunta que as plataformas de fato fazem: **quão bem este CV atende a esta vaga**.

Quando o usuário cola uma vaga, o app vai:

1. separar os requisitos da vaga em obrigatórios e desejáveis, editáveis pelo usuário;
2. procurar cada requisito no que o parser extraiu do CV e mostrar o trecho que comprova;
3. classificar o CV numa faixa (Top fit / Maybe / Not fit), no modelo do assistente de vagas do LinkedIn;
4. mostrar a mesma avaliação pelas regras documentadas de Gupy, LinkedIn e Workday (as "lentes");
5. apontar perguntas eliminatórias prováveis e listar o que nenhuma ferramenta local consegue avaliar.

Sem vaga, o fluxo atual não muda. Tudo continua no navegador: sem backend, sem API paga e sem enviar o CV a ninguém.

## 2. Decisões

| # | Decisão |
|---|---|
| Q1 | Ranqueamento só para tecnologia (dev, dados, QA, infra, produto). Outras áreas continuam com o score de formato e a lista de termos da vaga. |
| Q2 | O ranqueamento só aparece quando há vaga. Sem vaga, vale o fluxo atual. |
| Q3 | A vaga entra como texto colado. O app extrai obrigatórios e desejáveis e mostra cada um como item editável. |
| Q4, Q4b | A faixa fica em destaque, as dimensões (com motivo) logo abaixo e um número de 0 a 100 aparece como informação secundária. |
| Q5 | O ranking usa só o que o parser extraiu. O que não foi lido não conta, e o app explica por quê. |
| Q6 | 100% local, sem API paga e sem servidor. A parte "semântica" vem de um dicionário curado. |
| Q7, Q19 | Calibração com candidaturas reais em `fixtures/candidaturas/`, fora do git. Os testes pulam quando a pasta não existe. |
| Q8 | Este plano fica em `docs/plano-ranqueamento.md`. |
| Q9 | Um núcleo comum e lentes para Gupy, LinkedIn e Workday/HiredScore. A InHire não ganha lente porque o método dela não é público. A seção "o que não dá para avaliar" fica sempre visível. |
| Q10 | Regra do LinkedIn. Top fit: todos os obrigatórios e pelo menos X% dos desejáveis (X = 50%, ajustável). Maybe: todos os obrigatórios, mas abaixo de X. Not fit: falta algum obrigatório. Requisito não verificável aparece como "?". Só 2 níveis de peso. |
| Q11 | A skill conta como explícita (seção Habilidades) ou implícita (texto das experiências). O app avisa quando ela é só implícita e quando há mais de 30 habilidades. |
| Q12 | Desfaz a decisão "sem sinônimos": entra um dicionário com aliases e skills relacionadas, que contam parcialmente. |
| Q13 | A cobertura de requisitos substitui o match por frequência de palavras. Os termos ausentes viram uma lista secundária. |
| Q14 | Detector de perguntas eliminatórias, com a pergunta "você atende?" guardada só em memória. Lacunas maiores que 6 meses aparecem como informação, sem penalidade. |
| Q15 | Anos totais e anos por skill (com o último uso), comparados com "X anos" e com a senioridade pedida na vaga. |
| Q16 | Um requisito é uma linha ou bullet da vaga, decomposta em componentes. |
| Q17 | Vaga sem seções: tudo começa como desejável, com sugestões automáticas de obrigatório e o aviso "revise". |
| Q18 | Uma skill só é reconhecida se estiver no dicionário. Termos fora dele aparecem como "não reconhecido" e o usuário pode promovê-los a skill. |
| Q20 | Com vaga, a tela abre em "Ranqueamento para esta vaga", com a lente Núcleo selecionada. "Formato e leitura" vem abaixo. |
| Q21 | Tabela de requisitos com status e prova, no modelo Fit & Gap. Pode ser editada. |
| Q22 | As edições ficam só em memória. |
| Q23 | Regras que a documentação não define por completo recebem o selo "aproximação" com link para a fonte. |
| Q24 | Quatro fases: núcleo, experiência, lentes e calibração. |
| Q25 | Cada fase tem critério de pronto (seção 10). Não há meta numérica de acerto antes de 20 casos reais. |
| Q26 | Git inicializado; o estado atual e este plano estão em commits separados. |

## 3. O que as plataformas fazem (base verificada)

Legenda dos marcadores:
- **[DOC]**: documentação oficial lida em 12/10/2026.
- **[REP]**: reportagem ou estudo de terceiros.
- **[NV]**: veio da pesquisa inicial e não foi reconferido.

### 3.1 Gupy [DOC]

**Como o CV entra**
- O arquivo (PDF, DOC ou DOCX) passa por um parser que preenche o perfil. A Gupy admite que o preenchimento "não chega a ser 100%" e pede revisão campo a campo.
- A empresa trabalha com os campos do perfil, não necessariamente com o arquivo original.
- A leitura funciona melhor com:
  - DOC/DOCX;
  - CV exportado do LinkedIn;
  - uma coluna, sem imagens;
  - CV escrito no idioma da vaga.

**O que a ordenação usa**
- Várias páginas repetem que a ordenação considera os campos **Experiência** e **Habilidades**.
- Duas páginas também listam formação (a dos agentes de IA também cita idiomas), o que é uma contradição interna. O app trata formação e idiomas como parte desses dois campos e marca isso como aproximação.
- A Gupy recomenda preencher "as 30 habilidades" com maior aderência **a você** (página da ordenação). Isso é uma **recomendação**; nenhuma página documenta um limite técnico.
- *Conferido de novo em 13/10/2026, página por página*: a página "critérios eliminatórios no cadastro" serve o guia "Como passar pelos agentes de IA da Gupy"; "conquistas com números" está nas páginas dos agentes de IA e do guia; a página do algoritmo diz que só os requisitos obrigatórios definidos pela empresa eliminam automaticamente.
- Diz que entende contexto e não depende "apenas" de palavras específicas. Exagerar nas palavras-chave não engana o sistema.
- Compara o perfil com os requisitos obrigatórios, desejáveis, a senioridade e as competências definidos pela empresa. Quanto mais perto dos requisitos mínimos, mais acima o candidato aparece.

**Eliminação e outros fatores**
- A IA não elimina ninguém. A reprovação automática só acontece por requisitos ou perguntas eliminatórias que a empresa configurou (exemplo: categoria da CNH).
- Quem conclui testes e etapas aparece antes.
- A ordem é recalculada quando o CV é atualizado.
- A empresa pode ajustar os pesos.
- Dados sensíveis são ignorados: nome, gênero, raça, idade, CPF e telefone.

### 3.2 LinkedIn [DOC]

**Assistente de vagas** (vale só para vagas promovidas, com o LinkedIn em inglês, no desktop)
- **Top fit**: cumpre todos os must-have e uma porcentagem dos preferenciais. Quem publica a vaga define esse limite; o padrão não é divulgado.
- **Maybe**: cumpre todos os must-have, mas fica abaixo do limite.
- **Not a fit**: não cumpre todos os must-have.
- Cada qualificação recebe um destes ícones: atende, atende parcialmente, não atende ou "?" (não dá para avaliar).

**Divergência entre páginas oficiais**
- O FAQ do Hiring Pro descreve a regra de outro jeito:
  - usa um número de preferenciais em vez de porcentagem;
  - um candidato de outro país vira Maybe.
- O app segue a página do assistente e registra a divergência.

**Skills match**
- Aparece como "x of y skills match your profile".
- Skills explícitas vêm da seção Skills. Skills implícitas vêm de qualquer seção do perfil, como resumo, descrição de cargo, título e headline.
- O recrutador pode filtrar candidatos por skills match.

**Outros pontos**
- O nível de match e o selo Top Applicant são do Premium. Quem contrata **não vê** o nível nem o resumo de match.
- Perguntas de triagem must-have podem arquivar candidatos automaticamente e enviar rejeição. Isso é uma opção de quem publica a vaga.
  - O prazo de "cerca de 3 dias" citado na pesquisa inicial **não foi encontrado**.

### 3.3 Workday / HiredScore [DOC]

**Notas no algoritmo legado**
- **A**: todas as qualificações básicas, a maioria das preferenciais e o match médio acima de um limiar.
- **B**: todas as básicas.
- **C**: a maioria das básicas, mas não todas.
- **D**: não cumpre a maioria das básicas.

**Algoritmo novo** (agosto de 2026, só para quem ativa): as básicas separam A/B de C/D. Dentro de cada par, decidem as preferenciais somadas ao score das básicas.

**Sem nota** em quatro situações:
- o candidato não enviou currículo;
- o formato não é suportado (aceitos: DOC, DOCX, PDF, RTF e TXT);
- a vaga não tem descrição;
- a requisição é de campus/graduate.

**Fit & Gap** (agosto de 2026, só para quem ativa)
- Um LLM avalia cada qualificação contra o currículo parseado.
- Mostra o que foi atendido e o que não foi, o efeito na nota e uma explicação.
- Aponta seções do perfil parseado como evidência.

### 3.4 Greenhouse [DOC] (sem lente; reforça o núcleo)

- O Talent Matching usa só o currículo: skills, cargos, anos, datas e empresas. O setor é opcional. A comparação é por significado (embeddings).
- Não usa respostas de formulário. Formação não aparece entre os dados usados.
- Categorias: Strong, Good, Partial, Limited e Needs manual review.
- Nunca avança nem rejeita ninguém sozinho. Um CV que a IA não consegue processar vai para revisão manual.

### 3.5 Taleo [DOC] (sem lente; reforça o núcleo)

- Ranqueia pelas respostas a questionários e pelas competências que o candidato declara (proficiência, anos e último uso).
- Perguntas de desqualificação eliminam na hora.
- Cada critério é Required (obrigatório) ou Asset (diferencial).
  - **ACE**: todos os Required e alguns Assets. A documentação sugere começar com 75%.
  - **Minimamente qualificado**: todos os Required e nenhum Asset.

### 3.6 InHire, Catho e Vagas.com [NV]

- **InHire**: a IA classifica em Alto, Médio ou Baixo fit a partir de critérios do recrutador (currículo, pretensão salarial, respostas). O método não é divulgado, por isso não há lente.
- **Catho**: considera cargo, experiência, localização, salário em relação à pretensão, habilidades e formação.
- **Vagas.com**: o recrutador dá peso aos critérios em 5 níveis.
- Essas três servem de referência para as dimensões, sem lente própria.

### 3.7 Mitos e números [REP]

- **"75% dos CVs são rejeitados pelo ATS"** não tem fonte primária verificável.
  - Uma pesquisa da Enhancv (2025) ouviu 25 recrutadores nos EUA: 92% disseram que seus sistemas não rejeitam por formatação, palavras-chave ou score de IA.
  - Os filtros mais comuns são de compliance: autorização de trabalho, licenças, requisitos mínimos e localização.
- **Hidden Workers** (Harvard Business School e Accenture, 2021) cita lacuna de emprego de 6 meses como exemplo de critério usado por sistemas para **ranquear** candidatos.
  - A proporção "cerca de metade das empresas", da pesquisa inicial, **não foi encontrada**. O app não usa esse número.

### 3.8 Consequências para o design

1. **A parseabilidade é pré-condição.** Na Gupy ela define o que entra no perfil, no Workday o CV ilegível fica sem nota e no Greenhouse vai para revisão manual. Isso fundamenta a Q5.
2. **O padrão comum é obrigatório × desejável**, com status por requisito. Isso é o núcleo.
3. **Densidade de palavras-chave não é critério documentado** por nenhuma plataforma. Isso fundamenta a Q13.
4. **A eliminação real vem de regras e perguntas configuradas**, não da IA. Isso fundamenta a Q14.

### 3.9 O que nenhuma ferramenta local consegue avaliar

Este texto aparece fixo na tela:

- respostas a formulários e perguntas eliminatórias (pretensão salarial, disponibilidade, autorização de trabalho);
- testes da plataforma (fit cultural, perfil comportamental, lógica) e o bônus de tê-los concluído;
- os pesos que cada recrutador configura;
- modelos treinados com contratações passadas e a personalização por recrutador;
- o momento da candidatura e o volume de concorrentes (na Gupy, quem conclui etapas antes sobe na lista);
- rede de contatos, indicação, probabilidade de resposta e Open to Work;
- a posição em relação aos outros candidatos;
- a decisão humana.

## 4. Modelo de avaliação

### 4.1 Fluxo

```
PDF ──► ExtractedDoc ──► Structured (já existe) ──► CvProfile (novo)
                                                        │
Vaga (texto) ──► JobSpec (novo) ──► edições em memória  │
                                          │             │
                                          ▼             ▼
                              rank(CvProfile, JobSpec, lente)
                                          │
                                          ▼
              RankingResult: faixa, número, requisitos com prova,
              dimensões, eliminatórias, avisos, aproximações
```

`rank` é uma função pura. Editar um requisito ou trocar de lente recalcula o resultado na hora, sem reler o PDF.

### 4.2 Dicionário de tecnologia

Fica versionado em `src/lib/ranking/dicionario/`.

```ts
interface SkillDef {
  id: string;              // 'spring-boot'
  rotulo: string;          // 'Spring Boot'
  aliases: string[];       // ['springboot', 'spring-boot']
  categoria: 'linguagem' | 'framework' | 'banco' | 'cloud' | 'devops' | 'teste' | 'ferramenta' | 'metodologia' | 'pratica';
  relacionadas?: string[]; // ['spring']: casa como "parcial"
  ambigua?: boolean;       // Go, R, C: exige grafia exata ou alias inequívoco ('golang')
}
```

**Regras de casamento**
- O texto é normalizado (minúsculas, sem acento). Os limites de palavra aceitam `#`, `+` e `.`, para reconhecer C#, C++, .NET e Node.js.
- O alias mais longo é testado primeiro (`sql server` antes de `sql`, `spring boot` antes de `spring`). Um trecho já casado não é reutilizado.
- Skills ambíguas só casam com a grafia original (`Go` casa, `go` não) ou com um alias inequívoco.

**Conteúdo inicial: cerca de 300 skills**
- Categorias: linguagens, frameworks, bancos, cloud e seus serviços, DevOps, testes, metodologias e práticas (SOLID, TDD, microsserviços, REST…).
- Origem dos termos: os 4 CVs de teste e as 10+ vagas reais.

**Também entram no dicionário**
- **Famílias de cargo**, com títulos em português e inglês: backend, frontend, fullstack, mobile, dados, QA, DevOps/SRE/infra, segurança, produto, suporte/sustentação.
- **Senioridade**: estágio, júnior, pleno, sênior e especialista/staff/lead, com as abreviações jr, pl e sr.
- **Léxicos**:
  - títulos de seção da vaga;
  - marcadores de obrigatório e de desejável;
  - soft skills;
  - termos que indicam pergunta eliminatória;
  - níveis de idioma;
  - níveis e áreas de formação.

### 4.3 Leitura da vaga (`JobSpec`)

**Seções reconhecidas**

| Tipo | Títulos |
|---|---|
| Obrigatórios | Requisitos, Requisitos obrigatórios, Pré-requisitos, Qualificações, O que buscamos, O que esperamos de você, Must have, Requirements |
| Desejáveis | Diferenciais, Desejável, Será um diferencial, Nice to have, Plus, Bônus |
| Contexto | Responsabilidades, Atividades, O que você vai fazer |
| Ignoradas | Benefícios, Sobre a empresa, Sobre nós, Processo seletivo |

**Classificação de cada linha** (vence a primeira regra que se aplica)
1. **Marcador na própria linha.** "Desejável", "diferencial" e "plus" tornam a linha desejável. "Obrigatório", "imprescindível" e "indispensável" a tornam obrigatória.
2. **Seção** em que a linha está.
3. **Vaga sem seções (Q17).** A linha começa como desejável. Vira sugestão de obrigatório se tiver "experiência com/em", "domínio de", "sólidos conhecimentos", "proficiência" ou "X+ anos". A tela mostra o aviso "classificação automática, revise".
4. **Linhas de Responsabilidades/Atividades** que citam uma skill reconhecida viram **informativas**, com origem "atividades": aparecem na tela, mas não entram na faixa (revisado com as vagas reais; ver item 8 da seção 11).

**Decomposição em componentes (Q16)**

| Componente | Exemplo na vaga | Como é detectado |
|---|---|---|
| skill (todas) | "Java e Spring Boot" | skills do dicionário ligadas por "e" ou por vírgula |
| skill (alguma) | "PostgreSQL ou MySQL", "AWS/GCP" | "ou", "/", "alguma das", "uma das" |
| anos | "3+ anos com Java" | `N anos` ou `N+ anos`, ligado às skills da linha ou a uma família ("anos em desenvolvimento") |
| formação | "Superior completo ou cursando em TI" | nível, status e área ("áreas afins" aceita qualquer área de TI) |
| idioma | "Inglês avançado" | idioma e nível |
| cargo | "experiência como desenvolvedor backend" | família de cargo |
| não reconhecido | "experiência com Quarkus", se Quarkus não estiver no dicionário | termo técnico que não casou: vira "?" e o app oferece promovê-lo a skill |
| soft skill | "boa comunicação" | léxico de soft skills: vai para "não avaliável" e fica fora da cobertura |

**Outros dados extraídos da vaga**
- título, família e senioridade;
- local (cidade, UF, país) e modelo (remoto, híbrido, presencial);
- eliminatórias candidatas (seção 4.8);
- termos não reconhecidos (a lista secundária da Q13).

### 4.4 Perfil do CV (`CvProfile`)

O perfil é montado só a partir do `Structured` (Q5). O `Structured` ganha três campos:
- `resumo`;
- `cabecalho`: as linhas antes do primeiro título, sem os dados de contato (equivale ao headline do LinkedIn);
- `projetos`.

O perfil reúne:

- **Skills com evidência.** Cada ocorrência guarda:
  - a fonte (habilidades, experiência, resumo, cabeçalho, certificações, projetos ou formação);
  - o rótulo, por exemplo "Experiência · Revizia";
  - um trecho de cerca de 120 caracteres;
  - se é **explícita** (seção Habilidades) ou **implícita** (qualquer outra seção).
- **Experiências como intervalos.** Cada entrada tem início e fim; "Atual" vale como hoje. Uma entrada cuja data não foi lida fica fora dos cálculos de tempo, e o app diz por quê.
- **Anos totais.** É a união dos intervalos, então períodos sobrepostos não contam duas vezes. A parte que é estágio aparece separada.
- **Anos por skill e último uso.** É a união dos intervalos das experiências cujo texto (cargo, descrição, responsabilidades ou tecnologias) cita a skill.
- **Cargo atual.** A família vem da experiência mais recente. A senioridade é procurada nesta ordem: título dessa experiência, depois o cabeçalho, depois os anos.
- **Formação, idiomas e localização**, normalizados.

### 4.5 Avaliação de cada requisito

Cada requisito recebe um destes status:
- **✓ atende**
- **◐ parcial**
- **✗ não atende**
- **? não verificável**

São os mesmos estados que o LinkedIn Hiring Pro usa por qualificação.

| Componente | ✓ | ◐ | ✗ | ? |
|---|---|---|---|---|
| skill | skill ou alias presente nas fontes da lente | só uma skill relacionada presente | ausente | — |
| anos | atinge o mínimo | falta até 1 ano (para mínimos de 2 anos ou mais) | falta mais que isso, ou nenhuma experiência com data foi lida | — |
| formação | nível e status atendidos | cursando, quando a vaga pede completo | nível abaixo, ou nenhuma formação lida | área não reconhecida |
| idioma | nível igual ou acima do pedido | um nível abaixo | ausente ou dois níveis abaixo | nível não lido |
| cargo | mesma família | família vizinha (fullstack ↔ backend) | outra família | — |
| não reconhecido | — | — | — | sempre |

**Combinação**
- Numa linha com vários componentes, vale o pior: ✗ pesa mais que ?, que pesa mais que ◐, que pesa mais que ✓.
- Num grupo "alguma", vale o melhor.

**Motivo e evidência.** Cada resultado traz um motivo em linguagem simples e as evidências. Exemplo: "Java: 2 anos (Experiência · Revizia, Ago/2024–Jul/2026). A experiência na Clearsale não cita Java."

**Resolvendo um "?".** O usuário pode responder "tenho" ou "não tenho". A resposta fica marcada como "declarado por você", só em memória, e funciona como as perguntas de triagem das plataformas.

### 4.6 Faixa (núcleo)

1. **Not fit**: algum obrigatório está ✗, ou alguma eliminatória foi respondida com "não".
2. **Top fit**: todos os obrigatórios estão ✓ e a cobertura dos desejáveis é de pelo menos X (padrão: 50%).
3. **Maybe**: todos os outros casos.

**Detalhes da regra**
- **Cobertura dos desejáveis**: ✓ vale 1, ◐ vale 0,5, ✗ e ? valem 0.
- **Obrigatório ◐ ou ?**: impede Top fit, mas não causa Not fit. A tela indica quais requisitos revisar.
- **Vaga sem desejáveis**: vale só a regra dos obrigatórios.
- **Vaga sem obrigatórios** (sem seções): a tela avisa que a faixa depende da revisão do usuário.

A tela sempre mostra **o que falta para subir de faixa**: os requisitos ✗, ◐ ou ? que estão bloqueando.

### 4.7 Dimensões e número secundário

| Dimensão | Como é calculada | Peso no número |
|---|---|---|
| Requisitos obrigatórios | cobertura (✓ vale 1, ◐ vale 0,5) | 50 |
| Requisitos desejáveis | cobertura | 25 |
| Cargo | família do cargo atual comparada com a da vaga | 10 |
| Senioridade | senioridade do CV comparada com a da vaga: igual ou acima é ✓, um nível abaixo é ◐, dois ou mais é ✗ | 10 |
| Localização e modelo | UF comparada com o local e o modelo da vaga: mesma UF ou vaga remota é ✓ (item 33) | 5 |

Quando falta um dado (por exemplo, a vaga não diz o local), a dimensão sai do cálculo e os pesos são redistribuídos. Os pesos são do app, não de nenhuma plataforma, e por isso levam o selo "aproximação".

### 4.8 Eliminatórias, lacunas e avisos

**Eliminatórias prováveis (Q14).** São trechos da vaga que costumam virar pergunta de triagem:
- presencial ou híbrido com cidade, "residir em", mudança;
- idioma em nível alto (fluente ou avançado);
- formação obrigatória, período mínimo de curso (estágio), previsão de formatura;
- disponibilidade para viagens, plantão, sobreaviso ou início imediato;
- CNH, veículo próprio, autorização de trabalho ou visto;
- certificação obrigatória.

Cada uma vira a pergunta "você atende?", com resposta guardada só em memória.
- Resposta "não": a faixa vira Not fit em todas as lentes, com a explicação "a plataforma provavelmente reprova automaticamente".
- Sem resposta: a eliminatória só aparece na lista.

**Vagas afirmativas** ("vaga exclusiva para…"): só um aviso informativo. O app nunca pergunta nem pontua dados de identidade.

**Lacunas.** Intervalos maiores que 6 meses entre experiências, ou desde a última experiência quando ela não é atual. É só informação, sem penalidade. O aviso cita o Hidden Workers como exemplo de critério que alguns sistemas usam para ranquear.

**Avisos de preenchimento**
- Skill da vaga que é só implícita: "adicione X também em Habilidades". Gupy e LinkedIn leem essa seção de forma explícita.
- Skill da vaga que aparece só em Certificações ou Projetos: "a Gupy não analisa esse campo".
- Mais de 30 habilidades: "a Gupy recomenda preencher as 30 com maior aderência a você".
- Vaga em inglês e CV em português, ou o contrário: "a Gupy recomenda o CV no idioma da vaga".

### 4.9 Lentes

**Núcleo**
- **Evidência**: todas as seções do CV.
- **Resultado**: Top fit, Maybe ou Not fit, pela regra da seção 4.6.
- **Aproximação**: os pesos do número secundário.

**Gupy**
- **Evidência**: Experiência e Habilidades. Formação e idiomas também contam, como aproximação, porque as fontes se contradizem.
- **Resultado**: aderência alta, média ou baixa, pela regra da seção 4.6 aplicada só a essas fontes. É aproximação: a Gupy não publica faixas.
- **Particularidades**:
  - um obrigatório ✗ gera o alerta "pode ser reprovado no cadastro se a empresa marcou como pré-requisito";
  - dicas documentadas: perfil completo, conquistas com números, concluir testes cedo, preferir DOC/DOCX ou o export do LinkedIn.
- **Aproximações**: quais campos são lidos e os rótulos de faixa.

**LinkedIn**
- **Evidência**: todas as seções. Explícita é o que está em Habilidades; implícita é o resto.
- **Resultado**: Top fit, Maybe ou Not a fit, junto com o indicador "x de y skills".
- **Regra**: a da seção 4.6. Uma vaga em outro país limita a faixa a Maybe.
- **Particularidade**: a tela lembra que o match visto pelo candidato é do Premium e que o recrutador não o vê.
- **Aproximações**: o valor de X e o modo como "parcial" entra na faixa.

**Workday / HiredScore**
- **Evidência**: todas as seções.
- **Resultado**: nota A, B, C ou D, ou "sem nota".
- **Regra**:
  - A: todos os obrigatórios ✓ e mais de 50% dos desejáveis;
  - B: todos os obrigatórios;
  - C: mais de 50% dos obrigatórios;
  - D: 50% ou menos.
- **Particularidades**:
  - "sem nota" quando o PDF não tem texto;
  - vaga de estágio ou trainee gera o aviso de campus/graduate;
  - a tabela de requisitos faz o papel do Fit & Gap.
- **Aproximações**: "maioria" interpretada como mais de 50%, e uso do algoritmo legado.

A InHire não tem lente porque o método dela não é público.

### 4.10 Princípios

- O app nunca usa como sinal nome, idade, gênero, raça, foto, estado civil ou o prestígio da instituição de ensino. Gupy e Greenhouse dizem excluir esses dados, e o app faz o mesmo.
- Toda regra que não vem de documentação aparece como aproximação.
- Todo status vem com o motivo. Nenhum número aparece sem explicação.

## 5. Exemplo com os seus CVs

Vaga sintética de exemplo:

```
Desenvolvedor Java Pleno
Requisitos:
- 3+ anos de experiência com Java e Spring Boot
- Bancos relacionais (PostgreSQL ou MySQL)
- Inglês intermediário
Diferenciais:
- AWS ou GCP
- Kubernetes
Modelo híbrido em São Paulo - SP
```

O que o algoritmo planejado calcularia a partir do que o parser atual extrai:

| | CV J-2 (Google Docs) | CV Profile (export do LinkedIn) |
|---|---|---|
| Obrig. · 3+ anos com Java e Spring Boot | ◐ Java por 2 anos (Revizia). A Clearsale não cita Java | ✗ Java por 7 meses. O estágio na Revizia diz "mesma stack", sem citar Java |
| Obrig. · PostgreSQL ou MySQL | ✓ Habilidades | ✓ Experiência · Revizia (só implícita) |
| Obrig. · Inglês intermediário | ✓ Avançado (TOEIC B2) | ✓ Full Professional |
| Desej. · AWS ou GCP | ✓ Habilidades | ✓ Experiência · Revizia (só implícita) |
| Desej. · Kubernetes | ✗ | ✗ |
| Senioridade | ◐ cabeçalho diz Júnior; a vaga pede Pleno | ◐ último cargo é Junior |
| **Núcleo / LinkedIn** | **Maybe** (obrigatório parcial), ≈ 72 | **Not fit** (obrigatório não atendido), ≈ 64 |
| **Workday** | **C** (maioria dos obrigatórios) | **C** |
| **Gupy** | aderência média | aderência baixa |
| Avisos | eliminatória provável: híbrido em São Paulo, você atende? | idem; e "PostgreSQL e AWS só aparecem no texto das experiências: adicione em Habilidades" |

O que o exemplo mostra:
- **Uma frase vaga apaga tempo de experiência.** No Profile, "mesma stack" esconde 1 ano e 5 meses de Java do ATS. É o efeito da Q5 aparecendo para o candidato.
- **O cabeçalho pesa na senioridade.** O P-1, que é igual ao J-2 mas diz "Pleno" no cabeçalho, teria senioridade ✓.
- **As lentes discordam.** O Workday não diferencia os dois CVs (ambos C), enquanto o núcleo e o LinkedIn diferenciam.

## 6. Interface

Wireframe ilustrativo da seção nova, que aparece acima do conteúdo atual quando há vaga:

```
┌─ Ranqueamento para esta vaga ─────────────────────────────────────┐
│  Lente: [Núcleo] [Gupy] [LinkedIn] [Workday]                       │
│                                                                    │
│  ◐ ADERÊNCIA PARCIAL (Maybe)                          número: 72   │
│  Atende 2 de 3 obrigatórios e 50% dos desejáveis.                  │
│  Para chegar a Top fit: comprovar "3+ anos com Java e Spring Boot" │
├─ Requisitos ─────────────────────────────── [+ adicionar] ─────────┤
│  [Obrig. ▾] 3+ anos com Java e Spring Boot          ◐   [remover]  │
│             Java: 2 anos · Experiência · Revizia "Desenvolvi..."   │
│  [Obrig. ▾] PostgreSQL ou MySQL                     ✓              │
│             Habilidades · "Banco de dados: SQL, PostgreSQL..."     │
│  [Desej. ▾] Kubernetes                              ✗              │
│  [Obrig. ▾] Experiência com Quarkus                 ?  [tenho][não]│
│             "Quarkus" não está no dicionário  [tratar como skill]  │
├─ Dimensões ────────────────────────────────────────────────────────┤
│  Cargo ✓ backend · Senioridade ◐ júnior × pleno · Local ◐ SP       │
├─ A plataforma deve perguntar ─────────────────────────────────────┤
│  Híbrido em São Paulo - SP: você atende?    ( ) sim   ( ) não      │
├─ Avisos ───────────────────────────────────────────────────────────┤
│  • "AWS" aparece só no texto das experiências: adicione em         │
│    Habilidades.                                                    │
├─ O que não dá para avaliar localmente ─────────────────────────────┤
│  formulários, testes, pesos do recrutador, concorrência...         │
└────────────────────────────────────────────────────────────────────┘
┌─ Formato e leitura (o que já existe) ──────────────────────────────┐
```

**Comportamento**
- O estado fica no `App`: a vaga já interpretada e editada, as respostas declaradas, a lente e o X.
- O resultado é recalculado com `useMemo(rank)`.
- Reanalisar o texto da vaga descarta as edições, depois de pedir confirmação.
- Nada é salvo: fechar a página apaga tudo (Q22).
- Cada aproximação aparece com um selo clicável que leva à fonte.

## 7. Arquitetura e arquivos

```
src/lib/ranking/
├── types.ts               JobSpec, Requirement, Component, CvProfile, Evidence,
│                          RequirementResult, RankingResult, LensConfig
├── dicionario/
│   ├── skills.ts          ~300 SkillDef
│   ├── cargos.ts          famílias de cargo, vizinhas e senioridade
│   ├── locais.ts          UFs e cidades conhecidas (Fase 2)
│   └── lexicos.ts         seções da vaga, marcadores, soft skills, eliminatórias,
│                          níveis de idioma e de formação, áreas de TI
├── matcher.ts             compila o dicionário e encontra skills com posição
├── datas.ts               períodos → intervalos, união, anos, lacunas
├── vaga.ts                parseJob(texto) → JobSpec
├── requisitos.ts          decompõe uma linha em componentes
├── perfil.ts              buildCvProfile(structured) → CvProfile
├── avaliar.ts             status, motivo e evidências por requisito
├── faixa.ts               regra do núcleo e mapeamentos das lentes
├── dimensoes.ts           cargo, senioridade, localização e número
├── eliminatorias.ts       detecção na vaga (local, modelo, perguntas, vaga afirmativa)
├── local.ts               cidade/UF e modelo de trabalho (Fase 2)
├── avisos.ts              avisos de preenchimento (Fase 2)
├── lentes.ts              as 4 lentes, com aproximações e fontes
└── index.ts               rank(perfil, vaga, lente, opções) → RankingResult

src/components/ranking/
├── RankingPanel.tsx       container da seção
├── LensSelector.tsx
├── LensDetails.tsx       alertas, aproximações e fontes da lente (Fase 3)
├── BandHero.tsx           faixa, número e "o que falta"
├── RequirementsTable.tsx  edição, status, evidência e "?" resolvível
├── Dimensions.tsx
├── Knockouts.tsx
├── Warnings.tsx
└── NotEvaluable.tsx
```

**Tipos centrais (resumo)**

```ts
type ReqStatus = 'atende' | 'parcial' | 'nao_atende' | 'nao_verificavel';

interface Requirement {
  id: string;
  texto: string;                      // linha original da vaga
  tipo: 'obrigatorio' | 'desejavel' | 'informativo';
  origemTipo: 'marcador' | 'secao' | 'heuristica' | 'padrao' | 'usuario';
  componentes: Component[];
}

type Component =
  | { tipo: 'skill'; ids: string[]; modo: 'todas' | 'alguma' }
  | { tipo: 'anos'; minimo: number; skillIds: string[]; familia?: string }
  | { tipo: 'formacao'; nivelMinimo: NivelFormacao; area: 'ti' | 'qualquer'; aceitaCursando: boolean }
  | { tipo: 'idioma'; idioma: string; nivelMinimo: NivelIdioma }
  | { tipo: 'cargo'; familia: string }
  | { tipo: 'nao_reconhecido'; termos: string[] };

interface Evidence {
  fonte: 'habilidades' | 'experiencia' | 'resumo' | 'cabecalho' | 'certificacoes'
       | 'projetos' | 'formacao' | 'idiomas' | 'declarado';
  rotulo: string;                     // "Experiência · Revizia"
  trecho: string;
  explicita: boolean;
}
```

**Mudanças em arquivos existentes**

| Arquivo | Mudança |
|---|---|
| `src/lib/structure.ts` | `Structured` ganha `resumo`, `cabecalho` e `projetos`. A lógica de datas vai para `ranking/datas.ts`, que passa a ser usada pelos dois módulos. |
| `src/lib/analyze.ts` | Para de chamar `matchJob`. `Analysis` perde o campo `match`. O score de formato não muda. |
| `src/lib/match.ts` | Sai o score por frequência. `tokenize` continua, para a lista de termos da vaga ausentes no CV. |
| `src/App.tsx` | Guarda o estado da vaga editável, da lente e do X, e calcula `useMemo(rank)`. |
| `src/components/Results.tsx` | Mostra o `RankingPanel` antes do formato quando há vaga. |
| `tests/fixtures.test.ts` | O teste de match passa a cobrir a nova lista de termos. |

Nenhuma dependência nova.

## 8. Testes

| Arquivo | O que trava |
|---|---|
| `tests/ranking/matcher.test.ts` | aliases; limites de palavra (C#, C++, .NET, Node.js); skills ambíguas (Go, R); alias mais longo primeiro (SQL Server, Spring Boot) |
| `tests/ranking/vaga.test.ts` | 10+ vagas reais em `fixtures/vagas/NN.txt`, cada uma com um `NN.esperado.json` (requisitos, classificação e componentes) |
| `tests/ranking/avaliar.test.ts` | as regras da tabela 4.5, com perfis sintéticos |
| `tests/ranking/avaliar.test.ts` | os casos de borda da 4.6 (a faixa ficou junto da avaliação) |
| `tests/ranking/lentes.test.ts` | notas do Workday e "sem nota", fontes da Gupy, regra de país do LinkedIn, links das aproximações e as 4 lentes com os 4 CVs |
| `tests/ranking/cvs.test.ts` | os 4 CVs contra 2 ou 3 vagas, com a faixa travada por lente; anos de Java (J-2 = 2 anos, Profile = 7 meses) |
| `tests/calibracao.test.ts` | roda `fixtures/candidaturas/`; é pulado quando a pasta não existe |

### 8.1 Casos de calibração (Q7, Q19)

Passo a passo para montar cada caso: [como-documentar-candidaturas.md](como-documentar-candidaturas.md).

```
fixtures/candidaturas/              (está no .gitignore)
└── 2026-09-gupy-empresa-cargo/     AAAA-MM-plataforma-empresa-cargo
    ├── vaga.txt                    texto completo da vaga
    ├── cv.pdf                      o PDF exatamente como foi enviado
    └── meta.json
```

O nome da pasta é a fonte do mês, da plataforma (`gupy`, `linkedin`, `workday`, `inhire`, `greenhouse` ou `outra`), da empresa (uma palavra) e do cargo. *Revisado na Fase 4:* o `meta.json` não repete esses dados, porque quem documenta nem sempre sabe o dia exato; se ele trouxer `plataforma`, vale o nome da pasta.

Campos do `meta.json`:

| Campo | Valores |
|---|---|
| `data` | opcional: dia exato, no formato `AAAA-MM-DD`, quando se sabe |
| `resultado` | `passou_triagem`, `reprovado` ou `sem_retorno` (`sem_retorno` conta como desconhecido, não como reprovação) |
| `observacoes` | texto livre e opcional (exemplo: "chamado para teste técnico") |
| `etapa` | opcional: até onde a candidatura chegou (`triagem`, `teste`, `entrevista RH`…) |
| `dias_ate_resposta` | opcional: dias até a primeira resposta; reprovação em horas sugere corte automático |
| `perguntas` | opcional: perguntas do formulário e respostas, `[{ "pergunta": "...", "resposta": "..." }]`, para medir o detector de eliminatórias |

Só `resultado` é obrigatório. Pastas que começam com `_` (como o modelo `_modelo/` e cópias dele) são ignoradas. Campos opcionais vazios (`""`, `null`, `[]`) e valores que sobraram do modelo (`"AAAA-MM-DD"`) contam como ausentes.

O comando `npm run calibrar` (`tests/calibracao.test.ts`) valida os casos e gera `fixtures/candidaturas/relatorio.md`, que também fica fora do git. `npm test` roda a mesma validação, mas não grava o relatório. O relatório traz cada caso nas quatro lentes ao lado do resultado real, lido na lente da plataforma em que foi enviado, e a versão do CV (pelo nome, quando é um dos PDFs de referência). Ele destaca para revisão:
- `passou_triagem` que o app classificou como Not fit;
- `reprovado` que o app classificou como Top fit;
- vaga em que nenhum requisito foi lido;
- perguntas do formulário que o app não previu, e eliminatórias previstas que não viraram pergunta.

## 9. Fases

Cada fase termina com typecheck, testes e build limpos e com verificação no navegador.

### Fase 1: Núcleo

- [x] Mover a lógica de datas para `ranking/datas.ts` e adicionar `resumo`, `cabecalho` e `projetos` ao `Structured`.
- [x] Criar o dicionário v1 (~330 skills, famílias de cargo e senioridade) e o matcher, com testes.
- [x] Escrever `parseJob`: seções, classificação e decomposição. Os componentes de anos, formação e idioma são reconhecidos, mas avaliados como "?" até a fase 2.
- [x] Montar o `buildCvProfile` com skills e evidências explícitas e implícitas.
- [x] Implementar a avaliação, a faixa do núcleo e o número (só obrigatórios e desejáveis nesta fase).
- [x] Construir a UI: `RankingPanel`, tabela editável, "?" resolvível e termos não reconhecidos que podem virar skill.
- [x] Remover o score por frequência (Q13).
- [x] Testes de leitura com 10+ vagas reais: 13 vagas em `fixtures/vagas/reais/` (Gupy, LinkedIn, Greenhouse, InHire, Workday), cada uma com o `.esperado.json` revisado.
- [x] Ajustes vindos das vagas reais: títulos com emoji e em inglês, exemplos ("como", "ex.:", parênteses), "A/B" ligando só o par, grafias que valem por duas skills, descarte de texto institucional e cerca de 40 termos novos no dicionário.

### Fase 2: Experiência e eliminatórias

- [x] Calcular intervalos, anos totais (com a parte de estágio), anos por skill, último uso e lacunas.
- [x] Avaliar os componentes de anos, formação, idioma e cargo.
- [x] Calcular as dimensões de cargo, senioridade e localização.
- [x] Implementar o detector de eliminatórias com as caixas de resposta (resposta "não" leva a Not fit) e o aviso informativo de vagas afirmativas.
- [x] Mostrar os avisos: skill só implícita, skill só em Certificações ou Projetos, mais de 30 habilidades, idioma da vaga diferente do CV, lacunas.
- [x] Faixa e número de cada CV de referência em cada vaga real travados em `fixtures/vagas/reais/_faixas.esperado.json`.
- [x] Ajustes que a fase pediu: contato lido também de uma seção "Contato" (CVs de duas colunas), cargo e senioridade lidos da apresentação quando a vaga não tem título, título terminado em "Jr." aceito, "Desenvolvedor Full Stack" deixou de ser lido como título de seção ("stack").

### Fase 3: Lentes

- [x] Criar o `LensConfig` e o seletor de lente.
- [x] Gupy: fontes restritas, rótulos de aderência, alerta de pré-requisito e dicas.
- [x] LinkedIn: "x de y skills" e a regra de vaga em outro país.
- [x] Workday: notas A–D, "sem nota" e o aviso de campus/graduate.
- [x] Selos de aproximação com link para a fonte.
- [x] Resultado das 4 lentes para os 4 CVs em cada vaga real travado em `fixtures/vagas/reais/_lentes.esperado.json`.

### Fase 4: Calibração

- [x] Estrutura de `fixtures/candidaturas/`, com validação do nome da pasta e do `meta.json` (campos opcionais da seção 8.1; pastas com `_` ignoradas; `vaga.txt` do modelo não preenchido vira erro).
- [x] Teste de calibração e comando `npm run calibrar`.
- [x] Revisar os casos destacados e ajustar o dicionário e as regras (1ª rodada, 13/10/2026: 9 casos, 6 com resultado conhecido; ver itens 44 a 51 da seção 11).

**1ª rodada.** O único `passou_triagem` saiu como Top fit, e nenhum ficou como Not fit (critério da seção 10). Dos 5 `reprovado`, 3 saíram como Not fit, 1 como Maybe e 1 como Top fit; nesse último, a vaga foi lida certo e o corte veio de algo que o app não vê. Uma vaga era um anúncio-modelo, sem requisitos ("(requirement 1)"), e agora aparece como "sem requisitos lidos". Com menos de 20 casos, esses números servem para achar erros, não para medir acerto.

## 10. Critérios de pronto (Q25)

| Fase | Pronto quando |
|---|---|
| 1 | Os testes de extração passam em pelo menos 10 vagas reais. Os 4 CVs têm a faixa travada em teste contra 2 ou 3 vagas. A UI foi verificada no navegador. |
| 2 | Os anos dos 4 CVs batem com os valores esperados (por exemplo, Java no J-2 = 2 anos e no Profile = 7 meses). As eliminatórias e os avisos estão cobertos por teste. As faixas foram atualizadas e travadas. |
| 3 | Cada lente tem teste com os 4 CVs. O caso escaneado sintético dá "sem nota" no Workday. Cada aproximação tem link para a fonte. |
| 4 | O relatório não mostra nenhum `passou_triagem` como Not fit sem explicação. Não há meta numérica de acerto enquanto houver menos de 20 casos. |

## 11. Detalhes que decidi no plano (revise)

Estes pontos não foram perguntados um a um. Mude o que não fizer sentido.

**Regra da faixa**
1. **Parcial.** Vale 0,5 nas coberturas. Um obrigatório parcial ou "?" impede Top fit, mas não causa Not fit, nem no núcleo nem no LinkedIn. A documentação do LinkedIn não diz como "parcial" entra na faixa.
2. **X padrão de 50%.** Para o equivalente ACE, a documentação do Taleo sugere começar com 75%. Fica como alternativa no ajuste.
3. **Eliminatórias.** A resposta "não" leva a Not fit em todas as lentes. Sem resposta, a faixa não muda.
4. **"?" resolvível.** O usuário pode resolver um "?" com "tenho" ou "não tenho". A resposta fica marcada como declarada.

**Tempo de experiência e senioridade**
5. **Anos.** É ◐ quando falta até 1 ano, para mínimos de 2 anos ou mais. O estágio entra no total, do mesmo jeito que um parser soma datas, e a parte de estágio aparece separada.
6. **Anos com várias skills.** Em "Java e Spring Boot", vale a skill com menos tempo. Em "ou", vale a com mais tempo.
7. **Senioridade.** É procurada no título do último cargo, depois no cabeçalho e, por último, nos anos: júnior até 2 anos, pleno de 2 a 5, sênior acima de 5 (aproximação de mercado). Senioridade acima da pedida conta como ✓.

**Leitura da vaga e do CV**
8. **Linhas de Responsabilidades/Atividades** que citam uma skill viram **informativas** e não entram na faixa. *Revisado na Fase 1:* nas vagas reais elas são muitas (7 linhas nas vagas 03 e 12) e dominariam a cobertura dos desejáveis, enquanto as plataformas comparam com requisitos e diferenciais. O usuário pode mudar o tipo de qualquer uma.
9. **Níveis de idioma.** A ordem é básico, intermediário, avançado, fluente e nativo.
   - CEFR: A1–A2 = básico, B1 = intermediário, B2 = avançado, C1–C2 = fluente.
   - Níveis do LinkedIn: Elementary = básico, Limited working = intermediário, Professional working = avançado, Full professional = fluente, Native or bilingual = nativo.
   - "Técnico" ou "leitura" = intermediário.
10. **Áreas de TI** para formação: Ciência e Engenharia da Computação, Sistemas de Informação, Engenharia de Software, ADS, Redes, Segurança da Informação, Ciência de Dados, Banco de Dados, Jogos Digitais e Informática. "Áreas afins" aceita qualquer uma delas.

**Lentes**
11. **Gupy: formação e idiomas.** Contam na lente Gupy, com selo de aproximação, porque as fontes se contradizem.
12. **Gupy: export do LinkedIn.** Quando o PDF é um export do LinkedIn, a lente Gupy avisa que a Gupy diz ler melhor esse formato. O score de formato continua penalizando as duas colunas, porque outros parsers sofrem com elas.
13. **Workday.** "Maioria" significa mais de 50%. Na contagem, ◐ vale 0,5 e "?" vale 0. O app usa o algoritmo legado, porque o novo depende de opt-in.
14. **LinkedIn.** Uma vaga em outro país limita a faixa a Maybe, como diz o FAQ do Hiring Pro.

**Tela**
15. **Pesos do número secundário**: 50, 25, 10, 10 e 5 (seção 4.7).
16. **Reanalisar a vaga** a partir do texto descarta as edições, depois de pedir confirmação.

**Decididos durante a Fase 1**
17. **Parcial por relação.** Uma skill pedida conta como parcial quando o CV tem uma skill relacionada (MySQL ↔ PostgreSQL, Java ↔ Kotlin) ou a skill "mãe" dela (Spring Boot pedido e Spring no CV; TypeScript pedido e JavaScript no CV; Glue pedido e AWS no CV). O motivo sempre nomeia a skill que foi encontrada. *Revisado na Fase 1:* conceitos amplos (back-end, containers, mensageria, lógica de programação…) não servem de ponte. Sem isso, qualquer linguagem viraria parcial de qualquer outra (Go pedido e Java no CV), e Docker deixaria Kubernetes parcial.
18. **Exemplos entre parênteses** logo depois de uma skill viram alternativas dela. "Bancos relacionais (PostgreSQL ou MySQL)" aceita qualquer um dos três.
19. **Linha sem nada reconhecível** numa seção de requisitos vira "?" quando tem até 14 palavras. Mais longa que isso, vai para a lista de não avaliáveis, porque costuma ser descrição.
20. **Vaga com seções:** o texto antes do primeiro título (apresentação, stack) é tratado como atividade. Só as linhas que citam tecnologia entram, como desejáveis.
21. **Idioma sem nível** ("Inglês") é lido como intermediário.
22. **Lista longa com um item faltando.** Numa linha com 3 ou mais skills em que só uma falta ("Design Patterns, POO, SOLID, KISS, DRY e YAGNI"), a linha fica parcial, não ✗. Com duas ou mais faltando, continua ✗.
23. **Grafias que valem por duas skills**, todas exigidas: "testes unitários e de integração", "APIs e integrações", "HTML/CSS".
24. **"A/B"** liga só o par vizinho ("HTTP/REST" é alternativa; "estruturas de dados, POO, HTTP/REST" continua pedindo estruturas de dados e POO).
25. **Exemplos:** "X, como A ou B", "X (ex.: A)", "X, preferencialmente A" e "X (A, B)" viram alternativas de X. Termo desconhecido dentro de um parêntese que já tem skill reconhecida é só mais uma alternativa ("integrações (IDoc, RFC, APIs)").
26. **Texto institucional** numa seção de requisitos é descartado. Linhas que só citam nomes próprios ficam apenas se parecerem requisito ("Conhecimento em Protheus"). Perguntas ("Who is Equifax?") e frases sobre modelo de trabalho e benefícios saem.
27. **Link no contato** do CV conta como evidência ("github.com/usuario" comprova GitHub).

**Decididos durante a Fase 2**

28. **Contagem de meses.** O período inclui o mês de início e o de fim: ago/2024–jul/2026 são 24 meses. Ano sozinho vale janeiro no início e dezembro no fim. "Atual" vai até hoje.
29. **Tempo por skill** conta as experiências que citam a skill ou uma skill que a implica (SQL Server conta como SQL). O motivo diz quais experiências com data não citam a skill: é assim que o "mesma stack" do Profile aparece para o candidato.
30. **Senioridade pelo tempo** conta o estágio (revisado por você em 13/10/2026).
31. **Famílias vizinhas** (◐) só dentro da área de programação: full stack com back-end e front-end; front-end com mobile; "desenvolvimento" sem especialidade com back-end, front-end, full stack e mobile. Áreas diferentes (back-end × suporte, back-end × dados, DevOps × suporte…) não contam nem como parcial (revisado por você em 13/10/2026). Uma vaga de "desenvolvimento" sem especialidade é ✓ para back-end, front-end, full stack e mobile.
32. **Dimensão cargo.** Compara o cargo atual; uma experiência anterior na área da vaga sobe o ✗ para ◐.
33. **Local.** Mesma UF é ✓, com ou sem a mesma cidade (revisado por você em 13/10/2026); outra UF é ✗. No CV, a cidade só é lida no formato "Cidade - UF", porque um nome solto no topo pode ser o do candidato. Na vaga, também vale uma cidade conhecida sem UF ("São Paulo, Brazil"). "Presencial com flexibilidade" ou "2x por semana" é híbrido.
34. **Formação.** Vale a melhor formação do CV. Curso fora de TI numa vaga que pede TI fica "?" para o usuário confirmar ("áreas correlatas" pode aceitar). Trancado é ✗; situação não informada é "?". Intercâmbio não conta como nível.
35. **Idioma do CV.** Vem da seção Idiomas; sem ela, do resumo ("inglês avançado"). Idioma citado sem nível fica "?".
36. **Eliminatórias.** Do texto: local (presencial ou híbrido com cidade, ou "residir em"), disponibilidade (viagens, plantão, fins de semana, início imediato) e documentos (CNH, veículo, autorização de trabalho). De requisitos obrigatórios: idioma a partir de avançado, formação, período do curso e certificação. Uma pergunta de local por vaga. "Sim" não muda a faixa; "não" leva a Not fit. Mudar o requisito para desejável tira a pergunta.
37. **Mais de 30 habilidades** conta as skills do dicionário nos itens da seção Habilidades, sem o nome das categorias ("Back-end: …").
38. **Idioma da vaga** é medido nos requisitos, porque o texto institucional pode estar em outra língua ("Who is Equifax?"). Textos curtos ficam sem idioma e sem aviso.

**Decididos durante a Fase 3**

39. **Gupy: evidências.** Valem Experiência, Habilidades, Formação e Idiomas. Uma skill que o CV só cita em Resumo, Cabeçalho, Contato, Certificações ou Projetos fica ✗ nessa lente, com o motivo "o CV cita só em…", e um alerta pede para citá-la em Experiência ou Habilidades. O idioma só vale da seção Idiomas.
40. **Gupy: obrigatório não atendido** gera o alerta "se a empresa definiu o requisito como obrigatório, a reprovação é automática; sem isso, ele só pesa na ordenação".
41. **LinkedIn: "x de y skills".** Cada skill (ou grupo de alternativas) pedida em obrigatórios e desejáveis conta uma vez; conta como "na seção Habilidades" quando há evidência explícita.
42. **LinkedIn: país da vaga.** Cidade ou UF brasileira é Brasil; sem isso, vale o nome do país no topo da vaga ou no rótulo de local ("Lisboa, Portugal"). O app considera que o candidato está no Brasil.
43. **Workday.** Sem desejáveis, todos os obrigatórios já dão A. Vaga de estágio ou trainee fica "sem nota" e mostra a nota que teria. "Não" numa eliminatória vira "Reprovado na triagem", também com a nota que teria; essa regra é do app (item 3), sem página do Workday que a sustente. O ajuste de desejáveis para Top fit não aparece nessa lente.

**Decididos durante a Fase 4** (ajustes que as candidaturas reais pediram)

44. **Nome da pasta do caso** é a fonte do mês, da plataforma e da empresa; o `meta.json` só precisa de `resultado` (seção 8.1).
45. **Lista colada numa linha só** (a cópia do LinkedIn às vezes junta tudo: "…: - Item; - Item. Requisitos e Qualificações: - …"): a linha é quebrada nos bullets e os títulos no meio dela trocam a seção. Linha que já começa com título ("Certificações desejáveis: A, B ou C") continua inteira.
46. **Item de atividade dentro de Requisitos.** Linha que começa com verbo de atividade no infinitivo ("Desenvolver…", "Implementar…", "Participar…") vira informativa, mesmo listada em Requisitos. Verbos de requisito (ter, possuir, saber, conhecer) não entram, e um marcador na linha ("diferencial") vence.
47. **Lista de tecnologias** ("Principais tecnologias", "Stack"): é contexto quando a vaga tem seção de requisitos; sem ela, vale como requisito, desejável por padrão (Q17).
48. **Prosa institucional.** Parágrafo longo (mais de 30 palavras) que só cita tempo ("…com 6 anos de experiência no mercado") não vira requisito. Linhas sem seção que só citam nomes próprios seguem a mesma regra das seções (item 26).
49. **Leituras novas:** "Formação completa ou em andamento em…" é ensino superior aceitando cursando; "PL" é pleno, salvo em "PL/SQL"; modelo no título depois de separador ("… - Híbrido São Paulo"), mas não "Mobile Híbrido"; "Modelo:" vale como rótulo; "What can you expect from us", "O que você encontrará" e "Como se candidatar" são seções ignoradas.
50. **Rótulo de categoria** ("Mensageria: Kafka / RabbitMQ", "Back-end: Java…") sai quando um item depois dos dois pontos já o comprova.
51. **Dicionário:** IBM Db2, SOA (só em maiúsculas), Unix (parcial para Linux), redes de computadores, manutenção de computadores, depuração, "relacional" sozinho, agentes de IA, Lovable e "API Gateways".

## 12. Riscos e limitações

- **A leitura da vaga é heurística.** Uma vaga mal formatada gera requisitos errados. A edição na tabela e o aviso "revise" reduzem o problema.
- **O dicionário precisa de manutenção.** Uma skill nova que não está nele aparece como "?" até ser adicionada.
- **O score não está calibrado** enquanto houver menos de 20 casos reais.
- **As plataformas mudam.** O Workday mudou o algoritmo em agosto de 2026, e o LinkedIn tem duas descrições oficiais diferentes da mesma regra.
  - Revisar as fontes a cada 6 meses.
  - Mostrar na tela a data da última verificação.
- **Risco de otimizar para o app.** O objetivo é mostrar o que o ATS não lê, não inflar palavras-chave. A própria Gupy avisa que o exagero atrapalha na avaliação humana.
- **O app lê só PDF.** Gupy e Workday aceitam DOC e DOCX, e a Gupy diz ler melhor o DOCX. Ler DOCX fica fora deste plano.
- **Dados pessoais fora do repositório.** Os PDFs de referência (`fixtures/*.pdf`) são locais e ficam no `.gitignore`; quem clonar precisa de CVs próprios com esses nomes para rodar `cvs.test.ts` e `fixtures.test.ts`.

## 13. Pendências suas

1. **10 ou mais textos completos de vagas reais de tecnologia**, de preferência de plataformas diferentes e com as seções de requisitos e diferenciais. Ficam em `fixtures/vagas/` e são versionados, porque são anúncios públicos. Se preferir, também podem ficar fora do git.
2. **Casos de calibração** em `fixtures/candidaturas/`, no formato da seção 8.1. Passo a passo em [como-documentar-candidaturas.md](como-documentar-candidaturas.md).
3. **Revisar a seção 11.**

## 14. Fontes

Fontes conferidas em 12/10/2026, salvo quando indicado.

**Gupy**
- Como funciona a ordenação: https://www.gupy.io/blog-do-emprego/como-funciona-a-ordenacao-da-gupy
- Agentes de IA da Gupy: https://www.gupy.io/blog-do-emprego/gupy-ia (idêntico a https://gupy.io/inteligencia-artificial)
- Preenchimento de currículo e parser: https://www.gupy.io/blog-do-emprego/preenchimento-de-curriculo
- Ordenação de pessoas candidatas: https://www.gupy.io/blog-do-emprego/algoritmo-de-pessoas-candidatas
- Nova ordenação (página para empresas): https://www.gupy.io/nova-ordenacao-com-agentes-de-ia
- Critérios eliminatórios / como passar pelos agentes: https://www.gupy.io/inteligencia-artificial/criterios-eliminatorios-no-cadastro

**LinkedIn**
- Job match e Top Applicant: https://www.linkedin.com/help/linkedin/answer/a7120158
- Skills match: https://www.linkedin.com/help/linkedin/answer/a793433
- Assistente de IA para vagas (Top fit / Maybe / Not a fit): https://business.linkedin.com/hire/post-jobs/ai-assistant
- Hiring Pro FAQ (divergência na regra): https://www.linkedin.com/help/learning/answer/a6898871
- Perguntas de triagem: https://www.linkedin.com/help/linkedin/answer/a519651
- Hiring Assistant: https://business.linkedin.com/talent-solutions/hiring-assistant

**Workday / HiredScore**
- Notas A–D: https://doc.workday.com/hiredscore/en-us/workday-hiredscore/recruiter-productivity-/reference--candidate-grades.html
- Spotlight (condições de "sem nota"): https://doc.workday.com/hiredscore/en-us/workday-hiredscore/recruiter-productivity-/concept--spotlight.html
- FAQ (formatos aceitos): https://doc.workday.com/hiredscore/en-us/workday-hiredscore/recruiter-productivity-/faq--hiredscore-general.html
- Fit & Gap: https://doc.workday.com/hiredscore/en-us/workday-hiredscore/recruiter-productivity-/concept--fit---gap.html
- Notas de release de agosto de 2026: https://doc.workday.com/hiredscore/en-us/workday-hiredscore/hiredscore-release-notes/2026/august/wednesday--5th-august.html

**Greenhouse**
- Talent Matching: https://support.greenhouse.io/hc/en-us/articles/41396009937307-Talent-Matching
- FAQ de processamento de dados: https://support.greenhouse.io/hc/en-us/articles/41131616864283-Talent-Matching-Data-Processing-FAQ

**Taleo**
- Candidate prescreening: https://docs.oracle.com/en/cloud/saas/taleo-enterprise/20b/otrec/candidate-prescreening.html

**Estudos e reportagens**
- Pesquisa Enhancv sobre rejeição automática: https://itbrief.co.uk/story/study-reveals-ats-rarely-auto-rejects-cvs-debunks-75-myth
- Hidden Workers (HBS): https://www.library.hbs.edu/working-knowledge/how-to-tap-the-talent-automated-hr-platforms-miss

**Citadas na pesquisa inicial, não reconferidas [NV]**
- InHire: https://www.inhire.com.br/produto/ia
- Catho: https://www.catho.com.br/carreira-sucesso/inteligencia-artificial/
- Vagas.com: https://www.vagas.com.br/blog/?p=4645 e https://www.vagas.com.br/blog/?p=4693
- The Intercept sobre a Gupy: https://www.intercept.com.br/?p=415068
