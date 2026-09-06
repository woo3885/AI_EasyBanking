package com.ddd.backend.ai.engine;

import com.ddd.backend.ai.AiDecisionRequest;
import com.ddd.backend.ai.AiDecisionResponse;
import com.ddd.backend.automation.BrowserActionType;
import com.ddd.backend.automation.dom.SanitizedDomSnapshot;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class AiEngineLiveSmokeTest {

    @Test
    void realAiEngineHttpRequestTest() {

        /*
         * 일반 clean test에서는
         * 외부 C AI Engine을 호출하지 않는다.
         *
         * 실제 연동 시험을 수행할 때만:
         *
         * AI_ENGINE_LIVE_TEST=true
         *
         * 를 설정한다.
         */
        String liveTest =
                System.getenv(
                        "AI_ENGINE_LIVE_TEST"
                );

        Assumptions.assumeTrue(
                "true".equalsIgnoreCase(
                        liveTest
                ),
                "AI Engine Live Test가 활성화되지 않았습니다."
        );

        AiEngineProperties properties =
                new AiEngineProperties();

        /*
         * 환경변수로 endpoint를 지정할 수 있다.
         *
         * 지정하지 않으면
         * AiEngineProperties의 기본값:
         *
         * http://127.0.0.1:3001/api/ai/action
         *
         * 을 사용한다.
         */
        String endpoint =
                System.getenv(
                        "AI_ENGINE_ENDPOINT"
                );

        if (endpoint != null
                && !endpoint.isBlank()) {

            properties.setEndpoint(
                    endpoint
            );
        }

        properties.validate();

        AiEngineHttpTransport transport =
                new JavaHttpAiEngineTransport(
                        properties
                );

        ObjectMapper objectMapper =
                JsonMapper
                        .builder()
                        .build();

        AiEngineDecisionClient client =
                new AiEngineDecisionClient(
                        transport,
                        objectMapper
                );

        SanitizedDomSnapshot snapshot =
                createSnapshot();

        AiDecisionRequest request =
                new AiDecisionRequest(
                        "생활비 계좌를 선택해줘",
                        snapshot
                );

        /*
         * 실제 호출:
         *
         * B Backend
         *   ↓
         * AiEngineDecisionClient
         *   ↓
         * POST /api/ai/action
         *   ↓
         * C AI Engine
         */
        AiDecisionResponse response =
                client.decide(
                        request
                );

        assertThat(
                response
        ).isNotNull();

        assertThat(
                response.actionType()
        ).isNotNull();

        /*
         * C가 elementId 기반 Action을 반환했다면
         * 반드시 B가 제공한 Snapshot 내부 elementId여야 한다.
         *
         * 최종적인 보안 검증은
         * D19 AiDecisionResponseValidator와
         * ElementRegistry에서 다시 수행한다.
         */
        validateReturnedElementId(
                response,
                snapshot
        );

        System.out.println(
                "AI Engine endpoint = "
                        + properties
                        .endpointUri()
        );

        System.out.println(
                "AI Engine actionType = "
                        + response
                        .actionType()
        );

        System.out.println(
                "AI Engine elementId = "
                        + response
                        .elementId()
        );
    }

    private void validateReturnedElementId(
            AiDecisionResponse response,
            SanitizedDomSnapshot snapshot
    ) {

        BrowserActionType actionType =
                response.actionType();

        boolean elementAction =
                actionType
                        == BrowserActionType.CLICK
                        || actionType
                        == BrowserActionType.TYPE
                        || actionType
                        == BrowserActionType.SELECT;

        if (!elementAction) {
            return;
        }

        assertThat(
                response.elementId()
        )
                .as(
                        "CLICK/TYPE/SELECT Action은 elementId가 필요합니다."
                )
                .isNotBlank();

        Set<String> allowedElementIds =
                snapshot.elements()
                        .stream()
                        .map(
                                SanitizedDomSnapshot
                                        .ElementSnapshot
                                        ::elementId
                        )
                        .collect(
                                java.util.stream
                                        .Collectors
                                        .toSet()
                        );

        assertThat(
                allowedElementIds
        )
                .as(
                        "C AI Engine은 B가 제공하지 않은 elementId를 반환하면 안 됩니다."
                )
                .contains(
                        response.elementId()
                );
    }

    private SanitizedDomSnapshot createSnapshot() {

        SanitizedDomSnapshot.ElementSnapshot
                livingExpenseAccount =
                new SanitizedDomSnapshot
                        .ElementSnapshot(
                        "el-live0001-001",
                        "button",
                        "button",
                        "생활비 계좌",
                        "생활비 계좌 선택",
                        null,
                        null,
                        true,
                        true,
                        new SanitizedDomSnapshot
                                .BoundingBoxSnapshot(
                                100,
                                200,
                                180,
                                48
                        ),
                        SanitizedDomSnapshot
                                .SecurityPolicy
                                .NORMAL
                );

        SanitizedDomSnapshot.ElementSnapshot
                savingsAccount =
                new SanitizedDomSnapshot
                        .ElementSnapshot(
                        "el-live0001-002",
                        "button",
                        "button",
                        "저축 계좌",
                        "저축 계좌 선택",
                        null,
                        null,
                        true,
                        true,
                        new SanitizedDomSnapshot
                                .BoundingBoxSnapshot(
                                100,
                                270,
                                180,
                                48
                        ),
                        SanitizedDomSnapshot
                                .SecurityPolicy
                                .NORMAL
                );

        return new SanitizedDomSnapshot(
                "1.0",
                "snap-live0001",
                new SanitizedDomSnapshot
                        .PageSnapshot(
                        "http://127.0.0.1:5190/transfer/accounts",
                        "계좌 선택"
                ),
                List.of(
                        livingExpenseAccount,
                        savingsAccount
                )
        );
    }
}