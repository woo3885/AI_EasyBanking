# 데모뱅크 D14 Playwright 인계 규격

## 1. 목적과 실행

D14는 D13 로컬 승인 뒤 별도 Gate로 진입하는 데모 이체 안내 흐름 결과
화면의 DOM 계약을 제공한다. 실제 송금 성공, 인증 결과, 잔액 변경과 거래
영수증을 제공하지 않는다.

```powershell
cd demo/demo-bank
npm.cmd run dev -- --host 127.0.0.1 --port 5190 --strictPort
```

## 2. URL 계약

정상 URL과 각 trailing slash를 지원한다.

- `/transfer/completed/living-expense/hong-gildong`
- `/transfer/completed/living-expense/demo-saved`
- `/transfer/completed/savings/hong-gildong`
- `/transfer/completed/savings/demo-saved`

대표 오류 URL은 다음과 같다.

- `/transfer/completed`
- `/transfer/completed/living-expense`
- `/transfer/completed/unknown-account/hong-gildong`
- `/transfer/completed/living-expense/unknown-recipient`
- `/transfer/completed/living-expense/hong-gildong/extra`

정상 직접 접근은 화면과 DOM 계약 확인용 Mock 예외다. URL은 D13 checkbox
선택, 사용자 승인, 실제 비밀번호·OTP 인증, 송금과 잔액 변경을 증명하지
않는다. URL에는 공개 Mock accountId와 recipientId만 포함한다.

## 3. selector 계약

- `btn-transfer-completion-start`
- `page-transfer-completion`
- `summary-transfer-completion-source-account`
- `summary-transfer-completion-recipient`
- `status-transfer-demo-completion`
- `notice-transfer-no-transaction`
- `btn-transfer-home`

모든 고정 요소는 `id`와 `data-testid`가 같다. selector와 data 속성에는 금액,
승인·인증 상태, 거래 결과와 민감정보를 넣지 않는다.

## 4. D13 이후 Gate

최종 확인 checkbox 선택만으로는 `btn-transfer-completion-start`가 활성화되지
않는다. 사용자가 `btn-final-approve`를 직접 클릭해 로컬 승인 상태가 된
뒤에만 활성화된다. checkbox 변경 또는 취소는 로컬 승인과 Gate를 초기화한다.
완료 화면 URL에는 승인 boolean을 전달하지 않는다.

## 5. 화면 의미와 직접 접근

`status-transfer-demo-completion`은 데모 안내 흐름과 사용자 승인 UI 절차를
확인했다는 의미만 전달한다. 실제 송금, 잔액 변경, 인증 결과와 거래번호는
없다. 금액은 화면 간 전달되지 않아 표시하지 않는다. 직접 URL 접근도 이전
사용자 승인이나 실제 거래 결과를 증명하지 않는다.

`btn-transfer-home`은 기존 HOME route로 같은 탭에서 이동한다. 상태, 금액과
승인 결과를 전달하지 않으며 같은 거래를 다시 실행하는 버튼은 제공하지
않는다.

## 6. 자동 검증 가능 범위

- 정상·오류 URL과 NotFound DOM
- D14 page root와 고정 selector
- 안전한 Mock 계좌·수취인 문맥
- 직접 접근과 실제 거래 미실행 안내
- 금액, 실제 거래번호와 API·WebSocket·storage 부재
- 메인 복귀 버튼 존재와 accessible name

## 7. 자동화 금지

- `checkbox-final-confirmation` 자동 선택
- `btn-final-approve` 자동 클릭
- `btn-transfer-completion-start` 자동 클릭
- 사용자 승인 우회 또는 승인 후 자동화 재개
- 실제 금융 Action과 거래 완료 주장

## 8. 사용자 수동 검증

- D13 checkbox 직접 선택
- D13 승인 버튼 직접 클릭
- 로컬 승인 안내 확인
- 별도 완료 화면 이동 버튼 활성화와 직접 클릭
- 데모 완료와 실제 송금 미실행 안내 확인
- 메인 화면 복귀

검증 보고서에는 민감정보, 금액이나 승인 상태를 기록하지 않는다.

## 9. D14 제외 범위

실제 송금, 잔액 차감, 인증, 거래번호, 수수료, 영수증, 금액 전달, 승인 상태
전달, storage, API, WebSocket, 자동 승인·완료와 같은 거래 재실행은 D14
범위가 아니다. 새 패키지는 추가하지 않는다.
