import { intentClassifier } from "./intents/intent.classifier.js";
import { extractUserGoal } from "./goals/userGoal.extractor.js";
import { mapSanitizedDomToModelInput } from "./dom/domMapper.js";
import { serializeDomModelInput } from "./dom/domSerializer.js";
import type { SanitizedDomSnapshot } from "./dom/types.js";
import { evaluateActionPolicy } from "./policy/actionPolicy.js";
import { detectSensitiveData } from "./policy/safetyPolicy.js";
import { selectNextAction } from "./actions/nextAction.selector.js";
import { createNextActionPrompt } from "./prompts/nextActionPrompt.js";
import {
  mapDecisionToAIResponse,
  stringifyAIResponse,
} from "./output/aiResponse.mapper.js";
import { generateGuidanceMessage } from "./messages/guidanceMessage.generator.js";
import {
  completeCurrentStep,
  completeWorkflowCondition,
  createWorkflowContext,
  serializeWorkflowContext,
  startWorkflowStep,
} from "./workflow/workflowContext.manager.js";
import { detectTerms } from "./terms/termsAgreement.detector.js";
import {
  createTermsAgreementResult,
  stringifyTermsAgreementResult,
} from "./terms/termsAgreement.mapper.js";
import { detectSecureInput } from "./secureInput/secureInput.detector.js";
import {
  createSecureInputResult,
  stringifySecureInputResult,
} from "./secureInput/secureInput.mapper.js";
import { detectFinalAction } from "./finalAction/finalAction.detector.js";
import {
  createFinalConfirmationResult,
  stringifyFinalConfirmationResult,
} from "./finalAction/finalConfirmation.mapper.js";
import { detectRisk } from "./risk/riskDetector.js";
import {
  createRiskWarningResult,
  stringifyRiskWarningResult,
} from "./risk/riskWarning.mapper.js";
import { evaluateConfidence } from "./confidence/confidencePolicy.js";
import {
  createFallbackResult,
  stringifyFallbackResult,
} from "./confidence/fallback.mapper.js";

const TEST_MESSAGES = [
  "금리가 높은 예금 상품을 찾고 싶어요",
  "친구 계좌로 10만 원을 보내고 싶어요",
  "내 계좌 잔액을 확인하고 싶어요",
  "이체 한도를 변경하고 싶어요",
  "모르는 사람이 송금을 요구해서 불안해요",
  "은행 업무를 도와주세요",
] as const;

function main(): void {
  console.log("========================================");
  console.log("금융길잡이 AI Engine - Intent Test");
  console.log("========================================");

  for (const message of TEST_MESSAGES) {
    const result = intentClassifier.classify(message);

    console.log();
    console.log(`[사용자 요청] ${message}`);
    console.log(`[분류 결과] ${result.intent}`);
    console.log(`[신뢰도] ${result.confidence}`);
    console.log(
      `[감지 키워드] ${
        result.matchedKeywords.join(", ") || "없음"
      }`,
    );
    console.log(`[분류 근거] ${result.reason}`);
  }
}

main();

console.log("\n========================================");
console.log("금융길잡이 AI Engine - 행동 정책 테스트");
console.log("========================================");

const actionTestCases = [
  {
    action: "CLICK" as const,
    elementText: "예금 상품 조회",
  },
  {
    action: "CLICK" as const,
    elementText: "예금 상품 가입 신청",
  },
  {
    action: "CLICK" as const,
    elementText: "친구에게 10만 원 이체",
  },
  {
    action: "INPUT" as const,
    elementText: "계좌 비밀번호 입력",
  },
  {
    action: "SCROLL" as const,
    elementText: "아래로 이동",
  },
  {
    action: "CLICK" as const,
    elementText: "확인",
  },
];

for (const testCase of actionTestCases) {
  const result = evaluateActionPolicy(
    testCase.action,
    testCase.elementText,
  );

  console.log(`\n[행동 종류] ${testCase.action}`);
  console.log(`[요소 내용] ${testCase.elementText}`);
  console.log(`[위험 수준] ${result.riskLevel}`);
  console.log(`[자동 실행 가능] ${result.canExecute}`);
  console.log(`[사용자 확인 필요] ${result.requiresConfirmation}`);
  console.log(`[판단 근거] ${result.reason}`);
}

