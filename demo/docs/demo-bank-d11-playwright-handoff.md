# 데모뱅크 D11 Playwright 인계 규격

## 1. 목적과 범위

D11은 계좌이체 금액 확인 이후 계좌 비밀번호 보안 입력 화면까지의 데모 흐름을 제공한다. 이 화면은 개발자 B가 보안 입력 구간을 감지하고 자동화·AI 실행·화면 캡처를 중단하는 경계를 확인하기 위한 Mock이다.

- 실제 인증, 송금, OTP 입력, API 호출, WebSocket 연결은 수행하지 않는다.
- 입력한 값은 React 상태, URL, 저장소, 로그에 보관하지 않는다.
- 완료 버튼은 입력 여부만 확인하며 실제 비밀번호를 검증하지 않는다.

## 2. URL 계약

```text
/transfer/secure/password/:accountId/:recipientId
```

지원하는 직접 접근 URL은 다음과 같다. 각 URL은 뒤에 `/`가 붙어도 같은 화면을 표시한다.

- `/transfer/secure/password/living-expense/hong-gildong`
- `/transfer/secure/password/living-expense/demo-saved`
- `/transfer/secure/password/savings/hong-gildong`
- `/transfer/secure/password/savings/demo-saved`

알 수 없는 계좌 ID, 수취인 ID, 누락되거나 추가된 경로 구간은 NotFound 화면으로 처리한다. URL에는 공개 식별자인 계좌 ID와 수취인 ID만 포함하며 계좌번호, 잔액, 금액, 보안 입력값은 포함하지 않는다.

대표 오류 URL은 다음과 같다.

- `/transfer/secure/password`
- `/transfer/secure/password/living-expense`
- `/transfer/secure/password/unknown-account/hong-gildong`
- `/transfer/secure/password/living-expense/unknown-recipient`
- `/transfer/secure/password/living-expense/hong-gildong/extra`

직접 URL 접근은 화면과 보안 DOM 계약을 확인하기 위한 예외다. 이전 금액 입력·확인, 사용자 인증 또는 자동화 중단이 완료되었다는 의미가 아니다.

## 3. 금액 화면 Gate

`/transfer/amount/:accountId/:recipientId`에서 유효한 금액을 확인한 뒤에만 `btn-transfer-password-start`가 활성화된다. 원본 입력을 변경하면 확인 상태가 해제되고 버튼이 다시 비활성화된다. 활성화된 버튼은 동일 탭에서 보안 입력 URL로 이동하며 브라우저 방문 기록을 유지한다.

## 4. 고정 선택자

| 역할 | ID 및 `data-testid` |
| --- | --- |
| 보안 입력 화면 루트 | `page-transfer-password` |
| 출금 계좌 요약 | `summary-transfer-password-source-account` |
| 수취인 요약 | `summary-transfer-password-recipient` |
| 보안 안내 | `notice-transfer-secure-input` |
| 계좌 비밀번호 입력 | `input-account-password` |
| 입력 상태 | `status-transfer-password-input` |
| 완료 상태 | `status-confirmed-transfer-password` |
| 입력 완료 버튼 | `btn-secure-input-complete` |
| 금액 입력으로 돌아가기 | `btn-transfer-amount-back` |
| 금액 화면의 보안 입력 시작 버튼 | `btn-transfer-password-start` |

모든 고정 요소는 `id`와 `data-testid`에 같은 값을 사용한다.

## 5. 보안 입력 DOM 계약

`input-account-password`는 다음 계약을 따른다.

- 네이티브 `<input type="password">`를 사용한다.
- 명시적인 `<label>`과 설명 요소를 연결한다.
- `autocomplete="off"`와 `data-ddd-policy="secure-input"`을 사용한다.
- React의 `value`, `defaultValue` prop으로 값을 보관하지 않는다.
- `inputMode`, `pattern`, `minLength`, `maxLength`, 자리 수 안내를 사용하지 않는다.
- placeholder와 자동 focus를 사용하지 않는다.
- React 상태에는 `EMPTY` 또는 `ENTERED`만 저장한다.
- 완료 처리 즉시 DOM의 입력값을 지우고 상태를 `EMPTY`로 되돌린다.
- 실제 값, 길이, 문자 종류를 화면이나 로그에 출력하지 않는다.

