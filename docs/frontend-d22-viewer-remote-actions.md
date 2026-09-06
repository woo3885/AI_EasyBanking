# 메인 프론트 D22 Viewer 원격 조작

## 목적과 범위

D22는 실제 Session Frame Viewer에서 사용자가 직접 발생시킨 `CLICK`과
`SCROLL`을 Backend Public Browser Action API로 전달한다. F2 Viewer는 좌표와
현재 frame metadata를 담은 typed callback만 제공하며 REST 호출과 요청 상태는
Integration 계층이 담당한다.

Production Target, 상태·안내 message 자동 전환, Target 기반 키보드 대체
control은 D23 범위다. Demo, Backend, AI Engine 및 실제 금융거래 코드는 이
작업에서 변경하지 않는다.

## Backend 기준 계약

기준 커밋은 Backend PR #76의 `9ea73fb`이며 endpoint는 다음과 같다.

```text
POST /api/v1/sessions/{sessionId}/actions
```

좌표 `CLICK` 요청 필드:

```text
requestId, actionType=CLICK, source=USER_VIEWER,
x, y, expectedFrameId, expectedSequence
```

`SCROLL` 요청 필드:

```text
requestId, actionType=SCROLL, source=USER_VIEWER,
x, y, deltaX, deltaY, expectedFrameId, expectedSequence
```

- 좌표는 1280×720 CSS viewport의 정수 pixel이다.
- `x`는 0~1279, `y`는 0~719 범위다.
- scroll delta는 CSS pixel 정수이며 축별 -3000~3000이다.
- `deltaX`와 `deltaY`가 모두 0인 요청은 허용하지 않는다.
- elementId CLICK 호환 계약은 client의 별도 union 멤버로 유지한다.
- Public API source는 `USER_VIEWER`만 허용된다.

Backend는 현재 frame ID·sequence, session별 단일 in-flight, requestId 중복,
SCROLL rate limit을 검증한다. 좌표 아래 현재 DOM을 다시 hit-test하여
visible·enabled, iframe, secure input, final confirmation, risk 상태를
fail-closed로 검사한다. 프론트는 이 검사를 우회하지 않는다.

## 좌표 변환

Viewer는 다음 순서로 좌표를 만든다.

```text
Pointer/Wheel clientX·clientY
→ Canvas getBoundingClientRect 기준 local 좌표
→ contain scale과 letterbox offset 제거
→ 1280×720 server 좌표
→ 현재 포인터가 속한 정수 pixel로 내림
```

Canvas 밖, letterbox, 유효하지 않은 frame metadata는 callback을 만들지 않는다.
D8 변환 유틸의 계산 정밀도는 유지하고 Backend DTO로 넘기는 최종 경계에서만
정수화한다.

## CLICK과 touch

- `pointerup`에서 primary pointer의 기본 버튼만 처리한다.
- mouse, pen, touch는 동일한 Pointer Event 경계를 사용한다.
- mount, frame 변경, 이미지 load 또는 rerender만으로 Action을 만들지 않는다.
- disabled 또는 busy 상태에서는 callback을 호출하지 않는다.
- Action pending 중 추가 pointer 입력을 차단한다.

## SCROLL

- Viewer canvas에서 발생한 wheel/trackpad 이벤트만 사용한다.
- Backend 단위가 CSS pixel이므로 `deltaMode=0`만 전송한다.
- line/page delta를 임의 숫자로 환산하지 않고 무시한다.
- 유효한 원격 SCROLL을 실제로 전달할 때만 `preventDefault()`를 호출한다.
- disabled, busy, letterbox, zero delta에서는 페이지 기본 스크롤을 막지 않는다.
- 임의 throttle을 추가하지 않고 프론트 단일 in-flight와 Backend 50ms rate
  limit을 함께 사용한다.

## Action 수명주기

```text
FRAME_READY
→ 사용자 CLICK/SCROLL
→ 현재 frameId·sequence 일치 확인
→ requestId 한 개 생성
→ REST 요청 정확히 한 번
→ frameAdvanced=false이면 안전한 결과 안내 후 pending 해제
→ frameAdvanced=true이면 응답 frameId·sequence 대기
→ matching Binary frame 수신
→ Action 완료
```

HTTP 응답만으로 advanced Action을 완료하지 않는다. Binary frame이 응답보다
먼저 도착하는 race는 마지막 수신 frame과 응답 metadata를 비교하여 완료한다.
다른 frame이나 stale frame은 완료 조건으로 사용하지 않는다. Backend에 별도
frame timeout 계약이 없으므로 임의 timer나 자동 재전송을 추가하지 않았다.
사용자는 disconnect, reset 또는 명시적 재시도 경계로 복구한다.

## Gate와 cleanup

다음 조건을 모두 만족해야 요청할 수 있다.

- `phase === FRAME_READY`
- recovery pending이 아님
- Action pending이 아님
- 실제 session과 현재 frame metadata가 존재함
- callback metadata가 현재 표시 frame과 정확히 일치함

생성·연결·첫 frame 대기·재연결·연결 종료·오류·Action 처리 중에는 요청을
차단한다. reset, disconnect, unmount에서는 Action fetch를 abort하고 이전 run의
응답을 무시한다. 기존 transport의 Object URL revoke와 session cancel 동작은
유지한다.

Frontend 실제 SessionFrame 흐름에는 live WorkflowStatus가 아직 결합되지
않았으므로 secure·final·risk 상태를 프론트가 선제 확인한다고 주장하지 않는다.
최종 보안 경계는 Backend이며, non-advanced 보안 결과를 안전한 고정 안내로만
표시한다.

## UI와 접근성

신규 selector:

```text
notice-session-frame-interaction
status-session-frame-action
```

두 selector 모두 `id`와 `data-testid`가 같다. 화면은 조작 가능 여부, 클릭·스크롤
처리 중, 새 frame 대기, 완료, 안전한 오류를 텍스트로 표시한다. 처리 중 Preview와
Viewer에는 `aria-busy`를 적용한다. 정상 결과는 `role="status"`와
`aria-live="polite"`, Action 오류는 `role="alert"`로 알린다.

Canvas의 기존 `role="img"`를 유지하며 허위 button role이나 자동 focus를
추가하지 않는다. Target label이 없는 임의 좌표 Action은 키보드로 동일하게
표현할 수 없으므로 pointer-only 한계를 명시한다. Target 기반 키보드 control은
D23에서 구현한다. 기존 reset·retry button과 focus-visible 동작은 유지한다.

UI에는 sessionId, requestId, endpoint, 원시 좌표, Backend 원문 message,
selector, elementId 또는 stack을 표시하지 않는다. console, storage, URL에도
이 정보를 기록하지 않는다.

## 검증

```powershell
npm.cmd test -- --run --exclude "ai-engine/**"
npm.cmd run build
git diff --check
```

단위 테스트는 좌표·letterbox·경계·resize, CLICK·SCROLL payload, exact-key
검증, 단일 in-flight, response/frame race, stale frame, abort와 UI 접근성 상태를
검증한다.

실제 브라우저 E2E는 Demo 5190, Backend 8080, Frontend 5173 환경이 모두
준비됐을 때 별도로 수행한다. 첫 frame 이후 안전한 좌표 클릭, 세로·가로
스크롤, sequence 증가, reconnect 차단, Backend 보안 차단을 확인해야 한다.
