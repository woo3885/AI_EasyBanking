# 데모 금융사이트 D7 Playwright 전달 문서

## 1. 목적과 실행

D7은 예금 상품 상세에서 선택한 상품의 가입 금액 입력 화면으로 이동해
금액을 검증하고 로컬 확인 문구를 표시하는 흐름이다. 입력 금액은
저장하거나 전송하지 않으며 실제 예금 가입과 금융거래를 수행하지 않는다.

```bash
cd demo/demo-bank
npm install
npm run dev -- --host 127.0.0.1 --port 5192 --strictPort
```

- 기본 URL: `http://127.0.0.1:5192`
- 상품 목록: `/deposit/products`
- 12개월 상품 상세: `/deposit/products/deposit-12m`
- 우대 상품 상세: `/deposit/products/deposit-preferred`
- 12개월 가입 금액: `/deposit/conditions/deposit-12m`
- 우대 상품 가입 금액: `/deposit/conditions/deposit-preferred`

## 2. D6에서 D7으로 이동

상품 상세의 `#btn-deposit-amount-start`를 누르면 같은 탭에서 해당
상품의 `/deposit/conditions/:productId` 경로로 이동한다. 브라우저 방문
기록을 유지하므로 뒤로 가기로 상품 상세 화면에 복귀할 수 있다.

```ts
await page.goto('/deposit/products/deposit-12m');
await page.locator('#btn-deposit-amount-start').click();
await expect(page).toHaveURL('/deposit/conditions/deposit-12m');
```

## 3. D7 고정 selector

기존 D1~D6 selector는 변경하지 않는다. D7 신규 요소도 `id`와
`data-testid`에 같은 값을 사용한다.

| selector | 용도 |
| --- | --- |
| `#btn-deposit-amount-start` | 상품 상세에서 금액 입력 화면으로 이동 |
| `#page-deposit-amount` | 가입 금액 페이지 루트 |
| `#summary-deposit-amount-product-name` | 선택 상품명 |
| `#summary-deposit-amount-minimum` | 상품별 최소 가입 금액 |
| `#input-deposit-amount` | 가입 금액 입력 |
| `#summary-deposit-amount-formatted` | 유효 금액의 원화 형식 표시 |
| `#status-deposit-amount-validation` | 검증 및 로컬 확인 live region |
| `#btn-deposit-amount-confirm` | 유효한 입력 금액 확인 |
| `#btn-deposit-product-detail-back` | 현재 상품 상세로 복귀 |

## 4. 초기 상태와 검증 상태

입력은 `type="text"`, `inputmode="numeric"`인 controlled input이다.
초기값은 빈 문자열이고 확인 버튼은 비활성화된다.

| 상태 | 예시 | 결과 |
| --- | --- | --- |
| `EMPTY` | 빈 문자열 | 입력 안내, 확인 버튼 비활성화 |
| `INVALID_FORMAT` | `10,000`, `1.5`, `abc` | 쉼표 없는 정수 입력 안내 |
| `NON_POSITIVE` | `0`, `-1` | 1원 이상 입력 안내 |
| `BELOW_MINIMUM` | 상품 최소 금액보다 1원 적은 값 | 상품별 최소 금액 안내 |
| `UNSAFE_INTEGER` | `9007199254740992` | 입력 가능 범위 초과 안내 |
| `VALID` | 상품 최소 금액 이상 안전 정수 | 원화 형식 표시와 확인 버튼 활성화 |

앞뒤 공백은 검증할 때 제거하지만 입력창 원문은 자동 수정하지 않는다.
소수, 쉼표, 영문, 기호와 지수 표기는 허용하지 않는다.

## 5. Playwright 검증 예제

```ts
test('12개월 상품 금액을 검증하고 로컬로 확인한다', async ({ page }) => {
  await page.goto('/deposit/conditions/deposit-12m');

  const input = page.locator('#input-deposit-amount');
  const status = page.locator('#status-deposit-amount-validation');
  const formatted = page.locator('#summary-deposit-amount-formatted');
  const confirm = page.locator('#btn-deposit-amount-confirm');

  await expect(input).toHaveValue('');
  await expect(confirm).toBeDisabled();

  await input.fill('99999');
  await expect(status).toContainText('100,000원 이상');
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(confirm).toBeDisabled();

  await input.fill('100000');
  await expect(formatted).toContainText('100,000원');
  await expect(input).toHaveAttribute('aria-invalid', 'false');
  await expect(confirm).toBeEnabled();

  const amountUrl = page.url();
  await confirm.click();
  await expect(status).toContainText('실제 가입은 진행하지 않았습니다');
  await expect(page).toHaveURL(amountUrl);
});
```

```ts
test('오류 입력을 구분한다', async ({ page }) => {
  await page.goto('/deposit/conditions/deposit-12m');
  const input = page.locator('#input-deposit-amount');
  const status = page.locator('#status-deposit-amount-validation');

  for (const value of ['0', '-1']) {
    await input.fill(value);
    await expect(status).toContainText('1원 이상');
  }

  for (const value of ['1.5', 'abc!', '100,000', '1e5']) {
    await input.fill(value);
    await expect(status).toContainText('쉼표 없이 숫자만');
  }

  await input.fill('9007199254740992');
  await expect(status).toContainText('범위를 초과');
});
```

우대 상품에서는 `999999`가 최소 금액 미만이고 `1000000`부터 유효하다.

```ts
await page.goto('/deposit/conditions/deposit-preferred');
await expect(page.locator('#summary-deposit-amount-minimum'))
  .toHaveText('1,000,000원');
```

## 6. 복귀, NotFound와 보안 경계

```ts
await page.locator('#btn-deposit-product-detail-back').click();
await expect(page).toHaveURL('/deposit/products/deposit-12m');

await page.goto('/deposit/conditions/unknown-product');
await expect(page.locator('#page-not-found')).toBeVisible();
```

`/deposit/conditions`, 잘못된 상품 ID와 추가 segment는 NotFound다. 가입
금액은 URL, `localStorage`, `sessionStorage`, 콘솔, API와 WebSocket에
포함되지 않는다. 확인 버튼은 현재 금액을 로컬로 확인할 뿐 다음 URL로
이동하거나 실제 가입을 완료하지 않는다. 약관, 비밀번호, OTP와 최종
승인은 D7 범위에 포함되지 않는다.
