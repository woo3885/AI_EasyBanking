# 데모 금융사이트 D5 Playwright 전달 문서

## 1. 실행 정보

- 프로젝트 경로: `demo/demo-bank`
- 설치 명령: `npm install`
- 개발 서버 명령:
  `npm run dev -- --host 127.0.0.1 --port 5190 --strictPort`
- 기본 URL: `http://127.0.0.1:5190`

접속 URL은 다음과 같다.

- `/`: 메인 업무 선택
- `/deposit/products`: 예금 상품 선택
- `/transfer/accounts`: 출금 계좌 선택

Playwright 설정에서 `baseURL`을 위 기본 URL로 지정하면 예제처럼 상대
경로를 사용할 수 있다.

## 2. 고정 selector

모든 고정 요소는 `id`와 동일한 `data-testid`를 사용한다. Playwright
계약에서는 표시 순서, CSS 클래스와 `nth-child` 대신 아래 ID를 사용한다.

### 메인 화면

| selector | 요소 용도 | 클릭 가능 | 기대 상태 |
| --- | --- | --- | --- |
| `#page-home` | 메인 페이지 루트 | 아니오 | 메인 화면에서 visible |
| `#btn-start-deposit` | 예금 업무 시작 | 예 | 클릭 후 `/deposit/products` |
| `#btn-start-transfer` | 이체 업무 시작 | 예 | 클릭 후 `/transfer/accounts` |

### 예금 상품 화면

| selector | 요소 용도 | 클릭 가능 | 기대 상태 |
| --- | --- | --- | --- |
| `#page-deposit-products` | 예금 상품 페이지 루트 | 아니오 | 예금 화면에서 visible |
| `#product-deposit-12m` | 12개월 정기예금 카드 | 아니오 | 상품 정보와 선택 상태 표시 |
| `#product-deposit-preferred` | 우대금리 정기예금 카드 | 아니오 | 상품 정보와 선택 상태 표시 |
| `#btn-select-deposit-12m` | 12개월 상품 선택 | 예 | 미선택 `false`, 선택 후 `aria-pressed="true"` |
| `#btn-select-deposit-preferred` | 우대금리 상품 선택 | 예 | 미선택 `false`, 선택 후 `aria-pressed="true"` |
| `#status-selected-deposit-product` | 선택 상품 상태 | 아니오 | 초기 미선택, 클릭 후 상품명 표시 |

### 출금 계좌 화면

| selector | 요소 용도 | 클릭 가능 | 기대 상태 |
| --- | --- | --- | --- |
| `#page-transfer-accounts` | 출금 계좌 페이지 루트 | 아니오 | 이체 화면에서 visible |
| `#account-living-expense` | 생활비 계좌 카드 | 아니오 | 마스킹 계좌 정보와 선택 상태 표시 |
| `#account-savings` | 저축 계좌 카드 | 아니오 | 마스킹 계좌 정보와 선택 상태 표시 |
| `#btn-select-account-living-expense` | 생활비 계좌 선택 | 예 | 미선택 `false`, 선택 후 `aria-pressed="true"` |
| `#btn-select-account-savings` | 저축 계좌 선택 | 예 | 미선택 `false`, 선택 후 `aria-pressed="true"` |
| `#status-selected-transfer-account` | 선택 계좌 상태 | 아니오 | 초기 미선택, 클릭 후 계좌 별칭 표시 |

## 3. 예금 상품 선택 예제

```ts
test('예금 상품을 선택할 수 있다', async ({ page }) => {
  await page.goto('/');

  await page.locator('#btn-start-deposit').click();
  await expect(page).toHaveURL(/\/deposit\/products$/);

  const selectButton = page.locator('#btn-select-deposit-12m');
  await selectButton.click();

  await expect(selectButton).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.locator('#status-selected-deposit-product')
  ).toContainText('12개월 정기예금이 선택되었습니다.');
});
```

다른 상품을 선택하면 이전 상품의 `aria-pressed`는 `false`가 되고 새로
선택한 상품만 `true`가 된다.

## 4. 출금 계좌 선택 예제

```ts
test('출금 계좌를 선택할 수 있다', async ({ page }) => {
  await page.goto('/');

  await page.locator('#btn-start-transfer').click();
  await expect(page).toHaveURL(/\/transfer\/accounts$/);

  const selectButton = page.locator(
    '#btn-select-account-living-expense'
  );
  await selectButton.click();

  await expect(selectButton).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.locator('#status-selected-transfer-account')
  ).toContainText('생활비 계좌가 선택되었습니다.');
});
```

다른 계좌를 선택하면 이전 계좌의 `aria-pressed`는 `false`가 되고 새로
선택한 계좌만 `true`가 된다. 상태 문구에는 계좌 별칭만 사용하며 전체
계좌번호는 포함하지 않는다.

## 5. 설치 범위와 제한 사항

위 Playwright 코드는 개발자 B에게 전달하는 문서용 예제다.
`demo/demo-bank` 프로젝트에는 Playwright 또는 테스트 패키지를 설치하지
않는다.

현재 제한 사항은 다음과 같다.

- 상품 선택 후 다음 화면이 없다. 예금 전체 흐름은 D6 이후 구현한다.
- 계좌 선택 후 다음 화면이 없다. 이체 전체 흐름은 D9 이후 구현한다.
- 실제 예금 가입과 금융거래를 수행하지 않는다.
- 비밀번호, OTP 등 민감정보 입력 화면이 없다.
- API와 WebSocket 통신이 없다.
