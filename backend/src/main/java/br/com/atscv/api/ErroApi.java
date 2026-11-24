package br.com.atscv.api;

import org.springframework.http.HttpStatus;

/** Erro com um status HTTP e uma mensagem em português para quem chamou a API. */
public class ErroApi extends RuntimeException {
    private final HttpStatus status;

    public ErroApi(HttpStatus status, String mensagem) {
        super(mensagem);
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }

    public static ErroApi naoEncontrado(String o_que, long id) {
        return new ErroApi(HttpStatus.NOT_FOUND, o_que + " " + id + " não existe");
    }

    public static ErroApi invalido(String mensagem) {
        return new ErroApi(HttpStatus.BAD_REQUEST, mensagem);
    }
}
