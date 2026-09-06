# 사용자 DOM 기반 Overlay Target

## 목적

사용자 브라우저에 표시되는 Demo Bank DOM을 기준으로 안내 위치를 계산한다. Backend Playwright의 좌표는 사용자 브라우저의 스크롤·레이아웃과 다를 수 있으므로 사용자 브라우저 Overlay의 표시 좌표로 사용하지 않는다.

## 계약

사용자 브라우저 binding에서는 다음 v2 계약만 허용한다.

- `contractVersion: 2`
- `materializationMode: USER_DOM_PUBLIC_TARGET`
- `locator.type: PUBLIC_TARGET_KEY`
- 공개 식별자인 `locator.publicTargetKey`
- `role`, `accessibleName`, `actionMode: GUIDE_USER_CLICK`
- `targetId`, `pageIdentity`, `sourceSnapshotId`, 만료 시각

raw selector, XPath, Backend 내부 element ID는 수신하거나 DOM 조회에 사용하지 않는다. 기존 `BACKEND_VIEWPORT_RECT` 좌표 계약은 사용자 브라우저 경로에서 거절하며 Backend Viewer용 legacy 의미로만 구분한다.

현재 Demo Bank의 공개 target은 다음과 같다.

| 화면 | 공개 target key | 접근 가능한 이름 |
| --- | --- | --- |
| `/deposit/products` | `deposit-product-12m-select` | `12개월 정기예금 선택` |
| `/deposit/products` | `deposit-product-preferred-select` | `우대금리 정기예금 선택` |

공개 key는 selector가 아니다. Frontend는 고정 selector `[data-ddd-public-target]`로 후보 전체를 열거하고 `dataset.dddPublicTarget` 값을 exact 비교한다. 문자열 보간 selector와 fallback 탐색은 사용하지 않는다.

## DOM materialization

`useDomTargetOverlay`는 다음 조건을 모두 만족하는 요소가 정확히 하나일 때만 target을 표시한다.

1. 공개 target key와 현재 Demo route가 일치한다.
2. 같은 공개 key를 가진 요소가 정확히 하나다.
3. DOM role과 계약의 role이 일치한다.
4. 명시적 `aria-label`과 `accessibleName`이 일치한다.
5. 요소가 표시되고 활성화되어 있다.
6. 요소가 `data-ddd-agent-ui="true"` 경계 안에 있지 않다.

표시 좌표는 해석된 실제 요소의 `getBoundingClientRect()`로 계산하며 CSS `position: fixed`로 렌더링한다. `devicePixelRatio`는 다시 곱하지 않는다. scroll, resize, `visualViewport`, `ResizeObserver` 변화에서는 같은 요소를 다시 검증하고 좌표를 재측정한다. target이 사라지거나 중복·불일치하면 fail-closed로 제거한다.

## 실제 사용자 클릭 관찰

Overlay 자체는 `pointer-events: none`이다. production Frontend는 `element.click()`, synthetic event, 자동 scroll·focus·click을 수행하지 않는다. 실제 click event의 `composedPath()`에 해석된 DOM 요소가 포함되고 클릭 좌표가 최신 로컬 rectangle 안에 있을 때만 observation을 한 번 전송한다.

Observation body는 Backend DTO에 정의된 필드만 사용한다.

- `requestId`, `targetId`, `sourceSnapshotId`
- `publicTargetKey`, `role`, `actionMode`
- `localRectangle`, `clickPosition`
- `observationType: USER_CLICK`, `clientOccurredAt`

`browserBindingId`와 `pageIdentity`는 기존 보안 header로 전달한다. HTTP 202 `OBSERVATION_ACCEPTED`는 접수 상태일 뿐 완료가 아니다. ACK가 먼저 도착하면 `WAITING_FOR_RESULT`를 유지하고, identity가 일치하는 `USER_ACTION_OBSERVED`에서만 관찰 완료로 전환한다. `OVERLAY_CLEAR` 또는 `USER_ACTION_OBSERVED`가 HTTP 응답보다 먼저 도착해도 진행 중 fetch를 조기에 중단하지 않고 202 ACK identity 검증을 끝낸다. 자동 retry는 하지 않는다.

## Identity와 보안

사용자 문구와 프로토콜 식별자는 서로 다른 정책으로 검증한다. label·guide에는 민감정보·HTML·제어문자 방어를 적용하지만 UUID형 session/event/target/snapshot ID에는 형식·길이만 검사한다. 따라서 숫자 그룹으로 구성된 정상 UUID가 계좌번호 오탐으로 차단되지 않는다.

Bridge token은 기존과 같이 메모리에만 유지한다. URL, storage, console, 문서에 기록하지 않는다. secure input, risk warning, final confirmation, terminal, reconnect, navigation, session 교체 및 unmount 시 기존 보호·cleanup 정책을 유지한다.

## 검증 범위

- v2 event/recovery/clear/observed runtime parser와 malformed payload 차단
- 공개 target exact 조회, 중복·role·accessible name·disabled·route 불일치 차단
- scroll·resize·`ResizeObserver` 좌표 재측정
- 실제 DOM click 1회와 observation body·ACK identity
- 보호 상태·reconnect·StrictMode 회귀
- Demo 상품 선택 Gate와 기존 ID·`data-testid`·`aria-pressed` 유지
- 실제 Chromium 1280×720, DPR 1에서 의도적 스크롤 후 Overlay와 DOM rectangle 일치 확인

## 실제 Chromium E2E 결과

최신 `origin/develop` 기반 Frontend·Backend·AI Engine·Demo Bank production 서비스를 함께 실행하고, 격리된 headless Playwright Chromium에서 다음 흐름을 확인했다.

```text
/transfer/accounts
→ 자연어 요청 HTTP 202
→ browser binding
→ NAVIGATION_REQUIRED
→ /deposit/products SPA 이동
→ page-ready / PAGE_READY_OBSERVED
→ OVERLAY_TARGET v2
→ 사용자 DOM 공개 target 해석
→ Playwright mouse.click()
→ observation HTTP 202
→ OVERLAY_CLEAR / USER_ACTION_OBSERVED
→ AI 재개
```

- viewport: 1280×720, DPR 1
- 의도적 `scrollY`: 641px
- 실제 상품 버튼과 highlight의 `x`, `y`, `width`, `height`: 모두 동일(오차 0 CSS px)
- 클릭 전 observation: 0회
- production 자동 상품 클릭: 0회
- 사용자 클릭 observation: 1회
- `USER_ACTION_OBSERVED`: 1회
- 클릭 이후 AI 재개: 1회
- 브라우저 console error: 0회

E2E 과정에서 서버의 `OVERLAY_CLEAR`가 observation HTTP 응답보다 먼저 도착하는 실제 순서를 확인했고, 이에 대한 ACK 조기 abort 회귀 테스트를 추가했다.

Demo Bank의 공개 target 범위가 확대되면 Backend와 합의된 공개 key·route만 상수에 추가한다. 임의로 ID나 selector를 추론하지 않는다.
