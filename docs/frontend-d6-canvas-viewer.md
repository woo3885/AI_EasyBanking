# 프론트 D6 Canvas 원격 화면 Viewer

## 목표와 범위

D6는 백엔드가 캡처한 원격 브라우저 화면을 표시할 Canvas Viewer의 입력 경계와 렌더링 골격을 제공한다. 실제 WebSocket 연결, Binary 처리, 사용자 좌표 전송, Target Highlight는 포함하지 않는다. Viewer는 실제 금융 기능을 실행하지 않으며 로컬 Mock에도 민감정보가 없다.

## 1280 × 720 좌표계

- 기준 해상도: 1280 × 720
- 원점: 화면 왼쪽 위 `(0, 0)`
- X 좌표: 오른쪽으로 증가
- Y 좌표: 아래쪽으로 증가
- Canvas의 내부 bitmap 크기는 항상 1280 × 720이다.
- CSS 표시 크기는 컨테이너 너비에 맞춰 줄어들 수 있지만 16:9 비율을 유지한다.

CSS 표시 크기와 Canvas 내부 좌표는 서로 다르다. D6는 내부 좌표만 고정하며, 표시 좌표와 서버 좌표 사이의 변환은 D8에서 구현한다. 1280 × 720이 아닌 프레임을 임의로 늘리거나 줄이지 않고 오류로 안내한다.

## ViewerFrame 입력 계약

`ViewerFrame`은 다음 두 값을 결합한 프론트 전용 타입이다.

- `metadata`: 기존 `BrowserFrameEvent` JSON 메타데이터로 세션, timestamp, 너비와 높이를 전달한다.
- `imageSrc`: Canvas의 `Image`가 로딩할 수 있는 URL이다.

로컬 Mock은 프론트 렌더링과 테스트를 위한 1280 × 720 SVG이며 개발자 B의 실제 캡처 결과가 아니다. 실제 `BROWSER_FRAME` 이미지는 Binary WebSocket 수신을 우선하고 JSON에 Base64 이미지 문자열을 추가하지 않는다. D7에서 Binary 데이터를 연결할 때 Blob Object URL 등을 `imageSrc` 경계에 공급할 수 있다.

## 상태와 렌더링

| 상태 | 의미 |
| --- | --- |
| `EMPTY` | 전달된 프레임이 없음 |
| `LOADING` | 새 이미지 URL을 로딩 중 |
| `READY` | 이미지 로딩과 Canvas 그리기 완료 |
| `ERROR` | 이미지 로딩 실패, Canvas context 실패 또는 해상도 불일치 |

새 이미지가 로드되면 `clearRect` 후 `(0, 0, 1280, 720)` 영역에 `drawImage`한다. 프레임이 빠르게 바뀌면 이전 이미지의 늦은 `onload`가 최신 Canvas를 덮지 않도록 effect 정리 시 해당 작업을 취소한다.

## 접근성 및 안정적 selector

- Viewer 루트: `viewer-remote-screen`
- Canvas: `canvas-remote-screen`
- 상태 live region: `status-viewer-frame`

각 요소의 `id`와 `data-testid`는 동일하다. Canvas에는 원격 화면을 설명하는 `aria-label`과 미지원 환경용 fallback 문구가 있다. 상태 영역은 `role="status"`, `aria-live="polite"`를 사용하며 상태명과 안내 문장을 텍스트로 함께 제공한다.

## 이후 단계

- D7: Binary WebSocket 프레임 연결
- D8: CSS 표시 좌표와 1280 × 720 서버 좌표 변환
- D9: `TARGET_HIGHLIGHT` 시각화와 overlay

## D7 전 개발자 B와 합의할 항목

다음 항목은 D6에서 확정한 프로토콜이 아니며 D7 구현 전에 협의해야 한다.

- 이미지 MIME 타입을 PNG와 JPEG 중 어떤 범위로 허용할지
- JSON metadata와 Binary frame을 대응시키는 ID 또는 수신 순서
- `timestamp`의 단위, 생성 시점과 정렬 기준
- 한 세션에서 여러 프레임이 도착할 때 최신 프레임을 선택하는 기준
- Blob Object URL을 생성하고 `URL.revokeObjectURL`로 해제할 주체와 시점

비밀번호, OTP, 계좌번호 원문 등 민감정보가 포함된 화면은 캡처하거나 Mock으로 저장하지 않는다.
