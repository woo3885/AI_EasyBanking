# 프론트 D15 사용자 선택 대기 패널

## 1. 목표와 범위

D15는 `USER_DECISION_REQUIRED`에서 상품, 출금 계좌, 수취인 중 하나를 사용자가
직접 고른 뒤 별도의 확인 버튼으로 선택을 확정하는 공통 UI 경계를 제공한다.
AI의 자동 추천·자동 선택과 option 클릭 즉시 실행은 제공하지 않는다.

D15는 native radio 기반 단일 선택만 담당한다. 필수·선택 약관과 여러 checkbox는
D16, 비밀번호·OTP 같은 보호 입력은 D17 범위다. 추가 정보 free-text와 최종
금융 승인도 포함하지 않는다.

## 2. option UI 타입과 transport 경계

```ts
interface UserDecisionOption {
  id: string;
  label: string;
  description?: string;
  disabled?: boolean;
}
```

현재 B·C transport에서 확정된 option 필드는 `id`, `label`, `required?`다.
`description`과 `disabled`는 D15 Preview와 프론트 표현을 위한 UI 전용 최소
확장이며 서버 계약으로 간주하지 않는다. D15 단일 선택에는 약관용 `required`를
사용하지 않는다.

option은 문자열만 가지며 metadata, raw data, value, payload, ReactNode label,
recommendation, confidence, 계좌번호, session·decision·request ID를 받지 않는다.

## 3. ID와 목록 검증

option ID는 공개 가능하고 민감정보가 아닌 kebab-case 식별자다.

```text
^[a-z0-9]+(?:-[a-z0-9]+)*$
```

빈 값, 공백, 앞뒤 공백, 대문자, underscore, slash, query 문자, HTML 특수문자와
8자리 이상의 숫자·하이픈 조합은 거부한다. 입력을 임의 정규화하지 않는다.
유효한 ID의 radio DOM ID는 `option-user-decision-${option.id}`다. 배열 index나
label은 selector에 사용하지 않는다.

목록 분석 결과는 다음 세 상태다.

- `READY`: 모든 ID와 label이 유효하며 중복 ID가 없다.
- `EMPTY`: options가 비어 있다.
- `INVALID`: 잘못된 ID, 중복 ID 또는 비어 있는 label이 있다.

`READY`는 입력 순서를 유지한다. helper는 입력 배열과 객체를 정렬·정규화·변경하지
않는다. `INVALID` 목록은 중복 DOM ID를 만들지 않도록 radio 전체를 렌더링하지
않으며 내부 validation 사유나 원문을 사용자에게 노출하지 않는다.

## 4. controlled props와 선택 계약

```ts
interface UserDecisionPanelProps {
  title?: string;
  message?: string;
  options: readonly UserDecisionOption[];
  selectedOptionId: string | null;
  disabled?: boolean;
  isBusy?: boolean;
  onSelect: (optionId: string) => void;
  onConfirm: (optionId: string) => void;
  className?: string;
}
```

패널은 controlled component다. 선택값을 내부 state로 복사하지 않으며 mount나
options 변경 시 callback을 부수적으로 호출하지 않는다. 초기값은
`selectedOptionId = null`이고 기본 option, 자동 focus, 자동 선택, 자동 확인이 없다.

활성 radio를 선택하면 `onSelect(option.id)`만 호출한다. 부모가 새
`selectedOptionId`를 전달해야 checked 상태가 바뀐다. option 클릭만으로
`onConfirm`이나 다음 단계가 실행되지 않는다.

## 5. confirm Gate와 상태 변경

확인 버튼은 다음 조건을 모두 만족할 때만 활성화된다.

- 목록이 `READY`다.
- 선택 ID가 현재 options에 존재한다.
- 선택 option이 disabled가 아니다.
- 패널이 disabled 또는 busy가 아니다.

확인하면 검증된 ID로 `onConfirm(optionId)`만 호출한다. API, WebSocket, URL 이동,
자동 workflow 재개와 완료 문구는 없다. callback 직후의 `isBusy`나 후속 상태는
부모가 새 props로 제공해야 한다.

선택 option이 제거되거나 disabled로 바뀌면 UI에서는 미선택으로 간주하고 확인을
차단한다. 부모의 값을 자동으로 `null`로 바꾸거나 callback을 호출하지 않는다.
순서가 바뀌어도 ID 기준 선택을 유지하며 label과 description은 최신 props를
표시한다.