console.log("\n========================================");
console.log("금융길잡이 AI Engine - 민감정보 탐지 테스트");
console.log("========================================");

const sensitiveDataTestCases = [
  "제 전화번호는 010-1234-5678입니다.",
  "카드번호는 1234-5678-9012-3456입니다.",
  "주민등록번호는 990101-1234567입니다.",
  "금리가 높은 예금 상품을 찾고 싶어요.",
];

for (const text of sensitiveDataTestCases) {
  const result = detectSensitiveData(text);

  console.log(`\n[입력 문장] ${text}`);
  console.log(`[민감정보 감지] ${result.detected}`);
  console.log(`[감지 종류] ${result.types.join(", ") || "없음"}`);
  console.log(`[마스킹 결과] ${result.maskedText}`);
}

console.log("\n========================================");
console.log("금융길잡이 AI Engine - UserGoal 추출 테스트");
console.log("========================================");

const userGoalTestCases = [
  "친구 계좌로 10만 원을 보내고 싶어요",
  "민수에게 50,000원 이체해 줘",
  "6개월 동안 금리가 높은 예금 상품을 찾고 싶어요",
  "1년짜리 수수료 없는 예금을 찾고 있어요",
  "이체 한도를 300만 원으로 변경하고 싶어요",
  "10만 원을 보내고 싶어요",
];

for (const text of userGoalTestCases) {
  const goal = extractUserGoal(text);

  console.log(`\n[사용자 요청] ${text}`);
  console.log(`[Intent] ${goal.intent}`);
  console.log(`[신뢰도] ${goal.confidence}`);
  console.log(`[금액] ${goal.amount ?? "없음"}`);
  console.log(`[통화] ${goal.currency ?? "없음"}`);
  console.log(`[수취인] ${goal.recipient ?? "없음"}`);

  console.log(
    `[기간] ${
      goal.duration
        ? `${goal.duration.value} ${goal.duration.unit}`
        : "없음"
    }`,
  );

  console.log(
    `[조건] ${goal.conditions.join(", ") || "없음"}`,
  );

  console.log(
    `[부족한 정보] ${
      goal.missingFields.join(", ") || "없음"
    }`,
  );
}

const sampleDom: SanitizedDomSnapshot = {
  url: "https://example-bank.com/deposit",
  title: "예금 상품 안내",

  elements: [
    {
      id: "el-1",
      tag: "h1",
      text: "예금 상품",
      visible: true,
    },
    {
      id: "el-2",
      tag: "input",
      role: "textbox",
      placeholder: "상품명을 입력하세요",
      editable: true,
      visible: true,
    },
    {
      id: "el-3",
      tag: "button",
      text: "검색",
      role: "button",
      clickable: true,
      visible: true,
    },
    {
      id: "el-4",
      tag: "a",
      text: "정기예금 가입",
      href: "/deposit/apply",
      clickable: true,
      visible: true,
    },
    {
      id: "el-5",
      tag: "button",
      text: "사용할 수 없는 버튼",
      clickable: true,
      disabled: true,
      visible: true,
    },
    {
      id: "el-6",
      tag: "div",
      text: "화면에서 보이지 않는 내용",
      visible: false,
    },
  ],
};

const modelInput =
  mapSanitizedDomToModelInput(sampleDom);

const serializedDom =
  serializeDomModelInput(modelInput);

console.log("\n========================================");
console.log("금융길잡이 AI Engine - DOM Mapping Test");
console.log("========================================\n");

console.log(serializedDom);

console.log("\n========================================");
console.log("금융길잡이 AI Engine - 다음 행동 선택 테스트");
console.log("========================================\n");

const actionGoal = {
  rawMessage: "금리가 높은 예금 상품을 찾고 싶어요",
  intent: "DEPOSIT",
  conditions: ["금리가 높은"],
};

