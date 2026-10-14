import type { NivelFormacao, NivelIdioma } from '../types';

// Todos os padrões rodam sobre texto com fold (minúsculas, sem acento).

/** "stack" é a lista de tecnologias: contexto quando a vaga tem requisitos; sem eles, vale como requisito. */
export type TipoSecao = 'obrigatorio' | 'desejavel' | 'contexto' | 'stack' | 'ignorada';

/** Títulos de seção da vaga. A ordem importa: "requisitos desejáveis" é desejável. */
export const SECOES: Array<[TipoSecao, RegExp]> = [
  ['desejavel', /\b(diferencia(l|is)|desejave(l|is)|nice to haves?|plus|pluses|bonus( points)?|pontos? extras?|preferenciais|preferred( qualifications)?|(sera|seria|vai ser) (um )?(diferencial|otimo|legal)|(experiencias?|conhecimentos?|requisitos?|qualificac(ao|oes)|habilidades|competencias|tecnologias) desejad[oa]s?)\b|^(certificac(ao|oes)|certificados|certifications)$/],
  ['obrigatorio', /\b(requisitos?|pre ?requisitos?|qualificac(ao|oes)|qualifications?|o que (buscamos|esperamos|procuramos|precisamos)|o que voce (precisa|deve) ter|voce (precisa|deve) ter|(tem|precisa|deve) que ter|precisamos que voce|must haves?|requirements?|obrigatori(o|a|os|as)|conhecimentos? (necessarios?|tecnicos?|exigidos?|obrigatorios?)|competencias( tecnicas)?|perfil (desejado|tecnico|esperado|procurado)|habilidades( tecnicas)?|hard skills|skills|o que e necessario|we ?re excited about you|what we ?re looking for|about you|who you are|what you bring|you have|minimum qualifications|basic qualifications)\b/],
  ['contexto', /\b(responsabilidades|atribuic(ao|oes)|atividades|funcoes|o que voce (vai|ira) fazer|o que voce fara|desafios|dia a dia|sobre a (vaga|posicao|funcao|oportunidade)|descricao( da vaga)?|your role|the role|about the role|responsibilities|what you ?(will|ll) do|como e trabalhar|(sua )?missao|your mission)\b/],
  ['stack', /\b(tecnologias|ambiente tecnico|tech stack)\b|^(nossa |a |principal )?stack( tecnica| tecnologica)?$/],
  ['ignorada', /\b(beneficios|benefits|perks|o que oferecemos|oferecemos|what we offer|o que voce (vai )?encontra(r|ra)|what (can )?you (can )?expect|como se candidatar|how to apply|sobre (a empresa|nos|o time|a gente|a area|o time)|quem somos|quem e|who is|about us|about [a-z]+|why join|conheca|processo seletivo|etapas( do processo)?|hiring process|remuneracao|salario|local de (trabalho|atuacao)|localizacao|modelo de (trabalho|atuacao)|regime( de contratacao)?|contratacao|informacoes adicionais|diversidade|inclusao|diversity|inclusion|our commitment|equal opportunity|notice to applicants)\b/],
];

/** Marcadores na própria linha. O desejável é testado antes ("não obrigatório" é desejável). */
export const MARCADOR_DESEJAVEL = /\b(desejave(l|is)|diferencia(l|is)|nice[\s-]to[\s-]have|(e|sera|seria) um plus|plus|bonus|preferencialmente|idealmente|nao (e )?obrigatori[oa])\b/;
export const MARCADOR_OBRIGATORIO = /\b(obrigatori(o|a|os|as)|imprescindive(l|is)|indispensave(l|is)|essencia(l|is)|mandatori[oa]s?|exigid[oa]s?|must[\s-]have|required)\b/;

/** Vaga sem seções (Q17): linhas com estes termos viram sugestão de obrigatório. */
export const HEURISTICA_OBRIGATORIO = /\b(experiencia (com|em|solida|comprovada|previa|pratica|profissional)|dominio (de|em|do|da|dos|das)|solid[oa]s? conhecimentos?|conhecimentos? solid[oa]s?|proficiencia|vivencia (com|em|pratica)|atuacao (com|em)|\d{1,2}\s*\+?\s*anos?)\b/;

