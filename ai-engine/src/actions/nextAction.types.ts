/**
 * AI가 현재 화면에서 선택할 수 있는 다음 행동입니다.
 *
 * CLICK  : 버튼이나 링크 클릭
 * TYPE   : 입력창에 값 입력
 * SCROLL : 화면을 아래 또는 위로 이동
 * NONE   : 현재 화면에서 수행할 적절한 행동이 없음
 */
export type NextActionType =
  | "CLICK"
  | "TYPE"
  | "SCROLL"
  | "NONE";

/*
 * SCROLL is retained for internal target-search planning. The Production
 * /api/ai/action structured-output path excludes it until the Backend pixel
 * payload (scrollX/scrollY) has an agreed C-side mapping.
 */

export type ScrollDirection = "UP" | "DOWN";

/**
 * 다음 행동 판단 결과입니다.
 */
export interface NextActionDecision {
  action: NextActionType;

  /**
   * CLICK 또는 TYPE 대상 DOM 요소 ID
   */
  targetId?: string;

  /**
   * TYPE 행동에서 입력할 문자열
   */
  value?: string;

  /**
   * SCROLL 행동의 방향
   */
  direction?: ScrollDirection;

  /**
   * 판단 신뢰도
   *
   * 0 이상 1 이하
   */
  confidence: number;

  /**
   * 해당 행동을 선택한 이유
   */
  reason: string;
}
