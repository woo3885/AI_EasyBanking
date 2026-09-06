# 프론트 D17 실제 세션·프레임 연동

## 목적과 범위

D17은 실제 Backend에서 데모 세션을 생성하고 `/transfer/accounts`의 첫 1280×720 PNG 프레임을 raw WebSocket으로 받아 기존 `F2_StreamViewer` Canvas에 표시한다. 이 화면은 연동 확인용 개발 Preview이며 실제 금융거래를 수행하지 않는다.

Viewer 클릭 Action, AI Engine, Target Highlight, 사용자 선택 제출, 보안 입력, 최종 확인과 자동 reconnect는 D17 범위에서 제외한다. D16 Integration Mock Preview와 실제 연결 상태·transport는 서로 공유하지 않는다.

## Session REST 계약

Frontend는 `POST /api/v1/sessions`에 다음 요청을 보낸다.

```json
{
  "userRequest": "계좌 선택 화면을 확인합니다.",
  "siteId": "demo-bank",
  "initialPath": "/transfer/accounts"
}
```

공통 envelope의 `success`가 `true`인지 확인하고 `data`에서 다음 값을 검증한다.

- `sessionId`
- `status`: 기존 `WorkflowStatus` allowlist
- `frameWebSocketPath`: `/ws/sessions/{sessionId}/frames`
- `frameProtocol`: `ddd.browser-frame.v1`

현재 Backend 응답에는 완전한 `webSocketUrl`이 없다. Frontend는 검증된 Backend base URL의 `http`를 `ws`, `https`를 `wss`로 변환하고 동일 origin에 canonical `frameWebSocketPath`를 결합한다. 다른 host, userinfo, query, hash 또는 traversal 경로는 거부한다.

`getSession()`은 `GET /api/v1/sessions/{sessionId}`, `cancelSession()`은 `POST /api/v1/sessions/{sessionId}/cancel`을 사용한다. HTTP 오류와 Backend의 raw 오류 본문은 사용자 화면에 표시하지 않는다.

저장소의 `docs/backend/api-spec.md` 세션 예시는 아직 D17의 `siteId`, `initialPath`, frame 응답 필드를 반영하지 않은 구형 문서다. 프론트 D17은 실제 Backend production DTO를 기준으로 구현했으며 Backend 문서는 수정하지 않았다.

## Raw WebSocket과 프레임 규격

WebSocket endpoint는 `/ws/sessions/{sessionId}/frames`, subprotocol은 `ddd.browser-frame.v1`이다. STOMP나 Base64 JSON을 사용하지 않으며 `binaryType`은 `arraybuffer`다.

한 프레임은 다음 순서로 수신한다.

1. metadata `TextMessage`
2. 바로 다음 PNG `BinaryMessage`

metadata는 `type`, `sessionId`, `frameId`, `sequence`, `timestamp`, `width`, `height`, `mimeType`, `byteLength`를 검증한다. 해상도는 1280×720, MIME은 `image/png`, 크기는 1 byte 이상 5 MiB 이하여야 한다. `timestamp`는 Unix epoch millisecond이고 `sequence`는 1 이상의 안전한 정수다.

metadata 없이 Binary가 오거나, Binary 대기 중 metadata가 다시 오거나, 길이·세션·MIME·해상도가 맞지 않으면 안전한 protocol 오류로 종료한다. unknown 필드에는 의존하지 않는다.

## sequence와 stale 정책

- 첫 sequence를 수용한다.
- 마지막 수용 sequence보다 큰 값만 새 프레임으로 수용한다.
- 같은 sequence는 duplicate, 더 작은 sequence는 stale로 간주해 Binary까지 소비한 뒤 무시한다.
- 새 transport 연결과 disconnect에서 sequence 기준을 초기화한다.
- reset 이후 또는 현재 runId와 다른 callback은 무시한다.
- 누락 sequence 복구, ACK와 자동 reconnect는 구현하지 않는다.

## Object URL 생명주기

Object URL은 `session-frame-transport`가 소유한다. 검증된 Binary로 `image/png` Blob을 만든 뒤 Object URL을 생성하고 `ViewerFrame`으로 변환한다. byte 배열은 React state, storage 또는 로그에 저장하지 않는다.

- 새 프레임을 수용하면 이전 URL revoke
- frame 처리 실패 시 생성 중인 URL 정리
- disconnect·reset·unmount에서 현재 URL revoke
- 동일 URL 중복 revoke 방지

## reducer와 hook 생명주기

실제 연결 전용 phase는 `IDLE`, `CREATING_SESSION`, `CONNECTING_FRAME`, `WAITING_FIRST_FRAME`, `FRAME_READY`, `DISCONNECTED`, `ERROR`다. D16의 `MOCK_CONNECTED`를 재사용하지 않는다.

`useSessionFrameIntegration`은 mount만으로 시작하지 않는다. 사용자가 시작하면 REST 세션 생성 후 WebSocket을 연결한다. reset과 unmount는 socket과 listener를 먼저 정리하고 생성된 session을 best-effort로 취소한다. runId로 이전 REST 응답과 WebSocket callback을 차단한다. 취소 실패도 raw 오류 대신 안전한 정리 안내만 제공한다.

## 개발 Preview 진입

개발 서버에서만 정확한 query로 접근할 수 있다.

```text
http://127.0.0.1:5173/?preview=session-frame
```

production build와 다른 query에서는 기존 Dashboard를 렌더링한다. URL에 sessionId나 민감정보를 넣지 않는다. Preview는 기존 F2 Viewer에 실제 frame만 전달하며 Mock fallback, F3 Target, 사용자 패널과 Viewer 클릭 handler를 렌더링하지 않는다.

## 실행 환경과 CORS

Frontend:

```text
VITE_BACKEND_BASE_URL=http://127.0.0.1:8080
```

Backend:

```text
DDD_DEMO_BANK_ENABLED=true
DEMO_BANK_BASE_URL=http://127.0.0.1:5190
```

Backend 코드의 REST와 Frame WebSocket 기본 허용 origin은 `http://127.0.0.1:5173`이다. `localhost:5173`을 사용할 때는 `DDD_REST_CORS_ALLOWED_ORIGINS`와 `DDD_FRAME_WS_ALLOWED_ORIGINS`에 해당 origin을 추가해야 한다. wildcard와 credentials는 사용하지 않는다.

## 보안과 알려진 한계

- D17은 `/transfer/accounts`만 연다.
- password·OTP·최종 실행 화면으로 이동하지 않는다.
- sessionId, endpoint, raw 응답, frame byte, stack과 token을 UI·로그·storage에 남기지 않는다.
- Backend cancel이 열린 Frame WebSocket을 직접 닫지 않으므로 Frontend가 socket을 먼저 닫는다.
- Backend secure-input detector는 존재하지만 명시적 latch와 사용자 입력 완료 전 재개 금지 lifecycle은 미완료다. 따라서 D17은 보안 입력 경로를 다루지 않는다.

## 검증과 후속 범위

자동 테스트는 REST 계약·timeout·abort, raw frame pairing·validation·sequence·Object URL, reducer runId, hook reset·unmount, Preview selector와 App DEV gate를 검증한다. 실제 Canvas 완료는 Demo, Backend, Frontend를 함께 실행해 브라우저에서 `READY` 상태를 확인해야 한다.

D18 이후에는 상태 이벤트와 사용자 상호작용 연동을, D19 이후에는 보안 lifecycle과 실제 통합 회귀 범위를 별도 계약에 따라 확장한다.
