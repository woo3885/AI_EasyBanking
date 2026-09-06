# 프론트엔드 D9 Target Highlight

## 1. 목표와 범위

D9은 1280 × 720 서버 화면 좌표로 전달된 Target을 실제 Canvas 표시 크기에 맞춰 변환하고, Canvas 위에 고대비 테두리와 포인터로 안내하는 Mock UI를 제공한다. 현재 구현은 로컬 Mock 프레임과 좌표를 사용하며 실제 WebSocket 또는 서버 연동 완료를 의미하지 않는다.

App에는 연결하지 않는다. 실제 Canvas 클릭, 클릭 좌표 전송, 금융 Action, 외부 영역 dim, blur, 돋보기는 후속 범위다.

## 2. TARGET_HIGHLIGHT 계약

현재 프론트 계약은 다음 구조다.

```ts
interface TargetHighlightEvent {
  type: "TARGET_HIGHLIGHT";
  sessionId: string;
  target: {
    elementId: string;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  message: string;
}
```

`elementId`는 캡처된 페이지 요소의 식별자다. `targetElementId`는 AI가 행동 대상으로 선택한 요소를 가리키는 참조이며, 두 필드는 임의로 통합하지 않는다.

F3는 전송 계층과 분리하기 위해 전체 이벤트가 아닌 `target`, `serverSize`, `displaySize`, `message`, `visible`만 받는다.

## 3. F2 overlay stage와 Canvas 측정

F2 Viewer의 기존 2px border wrapper 안에 `position: relative` stage를 두고 Canvas와 overlay를 형제 요소로 배치한다. F2는 F3를 import하지 않고 `renderOverlay({ displaySize })` 범용 slot만 제공한다.

wrapper가 아니라 Canvas 자체의 `getBoundingClientRect()`를 측정한다. wrapper border를 좌표 크기에 포함하면 overlay가 Canvas와 2px 어긋날 수 있기 때문이다.

`useCanvasDisplaySize`는 다음 원칙을 따른다.

- Canvas 연결 시 최초 rect 측정
- `ResizeObserver`로 Canvas 크기 변경 관찰
- observer 미지원 시 `window.resize` listener 사용
- element 교체와 unmount 시 observer 또는 listener 정리
- 음수, `NaN`, `Infinity`는 0으로 처리
- 0 × 0이면 overlay를 표시하지 않음

별도 측정 패키지는 사용하지 않는다.

## 4. D8 좌표 변환 재사용

D9은 D8의 `ViewerSize`, `ViewerRect`, `createContainCoordinateTransform`, `serverRectToDisplayRect`를 수정 없이 사용한다.

처리 순서는 다음과 같다.

1. serverSize와 실제 Canvas displaySize로 contain transform 생성
2. 서버 target rect를 frame 경계로 clip
3. scale과 letterbox offset을 포함한 display rect 계산
4. 결과를 CSS `left`, `top`, `width`, `height`에 반영

일부만 server frame 밖인 rect는 clip된 영역을 표시한다. 완전히 밖이거나 크기가 잘못된 rect는 표시하지 않는다. 소수 좌표는 반올림하지 않는다.

## 5. 테두리와 포인터

테두리는 실제 display rect의 크기를 확대하지 않는다. 정적인 4px 노란색 테두리와 어두운 outline을 항상 유지하며, 1.8초 주기의 box-shadow glow만 변화시킨다. 전체 opacity와 scale은 변경하지 않아 Target이 움직이는 것처럼 보이지 않게 한다.

포인터는 외부 asset이 아닌 32 × 40 inline SVG이며 Target과 12px 간격을 둔다.

- 기본: Target 위쪽 중앙에서 아래 방향을 가리킴
- 위쪽 공간 부족: Target 아래쪽에서 위 방향을 가리킴
- 위와 아래 모두 부족: 공간이 더 넓은 방향 선택
- 좌우 및 선택된 방향의 위치: 포인터 전체가 display 안에 있도록 clamp

clamp는 포인터라는 장식 요소에만 적용한다. 실제 Target rect와 향후 클릭 좌표는 변경하지 않는다.

## 6. Lifecycle과 입력 차단 방지

- 새 target 또는 같은 `elementId`의 새 rect가 들어오면 즉시 다시 계산
- target이 `null`이거나 `visible`이 false면 즉시 제거
- 이전 target을 내부 상태로 저장하지 않음
- timer와 자동 숨김 없음
- overlay, border, pointer 모두 `pointer-events: none`
- 실제 click handler와 `USER_BROWSER_ACTION` 전송 없음

## 7. 접근성과 모션 감소

시각 정보는 색상만 사용하지 않고 테두리와 방향 포인터를 함께 표시한다. border와 SVG pointer는 `aria-hidden="true"`이며, 포인터는 포커스를 받지 않는다.

별도 `role="status"`, `aria-live="polite"` 영역에서 message와 `elementId`를 안내한다. message가 비어 있으면 안전한 기본 안내 문구를 사용한다.

`prefers-reduced-motion: reduce`에서는 highlight animation을 완전히 중지한다. 정적 고대비 테두리, glow와 포인터는 유지한다. 기존 전역 reduced-motion 규칙은 그대로 유지한다.

## 8. Mock Preview

`F2_StreamViewerTargetPreview`는 D7 Mock 프레임 스트림과 F2 Viewer를 재사용한다. 다음 고정 Target을 표시한다.

```json
{
  "elementId": "el-d9-demo-target",
  "x": 420,
  "y": 310,
  "width": 180,
  "height": 60
}
```

안내 문구는 `정기예금 메뉴를 선택하겠습니다.`이다. Preview는 App, React Router, 실제 WebSocket에 연결하지 않는다.

## 9. 개발자 B와 확인할 좌표 계약

실제 서버 연결 전에 다음을 확정해야 한다.

- 1280 × 720 viewport screenshot 좌표인지 여부
- full-page screenshot 좌표 사용 여부
- 좌표 경계 포함 규칙
- 정수·소수 허용 및 반올림 주체
- Target과 frame의 timestamp 또는 frameId 대응
- Target 제거 이벤트 또는 `target: null` 지원
- 같은 `elementId`의 rect 갱신 규칙
- 존재하지 않는 `elementId` 처리
- `message` 필수 여부

현재 D9은 Mock 좌표 표시 UI 계약이며 실제 서버 WebSocket 연동은 완료되지 않았다.