const nextAction = selectNextAction(
  actionGoal,
  modelInput,
);

const requestId = "req-test-001";

const nextActionPrompt = createNextActionPrompt(
  requestId,
  actionGoal,
  modelInput,
);

const selectedElement = modelInput.elements.find(
  (element) =>
    element.id === nextAction.targetId,
);

const guidanceMessage =
  generateGuidanceMessage({
    action: nextAction.action,
    targetLabel: selectedElement?.label,
    inputValue: nextAction.value,
    requiresConfirmation: false,
  });

const aiResponse = mapDecisionToAIResponse(
  nextAction,
  {
    requestId,
    message: guidanceMessage.message,
  },
);

console.log("[사용자 목표]");
console.log(actionGoal.rawMessage);

console.log("\n[선택 결과]");
console.log(`행동: ${nextAction.action}`);
console.log(
  `대상 ID: ${nextAction.targetId ?? "없음"}`,
);
console.log(
  `입력값: ${nextAction.value ?? "없음"}`,
);
console.log(
  `스크롤 방향: ${nextAction.direction ?? "없음"}`,
);
console.log(`신뢰도: ${nextAction.confidence}`);
console.log(`판단 근거: ${nextAction.reason}`);

console.log("\n[다음 행동 선택 프롬프트]");
console.log(nextActionPrompt);

console.log("\n========================================");
console.log("금융길잡이 AI Engine - Structured AIResponse 테스트");
console.log("========================================\n");

const aiResponseJson = stringifyAIResponse(aiResponse);

console.log("[AIResponse 고정 JSON 출력]");
console.log(aiResponseJson);

const parsedAIResponse = JSON.parse(aiResponseJson);

console.log("\n[AIResponse 파싱 확인]");
console.log(`requestId: ${parsedAIResponse.requestId}`);
console.log(`action: ${parsedAIResponse.action}`);
console.log(
  `targetElementId: ${
    parsedAIResponse.targetElementId ?? "없음"
  }`,
);
console.log(
  `inputValue: ${
    parsedAIResponse.inputValue ?? "없음"
  }`,
);

console.log("\n========================================");
console.log("금융길잡이 AI Engine - 쉬운 안내 문장 테스트");
console.log("========================================\n");

const guidanceTestCases = [
  {
    title: "검색어 입력",
    input: {
      action: "TYPE" as const,
      targetLabel: "상품명 입력칸",
      inputValue: "예금 금리가 높은",
    },
  },
  {
    title: "조회 버튼 클릭",
    input: {
      action: "CLICK" as const,
      targetLabel: "상품 검색",
    },
  },
  {
    title: "화면 추가 탐색",
    input: {
      action: "SCROLL" as const,
    },
  },
  {
    title: "사용자 확인 필요",
    input: {
      action: "CLICK" as const,
      targetLabel: "정기예금 가입",
      requiresConfirmation: true,
    },
  },
  {
    title: "민감정보 직접 입력",
    input: {
      action: "TYPE" as const,
      targetLabel: "계좌 비밀번호 입력칸",
      blocked: true,
    },
  },
  {
    title: "행동을 찾지 못함",
    input: {
      action: "NONE" as const,
    },
  },
];

for (const testCase of guidanceTestCases) {
  const result =
    generateGuidanceMessage(testCase.input);

  console.log(`[상황] ${testCase.title}`);
  console.log(`[안내 문장] ${result.message}`);
  console.log(`[문장 종류] ${result.tone}`);
  console.log(`[TTS 사용 가능] ${result.ttsReady}`);
  console.log(`[글자 수] ${result.characterCount}`);
  console.log();
}

console.log("\n========================================");
console.log("금융길잡이 AI Engine - WorkflowContext 테스트");
console.log("========================================\n");

let workflowContext = createWorkflowContext({
  workflowId: "workflow-test-001",
  sessionId: "session-test-001",

  originalGoal:
    "금리가 높은 예금 상품을 찾고 싶어요",

  currentGoal:
    "상품명 입력칸에 검색어 입력",

  completionConditionDescriptions: [
    "예금 상품 목록이 화면에 표시됨",
  ],
});

