# 프론트 D14 공통 Workflow 상태 패널

## 1. 목적과 범위

D14는 메인 프론트에서 재사용할 공통 Workflow 상태 패널을 제공한다. 캘린더
범위인 `AI_EXECUTING`, 일반 로딩, 오류 상태를 우선 표현하고, 기존 12개
`WorkflowStatus`도 동일한 presentation 경계에서 안전하게 표시한다.

구조는 다음과 같다.

```text
WorkflowStatus 또는 runtime 값
  → workflow-status-presentation
  → WorkflowStatusPanel
  → WorkflowStatusPanelPreview
```

기존 `WorkflowStatus` union은 변경하지 않았다. `FAILED`, `CONNECTION_LOST`,
`LOADING`, `PAUSED` 같은 미확정 상태도 추가하지 않는다.

## 2. 상태 표현

| 상태 | 핵심 표현 | busy | indicator | tone |
| --- | --- | --- | --- | --- |
| `SESSION_CREATED` | 세션 준비 완료 | 아니오 | 없음 | neutral |
| `PAGE_LOADING` | 금융 페이지를 불러오는 중 | 예 | 있음 | progress |
| `AI_EXECUTING` | AI가 화면을 확인하고 다음 안내를 준비 중 | 예 | 있음 | progress |
| `USER_DECISION_REQUIRED` | 사용자 직접 선택 필요 | 아니오 | 없음 | warning |
| `SECURE_INPUT_REQUIRED` | 보호 입력 필요 | 아니오 | 없음 | warning |
| `FINAL_CONFIRMATION_REQUIRED` | 사용자 최종 확인 필요 | 아니오 | 없음 | warning |
| `ADDITIONAL_INFORMATION_REQUIRED` | 추가 정보 필요 | 아니오 | 없음 | warning |
| `RISK_WARNING` | 위험 징후 확인 필요 | 아니오 | 없음 | danger |
| `COMPLETED` | 업무 안내 흐름 완료 | 아니오 | 없음 | success |
| `CANCELLED` | 사용자 요청으로 취소 | 아니오 | 없음 | neutral |
| `ERROR` | 업무 처리 오류 | 아니오 | 없음 | danger |
| `TERMINATED` | 세션 종료 | 아니오 | 없음 | neutral |

`COMPLETED`는 업무 안내 흐름의 완료를 뜻하며 실제 금융거래 완료를 과도하게
주장하지 않는다. `CANCELLED`는 실패나 오류가 아니고 `RISK_WARNING`도
`ERROR`로 분류하지 않는다.

알 수 없는 runtime 값은 원문을 노출하지 않고 “상태를 확인하고 있음”이라는
neutral fallback으로 표시한다. known status mapping은 exhaustive switch로
작성해 union 변경 시 컴파일 단계에서 누락을 발견할 수 있게 했다.

## 3. Presentation model

`WorkflowStatusPresentation`은 다음 UI 정보만 제공한다.

- 안전한 기본 제목과 설명
- `neutral`, `progress`, `success`, `warning`, `danger` tone
- `isBusy`, `isError`, `isTerminal`, `showIndicator`

`isWorkflowLoadingStatus`는 `PAGE_LOADING`,
`isWorkflowExecutingStatus`는 `AI_EXECUTING`,
`isWorkflowErrorStatus`는 `ERROR`만 분류한다. 함수는 timer, 전역 상태, API,
WebSocket 또는 storage를 사용하지 않는 순수 함수이며 매 호출마다 독립된
presentation 값을 반환한다.

## 4. Panel props와 message 보안

```ts
interface WorkflowStatusPanelProps {
  status: WorkflowStatus;
  message?: string;
  className?: string;
}
```

패널은 controlled component다. `status`를 로컬 state로 복사하거나 내부에서
변경하지 않는다. `message`의 앞뒤 공백을 제거한 결과가 비어 있지 않으면
해당 문장을 표시하고, 그렇지 않으면 상태별 기본 설명을 사용한다.

`message`는 부모 또는 서버가 사용자 표시용으로 정제한 안전한 문장이어야
한다. 패널은 raw error 객체, 오류 코드, stack trace를 받지 않는다. 내부
정규식만으로 민감정보 안전성을 보장한다고 가정하지 않으며 HTML 문자열을
삽입하지 않는다. 인증 정보, 전체 금융 입력 원문, token, cookie, 내부 prompt,
AI reasoning, request/response 원문은 전달하면 안 된다.

