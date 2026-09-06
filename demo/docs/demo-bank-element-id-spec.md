# 데모 금융사이트 요소 ID 규격

## 1. 목적

이 문서는 Playwright 테스트와 AI 자동화가 DOM 순서, 화면 좌표, CSS 클래스와 표시 문구 변경에 의존하지 않고 데모 금융사이트의 요소를 안정적으로 식별하기 위한 규칙을 정의한다.

## 2. 기본 규칙

- ID에는 영문 소문자, 숫자와 하이픈만 사용한다.
- 단어 구분은 kebab-case를 사용한다.
- 화면 순서나 DOM 순서에 의존하는 이름을 사용하지 않는다.
- 좌표를 ID에 포함하지 않는다.
- 사용자에게 보이는 문구를 그대로 ID로 사용하지 않는다.
- 동적으로 변하는 배열 인덱스를 ID로 사용하지 않는다.
- 한 페이지 안에서 ID를 중복하지 않는다.
- AI와 Playwright가 조작할 요소는 의미가 바뀌지 않는 고정 ID를 가진다.
- 가능하면 `data-testid`에도 ID와 동일한 값을 사용한다.
- 입력과 조작 요소에는 ID 외에 연결된 label 또는 명확한 accessible name을 제공한다.
- 동적 데이터는 배열 인덱스 대신 변경되지 않는 업무 키를 ID에 사용한다.

허용 형식은 다음 정규식으로 표현한다.

```text
^[a-z0-9]+(?:-[a-z0-9]+)*$
```

## 3. 접두사 규칙

| 요소 종류 | 접두사 | 예시 |
| --- | --- | --- |
| 페이지 루트 | `page-` | `page-home` |
| 이동 메뉴 | `nav-` | `nav-deposit` |
| 버튼 | `btn-` | `btn-start-deposit` |
| 입력창 | `input-` | `input-transfer-amount` |
| 선택창 | `select-` | `select-deposit-period` |
| 체크박스 | `checkbox-` | `checkbox-final-confirmation` |
| 라디오 버튼 | `radio-` | `radio-deposit-period-12m` |
| 상품 카드 | `product-` | `product-deposit-12m` |
| 계좌 카드 | `account-` | `account-living-expense` |
| 수취인 카드 | `recipient-` | `recipient-hong-gildong` |
| 약관 항목 | `term-` | `term-service-required` |
| 요약 정보 | `summary-` | `summary-amount` |
| 상태 메시지 | `status-` | `status-risk-warning` |
| 오류 메시지 | `error-` | `error-transfer-amount` |

## 4. 고정 ID 예시

다음 ID는 D3 이후의 화면 구현과 Playwright 시나리오에서 우선 사용하는 고정 계약이다.

### 메인

| ID | 대상 |
| --- | --- |
| `page-home` | 메인 페이지 루트 |
| `nav-deposit` | 예금 영역 이동 메뉴 |
| `nav-transfer` | 계좌이체 영역 이동 메뉴 |
| `btn-start-deposit` | 예금 가입 시작 버튼 |
| `btn-start-transfer` | 계좌이체 시작 버튼 |

### 예금 상품

| ID | 대상 |
| --- | --- |
| `page-deposit-products` | 예금 상품 목록 페이지 루트 |
| `product-deposit-12m` | 12개월 정기예금 카드 |
| `product-deposit-preferred` | 우대금리 정기예금 카드 |
| `btn-select-deposit-12m` | 12개월 정기예금 선택 버튼 |

### 예금 조건과 약관

| ID | 대상 |
| --- | --- |
| `input-deposit-amount` | 예금 가입 금액 입력 |
| `select-deposit-period` | 가입 기간 선택 |
| `checkbox-term-service-required` | 필수 서비스 약관 체크박스 |
| `checkbox-term-privacy-required` | 필수 개인정보 약관 체크박스 |
| `checkbox-term-marketing-optional` | 선택 마케팅 약관 체크박스 |
| `btn-deposit-terms-next` | 약관 확인 후 다음 버튼 |

### 계좌이체

| ID | 대상 |
| --- | --- |
| `page-transfer-accounts` | 출금 계좌 선택 페이지 루트 |
| `account-living-expense` | 생활비 계좌 카드 |
| `recipient-hong-gildong` | 홍길동 수취인 카드 |
| `input-transfer-amount` | 송금 금액 입력 |

### 보안 입력