console.log("[1. 워크플로 생성]");
console.log(serializeWorkflowContext(workflowContext));
console.log();

workflowContext = startWorkflowStep(
  workflowContext,
  {
    stepId: "step-1",
    description:
      "상품명 입력칸에 검색어 입력",
    action: "TYPE",
    targetElementId: "el-2",
  },
);

console.log("[2. 첫 번째 단계 시작]");
console.log(serializeWorkflowContext(workflowContext));
console.log();

workflowContext = completeCurrentStep(
  workflowContext,
  "검색 버튼 누르기",
);

console.log("[3. 첫 번째 단계 완료]");
console.log(serializeWorkflowContext(workflowContext));
console.log();

workflowContext = startWorkflowStep(
  workflowContext,
  {
    stepId: "step-2",
    description: "검색 버튼 누르기",
    action: "CLICK",
    targetElementId: "el-3",
  },
);

console.log("[4. 두 번째 단계 시작]");
console.log(serializeWorkflowContext(workflowContext));
console.log();

workflowContext = completeCurrentStep(
  workflowContext,
  "예금 상품 목록 확인",
);

workflowContext =
  completeWorkflowCondition(
    workflowContext,
    "condition-1",
  );

console.log("[5. 완료 조건 충족]");
console.log(serializeWorkflowContext(workflowContext));
console.log();

console.log(
  `[최종 상태] ${workflowContext.status}`,
);

console.log(
  `[완료한 단계 수] ${
    workflowContext.stepHistory.length
  }`,
);

console.log("\n========================================");
console.log("금융길잡이 AI Engine - 약관 탐지 테스트");
console.log("========================================\n");

const termsTestElements = [
  {
    elementId: "terms-1",
    text: "[필수] 서비스 이용약관 동의",
    checked: true,
  },
  {
    elementId: "terms-2",
    text: "[필수] 개인정보 수집 및 이용 동의",
    checked: false,
  },
  {
    elementId: "terms-3",
    text: "[선택] 마케팅 및 금융상품 안내 동의",
    checked: false,
  },
  {
    elementId: "terms-4",
    text: "개인정보 제3자 제공 동의",
    checked: false,
  },
  {
    elementId: "button-1",
    text: "다음 단계로 이동",
    checked: false,
  },
];

const detectedTerms =
  detectTerms(termsTestElements);

for (const term of detectedTerms) {
  console.log(`[약관 ID] ${term.termId}`);
  console.log(`[요소 ID] ${term.elementId}`);
  console.log(`[제목] ${term.title}`);
  console.log(`[필수 여부] ${term.requirement}`);
  console.log(`[분류] ${term.category}`);
  console.log(`[동의 상태] ${term.checked}`);
  console.log(`[쉬운 설명] ${term.easySummary}`);
  console.log();
}

const termsAgreementResult =
  createTermsAgreementResult(detectedTerms);

console.log("[TERMS_AGREEMENT 결과]");
console.log(
  stringifyTermsAgreementResult(
    termsAgreementResult,
  ),
);

console.log();

console.log(
  `[약관 탐지] ${termsAgreementResult.detected}`,
);

console.log(
  `[필수 약관 수] ${
    termsAgreementResult.requiredTerms.length
  }`,
);

console.log(
  `[선택 약관 수] ${
    termsAgreementResult.optionalTerms.length
  }`,
);

console.log(
  `[구분 불명확 약관 수] ${
    termsAgreementResult.unknownTerms.length
  }`,
);

console.log(
  `[필수 약관 전체 동의] ${
    termsAgreementResult.allRequiredAgreed
  }`,
);

console.log(
  `[사용자 확인 필요] ${
    termsAgreementResult.requiresUserAction
  }`,
);

console.log("\n========================================");
console.log("금융길잡이 AI Engine - SECURE_INPUT 테스트");
console.log("========================================\n");

