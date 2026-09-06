import {
  AiTimeoutError,
  executeWithRetry,
} from "../stability/retryPolicy.js";

async function test429Retry() {
  console.log("\n========================================");
  console.log("429 재시도 테스트");
  console.log("========================================");

  let attempts = 0;

  const result = await executeWithRetry(
    async () => {
      attempts += 1;

      console.log(`호출 시도: ${attempts}`);

      if (attempts < 3) {
        const error = new Error("Too Many Requests") as Error & {
          status: number;
        };

        error.status = 429;
        throw error;
      }

      return "SUCCESS";
    },
    {
      maxAttempts: 3,
      timeoutMs: 1000,
      baseDelayMs: 100,
    },
  );

  console.log("최종 결과:", result);
  console.log("총 호출 횟수:", attempts);
}

async function testTimeoutRetry() {
  console.log("\n========================================");
  console.log("Timeout 재시도 테스트");
  console.log("========================================");

  let attempts = 0;

  try {
    await executeWithRetry(
      async () => {
        attempts += 1;

        console.log(`호출 시도: ${attempts}`);

        return await new Promise<string>((resolve) => {
          setTimeout(() => {
            resolve("늦게 도착한 응답");
          }, 500);
        });
      },
      {
        maxAttempts: 3,
        timeoutMs: 100,
        baseDelayMs: 100,
      },
    );
  } catch (error) {
    console.log("최종 실패 확인");

    if (error instanceof AiTimeoutError) {
      console.log("Timeout 오류 정상 감지");
    } else {
      console.log("예상하지 못한 오류:", error);
    }
  }

  console.log("총 호출 횟수:", attempts);
}

async function testFinalFailure() {
  console.log("\n========================================");
  console.log("최종 실패 테스트");
  console.log("========================================");

  let attempts = 0;

  try {
    await executeWithRetry(
      async () => {
        attempts += 1;

        console.log(`호출 시도: ${attempts}`);

        const error = new Error("Server Error") as Error & {
          status: number;
        };

        error.status = 500;
        throw error;
      },
      {
        maxAttempts: 3,
        timeoutMs: 1000,
        baseDelayMs: 100,
      },
    );
  } catch {
    console.log("최대 재시도 후 최종 실패 처리됨");
  }

  console.log("총 호출 횟수:", attempts);
}

async function runTests() {
  await test429Retry();
  await testTimeoutRetry();
  await testFinalFailure();
}

runTests();