/** Requisitos comportamentais: não dá para comprovar pelo CV. */
export const SOFT_SKILLS = /\b(comunicac(ao|oes)|comunicativ[oa]|trabalh(o|ar) em equipe|colaboracao|colaborativ[oa]|proatividade|proativ[oa]|lideranca|resolucao de problemas|pensamento (critico|analitico|logico)|perfil analitico|organizacao|organizad[oa]|autonomia|autonom[oa]|comprometimento|comprometid[oa]|vontade de aprender|curiosidade|curios[oa]|criatividade|criativ[oa]|flexibilidade|adaptabilidade|adaptavel|empatia|didatica|senso de (dono|urgencia)|foco (em|no) (resultados?|cliente)|orientad[oa] a resultados?|relacionamento interpessoal|inteligencia emocional|resiliencia|resiliente|boa escrita|escuta ativa|negociacao|gestao do tempo|team player|ownership|communication skills|problem solving|dinamismo|dinamic[oa]|atencao aos? detalhes|aprendizado continuo|gostar de desafios|leadership|mentorship|mentoria|teamwork|autonomy|curiosity|inovacao|melhoria continua|receber orientac(ao|oes)|aprender com o time|evoluir tecnicamente|interesse em aprender|capacidade de aprendizado|situacoes adversas)\b/;

/** Linha que tem cara de requisito mesmo sem nada reconhecível ("Noção de boas práticas…"). */
export const PARECE_REQUISITO = /\b(conhecimentos?|experiencias?|vivencias?|familiaridade|nocao|nocoes|dominio|capacidade|habilidades?|formacao|graduacao|cursos?|certificac(ao|oes)|certificad[oa]|saber|possuir|disponibilidade|interesse|entendimento|compreensao|knowledge|experience|familiar(ity)?|proficien(t|cy)|ability|understanding|exposure|background)\b/;

/** Linhas sobre modelo de trabalho, contratação e benefícios: não são requisitos técnicos. */
export const IGNORAR_LINHA = /(\b(modelo (de trabalho )?(hibrido|remoto|presencial)|trabalho (hibrido|remoto|presencial)|100% (remoto|presencial)|home[\s-]?office|regime (clt|pj)|contratacao (clt|pj)|clt|pj|salario|remuneracao|faixa salarial|beneficios?|vale[\s-](refeicao|alimentacao|transporte)|vr|va|plano de saude|plano odontologico|gympass|wellhub|plr|ppr|participacao nos lucros|horario|jornada|day off|auxilio|seguro de vida)\b|^(local|localizacao|cidade|remoto|hibrido|presencial)\b)/;

/** Anos de experiência: "3+ anos", "mais de 2 anos", "2 a 4 anos", "5 years". */
export const ANOS = /(?:\+\s*)?(\d{1,2})\s*\+?\s*(?:(?:a|-|ate)\s*\d{1,2}\s*)?(?:anos?|years?)\b/;

export const IDIOMAS: Array<[string, RegExp]> = [
  ['Inglês', /\b(ingles|english)\b/],
  ['Espanhol', /\b(espanhol|spanish)\b/],
  ['Francês', /\b(frances|french)\b/],
  ['Alemão', /\b(alemao|german)\b/],
  ['Italiano', /\b(italiano|italian)\b/],
  ['Mandarim', /\b(mandarim|mandarin|chines)\b/],
  ['Japonês', /\b(japones|japanese)\b/],
  ['Português', /\b(portugues|portuguese)\b/],
];

/** Do mais baixo ao mais alto (seção 11, item 9 do plano). */
export const ORDEM_IDIOMA: NivelIdioma[] = ['basico', 'intermediario', 'avancado', 'fluente', 'nativo'];
export const ROTULO_IDIOMA: Record<NivelIdioma, string> = {
  basico: 'básico', intermediario: 'intermediário', avancado: 'avançado', fluente: 'fluente', nativo: 'nativo',
};

