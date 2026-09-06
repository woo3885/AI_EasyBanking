/**
 * Backend(B팀)에서 전달받는 정제된 DOM 요소입니다.
 *
 * 실제 B팀 스키마가 확정되면 필드 이름을 맞춰 수정합니다.
 */
export interface SanitizedDomElement {
  id: string;
  tag: string;
  text?: string;
  role?: string;
  ariaLabel?: string;
  placeholder?: string;
  href?: string;

  clickable?: boolean;
  editable?: boolean;
  disabled?: boolean;
  visible?: boolean;

  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

/**
 * Backend에서 AI Engine으로 전달하는 DOM 스냅샷입니다.
 */
export interface SanitizedDomSnapshot {
  url: string;
  title?: string;
  elements: SanitizedDomElement[];
}

/**
 * AI 모델이 판단할 때 사용할 요소 유형입니다.
 */
export type ModelElementType =
  | "button"
  | "link"
  | "input"
  | "select"
  | "checkbox"
  | "radio"
  | "text"
  | "unknown";

/**
 * AI 모델에 전달할 개별 DOM 요소입니다.
 */
export interface ModelDomElement {
  id: string;
  type: ModelElementType;
  label: string;

  actionable: boolean;
  actionHint?: string;
}

/**
 * AI 모델의 최종 입력 데이터입니다.
 */
export interface DomModelInput {
  page: {
    url: string;
    title: string;
    productId?: string | null;
    productName?: string | null;
    productPeriod?: string | null;
  };

  elements: ModelDomElement[];

  metadata: {
    originalElementCount: number;
    modelElementCount: number;
  };
}
