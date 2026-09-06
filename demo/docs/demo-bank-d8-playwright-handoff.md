# 데모 금융사이트 D8 Playwright 전달 문서

## 1. 목적과 실행

D8은 D7 가입 금액을 로컬로 확인한 뒤 상품별 약관 화면으로 이동해 필수
약관과 선택 약관을 사용자가 개별 선택하는 흐름이다. 전체 동의, 자동
선택, 실제 예금 가입, 보안 입력, API와 WebSocket은 제공하지 않는다.

```bash
cd demo/demo-bank
npm install
npm run dev -- --host 127.0.0.1 --port 5193 --strictPort
```

- 기본 URL: `http://127.0.0.1:5193`
- 12개월 가입 금액: `/deposit/conditions/deposit-12m`
- 우대 상품 가입 금액: `/deposit/conditions/deposit-preferred`
- 12개월 약관: `/deposit/terms/deposit-12m`
- 우대 상품 약관: `/deposit/terms/deposit-preferred`

## 2. 신규 고정 selector

기존 D1~D7 selector는 변경하지 않는다. 신규 요소도 `id`와
`data-testid`에 같은 값을 사용한다.

| selector | 용도 |
| --- | --- |
| `#btn-deposit-terms-start` | 금액 확인 후 약관 화면으로 이동 |
| `#page-deposit-terms` | 약관 페이지 루트 |
| `#summary-deposit-terms-product-name` | 선택 상품명 |
| `#term-service-required` | 필수 서비스 이용약관 항목 |
| `#checkbox-term-service-required` | 필수 서비스 이용약관 checkbox |
| `#term-privacy-required` | 필수 개인정보 수집·이용 항목 |
| `#checkbox-term-privacy-required` | 필수 개인정보 수집·이용 checkbox |
| `#term-marketing-optional` | 선택 마케팅 정보 수신 항목 |
| `#checkbox-term-marketing-optional` | 선택 마케팅 정보 수신 checkbox |
| `#status-deposit-terms-selection` | 선택 개수와 필수 약관 Gate 상태 |
| `#status-deposit-terms-confirmation` | 로컬 확인 결과 live region |
| `#btn-deposit-terms-confirm` | 약관 선택 로컬 확인 |
| `#btn-deposit-amount-back` | 현재 상품의 금액 입력 화면으로 복귀 |

## 3. D7에서 D8로 이동

금액 확인 전 약관 이동 버튼은 비활성화된다. 유효한 금액을 입력하고 기존
확인 버튼을 누른 뒤에만 활성화되며 입력값을 바꾸면 다시 비활성화된다.

```ts
test('금액 확인 후 약관 화면으로 이동한다', async ({ page }) => {
  await page.goto('/deposit/conditions/deposit-12m');

  const input = page.locator('#input-deposit-amount');
  const amountConfirm = page.locator('#btn-deposit-amount-confirm');
  const termsStart = page.locator('#btn-deposit-terms-start');

  await expect(termsStart).toBeDisabled();
  await input.fill('100000');
  await expect(termsStart).toBeDisabled();

  await amountConfirm.click();
  await expect(termsStart).toBeEnabled();

  await input.fill('200000');
  await expect(termsStart).toBeDisabled();
  await amountConfirm.click();
  await termsStart.click();
  await expect(page).toHaveURL('/deposit/terms/deposit-12m');
});
```

금액은 약관 URL, query, 브라우저 저장소와 약관 화면에 전달되지 않는다.

## 4. 초기 상태와 전체 동의 부재

```ts
test('모든 약관은 미선택으로 시작하고 전체 동의가 없다', async ({ page }) => {
  await page.goto('/deposit/terms/deposit-12m');

  const checkboxes = page.locator('#page-deposit-terms input[type="checkbox"]');
  await expect(checkboxes).toHaveCount(3);
  for (let index = 0; index < 3; index += 1) {
    await expect(checkboxes.nth(index)).not.toBeChecked();
  }

  await expect(page.getByText('전체 동의', { exact: true })).toHaveCount(0);
  await expect(page.locator('#btn-deposit-terms-confirm')).toBeDisabled();
});
```

