# 프론트 D21 프레임 연결 상태·복구

## 목적과 범위

개발자 A 메인 D21의 공식 목표는 프레임 지연·끊김·재연결을 처리하고 연결 상태와 복구 경계를 제공하는 것이다. 이번 구현은 기존 Session REST와 raw Frame WebSocket을 그대로 사용해 연결 종료를 안전하게 분류하고, 동일 Backend session의 Frame WebSocket을 다시 연결한다.

이번 범위는 메인 프론트 전용이다. 데모사이트 D21, Demo Integration D17 Viewer Action, 실제 금융 Action, Backend와 AI Engine 구현은 포함하지 않는다.

## 현재 Session Frame 구조

사용자가 DEV Preview에서 시작을 누르면 다음 순서로 실행된다.

1. `POST /api/v1/sessions`로 데모 session 생성
2. 응답의 검증된 Frame WebSocket 경로와 `ddd.browser-frame.v1` 사용
3. metadata TextMessage 다음 PNG BinaryMessage 결합
4. 1280×720 프레임을 F2 Canvas Viewer에 전달
5. reset 또는 unmount에서 socket을 닫고 session을 best-effort로 취소

기존 metadata 검증, Binary pairing, stale·duplicate sequence 무시, Object URL revoke와 runId 기반 stale callback 차단은 유지한다.

## 연결 종료 분류

`frame-reconnect-policy.ts`는 raw close reason을 보관하거나 표시하지 않고 close code와 clean 여부만 입력받는다. 표준 close code는 다음과 같이 안전한 category로 변환한다.

| 분류 | 예시 close code | 자동 재연결 |
|---|---:|---|
| `TRANSIENT` | 1001, 1006, 1011~1014 | 주입된 정책이 있을 때만 가능 |
| `NORMAL` | 1000 | 금지 |
| `PROTOCOL` | 1002, 1010 | 금지 |
| `UNSUPPORTED_DATA` | 1003 | 금지 |
| `INVALID_PAYLOAD` | 1007 | 금지 |
| `POLICY_VIOLATION` | 1008 | 금지 |
| `MESSAGE_TOO_LARGE` | 1009 | 금지 |
| `SECURITY` | 1015 | 금지 |
| `UNKNOWN` | 분류되지 않은 code | 금지 |

알 수 없는 종료는 fail-closed로 처리한다. protocol, payload, 정책, 권한과 보안 관련 종료는 자동 또는 수동 재시도 대상으로 만들지 않는다.

## reconnect lifecycle

일시적인 연결 종료가 발생하면 다음과 같이 처리한다.

```text
FRAME_READY 또는 WAITING_FIRST_FRAME
→ RECONNECTING
→ 주입된 delay 후 같은 session의 새 Frame WebSocket 생성
→ CONNECTED 상태만으로는 복구 완료로 보지 않음
→ 마지막 sequence보다 큰 frame 수신
→ FRAME_READY
```

복구 성공 전에는 `recoveryPending=true`이며 Viewer Action 경계는 닫힌다. `canSubmitViewerAction`은 `FRAME_READY`이고 복구가 진행 중이지 않을 때만 `true`다. 이번 D21은 이 값만 제공하며 `browser-action-client`를 호출하지 않는다.

## sequence 연속성

Hook이 마지막으로 수용한 sequence를 session lifecycle 동안 보존하고 새 transport의 `initialSequence`로 전달한다.

- reconnect 직후 같은 최신 sequence가 다시 오면 metadata와 Binary를 소비한 뒤 무시
- 마지막 수용 sequence보다 작은 frame은 stale로 무시
- 더 큰 sequence만 새 Object URL과 Viewer frame으로 반영
- reconnect 성공은 더 큰 유효 frame을 받은 뒤에만 선언
- reset과 새 session 시작에서는 sequence를 0으로 초기화

Backend가 reconnect 직후 동일한 최신 frame만 보내고 새 frame을 생성하지 않으면 `RECONNECTING`이 유지될 수 있다. 새 frame 생성 시점은 Backend streaming·backpressure 계약으로 확정해야 한다.

## production 자동 정책

production 기본값에는 reconnect 횟수나 지연값이 없다. `reconnectPolicy`를 주입하지 않으면 자동 재연결하지 않으며, 일시적 종료 후 사용자가 명시적으로 누르는 수동 재시도만 제공한다.

수동 재시도는 다음 원칙을 따른다.