## 6. disabled, busy, EMPTY와 INVALID

- 패널 disabled: 모든 radio와 확인 버튼을 비활성화한다.
- busy: `aria-busy="true"`, 모든 control 비활성화와 처리 중 안내를 사용한다.
- option disabled: 해당 radio만 비활성화하고 “선택 불가”를 텍스트로 표시한다.
- `EMPTY`: 준비 안내를 표시하고 확인을 차단한다.
- `INVALID`: 안전한 일반 안내만 표시하며 radio와 confirm을 차단한다.

가짜 spinner·timer, 자동 retry, API 요청과 오류 단정은 사용하지 않는다.

## 7. message 보안

title, message, label, description은 부모와 B·C가 사용자 표시용으로 정제한 문자열만
전달해야 한다. 패널 내부 정규식만으로 민감정보 안전성을 보장한다고 가정하지 않는다.
전체 계좌번호, 비밀번호, OTP, 주민등록번호, 실제 고객정보, token, cookie, raw DOM,
AI reasoning, 내부 prompt와 stack trace를 전달하면 안 된다.

패널은 React text rendering만 사용한다. `dangerouslySetInnerHTML`, arbitrary
metadata, 로그, storage, URL 저장과 외부 전송은 사용하지 않는다.

## 8. selector와 접근성

고정 selector는 다음과 같고 모두 `id === data-testid`다.

- `panel-user-decision`
- `heading-user-decision`
- `options-user-decision`
- `status-user-decision`
- `btn-user-decision-confirm`
- `preview-user-decision`
- `select-preview-user-decision-type`

option radio는 `option-user-decision-${option.id}`를 사용한다. 이름 있는 Panel,
heading, `fieldset`·`legend`, 동일한 name의 native radio, label 연결,
description `aria-describedby`, native checked·disabled를 사용한다. custom radio role,
중복 `aria-checked`, confirm의 `aria-pressed`는 추가하지 않는다.

상태는 `role="status"`, `aria-live="polite"`이며 패널은 `aria-busy`를 표시한다.
확인 버튼은 공통 `Button size="lg"`로 최소 56px를 유지한다. option row도 최소
56px, focus-visible 스타일과 색상 외 “선택 전·선택됨·선택 불가” 텍스트를 제공한다.

## 9. Preview와 Workflow 상태 패널 조합

`UserDecisionPanelPreview`는 상품, 출금 계좌, 수취인, 빈 목록, disabled option,
busy, panel disabled 유형을 제공한다. 모든 데이터는 명백한 Mock이며 실제 계좌번호나
고객정보가 없다. 유형 변경 시 로컬 선택과 마지막 callback 표시만 초기화한다.

Preview는 `WorkflowStatusPanel status="USER_DECISION_REQUIRED"`와
`UserDecisionPanel`을 형제 요소로 조합한다. 중첩 Panel을 만들지 않는다. Preview는
App에 연결하지 않고 API, WebSocket, storage, timer와 실제 금융 Action을 사용하지
않는다.

## 10. 테스트와 수동 확인

Vitest와 Testing Library로 option validation·불변성, confirm Gate, selector,
native radio, controlled rerender, callback 분리, disabled·busy, EMPTY·INVALID,
options 변경, React text rendering과 외부 동작 부재를 검증한다.

Preview가 App에 연결되지 않으므로 실제 브라우저 시각 검증은 D15 자동 검증 범위가
아니다. 제품 통합 시 radio 방향키, Tab·Space, focus-visible, 긴 label, 모바일
레이아웃, forced-colors와 스크린리더 낭독을 수동으로 확인해야 한다.

## 11. D15 제외 범위와 남은 계약

D15에서는 약관 다중 선택·전체 동의, secure input, 최종 승인, free-text 질문,
실제 API·WebSocket, persistence, 추천·confidence, 자동 선택, App 제품 흐름과 실제
금융 Action을 구현하지 않는다.

개발자 B·C와 다음 계약이 남아 있다.

- decisionId, sessionId, requestId와 sequence
- `ACCOUNT_SELECTION`과 `SOURCE_ACCOUNT_SELECTION` 명칭 통일
- option 순서, disabled 전달, 빈 목록과 중복 ID 정책
- 선택 결과 payload와 confirm transport
- 중복 confirm, stale decision, timeout과 자동화 재개
- recommendation·confidence 정책과 option 정제 책임
