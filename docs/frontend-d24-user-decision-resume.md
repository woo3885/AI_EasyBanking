# 프론트 D24 사용자 선택 결과 전송 및 AI 재개 연동

## 범위

D24는 Backend가 전달한 실제 사용자 결정 정보를 기존 선택 패널에 표시하고, 사용자가 선택과 확인을 분리해 수행한 최종 결과를 Backend에 한 번 제출하는 프론트 연동이다. 상품 선택, 출금 계좌 선택, 수취인 선택, 약관 동의를 지원한다. 실제 금융거래 실행과 `ADDITIONAL_INFORMATION` UI는 범위에 포함하지 않는다.

## 수신 계약

- STOMP 구독: `/topic/sessions/{sessionId}/events`
- 최신 상태 복원: `GET /api/v1/sessions/{sessionId}/events/latest`
- 이벤트: `DECISION_REQUIRED`, `DECISION_RESOLVED`, `DECISION_CLEAR`
- 지원 유형: `PRODUCT_SELECTION`, `SOURCE_ACCOUNT_SELECTION`, `RECIPIENT_SELECTION`, `TERMS_AGREEMENT`
- 결정 정보: `requestId`, `decisionId`, `decisionType`, `options`, `frameId`, `frameSequence`, `sourceSnapshotId`
- 선택 항목: `id`, `label`, `required`, `checked`, `disabled`

라이브 이벤트와 snapshot은 기존 `eventSequence` 정책을 공유한다. snapshot을 적용한 뒤 더 큰 sequence의 라이브 이벤트만 순서대로 반영하며 stale·duplicate 이벤트는 무시한다. 알 수 없는 결정 유형, 빈 목록, 중복 ID, 잘못된 boolean, 민감하거나 안전하지 않은 label은 fail-closed 처리한다.

## 제출 계약

`POST /api/v1/sessions/{sessionId}/decisions`에 다음 JSON을 전송한다.

```json
{
  "requestId": "req-001",
  "decisionId": "dec-001",
  "decisionType": "PRODUCT_SELECTION",
  "selectedOptionIds": ["option-001"],
  "expectedFrameId": "frame-001",
  "expectedSequence": 12
}
```

`expectedSequence`는 상태 event sequence가 아닌 Viewer frame sequence다. 성공 응답은 공통 API envelope 안의 session 응답을 검증하고 `sessionId`와 `status`를 사용한다. 요청은 한 번만 전송하며 자동 retry하지 않는다. timeout과 `AbortSignal`을 지원하고 Backend 원문 대신 안전한 오류 코드와 안내만 UI에 제공한다.

## 선택과 확인

- 상품·계좌·수취인은 native radio로 하나를 선택한 뒤 별도의 `선택 확인` 버튼을 누른다.
- 약관은 native checkbox로 각 항목을 직접 바꾼 뒤 별도의 `약관 선택 확인` 버튼을 누른다.
- 첫 항목 자동 선택, 선택 즉시 제출, 전체 동의, 자동 약관 동의는 하지 않는다.
- `checked=true`는 원격 DOM의 현재 상태일 뿐 자동 사용자 결정이 아니다.
- 단일 선택 유형은 checked 항목이 정확히 하나일 때만 초기 선택으로 표시한다.
- 약관은 checked 항목을 초기 집합으로 표시하고, 필수 약관을 모두 선택해야 확인할 수 있다.
- 약관 제출 배열은 Backend가 준 option 순서를 유지한 최종 선택 집합이다.

## 상태와 안전 Gate

로컬 제출 단계는 `IDLE`, `SELECTING`, `SUBMITTING`, `WAITING_FOR_RESUME`, `ERROR`로 구분한다. HTTP ACK는 AI 작업 완료가 아니므로 즉시 완료 상태로 바꾸지 않고 `WAITING_FOR_RESUME`에서 새 WorkflowStatus 또는 `DECISION_RESOLVED`/`DECISION_CLEAR`를 기다린다.

제출 직전에 다음 조건을 모두 다시 확인한다.

- 현재 상태가 `USER_DECISION_REQUIRED`
- Status transport가 연결되고 resync 중이 아님
- Viewer frame이 준비되고 reconnect 중이 아님
- decision의 `frameId`와 `frameSequence`가 현재 frame과 일치
- Viewer Action과 Decision 제출이 진행 중이 아님
- 필수 약관 Gate 충족
- 보안 입력, 최종 승인, 위험 경고, 종료 상태가 아님

새 decisionId에서는 선택을 초기화한다. 같은 decisionId의 갱신에서는 유효한 사용자 선택을 보존한다. 새 frame이 decision frame을 앞서거나 식별자가 다르면 stale decision을 제거한다. reset·종료·unmount·연결 복구 시작 시 진행 중 요청을 중단하고, runId와 decisionId가 다른 stale callback은 무시한다.

## UI와 접근성

`SessionIntegrationView`에서 `WorkflowStatusPanel`과 선택 패널을 형제로 표시한다. 상품·계좌·수취인은 `UserDecisionPanel`, 약관은 `TermsAgreementPanel`을 재사용한다. native radio·checkbox, fieldset·legend, 연결된 label, 실제 disabled 상태와 56px 확인 버튼을 유지한다. 제출 중에는 `aria-busy`, ACK 대기에는 `role="status"`와 `aria-live="polite"`, 오류에는 단일 `role="alert"`를 사용한다. 고정 selector `status-session-decision-submit`은 `id`와 `data-testid`가 같다.

## 보안

option label은 React text로만 출력하며 HTML로 해석하지 않는다. raw AI 응답, reasoning, prompt, Backend error body, stack trace와 내부 session/request/decision/element ID를 화면·console·URL·storage에 기록하지 않는다. 비밀번호, OTP, 인증번호, 전체 계좌번호, 주민등록번호, 전화번호로 의심되는 label은 표시 전에 차단한다. Backend를 최종 검증 및 보안 경계로 유지한다.

## 제외 및 공동 E2E 잔여 항목

- `ADDITIONAL_INFORMATION` 선택 UI
- Viewer Action API와 Decision API 통합
- Target 기반 자동 선택·자동 화면 조작
- 실제 금융거래 및 최종 승인
- URL 또는 storage에 선택 결과 저장
- 자동 retry

A·B·C 공동 환경에서는 실제 AI Engine 응답으로 네 decision 유형이 생성되는지, Backend snapshot과 STOMP 이벤트가 동일한 결정을 복원하는지, 제출 후 AI가 정확히 한 번 재개되는지, 약관 checked diff가 실제 Demo DOM에 반영되는지를 별도 E2E로 확인해야 한다.
