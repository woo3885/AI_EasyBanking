package com.ddd.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration(proxyBeanMethods = false)
public class RestCorsConfig
        implements WebMvcConfigurer {

    private final RestCorsProperties properties;

    public RestCorsConfig(
            RestCorsProperties properties
    ) {
        this.properties =
                properties;
    }

    @Override
    public void addCorsMappings(
            CorsRegistry registry
    ) {
        String[] allowedOrigins =
                properties.getAllowedOrigins()
                        .toArray(
                                String[]::new
                        );

        registry.addMapping(
                        "/api/**"
                )
                .allowedOrigins(
                        allowedOrigins
                )
                .allowedMethods(
                        "GET",
                        "POST",
                        "OPTIONS"
                )
                .allowedHeaders(
                        "Content-Type",
                        "Accept"
                )
                /*
                 * 현재 D17은 cookie 기반 인증을
                 * 사용하지 않으므로 credentials는
                 * 허용하지 않는다.
                 */
                .allowCredentials(
                        false
                )
                .maxAge(
                        3600
                );
    }
}