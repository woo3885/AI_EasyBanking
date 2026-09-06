import type {
  DomModelInput,
  ModelDomElement,
} from "./types.js";

/**
 * 개별 DOM 요소를
 * AI Prompt에 전달할 문자열로 변환합니다.
 */
function serializeElement(
  element: ModelDomElement,
): string {
  const actionStatus =
    element.actionable
      ? `실행 가능: ${element.actionHint ?? "지정 없음"}`
      : element.actionHint
        ? `실행 불가: ${element.actionHint}`
        : "실행 불가";

  return [
    `[${element.id}]`,
    element.type,
    element.label,
    actionStatus,
  ].join(" | ");
}

/**
 * AI Prompt에 삽입 가능한 형태로
 * DOM 모델 입력을 직렬화합니다.
 *
 * 보안 정책이 적용된 요소의 actionHint도
 * 제거하지 않고 그대로 전달합니다.
 */
export function serializeDomModelInput(
  input: DomModelInput,
): string {
  const elementLines =
    input.elements.length > 0
      ? input.elements
          .map(
            serializeElement,
          )
          .join("\n")
      : "현재 화면에 분석 가능한 요소가 없습니다.";

  return [
    `현재 페이지: ${input.page.title}`,
    `URL: ${input.page.url}`,
    `선택 상품 ID: ${input.page.productId ?? "없음"}`,
    `선택 상품명: ${input.page.productName ?? "없음"}`,
    `선택 상품 실제 기간: ${input.page.productPeriod ?? "없음"}`,
    "",
    "현재 화면 요소:",
    elementLines,
    "",
    `원본 요소 수: ${input.metadata.originalElementCount}`,
    `모델 입력 요소 수: ${input.metadata.modelElementCount}`,
  ].join("\n");
}