const secureInputTestCases = [
  {
    elementId: "secure-1",
    text: "계좌 비밀번호를 입력하세요",
    elementType: "password",
  },
  {
    elementId: "secure-2",
    text: "OTP 번호를 입력해 주세요",
    elementType: "input",
  },
  {
    elementId: "secure-3",
    text: "문자로 받은 6자리 인증번호를 입력하세요",
    elementType: "input",
  },
  {
    elementId: "secure-4",
    text: "보안카드 번호를 입력하세요",
    elementType: "input",
  },
  {
    elementId: "secure-5",
    text: "공동인증서 비밀번호를 입력하세요",
    elementType: "password",
  },
  {
    elementId: "normal-1",
    text: "예금 상품명을 입력하세요",
    elementType: "input",
  },
];

for (const testCase of secureInputTestCases) {
  const detection =
    detectSecureInput(testCase);

  console.log(
    `[화면 문구] ${testCase.text}`,
  );

  console.log(
    `[민감 입력 탐지] ${detection.detected}`,
  );

  console.log(
    `[민감정보 종류] ${
      detection.secureInputType ?? "없음"
    }`,
  );

  console.log(
    `[대상 요소] ${
      detection.targetElementId ?? "없음"
    }`,
  );

  console.log(
    `[신뢰도] ${detection.confidence}`,
  );

  console.log(
    `[판단 근거] ${detection.reason}`,
  );

  const secureResult =
    createSecureInputResult(detection);

  if (secureResult) {
    console.log(
      "[SECURE_INPUT 결과]",
    );

    console.log(
      stringifySecureInputResult(
        secureResult,
      ),
    );
  }

  console.log();
}

console.log("\n========================================");
console.log("금융길잡이 AI Engine - FINAL_CONFIRMATION 테스트");
console.log("========================================\n");

const finalActionTestCases = [
  {
    elementId: "final-1",
    text: "10만 원 이체하기",
    elementType: "button",
  },
  {
    elementId: "final-2",
    text: "정기예금 가입하기",
    elementType: "button",
  },
  {
    elementId: "final-3",
    text: "적금 해지하기",
    elementType: "button",
  },
  {
    elementId: "final-4",
    text: "이체 한도 변경",
    elementType: "button",
  },
  {
    elementId: "final-5",
    text: "결제하기",
    elementType: "button",
  },

  // 최종 거래로 잘못 판단하면 안 되는 케이스
  {
    elementId: "normal-1",
    text: "이체 내역 조회",
    elementType: "button",
  },
  {
    elementId: "normal-2",
    text: "예금 가입 방법 안내",
    elementType: "link",
  },
  {
    elementId: "normal-3",
    text: "적금 해지 방법",
    elementType: "link",
  },
];

for (const testCase of finalActionTestCases) {
  const detection =
    detectFinalAction(testCase);

  console.log(
    `[화면 문구] ${testCase.text}`,
  );

  console.log(
    `[최종 거래 탐지] ${detection.detected}`,
  );

  console.log(
    `[거래 종류] ${
      detection.finalActionType ?? "없음"
    }`,
  );

  console.log(
    `[대상 요소] ${
      detection.targetElementId ?? "없음"
    }`,
  );

  console.log(
    `[신뢰도] ${detection.confidence}`,
  );

  console.log(
    `[판단 근거] ${detection.reason}`,
  );

  const confirmationResult =
    createFinalConfirmationResult(
      detection,
    );

  if (confirmationResult) {
    console.log(
      "[FINAL_CONFIRMATION 결과]",
    );

    console.log(
      stringifyFinalConfirmationResult(
        confirmationResult,
      ),
    );
  }

  console.log();
}

console.log("\n========================================");
console.log("금융길잡이 AI Engine - RISK_WARNING 테스트");
console.log("========================================\n");