| ID | 대상 |
| --- | --- |
| `input-account-password` | 계좌 비밀번호 직접 입력 |
| `input-otp` | OTP 직접 입력 |
| `btn-secure-input-complete` | 현재 보안 입력 완료 버튼 |

`btn-secure-input-complete`는 동시에 렌더링되지 않는 개별 보안 입력 페이지에서 공통 의미로 사용할 수 있다. 한 페이지에 여러 보안 입력 완료 버튼을 만들지 않는다.

### D11 이체 비밀번호 보안 입력

| ID | 대상 |
| --- | --- |
| `btn-transfer-password-start` | 확인된 이체 금액에서 비밀번호 화면으로 이동하는 Gate |
| `page-transfer-password` | 이체 계좌 비밀번호 페이지 루트 |
| `summary-transfer-password-source-account` | URL로 확인한 Mock 출금 계좌 별칭 |
| `summary-transfer-password-recipient` | URL로 확인한 Mock 수취인 이름 |
| `input-account-password` | D1 계좌 비밀번호 직접 입력 요소 |
| `status-transfer-password-input` | 비밀번호 입력 유무 상태 live region |
| `status-confirmed-transfer-password` | 데모 입력 완료 상태 live region |
| `btn-secure-input-complete` | D1 보안 입력 완료 버튼 |
| `btn-transfer-amount-back` | 동일 Mock 계좌·수취인의 금액 화면 복귀 |
| `notice-transfer-secure-input` | 사용자 직접 입력과 자동화 중단 보안 안내 |

`input-account-password`는 `type="password"`와
`data-ddd-policy="secure-input"`을 사용한다. 비밀번호 원문, 길이, 금액,
계좌번호와 인증 상태는 selector나 `data-*` 속성에 넣지 않는다.

### D12 이체 OTP 보안 입력

| ID | 대상 |
| --- | --- |
| `btn-transfer-otp-start` | 데모 비밀번호 입력 완료 후 OTP 화면으로 이동하는 Gate |
| `page-transfer-otp` | 이체 OTP 페이지 루트 |
| `summary-transfer-otp-source-account` | URL로 확인한 Mock 출금 계좌 별칭 |
| `summary-transfer-otp-recipient` | URL로 확인한 Mock 수취인 이름 |
| `input-otp` | D1 OTP 직접 입력 요소 |
| `status-transfer-otp-input` | OTP 입력 유무 상태 live region |
| `status-confirmed-transfer-otp` | 로컬 데모 입력 완료 상태 live region |
| `btn-secure-input-complete` | D1 보안 입력 완료 버튼 |
| `btn-transfer-password-back` | 동일 Mock 계좌·수취인의 비밀번호 화면 복귀 |
| `notice-transfer-otp-secure-input` | 사용자 직접 입력과 자동화 중단 보안 안내 |

`input-otp`는 uncontrolled native `type="password"`, `autocomplete="off"`와
`data-ddd-policy="secure-input"`을 사용한다. OTP 원문, 길이, 일부 값,
계좌번호와 인증 상태는 selector나 `data-*` 속성에 넣지 않는다.
`btn-secure-input-complete`는 각 보안 페이지의 page root 아래에서 조회한다.

### D15 예금 비밀번호 보안 입력

| ID | 대상 |
| --- | --- |
| `btn-deposit-terms-next` | 약관 확인 완료 후 예금 비밀번호 화면으로 이동하는 Gate |
| `page-deposit-password` | 예금 계좌 비밀번호 페이지 루트 |
| `summary-deposit-password-product-name` | URL로 확인한 공개 Mock 상품명 |
| `summary-deposit-password-product-period` | URL로 확인한 공개 Mock 상품 기간 |
| `input-account-password` | D1 계좌 비밀번호 직접 입력 요소 |
| `status-deposit-password-input` | 비밀번호 입력 유무 상태 live region |
| `status-confirmed-deposit-password` | 로컬 데모 입력 완료 상태 live region |
| `btn-secure-input-complete` | D1 보안 입력 완료 버튼 |
| `btn-deposit-terms-back` | 같은 Mock 상품의 약관 화면 복귀 |
| `btn-deposit-password-cancel` | 실제 거래 취소가 아닌 데모 흐름 나가기 |
| `notice-deposit-secure-input` | 사용자 직접 입력과 자동화 중단 보안 안내 |

`input-account-password`는 uncontrolled native `type="password"`,
`autocomplete="off"`와 `data-ddd-policy="secure-input"`을 사용한다. 원문,
길이, 가입 금액, 약관·인증 상태는 selector나 `data-*` 속성에 넣지 않는다.
`btn-secure-input-complete`는 `page-deposit-password` 아래에서 조회하며 이체
보안 입력 화면과 동시에 렌더링되지 않는다.

