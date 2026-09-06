# 프론트 D7 이미지 프레임 스트림 Mock

## 목표와 구조

D7은 실제 WebSocket 서버 없이 여러 이미지 프레임을 순서대로 D6 Canvas Viewer에 전달하는 Mock 스트림을 제공한다. 기존 `ViewerFrame`의 `BrowserFrameEvent` metadata와 `imageSrc` 경계를 그대로 재사용한다.

`MockBrowserFrameStream`은 React에 의존하지 않는 순수 TypeScript 모델이다. 유효한 프레임을 선별하고 첫 프레임을 즉시 전달한 뒤 재귀 `setTimeout`으로 다음 프레임을 일정 간격마다 전달한다. 마지막 프레임 전달 후 timer를 종료하며 `stop()`은 여러 번 호출해도 안전하다.

`useMockBrowserFrameStream`은 컴포넌트 mount 시 스트림을 생성하고 시작한다. 프레임 callback을 현재 `ViewerFrame` 상태에 반영하며 설정 변경이나 unmount 시 이전 스트림을 정지해 timer를 정리한다.

`F2_StreamViewerPreview`는 hook의 현재 프레임을 기존 `F2_StreamViewer`의 `frame` prop으로 전달한다. 실제 연결 상태가 아니라 Mock Preview임을 문구와 live region으로 알린다. App 제품 흐름에는 연결하지 않는다.

## Mock 프레임과 전달 규칙

- 프레임: 서로 구분되는 1280 × 720 로컬 SVG 2개
- 외부 이미지 요청 없음
- 첫 프레임: `start()` 즉시 전달
- 다음 프레임: 1,000ms 뒤 전달
- 마지막 프레임: 전달 직후 자동 종료
- sessionId: `bs-d7-mock-001`만 수용
- timestamp: 결정론적인 숫자이며 오름차순
- 동일 timestamp: 중복으로 무시
- 더 작은 timestamp: 늦은 이전 프레임으로 무시
- 잘못된 sessionId 또는 timestamp 뒤의 정상 프레임: 계속 수용
- 중복 `start()`: 실행 중에는 무시
- `stop()` 및 unmount: 예약 timer 취소, 이후 callback 없음

입력 배열은 변경하지 않는다. metadata 순서를 통과한 프레임이 빠르게 교체되더라도 D6 Viewer의 Image cleanup이 이전 이미지의 늦은 `onload`를 차단한다.

## 범위와 보안

D7은 실제 WebSocket 연결이 아니다. WebSocket, fetch, EventSource, Binary, ArrayBuffer, Blob과 Object URL을 생성하거나 처리하지 않는다. JSON Base64 이미지도 사용하지 않는다. 로컬 SVG는 Preview 전용이며 실제 개발자 B 캡처나 실제 금융사이트 화면이 아니다. 실제 금융정보, 계좌번호 원문, 비밀번호와 OTP를 포함하지 않는다.

표시 좌표와 서버 좌표 변환은 D8, Target Highlight는 D9 범위다.

## 개발자 B와 합의할 항목

다음은 D7에서 확정한 프로토콜이 아니다.

- timestamp를 숫자와 ISO 문자열 중 어떤 형식으로 사용할지
- timestamp의 단위와 생성 시점
- `frameId` 또는 sequence 추가 여부
- JSON metadata와 Binary 이미지의 대응 방식
- PNG/JPEG MIME 전달 방식
- 프레임 누락, 중복과 네트워크 재정렬 처리
- Object URL 생성 및 해제 주체와 시점
