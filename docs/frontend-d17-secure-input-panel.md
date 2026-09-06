# 프론트 D17 보안 입력 보호 모드 패널

## 목표와 범위

D17은 `SECURE_INPUT_REQUIRED` 상태에서 개인정보 보호 모드와 사용자 직접 입력
절차를 안내하는 controlled UI를 제공한다. 메인 프론트는 보안 입력값을 받지
않으며 사용자가 원격 금융 화면에서 입력을 마쳤다는 요청만 부모에 전달한다.

실제 API, WebSocket, Backend 검증, secure 상태 해제와 자동화 재개는 이번
범위에 포함하지 않는다. App 제품 흐름에도 연결하지 않는다. 기존 실제 session과
frame 수신 구현은 엑셀 기준 D20 선행 구현으로 그대로 보존한다.

## Demo-bank와 메인 프론트의 책임

Demo-bank는 원격 금융 페이지 역할을 하며 native password·OTP 입력 요소와
`data-ddd-policy="secure-input"` 신호를 제공한다. 사용자는 그 원격 화면에서
직접 입력한다.

메인 프론트의 `SecureInputPanel`은 개인정보 보호 안내만 담당한다. input을
렌더링하거나 원문, 입력 길이, 인증 결과를 props·state·callback으로 다루지
않는다. 입력 완료 요청은 인증 성공, 거래 승인 또는 자동화 재개 완료가 아니다.

## 상태 모델

```ts
type SecureInputPhase =
  | 'WAITING_FOR_USER'
  | 'COMPLETION_REQUESTED';
```

- `WAITING_FOR_USER`: 사용자가 원격 금융 화면에서 직접 입력하는 상태
- `COMPLETION_REQUESTED`: 사용자가 입력 절차를 마쳤다고 요청한 상태

phase는 controlled `completionRequested`에서 파생한다. `disabled` 또는
`isBusy`이면 요청할 수 없고 `COMPLETION_REQUESTED`에서는 중복 요청을 차단한다.
인증 성공과 자동화 재개 가능 여부는 모델이 계산하지 않는다.

## Props 계약

```ts
interface SecureInputPanelProps {
  message?: string;
  completionRequested?: boolean;
  disabled?: boolean;
  isBusy?: boolean;
  onComplete: () => void;
  className?: string;
}
```

`message`는 부모 또는 서버가 민감정보, raw 오류, HTML, DOM 및 AI reasoning을
제거한 안전한 일반 안내 문장이어야 한다. 앞뒤 공백을 제거하고 비어 있으면
기본 안내를 사용한다. panel은 HTML 문자열을 삽입하지 않는다.

`onComplete()`에는 payload가 없다. sessionId, requestId, 보안 원문, 인증 결과와
계좌정보를 전달하지 않는다. mount만으로 callback을 호출하지 않으며 클릭 후
컴포넌트가 자체적으로 `completionRequested`를 변경하지 않는다.

## Controlled 완료 흐름

```text
SECURE_INPUT_REQUIRED
→ 사용자가 원격 금융 화면에서 직접 입력
→ 입력 완료 요청
→ Backend 안전 검증
→ 새로운 WorkflowStatus 수신
→ 부모가 secure 상태 해제
```

완료 요청 후에도 부모가 secure 상태를 해제하기 전까지 패널과 보호 안내를
유지한다. `isBusy`는 부모가 요청을 처리 중이라는 뜻일 뿐이며, 처리 완료나
인증 성공을 뜻하지 않는다.

## Selector

- `panel-secure-input`
- `heading-secure-input`
- `notice-secure-input-protection`
- `status-secure-input`
- `btn-secure-input-complete`
- `preview-secure-input`
- `select-preview-secure-input-state`

고정 selector는 `id`와 `data-testid`가 같다. Demo-bank의 완료 버튼도
`btn-secure-input-complete`를 사용하지만 별도 애플리케이션과 DOM이므로 충돌하지
않는다. 메인 Viewer에는 원격 화면이 Canvas 이미지로 표시된다.

## 접근성

- heading으로 이름이 지정된 `Panel` section
- `Button size="lg"`의 실제 `button type="button"`과 최소 56px 높이
- 실제 `disabled`와 panel의 `aria-busy`
- 하나의 동적 상태 영역에 `role="status"`, `aria-live="polite"`,
  `aria-atomic="true"`
