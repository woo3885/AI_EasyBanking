package com.ddd.backend.ai.engine;

import com.ddd.backend.ai.AiDecisionClientException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.http.HttpClient;
import java.net.URI;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Objects;

@Component
@ConditionalOnProperty(
        prefix = "ddd.ai.engine",
        name = "enabled",
        havingValue = "true",
        matchIfMissing = true
)
public final class JavaHttpAiEngineTransport
        implements AiEngineHttpTransport {

    private final AiEngineProperties properties;

    private final HttpClient httpClient;

    public JavaHttpAiEngineTransport(
            AiEngineProperties properties
    ) {
        this.properties =
                Objects.requireNonNull(
                        properties,
                        "AiEngineProperties는 필수입니다."
                );

        properties.validate();

        this.httpClient =
                HttpClient
                        .newBuilder()
                        .connectTimeout(
                                properties.getConnectTimeout()
                        )
                        .build();
    }

    @Override
    public String post(
            String requestBody
    ) {
        return post(properties.endpointUri(), requestBody);
    }

    @Override
    public String post(URI endpoint, String requestBody) {

        if (requestBody == null
                || requestBody.isBlank()) {

            throw new IllegalArgumentException(
                    "AI Engine 요청 Body는 비어 있을 수 없습니다."
            );
        }

        HttpRequest request =
                HttpRequest
                        .newBuilder(
                                endpoint
                        )
                        .timeout(
                                properties.getRequestTimeout()
                        )
                        .header(
                                "Content-Type",
                                "application/json"
                        )
                        .header(
                                "Accept",
                                "application/json"
                        )
                        .POST(
                                HttpRequest
                                        .BodyPublishers
                                        .ofString(
                                                requestBody
                                        )
                        )
                        .build();

        try {

            HttpResponse<String> response =
                    httpClient.send(
                            request,
                            HttpResponse
                                    .BodyHandlers
                                    .ofString()
                    );

            int statusCode =
                    response.statusCode();

            if (statusCode < 200
                    || statusCode >= 300) {

                /*
                 * C AI Engine의 응답 Body는
                 * Sanitized DOM 또는 내부 오류 내용이
                 * 들어 있을 수 있으므로 그대로 노출하지 않는다.
                 */
                throw new AiDecisionClientException(
                        "AI Engine 요청에 실패했습니다. "
                                + "HTTP status="
                                + statusCode
                );
            }

            String responseBody =
                    response.body();

            if (responseBody == null
                    || responseBody.isBlank()) {

                throw new AiDecisionClientException(
                        "AI Engine이 빈 응답을 반환했습니다."
                );
            }

            return responseBody;

        } catch (InterruptedException exception) {

            Thread.currentThread()
                    .interrupt();

            throw new AiDecisionClientException(
                    "AI Engine 요청이 중단되었습니다.",
                    exception
            );

        } catch (IOException exception) {

            throw new AiDecisionClientException(
                    "AI Engine과 통신할 수 없습니다.",
                    exception
            );
        }
    }
}