const riskTestCases = [
  {
    text: "돈을 안전계좌로 보내야 보호할 수 있다고 합니다.",
    sourceType: "USER_MESSAGE" as const,
  },

  {
    text: "금융감독원입니다. 지금 안전계좌로 송금하세요.",
    sourceType: "USER_MESSAGE" as const,
  },

  {
    text: "지금 당장 송금하지 않으면 문제가 생긴다고 합니다.",
    sourceType: "USER_MESSAGE" as const,
  },

  {
    text: "검찰입니다. 고객님의 계좌가 범죄에 이용되었습니다.",
    sourceType: "USER_MESSAGE" as const,
  },

  {
    text: "상담을 위해 원격제어 앱을 설치해 주세요.",
    sourceType: "PAGE_TEXT" as const,
  },

  {
    text: "대출을 받으려면 먼저 입금해야 합니다.",
    sourceType: "USER_MESSAGE" as const,
  },

  // 정상 문장
  {
    text: "금리가 높은 예금 상품을 찾아주세요.",
    sourceType: "USER_MESSAGE" as const,
  },

  {
    text: "내 계좌 잔액을 확인하고 싶어요.",
    sourceType: "USER_MESSAGE" as const,
  },
];

for (const testCase of riskTestCases) {
  const detection =
    detectRisk(testCase);

  console.log(
    `[입력 문장] ${testCase.text}`,
  );

  console.log(
    `[위험 탐지] ${detection.detected}`,
  );

  console.log(
    `[위험 종류] ${
      detection.riskType ?? "없음"
    }`,
  );

  console.log(
    `[위험 수준] ${
      detection.riskLevel ?? "없음"
    }`,
  );

  console.log(
    `[신뢰도] ${detection.confidence}`,
  );

  console.log(
    `[감지 키워드] ${
      detection.matchedKeywords.length > 0
        ? detection.matchedKeywords.join(", ")
        : "없음"
    }`,
  );

  console.log(
    `[판단 근거] ${detection.reason}`,
  );

  const warningResult =
    createRiskWarningResult(
      detection,
    );

  if (warningResult) {
    console.log(
      "[RISK_WARNING 결과]",
    );

    console.log(
      stringifyRiskWarningResult(
        warningResult,
      ),
    );
  }

  console.log();
}

console.log("\n========================================");
console.log("금융길잡이 AI Engine - Confidence / Fallback 테스트");
console.log("========================================\n");

const confidenceTestCases = [
  {
    name: "높은 신뢰도",
    confidence: 0.9,
    source: "NEXT_ACTION" as const,
  },

  {
    name: "중간 신뢰도",
    confidence: 0.65,
    source: "INTENT" as const,
  },

  {
    name: "낮은 신뢰도",
    confidence: 0.4,
    source: "INTENT" as const,
  },

  {
    name: "판단 불가",
    confidence: 0,
    source: "INTENT" as const,
  },

  {
    name: "신뢰도는 높지만 요청이 불명확",
    confidence: 0.9,
    source: "USER_GOAL" as const,
    ambiguous: true,
  },

  {
    name: "경계값 0.8",
    confidence: 0.8,
    source: "NEXT_ACTION" as const,
  },

  {
    name: "경계값 0.5",
    confidence: 0.5,
    source: "INTENT" as const,
  },
];

for (
  const testCase
  of confidenceTestCases
) {
  const decision =
    evaluateConfidence(
      testCase,
    );

  console.log(
    `[테스트] ${testCase.name}`,
  );

  console.log(
    `[입력 신뢰도] ${testCase.confidence}`,
  );

  console.log(
    `[신뢰도 수준] ${decision.level}`,
  );

  console.log(
    `[처리 방식] ${decision.action}`,
  );

  console.log(
    `[사용자 확인 필요] ${decision.requiresUserAction}`,
  );

  console.log(
    `[판단 근거] ${decision.reason}`,
  );

  const fallback =
    createFallbackResult(
      decision,
    );

  if (fallback) {
    console.log(
      "[Fallback 결과]",
    );

    console.log(
      stringifyFallbackResult(
        fallback,
      ),
    );
  } else {
    console.log(
      "[Fallback 없음] 기존 AI 판단을 계속 진행합니다.",
    );
  }

  console.log();
}