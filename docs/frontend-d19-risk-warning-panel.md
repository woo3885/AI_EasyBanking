# D19 금융사기 위험 경고 패널

## 목표와 상태 의미

D19는 `RISK_WARNING` 상태에서 보이스피싱 또는 금융사기 가능성을 강하게 알리고, 사용자가 안전한 행동을 선택하도록 돕는 공통 UI를 제공한다. Backend의 브라우저 Action 결과 `BLOCKED`는 현재 `RISK_WARNING`으로 매핑된다. 일반 기술 오류는 D14 `WorkflowStatusPanel`의 `ERROR` 표현이 담당하며 이 패널은 오류 UI를 중복하지 않는다.

이 패널은 현재 Action이 위험 정책으로 차단되었다는 경고를 표시할 뿐, 세션·브라우저·전체 자동화가 종료되었다고 단정하지 않는다. 부모가 새로운 안전 상태를 전달하기 전까지 경고를 유지한다.

## 현재 production 계약과 최소 모델

현재 프론트가 확정적으로 받는 production 정보는 상태 변경 message뿐이다. AI Engine 내부에는 위험 분류와 판단 정보가 있지만 Backend 응답 및 프론트 transport adapter까지 확정되지 않았다. 따라서 D19 모델은 다음 최소 계약만 사용한다.

```ts
export interface RiskWarningDetails {
  message: string;
}
```

`riskType`, `category`, `riskLevel`, `severity`, `confidence`, `reason`, `evidence`, `matchedKeywords`, `recommendedAction`, `summary`, `requestId`, `sessionId`는 포함하지 않는다. Backend·AI production transport가 확정된 뒤 별도 adapter에서 다룬다.

## Message fail-closed 정책

`createRiskWarningPresentation`은 message 앞뒤 공백을 제거한다. 빈 값이나 명백한 주민등록번호·전화번호·미마스킹 계좌번호·비밀번호·OTP·인증번호 원문 형태가 감지되면 원문을 숨기고 다음 안전한 기본 문구를 표시한다.

> 금융사기 또는 보이스피싱 위험이 감지될 수 있어 현재 금융 절차를 계속 진행하지 않습니다.

일반적인 한국어 위험 안내, 금액 표현, 공식 앱이나 웹사이트에서 확인하라는 안전 문구는 허용한다. HTML처럼 보이는 문자열도 HTML로 해석하지 않고 React text로 렌더링한다. 피해 발생이나 범죄를 확정하는 문구는 사용하지 않는다.

## 고정 안전 행동 지침

지침은 외부 자유 문자열 prop이 아닌 프론트 고정 목록이며 빈 값과 중복 없이 다음 순서를 유지한다.

1. 송금·가입·인증 절차를 계속하지 마세요.
2. 상대방이 알려 준 연락처를 사용하지 마세요.
3. 금융기관의 공식 앱이나 웹사이트에서 연락처를 직접 확인하세요.
4. 비밀번호·OTP·인증번호를 누구에게도 전달하지 마세요.

실제 전화번호, 외부 링크, 특정 금융기관 이름은 제공하지 않는다.

## Controlled props와 취소 Gate

```ts
export interface RiskWarningPanelProps {
  title?: string;
  details: RiskWarningDetails;
  cancelRequested?: boolean;
  disabled?: boolean;
  isBusy?: boolean;
  canCancel?: boolean;
  onCancel: () => void;
  className?: string;
}
```

`cancelRequested`, `disabled`, `isBusy` 기본값은 `false`, `canCancel` 기본값은 `false`다. 패널은 이 상태를 내부에 복사하지 않는다. 버튼과 click handler는 모두 아래 Gate를 공유한다.

```text
canCancel && !disabled && !isBusy && !cancelRequested
```

허용된 클릭은 인수 없이 `onCancel()`을 한 번 호출한다. 이는 사용자가 현재 금융 절차와 세션을 안전하게 취소하고 싶다는 의도만 뜻한다. 세션 종료, 거래 취소, 위험 해제 또는 BrowserContext 종료 완료를 뜻하지 않는다. 실제 cancel API는 부모 통합 단계에서 연결한다.

별도 stop endpoint가 없어 `onStop`과 stop 버튼은 제공하지 않는다. 계속 진행, 위험 무시, 닫기, 이전, 수정, 승인, 송금, 가입, 재시도 control도 제공하지 않는다. 실제 위험 해제나 자동화 재개는 구현하지 않았다.

## 상태 표현