### 최종 승인

| ID | 대상 |
| --- | --- |
| `summary-transaction-type` | 거래 유형 요약 |
| `summary-recipient` | 수취인 요약 |
| `summary-amount` | 금액 요약 |
| `checkbox-final-confirmation` | 사용자 최종 승인 체크박스 |
| `btn-final-approve` | 최종 승인 실행 버튼 |
| `btn-final-edit` | 입력 내용 수정 버튼 |
| `btn-final-cancel` | 최종 처리 취소 버튼 |

### D13 이체 최종 확인

| ID | 대상 |
| --- | --- |
| `btn-transfer-confirmation-start` | OTP 원문 제거와 로컬 입력 완료 후 최종 확인 화면으로 이동하는 Gate |
| `page-transfer-confirmation` | 이체 최종 확인 Mock 페이지 루트 |
| `summary-transfer-confirmation-source-account` | 공개 Mock 출금 계좌 요약 |
| `status-transfer-confirmation-amount` | D10 금액 미전달 상태 안내 |
| `notice-transfer-confirmation` | 직접 접근과 실제 거래 미실행 안내 |
| `status-transfer-final-approval` | 로컬 승인 또는 취소 상태 live region |
| `btn-transfer-otp-back` | 동일 Mock 계좌·수취인의 OTP 화면 복귀 |

D13은 위 신규 ID와 D1의 `summary-transaction-type`, `summary-recipient`,
`summary-amount`, `checkbox-final-confirmation`, `btn-final-approve`,
`btn-final-edit`, `btn-final-cancel`을 함께 사용한다. `btn-final-approve`에는
`data-ddd-policy="final-confirmation"`을 적용한다. selector와 `data-*`
속성에는 금액, 인증·승인 상태와 민감정보를 넣지 않는다.

### D14 이체 데모 완료

| ID | 대상 |
| --- | --- |
| `btn-transfer-completion-start` | D13 로컬 승인 후 데모 완료 화면으로 이동하는 별도 Gate |
| `page-transfer-completion` | 이체 데모 완료 화면 루트 |
| `summary-transfer-completion-source-account` | 공개 Mock 출금 계좌 문맥 |
| `summary-transfer-completion-recipient` | 공개 Mock 수취인 문맥 |
| `status-transfer-demo-completion` | 데모 안내 흐름 완료 상태 live region |
| `notice-transfer-no-transaction` | 직접 접근과 실제 거래 미실행 안내 |
| `btn-transfer-home` | 데모 메인 화면 복귀 버튼 |

D14 selector는 실제 거래 성공이나 영수증을 뜻하지 않는다. 금액, 승인·인증
상태, 실제 거래 결과와 민감정보를 selector 또는 `data-*` 속성에 넣지 않는다.

### 위험 경고

| ID | 대상 |
| --- | --- |
| `page-risk-warning` | 위험 경고 페이지 루트 |
| `status-risk-warning` | 금융 자동화 중단 상태 메시지 |
| `btn-risk-return-home` | 메인으로 돌아가기 버튼 |
| `btn-risk-end-session` | 세션 종료 버튼 |

## 5. DOM 및 접근성 규칙

- 비밀번호나 OTP 값은 DOM 속성, `data-*` 속성, React 상태, 분석 이벤트와 로그에 복사하지 않는다.
- 계좌번호는 마스킹된 값만 화면에 표시하고 원문을 DOM에 렌더링하지 않는다.
- CSS로 숨긴 중복 버튼이나 중복 ID를 만들지 않는다.
- 동작 요소는 `div` 클릭 이벤트가 아니라 실제 `button` 요소를 사용한다.
- 입력 요소는 `label[for]`와 `input[id]`를 연결하거나 동등한 accessible name을 제공한다.
- 비활성화 상태는 CSS 모양만 바꾸지 않고 실제 `disabled` 속성을 사용한다.
- 장식 요소는 자동화 대상 ID를 갖지 않으며 필요하면 `aria-hidden="true"`를 사용한다.
- Playwright는 표시 텍스트 위치나 CSS 클래스보다 고정 ID, role과 accessible name을 우선 사용한다.
- `data-testid`를 제공할 때는 해당 요소의 ID와 같은 값을 사용한다.

권장 구조:

