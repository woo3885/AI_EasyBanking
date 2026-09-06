package com.ddd.backend.websocket.frame;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@ConfigurationProperties(prefix = "ddd.frame-websocket")
public class FrameWebSocketProperties {

    /*
     * 개발 Frontend Origin.
     *
     * wildcard "*"는 사용하지 않는다.
     */
    private List<String> allowedOrigins =
            List.of(
                    "http://127.0.0.1:5173"
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
                    "Frame WebSocket allowedOrigins는 "
                            + "비어 있을 수 없습니다."
            );
        }

        List<String> normalized =
                allowedOrigins.stream()
                        .map(String::trim)
                        .filter(
                                value ->
                                        !value.isBlank()
                        )
                        .toList();

        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(
                    "Frame WebSocket allowedOrigins는 "
                            + "비어 있을 수 없습니다."
            );
        }

        if (normalized.contains("*")) {
            throw new IllegalArgumentException(
                    "Frame WebSocket Origin에 "
                            + "wildcard를 사용할 수 없습니다."
            );
        }

        this.allowedOrigins =
                List.copyOf(
                        normalized
                );
    }
}