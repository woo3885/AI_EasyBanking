# 데모 금융사이트 D9 Playwright 전달 문서

## 1. 목적과 실행

D9은 출금 계좌를 사용자가 직접 선택한 뒤 별도 다음 Gate를 통해 수취인
후보 화면으로 이동하고, 수취인을 직접 단일 선택·확인하는 Mock 흐름이다.
실제 계좌이체, 이체 금액 입력, API와 WebSocket은 포함하지 않는다.

```text
프로젝트: demo/demo-bank
설치: npm install
실행: npm run dev -- --host 127.0.0.1 --port 5194 --strictPort
기본 URL: http://127.0.0.1:5194
```

확정 수취인 URL은 다음과 같다.

- `/transfer/recipients/living-expense`
- `/transfer/recipients/savings`

pathname에는 공개 Mock accountId만 포함한다. 전체 계좌번호뿐 아니라
마스킹 계좌번호도 URL에 넣지 않는다.

## 2. 고정 selector

모든 selector는 `id`와 `data-testid` 값이 같다.

### 출금 계좌 화면

| selector | 역할 | 초기 상태 |
| --- | --- | --- |
| `#page-transfer-accounts` | 출금 계좌 페이지 | visible |
| `#account-living-expense` | 생활비 계좌 카드 | 미선택 |
| `#account-savings` | 저축 계좌 카드 | 미선택 |
| `#btn-select-account-living-expense` | 생활비 계좌 선택 | `aria-pressed="false"` |
| `#btn-select-account-savings` | 저축 계좌 선택 | `aria-pressed="false"` |
| `#status-selected-transfer-account` | 선택 상태 live region | 선택 계좌 없음 |
| `#btn-transfer-account-next` | 수취인 화면 이동 Gate | disabled |

### 수취인 화면

| selector | 역할 | 초기 상태 |
| --- | --- | --- |
| `#page-transfer-recipients` | 수취인 페이지 | visible |
| `#summary-transfer-source-account` | URL로 확인한 Mock 출금 계좌 | 계좌 별칭과 마스킹 정보 |
| `#recipient-hong-gildong` | 홍길동 가족 Mock 카드 | 미선택 |
| `#btn-select-recipient-hong-gildong` | 홍길동 선택 | `aria-pressed="false"` |
| `#recipient-demo-saved` | 데모 수취인 A 카드 | 미선택 |
| `#btn-select-recipient-demo-saved` | 데모 수취인 A 선택 | `aria-pressed="false"` |
| `#status-selected-transfer-recipient` | 수취인 선택 live region | 선택 없음 |
| `#status-confirmed-transfer-recipient` | 로컬 확인 live region | 빈 상태 |
| `#btn-transfer-recipient-confirm` | 수취인 확인 Gate | disabled |
| `#btn-transfer-account-back` | 계좌 목록 복귀 | enabled |

## 3. 출금 계좌 다음 Gate

계좌 선택 버튼은 선택 상태만 변경하고 URL을 이동하지 않는다. 별도 다음
버튼만 `window.location.assign`으로 수취인 URL을 연다.

```ts
test('출금 계좌를 선택한 뒤 수취인 화면으로 이동한다', async ({ page }) => {
  await page.goto('/transfer/accounts');
  const selectAccount = page.locator(
    '#btn-select-account-living-expense'
  );
  const next = page.locator('#btn-transfer-account-next');

  await expect(next).toBeDisabled();
  const accountUrl = page.url();
  await selectAccount.click();

  await expect(selectAccount).toHaveAttribute('aria-pressed', 'true');
  await expect(next).toBeEnabled();
  await expect(page).toHaveURL(accountUrl);

  await next.click();
  await expect(page).toHaveURL(
    /\/transfer\/recipients\/living-expense$/
  );
});
```

다른 계좌를 선택하면 이전 선택 버튼은 `aria-pressed="false"`가 되고 새
계좌만 `true`가 된다.

## 4. 수취인 단일 선택과 확인 Gate

```ts
test('수취인을 직접 선택하고 로컬로 확인한다', async ({ page }) => {
  await page.goto('/transfer/recipients/living-expense');
  const family = page.locator('#btn-select-recipient-hong-gildong');
  const saved = page.locator('#btn-select-recipient-demo-saved');
  const confirm = page.locator('#btn-transfer-recipient-confirm');
  const confirmation = page.locator(
    '#status-confirmed-transfer-recipient'
  );

  await expect(family).toHaveAttribute('aria-pressed', 'false');
  await expect(saved).toHaveAttribute('aria-pressed', 'false');
  await expect(confirm).toBeDisabled();

  await family.click();
  await expect(family).toHaveAttribute('aria-pressed', 'true');
  await expect(confirm).toBeEnabled();

  const recipientUrl = page.url();
  await confirm.click();
  await expect(confirmation).toContainText('실제 송금은 진행되지 않');
  await expect(confirmation).toContainText('이체 금액 입력은 후속 단계');
  await expect(page).toHaveURL(recipientUrl);

  await saved.click();
  await expect(family).toHaveAttribute('aria-pressed', 'false');
  await expect(saved).toHaveAttribute('aria-pressed', 'true');
  await expect(confirmation).toBeEmpty();
});
```

같은 수취인을 다시 선택하면 선택은 유지된다. 수취인 확인은 로컬 안내만
변경하며 URL 이동, 금액 화면 이동과 송금을 실행하지 않는다.

## 5. 직접 접근, 복귀와 NotFound

알려진 Mock accountId URL은 직접 접근할 수 있다. 화면은 “URL에서 확인된
Mock 출금 계좌”라고 표시하며 이전 계좌 화면에서 선택을 완료했다고 주장하지
않는다.

```ts
for (const accountId of ['living-expense', 'savings']) {
  await page.goto(`/transfer/recipients/${accountId}`);
  await expect(page.locator('#page-transfer-recipients')).toBeVisible();
}

for (const path of [
  '/transfer/recipients',
  '/transfer/recipients/unknown-account',
  '/transfer/recipients/living-expense/extra'
]) {
  await page.goto(path);
  await expect(page.locator('#page-not-found')).toBeVisible();
}
```

`#btn-transfer-account-back`은 `/transfer/accounts`로 이동한다. `assign`으로
이동하므로 브라우저 자체 뒤로 가기도 가능하다. 페이지가 다시 렌더링되면
이전 로컬 선택 상태 복원은 보장하지 않는다.

## 6. Mock 데이터와 보안 경계

- 홍길동과 데모 수취인 A는 실제 고객이 아닌 명시적인 Mock 후보다.
- 전화번호, 이메일, 주민등록번호와 전체 계좌번호는 없다.
- 계좌 표시는 `Mock 계좌 · 끝자리 **56`처럼 실제 원문을 재현하지 않는다.
- URL에는 `living-expense` 또는 `savings` 공개 Mock accountId만 들어간다.
- query, `localStorage`, `sessionStorage`, `fetch`, WebSocket과 로그를 사용하지 않는다.
- 수취인 직접 등록, 검색, 주소록 API와 실제 송금을 제공하지 않는다.
- 이체 금액 입력은 D10 후속 구현 범위다.

Playwright는 개발자 B의 외부 환경에서 실행한다. demo-bank 프로젝트에는
Playwright 또는 새 테스트 패키지를 설치하지 않는다.