화면의 안내 문장에 전체 동의 기능이 없다는 설명은 표시되지만 전체 동의
checkbox나 button은 존재하지 않는다.

## 5. 필수 약관 Gate와 선택 약관

```ts
test('필수 약관만 확인 버튼 활성화 조건에 반영한다', async ({ page }) => {
  await page.goto('/deposit/terms/deposit-12m');

  const service = page.locator('#checkbox-term-service-required');
  const privacy = page.locator('#checkbox-term-privacy-required');
  const marketing = page.locator('#checkbox-term-marketing-optional');
  const confirm = page.locator('#btn-deposit-terms-confirm');

  await service.check();
  await expect(confirm).toBeDisabled();

  await privacy.check();
  await expect(confirm).toBeEnabled();

  await marketing.check();
  await expect(confirm).toBeEnabled();
  await marketing.uncheck();
  await expect(confirm).toBeEnabled();

  await service.uncheck();
  await expect(confirm).toBeDisabled();
});
```

필수 약관 두 개는 실제 `required` checkbox다. 선택 약관은 개별 선택할 수
있지만 Gate에는 영향을 주지 않는다.

## 6. 로컬 확인과 변경 초기화

```ts
test('약관을 로컬로 확인하고 선택 변경 시 확인을 초기화한다', async ({ page }) => {
  await page.goto('/deposit/terms/deposit-12m');
  const service = page.locator('#checkbox-term-service-required');
  const privacy = page.locator('#checkbox-term-privacy-required');
  const marketing = page.locator('#checkbox-term-marketing-optional');
  const confirmation = page.locator('#status-deposit-terms-confirmation');
  const confirm = page.locator('#btn-deposit-terms-confirm');

  await service.check();
  await privacy.check();
  const termsUrl = page.url();
  await confirm.click();

  await expect(confirmation).toContainText('필수 약관 선택을 확인했습니다');
  await expect(confirmation).toContainText('선택 약관은 선택하지 않았습니다');
  await expect(confirmation).toContainText('실제 예금 가입은 진행되지 않았');
  await expect(page).toHaveURL(termsUrl);

  await marketing.check();
  await expect(confirmation).toHaveText('약관 선택 확인 전입니다.');
});
```

확인은 URL을 이동하거나 비밀번호 화면, API, WebSocket과 실제 가입을
실행하지 않는다.

## 7. 상품별 경로, NotFound와 복귀

```ts
for (const productId of ['deposit-12m', 'deposit-preferred']) {
  await page.goto(`/deposit/terms/${productId}`);
  await expect(page.locator('#page-deposit-terms')).toBeVisible();
}

for (const path of [
  '/deposit/terms',
  '/deposit/terms/unknown-product',
  '/deposit/terms/deposit-12m/extra'
]) {
  await page.goto(path);
  await expect(page.locator('#page-not-found')).toBeVisible();
}
```

```ts
await page.goto('/deposit/terms/deposit-12m');
await page.locator('#btn-deposit-amount-back').click();
await expect(page).toHaveURL('/deposit/conditions/deposit-12m');
await expect(page.locator('#input-deposit-amount')).toHaveValue('');
```

금액 화면으로 복귀하면 새 페이지가 렌더링되므로 이전 금액은 초기화될 수
있다. 브라우저 자체 뒤로 가기도 가능하지만 금액 상태 복원을 계약으로
보장하지 않는다.

## 8. 보안과 D8 경계

- 약관은 사용자가 각각 직접 선택하고 페이지가 자동 체크하지 않는다.
- 전체 동의 요소와 AI 약관 선택은 없다.
- 상품 ID 외에 금액이나 사용자 데이터는 URL에 포함하지 않는다.
- `localStorage`, `sessionStorage`, `fetch`, WebSocket과 로그를 사용하지 않는다.
- 실제 법률 약관 전문, 비밀번호, OTP와 계좌번호 원문을 포함하지 않는다.
- 실제 예금 가입, 보안 입력과 최종 승인은 후속 범위다.
