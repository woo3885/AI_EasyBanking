import { aiService } from "../services/ai.service.js";
import { createNextActionPrompt } from "../prompts/nextActionPrompt.js";
import { parseStructuredAIResponse } from "../output/aiResponse.parser.js";
import { createStructuredFallbackResponse } from "../output/aiResponse.fallback.js";

async function testGeminiStructuredOutput() {
  console.log("========================================");
  console.log("Gemini Structured Output 통합 테스트");
  console.log("========================================");

  const requestId = "req-d18-test-001";

  const userGoal = {
    rawMessage: "금리가 높은 예금 상품을 찾고 싶어요.",
    intent: "DEPOSIT",
    conditions: ["금리가 높은"],
  };

  const dom = {
    page: {
      url: "https://demo-bank.example/deposit",
      title: "예금 상품",
    },

    elements: [
      {
        id: "el-a1b2c3d4-001",
        type: "input" as const,
        label: "상품 검색",
        actionable: true,
        actionHint: "상품명을 입력할 수 있는 검색창",
      },
      {
        id: "el-a1b2c3d4-002",
        type: "button" as const,
        label: "검색",
        actionable: true,
        actionHint: "입력한 상품 조건을 검색",
      },
      {
        id: "el-a1b2c3d4-003",
        type: "link" as const,
        label: "정기예금 가입",
        actionable: true,
        actionHint: "정기예금 가입 화면으로 이동",
      },
    ],

    metadata: {
      originalElementCount: 3,
      modelElementCount: 3,
    },
  };

  const prompt = createNextActionPrompt(
    requestId,
    userGoal,
    dom,
  );

  console.log("\n[Gemini 요청 시작]");

  const result = await aiService.generateText({
    prompt,
  });

  console.log("\n[응답 Source]");
  console.log(result.source);

  console.log("\n[Raw Gemini 응답]");
  console.log(result.text);

  const structured =
    result.source === "FALLBACK"
      ? createStructuredFallbackResponse(requestId)
      : parseStructuredAIResponse(result.text);

  console.log("\n[Structured Output]");
  console.log(
    JSON.stringify(structured, null, 2),
  );

  console.log("\n[Action]");
  console.log(structured.action);

  console.log("\n[Target elementId]");
  console.log(structured.targetElementId);

  console.log("\n[Confidence]");
  console.log(structured.confidence);

  console.log("\n========================================");
  console.log("Structured Output 통합 테스트 SUCCESS");
  console.log("========================================");
}

testGeminiStructuredOutput().catch((error) => {
  console.error("\nStructured Output 통합 테스트 FAILED");
  console.error(error);
});