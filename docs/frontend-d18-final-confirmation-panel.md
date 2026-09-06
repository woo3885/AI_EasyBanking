# 프론트 D18 최종 거래 승인 패널

## 1. 목적

D18은 `FINAL_CONFIRMATION_REQUIRED` 상태에서 정제된 거래 요약을 보여주고,
사용자가 내용을 직접 확인한 뒤 승인·수정·취소 의도를 전달하는 공통 UI를
제공한다. 이 패널은 실제 금융 Action을 실행하지 않으며 승인 요청과 거래
성공을 구분한다.

`FINAL_CONFIRMATION_REQUIRED`는 예금 가입이나 계좌이체처럼 취소하기 어려운
최종 실행 직전에 사용자의 명시적인 결정을 기다리는 상태다. 프론트는 이
상태를 임의로 완료 상태로 변경하지 않는다.

## 2. Demo-bank와 메인 프론트 책임

Demo-bank는 원격 금융 페이지 역할을 하며 실제 checkbox와 버튼 DOM,
`data-ddd-policy="final-confirmation"` 신호와 거래가 발생하지 않는 Mock 흐름을
제공한다.

메인 프론트의 `FinalConfirmationPanel`은 다음만 담당한다.

- 정제된 거래 요약 표시
- 사용자의 직접 확인 checkbox 제공
- 승인·수정·취소 callback 경계 제공
- 요청 처리 중 중복 Action 차단

패널은 Demo-bank DOM을 조작하거나 Viewer Action, Browser Action, 페이지
이동을 실행하지 않는다.

## 3. Summary 모델

특정 예금 또는 이체 DTO에 결합하지 않는 표시 전용 모델을 사용한다.

```ts
interface FinalConfirmationSummaryItem {
  id: string;
  label: string;
  value: string;
}

interface FinalConfirmationSummary {
  transactionType: string;
  items: readonly FinalConfirmationSummaryItem[];
}
```

금액과 기간도 `100,000원`, `12개월`처럼 이미 정제된 표시 문자열로 받는다.
숫자 금액을 변환하는 transport adapter는 D18에 포함하지 않는다. 모델에는
전체 계좌번호, 보안 입력, 실제 고객정보, session·request 식별자와 원시
오류를 넣지 않는다.

## 4. 검증과 fail-closed 정책

`analyzeFinalConfirmationSummary`는 요약을 `READY`, `EMPTY`, `INVALID`로
분류한다.

- 비어 있지 않은 거래 유형과 한 개 이상의 item이 필요하다.
- item ID는 공개 가능한 kebab-case만 허용한다.
- 대문자, 공백, underscore, slash, 특수문자, 긴 숫자 ID를 거부한다.
- 비밀번호·OTP·PIN·인증번호를 의미하는 ID를 거부한다.
- 중복 ID와 빈 label·value를 거부한다.
- 명백한 주민등록번호·전화번호·미마스킹 계좌번호 형태를 거부한다.
- 포맷된 원화 금액과 가입 기간은 정상 표시 문자열로 허용한다.
- 입력 순서를 유지하고 원본 객체와 배열을 변경하지 않는다.

유효하지 않은 목록은 일부만 표시하지 않는다. 전체를 fail-closed 처리하고
원본 label이나 value를 오류 화면 또는 로그에 노출하지 않는다.

## 5. Controlled props

```ts
interface FinalConfirmationPanelProps {
  title?: string;
  message?: string;
  summary: FinalConfirmationSummary;
  confirmed: boolean;
  approvalRequested?: boolean;
  disabled?: boolean;
  isBusy?: boolean;
  canEdit?: boolean;
  canCancel?: boolean;
  onConfirmedChange: (confirmed: boolean) => void;
  onApprove: () => void;
  onEdit: () => void;
  onCancel: () => void;
  className?: string;
}
```

`confirmed`, `approvalRequested`, `isBusy`와 거래 요약은 모두 부모가 관리한다.
패널은 이를 내부 상태로 복사하거나 mount 시 callback을 호출하지 않는다.
제목과 안내 문구는 앞뒤 공백을 제거하고 빈 값에는 안전한 기본 문구를
사용한다. 모든 문구는 HTML이 아닌 React text로 렌더링한다.

## 6. 승인 Gate

다음 조건을 모두 충족할 때만 승인 버튼이 활성화된다.

```text
summary state === READY
&& confirmed
&& !disabled
&& !isBusy
&& !approvalRequested
```

checkbox는 초기 미선택이며 자동 선택하지 않는다. UI의 실제 `disabled`와
click handler가 같은 순수 Gate 함수를 사용한다. `isBusy` 또는
`approvalRequested` 상태에서는 checkbox와 승인·수정·취소를 모두 막는다.

## 7. Callback 의미

- `onConfirmedChange(checked)`: 사용자가 checkbox를 직접 바꾼 결과만 전달한다.
- `onApprove()`: 최종 승인 요청을 전달하려는 의도만 나타낸다.
- `onEdit()`: 이전 단계에서 거래 내용을 수정하려는 의도만 나타낸다.
- `onCancel()`: 현재 최종 확인 절차를 취소하려는 의도만 나타낸다.

