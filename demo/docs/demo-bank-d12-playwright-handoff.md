# 데모뱅크 D12 Playwright 인계 규격

## 1. 목적과 실행

D12는 비밀번호 입력 완료 뒤 별도 Gate로 진입하는 OTP 보안 입력 화면의
DOM·접근성·자동화 중단 경계를 제공한다. 실제 OTP 인증, 최종 확인과 송금은
수행하지 않는다.

```powershell
cd demo/demo-bank
npm.cmd run dev -- --host 127.0.0.1 --port 5190 --strictPort
```

## 2. URL 계약

정상 URL과 각 trailing slash를 지원한다.

- `/transfer/secure/otp/living-expense/hong-gildong`
- `/transfer/secure/otp/living-expense/demo-saved`
- `/transfer/secure/otp/savings/hong-gildong`
- `/transfer/secure/otp/savings/demo-saved`

대표 오류 URL은 다음과 같다.

- `/transfer/secure/otp`
- `/transfer/secure/otp/living-expense`
- `/transfer/secure/otp/unknown-account/hong-gildong`
- `/transfer/secure/otp/living-expense/unknown-recipient`
- `/transfer/secure/otp/living-expense/hong-gildong/extra`

정상 직접 접근은 화면과 DOM 계약 확인용 Mock 예외다. 이전 비밀번호 입력
완료나 실제 인증 완료를 의미하지 않는다. URL에는 공개 Mock accountId와
recipientId만 포함하며 이체 금액, 비밀번호, OTP, 계좌번호, 잔액과 완료
상태는 포함하지 않는다.

## 3. 고정 selector

| 역할 | ID 및 `data-testid` |
| --- | --- |
| 비밀번호 화면의 OTP 시작 Gate | `btn-transfer-otp-start` |
| OTP 화면 루트 | `page-transfer-otp` |
| 출금 계좌 요약 | `summary-transfer-otp-source-account` |
| 수취인 요약 | `summary-transfer-otp-recipient` |
| OTP 입력 | `input-otp` |
| 입력 상태 | `status-transfer-otp-input` |
| 완료 상태 | `status-confirmed-transfer-otp` |
| 입력 완료 버튼 | `btn-secure-input-complete` |
| 비밀번호 화면 복귀 | `btn-transfer-password-back` |
| 보안 안내 | `notice-transfer-otp-secure-input` |

모든 고정 요소는 `id`와 `data-testid`가 같다. 완료 버튼 ID는 서로 동시에
렌더링되지 않는 비밀번호·OTP 페이지에서 공통으로 사용하므로 반드시 현재
page root 아래에서 조회한다.

```ts
const otpPage = page.getByTestId('page-transfer-otp');
const otpInput = otpPage.getByTestId('input-otp');
const completeButton = otpPage.getByTestId('btn-secure-input-complete');

await expect(otpInput).toHaveAttribute('type', 'password');
await expect(otpInput).toHaveAttribute('autocomplete', 'off');
await expect(otpInput).toHaveAttribute(
  'data-ddd-policy',
  'secure-input'
);
await expect(completeButton).toBeDisabled();
```

이 예제는 민감값을 입력하거나 읽지 않는다.

## 4. 초기 상태와 비밀번호 Gate

- OTP input 상태는 `EMPTY`, 로컬 완료 상태는 false다.
- 입력 완료 버튼은 실제 `disabled`다.
- 비밀번호 input에 값이 존재하는 것만으로 OTP 시작 Gate가 열리지 않는다.
- 비밀번호 완료 버튼이 DOM 값을 제거하고 로컬 완료 상태를 만든 뒤에만
  `btn-transfer-otp-start`가 활성화된다.
- 비밀번호를 다시 입력하면 완료 상태와 OTP Gate를 즉시 초기화한다.
- OTP 시작 버튼은 같은 탭에서 공개 Mock ID만 포함한 URL로 이동한다.

## 5. OTP input 보안 계약

`input-otp`는 uncontrolled native input이며 다음 속성을 사용한다.

- `type="password"`
- `autocomplete="off"`
- `spellcheck="false"`
- `autocorrect="off"`
- `autocapitalize="none"`
- `data-ddd-policy="secure-input"`
- 실제 label과 `aria-describedby`

`value`, `defaultValue`, `inputmode`, `pattern`, `minlength`, `maxlength`,
`autofocus`와 `autocomplete="one-time-code"`는 사용하지 않는다. D1에는 OTP
자릿수, 숫자 형식, 정답, 만료와 재전송 규격이 없다.

## 6. 자동화 중단과 책임 경계

데모페이지는 secure-input DOM 신호, 초기 disabled 상태, 원문 비저장과 완료
시 DOM 값 제거를 제공한다. Developer B는 이 신호를 발견하면 자동 입력,
AI DOM 전달, screenshot, frame, trace와 video 수집을 중단하고
`SECURE_INPUT_REQUIRED` 상태로 전환해야 한다. 값 없는 완료 신호와 안전한
재개 정책도 Developer B의 후속 통합 책임이다.

HTTP 200은 Vite SPA fallback 응답일 뿐 OTP 또는 NotFound DOM 렌더링 성공을
뜻하지 않는다. 민감값 없이 page root, selector, 속성, label, ARIA, 초기
disabled와 오류 URL의 NotFound DOM을 별도로 확인한다.

## 7. 자동화 금지

- OTP input에 `fill()`, `type()`, `pressSequentially()`, `evaluate()`로 값 주입
- 실제 OTP 또는 예시 정답 입력
- 입력 완료 버튼 자동 클릭
- 입력 이후 screenshot, trace, video, snapshot 수집
- DOM value 읽기 또는 로깅
- 자동 인증 성공 처리
- 자동 최종 확인 이동
- 사용자 개입 없는 자동화 재개

## 8. 사용자 수동 검증

브라우저의 screenshot, trace, video와 콘솔 수집을 끈 뒤 실제 OTP가 아닌
데모 전용 임의 입력으로 다음만 확인한다.

- 입력 존재 시 완료 버튼 활성화
- 완료 클릭 직후 DOM 값 제거와 password input 제거
- `[data-ddd-policy="secure-input"]` 부재와
  `status-confirmed-transfer-otp[data-ddd-secure-state="completed"]` 존재
- 완료 안내가 실제 인증 성공을 주장하지 않음
- 비밀번호 화면 복귀

입력값은 검증 보고서에 기록하지 않는다.

## 8-1. D26 완료 상태 계약

OTP 입력 상태는 `EMPTY | ENTERED | COMPLETION_RECORDED`만 사용한다. 완료는
사용자의 직접 클릭으로만 기록하며, 원문 제거 후 input을 DOM에서 제거한다.
완료 전에는 `data-ddd-secure-state`가 없고 완료 후 기존 안전 상태 요소에만
`data-ddd-secure-state="completed"`가 표시된다. 완료 버튼은 비활성화되고
접근 가능한 문구가 `입력 완료 요청됨`으로 바뀐다.

이 상태는 OTP 인증 성공이나 송금 성공이 아니다. Backend는 secure-input
요소 부재와 완료 마커를 함께 검증해야 하며, 캡처·AI·자동화 재개 여부는 별도
정책으로 결정한다. 최종 확인 이동은 기존 별도 사용자 Gate이며 D26은 자동
이동하지 않는다.

## 9. D12 제외 범위

실제 OTP 생성·정답·인증, 자릿수·형식 검증, 만료·재전송, 발송, API,
WebSocket, storage, 자동 입력, 최종 확인, 최종 승인, 실제 송금과 잔액 차감은
D12 범위가 아니다. 새 패키지는 추가하지 않는다.
