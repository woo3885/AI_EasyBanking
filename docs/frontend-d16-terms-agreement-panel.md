# 프론트엔드 D16 약관 동의 패널

## 목적과 상태

D16은 `ScreenType: TERMS_AGREEMENT`에서 필수 약관과 선택 약관을 사용자가 각각 확인하고 직접 선택할 수 있는 공통 UI를 제공한다. 전체 업무 상태는 `WorkflowStatus: USER_DECISION_REQUIRED`이며, 약관 패널은 선택 상태만 안내한다.

D15 `UserDecisionPanel`은 상품·계좌·수취인 중 하나를 고르는 단일 radio 선택 UI다. D16 `TermsAgreementPanel`은 여러 약관을 독립적으로 고르는 checkbox UI이며, 필수 항목을 모두 선택해야 확인할 수 있다. 두 계약은 용도와 선택 수가 다르므로 통합하거나 서로 확장하지 않는다.

## AgreementTerm 계약

```ts
interface AgreementTerm {
  id: string;
  label: string;
  required: boolean;
  description?: string;
  disabled?: boolean;
}
```

- transport에서 확인된 필드는 `id`, `label`, `required?`다.
- D16 UI는 누락 여부가 모호하지 않도록 `required`를 명시적인 boolean으로 받는다.
- `description`, `disabled`는 D16 UI 전용 필드이며 transport 확정 필드가 아니다.
- `onConfirm`의 ID 배열은 UI callback 계약일 뿐 서버 payload로 확정하지 않는다.
- 선택 상태, 추천 여부, 신뢰도, metadata, ReactNode·raw HTML label, 법률 문서 URL은 모델에 넣지 않는다.

## 공개 ID와 DOM ID

약관 ID는 공개 가능한 비민감 kebab-case만 허용한다. 영문 소문자와 숫자를 사용할 수 있고 단어 사이는 단일 하이픈으로 구분한다. 빈 값, 공백, 대문자, underscore, slash, 특수문자, 앞뒤 하이픈, 연속 하이픈은 거부한다. 계좌 식별자처럼 보일 수 있는 8자리 이상의 숫자·하이픈 조합도 거부하며 임의 정규화하지 않는다.

유효한 약관의 checkbox DOM ID는 `term-user-agreement-${term.id}`다. 배열 index나 label은 ID 생성에 사용하지 않는다.

## 목록 상태

- `READY`: 모든 ID가 유효하고 중복되지 않으며 모든 `label.trim()`이 비어 있지 않다.
- `EMPTY`: 약관 배열이 비어 있다. checkbox를 표시하지 않고 준비 중 안내와 비활성 확인 버튼을 제공한다.
- `INVALID`: ID, 중복 또는 label 검증에 실패했다. checkbox와 원본 검증 값을 숨기고 안전한 일반 안내만 제공한다.

분석 helper는 입력 배열·객체·Set을 변경하지 않고 입력 순서를 보존한다. 검증 실패 시 예외나 내부 사유를 UI에 노출하지 않는다.

## controlled 선택과 callback 경계

`TermsAgreementPanel`은 다음 props를 받는다.

```ts
interface TermsAgreementPanelProps {
  title?: string;
  message?: string;
  terms: readonly AgreementTerm[];
  selectedTermIds: ReadonlySet<string>;
  disabled?: boolean;
  isBusy?: boolean;
  onToggle: (termId: string, selected: boolean) => void;
  onConfirm: (selectedTermIds: readonly string[]) => void;
  className?: string;
}
```

생산용 패널은 내부 선택 state를 만들거나 props의 Set을 수정하지 않는다. 현재 목록에 있고 활성 상태인 ID만 매 렌더링에서 선택으로 계산한다. 목록에서 제거되거나 disabled로 바뀐 term은 UI에서 미선택으로 보인다.

초기값은 부모가 전달한 빈 Set이며 기본·자동 선택은 없다. 사용자가 checkbox를 바꾸면 `onToggle(termId, nextSelected)`만 한 번 호출한다. toggle만으로 확인, 화면 전환, 전송 또는 업무 재개가 일어나지 않는다.

## 필수 약관 Gate와 확인 payload

다음 조건을 모두 만족할 때만 확인 버튼이 활성화된다.

1. 목록이 `READY`다.
2. 패널이 disabled 또는 busy 상태가 아니다.
3. disabled 필수 약관이 없다.
4. 현재 목록에 없는 selected ID가 없다.
5. 활성 필수 약관을 모두 선택했다.

선택 약관은 Gate에 영향을 주지 않는다. disabled 선택 약관은 UI 선택과 callback 배열에서 제외한다. disabled 필수 약관과 unknown selected ID는 조용히 제거해 진행하지 않고 Gate를 닫는다. 모든 항목이 선택 약관인 `READY` 목록은 확인할 수 있지만, 사용자가 확인 버튼을 직접 눌러야 한다. `EMPTY`와 `INVALID`에서는 확인할 수 없다.

확인 handler는 Gate를 다시 검증한 뒤 현재 목록에 존재하는 활성 selected ID만 term 입력 순서로 새 readonly 배열에 담아 `onConfirm`을 한 번 호출한다. 배열에는 ID만 포함하며 label과 description은 포함하지 않는다. 이 배열은 실제 REST 또는 WebSocket 제출 형식으로 확정된 것이 아니다.

