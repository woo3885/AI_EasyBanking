package com.ddd.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@ConfigurationProperties(prefix = "ddd.rest-cors")
public class RestCorsProperties {

    /*
     * Frontend 개발 서버 Origin.
     *
     * 기본값은 Frontend 개발 서버와 로컬 Demo Bank만 허용한다.
     */
    private List<String> allowedOrigins =
            List.of(
                    "http://127.0.0.1:5173",
                    "http://127.0.0.1:5190"
            );

    public List<String> getAllowedOrigins() {
        return allowedOrigins;
    }

    public void setAllowedOrigins(
            List<String> allowedOrigins
    ) {
        if (allowedOrigins == null
                || allowedOrigins.isEmpty()) {

            throw new IllegalArgumentException(
                    "REST CORS allowedOrigins는 "
                            + "비어 있을 수 없습니다."
            );
        }

        List<String> normalized =
                allowedOrigins.stream()
                        .map(String::trim)
                        .filter(
                                origin ->
                                        !origin.isBlank()
                        )
                        .toList();

        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(
                    "REST CORS allowedOrigins는 "
                            + "비어 있을 수 없습니다."
            );
        }

        if (normalized.contains("*")) {
            throw new IllegalArgumentException(
                    "REST CORS Origin에 wildcard를 "
                            + "사용할 수 없습니다."
            );
        }

        this.allowedOrigins =
                List.copyOf(
                        normalized
                );
    }
}
