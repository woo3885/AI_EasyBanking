# 프론트 D16 Integration Mock Preview 기준선

## 1. 목적과 범위

D16은 D15까지 개별 구현된 프론트 기능을 하나의 실행 가능한 개발용 화면에서 조합해 보는 수준 1 Integration Mock Preview다. D15 일정에 포함되지 않았던 통합 기준선을 보완하고, D17~D19의 실제 계약 연동 전에 상태 전이와 컴포넌트 경계를 검증한다.

이 Preview는 실제 Backend, AI Engine, WebSocket 또는 데모사이트와 연결되지 않는다. frame, Target, 업무 상태, 선택 요청과 callback은 모두 브라우저 메모리와 로컬 SVG로만 구성된 Mock이다. 실제 브라우저 조작이나 금융거래는 발생하지 않는다.

`IntegrationPreview`는 의도적으로 `src/app/App.tsx`에 연결하지 않았다. 따라서 production 앱의 브라우저 진입점은 없으며, 현재 검증 범위는 JSDOM 테스트와 TypeScript·Vite production build까지다.

## 2. 기준 시나리오

### 2.1 계좌 선택에서 수취인 대기까지

1. 사용자가 `TRANSFER_ACCOUNT_SELECTION`을 선택한다.
2. 사용자가 `btn-integration-start`를 누른다.
3. 로컬 Mock session, `USER_DECISION_REQUIRED`, 계좌 frame, Target, 계좌 선택 요청을 동기적으로 수신한다.
4. 사용자가 `living-expense` 또는 `savings`를 직접 선택한다.
5. 선택만으로 transport callback이나 화면 전환은 발생하지 않는다.
6. 사용자가 별도의 선택 확인 버튼을 누른다.
7. 검증된 공개 option ID만 Mock transport callback에 전달한다.
8. 수취인 frame과 Target으로 바뀌고, 수취인 선택 대기 상태인 `BASELINE_REACHED`에 도달한다.

`BASELINE_REACHED`는 Preview 검증 기준점일 뿐 업무 완료 상태가 아니다. WorkflowStatus는 계속 `USER_DECISION_REQUIRED`이며, 실제 수취인 선택과 다음 단계 진행은 비활성화한다.

### 2.2 약관 조합 시나리오

`DEPOSIT_TERMS_AGREEMENT`는 production `TermsAgreementPanel`과 reducer·transport 경계를 검증하는 별도 개발용 시나리오다.

- 서비스 이용약관: 필수
- 개인정보 수집·이용: 필수
- 마케팅 정보 수신: 선택

모든 항목은 초기 미선택이고 전체 동의 기능은 제공하지 않는다. 필수 두 항목을 모두 직접 선택해야 확인 버튼이 활성화되며, 선택 약관은 Gate에 영향을 주지 않는다. 확인은 Mock callback 기록만 남기고 실제 법률 동의 완료나 workflow 재개를 의미하지 않는다.

## 3. 내부 상태와 reducer

외부 WebSocket event 계약과 혼동하지 않도록 Integration 전용 타입과 action에 `Integration` 또는 `MOCK_` 이름을 사용한다.

주요 상태는 다음과 같다.

- 연결: `DISCONNECTED`, `MOCK_CONNECTED`
- 시나리오: `TRANSFER_ACCOUNT_SELECTION`, `DEPOSIT_TERMS_AGREEMENT`
- 단계: `IDLE`, `ACCOUNT_SELECTION`, `RECIPIENT_SELECTION`, `TERMS_AGREEMENT`, `BASELINE_REACHED`, `ERROR`
- 공통 계약 재사용: `WorkflowStatus`, `ViewerFrame`, Viewer 좌표 타입, F3 Target 타입, `UserDecisionOption`, `AgreementTerm`
- 제어 상태: `runId`, Mock session ID, 안내 문장, frame, Target, 요청, 선택 ID·Set, 일시정지, 마지막 Mock 동작, 안전한 오류

Reducer는 React, DOM, 네트워크에 의존하지 않는 순수 함수다. option 선택과 확인, 약관 toggle과 확인을 각각 분리한다. 알 수 없거나 비활성인 option·term은 현재 state를 그대로 반환한다. 약관 Set과 요청 배열은 복사해 입력 객체를 변경하지 않는다.

