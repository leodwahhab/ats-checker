// Seção 3.9 do plano: fica sempre visível (Q9).
const FORA_DO_ALCANCE: Array<[string, string]> = [
  ['Formulários e perguntas eliminatórias', 'Pretensão salarial, disponibilidade, autorização de trabalho.'],
  ['Testes da plataforma', 'Fit cultural, perfil comportamental, lógica, e o bônus de tê-los concluído.'],
  ['Pesos de cada recrutador', 'Cada empresa configura os seus.'],
  ['Modelos treinados com contratações passadas', 'E a personalização por recrutador.'],
  ['Momento da candidatura e concorrência', 'Na Gupy, quem conclui etapas antes sobe na lista.'],
  ['Rede de contatos', 'Indicação, probabilidade de resposta e Open to Work.'],
  ['Sua posição entre os candidatos', 'O app vê só o seu CV.'],
  ['A decisão humana', 'Quem decide é uma pessoa.'],
];

export function NotEvaluable({ comportamentais }: { comportamentais: string[] }) {
  return (
    <section className="card flat" aria-labelledby="nao-aval">
      <h2 className="h3" id="nao-aval">O que não dá para avaliar aqui</h2>
      {comportamentais.length > 0 && (
        <>
          <p className="sm muted espaco">Requisitos comportamentais da vaga. Não dá para comprovar pelo CV, então ficam fora da faixa:</p>
          <ul className="lista sm">{comportamentais.map((c) => <li key={c}>{c}</li>)}</ul>
        </>
      )}
      <p className="sm muted espaco">O resultado acima também não cobre:</p>
      <ul className="lista sm">
        {FORA_DO_ALCANCE.map(([t, d]) => <li key={t}><span className="lbl">{t}.</span> {d}</li>)}
      </ul>
    </section>
  );
}
