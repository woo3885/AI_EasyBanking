import {
  validateStructuredAIResponse,
} from "../output/aiResponse.validator.js";

function createBaseResponse() {
  return {
    requestId: "req-test-001",
    status: "AI_EXECUTING",
    action: "CLICK",
    targetElementId: "el-a1b2c3d4-001",
    inputValue: null,
    message: "예금 상품 버튼을 선택합니다.",
    confidence: 0.9,
    requiresUserAction: false,

    decisionType: null,
    secureInputType: null,
    riskType: null,
    options: null,
    confirmationId: null,
    summary: null,
  };
}

function testValidResponse() {
  console.log("\n========================================");
  console.log("정상 Structured AIResponse 검증");
  console.log("========================================");

  const response = createBaseResponse();

  const result = validateStructuredAIResponse(response);

  console.log("검증 결과:", result.valid);
  console.log("오류:", result.errors);
}

function testInvalidClickResponse() {
  console.log("\n========================================");
  console.log("잘못된 CLICK 응답 검증");
  console.log("========================================");

  const response = {
    ...createBaseResponse(),

    // CLICK인데 targetElementId 없음
    targetElementId: null,
  };

  const result = validateStructuredAIResponse(response);

  console.log("검증 결과:", result.valid);
  console.log("오류:", result.errors);
}

function testInvalidConfidence() {
  console.log("\n========================================");
  console.log("잘못된 Confidence 검증");
  console.log("========================================");

  const response = {
    ...createBaseResponse(),

    // 허용 범위 0~1 초과
    confidence: 1.5,
  };

  const result = validateStructuredAIResponse(response);

  console.log("검증 결과:", result.valid);
  console.log("오류:", result.errors);
}

function runTests() {
  testValidResponse();
  testInvalidClickResponse();
  testInvalidConfidence();
}

runTests();