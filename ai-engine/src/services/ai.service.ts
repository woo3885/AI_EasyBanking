import { geminiClient } from "../clients/gemini.client.js";
import { env } from "../config/env.js";
import { AiCache } from "../stability/aiCache.js";
import { executeWithRetry } from "../stability/retryPolicy.js";

export interface GenerateTextInput {
  prompt: string;
}

export type AiResponseSource =
  | "GEMINI"
  | "CACHE"
  | "FALLBACK";

export interface GenerateTextResult {
  model: string;
  text: string;
  source: AiResponseSource;
}

const responseCache = new AiCache<GenerateTextResult>(
  5 * 60 * 1000,
  100,
);

function createCacheKey(prompt: string): string {
  return `${env.geminiModel}:${prompt}`;
}

function createFallbackResult(): GenerateTextResult {
  return {
    model: env.geminiModel,
    text:
      "현재 AI 응답을 생성하기 어렵습니다. 잠시 후 다시 시도하거나 필요한 작업을 직접 선택해주세요.",
    source: "FALLBACK",
  };
}

export class AiService {
  async generateText(
    input: GenerateTextInput,
  ): Promise<GenerateTextResult> {
    const prompt = input.prompt.trim();

    if (!prompt) {
      throw new Error(
        "[AI Engine] prompt는 비어 있을 수 없습니다.",
      );
    }

    const cacheKey = createCacheKey(prompt);
    const cachedResult = responseCache.get(cacheKey);

    if (cachedResult) {
      return {
        ...cachedResult,
        source: "CACHE",
      };
    }

    try {
      const response = await executeWithRetry(
        () =>
          geminiClient.models.generateContent({
            model: env.geminiModel,
            contents: prompt,
          }),
        {
          maxAttempts: 3,
          timeoutMs: 10_000,
          baseDelayMs: 1_000,
        },
      );

      const text = response.text?.trim();

      if (!text) {
        throw new Error(
          "[AI Engine] Gemini 응답 내용이 비어 있습니다.",
        );
      }

      const result: GenerateTextResult = {
        model: env.geminiModel,
        text,
        source: "GEMINI",
      };

      responseCache.set(cacheKey, result);

      return result;
    } catch (error) {
      console.error(
        "[AI Engine] Gemini 요청 최종 실패. Fallback을 반환합니다.",
        error,
      );

      const cachedResultAfterFailure =
        responseCache.get(cacheKey);

      if (cachedResultAfterFailure) {
        return {
          ...cachedResultAfterFailure,
          source: "CACHE",
        };
      }

      return createFallbackResult();
    }
  }
}

export const aiService = new AiService();