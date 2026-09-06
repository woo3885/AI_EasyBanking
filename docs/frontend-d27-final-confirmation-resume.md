# 메인 프론트 D27 최종 승인·거절 연동

## 목적

D27은 Backend가 발행한 `FINAL_CONFIRMATION_REQUIRED` 계약을 메인 프론트의
`FinalConfirmationPanel`에 연결하고 사용자의 명시적인 승인 또는 거절을 Backend에
전달한다. 이 단계의 HTTP 응답은 요청 접수 ACK이며 금융기관의 처리 완료나 거래 성공을
뜻하지 않는다. 화면 상태는 후속 UI event, reconnect snapshot, WorkflowStatus 및 Viewer
Frame으로만 갱신한다.

## Production 계약

- Status WebSocket: `/topic/sessions/{sessionId}/events`
- reconnect snapshot: `/api/v1/sessions/{sessionId}/events/latest`
- 승인: `POST /api/v1/sessions/{sessionId}/confirm`
- 거절: `POST /api/v1/sessions/{sessionId}/reject`

승인과 거절 요청은 `requestId`, `confirmationId`, `approved`,
`expectedFrameId`, `expectedSequence`만 보낸다. 거래 summary, 상품, 금액, 계좌 정보는
다시 전송하지 않는다. 응답의 session, request, confirmation, source Frame identity가
요청과 모두 일치해야 ACK로 인정한다.

## Event와 snapshot

다음 event를 runtime validation한다.

- `CONFIRMATION_REQUIRED`: `FINAL_CONFIRMATION_REQUIRED`, active confirmation identity와
  ordered summary를 포함한다.
- `CONFIRMATION_RESOLVED`: 승인 후 `PAGE_LOADING`으로 이어지는 identity event다.
- `CONFIRMATION_REJECTED`: 최종 Action을 실행하지 않고 `CANCELLED`로 이어지는 identity
  event다.
- `CONFIRMATION_CLEAR`: active confirmation을 정리하는 identity event다.

snapshot의 `confirmation`에는 required event가 그대로 보존된다. session mismatch,
unknown type, 잘못된 Frame identity, 빈 summary, 중복 item ID, 순서가 다른 item,
민감정보 또는 stale sequence는 fail-closed한다.

현재 지원하는 계약은 `DEPOSIT_SUBSCRIPTION`과 `정기예금 가입`이다. summary 순서는
다음과 같다.

1. `product-name` / 상품명
2. `deposit-amount` / 가입 금액
3. `deposit-period` / 가입 기간

## 프론트 상태 모델

confirmation 제출 상태는 다음과 같다.

- `REVIEWING`: 요약 확인과 사용자 선택을 기다린다.
- `SUBMITTING_APPROVAL`: 승인 HTTP 요청 처리 중이다.
- `SUBMITTING_REJECTION`: 거절 HTTP 요청 처리 중이다.
- `WAITING_FOR_RESULT`: ACK를 받았지만 후속 production 상태를 기다린다.
- `ERROR`: 안전한 오류를 표시하고 자동 retry하지 않는다.
- `IDLE`: active confirmation이 없다.

새 confirmation ID에서는 checkbox와 오류를 초기화한다. 동일 ID의 reconnect snapshot은
유효한 checkbox 상태를 보존한다. resolved, rejected, clear, secure, risk, terminal,
reset 또는 더 새로운 Frame에서는 confirmation 상태를 정리하거나 제출을 차단한다.

## 승인·거절 Gate

승인에는 다음 조건이 모두 필요하다.

- WorkflowStatus가 `FINAL_CONFIRMATION_REQUIRED`
- active confirmation과 안전한 summary 존재
- 사용자가 checkbox를 직접 선택
- Status transport 연결 완료
- source Frame ID와 sequence가 현재 Viewer Frame과 일치
- reconnect 또는 resync가 아님
- Viewer Action, decision, secure input, confirmation 요청이 처리 중이 아님
- risk, secure, terminal 상태가 아님

거절도 동일한 identity와 pending Gate를 사용하지만 checkbox 선택은 요구하지 않는다.
`FinalConfirmationPanel`의 수정 버튼은 Backend 수정 endpoint가 없으므로 비활성화한다.

## Lifecycle과 오류

- 요청 timeout은 10초이며 caller `AbortSignal`을 지원한다.
- 자동 retry하지 않고 한 번의 사용자 실행마다 하나의 request ID만 사용한다.
- reconnect, identity 변경, stale Frame, reset, exit, unmount에서 진행 중 요청을 abort한다.
- ACK만으로 완료 화면이나 성공 영수증을 만들지 않는다.
- 요청 오류는 정해진 안전 문구로만 표시하고 Backend body, stack, selector 및 endpoint를
  노출하지 않는다.

## 접근성·보안

기존 `FinalConfirmationPanel`의 `dl/dt/dd`, native checkbox, 실제 button, 56px Action,
`aria-busy`, `role="status"`, `aria-live="polite"` 및 focus-visible 계약을 재사용한다.
처리 오류는 하나의 `role="alert"`로 표시하며 Workflow 상태 live region과 최종 확인
live region을 동시에 렌더링하지 않는다.

summary는 React text로만 렌더링한다. HTML, 제어문자, 비밀번호, OTP, 인증번호, PIN,
주민등록번호, 전화번호, 미마스킹 금융번호 및 내부 식별자가 감지되면 전체 confirmation을
거부한다. session ID, request ID, confirmation ID, source snapshot ID는 UI에 표시하거나
URL, storage, console, analytics에 기록하지 않는다.

## D27 제외 범위

- Demo, Backend, AI Engine 계약 변경
- 실제 금융거래 또는 금융기관 성공 판정
- 자동 승인·자동 거절·자동 retry
- transaction summary 재전송
- 수정/이전 단계 endpoint 추정
- 새 영수증·완료 화면
- D24 decision, D26 secure takeover, D22 Viewer Action 계약 변경

## 검증

```powershell
npm.cmd test -- --run --dir src
npm.cmd run build
git diff --check
```

실제 공동 E2E는 Backend(Java 21·Playwright), Demo Bank와 Frontend를 함께 실행할 수 있는
환경에서 승인과 거절을 각각 수동 검증한다. 승인 전 Action 미실행, 승인 정확히 한 번,
거절 시 Action 미실행과 clear, stale·secure·risk 차단을 확인해야 한다.
