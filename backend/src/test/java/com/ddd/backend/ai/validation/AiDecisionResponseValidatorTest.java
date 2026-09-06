package com.ddd.backend.ai.validation;

import com.ddd.backend.ai.AiDecisionResponse;
import com.ddd.backend.automation.BrowserActionType;
import com.ddd.backend.automation.dom.SanitizedDomSnapshot;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AiDecisionResponseValidatorTest {

    private AiDecisionResponseValidator validator;

    @BeforeEach
    void setUp() {

        validator =
                new AiDecisionResponseValidator();
    }

    @Test
    void NORMAL_Element의_CLICK은_허용한다() {

        AiDecisionResponse response =
                response(
                        BrowserActionType.CLICK,
                        "el-test0001-001",
                        null,
                        null,
                        null,
                        null
                );

        AiDecisionResponse validated =
                validator.validate(
                        response,
                        snapshot(
                                policyElement(
                                        SanitizedDomSnapshot
                                                .SecurityPolicy
                                                .NORMAL,
                                        true,
                                        true
                                )
                        )
                );

        assertThat(
                validated
        ).isSameAs(
                response
        );
    }

    @Test
    void Snapshot에_없는_elementId는_거부한다() {

        AiDecisionResponse response =
                response(
                        BrowserActionType.CLICK,
                        "el-fake0001-999",
                        null,
                        null,
                        null,
                        null
                );

        assertValidationCode(
                response,
                snapshot(
                        policyElement(
                                SanitizedDomSnapshot
                                        .SecurityPolicy
                                        .NORMAL,
                                true,
                                true
                        )
                ),
                AiDecisionValidationException
                        .Code
                        .UNKNOWN_ELEMENT_ID
        );
    }

    @Test
    void SECURE_INPUT_Element는_AI_Click을_거부한다() {

        assertPolicyRejected(
                SanitizedDomSnapshot
                        .SecurityPolicy
                        .SECURE_INPUT,
                AiDecisionValidationException
                        .Code
                        .SECURE_INPUT_REQUIRED
        );
    }

    @Test
    void USER_DECISION_Element는_AI_Click을_거부한다() {

        assertPolicyRejected(
                SanitizedDomSnapshot
                        .SecurityPolicy
                        .USER_DECISION,
                AiDecisionValidationException
                        .Code
                        .USER_DECISION_REQUIRED
        );
    }

    @Test
    void FINAL_CONFIRMATION_Element는_AI_Click을_거부한다() {

        assertPolicyRejected(
                SanitizedDomSnapshot
                        .SecurityPolicy
                        .FINAL_CONFIRMATION,
                AiDecisionValidationException
                        .Code
                        .FINAL_CONFIRMATION_REQUIRED
        );
    }

    @Test
    void 최종확인_응답은_type_target_sourceSnapshot을_검증한다() {
        AiDecisionResponse response = new AiDecisionResponse(
                BrowserActionType.REQUEST_FINAL_CONFIRMATION,
                null, null, null, null, null,
                "FINAL_CONFIRMATION_REQUIRED", "확인하세요", true, true,
                null, "snap-test0001", List.of(), List.of(),
                com.ddd.backend.domain.session.ConfirmationType.DEPOSIT_SUBSCRIPTION,
                "el-test0001-001");

        assertThat(validator.validate(response, snapshot(policyElement(
                SanitizedDomSnapshot.SecurityPolicy.FINAL_CONFIRMATION,
                true, true)))).isSameAs(response);
    }

    @Test
    void 최종확인_sourceSnapshot이_다르면_거부한다() {
        AiDecisionResponse response = new AiDecisionResponse(
                BrowserActionType.REQUEST_FINAL_CONFIRMATION,
                null, null, null, null, null,
                "FINAL_CONFIRMATION_REQUIRED", "확인하세요", true, true,
                null, "snap-stale", List.of(), List.of(),
                com.ddd.backend.domain.session.ConfirmationType.DEPOSIT_SUBSCRIPTION,
                "el-test0001-001");

        assertThatThrownBy(() -> validator.validate(response, snapshot(policyElement(
                SanitizedDomSnapshot.SecurityPolicy.FINAL_CONFIRMATION,
                true, true))))
                .isInstanceOf(AiDecisionValidationException.class);
    }

    @Test
    void BLOCKED_Element는_AI_Click을_거부한다() {

        assertPolicyRejected(
                SanitizedDomSnapshot
                        .SecurityPolicy
                        .BLOCKED,
                AiDecisionValidationException
                        .Code
                        .BLOCKED_ELEMENT
        );
    }

    @Test
    void 보이지_않는_Element는_거부한다() {

        AiDecisionResponse response =
                response(
                        BrowserActionType.CLICK,
                        "el-test0001-001",
                        null,
                        null,
                        null,
                        null
                );

        assertValidationCode(
                response,
                snapshot(
                        policyElement(
                                SanitizedDomSnapshot
                                        .SecurityPolicy
                                        .NORMAL,
                                false,
                                true
                        )
                ),
                AiDecisionValidationException
                        .Code
                        .ELEMENT_NOT_INTERACTABLE
        );
    }

    @Test
    void Disabled_Element는_거부한다() {

        AiDecisionResponse response =
                response(
                        BrowserActionType.CLICK,
                        "el-test0001-001",
                        null,
                        null,
                        null,
                        null
                );

        assertValidationCode(
                response,
                snapshot(
                        policyElement(
                                SanitizedDomSnapshot
                                        .SecurityPolicy
                                        .NORMAL,
                                true,
                                false
                        )
                ),
                AiDecisionValidationException
                        .Code
                        .ELEMENT_NOT_INTERACTABLE
        );
    }

    @Test
    void TYPE에는_value가_필요하다() {

        AiDecisionResponse response =
                response(
                        BrowserActionType.TYPE,
                        "el-test0001-001",
                        null,
                        null,
                        null,
                        null
                );

        assertValidationCode(
                response,
                snapshot(
                        policyElement(
                                SanitizedDomSnapshot
                                        .SecurityPolicy
                                        .NORMAL,
                                true,
                                true
                        )
                ),
                AiDecisionValidationException
                        .Code
                        .INVALID_PAYLOAD
        );
    }

    @Test
    void Ctrl_L과_같은_조합키는_거부한다() {

        AiDecisionResponse response =
                response(
                        BrowserActionType.PRESS_KEY,
                        null,
                        "Control+L",
                        null,
                        null,
                        null
                );

        assertValidationCode(
                response,
                emptySnapshot(),
                AiDecisionValidationException
                        .Code
                        .UNSAFE_KEY
        );
    }

    @Test
    void ENTER_Key는_허용한다() {

        AiDecisionResponse response =
                response(
                        BrowserActionType.PRESS_KEY,
                        null,
                        "Enter",
                        null,
                        null,
                        null
                );

        assertThat(
                validator.validate(
                        response,
                        emptySnapshot()
                )
        ).isSameAs(
                response
        );
    }

    @Test
    void WAIT은_10초를_초과할_수_없다() {

        AiDecisionResponse response =
                response(
                        BrowserActionType.WAIT,
                        null,
                        null,
                        null,
                        null,
                        10_001
                );

        assertValidationCode(
                response,
                emptySnapshot(),
                AiDecisionValidationException
                        .Code
                        .INVALID_WAIT
        );
    }

    @Test
    void 이동거리가_0인_SCROLL은_거부한다() {

        AiDecisionResponse response =
                response(
                        BrowserActionType.SCROLL,
                        null,
                        null,
                        0,
                        0,
                        null
                );

        assertValidationCode(
                response,
                emptySnapshot(),
                AiDecisionValidationException
                        .Code
                        .INVALID_SCROLL
        );
    }

    private void assertPolicyRejected(
            SanitizedDomSnapshot.SecurityPolicy policy,
            AiDecisionValidationException.Code expected
    ) {

        AiDecisionResponse response =
                response(
                        BrowserActionType.CLICK,
                        "el-test0001-001",
                        null,
                        null,
                        null,
                        null
                );

        assertValidationCode(
                response,
                snapshot(
                        policyElement(
                                policy,
                                true,
                                true
                        )
                ),
                expected
        );
    }

    private void assertValidationCode(
            AiDecisionResponse response,
            SanitizedDomSnapshot snapshot,
            AiDecisionValidationException.Code expected
    ) {

        assertThatThrownBy(
                () ->
                        validator.validate(
                                response,
                                snapshot
                        )
        )
                .isInstanceOfSatisfying(
                        AiDecisionValidationException.class,
                        exception ->
                                assertThat(
                                        exception.code()
                                ).isEqualTo(
                                        expected
                                )
                );
    }

    @Test
    void rich_Decision의_중복_option_ID를_차단한다() {
        var option = new com.ddd.backend.ai.AiDecisionOption(
                "el-test0001-001", "계좌", false);
        AiDecisionResponse response = new AiDecisionResponse(
                BrowserActionType.WAIT_FOR_USER, null, null, null, null, null,
                "WAIT_FOR_USER", "선택하세요", true, true,
                com.ddd.backend.domain.session.DecisionType.SOURCE_ACCOUNT_SELECTION,
                List.of(option, option), List.of());

        assertThatThrownBy(() -> validator.validate(response, snapshot(
                policyElement(SanitizedDomSnapshot.SecurityPolicy.USER_DECISION,
                        true, true))))
                .isInstanceOf(AiDecisionValidationException.class)
                .extracting(exception -> ((AiDecisionValidationException) exception).code())
                .isEqualTo(AiDecisionValidationException.Code.INVALID_PAYLOAD);
    }

    @Test
    void WAIT_FOR_USER에_decisionType이_누락되면_상품으로_기본_처리하지_않는다() {
        AiDecisionResponse response = new AiDecisionResponse(
                BrowserActionType.WAIT_FOR_USER, null, null, null, null, null);

        assertThatThrownBy(() -> validator.validate(response, emptySnapshot()))
                .isInstanceOf(AiDecisionValidationException.class)
                .extracting(exception -> ((AiDecisionValidationException) exception).code())
                .isEqualTo(AiDecisionValidationException.Code.INVALID_PAYLOAD);
    }

    @Test
    void 구조화_Decision은_지원_유형과_sourceSnapshot을_검증한다() {
        SanitizedDomSnapshot snapshot = snapshot(policyElement(
                SanitizedDomSnapshot.SecurityPolicy.USER_DECISION,
                true, true, false));
        for (var type : List.of(
                com.ddd.backend.domain.session.DecisionType.PRODUCT_SELECTION,
                com.ddd.backend.domain.session.DecisionType.SOURCE_ACCOUNT_SELECTION,
                com.ddd.backend.domain.session.DecisionType.RECIPIENT_SELECTION,
                com.ddd.backend.domain.session.DecisionType.TERMS_AGREEMENT)) {
            var option = new com.ddd.backend.ai.AiDecisionOption(
                    "el-test0001-001", "선택", false,
                    type == com.ddd.backend.domain.session.DecisionType.TERMS_AGREEMENT
                            ? Boolean.FALSE : null);
            AiDecisionResponse response = new AiDecisionResponse(
                    BrowserActionType.WAIT_FOR_USER, null, null, null, null, null,
                    "USER_DECISION_REQUIRED", "선택하세요", true, true,
                    type, snapshot.snapshotId(), List.of(option),
                    type == com.ddd.backend.domain.session.DecisionType.TERMS_AGREEMENT
                            ? List.of(option) : List.of());

            assertThat(validator.validate(response, snapshot)).isSameAs(response);
        }
    }

    @Test
    void sourceSnapshotId가_현재_Snapshot과_다르면_차단한다() {
        var option = new com.ddd.backend.ai.AiDecisionOption(
                "el-test0001-001", "선택", false);
        AiDecisionResponse response = new AiDecisionResponse(
                BrowserActionType.WAIT_FOR_USER, null, null, null, null, null,
                "USER_DECISION_REQUIRED", "선택하세요", true, true,
                com.ddd.backend.domain.session.DecisionType.PRODUCT_SELECTION,
                "snap-stale", List.of(option), List.of());

        assertThatThrownBy(() -> validator.validate(response, snapshot(policyElement(
                SanitizedDomSnapshot.SecurityPolicy.USER_DECISION, true, true))))
                .isInstanceOf(AiDecisionValidationException.class);
    }

    @Test
    void ADDITIONAL_INFORMATION은_D24_구조화_Decision에서_명시적으로_차단한다() {
        var option = new com.ddd.backend.ai.AiDecisionOption(
                "el-test0001-001", "추가 정보", false);
        AiDecisionResponse response = new AiDecisionResponse(
                BrowserActionType.WAIT_FOR_USER, null, null, null, null, null,
                "USER_DECISION_REQUIRED", "정보를 입력하세요", true, true,
                com.ddd.backend.domain.session.DecisionType.ADDITIONAL_INFORMATION,
                "snap-test0001", List.of(option), List.of());

        assertThatThrownBy(() -> validator.validate(response, snapshot(policyElement(
                SanitizedDomSnapshot.SecurityPolicy.USER_DECISION, true, true))))
                .isInstanceOf(AiDecisionValidationException.class)
                .extracting(exception -> ((AiDecisionValidationException) exception).code())
                .isEqualTo(AiDecisionValidationException.Code.INVALID_PAYLOAD);
    }

    private AiDecisionResponse response(
            BrowserActionType actionType,
            String elementId,
            String value,
            Integer scrollX,
            Integer scrollY,
            Integer waitMillis
    ) {

        return new AiDecisionResponse(
                actionType,
                elementId,
                value,
                scrollX,
                scrollY,
                waitMillis
        );
    }

    private SanitizedDomSnapshot.ElementSnapshot
    policyElement(
            SanitizedDomSnapshot.SecurityPolicy policy,
            boolean visible,
            boolean enabled
    ) {
        return policyElement(policy, visible, enabled, null);
    }

    private SanitizedDomSnapshot.ElementSnapshot policyElement(
            SanitizedDomSnapshot.SecurityPolicy policy,
            boolean visible,
            boolean enabled,
            Boolean checked
    ) {

        return new SanitizedDomSnapshot.ElementSnapshot(
                "el-test0001-001",
                "button",
                "button",
                "다음",
                "다음",
                null,
                null,
                visible,
                enabled,
                checked,
                new SanitizedDomSnapshot
                        .BoundingBoxSnapshot(
                        100,
                        200,
                        120,
                        48
                ),
                policy
        );
    }

    private SanitizedDomSnapshot snapshot(
            SanitizedDomSnapshot.ElementSnapshot element
    ) {

        return new SanitizedDomSnapshot(
                "1.0",
                "snap-test0001",
                new SanitizedDomSnapshot
                        .PageSnapshot(
                        "http://127.0.0.1:5190/",
                        "테스트"
                ),
                List.of(
                        element
                )
        );
    }

    private SanitizedDomSnapshot emptySnapshot() {

        return new SanitizedDomSnapshot(
                "1.0",
                "snap-test0001",
                new SanitizedDomSnapshot
                        .PageSnapshot(
                        "http://127.0.0.1:5190/",
                        "테스트"
                ),
                List.of()
        );
    }
}
