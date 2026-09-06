# D26 Secure User Takeover 계약

## 지원 범위

현재 구현은 **로컬 Demo/E2E 전용 headed takeover**이다. 운영 환경에서 PNG Viewer를
원격 브라우저 제어 채널로 바꾸는 기능은 제공하지 않는다. 다음 환경 변수를 명시적으로
활성화하면 세션 생성 시 Playwright Chromium이 headed로 실행된다.

```text
DDD_SECURE_TAKEOVER_DEMO_HEADED_ENABLED=true
```

사용자는 이 창에서 Backend가 관리하는 동일한 `BrowserContext`와 `Page`의 password/OTP
요소를 직접 조작하고 Demo의 완료 버튼을 직접 누른다. Backend orchestration 코드는 입력
값을 읽거나 `fill()`/`click()`하지 않는다. 입력 이벤트는 API, event, snapshot, storage,
로그 또는 AI request로 전달하지 않는다.

headed 옵션을 사용하지 않는 일반 실행 환경에는 사용자가 PNG Viewer를 통해 secure 값을
입력할 production 경계가 없으므로, 해당 환경을 D26 secure takeover 완료 환경으로 주장하지
않는다.

## 완료 API

```http
POST /api/v1/sessions/{sessionId}/secure-inputs/{secureRequestId}/complete
```

```json
{
  "requestId": "secure-completion-request-id",
  "expectedFrameId": "last-safe-frame-id",
  "expectedSequence": 10
}
```

정확히 위 세 필드만 허용한다. `value`, 길이, 마스킹 문자열, selector 및 element ID를 받지
않는다.

```json
{
  "sessionId": "session-id",
  "requestId": "secure-completion-request-id",
  "secureRequestId": "secure-request-id",
  "status": "COMPLETION_ACCEPTED",
  "message": "보안 입력 완료 여부를 확인하고 있습니다."
}
```

HTTP 응답은 인증이나 금융 처리 성공을 의미하지 않는다. UI는 event sequence를 기준으로
`SECURE_INPUT_RESOLVED` 또는 terminal 상태를 확인해야 한다.

## 완료 검증과 재개

1. session, workflow status, active latch, secure request, request ID 및 source frame 검증
2. 현재 Page가 latch에 저장된 Page URL과 정확히 일치하는지 검증
3. `[data-ddd-policy="secure-input"]` 요소가 하나도 없는지 검증
4. visible한 `[data-ddd-secure-state="completed"]` marker가 정확히 하나인지 검증
5. 제한된 1회 safe capture 허용 및 새 Frame publish
6. latch 해제 및 `SECURE_INPUT_RESOLVED` 발행
7. `PAGE_LOADING` 발행
8. Agent Loop exactly-once 재개

marker 검증 전에는 screenshot, Sanitized DOM, AI 및 일반 Action 차단을 유지한다. marker 없이
input만 사라진 경우, input이 남은 경우, 다른 Page, stale frame, duplicate/busy request 또는
safe Frame 실패는 fail-closed 처리한다.

## Lifecycle

- completion timeout 기본값: 5분 (`DDD_SECURE_COMPLETION_TIMEOUT`)
- UI/WebSocket disconnect: latch를 즉시 제거하지 않고 reconnect snapshot 복원을 위해 timeout까지 유지
- timeout: latch/idempotency/lock, BrowserContext, Frame 및 Frame WebSocket 정리 후 ERROR
- cancel/terminal: secure event와 registry 정리
- 성공: 이전 request ID와 secure request를 재사용할 수 없음
- production profile: 완료 API는 HTTPS request만 허용

## UI event payload

`SECURE_INPUT_REQUIRED`는 `secureRequestId`, `secureInputType`, 마지막 안전 `frameId`,
`frameSequence`, 정제된 `message`를 포함한다. `SECURE_INPUT_RESOLVED`는 같은 request ID와
새 안전 Frame identity를 포함한다. reconnect snapshot에는 active request만 남으며 resolved,
cancel 및 terminal 상태에서는 제거된다.

## 전용 오류 코드

- `SECURE_404_REQUEST_NOT_FOUND`
- `SECURE_409_REQUEST_MISMATCH`
- `SECURE_409_STALE_FRAME`
- `SECURE_409_DUPLICATE_REQUEST`
- `SECURE_409_COMPLETION_BUSY`
- `SECURE_409_MARKER_MISSING`
- `SECURE_409_INPUT_ACTIVE`
- `SECURE_409_SESSION_TERMINATED`
- `SECURE_409_INVALID_STATUS`
- `SECURE_408_COMPLETION_TIMEOUT`
- `SECURE_503_SAFE_FRAME_FAILED`
- `SECURE_409_REQUEST_ABORTED`

오류 응답은 고정된 안전 메시지만 사용하며 raw 값, selector, DOM, URL 또는 stack trace를
포함하지 않는다.
