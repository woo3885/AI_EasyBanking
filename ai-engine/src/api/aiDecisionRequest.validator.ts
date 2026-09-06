import type {
  BackendAiDecisionRequest,
  BackendAiUserDecisionContext,
  BackendSanitizedDomSnapshot,
} from "./aiRequest.types.js";

import {
  isUserDecisionType,
} from "../workflow/userDecision.types.js";

const REQUEST_FIELDS = new Set([
  "userRequest",
  "snapshot",
  "userDecision",
]);

const USER_DECISION_FIELDS = new Set([
  "decisionId",
  "decisionType",
  "selectedOptionIds",
  "sourceSnapshotId",
]);

const PAGE_FIELDS = new Set([
  "url",
  "title",
  "productId",
  "productName",
  "productPeriod",
  "depositAmount",
]);

const SNAPSHOT_FIELDS = new Set([
  "schemaVersion",
  "snapshotId",
  "page",
  "elements",
]);

const ELEMENT_FIELDS = new Set([
  "elementId",
  "tag",
  "role",
  "text",
  "ariaLabel",
  "placeholder",
  "inputType",
  "visible",
  "enabled",
  "checked",
  "boundingBox",
  "securityPolicy",
]);

const BOUNDING_BOX_FIELDS = new Set([
  "x",
  "y",
  "width",
  "height",
]);

const SECURITY_POLICIES = new Set([
  "NORMAL",
  "USER_DECISION",
  "SECURE_INPUT",
  "FINAL_CONFIRMATION",
  "BLOCKED",
]);

const MAX_SELECTED_OPTION_COUNT = 20;
const MAX_ELEMENT_COUNT = 300;

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function rejectUnknownFields(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  label: string,
): void {
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) {
      throw new Error(
        `[AI Engine] unknown ${label} field: ${field}`,
      );
    }
  }
}

function requireNonBlankString(
  value: unknown,
  fieldName: string,
): string {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new Error(
      `[AI Engine] ${fieldName} must be a non-blank string.`,
    );
  }

  return value;
}

function requireExactId(
  value: unknown,
  fieldName: string,
): string {
  const id = requireNonBlankString(
    value,
    fieldName,
  );

  if (id !== id.trim()) {
    throw new Error(
      `[AI Engine] ${fieldName} must be preserved exactly.`,
    );
  }

  return id;
}

function requireNullableExactString(
  value: unknown,
  fieldName: string,
): string | null {
  if (value === null) {
    return null;
  }

  const exact = requireNonBlankString(
    value,
    fieldName,
  );

  if (exact !== exact.trim()) {
    throw new Error(
      `[AI Engine] ${fieldName} must be preserved exactly.`,
    );
  }

  return exact;
}

function requireBoolean(
  value: unknown,
  fieldName: string,
): boolean {
  if (typeof value !== "boolean") {
    throw new Error(
      `[AI Engine] ${fieldName} must be a boolean.`,
    );
  }

  return value;
}

function requireNullableBoolean(
  value: unknown,
  fieldName: string,
): boolean | null {
  if (value === null) {
    return null;
  }

  return requireBoolean(value, fieldName);
}

function requireFiniteNumber(
  value: unknown,
  fieldName: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    throw new Error(
      `[AI Engine] ${fieldName} must be a finite number.`,
    );
  }

  return value;
}

function validateBoundingBox(
  value: unknown,
  fieldName: string,
): void {
  if (value === null) {
    return;
  }

  if (!isRecord(value)) {
    throw new Error(
      `[AI Engine] ${fieldName} must be an object or null.`,
    );
  }

  rejectUnknownFields(
    value,
    BOUNDING_BOX_FIELDS,
    fieldName,
  );
  requireFiniteNumber(value.x, `${fieldName}.x`);
  requireFiniteNumber(value.y, `${fieldName}.y`);
  const width = requireFiniteNumber(
    value.width,
    `${fieldName}.width`,
  );
  const height = requireFiniteNumber(
    value.height,
    `${fieldName}.height`,
  );

  if (width < 0 || height < 0) {
    throw new Error(
      `[AI Engine] ${fieldName} dimensions must not be negative.`,
    );
  }
}

function validateSnapshotElements(
  value: unknown,
): void {
  if (!Array.isArray(value)) {
    throw new Error(
      "[AI Engine] snapshot.elements must be an array.",
    );
  }

  if (value.length > MAX_ELEMENT_COUNT) {
    throw new Error(
      "[AI Engine] snapshot.elements exceeds the Backend maximum of 300.",
    );
  }

  const elementIds = new Set<string>();

  value.forEach((candidate, index) => {
    const fieldName = `snapshot.elements[${index}]`;

    if (!isRecord(candidate)) {
      throw new Error(
        `[AI Engine] ${fieldName} must be an object.`,
      );
    }

    rejectUnknownFields(
      candidate,
      ELEMENT_FIELDS,
      fieldName,
    );
    const elementId = requireExactId(
      candidate.elementId,
      `${fieldName}.elementId`,
    );

    if (elementIds.has(elementId)) {
      throw new Error(
        `[AI Engine] duplicate snapshot element ID: ${elementId}`,
      );
    }
    elementIds.add(elementId);

    requireExactId(candidate.tag, `${fieldName}.tag`);
    requireNullableExactString(
      candidate.role,
      `${fieldName}.role`,
    );
    requireNullableExactString(
      candidate.text,
      `${fieldName}.text`,
    );
    requireNullableExactString(
      candidate.ariaLabel,
      `${fieldName}.ariaLabel`,
    );
    requireNullableExactString(
      candidate.placeholder,
      `${fieldName}.placeholder`,
    );
    requireNullableExactString(
      candidate.inputType,
      `${fieldName}.inputType`,
    );
    requireBoolean(
      candidate.visible,
      `${fieldName}.visible`,
    );
    requireBoolean(
      candidate.enabled,
      `${fieldName}.enabled`,
    );
    requireNullableBoolean(
      candidate.checked,
      `${fieldName}.checked`,
    );
    validateBoundingBox(
      candidate.boundingBox,
      `${fieldName}.boundingBox`,
    );

    if (
      typeof candidate.securityPolicy !== "string" ||
      !SECURITY_POLICIES.has(candidate.securityPolicy)
    ) {
      throw new Error(
        `[AI Engine] ${fieldName}.securityPolicy is not supported.`,
      );
    }
  });
}