```html
<label for="input-transfer-amount">송금 금액</label>
<input
  id="input-transfer-amount"
  data-testid="input-transfer-amount"
  inputmode="numeric"
/>

<button
  id="btn-final-approve"
  data-testid="btn-final-approve"
  type="button"
  disabled
>
  최종 승인
</button>
```

보안 입력의 실제 값은 자동화 스냅샷이나 테스트 로그에 기록하지 않는다. 보안 입력 테스트는 값 자체가 아니라 보호 모드, 입력 요소 존재, 캡처 중단 상태와 완료 이벤트만 검증한다.

## 6. D26 보안 입력 완료 상태 공통 계약

예금 비밀번호, 이체 비밀번호와 이체 OTP 화면은 기존 완료 상태 ID를 그대로
사용한다. 사용자의 직접 완료 클릭 전에는 `data-ddd-secure-state`가 없으며,
완료 후 해당 안전 상태 요소에만 다음 마커를 제공한다.

```html
<p
  id="status-confirmed-deposit-password"
  data-testid="status-confirmed-deposit-password"
  data-ddd-secure-state="completed"
  role="status"
  aria-live="polite"
>
  보안 입력 절차가 완료 요청 상태로 전환되었습니다.
</p>
```

완료 후에는 `input[type="password"]`와
`[data-ddd-policy="secure-input"]`이 DOM에 남지 않는다. 마커는 실제 인증·
가입·송금 성공을 의미하지 않는다. 자동화는 보안값 입력, 완료 버튼 클릭,
screenshot, trace, video와 값 조회를 수행하지 않는다. 실제 전환은 캡처를 끈
수동 검증으로 확인하며 Backend는 입력 요소 부재와 마커를 함께 검증한다.

## 7. D27 예금 최종 확인·완료 DOM 계약

### 고정 ID

| ID | 대상 |
| --- | --- |
| `btn-deposit-confirmation-start` | 예금 비밀번호 완료 뒤 최종 확인 화면으로 이동하는 별도 Gate |
| `page-deposit-confirmation` | 예금 최종 확인 페이지 루트 |
| `summary-deposit-confirmation` | 예금 최종 확인 요약 `<dl>` |
| `notice-deposit-confirmation` | Demo·민감정보 미포함 안내 |
| `status-deposit-final-approval` | Demo 내용 확인·Frontend 최종 승인 안내 live region |
| `checkbox-final-confirmation` | 승인 버튼과 독립된 선택적 Demo 내용 확인 checkbox |
| `btn-deposit-confirmation-back` | 동일 상품의 비밀번호 화면 복귀 |
| `btn-final-cancel` | 예금 최종 승인 거절·메인 복귀 |
| `btn-final-approve` | 예금 최종 승인·Demo 완료 화면 이동 |
| `page-deposit-completion` | 예금 Demo 완료 페이지 루트 |
| `status-deposit-demo-completion` | Demo 절차 종료 상태 live region |
| `notice-deposit-no-transaction` | 실제 금융거래 미실행 안내 |
| `btn-deposit-home` | Demo 메인 화면 복귀 |

고정 ID 요소의 `id`와 `data-testid`는 같은 값을 사용한다. 이체 최종 확인과
같은 DOM에 동시에 렌더링되지 않으므로 공통 D1 ID인
`checkbox-final-confirmation`, `btn-final-cancel`, `btn-final-approve`를
재사용한다.

### 요약 구조

`summary-deposit-confirmation`은
`data-ddd-confirmation-summary="true"`를 제공한다. 직계 자식은 다음 순서의
`data-ddd-summary-id`를 가진 `<div>`이며 각 항목은 `<dt>`와 `<dd>`를 한 개씩
포함한다.

1. `product-name`
2. `deposit-amount`
3. `deposit-period`

상품명과 기간은 실제 공개 Mock 상품 데이터에서 가져오고 가입 금액은 D25·D27
공동 시나리오 상수 `1,000,000원`을 표시한다. 비밀번호, 인증정보, 계좌번호,
동의·승인 상태는 요약이나 `data-*` 속성에 넣지 않는다.

`btn-final-approve`는 `data-ddd-policy="final-confirmation"`을 제공하고 Demo
checkbox 상태와 관계없이 enabled다. checkbox 선택만으로 승인이나
navigation을 실행하지 않는다. Production 최종 승인 Gate는 Frontend
`FinalConfirmationPanel`의 checkbox와 별도 approve Action이며, Backend가 이를
검증한 후에만 pending final CLICK을 실행한다.
