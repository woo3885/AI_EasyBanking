import Ajv2020Module from "ajv/dist/2020.js";
import type { ErrorObject } from "ajv";
import addFormatsModule from "ajv-formats";

import { aiResponseSchema } from "./aiResponse.schema.js";
import type { StructuredAIResponse } from "./aiResponse.types.js";
import {
  validateStructuredDecisionItems,
} from "../workflow/userDecision.types.js";

const Ajv2020 = Ajv2020Module.default ?? Ajv2020Module;
const addFormats = addFormatsModule.default ?? addFormatsModule;

const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
});

addFormats(ajv);

const validateAiResponse = ajv.compile(aiResponseSchema);

export interface AiResponseValidationResult {
  valid: boolean;
  errors: string[];
}

function formatValidationErrors(
  errors: ErrorObject[] | null | undefined,
): string[] {
  if (!errors) {
    return [];
  }

  return errors.map((error) => {
    const path = error.instancePath || "/";
    return `${path} ${error.message ?? "validation error"}`;
  });
}

export function validateStructuredAIResponse(
  value: unknown,
): AiResponseValidationResult {
  const schemaValid = validateAiResponse(value);

  if (!schemaValid) {
    return {
      valid: false,
      errors: formatValidationErrors(
        validateAiResponse.errors,
      ),
    };
  }

  const response = value as StructuredAIResponse;

  try {
    validateStructuredDecisionItems(
      response.decisionType,
      response.options,
    );
  } catch (error) {
    return {
      valid: false,
      errors: [
        error instanceof Error
          ? error.message
          : "decision options validation failed",
      ],
    };
  }

  return {
    valid: true,
    errors: [],
  };
}

export function assertStructuredAIResponse(
  value: unknown,
): asserts value is StructuredAIResponse {
  const result = validateStructuredAIResponse(value);

  if (!result.valid) {
    throw new Error(
      `[AI Engine] Structured AIResponse 검증 실패: ${result.errors.join(", ")}`,
    );
  }

}
