import type {
  GuidanceMessageInput,
  GuidanceMessageResult,
} from "./guidanceMessage.types.js";

const MAX_MESSAGE_LENGTH = 60;

/**
 * 화면 요소 이름에 포함된 기술적 표현을
 * 사용자가 이해하기 쉬운 표현으로 바꿉니다.
 */
function simplifyLabel(
  value?: string,
): string {
  if (!value) {
    return "";
  }

  return value
    .replace(/\s+/g, " ")
    .replace(/버튼/gi, "")
    .replace(/링크/gi, "")
    .replace(/텍스트박스/gi, "입력칸")
    .replace(/textbox/gi, "입력칸")
    .replace(/을 입력하세요$/g, " 입력칸")
    .replace(/를 입력하세요$/g, " 입력칸")
    .replace(/입력하세요$/g, "입력칸")
    .trim();
}

/**
 * 너무 긴 입력값은 TTS 안내에서 짧게 줄입니다.
 */
function simplifyInputValue(
  value?: string,
): string {
  if (!value) {
    return "";
  }

  const normalized = value
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length <= 20) {
    return normalized;
  }

  return `${normalized.slice(0, 20)}…`;
}

/**
 * 문장을 한 줄로 정리하고 최대 길이를 제한합니다.
 */
function normalizeMessage(
  message: string,
): string {
  const normalized = message
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length <= MAX_MESSAGE_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(
    0,
    MAX_MESSAGE_LENGTH - 1,
  )}…`;
}

/**
 * 고령층 사용자가 듣기 쉬운 한 문장 안내를 생성합니다.
 */
export function generateGuidanceMessage(
  input: GuidanceMessageInput,
): GuidanceMessageResult {
  const targetLabel = simplifyLabel(
    input.targetLabel,
  );

  const inputValue = simplifyInputValue(
    input.inputValue,
  );

  let message: string;
  let tone: GuidanceMessageResult["tone"];

  if (input.blocked) {
    message =
      "중요한 개인정보는 직접 입력해 주세요.";

    tone = "WARNING";
  } else if (input.requiresConfirmation) {
    message = targetLabel
      ? `${targetLabel}을 진행할까요?`
      : "이 작업을 진행할까요?";

    tone = "CONFIRMATION";
  } else {
    switch (input.action) {
      case "CLICK":
        message = targetLabel
          ? `${targetLabel}을 눌러 다음 화면으로 갈게요.`
          : "다음 화면으로 이동할게요.";

        tone = "INFORMATION";
        break;

      case "TYPE":
        if (targetLabel) {
          message =
            `${targetLabel}에 검색어를 입력할게요.`;
        } else {
          message =
            "검색어를 입력할게요.";
        }

        tone = "INFORMATION";
        break;

      case "SCROLL":
        message =
          "아래 내용을 더 확인할게요.";

        tone = "INFORMATION";
        break;

      case "NONE":
        message =
          "지금 화면에서는 할 수 있는 작업을 찾지 못했어요.";

        tone = "WARNING";
        break;

      default:
        message =
          "다음 작업을 확인하고 있어요.";

        tone = "INFORMATION";
    }
  }

  const normalizedMessage =
    normalizeMessage(message);

  return {
    message: normalizedMessage,
    tone,
    ttsReady:
      normalizedMessage.length > 0 &&
      !normalizedMessage.includes("\n"),
    characterCount: normalizedMessage.length,
  };
}