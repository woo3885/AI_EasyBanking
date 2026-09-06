# 데모 금융사이트 D10 Playwright 전달 문서

## 1. 목적과 실행

D10은 사용자가 Mock 수취인을 선택·확인한 뒤 별도 Gate로 이체 금액
화면에 이동하고, 계좌별 Mock 잔액 안에서 금액을 직접 입력·검증하는
흐름이다. 확인은 로컬 안내만 갱신하며 실제 잔액 차감과 송금은 없다.

```text
프로젝트: demo/demo-bank
설치: npm install
실행: npm run dev -- --host 127.0.0.1 --port 5195 --strictPort
기본 URL: http://127.0.0.1:5195
```

## 2. URL 계약

D1 개념 경로 `/transfer/amount`를 다음처럼 구체화한다.

```text
/transfer/amount/:accountId/:recipientId
```

정상 URL:

- `/transfer/amount/living-expense/hong-gildong`
- `/transfer/amount/living-expense/demo-saved`
- `/transfer/amount/savings/hong-gildong`
- `/transfer/amount/savings/demo-saved`

정상 URL의 trailing slash는 허용한다. pathname에는 공개 Mock accountId와
recipientId만 포함한다. 이체 금액, 잔액, 계좌번호와 수취인 금융정보는
URL과 query에 포함하지 않는다.

다음은 NotFound 화면 대상이다.

- `/transfer/amount`
- `/transfer/amount/living-expense`
- `/transfer/amount/unknown-account/hong-gildong`
- `/transfer/amount/living-expense/unknown-recipient`
- `/transfer/amount/living-expense/hong-gildong/extra`
- canonical path와 일치하지 않는 encoding

정상 URL 직접 접근은 가능하지만 앞 단계 선택·확인이 완료됐다고 주장하지
않고 “URL에서 확인된 Mock” 문맥만 표시한다.

## 3. 고정 selector

모든 자동화 대상은 `id`와 `data-testid`가 같다.

### 수취인 화면

| selector | 역할 | 초기 상태 |
| --- | --- | --- |
| `#btn-transfer-recipient-confirm` | 기존 수취인 로컬 확인 | disabled |
| `#btn-transfer-amount-start` | 금액 입력 화면 이동 Gate | disabled |
| `#status-confirmed-transfer-recipient` | 수취인 확인 live region | 빈 상태 |

### 이체 금액 화면

| selector | 역할 |
| --- | --- |
| `#page-transfer-amount` | 페이지 루트 |
| `#summary-transfer-amount-source-account` | URL로 확인한 Mock 출금 계좌 |
| `#summary-transfer-amount-balance` | 출금 가능 Mock 잔액 |
| `#summary-transfer-amount-recipient` | URL로 확인한 Mock 수취인 |
| `#input-transfer-amount` | 이체 금액 입력 |
| `#summary-transfer-amount-formatted` | 유효 금액 원화 표시 |
| `#status-transfer-amount-validation` | 검증 live region |
| `#status-confirmed-transfer-amount` | 로컬 확인 live region |
| `#btn-transfer-amount-confirm` | 유효한 금액 로컬 확인 |
| `#btn-transfer-recipient-back` | 현재 계좌의 수취인 화면 복귀 |

## 4. 수취인 확인 후 이동 Gate

수취인 선택 버튼은 선택 상태만 변경한다. 기존 확인 버튼은 로컬 확인만
수행하고 URL을 이동하지 않는다. 확인된 recipientId와 현재 선택이 같을
때만 별도 금액 입력 버튼이 활성화된다.

```ts
test('수취인 확인 후에만 금액 입력 화면으로 이동한다', async ({ page }) => {
  await page.goto('/transfer/recipients/living-expense');
  const family = page.locator('#btn-select-recipient-hong-gildong');
  const saved = page.locator('#btn-select-recipient-demo-saved');
  const confirm = page.locator('#btn-transfer-recipient-confirm');
  const amountStart = page.locator('#btn-transfer-amount-start');

  await expect(amountStart).toBeDisabled();
  await family.click();
  await expect(amountStart).toBeDisabled();
  await confirm.click();
  await expect(amountStart).toBeEnabled();

  await saved.click();
  await expect(amountStart).toBeDisabled();

  await confirm.click();
  await amountStart.click();
  await expect(page).toHaveURL(
    /\/transfer\/amount\/living-expense\/demo-saved$/
  );
});
```

같은 수취인을 다시 누르면 기존 선택과 확인 상태를 유지할 수 있다. 다른
수취인으로 바꾸면 확인 문구와 Gate가 초기화되어 이전 recipientId로 이동할
수 없다.

## 5. 입력과 검증 계약

입력은 `type="text"`, `inputMode="numeric"`이며 자동 focus와 자동 쉼표
삽입을 사용하지 않는다. 앞뒤 공백은 검증할 때만 제거하고 입력 원문은
수정하거나 clamp하지 않는다. 선행 0은 허용하며 원화 표시는 숫자 값으로
정규화한다.

검증 순서와 상태:

