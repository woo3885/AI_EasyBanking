# Frontend Agent Chat Day 3 보호 상태·복구 강화

## 목표

Day 3는 대화형 Agent의 채팅, 음성, 실제 DOM 안내 Overlay, 클릭 관찰을 보호 상태와 재연결 경합에서도 fail-closed로 유지한다. 기존 D24 사용자 결정, D26 보안 입력, D27 최종 승인 Gate는 변경하거나 우회하지 않는다.

## 중앙 보호 정책

`conversation-safety.ts`가 현재 Workflow 상태, 연결 상태, Demo 페이지의 로컬 보호 상태를 함께 평가한다. 정책은 다음 기능의 허용 여부와 사용자가 이해할 수 있는 차단 사유를 한 곳에서 제공한다.

- 채팅 메시지 제출
- STT 시작 및 transcript 반영
- TTS 재생
- Overlay 표시
- 사용자 클릭 observation 전송
- Overlay 복원
- 명시적인 재연결

보호 상태에서는 자동 재시도, 자동 메시지 재전송, 자동 클릭·스크롤·포커스, 자동 금융 Action을 수행하지 않는다.

## 상태별 처리

### Secure Input

`SECURE_INPUT_REQUIRED` 또는 페이지의 `data-ddd-policy="secure-input"` 진입을 감지하면 다음을 수행한다.

- active Overlay와 pending observation 제거
- 진행 중인 메시지·observation·bridge 복원 요청 abort
- STT abort 및 TTS 중지
- draft 즉시 제거
- 채팅·음성·Overlay·observation 차단
- 이전 Target 자동 복원 금지

비밀번호, OTP, PIN, 인증번호는 Agent 상태, URL, storage, console에 저장하지 않는다. 보안 입력이 끝난 후에도 이전 Target을 되살리지 않고 Backend가 새 identity로 보낸 Target만 허용한다.

### Risk Warning

`RISK_WARNING`에서는 Overlay와 pending 요청을 제거하고 채팅, STT, TTS, observation을 차단한다. 사용자가 기존 위험 경고 UI를 직접 확인해야 하며 stale callback이나 Agent 안내가 금융 행동을 재개하지 않는다.

### Final Confirmation

`FINAL_CONFIRMATION_REQUIRED` 또는 페이지의 final-confirmation 보호 경계에서는 일반 안내 Overlay와 observation을 제거한다. 채팅이나 STT transcript로 승인·거절하지 않으며, 기존 D27 checkbox·승인·거절 및 Backend exactly-once Gate만 사용한다. HTTP ACK나 AI 메시지만으로 거래 완료 상태를 표시하지 않는다.

### Terminal

`COMPLETED`, `CANCELLED`, `ERROR`, `TERMINATED`에서는 모든 Agent 입력과 복원을 차단하고 STOMP transport를 종료한다.

## 재연결과 페이지 복원

초기 페이지 복원 순서는 bridge 검증, WebSocket 구독, conversation snapshot 반영, 현재 Target 복원이다. 초기 Target은 snapshot 적용 전에는 표시하지 않는다.

재연결 시에는 기존 Target과 pending identity를 먼저 폐기한다. WebSocket 연결 후 snapshot과 buffered live event를 병합하고, 그 다음 bridge를 다시 검증한다. sessionId, pageIdentity, snapshot 상태와 만료 조건이 모두 현재 값일 때만 Target을 복원한다. 보호 상태 snapshot, 이전 페이지 Target, 만료 Target은 복원하지 않는다.

사용자 메시지와 observation을 자동 재전송하지 않으며, 재연결 이전 callback은 AbortController와 bridge recovery generation으로 무시한다.

## Exactly-once 및 race 방어

- StrictMode 초기 bridge 복원은 한 번만 수행한다.
- message requestId·messageId와 observation requestId·targetId identity가 일치할 때만 ACK를 반영한다.
- duplicate ACK는 메시지나 Action을 추가하지 않는다.
- 같은 Target 클릭은 한 번만 observation으로 전송한다.
- ACK는 `WAITING_FOR_RESULT`만 의미하며 `USER_ACTION_OBSERVED` 전에는 완료하지 않는다.
- stale·duplicate·foreign-session STOMP event를 무시한다.
- Overlay clear, 새 Target, scroll, resize, navigation, 만료, 보호 상태 전환은 pending observation을 폐기한다.

## Cleanup

컴포넌트 unmount, navigation, reconnect, 보호 상태 진입, terminal 상태, Overlay 교체·해제에서 HTTP AbortController, STOMP subscription, STT recognition, TTS synthesis, Overlay timer와 observation을 정리한다. session 또는 페이지가 바뀐 뒤 이전 비동기 callback은 현재 상태를 변경할 수 없다.

## 접근성

- 대화 목록은 `role="log"`와 polite live region을 유지한다.
- 처리 상태는 `role="status"`, 안전 차단 사유는 `role="alert"`로 전달한다.
- textarea와 native button에 차단 사유를 `aria-describedby`로 연결한다.
- 주요 Agent Action은 최소 높이 56px, 보조 음성 Action은 최소 48px을 유지한다.
- focus-visible 표시와 키보드 기본 동작을 유지하며 자동 포커스 이동은 하지 않는다.
- Overlay는 텍스트 안내와 포인터를 함께 제공하고 `pointer-events: none`으로 실제 DOM 클릭을 방해하지 않는다.

## 테스트와 빌드

- AgentChat Day 1~3: 17개 파일, 118개 테스트 통과
- Demo Bank TypeScript 및 production build 통과
- Main Frontend 포함 전체 Root Vitest: 90개 파일, 1,209개 테스트 통과
- Root TypeScript 및 production build 통과

Root Vitest는 Frontend용 Vitest가 다른 런타임의 테스트를 잘못 수집하지 않도록 `backend/**`, `ai-engine/**`, node_modules와 build 산출물을 제외한다. Demo AgentChat 테스트는 Root의 Testing Library·jsdom 환경을 의도적으로 재사용하므로 수집 대상에 유지한다.

## 변경 파일

- AgentChat 중앙 보호 정책과 reducer
- conversation·speech·page protection hooks
- AgentChat shell, panel, composer와 스타일
- 보호 상태·복원·race 회귀 테스트
- Root Vitest 수집 제외 설정
- 본 문서

## Production 공동 E2E

Fixture 기반 Frontend 구현과 자동 검증은 완료했다. 실제 Backend·AI Engine이 함께 발생시키는 `GUIDE_USER`, `OVERLAY_TARGET`, 사용자 클릭 observation, `USER_ACTION_OBSERVED`, AI exactly-once 재개 및 자연어 예금 전체 흐름은 이번 로컬 검증에서 실행하지 못했다.

따라서 현재 판정은 다음과 같다.

- **A Day 3 구현·자동 검증 완료, Production 공동 E2E 대기**
- **3일 액세스 코드 작업 완료, 최종 통합 완료 판정 보류**

공동 E2E에서는 실제 브라우저에서 보안 입력·위험·최종 승인 진입 시 즉시 차단되는지, 재연결 후 새 Target만 표시되는지, 사용자 클릭 observation과 AI 재개가 각각 정확히 한 번인지 확인해야 한다.
