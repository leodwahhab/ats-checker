package br.com.atscv.api;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class Configuracao {

    /** O relógio da aplicação; os testes trocam por um fixo. */
    @Bean
    Clock relogio() {
        return Clock.systemDefaultZone();
    }
}
