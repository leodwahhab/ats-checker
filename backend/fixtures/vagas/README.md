# Vagas de teste

- `sinteticas/`: vagas escritas para os testes, com casos de borda conhecidos.
- `reais/`: textos completos de vagas reais de tecnologia (anúncios públicos). Critério de pronto da
  Fase 1: pelo menos 10 vagas aqui.

## Como adicionar uma vaga real

1. Salve o texto completo da vaga em `reais/NN-plataforma-cargo.txt` (UTF-8), com as seções como
   aparecem no anúncio (Requisitos, Diferenciais, Responsabilidades…).
2. Rode `npm test`. Na primeira execução o teste grava `reais/NN-plataforma-cargo.esperado.json`
   com a leitura atual da vaga.
3. Revise o `.esperado.json`: cada requisito, se é obrigatório, desejável ou informativo (tecnologia
   citada nas atividades, fora da faixa) e os componentes (`skill:`, `alguma:`, `anos:`, `formacao:`,
   `idioma:`, `cargo:`, `?:` para termo não reconhecido). Confira também o modelo de trabalho, o
   local, as eliminatórias prováveis e se a vaga é afirmativa.
   Corrija o código ou o dicionário até a leitura estar certa e rode `npx vitest run -u` para
   regravar. A partir daí o arquivo trava o comportamento.

`reais/_faixas.esperado.json` guarda a faixa e o número de cada CV de referência em cada vaga real
(`faixa número · obrigatórios · desejáveis`), e `reais/_lentes.esperado.json`, o resultado nas 4
lentes (`núcleo · Gupy · LinkedIn · Workday`). Uma vaga nova acrescenta uma entrada; uma mudança de
regra aparece no diff desses arquivos.
