# 프론트 D11 대형 Main Controller

## 목적

D11은 사용자가 현재 업무의 진행을 직접 제어할 수 있도록 다시 듣기,
일시정지·계속 진행, 이전 단계, 취소 버튼을 제공한다. 모든 동작은 실제 실행
완료가 아닌 callback 요청 경계까지만 구현한다. 개발자 B의 범용 Action API가
확정되기 전까지 API, WebSocket, 브라우저 history를 직접 조작하지 않는다.

## 버튼과 callback

| 버튼 | 의미 | callback |
| --- | --- | --- |
| 다시 듣기 | 현재 안내를 다시 들려 달라고 요청 | `onReplay()` |
| 일시정지 | 현재 업무의 일시정지를 요청 | `onPauseChange(true)` |
| 계속 진행 | 일시정지된 업무의 재개를 요청 | `onPauseChange(false)` |
| 이전 단계 | 원격 브라우저 뒤로 가기가 아닌 workflow 단계 이동을 요청 | `onPrevious()` |
| 취소 | 확인 Gate를 거친 뒤 현재 업무의 취소를 요청 | `onCancel()` |

다시 듣기는 D11에서 callback만 호출한다. 실제 `speechSynthesis`, 음성 출력,
TTS 속도 조절은 D13 범위다. 이전 단계도 `BrowserActionType.GO_BACK`이나
`window.history.back()`을 사용하지 않는다.

## Props 계약

```ts
interface MainControllerProps {
  message?: string;
  isPaused: boolean;
  canReplay?: boolean;
  canPause?: boolean;
  canGoPrevious?: boolean;
  canCancel?: boolean;
  isBusy?: boolean;
  onReplay: () => void;
  onPauseChange: (isPaused: boolean) => void;
  onPrevious: () => void;
  onCancel: () => void;
}
```

`isPaused`는 부모가 확정하는 controlled 상태다. 버튼 클릭 직후 F5가 값을
임의로 바꾸지 않으며 부모가 새 prop을 전달했을 때 문구와 `aria-pressed`가
변한다. 모든 capability와 `isBusy`의 기본값은 `false`다. 따라서 부모가
명시적으로 허용하지 않은 동작은 자동으로 활성화되지 않는다.

다시 듣기는 `canReplay=true`, `isBusy=false`, `message.trim()`이 비어 있지
않을 때만 활성화된다. 다른 버튼도 해당 capability가 `true`이고 busy가
아닐 때만 활성화된다. `message`는 callback 인자, 로그 또는 저장소로 전달하지
않는다.

## 취소 확인 Gate

취소 최초 클릭은 `onCancel`을 호출하지 않고 inline `alertdialog`를 연다.
제목과 설명은 `aria-labelledby`, `aria-describedby`로 연결된다. 패널이 열리면
안전한 기본 동작인 **계속 이용**으로 focus를 이동한다.

- 계속 이용: 패널을 닫고 기존 취소 버튼으로 focus 복귀
- Escape: callback 없이 패널을 닫고 기존 취소 버튼으로 focus 복귀
- 취소 확인: `onCancel()`을 한 번 호출하고 요청 안내 표시
- busy: 취소 확인 버튼을 비활성화하여 중복 요청 차단, 계속 이용은 허용

취소 확인 후에도 세션 종료, 취소 완료 또는 Dashboard 이동을 확정해서
표시하지 않는다.

## 상태 안내

`status-controller-action`은 고정된 `role="status"`, `aria-live="polite"`
영역이다. 초기에는 요청된 동작이 없음을 표시하고 클릭 뒤에는 다음과 같이
완료가 아닌 요청 의미만 전달한다.

- 안내 다시 듣기를 요청했습니다.
- 일시정지를 요청했습니다.
- 계속 진행을 요청했습니다.
- 이전 단계 이동을 요청했습니다.
- 업무 취소를 요청했습니다.

## 고정 selector

모든 selector는 `id`와 `data-testid`에 같은 값을 사용한다.

- `controller-main`
- `btn-controller-replay`
- `btn-controller-pause`
- `btn-controller-previous`
- `btn-controller-cancel`
- `status-controller-action`
- `panel-controller-cancel-confirm`
- `btn-controller-cancel-dismiss`
- `btn-controller-cancel-confirm`
- `preview-main-controller`
- `status-preview-controller-action`

## 배치와 접근성

공통 `Button`의 `size="lg"`를 사용하여 최소 높이 56px을 보장한다. 버튼은
모바일 1열, 태블릿 2열, 데스크톱 4열이며 간격은 12px이다. 취소 동작은
`danger`, 나머지는 `secondary` variant다. 텍스트로 기능과 상태를 전달하며
별도 아이콘이나 애니메이션을 추가하지 않았다.

컨트롤러는 `aria-label="업무 진행 컨트롤"`이 있는 `section`이며 busy 상태를
`aria-busy`로 제공한다. 모든 동작은 실제 `button type="button"`이고 실제
`disabled`, 공통 focus-visible, pause toggle의 `aria-pressed`, 자연스러운
DOM·Tab 순서를 사용한다. 기존 전역 reduced-motion 정책을 유지한다.

자동화 테스트는 DOM 역할, 이름, focus 이동, Escape 및 callback 계약을
검증한다. 실제 브라우저 반응형 외관, 실제 스크린리더 낭독, 운영체제
forced-colors 표현은 브라우저 진입점이 없어 수동 확인 항목으로 남긴다.

## Mock Preview

`F5_MainControllerPreview`는 App 제품 흐름과 연결하지 않는 개발용 Mock이다.
모든 capability를 명시적으로 활성화하고 `isPaused`와 마지막 callback 요청만
로컬 상태로 관리한다. D12·D13 구현 시 controller 계약을 재사용할 수 있다.
Preview는 fetch, WebSocket, speech synthesis, history, storage를 사용하지 않는다.

## 보안 및 제외 범위

- mount 또는 사용자 확인 전 callback 자동 호출 금지
- 안내 message와 sessionId의 로그·저장·callback 전달 금지
- 비밀번호, OTP, 계좌번호 원문을 message나 payload에 포함 금지
- 실제 API endpoint, fetch, WebSocket, storage, history 조작 금지
- 실제 금융 Action과 자동 세션 종료 금지
- Web Speech API, TTS, STT, 마이크 권한은 D11에서 제외
- App 제품 흐름, Viewer 클릭·스크롤, backend, demo-bank, ai-engine 수정 제외

## 검증 결과

- MainController 관련 테스트: 1개 파일, 14개 테스트 통과
- Preview 관련 테스트: 1개 파일, 5개 테스트 통과
- 전체 테스트: 28개 파일, 305개 테스트 통과
- Build: `tsc -b && vite build` 성공
- 실제 브라우저 시각 검증: App 연결 금지로 미실시

## 개발자 B와 합의할 항목

- pause와 resume의 transport 및 별도 `RESUME` 이벤트 필요 여부
- 이전 단계 workflow API와 원격 브라우저 `GO_BACK`의 경계
- cancel REST API와 WebSocket 이벤트 중 기준 경로
- 성공, 실패, timeout 응답과 화면 상태 반영
- 중복 요청 및 idempotency 처리
- `requestId` 필요 여부
- paused 상태의 `WorkflowStatus` 표현
- 보안 입력·최종 확인 상태별 허용 control
- 취소 후 세션 상태와 화면 전환 정책