- 일반: 현재 절차를 계속 진행하지 않는다는 안전 안내
- Busy: 안전한 취소 요청 처리 중
- Cancel 요청 후: 요청 전달 사실과 경고 유지 안내
- Cancel 불가 또는 disabled: 이 패널에서 요청할 수 없다는 안내

Backend 응답 전에는 종료·취소·차단 완료를 단정하지 않는다.

## Selector

| 요소 | `id` 및 `data-testid` |
| --- | --- |
| 패널 | `panel-risk-warning` |
| 제목 | `heading-risk-warning` |
| 위험 안내 | `notice-risk-warning` |
| 안전 지침 | `guidance-risk-warning` |
| 취소 상태 | `status-risk-warning` |
| 취소 요청 | `btn-risk-cancel` |
| Preview | `preview-risk-warning` |
| Preview 상태 선택 | `select-preview-risk-warning-state` |

모든 고정 selector는 `id === data-testid`다. 지침 항목에는 동적 ID를 만들지 않으며 정보나 message를 selector에 넣지 않는다.

## 접근성과 보안

- `Panel`은 h2와 `aria-labelledby`로 이름을 갖는다.
- 위험 message 한 곳만 `role="alert"`, `aria-live="assertive"`, `aria-atomic="true"`를 사용한다.
- 지침은 `ul`과 `li`, 취소 상태는 별도 `role="status"`와 polite live region을 사용한다.
- root는 `aria-busy`, 취소 요청은 실제 `button type="button"`과 `disabled`를 사용한다.
- danger 대형 Button은 최소 높이 56px이며 기존 focus-visible·forced-colors·reduced-motion 정책을 재사용한다.
- 자동 focus, 자동 callback, 자동 닫기, timer, storage, location 변경을 사용하지 않는다.
- 실제 고객정보, 전체 계좌번호, 인증정보, raw AI reason, prompt, endpoint, stack을 표시하거나 저장하지 않는다.
- `dangerouslySetInnerHTML`, API, fetch, WebSocket, STOMP, 실제 금융 Action을 사용하지 않는다.

## 독립 Preview

`RiskWarningPanelPreview`는 App에 연결하지 않은 개발용 Preview다. 다음 상태를 선택할 수 있다.

- `GENERAL_WARNING`
- `VOICE_PHISHING_MESSAGE`
- `SAFE_ACCOUNT_MESSAGE`
- `CANCEL_REQUESTED`
- `BUSY`
- `DISABLED`
- `CANCEL_UNAVAILABLE`
- `INVALID_MESSAGE`
- `CUSTOM_MESSAGE`

Preview는 선택 상태와 마지막 cancel callback 요청을 설명하는 안전한 문장만 로컬 state로 관리한다. 실제 session cancel, API, WebSocket, storage, timer, URL 변경, 금융 Action은 없다.

## 테스트 범위

모델 테스트는 message 정규화·fallback·민감번호 차단·허용 문구·HTML text 유지·고정 지침·불변성·취소 Gate를 검증한다. Panel 테스트는 selector, ARIA 구조, 대형 버튼, controlled callback, 차단 상태, 금지 control 부재와 외부 부작용 부재를 검증한다. Preview 테스트는 9개 상태, callback 안내와 외부 부작용 부재를 검증한다.

JSDOM 테스트는 실제 시각 품질이나 스크린리더 동작을 보장하지 않는다. Tab 이동, Enter·Space, focus-visible, 모바일 줄바꿈, forced-colors, reduced-motion, 스크린리더 낭독과 상태별 시각 구분은 App 통합 이후 실제 브라우저에서 수동 확인한다.

## F4·F5 및 남은 계약

권장 F5 capability는 다음과 같다.

```text
canReplay: 정제된 위험 안내에 한해 부모 판단
canPause: false
canGoPrevious: false
canCancel: 실제 cancel 계약 연결 시 true
```

STT 새 입력과 음성 기반 계속 진행·승인은 차단해야 한다. TTS는 정제된 위험 안내만 사용자의 명시적 클릭으로 재생하며 자동 재생하지 않는다. D19에서는 production F4·F5 코드를 수정하지 않았다.

개발자 B와는 위험 상태 latch, cancel endpoint 연결, frame·AI 실행 중단과 안전한 해제 조건을 확정해야 한다. 개발자 C와는 production 위험 분류·표시 가능한 안전 message·TTS용 정제 계약을 확정해야 한다. App 연결, 실제 위험 탐지, cancel API, 자동화 중단·재개, transport adapter는 D19 범위에서 제외한다.