전체 동의 checkbox·button·helper, 필수 또는 선택 약관 일괄 선택, AI 자동 동의, 초기 자동 선택은 제공하지 않는다.

## 표시와 접근성

- 공통 `Panel`, `Text`, `Button`을 재사용한다.
- 이름 있는 section, heading, fieldset 하나, legend 하나를 사용한다.
- 각 항목은 native `<input type="checkbox">`와 연결된 전체 행 label이다.
- 필수 항목은 native `required`를 사용하며 중복 ARIA role·checked·required를 추가하지 않는다.
- description은 `aria-describedby`로 연결한다.
- `[필수]`·`[선택]`과 `선택 전`·`선택됨`·`선택 불가` 텍스트로 색상 외 의미를 제공한다.
- 항목 행과 `size="lg"` 확인 버튼은 최소 56px이며 긴 문구 줄바꿈과 모바일 너비를 고려한다.
- native checkbox, 2px 테두리와 focus 표시를 유지해 키보드와 forced-colors 환경의 식별 기반을 제공한다.
- 패널은 `aria-busy`, 선택 상태 안내는 `role="status"`와 `aria-live="polite"`를 사용한다.
- 자동 focus가 없고 reduced-motion 애니메이션에 필수 정보를 의존하지 않는다.
- title, message, label, description은 React text로만 렌더링한다.

## Selector

고정 selector는 다음과 같으며 모두 `id`와 `data-testid`가 같다.

- `panel-terms-agreement`
- `heading-terms-agreement`
- `options-terms-agreement`
- `status-terms-agreement`
- `btn-terms-agreement-confirm`
- `preview-terms-agreement`
- `select-preview-terms-agreement-state`
- `status-preview-terms-agreement-action`

동적 checkbox selector는 `term-user-agreement-${termId}`이며 이 역시 `id`와 `data-testid`가 같다.

## 독립 Preview

`TermsAgreementPanelPreview`는 App에 연결하지 않는 개발 검증용 컴포넌트다. `DEFAULT`, `ONE_REQUIRED_SELECTED`, `ALL_REQUIRED_SELECTED`, `OPTIONAL_SELECTED`, `EMPTY`, `INVALID`, `DISABLED_OPTIONAL`, `DISABLED_REQUIRED`, `BUSY`, `PANEL_DISABLED` 상태를 선택할 수 있다.

Preview 약관은 서비스 이용약관, 개인정보 수집·이용, 마케팅 정보 수신이라는 안전한 Mock이며 실제 법률 약관이 아니다. Preview만 불변 방식의 로컬 Set을 사용하고, 마지막 toggle·confirm 요청에는 ID만 표시한다. 실제 서버로 전송되지 않았음을 함께 안내한다.

`WorkflowStatusPanel(status="USER_DECISION_REQUIRED")`과 `TermsAgreementPanel`은 형제 요소다. 전자는 전체 workflow 상태, 후자는 약관 선택 변화와 Gate를 각각 안내하며 실제 workflow 전환은 없다.

## 테스트와 수동 확인

모델 테스트는 ID, 목록 상태, 입력 불변성, 필수 Gate와 callback 배열을 검증한다. UI 테스트는 controlled checkbox, 접근성 연결, 선택·확인 callback 분리, 경계 상태와 금지 동작을 검증한다. Preview 테스트는 10개 상태, Workflow 패널 조합과 로컬 요청 안내를 검증한다.

Preview가 App에 연결되지 않았으므로 실제 브라우저 진입점은 없다. 실제 브라우저에서는 이후 연결 시 Tab·Space 조작, label 클릭, focus 표시, 긴 문구 줄바꿈, 모바일 레이아웃, forced-colors, reduced-motion과 스크린리더 낭독을 수동으로 확인해야 한다.

## 보안과 제외 범위

D16은 실제 법률 원문, 고객정보, 전체 계좌번호, 비밀번호, OTP, token·cookie, AI reasoning·prompt·raw output을 저장하거나 표시하지 않는다. HTML 주입, 네트워크 전송, WebSocket, URL 이동, 브라우저 storage, timer, console 출력, mount callback, 자동 선택·confirm, 금융 Action도 수행하지 않는다.

App 제품 흐름, Zustand, 세션 상태, 실제 API 제출, 자동화 재개, 보안 입력과 최종 승인은 D16 범위 밖이다. D15와 기존 공통 UI, backend, demo, ai-engine은 수정하지 않는다.

## 개발자 B·C와 남은 계약

연동 전에 다음 항목을 개발자 B·C와 확정해야 한다.

- 프론트와 backend의 이벤트명 불일치
- `decisionId`의 생성·전달 규칙
- `sessionId`, `requestId`, `sequence`의 필수 여부와 수명
- AI의 `termId`와 프론트 `id` mapping
- term 순서와 ID 안정성
- transport에서 `required?` 누락 시 처리
- transport의 disabled 지원 여부
- 선택 ID 제출 payload 형식
- REST와 WebSocket 중 제출 기준
- 중복 confirm, stale 요청과 timeout 처리
- 자동화 재개 시점
- 사용자용 약관 문구 정제 책임