자릿수와 숫자 형식에 대한 확정 규격이 없으므로 별도의 형식 검증을 만들지 않는다.

## 6. Playwright 자동화 제한

개발자 B의 자동화는 URL 진입과 DOM 계약 확인까지만 허용한다.

허용되는 확인:

- 화면 루트와 고정 선택자 존재 여부
- `type`, `autocomplete`, `data-ddd-policy`, 접근성 연결 속성
- 초기 입력 상태 `EMPTY`
- 초기 완료 버튼의 실제 `disabled` 상태
- 안내 문구와 컨텍스트 요약 존재 여부
- 잘못된 URL의 NotFound 처리

금지되는 자동화:

- 보안 입력에 대한 `fill`, `type`, `pressSequentially`, `evaluate` 사용
- 실제 또는 예시 비밀번호 주입
- 보안 화면의 screenshot, trace, video 수집
- DOM 값, 요청 본문, 이벤트 데이터를 로그로 출력

입력 완료 동작은 다음 수동 조건에서만 확인한다.

- 실제 금융 비밀번호가 아닌 데모 전용 임의 입력만 사용한다.
- 브라우저 trace, screenshot, video, 콘솔 수집을 끈다.
- 완료 후 입력 DOM과 `data-ddd-policy="secure-input"` 요소가 제거되고 완료 상태만 표시되는지 확인한다.
- `status-confirmed-transfer-password`에 `data-ddd-secure-state="completed"`가 표시되는지 확인한다.
- 입력값 자체는 어떤 보고서에도 기록하지 않는다.

## 7. 개발자 B 연동 책임

실제 자동화 연동 단계에서는 개발자 B가 다음 경계를 구현한다.

1. 보안 입력 화면 진입 시 전체 업무 상태를 `SECURE_INPUT_REQUIRED`로 전환한다.
2. Playwright 자동화, AI DOM 접근, 화면 캡처와 프레임 전송을 중단한다.
3. 사용자 입력 완료 신호를 안전한 별도 API 또는 이벤트 계약으로 수신한다.
4. 완료 신호 이후에만 자동화와 캡처 재개 여부를 판단한다.

D11 데모 화면은 위 API나 이벤트를 구현하지 않으며, 입력 완료 버튼은 로컬 Mock 상태만 갱신한다.

## 7-1. D26 완료 상태 계약

입력 상태는 `EMPTY | ENTERED | COMPLETION_RECORDED`만 사용한다. 사용자가
`btn-secure-input-complete`를 직접 누르면 DOM 원문을 먼저 지우고
`COMPLETION_RECORDED`로 전환한다. 그 뒤 password input과
`[data-ddd-policy="secure-input"]`은 DOM에서 제거되며, 기존 안전 상태 요소
`status-confirmed-transfer-password`에만
`data-ddd-secure-state="completed"`가 생긴다. 완료 전에는 이 마커가 없다.

이 마커는 사용자의 로컬 입력 완료 요청일 뿐 실제 인증 성공·송금 성공이나
자동화 재개 허가가 아니다. Backend는 보안 입력 요소가 사라진 사실과 완료
마커를 함께 검증하고 별도 정책에 따라 재개해야 한다. OTP 이동은 기존 별도
사용자 버튼으로만 수행하며 D26은 자동 이동하지 않는다.

금액 화면 복귀는 `/transfer/amount/:accountId/:recipientId`로 이동한다. query나 저장소로 금액을 전달하지 않으므로 이전 금액 로컬 상태는 초기화될 수 있다.

## 8. 접근성·보안 원칙

- 입력 요소는 키보드와 스크린 리더로 식별할 수 있다.
- 안내 및 상태 문구는 색상에만 의존하지 않는다.
- 완료 버튼은 입력 전 실제 `disabled` 상태다.
- 화면에는 계좌 별칭과 수취인 이름만 표시한다.
- 마스킹 계좌번호도 보안 입력 화면에서는 표시하지 않는다.
- 실제 비밀번호, OTP, 계좌번호 원문, 주민등록번호를 사용하지 않는다.

## 9. D11 제외 범위

- 실제 계좌 비밀번호 검증
- 인증 및 송금 API 호출
- OTP 화면 또는 OTP URL 이동
- 브라우저 저장소 사용
- WebSocket 및 세션 상태 연동
- Playwright의 보안 입력 자동화
- 실제 금융거래 처리
