import {
  DomModelInput,
  ModelDomElement,
  ModelElementType,
  SanitizedDomElement,
  SanitizedDomSnapshot,
} from "./types.js";

/**
 * 공백, 줄바꿈 등을 정리합니다.
 */
function normalizeText(value?: string): string {
  if (!value) {
    return "";
  }

  return value.replace(/\s+/g, " ").trim();
}

/**
 * DOM 요소에서 AI가 이해할 대표 이름을 선택합니다.
 *
 * 우선순위:
 * 1. 화면에 표시되는 text
 * 2. aria-label
 * 3. placeholder
 * 4. 링크 주소
 * 5. 태그 이름
 */
function createElementLabel(element: SanitizedDomElement): string {
  const candidates = [
    element.text,
    element.ariaLabel,
    element.placeholder,
    element.href,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeText(candidate);

    if (normalized) {
      return normalized;
    }
  }

  return normalizeText(element.tag) || "이름 없는 요소";
}

/**
 * HTML 태그와 role을 AI용 요소 유형으로 변환합니다.
 */
function inferElementType(
  element: SanitizedDomElement,
): ModelElementType {
  const tag = element.tag.toLowerCase();
  const role = element.role?.toLowerCase();

  if (tag === "button" || role === "button") {
    return "button";
  }

  if (tag === "a" || role === "link") {
    return "link";
  }

  if (
    tag === "input" &&
    (role === "checkbox" || role === "radio")
  ) {
    return role;
  }

  if (
    tag === "input" ||
    tag === "textarea" ||
    role === "textbox" ||
    element.editable
  ) {
    return "input";
  }

  if (tag === "select" || role === "combobox") {
    return "select";
  }

  if (role === "checkbox") {
    return "checkbox";
  }

  if (role === "radio") {
    return "radio";
  }

  if (
    tag === "p" ||
    tag === "span" ||
    tag === "strong" ||
    tag === "label" ||
    /^h[1-6]$/.test(tag)
  ) {
    return "text";
  }

  return "unknown";
}

/**
 * 요소를 조작할 수 있는지 판단합니다.
 */
function isActionable(element: SanitizedDomElement): boolean {
  if (element.disabled) {
    return false;
  }

  if (element.clickable || element.editable) {
    return true;
  }

  const type = inferElementType(element);

  return [
    "button",
    "link",
    "input",
    "select",
    "checkbox",
    "radio",
  ].includes(type);
}

/**
 * AI에게 해당 요소에서 가능한 행동을 알려줍니다.
 */
function createActionHint(
  type: ModelElementType,
  actionable: boolean,
): string | undefined {
  if (!actionable) {
    return undefined;
  }

  switch (type) {
    case "button":
    case "link":
      return "CLICK";

    case "input":
      return "INPUT";

    case "select":
      return "SELECT";

    case "checkbox":
    case "radio":
      return "CLICK";

    default:
      return undefined;
  }
}

/**
 * 모델에 전달할 가치가 없는 요소인지 판단합니다.
 */
function shouldExcludeElement(
  element: SanitizedDomElement,
): boolean {
  if (element.visible === false) {
    return true;
  }

  const label = createElementLabel(element);
  const actionable = isActionable(element);

  // 이름도 없고 조작도 불가능하면 AI에 전달하지 않습니다.
  if (!label && !actionable) {
    return true;
  }

  return false;
}

/**
 * Sanitized DOM 요소 하나를 AI용 요소로 변환합니다.
 */
export function mapDomElement(
  element: SanitizedDomElement,
): ModelDomElement | null {
  if (shouldExcludeElement(element)) {
    return null;
  }

  const type = inferElementType(element);
  const actionable = isActionable(element);

  return {
    id: element.id,
    type,
    label: createElementLabel(element),
    actionable,
    actionHint: createActionHint(type, actionable),
  };
}

/**
 * B팀의 Sanitized DOM 전체를 AI 모델 입력으로 변환합니다.
 */
export function mapSanitizedDomToModelInput(
  snapshot: SanitizedDomSnapshot,
): DomModelInput {
  if (!snapshot.url || typeof snapshot.url !== "string") {
    throw new Error("Sanitized DOM의 url이 올바르지 않습니다.");
  }

  if (!Array.isArray(snapshot.elements)) {
    throw new Error(
      "Sanitized DOM의 elements는 배열이어야 합니다.",
    );
  }

  const mappedElements = snapshot.elements
    .map(mapDomElement)
    .filter(
      (element): element is ModelDomElement =>
        element !== null,
    );

  return {
    page: {
      url: snapshot.url,
      title:
        normalizeText(snapshot.title) || "제목 없는 페이지",
    },

    elements: mappedElements,

    metadata: {
      originalElementCount: snapshot.elements.length,
      modelElementCount: mappedElements.length,
    },
  };
}