function validateSelectedOptionIds(
  value: unknown,
  decisionType: BackendAiUserDecisionContext["decisionType"],
): readonly string[] {
  if (!Array.isArray(value)) {
    throw new Error(
      "[AI Engine] selectedOptionIds must be an array.",
    );
  }

  if (value.length > MAX_SELECTED_OPTION_COUNT) {
    throw new Error(
      "[AI Engine] selectedOptionIds must contain at most 20 IDs.",
    );
  }

  if (
    decisionType !== "TERMS_AGREEMENT" &&
    value.length !== 1
  ) {
    throw new Error(
      `[AI Engine] ${decisionType} requires exactly one selected option.`,
    );
  }

  const seen = new Set<string>();
  const selectedOptionIds = value.map(
    (rawId) => {
      const id = requireExactId(
        rawId,
        "selected option ID",
      );

      if (seen.has(id)) {
        throw new Error(
          `[AI Engine] duplicate selected option ID: ${id}`,
        );
      }

      seen.add(id);
      return id;
    },
  );

  return Object.freeze(selectedOptionIds);
}

export function validateBackendAiUserDecisionContext(
  value: unknown,
): BackendAiUserDecisionContext {
  if (!isRecord(value)) {
    throw new Error(
      "[AI Engine] userDecision must be an object.",
    );
  }

  rejectUnknownFields(
    value,
    USER_DECISION_FIELDS,
    "userDecision",
  );

  if (!isUserDecisionType(value.decisionType)) {
    throw new Error(
      "[AI Engine] userDecision.decisionType is not supported.",
    );
  }

  const decisionType = value.decisionType;

  return Object.freeze({
    decisionId: requireExactId(
      value.decisionId,
      "userDecision.decisionId",
    ),
    decisionType,
    selectedOptionIds: validateSelectedOptionIds(
      value.selectedOptionIds,
      decisionType,
    ),
    sourceSnapshotId: requireExactId(
      value.sourceSnapshotId,
      "userDecision.sourceSnapshotId",
    ),
  });
}

export function validateBackendAiDecisionRequest(
  value: unknown,
): BackendAiDecisionRequest {
  if (!isRecord(value)) {
    throw new Error(
      "[AI Engine] Backend AI decision request must be an object.",
    );
  }

  rejectUnknownFields(
    value,
    REQUEST_FIELDS,
    "request",
  );

  const userRequest = requireNonBlankString(
    value.userRequest,
    "userRequest",
  );

  if (!isRecord(value.snapshot)) {
    throw new Error(
      "[AI Engine] snapshot must be an object.",
    );
  }

  rejectUnknownFields(
    value.snapshot,
    SNAPSHOT_FIELDS,
    "snapshot",
  );

  const snapshot =
    value.snapshot as unknown as BackendSanitizedDomSnapshot;

  requireExactId(
    snapshot.schemaVersion,
    "snapshot.schemaVersion",
  );
  requireExactId(
    snapshot.snapshotId,
    "snapshot.snapshotId",
  );

  if (!isRecord(snapshot.page)) {
    throw new Error(
      "[AI Engine] snapshot.page must be an object.",
    );
  }

  rejectUnknownFields(
    snapshot.page,
    PAGE_FIELDS,
    "snapshot.page",
  );

  requireNonBlankString(
    snapshot.page.url,
    "snapshot.page.url",
  );
  requireNonBlankString(
    snapshot.page.title,
    "snapshot.page.title",
  );
  requireNullableExactString(
    snapshot.page.productId,
    "snapshot.page.productId",
  );
  requireNullableExactString(
    snapshot.page.productName,
    "snapshot.page.productName",
  );
  requireNullableExactString(
    snapshot.page.productPeriod,
    "snapshot.page.productPeriod",
  );
  if ("depositAmount" in snapshot.page) {
    requireNullableExactString(
      snapshot.page.depositAmount,
      "snapshot.page.depositAmount",
    );
  }

  validateSnapshotElements(snapshot.elements);

  if (!("userDecision" in value)) {
    return {
      userRequest,
      snapshot,
    };
  }

  return {
    userRequest,
    snapshot,
    userDecision:
      validateBackendAiUserDecisionContext(
        value.userDecision,
      ),
  };
}
