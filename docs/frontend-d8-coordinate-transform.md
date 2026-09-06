# 프론트 D8 Viewer 좌표 변환

## 목표와 적용 전제

D8은 1280 × 720 서버 프레임 좌표와 반응형 Viewer의 CSS 표시 좌표 사이를
변환하는 순수 TypeScript 계약을 제공한다. 이미지 비율을 유지하는 contain
계산, letterbox 판정, point 정방향·역방향 변환과 Target Highlight용 rect
변환을 포함한다.

현재 구현은 서버 좌표가 **1280 × 720 viewport frame 좌표**라는 전제의
프론트 계산 계약이다. 저장소에는 개발자 B의 명시적인 viewport 좌표 계약이
아직 없으므로 실제 서버 연동이 완료됐다고 판단하지 않는다. full-page
screenshot 좌표를 지원한다고 주장하지 않는다.

D8은 React, DOM API, WebSocket과 실제 사용자 클릭을 연결하지 않는다.
실제 overlay UI와 이벤트 통합은 D9 범위다.

## 다섯 좌표계

| 좌표계 | 기준과 용도 |
| --- | --- |
| 서버 프레임 | 1280 × 720, 좌측 상단 원점, X는 오른쪽, Y는 아래쪽 |
| Canvas bitmap | Canvas `width`와 `height` attribute의 1280 × 720 내부 좌표 |
| Canvas CSS 표시 | 반응형으로 표시된 Canvas의 CSS pixel 좌표 |
| viewport client | pointer의 `clientX`, `clientY`와 같은 viewport CSS pixel 좌표 |
| overlay local | Canvas 표시 영역을 원점으로 하는 D9 overlay CSS pixel 좌표 |

Canvas bitmap과 서버 프레임은 현재 동일한 1280 × 720 크기다. Canvas CSS
표시 크기는 화면에 따라 달라질 수 있으므로 별도 변환이 필요하다.

## Contain transform

서버 이미지의 비율을 왜곡하지 않도록 X와 Y에 하나의 scale만 사용한다.

```text
scale = min(
  displayWidth / serverWidth,
  displayHeight / serverHeight
)

renderedWidth = serverWidth × scale
renderedHeight = serverHeight × scale
offsetX = (displayWidth - renderedWidth) / 2
offsetY = (displayHeight - renderedHeight) / 2
```

`offsetX` 또는 `offsetY`가 0보다 크면 해당 방향에 letterbox 영역이 있다.
X와 Y를 독립 비율로 늘리지 않으므로 프레임과 D9 overlay가 함께 같은 위치를
유지한다.

## Point 변환

서버 point를 표시 point로 변환한다.

```text
displayX = offsetX + serverX × scale
displayY = offsetY + serverY × scale
```

표시 point를 서버 point로 역변환한다.

```text
serverX = (displayX - offsetX) / scale
serverY = (displayY - offsetY) / scale
```

point 범위는 반열린 구간을 사용한다.

- X: `0 <= x < width`
- Y: `0 <= y < height`
- rendered frame의 오른쪽과 아래쪽 경계는 포함하지 않는다.
- letterbox와 컨테이너 바깥 point는 `null`이다.
- 사용자 클릭 좌표를 frame 안으로 clamp하지 않는다.

## Viewport client 좌표

Canvas의 실제 표시 rect에서 필요한 값만 `ViewerDisplayBounds`로 전달한다.

```text
localX = clientX - bounds.left
localY = clientY - bounds.top
```

`clientPointToDisplayPoint`는 DOM API나 `getBoundingClientRect()`를 직접
호출하지 않는다. 호출 측에서는 border가 있는 wrapper가 아니라 **실제
Canvas 자체의 `getBoundingClientRect()`** 결과에서 `left`, `top`, `width`,
`height`만 추출해야 한다.

`getBoundingClientRect()`는 요소의 border box를 반환한다. 현재 Canvas
자체에는 border와 padding이 없지만 wrapper에는 2px border가 있으므로
wrapper rect를 사용하면 drawable 영역과 좌표 원점이 어긋날 수 있다.

## Rect clip과 표시 변환

Target rect의 width와 height는 0보다 커야 한다. 서버 frame을 일부 벗어난
rect는 frame과의 교집합으로 자르고, 완전히 벗어나거나 면적이 0인 rect는
`null`로 처리한다.

```text
displayX = offsetX + clippedX × scale
displayY = offsetY + clippedY × scale
displayWidth = clippedWidth × scale
displayHeight = clippedHeight × scale
```

결과는 D9 overlay style에 사용할 수 있는 CSS pixel 값이다. 내부 계산과
rect 결과는 실수를 유지하며 x, y, width, height를 각각 반올림하지 않는다.
CSS에는 소수 px을 사용할 수 있다.

실제 클릭 좌표의 정수화는 서버 전송 직전에 별도 계약으로 수행할 예정이다.
D8은 클릭을 전송하거나 정수화하지 않는다.

## devicePixelRatio

`getBoundingClientRect()`와 pointer의 client 좌표는 모두 CSS pixel 단위다.
따라서 현재 좌표식에 `devicePixelRatio`를 직접 곱하지 않는다. DPR을 다시
곱하면 고밀도 화면에서 좌표가 두 배 이상 이동한다.

향후 Canvas backing store를 DPR에 맞춰 별도로 확장한다면 bitmap과 CSS
표시 크기의 관계를 별도 계약으로 다뤄야 한다. 현재 Canvas bitmap은 서버
프레임과 같은 1280 × 720으로 고정되어 있다.

## 수치 예시

| 서버 → 표시 | scale | 렌더링 크기 | offsetX | offsetY |
| --- | ---: | ---: | ---: | ---: |
| 1280×720 → 960×540 | 0.75 | 960×540 | 0 | 0 |
| 1280×720 → 1000×700 | 0.78125 | 1000×562.5 | 0 | 68.75 |
| 1280×720 → 400×800 | 0.3125 | 400×225 | 0 | 287.5 |

세 사례 모두 서버 중심 `(640, 360)`은 표시 컨테이너 중심으로 변환되고,
역변환하면 다시 `(640, 360)`이 된다.

## D9 재사용 범위

D9은 `TARGET_HIGHLIGHT.target`의 `x`, `y`, `width`, `height`를
`ViewerRect`로 해석하고 `serverRectToDisplayRect`의 결과를 overlay style에
사용할 수 있다. D8은 계산 타입과 함수만 제공한다.

다음은 D9 이후 범위다.

- 실제 Target Highlight overlay 컴포넌트
- 반짝임 테두리, 포인터와 암전 효과
- Canvas click handler
- WebSocket 좌표 전송
- 실제 금융 Action

## 개발자 B와 확인할 계약

실제 연동 완료 전 다음 항목을 확인해야 한다.

- `TARGET_HIGHLIGHT` 좌표가 1280 × 720 viewport screenshot 기준인지
- backend가 full-page screenshot을 사용하는지
- 오른쪽과 아래쪽 경계가 반열린 범위인지
- 서버 전송 시 좌표 정수화 방식
- frame과 Target 이벤트를 대응시키는 ID 또는 순서

확정 전까지 이 구현은 1280 × 720 viewport 좌표를 전제로 한 순수 프론트
수학 계약으로만 사용한다.
