# 프론트 D10 Target 집중 안내 효과

## 1. 목적과 범위

D10은 D9 Target Highlight의 좌표·테두리·포인터·live region 계약을 유지하면서
사용자가 확인할 Target 외부만 암전하고 약하게 흐리며, 현재 Mock frame의 Target
주변을 확대해서 보여 주는 집중 안내 모드를 제공한다.

현재 구현은 D7 로컬 SVG frame과 D9 고정 Target을 이용한 프론트 Mock이다. 실제
WebSocket, Binary frame protocol, Canvas 클릭, 원격 Action 및 금융 기능과 연결하지
않는다. App 제품 흐름에도 연결하지 않는다.

## 2. D9 Target Highlight와의 관계

다음 D9 계약을 변경하지 않는다.

- 1280 × 720 서버 좌표와 D8 contain 좌표 변환
- 일부 범위 밖 Target clip과 완전히 범위 밖 Target 제거
- 4px 노란 테두리와 어두운 outline
- 32 × 40 inline SVG 포인터와 Viewer 경계 배치
- `target=null` 또는 `visible=false`일 때 overlay 즉시 제거
- message와 `elementId`를 전달하는 단일 `role="status"`, `aria-live="polite"`
- 모든 시각 레이어의 `pointer-events: none`
- reduced-motion 환경의 정적 고대비 테두리

D10 focus effect props는 선택값이고 기본적으로 비활성화된다. 기존 F3 사용처는
별도 변경 없이 D9 border, pointer와 live region만 계속 표시한다.

## 3. 네 개의 dim panel

D8에서 clip과 display 변환을 마친 Target rect를 기준으로 상·하·좌·우 네 영역을
계산한다.

```text
┌──────────────────── top ────────────────────┐
├──────── left ───────┬─ Target ─┬── right ──┤
└─────────────────── bottom ──────────────────┘
```

각 panel은 Target 경계에서 끝나므로 Target 내부를 덮지 않는다. 0 크기 panel은
DOM에 만들지 않으며, 유효하지 않거나 Viewer 밖인 rect를 임의로 clamp하지 않는다.
D9에서 제거한 9999px shadow, CSS mask와 clip-path는 사용하지 않는다.

dim 색상 `rgba(15, 23, 42, 0.48)`과 `blur(2px)`는 서버 계약이 아니라 D10 Mock
기본값이다. 브라우저가 `backdrop-filter`를 지원하지 않으면 blur만 빠지고 반투명
dim 배경은 유지된다. 구형 WebKit 계열을 위해 `-webkit-backdrop-filter`도 함께
선언한다.

## 4. Magnifier

magnifier는 현재 `ViewerFrame.imageSrc`를 React style의 CSS `background-image`로
재사용한다. 현재 frame의 contain 렌더링 크기에 확대 배율을 적용해
`background-size`를 계산하고, Target 중심이 lens 중앙에 오도록
`background-position`을 계산한다. 이미지 비율은 변경하지 않고 반복 표시도 끈다.

다음 값은 모두 D10 Mock 기본값이며 확정된 서버 규격이 아니다.

| 항목 | Mock 값 |
| --- | ---: |
| lens 크기 | 180 × 112.5 CSS px |
| 확대 배율 | 2배 |
| Target 간격 | 16px |

배치 순서는 오른쪽, 왼쪽, 아래, 위다. 기존 포인터 rect는 배치 금지 영역으로
전달한다. Viewer 경계, Target 또는 포인터와 겹치는 후보는 사용하지 않고 안전한
공간이 없으면 magnifier만 숨긴다. 이때 dim, border와 pointer는 유지한다.

Canvas `getImageData`, `toDataURL`, source Canvas `drawImage`, 별도 Canvas 복사,
Object URL 생성·해제는 사용하지 않는다. 따라서 D10 overlay가 Canvas 픽셀을 읽거나
이미지를 외부로 전송하지 않는다.

## 5. READY Gate와 frame 변경

F2의 `renderOverlay` context는 기존 `displaySize`와 함께 현재 `frameStatus`와
`imageSrc`를 전달한다. focus effect는 다음 조건에서만 표시한다.

- 유효한 Target과 display rect
- `focusEffectsEnabled=true`
- 현재 frame 상태가 `READY`

EMPTY, LOADING, ERROR에서는 기존 D9 border·pointer·live region을 유지할 수 있지만
dim, blur와 magnifier는 표시하지 않는다. frame 객체가 바뀌면 effect가 실행되기
전에 overlay context를 새 frame의 LOADING으로 계산하므로 이전 frame의 focus
effect를 즉시 제거한다. 새 frame이 READY가 되면 현재 `imageSrc`를 사용해 다시
표시한다. 이전 `imageSrc`는 별도 상태에 저장하지 않는다.

