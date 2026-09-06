import {
  PRODUCTION_STRUCTURED_ACTIONS,
} from "./aiResponse.types.js";

import {
  PRODUCTION_DECISION_RESPONSE_TYPES,
} from "../workflow/userDecision.types.js";

export const aiResponseSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://financial-guide.local/schemas/ai-response.json",

  title: "AIResponse",
  type: "object",
  additionalProperties: false,

  required: [
    "requestId",
    "status",
    "action",
    "targetElementId",
    "inputValue",
    "message",
    "confidence",
    "requiresUserAction",
    "decisionType",
    "secureInputType",
    "riskType",
    "options",
    "confirmationId",
    "summary",
  ],

  properties: {
    requestId: {
      type: "string",
      minLength: 1,
    },

    status: {
      type: "string",
      enum: [
        "SESSION_CREATED",
        "PAGE_LOADING",
        "AI_EXECUTING",
        "USER_DECISION_REQUIRED",
        "SECURE_INPUT_REQUIRED",
        "FINAL_CONFIRMATION_REQUIRED",
        "ADDITIONAL_INFORMATION_REQUIRED",
        "RISK_WARNING",
        "CANCELLED",
        "ERROR",
        "TERMINATED",
      ],
    },

    action: {
      type: "string",
      enum: PRODUCTION_STRUCTURED_ACTIONS,
    },

    targetElementId: {
      type: ["string", "null"],
    },

    inputValue: {
      type: ["string", "number", "null"],
    },

    message: {
      type: "string",
      minLength: 1,
    },

    confidence: {
      type: ["number", "null"],
      minimum: 0,
      maximum: 1,
    },

    requiresUserAction: {
      type: "boolean",
    },

    decisionType: {
      type: ["string", "null"],
      enum: [
        ...PRODUCTION_DECISION_RESPONSE_TYPES,
        null,
      ],
    },

    secureInputType: {
      type: ["string", "null"],
    },

    riskType: {
      type: ["string", "null"],
    },

    options: {
      type: ["array", "null"],
      minItems: 1,
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "label",
        ],
        properties: {
          id: {
            type: "string",
            minLength: 1,
          },
          label: {
            type: "string",
            minLength: 1,
          },
          description: {
            type: "string",
          },
          disabled: {
            type: "boolean",
          },
          required: {
            type: "boolean",
          },
        },
      },
    },

    confirmationId: {
      type: ["string", "null"],
    },

    summary: {
      type: ["object", "null"],
    },
  },

  allOf: [
    /*
     * CLICK
     */
    {
      if: {
        properties: {
          action: {
            const: "CLICK",
          },
        },
        required: [
          "action",
        ],
      },

      then: {
        properties: {
          targetElementId: {
            type: "string",
            minLength: 1,
          },

          inputValue: {
            type: "null",
          },
        },
      },
    },

    /*
     * TYPE
     */
    {
      if: {
        properties: {
          action: {
            const: "TYPE",
          },
        },
        required: [
          "action",
        ],
      },

      then: {
        properties: {
          targetElementId: {
            type: "string",
            minLength: 1,
          },

          inputValue: {
            type: [
              "string",
              "number",
            ],
          },
        },
      },
    },

    /*
     * targetElementId와 inputValue가
     * 필요하지 않은 일반 Action
     */
    {
      if: {
        properties: {
          action: {
            enum: [
              "NONE",
              "STOP",
            ],
          },
        },

        required: [
          "action",
        ],
      },

      then: {
        properties: {
          targetElementId: {
            type: "null",
          },

          inputValue: {
            type: "null",
          },
        },
      },
    },

    /*
     * STOP is termination only. It must never be interpreted as normal
     * completion by the C Agent Loop.
     */
    {
      if: {
        properties: {
          action: {
            const: "STOP",
          },
        },
        required: [
          "action",
        ],
      },

      then: {
        properties: {
          status: {
            const: "TERMINATED",
          },
        },
      },
    },

    /*
     * TERMS_AGREEMENT items must explicitly distinguish required and
     * optional terms. These are C-internal structured fields only.
     */
    {
      if: {
        properties: {
          decisionType: {
            const: "TERMS_AGREEMENT",
          },
          options: {
            type: "array",
          },
        },
        required: [
          "decisionType",
          "options",
        ],
      },
      then: {
        properties: {
          options: {
            type: "array",
            items: {
              required: [
                "required",
              ],
            },
          },
        },
      },
    },

    /*
     * USER_DECISION
     *
     * 상품, 수취인, 약관 등
     * 사용자의 직접 선택이 필요한 경우
     */
    {
      if: {
        properties: {
          action: {
            const: "WAIT_FOR_USER",
          },
        },

        required: [
          "action",
        ],
      },

      then: {
        properties: {
          status: {
            const:
              "USER_DECISION_REQUIRED",
          },

          targetElementId: {
            type: "null",
          },

          inputValue: {
            type: "null",
          },

          requiresUserAction: {
            const: true,
          },

          decisionType: {
            type: "string",
            enum: PRODUCTION_DECISION_RESPONSE_TYPES,
          },

          options: {
            type: "array",
            minItems: 1,
            maxItems: 20,
          },
        },
      },
    },

    /*
     * Decision metadata is only a candidate description for Backend to
     * validate. It must never accompany an executable browser action.
     */
    {
      if: {
        properties: {
          decisionType: {
            type: "string",
          },
        },
        required: [
          "decisionType",
        ],
      },
      then: {
        properties: {
          action: {
            const: "WAIT_FOR_USER",
          },
          status: {
            const: "USER_DECISION_REQUIRED",
          },
          requiresUserAction: {
            const: true,
          },
          options: {
            type: "array",
            minItems: 1,
            maxItems: 20,
          },
        },
      },
    },

    {
      if: {
        properties: {
          status: {
            const: "USER_DECISION_REQUIRED",
          },
        },
        required: [
          "status",
        ],
      },
      then: {
        properties: {
          action: {
            const: "WAIT_FOR_USER",
          },
          targetElementId: {
            type: "null",
          },
          inputValue: {
            type: "null",
          },
          requiresUserAction: {
            const: true,
          },
        },
      },
    },

    /*
     * SECURE_INPUT
     *
     * 비밀번호, OTP, 인증번호 등
     * 민감정보는 AI가 입력하지 않습니다.
     */
    {
      if: {
        properties: {
          action: {
            const:
              "PAUSE_FOR_SECURE_INPUT",
          },
        },

        required: [
          "action",
        ],
      },

      then: {
        properties: {
          status: {
            const:
              "SECURE_INPUT_REQUIRED",
          },

          targetElementId: {
            type: "null",
          },

          inputValue: {
            type: "null",
          },

          requiresUserAction: {
            const: true,
          },
        },
      },
    },

    /*
     * FINAL_CONFIRMATION
     *
     * 송금, 가입, 해지 등
     * 최종 실행은 사용자 승인을 요구합니다.
     */
    {
      if: {
        properties: {
          action: {
            const:
              "REQUEST_FINAL_CONFIRMATION",
          },
        },

        required: [
          "action",
        ],
      },

      then: {
        properties: {
          status: {
            const:
              "FINAL_CONFIRMATION_REQUIRED",
          },

          targetElementId: {
            type: "null",
          },

          inputValue: {
            type: "null",
          },

          requiresUserAction: {
            const: true,
          },

          decisionType: {
            type: "null",
          },

          secureInputType: {
            type: "null",
          },

          riskType: {
            type: "null",
          },

          options: {
            type: "null",
          },

        },
      },
    },
  ],
} as const;