/** Níveis de idioma, do mais alto ao mais baixo (seção 11 do plano). */
export const NIVEIS_IDIOMA: Array<[NivelIdioma, RegExp]> = [
  ['nativo', /\b(nativo|native|bilingue|bilingual)\b/],
  ['fluente', /\b(fluente|fluencia|fluent|fluency|c1|c2|full professional)\b/],
  ['avancado', /\b(avancado|advanced|b2|professional working)\b/],
  ['intermediario', /\b(intermediario|intermediate|b1|conversacao|conversacional|tecnico|leitura|limited working)\b/],
  ['basico', /\b(basico|basic|a1|a2|elementary)\b/],
];

/** Níveis de formação, do mais alto ao mais baixo. */
export const NIVEIS_FORMACAO: Array<[NivelFormacao, RegExp]> = [
  ['doutorado', /\b(doutorado|phd|doctorate)\b/],
  ['mestrado', /\b(mestrado|master'?s degree|msc)\b/],
  ['pos', /\b(pos[\s-]?graduacao|pos[\s-]?graduad[oa]|especializacao|mba)\b/],
  ['graduacao', /\b(ensino superior|nivel superior|curso superior|superior (completo|incompleto|em andamento|cursando)|graduacao|graduad[oa]|bacharel(ado)?|licenciatura|tecnologo|formacao (superior|academica|completa|concluida|em andamento)|faculdade|bachelor'?s?|degree)\b/],
  ['tecnico', /\b(curso tecnico|tecnico em|ensino tecnico|formacao tecnica)\b/],
  ['medio', /\b(ensino medio)\b/],
];

export const ORDEM_FORMACAO: NivelFormacao[] = ['medio', 'tecnico', 'graduacao', 'pos', 'mestrado', 'doutorado'];
export const ROTULO_FORMACAO: Record<NivelFormacao, string> = {
  medio: 'Ensino médio', tecnico: 'Técnico', graduacao: 'Ensino superior', pos: 'Pós-graduação', mestrado: 'Mestrado',
  doutorado: 'Doutorado',
};

/** Cursos de TI no CV (seção 11, item 10 do plano). Mais estrito que AREA_TI, que lê a vaga. */
export const AREA_TI_CURSO = /\b(ciencias? da computacao|ciencia de computacao|engenharia (da|de) computacao|engenharia de software|engenharia informatica|engenharia de dados|sistemas de informacao|analise e desenvolvimento de sistemas|desenvolvimento de (sistemas|software)|ads|redes de computadores|seguranca da informacao|ciberseguranca|ciencia de dados|banco de dados|jogos digitais|informatica|tecnologia da informacao|gestao (da|de) ti|sistemas para internet|computacao|inteligencia artificial|computer science|software engineering|information systems|information technology)\b/;

/** Estágio: período mínimo do curso ou previsão de formatura. */
export const PERIODO_CURSO = /\b(a partir do \d{1,2}\s*(o|º|°)?\s*(semestre|periodo|ano)|\d{1,2}\s*(o|º|°)?\s*(semestre|periodo) (em diante|ou superior)|previsao de (formatura|conclusao)|formatura prevista|conclusao prevista)\b/;

export const ACEITA_CURSANDO = /\b(cursando|em andamento|incompleto|em curso|matriculad[oa]|ultimos? (anos?|semestres?))\b/;
export const AREA_TI = /\b(ti|tecnologia( da informacao)?|computacao|informatica|sistemas( de informacao)?|software|ciencia de dados|analise e desenvolvimento|ads|engenharia|exatas|areas? (afins|correlatas|relacionadas|similares))\b/;

/** "experiência como desenvolvedor backend": exige a família de cargo. */
export const COMO_CARGO = /\bcomo\s+(?:pessoa\s+)?(desenvolvedor(a)?|engenheir[oa]|analista|programador(a)?|qa|tester|cientista|arquitet[oa]|tech lead|lider tecnic[oa]|product (owner|manager)|devops|sre)\b[^,.;]*/;

/** Palavras com maiúscula que não são termo técnico desconhecido. */
export const PALAVRAS_GENERICAS = new Set([
  'experiencia', 'experiencias', 'conhecimento', 'conhecimentos', 'nocao', 'nocoes', 'vivencia', 'dominio',
  'familiaridade', 'boas', 'praticas', 'pratica', 'desenvolvimento', 'sistemas', 'sistema', 'aplicacoes', 'aplicacao',
  'projetos', 'projeto', 'ferramentas', 'ferramenta', 'tecnologias', 'tecnologia', 'linguagens', 'linguagem',
  'frameworks', 'framework', 'bibliotecas', 'banco', 'bancos', 'dados', 'metodologias', 'metodologia', 'ambiente',
  'ambientes', 'time', 'times', 'equipe', 'equipes', 'clientes', 'cliente', 'negocio', 'negocios', 'solucoes', 'solucao',
  'plataformas', 'plataforma', 'produto', 'produtos', 'software', 'codigo', 'qualidade', 'arquitetura',
  'infraestrutura', 'servicos', 'servico', 'integracao', 'integracoes', 'processos', 'processo', 'ti', 'it', 'api',
  'apis', 'web', 'mobile', 'backend', 'frontend', 'fullstack', 'back-end', 'front-end', 'full-stack', 'similares', 'afins',
  'pj', 'clt', 'pcd', 'remoto', 'hibrido', 'presencial',
  'vaga', 'empresa', 'area', 'areas', 'nivel', 'superior', 'completo', 'cursando', 'graduacao', 'ensino', 'ingles',
  'espanhol', 'portugues', 'avancado', 'intermediario', 'basico', 'fluente', 'junior', 'pleno', 'senior', 'estagio',
  'estagiario', 'trainee', 'ciencia', 'ciencias', 'computacao', 'engenharia', 'informacao', 'analise', 'informatica',
  'bacharelado', 'tecnologo', 'brasil', 'kpi', 'kpis', 'okr', 'okrs', 'sla', 'slas', 'b2b', 'b2c', 'saas', 'mvp', 'poc',
  'rh', 'ceo', 'cto', 'po', 'pm', 'qa', 'ux', 'ui', 'etc', 'cnh', 'lgbtqia', 'lgbtqia+',
  'plus', 'bonus', 'desejavel', 'desejaveis', 'diferencial', 'diferenciais', 'obrigatorio', 'obrigatorios',
  'desenvolvedor', 'desenvolvedora', 'desenvolvedores', 'pessoa', 'pessoas', 'profissional', 'oportunidade',
  'candidato', 'candidata', 'incidentes', 'administracao', 'economia', 'contabilidade', 'matematica', 'fisica',
  'design', 'certified', 'developer', 'associate', 'engineer', 'architect', 'foundation', 'practitioner',
  'specialist', 'microsoft', 'amazon', 'brazil', 'nyc', 'us', 'ii', 'iii', 'english', 'portuguese', 'spanish',
  'sao', 'paulo', 'rio', 'janeiro',
  'belo', 'horizonte', 'curitiba', 'porto', 'alegre', 'recife', 'fortaleza', 'salvador', 'brasilia', 'campinas',
  'florianopolis', 'goiania', 'manaus', 'belem', 'vitoria', 'natal', 'joao', 'pessoa', 'maceio', 'aracaju', 'teresina',
  'luis', 'cuiaba', 'campo', 'grande', 'osasco', 'barueri', 'santo', 'andre', 'bernardo', 'guarulhos', 'sorocaba',
  'ribeirao', 'preto', 'jose', 'campos', 'joinville', 'blumenau', 'londrina', 'maringa', 'uberlandia', 'niteroi',
  'sp', 'rj', 'mg', 'pr', 'rs', 'sc', 'ba', 'pe', 'ce', 'df', 'go', 'es', 'am', 'pa',
]);

// ---------- Eliminatórias e vagas afirmativas (4.8 do plano) ----------

/** Morar na cidade ou se mudar. */
export const RESIDENCIA = /\b(residir|resida|reside|residente|morar (em|na|no|perto)|disponibilidade (para|de) mudanca|mudanca de cidade|relocation|relocate)\b/;

/** Disponibilidade que costuma virar pergunta de triagem. */
export const DISPONIBILIDADE: Array<[string, RegExp]> = [
  ['Disponibilidade para viagens', /\b(viagens?|viajar|travel(ing|ling)?)\b/],
  ['Plantão ou sobreaviso', /\b(plantao|plantoes|sobreaviso|on-?call)\b/],
  ['Trabalho em fins de semana, feriados ou turnos', /\b(finais de semana|fins de semana|feriados|turnos?|escalas? de trabalho|horario noturno)\b/],
  ['Início imediato', /\b(inicio imediato|disponibilidade imediata|imediata disponibilidade)\b/],
];
/** A linha fala da disponibilidade do candidato (e não de uma viagem como benefício). */
export const CONTEXTO_DISPONIBILIDADE = /\b(disponibilidade|disponivel|availability|available|willing(ness)?|necessari[oa]|requer|exige|precisa)\b|^(inicio imediato|disponibilidade imediata)/;

/** Documentos e habilitações. */
export const DOCUMENTO: Array<[string, RegExp]> = [
  ['CNH', /\b(cnh|carteira (nacional )?de habilitacao|habilitacao (categoria|tipo) [a-e]|driver.?s license)\b/],
  ['Veículo próprio', /\b(veiculo proprio|carro proprio|moto propria|own (car|vehicle))\b/],
  ['Autorização de trabalho ou visto', /\b(autorizacao (de|para) trabalh\w*|work authorization|authorized to work|right to work|visto de trabalho|visa sponsorship|sponsorship)\b/],
  ['Passaporte', /\b(passaporte|passport)\b/],
];

/** Certificação citada num requisito obrigatório. */
export const CERTIFICACAO = /\b(certificac(ao|oes)|certificad[oa]s?|certification|certifications|certified)\b/;

/** Vaga exclusiva ou preferencial para um grupo. "Vaga também para PcD" não é afirmativa. */
export const AFIRMATIVA = /\b(vagas? (exclusivas?|afirmativas?)|exclusiv[ao]s? para|exclusivamente para|preferencialmente para pessoas|dedicated to (professionals|people|candidates)|exclusively for|affirmative)\b/;
export const GRUPO_AFIRMATIVO = /\b(pcd|pessoas? com deficiencia|deficiencia|disabilit(y|ies)|negr[ao]s|pret[ao]s|pard[ao]s|indigenas?|mulher(es)?|women|lgbt\w*|trans|maturidade|refugiad[ao]s?)\b|50\+/;

// ---------- Idioma em que um texto foi escrito ----------

export const PALAVRAS_PT = new Set(['de', 'da', 'do', 'das', 'dos', 'para', 'com', 'em', 'na', 'nos', 'nas', 'que', 'uma', 'um',
  'os', 'ao', 'nao', 'voce', 'nosso', 'nossa', 'experiencia', 'conhecimento', 'desenvolvimento', 'pelo', 'pela', 'sobre', 'como']);
export const PALAVRAS_EN = new Set(['the', 'and', 'of', 'to', 'with', 'for', 'you', 'we', 'our', 'your', 'is', 'are', 'will', 'be',
  'an', 'experience', 'knowledge', 'development', 'this', 'that', 'from', 'have', 'about']);

/**
 * Item que descreve atividade ("Desenvolver e manter…", "Participar de…"): mesmo listado em
 * Requisitos, vira informativo. Verbos de requisito (ter, possuir, saber, conhecer) ficam de fora.
 */
export const VERBO_ATIVIDADE = /^(desenvolver|implementar|atuar|trabalhar|participar|contribuir|apoiar|criar|manter|garantir|realizar|colaborar|elaborar|executar|construir|projetar|auxiliar|acompanhar|analisar|documentar|integrar|sustentar|evoluir|prestar|monitorar|identificar|propor|definir|conduzir|gerenciar|liderar|apresentar|interagir|atender|testar|codificar|programar|revisar|otimizar|automatizar|investigar|resolver|mapear|levantar|especificar|treinar|orientar|planejar|entregar|desenhar|modelar|configurar|administrar|operar|escrever|sugerir|aplicar|formatar)\b/;
