# 데모 금융사이트 D6 Playwright 전달 문서

## 1. 목적과 실행

D6는 사용자가 예금 상품을 직접 선택한 뒤 별도 다음 버튼으로 해당
상품의 상세·가입 조건 화면을 확인하는 흐름이다. 실제 예금 가입이나
금융거래는 수행하지 않는다.

```bash
cd demo/demo-bank
npm install
npm run dev -- --host 127.0.0.1 --port 5191 --strictPort
```

- 기본 URL: `http://127.0.0.1:5191`
- 상품 목록: `/deposit/products`
- 12개월 상품: `/deposit/products/deposit-12m`
- 우대 상품: `/deposit/products/deposit-preferred`
- 잘못된 상품 ID: `/deposit/products/unknown-product`

## 2. 고정 selector

기존 D5 selector는 그대로 유지한다.

| selector | 용도 |
| --- | --- |
| `#product-deposit-12m` | 12개월 상품 카드 |
| `#product-deposit-preferred` | 우대 상품 카드 |
| `#btn-select-deposit-12m` | 12개월 상품 선택 |
| `#btn-select-deposit-preferred` | 우대 상품 선택 |
| `#status-selected-deposit-product` | 선택 결과 live region |

D6에서 추가된 selector는 다음과 같다. 모든 요소는 `id`와
`data-testid`에 같은 값을 사용한다.

| selector | 용도 |
| --- | --- |
| `#btn-deposit-product-next` | 선택 상품 상세 화면으로 이동 |
| `#page-deposit-product-detail` | 상품 상세 페이지 루트 |
| `#summary-deposit-product-name` | 상품명 |
| `#summary-deposit-product-period` | 가입 기간 |
| `#summary-deposit-product-rate` | 예시 금리 |
| `#summary-deposit-product-minimum-amount` | 최소 가입 금액 |
| `#btn-deposit-product-list-back` | 상품 목록 복귀 |
| `#status-deposit-next-step` | 다음 단계 준비 상태 |

## 3. 상품 선택과 이동 예제

```ts
test('선택 후 다음 버튼으로 상품 상세에 이동한다', async ({ page }) => {
  await page.goto('/deposit/products');

  const selectButton = page.locator('#btn-select-deposit-12m');
  const nextButton = page.locator('#btn-deposit-product-next');

  await expect(nextButton).toBeDisabled();
  await selectButton.click();

  await expect(page).toHaveURL(/\/deposit\/products$/);
  await expect(selectButton).toHaveAttribute('aria-pressed', 'true');
  await expect(nextButton).toBeEnabled();

  await nextButton.click();
  await expect(page).toHaveURL(/\/deposit\/products\/deposit-12m$/);
});
```

선택 버튼만 눌렀을 때 URL은 바뀌지 않아야 한다. 다른 상품을 선택하면
기존 상품의 `aria-pressed`는 `false`, 새 상품은 `true`가 된다.

## 4. 상세 정보 검증 예제

```ts
test('선택 상품의 상세 조건과 복귀 동작을 표시한다', async ({ page }) => {
  await page.goto('/deposit/products/deposit-preferred');

  await expect(page.locator('#summary-deposit-product-name'))
    .toHaveText('우대금리 정기예금');
  await expect(page.locator('#summary-deposit-product-period'))
    .toHaveText('12개월');
  await expect(page.locator('#summary-deposit-product-rate'))
    .toContainText('연 3.50%');
  await expect(page.locator('#summary-deposit-product-minimum-amount'))
    .toHaveText('1,000,000원');
  await expect(page.locator('#status-deposit-next-step'))
    .toContainText('준비 중');

  await page.locator('#btn-deposit-product-list-back').click();
  await expect(page).toHaveURL(/\/deposit\/products$/);
});
```

브라우저 뒤로 가기도 방문 기록을 유지한다.

```ts
await page.goBack();
await expect(page).toHaveURL(/\/deposit\/products$/);
```

## 5. 잘못된 상품 ID와 제한사항

```ts
test('잘못된 상품 ID는 Not Found를 표시한다', async ({ page }) => {
  await page.goto('/deposit/products/unknown-product');
  await expect(page.locator('#page-not-found')).toBeVisible();
});
```

현재 구현에는 가입 금액 입력, 약관 동의, 비밀번호, OTP, 실제 가입,
API, WebSocket과 계좌이체 다음 단계가 없다. 표시 금리는 데모용 예시이며
실시간 금리가 아니다. Playwright 예제는 전달 문서용이며 demo-bank에
Playwright 패키지를 설치하지 않는다.