## 5. 진행 표시와 접근성

`PAGE_LOADING`과 `AI_EXECUTING`은 다음 계약을 사용한다.

- `role="status"`, `aria-live="polite"`, `aria-busy="true"`
- 화면 제목과 설명 텍스트
- `aria-hidden="true"`인 작은 border 기반 indeterminate spinner
- 실제 진행률, 남은 시간, 예상 완료 시각 없음

Spinner는 `motion-safe:animate-spin`을 사용한다. 기존 전역
`prefers-reduced-motion` 규칙에서는 animation이 제거되며, animation이 없어도
제목과 설명으로 상태를 이해할 수 있다. border와 `currentColor` 기반 형태는
forced-colors에서도 윤곽을 유지하도록 구성했다. 실제 환경의 motion 및
고대비 표현은 브라우저에서 별도 확인해야 한다.

`ERROR`는 `role="alert"`, `aria-live="assertive"`, `aria-busy="false"`를
사용한다. 그 외 상태는 `role="status"`와 polite live region을 사용한다.
`RISK_WARNING`은 강조된 tone을 사용하지만 오류 alert로 확대하지 않는다.
자동 focus 이동은 하지 않는다. `NoticeBox` 자체의 announcement는 꺼서 패널
root와 중복으로 읽히지 않게 했다.

## 6. 고정 selector

- `panel-workflow-status`
- `heading-workflow-status`
- `indicator-workflow-status`
- `message-workflow-status`
- `preview-workflow-status`
- `select-preview-workflow-status`

모든 자동화 대상은 `id`와 `data-testid`가 같다. 상태값이나 message를 selector에
동적으로 포함하지 않는다. Indicator는 busy 상태에서만 렌더링한다.

## 7. Retry와 진행률 정책

D14에는 retry transport 계약이 없으므로 retry 버튼과 자동 retry를 제공하지
않는다. polling이나 timer 기반 자동 상태 전환도 없다. 실제 progress percent
계약이 없으므로 가짜 progress bar, countdown, 예상 완료 시간도 표시하지 않는다.

## 8. Preview와 검증

`WorkflowStatusPanelPreview`는 개발자가 실제 select로 다음 상태를 명시적으로
선택하는 독립 Mock이다.

- `AI_EXECUTING`
- `PAGE_LOADING`
- `ERROR`
- `CANCELLED`
- `COMPLETED`
- 개발용 `UNKNOWN_RUNTIME_STATUS` fallback

Unknown sentinel은 Preview에서 잘못된 외부 runtime 값을 재현하기 위해서만
cast하며 공통 `WorkflowStatus`에 추가하지 않는다. Preview는 App에 연결하지
않고 API, WebSocket, storage, timer, retry와 실제 금융 Action을 사용하지 않는다.

Vitest와 Testing Library로 12개 mapping, 분류 helper, fallback, 외부 mutation
차단, selector, message fallback, live role, busy, indicator, 상태 rerender와
Preview 선택을 검증한다. Production build는 TypeScript 계약과 번들 생성을
확인한다. Preview 진입점이 App에 없으므로 spinner 품질, reduced-motion,
forced-colors의 실제 시각 표현은 수동 브라우저 검증 범위다.

## 9. 개발자 C 후속 연결

D14 패널은 후속 연결을 위한 controlled props 경계까지만 제공한다. 다음은
개발자 C 및 백엔드와 추가로 확정해야 한다.

- C 내부 상태와 공통 `WorkflowStatus` mapping
- AI 실행 시작·완료 이벤트
- 사용자 표시용으로 정제된 안전한 message
- 오류 코드와 retry 가능 여부
- timeout 및 confidence 부족 표현
- 알 수 없는 상태 fallback 전달 방식
- 동일 상태 반복 이벤트와 상태 역행 방지
- sequence 또는 requestId 필요 여부

계약이 확정되기 전에는 새로운 상태나 retry 동작을 만들지 않는다.

## 10. D14 제외 범위

- App 제품 흐름 통합
- 실제 WebSocket 또는 개발자 C API 연결
- retry endpoint, 자동 retry, polling
- timer 기반 상태 전환
- 실제 진행률이 없는 progress percent
- 내부 AI output, prompt, reasoning 표시
- raw 오류 및 민감정보 표시
- 사용자 선택·약관·보안 입력·최종 승인 화면
- 실제 금융거래
- 새 패키지와 타 프로젝트 변경
