import {
  parseStructuredAIResponse,
} from "../output/aiResponse.parser.js";

function createValidJson(): string {
  return JSON.stringify({
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
  });
}

function testValidJson() {
  console.log("\n========================================");
  console.log("정상 JSON Parser 테스트");
  console.log("========================================");

  const result = parseStructuredAIResponse(
    createValidJson(),
  );

  console.log("Action:", result.action);
  console.log(
    "Target:",
    result.targetElementId,
  );
  console.log("Parser 결과: SUCCESS");
}

function testMarkdownJson() {
  console.log("\n========================================");
  console.log("Markdown JSON Parser 테스트");
  console.log("========================================");

  const raw = `\`\`\`json
${createValidJson()}
\`\`\``;

  const result = parseStructuredAIResponse(raw);

  console.log("Action:", result.action);
  console.log("Parser 결과: SUCCESS");
}

function testInvalidJson() {
  console.log("\n========================================");
  console.log("잘못된 JSON Parser 테스트");
  console.log("========================================");

  try {
    parseStructuredAIResponse(
      "{ 잘못된 JSON }",
    );

    console.log("Parser 결과: FAILED");
  } catch (error) {
    console.log("Parser 오류 정상 감지");

    if (error instanceof Error) {
      console.log(error.message);
    }
  }
}

function runTests() {
  testValidJson();
  testMarkdownJson();
  testInvalidJson();
}

runTests();