### stale runId 정책

각 Mock 실행은 증가하는 `runId`를 사용한다. 일반 action은 현재 run과 정확히 일치할 때만 처리하고, session 시작 action도 현재 run보다 오래되면 무시한다. reset은 state의 runId를 하나 증가시킨 초기 상태를 만들어 이전 callback이 화면을 다시 채우지 못하게 한다.

## 4. Transport 경계

`IntegrationTransport`는 다음 메서드만 제공한다.

- `subscribe(listener)`
- `startScenario(scenarioId)`
- `submitSingleDecision(optionId)`
- `submitTermsAgreement(selectedTermIds)`
- `stop()`

이는 D16 프론트 내부 경계이며 Backend REST, WebSocket, STOMP, 인증, session DTO 또는 사용자 Action payload의 확정 계약이 아니다.

`createMockIntegrationTransport`는 결정론적인 동기 memory transport다. 사용자 start 전에는 callback을 보내지 않고, 실행 중 중복 start를 무시한다. `stop`과 unsubscribe는 여러 번 호출해도 안전하며 이후 callback을 차단한다. fetch, WebSocket, storage, timer와 console을 사용하지 않는다.

Mock event 순서는 Preview 재현성을 위한 로컬 규칙일 뿐 실제 네트워크 순서 보장 계약이 아니다.

## 5. frame과 Target

두 SVG fixture는 외부 리소스 없이 정확한 1280×720 크기로 작성했다.

- `demo-bank-transfer-accounts.svg`: 생활비·저축 계좌 Mock 카드
- `demo-bank-transfer-recipients.svg`: Mock 수취인 카드와 기준점 안내

fixture에는 실제 고객정보, 계좌번호, 금융기관 상표가 없다. 데모사이트 screenshot이나 Binary/WebSocket frame을 나타내지 않는다.

Target은 fixture의 버튼 위치와 맞춘 1280×720 server 좌표 rect다.

- `btn-select-account-living-expense`
- `btn-select-recipient-hong-gildong`

이 ID는 공개 가능한 Mock selector이며 실제 DOM에서 추출한 값이라고 주장하지 않는다.

## 6. production 컴포넌트 조합

### F2 Canvas Viewer와 F3 Smart Overlay

현재 `ViewerFrame`을 F2 `frame` prop으로 전달하고, F2의 `renderOverlay`가 제공하는 실제 `displaySize`, `frameStatus`, `imageSrc`로 F3를 렌더링한다. server size는 1280×720이다. frame 교체 시 reducer가 이전 Target을 먼저 제거하고, F3는 최신 frame이 `READY`일 때만 Target과 집중 효과를 표시한다.

기존 좌표 helper와 F2·F3 selector를 유지한다. Canvas click handler나 Action 전송은 추가하지 않았다. D19 전까지 Viewer는 표시 전용이다.

### WorkflowStatusPanel

Reducer의 `workflowStatus`와 안전한 Mock 안내 문장을 전달한다. 선택 시나리오는 `USER_DECISION_REQUIRED`를 사용하며, 실제 `AI_EXECUTING` 또는 `COMPLETED`를 생성하지 않는다.

### UserDecisionPanel

계좌와 수취인 요청을 controlled radio로 표시한다. 계좌는 초기 미선택이고, 선택 후 별도 확인을 거쳐야 Mock transport callback이 호출된다. 수취인 기준점에서는 패널을 표시하되 disabled로 유지해 실제 다음 단계로 진행하지 않는다.

### TermsAgreementPanel

약관 시나리오에서 controlled `ReadonlySet`과 기존 필수 Gate를 사용한다. 전체 동의, 자동 선택, 실제 제출은 없다. WorkflowStatusPanel과 형제 영역으로 배치한다.

### F4 VoiceController

Mock session ID와 안전한 안내 문장을 전달하되 `disabled`, `recognitionFactory={null}`, `synthesisFactory={null}`을 사용한다. 마이크 권한, SpeechRecognition, SpeechSynthesis, STT 전송과 TTS 외부 전송은 실행하지 않는다. 화면에 음성 transport 미연결 상태를 명시한다.

### F5 MainController

