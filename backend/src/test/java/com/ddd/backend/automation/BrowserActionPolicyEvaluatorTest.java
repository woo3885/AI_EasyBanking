package com.ddd.backend.automation;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class BrowserActionPolicyEvaluatorTest {

    private final BrowserActionPolicyEvaluator evaluator =
            new BrowserActionPolicyEvaluator();

    @Test
    void 일반적인_클릭은_자동실행을_허용한다() {
        BrowserAction action = new BrowserAction(
                BrowserActionType.CLICK,
                "#btn-search",
                null,
                null,
                null,
                null
        );

        BrowserActionPolicyResult result =
                evaluator.evaluate(
                        action,
                        BrowserActionPolicyContext.normal()
                );

        assertEquals(
                BrowserActionPolicyDecision.ALLOW,
                result.decision()
        );
    }

    @Test
    void 민감정보_입력은_자동실행하지_않는다() {
        BrowserAction action = new BrowserAction(
                BrowserActionType.TYPE,
                "#input-password",
                "password",
                null,
                null,
                null
        );

        BrowserActionPolicyResult result =
                evaluator.evaluate(
                        action,
                        BrowserActionPolicyContext.forSensitiveInput()
                );

        assertEquals(
                BrowserActionPolicyDecision.SECURE_INPUT_REQUIRED,
                result.decision()
        );
    }

    @Test
    void 상품이나_계좌_선택은_사용자에게_맡긴다() {
        BrowserAction action = new BrowserAction(
                BrowserActionType.CLICK,
                "#btn-select-account",
                null,
                null,
                null,
                null
        );

        BrowserActionPolicyResult result =
                evaluator.evaluate(
                        action,
                        BrowserActionPolicyContext.forUserChoice()
                );

        assertEquals(
                BrowserActionPolicyDecision.USER_ACTION_REQUIRED,
                result.decision()
        );
    }

    @Test
    void 선택적_약관이나_마케팅_동의는_사용자에게_맡긴다() {
        BrowserAction action = new BrowserAction(
                BrowserActionType.CLICK,
                "#checkbox-marketing",
                null,
                null,
                null,
                null
        );

        BrowserActionPolicyResult result =
                evaluator.evaluate(
                        action,
                        BrowserActionPolicyContext.forOptionalConsent()
                );

        assertEquals(
                BrowserActionPolicyDecision.USER_ACTION_REQUIRED,
                result.decision()
        );
    }

    @Test
    void 최종_가입이나_송금은_사용자_확인이_필요하다() {
        BrowserAction action = new BrowserAction(
                BrowserActionType.CLICK,
                "#btn-transfer-final",
                null,
                null,
                null,
                null
        );

        BrowserActionPolicyResult result =
                evaluator.evaluate(
                        action,
                        BrowserActionPolicyContext.forFinalExecution()
                );

        assertEquals(
                BrowserActionPolicyDecision.FINAL_CONFIRMATION_REQUIRED,
                result.decision()
        );
    }

    @Test
    void 차단된_대상은_실행하지_않는다() {
        BrowserAction action = new BrowserAction(
                BrowserActionType.CLICK,
                "#blocked-target",
                null,
                null,
                null,
                null
        );

        BrowserActionPolicyResult result =
                evaluator.evaluate(
                        action,
                        BrowserActionPolicyContext.forBlockedTarget()
                );

        assertEquals(
                BrowserActionPolicyDecision.BLOCKED,
                result.decision()
        );
    }

    @Test
    void WAIT_FOR_USER는_일반_상황에서도_사용자_선택을_요청한다() {
        BrowserAction action = new BrowserAction(
                BrowserActionType.WAIT_FOR_USER,
                null,
                null,
                null,
                null,
                null
        );

        BrowserActionPolicyResult result =
                evaluator.evaluate(
                        action,
                        BrowserActionPolicyContext.normal()
                );

        assertEquals(
                BrowserActionPolicyDecision.USER_ACTION_REQUIRED,
                result.decision()
        );
    }

    @Test
    void PAUSE_FOR_SECURE_INPUT은_민감정보_직접입력을_요청한다() {
        BrowserAction action = new BrowserAction(
                BrowserActionType.PAUSE_FOR_SECURE_INPUT,
                null,
                null,
                null,
                null,
                null
        );

        BrowserActionPolicyResult result =
                evaluator.evaluate(
                        action,
                        BrowserActionPolicyContext.normal()
                );

        assertEquals(
                BrowserActionPolicyDecision.SECURE_INPUT_REQUIRED,
                result.decision()
        );
    }

    @Test
    void REQUEST_FINAL_CONFIRMATION은_최종확인을_요청한다() {
        BrowserAction action = new BrowserAction(
                BrowserActionType.REQUEST_FINAL_CONFIRMATION,
                null,
                null,
                null,
                null,
                null
        );

        BrowserActionPolicyResult result =
                evaluator.evaluate(
                        action,
                        BrowserActionPolicyContext.normal()
                );

        assertEquals(
                BrowserActionPolicyDecision.FINAL_CONFIRMATION_REQUIRED,
                result.decision()
        );
    }

    @Test
    void STOP은_정책상_차단한다() {
        BrowserAction action = new BrowserAction(
                BrowserActionType.STOP,
                null,
                null,
                null,
                null,
                null
        );

        BrowserActionPolicyResult result =
                evaluator.evaluate(
                        action,
                        BrowserActionPolicyContext.normal()
                );

        assertEquals(
                BrowserActionPolicyDecision.BLOCKED,
                result.decision()
        );
    }

    @Test
    void 여러_위험조건이_겹치면_차단정책을_가장_먼저_적용한다() {
        BrowserAction action = new BrowserAction(
                BrowserActionType.TYPE,
                "#input-sensitive",
                "민감한 값",
                null,
                null,
                null
        );

        BrowserActionPolicyContext context =
                new BrowserActionPolicyContext(
                        true,
                        true,
                        true,
                        true,
                        true
                );

        BrowserActionPolicyResult result =
                evaluator.evaluate(
                        action,
                        context
                );

        assertEquals(
                BrowserActionPolicyDecision.BLOCKED,
                result.decision()
        );
    }
}