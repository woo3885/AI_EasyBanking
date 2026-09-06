import type {
  DomModelInput,
  ModelElementType,
} from "../dom/types.js";

import type {
  BackendSanitizedDomElement,
  BackendSanitizedDomSnapshot,
} from "./aiRequest.types.js";

function mapElementType(
  element: BackendSanitizedDomElement,
): ModelElementType {
  const tag =
    element.tag.toLowerCase();

  const role =
    element.role?.toLowerCase();

  if (
    tag === "input" ||
    tag === "textarea" ||
    role === "textbox"
  ) {
    return "input";
  }

  if (
    tag === "button" ||
    role === "button"
  ) {
    return "button";
  }

  if (
    tag === "a" ||
    role === "link"
  ) {
    return "link";
  }

  if (tag === "select") {
    return "select";
  }

  if (
    element.inputType === "checkbox" ||
    role === "checkbox"
  ) {
    return "checkbox";
  }

  if (
    element.inputType === "radio" ||
    role === "radio"
  ) {
    return "radio";
  }

  return "unknown";
}

function createLabel(
  element: BackendSanitizedDomElement,
): string {
  return (
    element.text ??
    element.ariaLabel ??
    element.placeholder ??
    element.tag
  );
}

function isNormalActionableElement(
  element: BackendSanitizedDomElement,
): boolean {
  if (!element.visible) {
    return false;
  }

  if (!element.enabled) {
    return false;
  }

  return (
    element.securityPolicy === "NORMAL"
  );
}

export function adaptBackendDomToModelInput(
  snapshot: BackendSanitizedDomSnapshot,
): DomModelInput {
  const modelElements =
    snapshot.elements
      .filter(
        (element) =>
          element.visible,
      )
      .map((element) => ({
        id: element.elementId,

        type: mapElementType(element),

        label: createLabel(element),

        actionable:
          isNormalActionableElement(
            element,
          ),

        actionHint:
          element.securityPolicy === "NORMAL"
            ? undefined
            : `SECURITY_POLICY:${element.securityPolicy}`,
      }));

  return {
    page: {
      url: snapshot.page.url,
      title: snapshot.page.title,
      productId: snapshot.page.productId,
      productName: snapshot.page.productName,
      productPeriod: snapshot.page.productPeriod,
    },

    elements: modelElements,

    metadata: {
      originalElementCount:
        snapshot.elements.length,

      modelElementCount:
        modelElements.length,
    },
  };
}
