# 프론트 D23 WorkflowStatus·message·Target 실시간 연동

## 범위

D23은 Backend가 발행하는 안전한 `WorkflowStatus`, 안내 `message`, Production
Target을 메인 프론트에 연결한다. 사용자 선택 결과 제출, 보안 입력 완료, 최종
승인 전송은 각각 D24, D26, D27 범위로 남긴다. Production payload에 없는
options·terms·거래 summary를 Mock 데이터로 보충하지 않는다.

기준 Backend 계약은 PR #79, merge commit `5372414`, 원본 commit
`0f29d95`이다.

## Transport 계약

- STOMP WebSocket endpoint: `/ws`
- UI event topic: `/topic/sessions/{sessionId}/events`
- reconnect snapshot: `GET /api/v1/sessions/{sessionId}/events/latest`
- heartbeat: incoming/outgoing 각각 10초
- SockJS는 사용하지 않는다.
- STOMP 구현은 `@stomp/stompjs`를 사용하며 protocol을 직접 재구현하지 않는다.

Frontend는 Backend base URL과 동일한 host에만 `/ws`를 결합한다. userinfo,
query, hash 또는 별도 path가 있는 base URL은 기존 REST URL 검증에서 거부한다.
topic의 `sessionId`도 현재 session과 정확히 일치해야 한다.

## Event와 sequence

실제 JSON 필드는 다음과 같다.

```text
eventId
eventSequence
eventType
sessionId
status
message
actionRequired
target
occurredAt
```

지원하는 `eventType`은 `STATE`, `GUIDE`, `TARGET`, `TARGET_CLEAR`이다. 알 수
없는 type, 잘못된 timestamp·sequence, session mismatch, malformed JSON은
fail-closed 처리한다. raw payload는 상태나 로그에 저장하지 않는다.

연결 및 reconnect 시 race는 다음 순서로 처리한다.

```text
STOMP 연결·topic 구독
→ live event 최대 100개 임시 buffer
→ latest snapshot 조회
→ snapshot 원자적 적용
→ snapshot sequence보다 큰 event만 sequence 순으로 적용
→ live mode 전환
```

같거나 작은 sequence는 duplicate 또는 stale event로 간주해 무시한다. reconnect
시 기존 Target은 먼저 지우고 snapshot으로 현재 Target을 복구한다.

## WorkflowStatus와 message

12개 `WorkflowStatus`를 모두 기존 `WorkflowStatusPanel`로 표시한다. 상태별
풍부한 payload가 없는 D23에서는 전문 Panel에 가짜 데이터를 전달하지 않는다.

message는 React text로만 렌더링한다. Frontend 방어 계층은 앞뒤 공백 제거,
500자 제한, HTML·제어 문자·과도한 줄바꿈·OTP·비밀번호·전체 계좌번호 의심
패턴 거부를 수행한다. 안전하지 않거나 빈 message는 기존 상태 presentation의
기본 문장으로 대체한다. 오류 UI에는 raw message를 다시 표시하지 않는다.

이 검증은 Backend의 보안 정제를 대신하지 않는 방어 계층이다.

## Target–Frame 결합과 clear

Target payload는 다음 필드를 사용한다.

```text
elementId, label, x, y, width, height,
frameId, frameSequence, snapshotId
```

Target은 현재 Viewer frame의 `frameId`와 `sequence`가 모두 일치하고, UI event
연결이 완료됐으며 Frame reconnect나 Action이 진행 중이지 않을 때만 표시한다.
Target이 먼저 오면 제한된 state에 보관하고 matching frame을 기다린다. 더 큰
frame이 먼저 오거나 같은 sequence의 다른 frame이 오면 이전 Target을 폐기한다.
`TARGET_CLEAR`는 표시 Target과 pending Target을 즉시 제거한다.

다음 상태에서는 Target과 일반 Viewer Action을 차단한다.

```text
SECURE_INPUT_REQUIRED
FINAL_CONFIRMATION_REQUIRED
RISK_WARNING
COMPLETED
CANCELLED
ERROR
TERMINATED
```

F3 Overlay는 Production `label`을 접근 가능한 안내에 사용하며 opaque
`elementId`나 좌표를 사용자에게 읽어 주지 않는다. 기존 좌표 변환, clip,
dim·blur·magnifier와 `pointer-events: none` 정책은 유지한다. Target 이벤트는
자동 CLICK·SCROLL을 발생시키지 않는다.

## Production App 흐름

```text
Dashboard에서 사이트·업무를 사용자 직접 선택
→ Backend session 정확히 한 번 생성
→ 생성된 BackendSession을 SessionIntegrationView에 전달
→ 동일 sessionId로 Frame transport와 UI event transport 연결
```

Integration View가 session을 다시 생성하지 않는다. mount만으로 새 session을
자동 생성하지 않으며 session ID, event ID, endpoint는 UI에 표시하지 않는다.
사용자가 종료 버튼을 누르면 Frame 연결을 해제하고 session cancel을 요청한 뒤
Dashboard로 돌아간다. 기존 `?preview=session-frame` 개발 경로는 유지된다.

## 접근성과 보안

- Workflow 상태는 기존 heading과 polite live region을 사용한다.
- F3는 별도의 중복 live region을 만들지 않는다.
- 위험·오류 안내를 같은 문장으로 중복 낭독하지 않는다.
- 상태 변경 시 focus를 자동 이동하지 않는다.
- 연결·Action 중에는 `aria-busy`와 실제 `disabled`를 사용한다.
- 기존 focus-visible, reduced-motion, forced-colors 스타일을 유지한다.
- raw AI output, reasoning, prompt, stack, 민감정보를 표시·저장·로그하지 않는다.
- 상태 수신만으로 Action 또는 TTS를 자동 실행하지 않는다.

## 알려진 공동 blocker와 후속 일정

AI Engine의 `StructuredAIResponse`가 Backend action adapter를 통과할 때
`status`, 원본 `message`, `decisionType`, options, `secureInputType`,
confirmation summary, risk payload 등이 아직 소실된다. 따라서 D23은 Backend가
현재 안전하게 발행하는 공통 상태·고정 message·Target까지만 완료한다.

- D24: 사용자 선택·약관 결과 전송과 production options·terms 계약
- D26: secure 입력 완료 transport와 전체 보안 입력 통합
- D27: 최종 승인·거절 transport와 transaction summary 계약

실제 Backend·Demo·AI Engine을 함께 실행하는 브라우저 E2E는 각 서비스와 Java
21·Playwright 환경이 준비된 뒤 별도로 확인한다.