## 6. Selector

기존 D9 selector:

- `overlay-target-highlight`
- `border-target-highlight`
- `pointer-target-highlight`
- `status-target-highlight`
- `viewer-target-highlight-preview`
- `viewer-remote-screen`
- `canvas-remote-screen`
- `status-viewer-frame`

D10 selector:

- `dim-target-highlight-top`
- `dim-target-highlight-bottom`
- `dim-target-highlight-left`
- `dim-target-highlight-right`
- `magnifier-target-highlight`

각 selector의 `id`와 `data-testid`는 같다.

## 7. 접근성과 표시 환경

- dim panel과 magnifier는 장식 요소이며 `aria-hidden="true"`다.
- 신규 요소는 포커스를 받지 않고 입력을 가로채지 않는다.
- Target 정보는 기존 `status-target-highlight` 한 곳에서만 안내한다.
- `prefers-reduced-motion: reduce`에서는 기존 glow animation을 중단하며 dim, blur와
  magnifier는 animation 없이 정적으로 유지한다.
- `forced-colors: active`에서는 Target border와 magnifier에 시스템 `Highlight`와
  `CanvasText` 색상을 사용하고 shadow를 제거한다.
- 색상뿐 아니라 border, pointer와 live text로 Target 의미를 전달한다.

## 8. 보안과 성능

- 실제 금융정보와 외부 이미지 URL을 추가하지 않는다.
- `fetch`, WebSocket, storage, console logging과 이미지 전송을 사용하지 않는다.
- 네 panel과 하나의 lens만 추가하며 timer와 `requestAnimationFrame`을 만들지 않는다.
- resize는 기존 `useCanvasDisplaySize`와 `ResizeObserver` 결과를 재사용한다.
- Object URL 생명주기는 향후 frame 공급자가 관리하며 overlay가 소유하지 않는다.
- 보안 입력 상태에서는 Viewer 캡처와 focus effect를 모두 제거해야 하지만 실제 상태
  연동은 D10 범위가 아니다.

## 9. 테스트와 브라우저 검증 범위

Vitest와 JSDOM에서 다음 계약을 자동 검증한다.

- dim panel 수치, 면적, 경계, 불변성과 잘못된 입력
- magnifier 우선 배치, 포인터 회피, 공간 부족 fallback과 불변성
- F3 selector, inline style, 접근성, pointer-events와 READY Gate
- F2 overlay context의 displaySize, frameStatus와 imageSrc
- frame 교체 시 focus effect 제거 및 최신 imageSrc 복원
- resize 후 panel과 magnifier 재계산
- 기존 D6~D9 Viewer 및 Target Highlight 회귀

JSDOM은 실제 backdrop blur, panel seam, compositor 비용과 확대 이미지의 시각 품질을
검증할 수 없다. App에 Preview를 연결하지 않으므로 이번 단계에서는 실제 브라우저
렌더링을 완료했다고 주장하지 않는다. 해당 항목은 후속 수동 브라우저 검증 대상이다.

검증 명령:

```powershell
npm.cmd test -- --run src/features/F3_SmartOverlay/model/focus-effects.test.ts
npm.cmd test -- --run src/features/F3_SmartOverlay/ui/F3_SmartOverlay.test.tsx
npm.cmd test -- --run src/features/F2_StreamViewer/ui/F2_StreamViewer.test.tsx
npm.cmd test -- --run src/features/F2_StreamViewer/ui/F2_StreamViewerTargetPreview.test.tsx
npm.cmd test
npm.cmd run build
git diff --check
```

현재 D10 검증 결과:

- 관련 4개 테스트 파일: 97개 테스트 통과
- 전체 테스트: 26개 파일, 286개 테스트 통과
- TypeScript와 Vite production build: 통과
- 실제 브라우저 blur·magnifier 시각 검증: App 미연결로 수행하지 않음

## 10. D10 제외 범위

- 실제 WebSocket과 Binary frame protocol
- frameId 또는 timestamp 결합
- Canvas 클릭과 `USER_BROWSER_ACTION`
- 원격 클릭·스크롤 및 Target 자동 탐색
- backend 좌표 변환
- STT/TTS와 App 제품 흐름 연결
- demo-bank와 실제 금융 기능
- 새 패키지

## 11. 개발자 B와 합의할 항목

- Target과 frame의 frameId 또는 timestamp 연결
- Target 제거 이벤트 형식
- 실제 magnifier 픽셀 확대 필요 여부
- Binary Object URL 생성·폐기 책임
- 외부 이미지와 CORS 가능성
- dim 투명도와 blur 강도
- 보안 입력 상태에서 overlay 제거 시점