pause, previous, cancel callback은 reducer의 `lastActionMessage`와 로컬 pause 표시만 갱신한다. replay는 비활성화한다. 실제 TTS replay, workflow pause, history 이동, session cancel 요청은 없다. cancel은 기존 production 확인 Gate를 그대로 거친다.

## 7. start, reset, cleanup

- Start: 사용자가 버튼을 누를 때 subscribe 후 선택한 시나리오를 시작한다. 실행 중 start 버튼은 실제 disabled다.
- Reset: transport stop, unsubscribe, reducer 초기화, frame·Target·선택·마지막 동작 제거와 다음 runId 준비를 수행한다.
- Unmount: unsubscribe와 stop을 수행해 이후 callback을 막는다.
- mount, rerender, React StrictMode만으로 자동 시작하지 않으며 timer가 없다.

## 8. 고정 selector

모든 selector는 `id`와 `data-testid`에 동일한 값을 사용한다.

| 역할 | selector |
| --- | --- |
| Preview root | `preview-integration-d16` |
| Mock 경고 | `notice-integration-mock` |
| 시나리오 선택 | `select-integration-scenario` |
| 연결 상태 | `status-integration-connection` |
| 단계 상태 | `status-integration-phase` |
| 마지막 동작 | `status-integration-last-action` |
| 시작 | `btn-integration-start` |
| 초기화 | `btn-integration-reset` |

F2~F5와 공통 패널의 기존 selector는 변경하지 않는다.

## 9. 접근성

- Preview에 하나의 명확한 h1을 제공한다.
- select에 연결된 label과 실제 button·select·radio·checkbox를 사용한다.
- 주요 시작·초기화 버튼은 최소 56px이며 공통 focus-visible 스타일을 재사용한다.
- 연결, 단계, 마지막 동작은 `role="status"`, `aria-live="polite"`로 알린다.
- 선택 여부와 Mock 여부를 텍스트로 함께 전달해 색상에만 의존하지 않는다.
- 자동 focus는 사용하지 않는다.

App 진입점이 없으므로 실제 브라우저의 Canvas 시각 품질, Target 위치, 반응형 레이아웃, keyboard focus, screen reader, forced-colors와 reduced-motion은 완료로 주장하지 않는다.

## 10. 보안

Integration production 코드에는 fetch, WebSocket 생성, STOMP, storage, timer, console, 데모 URL 이동, 실제 계좌번호·고객정보, 인증정보 입력, raw AI reasoning, token·cookie, 자동 option·약관 선택, secure input, final confirmation, 실제 금융 Action 또는 `dangerouslySetInnerHTML`이 없다.

잘못된 입력은 raw event나 내부 객체를 출력하지 않고 일반적인 안전 문장으로만 표시한다. Mock label과 message는 React text로 렌더링한다.

## 11. 테스트 범위

- Reducer: 초기 상태, 모든 주요 action, 불변성, 선택·확인 분리, 필수 Gate, reset, stale runId, 안전 오류, 완료 상태 미사용
- Mock transport: start 전 무호출, 결정론적 순서, 중복 start, 계좌·수취인·약관, unknown 차단, stop·unsubscribe, runId, 금지 API 미사용
- Preview: selector, Mock 경고, 수동 start, F2/F3 이미지 lifecycle, 공통 패널, 계좌·약관 Gate, F4/F5, reset·unmount·rerender, navigation·금지 API 미사용
- 전체 frontend 회귀와 production build

## 12. D17~D19와 연동 blocker

- D17: 실제 session REST 및 frame WebSocket 계약·수신
- D18: workflow status, guide, Target, decision event 연결
- D19: 사용자 Viewer 클릭 → Backend Action → Playwright → 새 frame 검증

개발자 B에게 필요한 확정 계약은 session 시작·종료 lifecycle, binary frame metadata와 순서·재연결 정책, 사용자 Action 요청·응답 및 오류 형식이다. 개발자 C에게 필요한 계약은 workflow status, 안전한 guide 문장, Target 좌표·frame 연계, decision request와 사용자 응답 상관관계다.

Backend frame, AI 응답, Viewer click Action, Playwright 조작, secure/final lifecycle과 전체 E2E는 아직 blocker가 남은 후속 범위이며 D16 완료 항목이 아니다.
