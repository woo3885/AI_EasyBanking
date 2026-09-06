# D17 Viewer Frame·Action 연동 기반

## 목적

데모 일정 D17을 재개하기 위해 실제 session-frame 수신 결과를 Viewer Action
요청에 사용할 수 있는 형태로 보존하고, Backend 공개 Action API의 typed REST
client 경계를 마련한다. 이번 단계는 사용자 클릭을 실제 Action으로 연결하기 전
기반 작업이며 D17 전체 완료를 의미하지 않는다.

## 현재 session-frame 범위

프론트에는 session REST 생성·조회·취소, raw WebSocket 연결, metadata 다음 PNG
Binary를 결합하는 transport, Object URL 정리, reducer runId 격리와 F2 Canvas
표시가 구현돼 있다. 실제 연결 화면은 개발 환경의 정확한
`?preview=session-frame` query에서만 열리며 production App 기본 화면에는 연결하지
않는다.

`SessionViewerFrame`은 기존 F2 `ViewerFrame`과 호환되면서 Backend가 검증한 다음
metadata를 보존한다.

- `frameId`
- `sequence`
- `timestamp` (Unix epoch millisecond)
- `width`, `height`
- `mimeType`, `byteLength`

metadata와 Binary가 모두 검증된 뒤 하나의 frame으로 reducer에 전달된다. 다음
frame은 이미지와 metadata를 한 번에 교체한다. 같은 sequence와 더 오래된
sequence는 Binary까지 소비한 뒤 무시한다. reset, disconnect와 error에서는 현재
frame을 제거하며 Object URL 정리 계약을 유지한다.

## Backend 공개 Action 계약

production Controller 기준 endpoint는 다음과 같다.

```text
POST /api/v1/sessions/{sessionId}/actions
Content-Type: application/json
```

요청은 Backend 실제 DTO와 같은 형태다.

```json
{
  "requestId": "request_123",
  "actionType": "CLICK",
  "elementId": "el-Ab12cd34-001",
  "expectedFrameId": "frm-12345678-1234-1234-1234-123456789abc",
  "expectedSequence": 1
}
```

- `requestId`: 영문·숫자·underscore·hyphen, 최대 100자
- `actionType`: 공개 1차 계약은 `CLICK`만 허용
- `elementId`: `^el-[A-Za-z0-9]{8}-\d{3}$`
- `expectedFrameId`: 현재 Viewer가 표시하는 안전한 frame ID
- `expectedSequence`: 1 이상의 안전한 정수
- `sessionId`: request body가 아니라 URL path에서만 사용

성공 envelope의 `data`는 다음 필드로 구성된다.

```json
{
  "requestId": "request_123",
  "actionType": "CLICK",
  "status": "EXECUTED",
  "message": "화면 요소를 선택했습니다.",
  "frameId": "frm-22345678-1234-1234-1234-123456789abc",
  "sequence": 2,
  "frameAdvanced": true
}
```

허용 status는 `EXECUTED`, `NO_ACTION`, `USER_ACTION_REQUIRED`,
`SECURE_INPUT_REQUIRED`, `FINAL_CONFIRMATION_REQUIRED`, `BLOCKED`, `STOPPED`다.
Action이 실행돼도 후속 화면이 보안 입력이거나 capture가 실패하면 기존 안전
frame이 유지될 수 있으므로 `EXECUTED`만으로 frame 증가를 추정하지 않는다.
`frameAdvanced`와 실제 `frameId/sequence` 조합을 함께 검증한다.

Backend의 실제 오류 status는 400, 404, 409, 500이다. stale frame, duplicate
request, frame 미준비를 각각 고정된 안전한 한국어 오류로 변환한다. raw body,
stack, endpoint, session ID, selector와 Playwright 오류는 UI에 노출하지 않는다.

## Action client 책임

`BrowserActionClient`는 다음만 담당한다.

- Backend base URL과 canonical Action path 생성
- 정확한 request key·형식 검증
- POST JSON 요청과 `AbortSignal` 전달
- JSON content type, envelope와 response runtime 검증
- requestId 및 frame 진행 관계 확인
- timeout·abort·HTTP·protocol 오류의 안전한 분류

client 생성, component mount, frame 수신, Target 변경, timer 또는 App 시작만으로
요청하지 않는다. 자동 retry도 하지 않는다. 호출자는 이후 Target와 사용자
명시 클릭을 검증한 경계에서만 `submitBrowserAction`을 호출해야 한다.

## 사용자 Action과 AI Action

이번 client는 Viewer 사용자가 명시적으로 요청하는 public Action API 전용이다.
Backend 내부 AI Action 경로와 합치지 않는다. 요청 body에 selector, 좌표, AI
reasoning, session ID, Target rect, 비밀번호, OTP 또는 최종 승인 데이터를 추가하지
않는다.

프론트 validation은 조기 오류 방지용이다. Backend는 session 존재 여부, 최신
frame, request idempotency, element registry, 실제 DOM 상태와 보안 정책을 반드시
다시 검증한다.

## 보안 원칙

- Demo selector를 elementId로 하드코딩하지 않는다.
- `#button`, `.class`, `[data-*]` 같은 raw selector를 허용하지 않는다.
- 비밀번호·OTP·final-confirmation selector를 일반 Action으로 전달하지 않는다.
- frame bytes, session ID와 raw 오류를 로그에 남기지 않는다.
- storage와 URL query에 Action 정보를 저장하지 않는다.
- 자동 클릭, 자동 재시도, secure input과 최종 승인을 구현하지 않는다.

Backend의 opaque elementId는 의미를 프론트 문자열만으로 판별할 수 없다. 따라서
정규식 검증 외에 실제 요소의 secure/final 정책 차단은 Backend 재검증이 책임진다.

## 이번 단계 제외 범위와 blocker

F2 Canvas click/pointer handler, 좌표 Action, Target 추정, Demo selector
하드코딩, 실제 Action UI 호출, STOMP, App production 연결과 Demo·Backend·AI
Engine 변경은 제외한다.

다음 단계에는 현재 frame과 연계된 production Target event가 필요하다. Target는
최소한 `elementId`, `frameId`, `sequence`의 관계를 제공해야 stale Target를
차단할 수 있다. 현재 프론트에는 production Target 수신 경로가 없으므로 실제
Viewer 클릭을 안전하게 만들 수 없다.

또한 실제 3프로세스 E2E는 검증되지 않았다. Java 21, Playwright Chromium,
Demo 5190, Backend 8080, Frontend 5173 환경이 준비돼야 한다.

## 후속 완료 조건

```text
Target 수신
→ Target frameId·sequence 검증
→ 사용자 명시 클릭
→ elementId Action 요청
→ Backend 보안 정책 재검증
→ Playwright 클릭
→ 증가한 sequence의 새 frame 수신
```

위 흐름에서 secure input, final confirmation, stale frame, duplicate request,
disconnect와 session cleanup까지 실제 브라우저로 확인해야 D17 전체가 완료된다.
