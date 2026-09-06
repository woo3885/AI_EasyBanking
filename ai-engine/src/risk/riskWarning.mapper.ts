import type {
  RiskDetection,
  RiskType,
  RiskWarningResult,
} from "./riskWarning.types.js";

function createRiskMessage(
  type: RiskType,
): string {
  switch (type) {
    case "SAFE_ACCOUNT_SCAM":
      return "안전계좌로 돈을 보내라는 요청은 사기일 수 있어요. 송금하지 마세요.";

    case "REMOTE_APP_REQUEST":
      return "원격제어 앱 설치 요청은 위험할 수 있어요. 설치하지 마세요.";

    case "IMPERSONATION":
      return "기관이나 은행을 사칭한 금융사기일 수 있어요. 먼저 확인해 주세요.";

    case "PRESSURED_TRANSFER":
      return "서둘러 돈을 보내라는 요청은 위험할 수 있어요. 송금을 멈춰 주세요.";

    case "VOICE_PHISHING":
      return "보이스피싱이 의심돼요. 돈을 보내기 전에 반드시 확인해 주세요.";

    default:
      return "금융사기 위험이 있을 수 있어요. 거래를 멈추고 확인해 주세요.";
  }
}

function createRiskSummary(
  type: RiskType,
): string {
  switch (type) {
    case "SAFE_ACCOUNT_SCAM":
      return "공공기관이나 금융기관은 자금 보호를 이유로 특정 계좌 송금을 요구하는 방식으로 확인하지 않습니다.";

    case "REMOTE_APP_REQUEST":
      return "원격제어 앱을 설치하면 다른 사람이 휴대전화나 금융 앱을 조작할 위험이 있습니다.";

    case "IMPERSONATION":
      return "공공기관이나 금융기관을 사칭하여 송금이나 개인정보 제공을 요구하는 상황일 수 있습니다.";

    case "PRESSURED_TRANSFER":
      return "급하게 송금을 요구하며 판단할 시간을 주지 않는 행동은 금융사기의 위험 신호일 수 있습니다.";

    case "VOICE_PHISHING":
      return "금전 송금이나 금융정보 제공을 요구하는 보이스피싱 의심 상황입니다.";

    default:
      return "금융 거래를 계속하기 전에 상대방과 요청 내용을 다시 확인해야 합니다.";
  }
}

/**
 * 위험 탐지 결과를 A팀 경고 UI에서 사용할
 * RISK_WARNING 결과로 변환합니다.
 */
export function createRiskWarningResult(
  detection: RiskDetection,
): RiskWarningResult | null {
  if (
    !detection.detected ||
    !detection.riskType ||
    !detection.riskLevel
  ) {
    return null;
  }

  return {
    decisionType: "RISK_WARNING",

    riskType:
      detection.riskType,

    riskLevel:
      detection.riskLevel,

    requiresUserAction: true,

    transactionBlocked: true,

    message:
      createRiskMessage(
        detection.riskType,
      ),

    summary:
      createRiskSummary(
        detection.riskType,
      ),

    confidence:
      detection.confidence,

    matchedKeywords:
      detection.matchedKeywords,

    reason:
      detection.reason,
  };
}

export function stringifyRiskWarningResult(
  result: RiskWarningResult,
): string {
  return JSON.stringify(
    result,
    null,
    2,
  );
}