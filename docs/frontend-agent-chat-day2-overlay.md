# Frontend Agent Chat Day 2 — Same-page Overlay

## 목적과 범위

Demo Bank의 실제 DOM을 주 화면으로 유지하면서 Backend가 제공한 안전한 공개 Target을 강조하고, 사용자가 실제 요소를 직접 누른 사실을 Backend에 전달한다. Canvas Viewer 좌표, 자동 클릭, raw selector는 이 경로에서 사용하지 않는다.

## Backend wire 계약

대화 WebSocket `/topic/sessions/{sessionId}/events`에서 다음 event를 수신한다.

- `OVERLAY_TARGET`: `targetId`, `pageIdentity`, `sourceSnapshotId`, `VIEWPORT_CSS_PX` rectangle/viewport, role, label, guide, `GUIDE_USER_CLICK`, expiresAt
- `OVERLAY_CLEAR`: 현재 Target identity와 clear reason
- `USER_ACTION_OBSERVED`: request/target/page/snapshot identity, resultingSnapshotId, `DOM_CHANGE_CONFIRMED`

Parser는 Backend ObjectMapper 필드명을 그대로 사용한다. unknown field, raw selector·elementId, HTML·제어문자, 유효하지 않은 좌표, 다른 session/page, viewport mismatch, 만료 Target은 fail-closed 처리한다.

## Overlay 표시

`DomTargetOverlay`는 `position: fixed`로 Backend의 `VIEWPORT_CSS_PX` 값을 그대로 사용한다. `devicePixelRatio`를 다시 적용하지 않는다. 강조선과 안내문 전체는 `pointer-events: none`이고 `data-ddd-agent-ui="true"` 경계 안에 있다. 안내는 target의 안전한 label·role·guide를 `role="status"` live region으로 함께 제공한다.

Frontend는 `element.click()`, 자동 scroll, 자동 focus, 자동 click을 실행하지 않는다. 사용자가 실제 DOM 요소를 누르면 role과 현재 bounding rectangle을 공개 Target과 대조한다. Overlay 자체나 Agent UI에서 발생한 click은 관찰하지 않는다.

## Target 수명

다음 경우 현재 Overlay를 즉시 제거한다.

- `OVERLAY_CLEAR`, expiresAt 경과, 새 Target
- pageIdentity·sourceSnapshotId·session 변경
- navigation, scroll, resize, reconnect, reset, unmount
- secure input, risk warning, final confirmation, terminal 상태

scroll·resize 뒤 기존 좌표를 재계산하거나 다시 표시하지 않는다. 새 `OVERLAY_TARGET` 또는 유효한 bridge activeTarget을 기다린다.

## Click observation

실제 target click은 `POST /api/v1/sessions/{sessionId}/interaction-observations`로 한 번만 전송한다. body는 `requestId`, `targetId`, `sourceSnapshotId`, `observationType: USER_CLICK`, `clientOccurredAt`을 포함한다. `X-DDD-Bridge-Token`과 `X-DDD-Page-Identity`를 명시하며, `Origin`은 브라우저가 현재 Demo origin으로 자동 부여한다.

202 `OBSERVATION_ACCEPTED` ACK는 요청 접수만 뜻한다. UI는 `WAITING_FOR_RESULT`를 유지하고, identity가 일치하는 `USER_ACTION_OBSERVED`의 `DOM_CHANGE_CONFIRMED`가 와야 관찰을 완료한다. 실패 요청은 자동 재시도하지 않는다.

## 전체 페이지 복원

Backend가 주입한 `window.__DDD_AGENT_BRIDGE__`의 sessionId·bridgeToken·pageIdentity만 사용한다. bridge recovery endpoint로 destination, snapshot path, 만료, optional activeTarget을 검증한 다음 기존 STOMP transport를 재구독하고 authoritative conversation snapshot을 조회한다.

대화 원문이나 session을 Web Storage·URL·console에 저장하지 않으며, 페이지 로드만으로 사용자 메시지나 AI 판단을 재전송하지 않는다.

## STOMP 안전 처리

Native client는 WebSocket message에 걸쳐 분할된 STOMP frame을 누적하고, 한 message의 복수 frame과 UTF-8 byte 기준 `content-length`, NULL terminator를 처리한다. malformed frame과 STOMP `ERROR`는 fail-closed하며 subscription과 reconnect timer를 정리한다.

## 접근성과 기존 Gate

- Overlay는 색상과 함께 target label·role·행동 문장을 제공한다.
- 자동 focus 이동과 필수 animation은 없다.
- `prefers-reduced-motion` 설정을 유지한다.
- 메시지 전송 버튼의 disabled 이유는 `aria-describedby`로 연결한다.
- STT는 draft만 변경하고 미지원 또는 secure·risk·final·terminal·reconnect 상태에서는 시작하지 않는다.
- TTS 자동 재생, Browser Action, 자동 선택·약관 동의·보안 입력·최종 승인은 수행하지 않는다.

## 검증 범위와 남은 Blocker

Backend ObjectMapper fixture 기반 parser, reducer, bridge recovery, DOM click observation, lifecycle, STOMP decoder를 자동 테스트한다. 현재 Backend production 흐름에서 `OverlayTargetService.create` 호출과 observation 이후 `ConversationObservationResumePort` 구현이 연결되지 않아 실제 `OVERLAY_TARGET` 발생 및 전체 사용자 click E2E는 B·C 후속 연결 전까지 **BLOCKED**다. 이 제한은 fixture 기반 Frontend 구현 완료와 별도로 관리한다.
