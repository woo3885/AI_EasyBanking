# 데모뱅크 D13 Playwright 인계 규격

## 1. 목적과 실행

D13은 OTP 로컬 입력 완료 뒤 별도 Gate로 진입하는 이체 최종 확인 Mock과
사용자 직접 승인 Gate의 DOM 계약을 제공한다. 실제 인증, 송금, 잔액 변경과
거래 승인을 수행하지 않는다.

```powershell
cd demo/demo-bank
npm.cmd run dev -- --host 127.0.0.1 --port 5190 --strictPort
```

## 2. URL 계약

정상 URL과 각 trailing slash를 지원한다.

- `/transfer/confirmation/living-expense/hong-gildong`
- `/transfer/confirmation/living-expense/demo-saved`
- `/transfer/confirmation/savings/hong-gildong`
- `/transfer/confirmation/savings/demo-saved`

대표 오류 URL은 다음과 같다.

- `/transfer/confirmation`
- `/transfer/confirmation/living-expense`
- `/transfer/confirmation/unknown-account/hong-gildong`
- `/transfer/confirmation/living-expense/unknown-recipient`
- `/transfer/confirmation/living-expense/hong-gildong/extra`

정상 직접 접근은 화면과 DOM 계약 확인용 Mock 예외다. 이전 금액 입력,
비밀번호·OTP 인증, checkbox 선택과 사용자 승인을 증명하지 않는다. URL에는
공개 Mock accountId와 recipientId만 포함한다.

## 3. selector 계약

D1 고정 selector는 다음과 같다.

- `summary-transaction-type`
- `summary-recipient`
- `summary-amount`
- `checkbox-final-confirmation`
- `btn-final-approve`
- `btn-final-edit`
- `btn-final-cancel`

D13 신규 selector는 다음과 같다.

- `btn-transfer-confirmation-start`
- `page-transfer-confirmation`
- `summary-transfer-confirmation-source-account`
- `status-transfer-confirmation-amount`
- `notice-transfer-confirmation`
- `status-transfer-final-approval`
- `btn-transfer-otp-back`

모든 고정 요소는 `id`와 `data-testid`가 같다. selector와 data 속성에는
금액, 계좌번호, 보안 입력과 승인 상태를 넣지 않는다.

## 4. OTP 이후 Gate

OTP 값이 존재하는 것만으로 다음 Gate가 열리지 않는다. 사용자가
`btn-secure-input-complete`를 눌러 DOM 원문을 제거하고 로컬 완료 상태를
만든 뒤에만 `btn-transfer-confirmation-start`가 활성화된다. 다시 입력하면
완료 상태와 Gate가 초기화된다. OTP 원문과 완료 상태는 전달하지 않는다.

## 5. 금액 미전달 한계

D10 금액은 컴포넌트 로컬 상태라 화면 이동 후 소멸한다. D13은 임의 금액이나
`0원`을 표시하지 않고 `summary-amount`와
`status-transfer-confirmation-amount`에서 전달되지 않았음을 안내한다.
따라서 이 화면은 실제 거래 요약이나 송금 검토 완료를 의미하지 않는다.

## 6. 최종 승인과 자동화 중단

`checkbox-final-confirmation`은 초기 미선택이고 `btn-final-approve`는 실제
disabled다. 사용자가 직접 checkbox를 선택한 뒤에만 승인 버튼이 활성화된다.
승인 버튼에는 `data-ddd-policy="final-confirmation"`이 있으며, 개발자 B는
이를 탐지해 `FINAL_CONFIRMATION_REQUIRED`로 전환하고 AI 자동 클릭을
차단해야 한다. 클릭 결과는 로컬 안내뿐이며 실제 거래는 없다.

민감정보를 다루지 않는 자동 검증은 page root, 고정 selector, 초기 checkbox,
승인 버튼 disabled, policy 속성, 금액 미전달 안내, 직접 접근 주의와 오류
URL의 NotFound DOM으로 제한한다.

## 7. 자동화 금지

- 최종 승인 checkbox 자동 선택
- 최종 승인 버튼 자동 클릭
- 최종 승인 자동 처리
- 사용자 개입 없는 자동화 재개
- 실제 금융 Action 실행

## 8. 사용자 수동 검증

- OTP 입력 완료 후 별도 최종 확인 시작 버튼 활성화
- checkbox 직접 선택
- 승인 버튼 직접 클릭
- 로컬 승인 안내와 실제 거래 미실행 안내 확인
- 수정, 취소와 OTP 화면 복귀 동작 확인

검증 보고서에는 민감정보나 입력값을 기록하지 않는다.

## 9. D13 제외 범위

실제 OTP 인증, 거래 승인 API, WebSocket, storage, 금액 전달, 실제 송금,
잔액 차감, 거래번호, 수수료와 완료 화면은 D13 범위가 아니다. 새 패키지는
추가하지 않는다.
