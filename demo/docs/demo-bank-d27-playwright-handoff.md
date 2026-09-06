# Demo Bank D27 Playwright 인계 규격

## 목적과 범위

D27은 정기예금 시나리오의 최종 확인·거절·Demo 완료 DOM 계약을 제공한다.
실제 금융기관 가입, 인증, 계좌 잔액 변경, 거래번호 생성 또는 영수증 발급은
수행하지 않는다.

## 지원 URL

| 화면 | URL |
| --- | --- |
| 최종 확인 | `/deposit/confirmation/deposit-12m` |
| 최종 확인 | `/deposit/confirmation/deposit-preferred` |
| Demo 완료 | `/deposit/completed/deposit-12m` |
| Demo 완료 | `/deposit/completed/deposit-preferred` |

알려진 상품 ID만 지원한다. 누락·unknown ID와 추가 segment는 NotFound로
처리한다. 직접 URL 접근은 DOM 확인용이며 선행 약관·보안 입력·승인을
증명하지 않는다.

## 최종 확인 DOM 계약

페이지 루트는 `#page-deposit-confirmation`이다. 요약은 다음 구조를 사용한다.

```html
<dl
  id="summary-deposit-confirmation"
  data-testid="summary-deposit-confirmation"
  data-ddd-confirmation-summary="true"
>
  <div data-ddd-summary-id="product-name"><dt>상품명</dt><dd>...</dd></div>
  <div data-ddd-summary-id="deposit-amount"><dt>가입 금액</dt><dd>1,000,000원</dd></div>
  <div data-ddd-summary-id="deposit-period"><dt>가입 기간</dt><dd>...</dd></div>
</dl>
```

`data-ddd-summary-id`의 순서는 `product-name`, `deposit-amount`,
`deposit-period`로 고정한다. 상품명과 기간은 현재 URL의 실제 공개 Mock 상품
데이터에서 가져온다.

## 최종 승인·거절 Gate

- `#checkbox-final-confirmation`: 초기 미선택 native checkbox, Demo 내용 확인 표시용
- `#btn-final-approve`: 초기 enabled native button
- `#btn-final-cancel`: 승인하지 않고 메인으로 복귀하는 native button
- `#status-deposit-final-approval`: `role="status"`, `aria-live="polite"`
- 승인 버튼: `data-ddd-policy="final-confirmation"`

Demo checkbox는 승인 버튼의 활성화 조건이 아니며 선택만으로
승인, navigation, API 또는 금융 Action을 실행하지 않는다.
Production 통합에서는 C가 enabled approve target을 발견하면 일반
Browser Action을 중단하고 `REQUEST_FINAL_CONFIRMATION`을 반환한다.
Frontend `FinalConfirmationPanel`의 checkbox 선택과 별도 approve 요청을
Backend가 검증한 뒤에만 pending final CLICK을 exactly-once로 실행한다.
거절은 pending CLICK을 실행하지 않고 완료 URL로도 이동하지 않는다.

## Playwright 확인 예시

```ts
await page.goto('/deposit/confirmation/deposit-12m');

const summary = page.locator('[data-ddd-confirmation-summary="true"]');
await expect(summary.locator('[data-ddd-summary-id]')).toHaveCount(3);
await expect(page.getByTestId('checkbox-final-confirmation')).not.toBeChecked();
await expect(page.getByTestId('btn-final-approve')).toBeEnabled();
await expect(page).toHaveURL(/\/deposit\/confirmation\/deposit-12m$/);

// Production에서는 Frontend 승인 후 Backend pending CLICK이 실행한다.
// 아래 직접 click은 Demo DOM·navigation 계약만 검증한다.
await page.getByTestId('btn-final-approve').click();
await expect(page).toHaveURL(/\/deposit\/completed\/deposit-12m$/);
await expect(page.getByTestId('page-deposit-completion')).toBeVisible();
```

거절 경로는 별도 context 또는 페이지 재진입 후 확인한다.

```ts
await page.goto('/deposit/confirmation/deposit-12m');
await page.getByTestId('btn-final-cancel').click();
await expect(page).toHaveURL(/\/$/);
await expect(page.getByTestId('page-home')).toBeVisible();
```

## 자동화·보안 원칙

- C는 Demo checkbox를 자동 선택하지 않고 final target을 자동 CLICK하지
  않는다.
- `data-ddd-policy="final-confirmation"`을 만나면 일반 Browser Action 실행을
  중단하고 사용자 승인을 기다린다.
- Backend는 Frontend approve 전에 pending CLICK을 실행하지 않으며
  approve·reject idempotency와 frame-bound 검증을 유지한다.
- 비밀번호, OTP, 인증정보, 계좌번호 원문을 DOM, URL, storage, screenshot,
  trace, video와 로그에 기록하지 않는다.
- 요약 항목과 selector에 보안 입력 완료·승인 상태를 직렬화하지 않는다.
- Demo 완료 화면은 실제 금융거래 성공으로 해석하지 않는다.

## 수동 검증 항목

- Tab으로 checkbox, 거절, 승인 버튼에 순서대로 접근 가능한지 확인한다.
- checkbox 미선택 상태에서도 승인 버튼이 enabled인지 확인한다.
- Demo 직접 확인에서 승인 버튼을 Enter 또는 Space로 실행할 수
  있는지 확인한다. 이 검증은 Frontend 승인·Backend latch를 증명하지 않는다.
- 거절 시 완료 화면이 나타나지 않고 메인으로 이동하는지 확인한다.
- 완료 화면이 실제 가입 완료가 아니라 Demo 절차 종료임을 명확히 읽을 수
  있는지 확인한다.
