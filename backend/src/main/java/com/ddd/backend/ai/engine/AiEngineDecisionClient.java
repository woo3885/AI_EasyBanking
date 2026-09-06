package com.ddd.backend.ai.engine;

import com.ddd.backend.ai.AiDecisionClient;
import com.ddd.backend.ai.AiDecisionClientException;
import com.ddd.backend.ai.AiDecisionRequest;
import com.ddd.backend.ai.AiDecisionResponse;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import java.util.Objects;

@Service
@ConditionalOnProperty(
        prefix = "ddd.ai.engine",
        name = "enabled",
        havingValue = "true",
        matchIfMissing = true
)
public final class AiEngineDecisionClient
        implements AiDecisionClient {

    private final AiEngineHttpTransport transport;

    private final ObjectMapper objectMapper;

    public AiEngineDecisionClient(
            AiEngineHttpTransport transport,
            ObjectMapper objectMapper
    ) {
        this.transport =
                Objects.requireNonNull(
                        transport,
                        "AiEngineHttpTransport는 필수입니다."
                );

        this.objectMapper =
                Objects.requireNonNull(
                        objectMapper,
                        "ObjectMapper는 필수입니다."
                );
    }

    @Override
    public AiDecisionResponse decide(
            AiDecisionRequest request
    ) {

        Objects.requireNonNull(
                request,
                "AiDecisionRequest는 필수입니다."
        );

        try {

            /*
             * B → C 전송 데이터
             *
             * userRequest
             * SanitizedDomSnapshot
             *
             * sessionId / selector / raw DOM은 보내지 않는다.
             */
            String requestBody =
                    objectMapper.writeValueAsString(
                            request
                    );

            String responseBody =
                    transport.post(
                            requestBody
                    );

            return objectMapper.readValue(
                    responseBody,
                    AiDecisionResponse.class
            );

        } catch (AiDecisionClientException exception) {

            throw exception;

        } catch (Exception exception) {

            throw new AiDecisionClientException(
                    "AI Engine 응답 처리에 실패했습니다.",
                    exception
            );
        }
    }
}