| 순서 | 상태 | 기준 | `aria-invalid` | 확인 버튼 |
| ---: | --- | --- | --- | --- |
| 1 | `EMPTY` | 빈 값 또는 공백 | `false` | disabled |
| 2 | `INVALID_FORMAT` | 정수 문자열 아님 | `true` | disabled |
| 3 | `NON_POSITIVE` | 0 이하 | `true` | disabled |
| 4 | `UNSAFE_INTEGER` | JavaScript 안전 정수 초과 | `true` | disabled |
| 5 | `EXCEEDS_BALANCE` | 계좌별 Mock 잔액 초과 | `true` | disabled |
| 6 | `VALID` | 나머지 양의 안전 정수 | `false` | enabled |

계좌별 기준:

- `living-expense`: `2,500,000원`
- `savings`: `10,000,000원`

수수료, 일일 한도와 1회 한도는 규격이 없어 추가하지 않는다.

## 6. 금액 입력 Playwright 예제

```ts
test('생활비 계좌 잔액 경계와 로컬 확인을 검증한다', async ({ page }) => {
  await page.goto('/transfer/amount/living-expense/hong-gildong');
  const input = page.locator('#input-transfer-amount');
  const formatted = page.locator('#summary-transfer-amount-formatted');
  const validation = page.locator('#status-transfer-amount-validation');
  const confirmation = page.locator('#status-confirmed-transfer-amount');
  const confirm = page.locator('#btn-transfer-amount-confirm');

  await expect(input).toHaveValue('');
  await expect(input).toHaveAttribute('aria-invalid', 'false');
  await expect(confirm).toBeDisabled();

  await input.fill('2500001');
  await expect(validation).toContainText('2,500,000원 이하');
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(confirm).toBeDisabled();

  await input.fill('2500000');
  await expect(formatted).toContainText('2,500,000원');
  await expect(confirm).toBeEnabled();

  const amountUrl = page.url();
  await confirm.click();
  await expect(confirmation).toContainText('데모 이체 금액');
  await expect(confirmation).toContainText('실제 송금은 진행되지 않았습니다');
  await expect(page).toHaveURL(amountUrl);

  await input.fill('100000');
  await expect(confirmation).toBeEmpty();
});
```

오류 입력은 `0`, `-1`, `1.5`, `1,000`, `abc`, `+1`, `1e3`,
`9007199254740992`를 각각 검증한다. `000100`은 유효하며 입력 원문은
유지되고 원화 영역은 `100원`을 표시한다. `Number.MAX_SAFE_INTEGER`는
안전 정수지만 두 Mock 계좌 잔액을 초과하므로 `EXCEEDS_BALANCE`다.

## 7. 권장 35개 시나리오

### 수취인 Gate와 URL 보안

1. 수취인 선택 전 금액 입력 시작 버튼 disabled
2. 수취인 선택만 한 상태에서도 disabled
3. 수취인 확인 후 enabled
4. 수취인을 변경하면 다시 disabled
5. 금액 화면 URL 이동
6. URL에 계좌번호와 금액 없음

### 금액 초기·오류·경계 상태

7. 정상 URL 직접 접근
8. 정상 URL trailing slash 접근
9. 초기 input 빈 값
10. 초기 확인 버튼 disabled
11. 빈 값
12. 0
13. 음수
14. 소수
15. 쉼표
16. 영문
17. 기호
18. 지수 표기
19. 안전 정수 초과
20. 잔액보다 1원 큰 값
21. 잔액과 정확히 같은 값
22. 유효한 금액
23. `ko-KR` 원화 표시
24. 확인 버튼 활성화

### 로컬 확인과 이동

25. 확인 후 로컬 안내
26. 확인 후 URL 유지
27. 입력 변경 시 확인 안내 초기화
28. 잔액 차감 없음
29. 수취인 화면 복귀
30. browser back

### 오류 경로와 통신 부재

31. unknown accountId
32. unknown recipientId
33. 누락 segment
34. 추가 segment
35. API·WebSocket·실제 송금 없음

## 8. 접근성과 보안 경계

- 실제 label과 input을 연결하고 원화 표시 및 검증 영역을
  `aria-describedby`로 참조한다.
- 오류 상태는 `aria-invalid="true"`와 텍스트 안내를 함께 사용한다.
- 검증과 확인 영역은 `role="status"`, `aria-live="polite"`다.
- 실제 button과 disabled 속성을 사용하고 최소 높이 52px 및 기존
  focus-visible 표시를 유지한다.
- 금액은 컴포넌트 로컬 상태에만 있고 URL, query, `localStorage`,
  `sessionStorage`, 로그, API와 WebSocket에 전달하지 않는다.
- 전체 계좌번호, 실제 고객정보, 비밀번호, OTP와 주민등록번호를 포함하지
  않는다.
- 실제 잔액 변경, 송금, 보안 입력과 최종 승인은 D10 범위가 아니다.

Playwright는 개발자 B의 외부 환경에서 실행한다. demo-bank 프로젝트에는
Playwright나 테스트 패키지를 설치하지 않는다.