- 기존 session의 Frame WebSocket만 한 번 다시 연결
- 새 session 자동 생성 금지
- 연결 또는 복구 진행 중 중복 요청 금지
- 수동 연결 실패가 새로운 자동 retry 묶음을 시작하지 않음
- protocol·보안·알 수 없는 종료에는 제공하지 않음
- reset·unmount 후 실행 금지

## Preview·테스트 Mock 정책

`SessionFramePreview`는 자동 복구 상태를 검증하기 위해 다음 정책을 명시적으로 주입한다.

```ts
const PREVIEW_FRAME_RECONNECT_POLICY = {
  delaysMs: [0, 1_000, 3_000]
};
```

이는 Preview와 테스트 전용 Mock 값이며 production Backend 계약이 아니다. Backend가 공식 재시도와 backoff 규격을 확정하면 주입값을 교체할 수 있다.

## timer·socket cleanup

reset, session cancel, unmount, 새 run, 최종 오류와 명시적 중단에서 예약 timer와 현재 socket을 정리한다. retry generation과 connection generation을 사용해 정리 후 도착한 timer와 이전 socket callback을 무시한다. 이전 transport의 listener를 먼저 해제한 뒤 socket을 닫고, 그 전에는 새 socket을 만들지 않는다.

Transport는 Binary 대기 중 연결이 닫히면 미완성 frame을 폐기한다. 현재 또는 이전 frame의 Object URL은 frame 교체, disconnect와 reset 경로에서 revoke한다.

## UI와 접근성

신규 고정 selector는 다음과 같으며 `id`와 `data-testid`가 같다.

- `status-session-frame-recovery`
- `btn-session-frame-retry`

복구 중에는 관련 root에 `aria-busy=true`를 적용하고 한 개의 `role="status"`, `aria-live="polite"` 영역으로 안내한다. 최종 자동 복구 실패는 한 개의 `role="alert"`로 알린다. 시도 횟수 변화 자체를 live region에서 반복 낭독하지 않는다.

수동 재시도는 실제 `button type="button"`이며 공통 `Button`의 56px 대형 크기와 focus-visible 스타일을 사용한다. 연결·복구 중에는 실제 `disabled`를 적용한다. 상태와 Action 차단 여부는 색상뿐 아니라 텍스트로 표시하며, 테두리와 실제 disabled 속성은 forced-colors 환경에서도 의미를 유지한다.

## 보안 원칙

다음 정보는 state와 UI에 저장하거나 표시하지 않는다.

- raw WebSocket close reason
- WebSocket endpoint
- 표시용 sessionId 복사본
- frame byte와 내부 오류 객체
- stack, requestId와 raw Backend 응답
- 비밀번호, OTP와 계좌번호 원문

안전한 한국어 category 메시지만 사용자에게 제공한다. reconnect 중에는 Viewer Action을 허용하지 않으며 실제 금융거래를 실행하지 않는다.

## 지연 감지와 Backend blocker

이번 구현은 임의의 “N초 동안 frame이 없으면 지연” timer를 production에 추가하지 않는다. 현재 계약만으로는 Backend frame이 주기형인지 화면 변경형인지, 정적 화면의 무수신이 정상인지 판단할 수 없고 heartbeat도 없기 때문이다.

개발자 B와 다음 계약이 남아 있다.

- frame cadence 또는 화면 변경 기반 전송 규칙
- heartbeat와 liveness 판정 기준
- backpressure queue 크기와 최신 frame 유지 방식
- frame drop, send timeout과 재연결 허용 기간
- reconnect close code와 sequence 연속성
- reconnect 직후 새 frame 생성 여부

## 실행과 검증

자동 검증 명령은 다음과 같다.

```powershell
npm.cmd test -- --run
npm.cmd run build
git diff --check
```

실제 E2E는 Demo 5190, Backend 8080, Frontend 5173을 함께 실행하고 첫 frame, WebSocket 일시 종료, 복구 상태, 동일 session reconnect, 증가 sequence frame, 중복 socket 방지, reset·unmount cleanup을 브라우저에서 확인해야 한다.

## 완료 판정

D21 프론트 코드 완료는 종료 분류, 주입형 reconnect 정책, `RECONNECTING` 상태, sequence 연속성, 수동 retry, cleanup과 접근 가능한 상태 UI가 자동 테스트와 build를 통과하는 것을 뜻한다.

D21 전체 완료는 별도다. Backend의 backpressure·heartbeat 계약과 실제 3프로세스 브라우저 E2E가 확인되어야 공식 일정의 “프레임 지연·끊김·재연결 처리”를 완전히 완료한 것으로 판정할 수 있다.