Callback에는 거래 요약이나 세션·요청·확인 식별자를 전달하지 않는다.
수정은 URL이나 history를 직접 바꾸지 않고, 취소는 세션 상태를 직접
`CANCELLED`로 확정하지 않는다.

승인 요청은 실제 송금·가입 완료, 잔액 변경, 금융기관 승인이나 영수증
발급을 의미하지 않는다. Backend 결과를 받기 전에는 완료 또는 성공을
표시하지 않는다.

## 8. Selector

모든 고정 selector와 동적 summary selector는 `id`와 `data-testid`를 같은
값으로 사용한다.

```text
panel-final-confirmation
heading-final-confirmation
summary-final-confirmation
checkbox-final-confirmation
status-final-confirmation
btn-final-approve
btn-final-edit
btn-final-cancel
preview-final-confirmation
select-preview-final-confirmation-state
summary-final-confirmation-{itemId}
```

동적 selector에는 배열 index나 실제 금융정보를 사용하지 않는다. Demo-bank와
메인 프론트는 서로 다른 DOM에서 실행되므로 D1의 checkbox·버튼 selector를
함께 사용할 수 있다.

## 9. 접근성

- 이름 있는 `Panel`과 연결된 heading을 사용한다.
- 거래 유형과 상세 항목은 `dl`, `dt`, `dd`로 표시한다.
- native checkbox와 label을 연결한다.
- 승인·수정·취소는 실제 `button type="button"`을 사용한다.
- 공통 `Button size="lg"`로 최소 높이 56px을 유지한다.
- 승인 불가 상태에는 실제 `disabled`를 적용한다.
- root의 `aria-busy`로 처리 대기 상태를 전달한다.
- 단일 동적 상태 문구에 `role="status"`, `aria-live="polite"`,
  `aria-atomic="true"`를 적용한다.
- 상태는 색상뿐 아니라 문장으로 전달하고 승인 버튼에 `aria-pressed`를
  사용하지 않는다.
- 자동 focus를 사용하지 않으며 기존 focus-visible, forced-colors,
  reduced-motion 정책을 재사용한다.

## 10. 보안 정책

패널과 Preview는 전체 계좌번호, 비밀번호, OTP, 인증번호, 주민등록번호,
전화번호, 실제 고객정보를 저장하거나 표시하지 않는다. raw Backend 오류,
stack, endpoint, AI reasoning과 prompt도 받지 않는다.

`dangerouslySetInnerHTML`, API, fetch, XMLHttpRequest, WebSocket, STOMP,
브라우저 storage, Cookie, history·location 변경, timer, console 출력과 실제
금융 Action을 사용하지 않는다. checkbox 선택과 승인 요청을 자동으로
수행하지 않는다.

## 11. Preview 범위

`FinalConfirmationPanelPreview`는 App에 연결하지 않은 개발용 Preview다.

- 이체 확인 전·확인 선택
- 예금 확인 전
- 승인 요청 전달
- busy·disabled
- invalid summary
- 수정·취소 요청

Preview는 명백한 Mock 표시 문자열과 로컬 controlled 상태만 사용한다. 실제
API, WebSocket, storage, URL 이동, 거래 완료 화면 이동은 없다.

## 12. 테스트 범위

모델 테스트는 summary 상태, ID·민감 형태 검증, 순서와 입력 불변성, 승인
Gate 전체 조합을 확인한다. Panel 테스트는 selector, 시맨틱 구조, native
checkbox, controlled rerender, callback 경계, pending 차단, 접근성과 외부
효과 부재를 확인한다. Preview 테스트는 모든 대표 상태와 실제 금융 Action
부재를 확인한다.

기존 WorkflowStatusPanel, 사용자 선택·약관·보안 입력 패널, F5 Controller,
session-frame, Viewer·Overlay, STT·TTS 회귀는 프론트 전체 테스트로 확인한다.

## 13. Backend·AI 연동 경계와 남은 계약

Backend에는 최종 승인과 거절 REST endpoint가 있지만 이 공통 Panel은 이를
직접 호출하지 않는다. 현재는 대기 중인 confirmation ID 저장·일치 검증,
idempotency, timeout·stale 처리, 구조화된 summary의 실제 transport가 완전히
연결되지 않았다.

승인 후 Backend는 세션 상태를 `AI_EXECUTING`으로 변경하지만 보류된 Browser
Action을 안전하게 재개하는 계약은 아직 없다. AI Engine도 최종 거래
분류 결과와 일반 production 응답 mapper의 연결, 구조화된 summary schema와
승인 후 재판단 방식이 남아 있다. 따라서 D18은 자동화를 재개하지 않는다.

## 14. App 연결과 제외 범위

Preview와 Panel은 App production 진입점에 연결하지 않는다. D18에서는 다음을
구현하지 않는다.

- 실제 승인·거절 API와 WebSocket
- 실제 수정 화면 이동과 session 취소
- Backend Browser Action과 승인 후 자동 재개
- 실제 거래 완료 화면, 거래번호와 영수증
- 보안 입력과 위험 경고
- Viewer 클릭·Target 실시간 연동
- 기존 상태·이벤트 union 변경
- 새 package 설치
