package com.ddd.backend.ai;

import com.ddd.backend.automation.BrowserActionType;
import com.ddd.backend.automation.dom.SanitizedDomSnapshot;
import org.junit.jupiter.api.Test;

import java.lang.reflect.RecordComponent;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AiDecisionClientContractTest {

    @Test
    void AiDecisionClient는_SanitizedSnapshot을_받아_결정을_반환한다() {

        SanitizedDomSnapshot snapshot =
                createSnapshot();

        AiDecisionRequest request =
                new AiDecisionRequest(
                        "다음 단계로 이동해줘",
                        snapshot
                );

        AiDecisionClient client =
                input ->
                        new AiDecisionResponse(
                                BrowserActionType.CLICK,
                                input.snapshot()
                                        .elements()
                                        .get(0)
                                        .elementId(),
                                null,
                                null,
                                null,
                                null
                        );

        AiDecisionResponse response =
                client.decide(
                        request
                );

        assertThat(
                response.actionType()
        ).isEqualTo(
                BrowserActionType.CLICK
        );

        assertThat(
                response.elementId()
        ).isEqualTo(
                "el-a1b2c3d4-001"
        );
    }

    /*
     * D17 핵심 계약.
     *
     * AI는 selector를 반환할 수 없어야 한다.
     */
    @Test
    void AI_Response에는_selector_필드가_존재하지_않는다() {

        List<String> fieldNames =
                Arrays.stream(
                                AiDecisionResponse.class
                                        .getRecordComponents()
                        )
                        .map(
                                RecordComponent::getName
                        )
                        .toList();

        assertThat(
                fieldNames
        )
                .contains(
                        "actionType",
                        "elementId"
                )
                .doesNotContain(
                        "selector"
                );
    }

    /*
     * AI 요청에도 내부 Browser Session 정보나
     * selector를 노출하지 않는다.
     */
    @Test
    void AI_Request에는_sessionId와_selector가_존재하지_않는다() {

        List<String> fieldNames =
                Arrays.stream(
                                AiDecisionRequest.class
                                        .getRecordComponents()
                        )
                        .map(
                                RecordComponent::getName
                        )
                        .toList();

        assertThat(
                fieldNames
        )
                .containsExactly(
                        "userRequest",
                        "snapshot",
                        "userDecision"
                )
                .doesNotContain(
                        "sessionId",
                        "selector"
                );
    }

    @Test
    void AI_Request에는_SanitizedSnapshot이_필수다() {

        assertThatThrownBy(
                () ->
                        new AiDecisionRequest(
                                "다음 단계로 이동",
                                null
                        )
        )
                .isInstanceOf(
                        NullPointerException.class
                );
    }

    @Test
    void AI_Request의_사용자요청은_비어있을_수_없다() {

        assertThatThrownBy(
                () ->
                        new AiDecisionRequest(
                                "   ",
                                createSnapshot()
                        )
        )
                .isInstanceOf(
                        IllegalArgumentException.class
                );
    }

    @Test
    void AI_Response는_elementId를_사용한다() {

        AiDecisionResponse response =
                new AiDecisionResponse(
                        BrowserActionType.SELECT,
                        "  el-a1b2c3d4-003  ",
                        "savings",
                        null,
                        null,
                        null
                );

        assertThat(
                response.elementId()
        ).isEqualTo(
                "el-a1b2c3d4-003"
        );

        assertThat(
                response.actionType()
        ).isEqualTo(
                BrowserActionType.SELECT
        );
    }

    /*
     * D19에서 실제 field 조합 검증을 하기 때문에
     * D17 DTO 자체는 Provider 응답을 있는 그대로
     * 표현할 수 있어야 한다.
     */
    @Test
    void D17에서는_Action별_위험성검증을_아직_수행하지_않는다() {

        AiDecisionResponse response =
                new AiDecisionResponse(
                        BrowserActionType.CLICK,
                        null,
                        null,
                        null,
                        null,
                        null
                );

        assertThat(
                response.actionType()
        ).isEqualTo(
                BrowserActionType.CLICK
        );

        assertThat(
                response.elementId()
        ).isNull();
    }

    private SanitizedDomSnapshot createSnapshot() {

        SanitizedDomSnapshot.ElementSnapshot element =
                new SanitizedDomSnapshot.ElementSnapshot(
                        "el-a1b2c3d4-001",
                        "button",
                        "button",
                        "다음",
                        "다음 단계",
                        null,
                        null,
                        true,
                        true,
                        new SanitizedDomSnapshot
                                .BoundingBoxSnapshot(
                                100,
                                200,
                                120,
                                48
                        ),
                        SanitizedDomSnapshot
                                .SecurityPolicy
                                .NORMAL
                );

        return new SanitizedDomSnapshot(
                "1.0",
                "snap-a1b2c3d4",
                new SanitizedDomSnapshot.PageSnapshot(
                        "http://127.0.0.1:5190/transfer/accounts",
                        "계좌 선택"
                ),
                List.of(
                        element
                )
        );
    }
}
