package br.com.atscv.calibracao;

import br.com.atscv.api.Dtos.Pergunta;
import br.com.atscv.servico.CandidaturaServico;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Um caso de calibração no formato de pasta: {@code AAAA-MM-plataforma-empresa-cargo/} com vaga.txt, cv.pdf e
 * meta.json (ver docs/como-documentar-candidaturas.md). É o que a importação lê para o banco.
 *
 * @param erros impedem o caso de ser importado
 * @param avisos não impedem, mas valem uma olhada
 */
public record CasoDePasta(
        String nome, Path pasta, Integer ano, Integer mes, Integer dia, String plataforma, String empresa, String cargo,
        String resultado, String observacoes, String etapa, Integer diasAteResposta, List<Pergunta> perguntas,
        List<String> erros, List<String> avisos) {

    /** Texto do vaga.txt do modelo: se continuar lá, o caso não foi preenchido. */
    private static final String VAGA_DO_MODELO = "Cole aqui o texto completo da vaga";
    private static final Pattern NOME = Pattern.compile("^(\\d{4})-(\\d{2})-([a-z]+)-([a-z0-9]+)(?:-([a-z0-9-]+))?$");
    /** Valor que ficou do modelo ("AAAA-MM-DD", "2026-07-DD"): é o mesmo que não informar. */
    private static final Pattern ESPACO_RESERVADO = Pattern.compile("AAAA|MM|DD");
    private static final Pattern DATA = Pattern.compile("^(\\d{4})-(\\d{2})-(\\d{2})$");

    /** "AAAA-MM", o mês do nome da pasta. */
    public String mesTexto() {
        return String.format("%04d-%02d", ano, mes);
    }

    /** "AAAA-MM-DD", só quando o meta.json traz o dia. */
    public String dataTexto() {
        return dia == null ? null : String.format("%04d-%02d-%02d", ano, mes, dia);
    }

    /** O que o nome da pasta diz: mês, plataforma, empresa e cargo. */
    public record PeloNome(Integer ano, Integer mes, String plataforma, String empresa, String cargo, List<String> erros) {}

    public static PeloNome lerNome(String nome) {
        Matcher m = NOME.matcher(nome);
        if (!m.find()) {
            return new PeloNome(null, null, null, null, null,
                    List.of("o nome da pasta não segue AAAA-MM-plataforma-empresa-cargo (minúsculas, sem acento nem espaço)"));
        }
        List<String> erros = new ArrayList<>();
        int mes = Integer.parseInt(m.group(2));
        if (mes < 1 || mes > 12) erros.add("mês " + m.group(2) + " inválido no nome da pasta");
        String plataforma = m.group(3);
        if (!CandidaturaServico.PLATAFORMAS.contains(plataforma)) {
            erros.add("plataforma \"" + plataforma + "\" desconhecida no nome da pasta; use "
                    + String.join(", ", CandidaturaServico.PLATAFORMAS));
        }
        return new PeloNome(Integer.parseInt(m.group(1)), mes, plataforma, m.group(4),
                m.group(5) == null ? null : m.group(5).replace('-', ' '), erros);
    }

    /** O que o meta.json diz. Só "resultado" é obrigatório; campos vazios contam como ausentes. */
    public record DoMeta(
            Integer ano, Integer mes, Integer dia, String resultado, String observacoes, String etapa,
            Integer diasAteResposta, List<Pergunta> perguntas, List<String> erros, List<String> avisos) {}

    private static String texto(JsonNode n) {
        if (n == null || !n.isString()) return null;
        String t = n.asString().strip();
        return t.isEmpty() ? null : t;
    }

    public static DoMeta lerMeta(String json) {
        List<String> erros = new ArrayList<>();
        List<String> avisos = new ArrayList<>();
        List<Pergunta> perguntas = new ArrayList<>();
        JsonNode meta;
        try {
            meta = JsonMapper.builder().build().readTree(json);
        } catch (RuntimeException e) {
            erros.add("meta.json não é um JSON válido (" + e.getMessage().lines().findFirst().orElse("") + ")");
            return new DoMeta(null, null, null, null, null, null, null, perguntas, erros, avisos);
        }
        if (meta == null || !meta.isObject()) {
            erros.add("meta.json deve ser um objeto: { \"resultado\": \"…\" }");
            return new DoMeta(null, null, null, null, null, null, null, perguntas, erros, avisos);
        }
        String resultado = texto(meta.get("resultado"));
        String resultadoValido = null;
        if (resultado == null) {
            erros.add("falta \"resultado\" no meta.json (" + String.join(", ", CandidaturaServico.RESULTADOS) + ")");
        } else if (!CandidaturaServico.RESULTADOS.contains(resultado)) {
            erros.add("resultado \"" + resultado + "\" inválido; use " + String.join(", ", CandidaturaServico.RESULTADOS));
        } else {
            resultadoValido = resultado;
        }

        Integer ano = null;
        Integer mes = null;
        Integer dia = null;
        String data = texto(meta.get("data"));
        if (data != null && !ESPACO_RESERVADO.matcher(data).find()) {
            Matcher d = DATA.matcher(data);
            if (d.find()) {
                ano = Integer.parseInt(d.group(1));
                mes = Integer.parseInt(d.group(2));
                dia = Integer.parseInt(d.group(3));
            } else {
                avisos.add("data \"" + data + "\" ignorada: use AAAA-MM-DD ou deixe em branco");
            }
        }

        Integer dias = null;
        JsonNode d = meta.get("dias_ate_resposta");
        if (d != null && d.isNumber() && d.doubleValue() >= 0) {
            dias = d.intValue();
        } else if (d != null && !d.isNull() && !(d.isString() && d.asString().isEmpty())) {
            avisos.add("dias_ate_resposta ignorado: use um número (0 = no mesmo dia)");
        }

        JsonNode ps = meta.get("perguntas");
        if (ps != null && ps.isArray()) {
            for (JsonNode p : ps) {
                String pergunta = texto(p.get("pergunta"));
                if (pergunta != null) {
                    String resposta = texto(p.get("resposta"));
                    perguntas.add(new Pergunta(pergunta, resposta == null ? "" : resposta));
                }
            }
        }
        return new DoMeta(ano, mes, dia, resultadoValido, texto(meta.get("observacoes")), texto(meta.get("etapa")), dias,
                perguntas, erros, avisos);
    }

    public static CasoDePasta lerCaso(Path pasta) throws IOException {
        String nome = pasta.getFileName().toString();
        PeloNome pelo = lerNome(nome);
        List<String> erros = new ArrayList<>(pelo.erros());
        List<String> avisos = new ArrayList<>();
        Integer dia = null;
        String resultado = null;
        String observacoes = null;
        String etapa = null;
        Integer dias = null;
        List<Pergunta> perguntas = List.of();

        Path metaArquivo = pasta.resolve("meta.json");
        if (!Files.exists(metaArquivo)) {
            erros.add("falta meta.json");
        } else {
            DoMeta meta = lerMeta(Files.readString(metaArquivo));
            erros.addAll(meta.erros());
            avisos.addAll(meta.avisos());
            if (meta.dia() != null && (!meta.ano().equals(pelo.ano()) || !meta.mes().equals(pelo.mes()))) {
                avisos.add("a data do meta.json não bate com o mês do nome da pasta; vale o nome da pasta");
            } else if (meta.dia() != null) {
                dia = meta.dia();
            }
            resultado = meta.resultado();
            observacoes = meta.observacoes();
            etapa = meta.etapa();
            dias = meta.diasAteResposta();
            perguntas = meta.perguntas();
        }
        Path vagaArquivo = pasta.resolve("vaga.txt");
        if (!Files.exists(vagaArquivo)) {
            erros.add("falta vaga.txt");
        } else {
            String vaga = Files.readString(vagaArquivo);
            if (vaga.isBlank()) erros.add("vaga.txt está vazio");
            else if (vaga.contains(VAGA_DO_MODELO)) erros.add("vaga.txt ainda tem o texto do modelo");
        }
        if (!Files.exists(pasta.resolve("cv.pdf"))) erros.add("falta cv.pdf");
        return new CasoDePasta(nome, pasta, pelo.ano(), pelo.mes(), dia, pelo.plataforma(), pelo.empresa(), pelo.cargo(),
                resultado, observacoes, etapa, dias, perguntas, erros, avisos);
    }

    /** Cada subpasta é um caso; as que começam com "_" (o modelo e cópias dele) ficam de fora. */
    public static List<CasoDePasta> listarCasos(Path raiz) throws IOException {
        if (!Files.isDirectory(raiz)) return List.of();
        List<Path> pastas;
        try (Stream<Path> s = Files.list(raiz)) {
            pastas = s.filter(Files::isDirectory).filter(p -> !p.getFileName().toString().startsWith("_"))
                    .sorted(Comparator.comparing(p -> p.getFileName().toString())).toList();
        }
        List<CasoDePasta> casos = new ArrayList<>();
        for (Path p : pastas) casos.add(lerCaso(p));
        return casos;
    }
}