- 대기, 처리, 완료 요청 상태를 문장으로 전달
- 자동 focus 없음
- 공통 focus-visible, reduced-motion 및 테두리 스타일 재사용
- 색상에만 의존하지 않는 제목·안내·상태 문구

보호 Notice는 `role="note"`와 announcement off를 사용해 동적 상태 live region과
중복 낭독되지 않게 한다.

## 보안 원칙

- password, OTP, 인증번호 input과 hidden input을 만들지 않는다.
- 보안 원문과 길이를 props, React state, callback, URL, storage, Cookie 또는
  로그에 남기지 않는다.
- fetch, XMLHttpRequest, WebSocket, STOMP와 실제 금융 Action을 실행하지 않는다.
- timer, 자동 callback, 자동 완료와 자동화 재개를 사용하지 않는다.
- 안전 확인 전까지 보호 모드를 유지한다.
- Backend 확인 없이 screenshot, frame, DOM 또는 AI가 완전히 중단됐다고 단정하지
  않는다.

## STT·TTS 및 Main Controller

기존 F4는 `isSecureInput=true`에서 STT recognition을 abort하고 transcript를
삭제하며, TTS 재생을 cancel하고 일반 안내 원문을 숨긴다. secure 해제 후에도
STT·TTS를 자동 재시작하지 않는다. D17 panel은 이 production 계약을 수정하지
않는다.

후속 부모 통합에서는 F5 capability를 다음처럼 제어한다.

- 다시 듣기: 비활성화
- 일시정지·계속 진행: 비활성화
- 이전 단계: Backend 안전 이탈 계약 확정 전 비활성화
- 취소: 기존 확인 절차와 Backend cancel 계약이 연결된 경우 허용 가능

## Backend transport와 남은 계약

현재 Backend에는 secure 요소 탐지, `SECURE_INPUT_REQUIRED` 상태 매핑과 frame
capture Guard가 있으나 입력 완료 전용 API·WebSocket 이벤트와 명시적 secure
latch·해제 lifecycle은 없다. 프론트 설계 이벤트와 실제 Backend STOMP payload도
필드가 일치하지 않는다.

개발자 B·C와 다음을 확정해야 한다.

- secure 진입·해제 이벤트와 sessionId/requestId
- 완료 요청 transport, payload, idempotency, timeout과 오류
- screenshot, frame, DOM, AI 중단 책임과 secure latch
- 입력 완료 후 안전 검증 및 자동화 재개 조건
- 재개 전 새 frame·DOM 필요 여부와 stale event 정책
- 보안 입력 중 취소·이전 단계 허용 정책

자동화 재개는 Backend가 검증한 새로운 `WorkflowStatus`를 부모가 수신한 뒤에만
판단한다. panel은 재개를 요청하거나 확정하지 않는다.

## Preview와 테스트

`SecureInputPanelPreview`는 App에 연결하지 않는 독립 개발 Preview다. select로
`WAITING`, `COMPLETION_REQUESTED`, `BUSY`, `DISABLED`, `CUSTOM_MESSAGE`,
`EMPTY_MESSAGE`를 확인한다. 로컬 state는 부모의 controlled prop 갱신을 흉내
내는 용도로만 사용하며 API, WebSocket, storage, timer와 실제 자동화를 사용하지
않는다.

Vitest, Testing Library와 JSDOM 테스트는 모델 판단, selector, 접근 가능한 section,
button, controlled rerender, 중복 요청 차단, message fallback, input 부재와 외부
부작용 부재를 검증한다. 기존 STT, TTS, F5, WorkflowStatusPanel, 사용자 선택,
약관, session-frame, Viewer와 Overlay 테스트는 전체 회귀 테스트로 확인한다.

실제 브라우저에서는 다음을 별도로 확인해야 한다.

- Tab 이동과 Enter·Space 실행
- focus-visible
- 모바일 너비와 긴 안내 문장 줄바꿈
- forced-colors와 reduced-motion
- 스크린리더 heading·status 낭독
- busy와 disabled 상태 구분

## D17 제외 범위

- 실제 비밀번호·OTP 입력 및 검증
- Backend 완료 transport와 secure 상태 해제
- Viewer, AI, STT, TTS 또는 자동화 재개
- screenshot, frame와 DOM lifecycle 구현
- 브라우저 Action과 실제 금융거래
- 최종 승인과 위험 경고
- App 제품 흐름 통합
- Backend, Demo-bank, AI Engine 및 package 변경
