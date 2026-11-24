package br.com.atscv.formato;

import static br.com.atscv.comum.Js.NS;
import static br.com.atscv.comum.Js.S;
import static br.com.atscv.comum.Js.rei;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Dados de contato que o ATS consegue ler no texto do CV. */
public final class Contact {
    private Contact() {}

    public enum Linkedin { OK, BROKEN, MISSING }

    public record ContactInfo(boolean email, boolean phone, Linkedin linkedin, boolean github, boolean location) {}

    private static final String UFS = "AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO";

    private static final Pattern EMAIL = Pattern.compile("[\\w.+-]+@[\\w-]+\\.[\\w.-]+");
    private static final Pattern PHONE = Pattern.compile(
            "(\\+?55" + S + "?)?\\(?\\d{2}\\)?[" + br.com.atscv.comum.Js.WS_CLASS + ".-]?9?\\d{4}["
                    + br.com.atscv.comum.Js.WS_CLASS + ".-]?\\d{4}");
    private static final Pattern GITHUB = rei("github\\.com/[\\w-]+");
    private static final Pattern LOCATION =
            Pattern.compile("[A-Za-zÀ-ú ]{3,}" + S + "*[-,/–]" + S + "*(" + UFS + ")\\b");
    private static final Pattern LINKEDIN = rei("linkedin\\.com/in/(" + NS + "*)(" + S + "+(" + NS + "+))?");
    private static final Pattern FIM_EM_HIFEN = Pattern.compile("[-/]\\z");
    private static final Pattern RESTO_DE_SLUG = rei("^[a-z0-9][\\w-]*/?\\z");

    public static ContactInfo detectContact(String text) {
        String flat = text.replace("\n", " ");
        boolean email = EMAIL.matcher(flat).find();
        boolean phone = PHONE.matcher(flat).find();
        boolean github = GITHUB.matcher(flat).find();
        boolean location = LOCATION.matcher(flat).find();

        Linkedin linkedin = Linkedin.MISSING;
        Matcher m = LINKEDIN.matcher(flat);
        if (m.find()) {
            String slug = m.group(1);
            String next = m.group(3) == null ? "" : m.group(3);
            // URL partida: termina em hífen/barra, ou a continuação parece resto de slug.
            boolean brokenEnd = FIM_EM_HIFEN.matcher(slug).find();
            boolean continues = slug.length() < 14 && RESTO_DE_SLUG.matcher(next).find() && next.contains("-");
            linkedin = brokenEnd || continues ? Linkedin.BROKEN : Linkedin.OK;
        }
        return new ContactInfo(email, phone, linkedin, github, location);
    }
}
