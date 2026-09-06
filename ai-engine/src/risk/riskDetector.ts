import type {
  RiskDetection,
  RiskLevel,
  RiskSource,
  RiskType,
} from "./riskWarning.types.js";

interface RiskRule {
  type: RiskType;
  level: RiskLevel;
  keywords: string[];
  confidence: number;
}

const RISK_RULES: RiskRule[] = [
  {
    type: "SAFE_ACCOUNT_SCAM",
    level: "CRITICAL",
    keywords: [
      "안전계좌",
      "안전 계좌",
      "보호계좌",
      "보호 계좌",
      "금융감독원 계좌",
      "검찰 계좌",
    ],
    confidence: 0.99,
  },

  {
    type: "REMOTE_APP_REQUEST",
    level: "CRITICAL",
    keywords: [
      "원격제어 앱",
      "원격 제어 앱",
      "원격지원 앱",
      "원격 지원 앱",
      "팀뷰어 설치",
      "애니데스크 설치",
      "원격 앱 설치",
    ],
    confidence: 0.99,
  },

  {
    type: "IMPERSONATION",
    level: "HIGH",
    keywords: [
      "검찰입니다",
      "경찰입니다",
      "금융감독원입니다",
      "금감원입니다",
      "은행 직원입니다",
      "수사관입니다",
      "검사입니다",
    ],
    confidence: 0.96,
  },

  {
    type: "PRESSURED_TRANSFER",
    level: "HIGH",
    keywords: [
      "지금 당장 송금",
      "즉시 송금",
      "빨리 송금",
      "바로 이체",
      "지금 보내",
      "당장 보내",
      "오늘 안에 보내",
    ],
    confidence: 0.94,
  },

  {
    type: "VOICE_PHISHING",
    level: "HIGH",
    keywords: [
      "보이스피싱",
      "대출을 받으려면 먼저 입금",
      "수수료를 먼저 보내",
      "기존 대출금을 먼저 갚아",
      "계좌가 범죄에 이용",
      "범죄에 연루",
    ],
    confidence: 0.95,
  },
];

function normalizeText(
  value: string,
): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * 사용자 문장 또는 화면 문구에서
 * 금융사기 위험 신호를 탐지합니다.
 */
export function detectRisk(
  source: RiskSource,
): RiskDetection {
  const normalized =
    normalizeText(source.text);

  for (const rule of RISK_RULES) {
    const matchedKeywords =
      rule.keywords.filter((keyword) =>
        normalized.includes(
          keyword.toLowerCase(),
        ),
      );

    if (matchedKeywords.length === 0) {
      continue;
    }

    return {
      detected: true,

      riskType: rule.type,

      riskLevel: rule.level,

      confidence: rule.confidence,

      matchedKeywords,

      reason:
        `${matchedKeywords
          .map((keyword) => `"${keyword}"`)
          .join(", ")} 표현이 감지되어 ` +
        `${rule.type} 위험 상황으로 판단했습니다.`,
    };
  }

  return {
    detected: false,

    riskType: null,

    riskLevel: null,

    confidence: 0,

    matchedKeywords: [],

    reason:
      "현재 문장에서 금융사기 위험 신호를 찾지 못했습니다.",
  };
}