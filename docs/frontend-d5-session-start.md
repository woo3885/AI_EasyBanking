# 프론트 D5 세션 시작 연동

## 1. 목표

D5는 D4 Dashboard에서 사용자가 선택한 사이트와 업무를 세션 시작 요청으로
변환하고, 기존 로컬 세션 Stub에 연결한다. 세션 준비 중·성공·오류와 재시도
상태를 제공하지만 실제 Backend HTTP, WebSocket, AI Engine 또는 금융거래는
실행하지 않는다.

## 2. Dashboard 선택값과 요청 모델

D4의 `DashboardStartSelection`을 유지하며 선택값은 다음 D5 어댑터 요청으로
변환한다.

```ts
interface DashboardSessionStartRequest {
  siteId: 'demo-bank';
  taskType: 'OPEN_DEPOSIT' | 'TRANSFER_MONEY';
  initialUrl: string;
  userRequest: string;
}
```

- `siteId`: 선택한 지원 사이트 ID
- `taskType`: 프론트 Dashboard의 로컬 업무 타입
- `initialUrl`: 데모뱅크에서 업무를 시작할 첫 URL
- `userRequest`: 현재 Backend Stub 경계에서 사용할 짧은 업무 요청 문장

업무별 변환은 다음과 같다.

| taskType | initialUrl 경로 | userRequest |
| --- | --- | --- |
| `OPEN_DEPOSIT` | `/deposit/products` | 예금 가입 절차를 시작해 주세요. |
| `TRANSFER_MONEY` | `/transfer/accounts` | 계좌이체 절차를 시작해 주세요. |

AI Engine의 `DEPOSIT`, `TRANSFER` 타입으로 변환하는 로직은 D5에 포함하지
않는다.

## 3. 데모뱅크 환경변수

`VITE_DEMO_BANK_BASE_URL`이 있으면 데모뱅크 기본 URL로 사용하며, 없으면
`http://127.0.0.1:5190`을 사용한다.

```env
VITE_DEMO_BANK_BASE_URL=http://127.0.0.1:5190
```

끝의 슬래시는 제거하고 업무 경로와 슬래시 하나로 결합한다. `http`와
`https`만 허용하며 잘못된 URL, 인증정보, 쿼리 또는 해시가 포함된 값은
명확한 오류로 거부한다. 사용자 입력은 URL에 결합하지 않는다. 현재 저장소
루트에는 `.env.example`이 없어 예시 파일을 새로 만들지 않고 이 문서에 설정
방법을 기록한다.

## 4. 세션 클라이언트 어댑터

`DashboardSessionClient`는 테스트에서 대체할 수 있는 `createSession` 경계를
제공한다. 기본 구현은 네트워크를 사용하지 않는 기존
`orchestratorClient.createStreamSession({ targetUrl })` Promise Stub을
재사용한다.

- D5의 `initialUrl`을 기존 Stub의 `targetUrl`로 변환한다.
- `sessionId`를 필수로 검증하고 없으면 오류를 발생시킨다.
- `webSocketUrl`은 실제 Stub이 제공하지 않으므로 선택값으로 정규화한다.
- `createdAt`이 없으면 클라이언트가 생성 시각을 기록한다.
- `siteId`, `taskType`, `userRequest`는 실제 Backend 계약 확정 전까지 D5
  어댑터 모델에 보존한다.

## 5. Backend 및 공통 계약 차이

| 구분 | 요청 | 응답 |
| --- | --- | --- |
| 공통 `contracts/api.ts` | `siteId`, `initialUrl` | `sessionId`, `status`, 필수 `webSocketUrl` |
| 현재 Backend | `userRequest` | `sessionId`, `userRequest`, `status`, `createdAt`, `updatedAt` |
| 기존 프론트 Stub | `targetUrl` | `sessionId` |

D5는 이 차이를 Dashboard UI나 공통 타입에 반영하지 않고 전용 요청 모델과
클라이언트 어댑터에 격리한다. Backend 및 공통 계약은 수정하지 않는다.

## 6. 화면 상태 흐름

### 초기

- `SESSION_CREATED`, `INITIAL_SCREEN`
- `sessionId: null`, `isLoading: false`, `isConnected: false`
- 사이트와 업무를 모두 선택하기 전 시작 버튼 비활성화

### 요청 중

- `세션을 준비하고 있습니다.` 안내
- `isLoading: true`, 시작 버튼 loading 및 disabled
- 동기 ref 가드로 중복 시작 요청 차단
- WebSocket 연결 안 됨 유지

### 성공

- `금융 업무 세션이 준비되었습니다.` 안내
- `SESSION_CREATED`, `SESSION_READY`
- 반환된 `sessionId`만 최소 정보로 표시
- 전체 응답 객체와 `webSocketUrl`을 DOM에 출력하지 않음
- F2 Viewer로 이동하거나 WebSocket에 연결하지 않음

### 오류 및 재시도

- `ERROR`, `WORKFLOW_ERROR`와 안전한 오류 안내 사용
- 오류 객체 원문, stack, 내부 URL과 응답을 표시하지 않음
- 사이트와 업무 선택을 유지하고 시작 버튼을 다시 활성화
- 새 시도 전 이전 오류와 성공 결과를 초기화
- 재시도가 성공하면 오류 안내 제거

## 7. 접근성 및 보안

- 실제 radio와 button, 기존 고정 ID 및 `data-testid`를 유지한다.
- 시작 버튼은 최소 56px, 실제 `disabled`, loading의 `aria-busy`를 사용한다.
- 상태 안내는 `role="status"`, 오류는 `role="alert"`로 전달한다.
- 키보드 선택과 `focus-visible`을 유지하고 상태를 색상만으로 전달하지 않는다.
- 실제 계좌번호, 비밀번호, OTP와 내부 기술 오류를 표시하거나 저장하지 않는다.
- 실제 금융거래가 발생하지 않는다는 안내를 유지한다.

## 8. D6 이후 연동 지점과 제외 범위

D6 이후 실제 API를 연결하려면 다음을 먼저 합의해야 한다.

- 세션 생성 요청이 `siteId`, `initialUrl`, `userRequest` 중 무엇을 수신하는지
- 업무 타입을 Backend 또는 AI Engine 타입으로 변환할 계층
- 응답의 `webSocketUrl` 제공 여부와 생성 규칙
- 세션 생성 성공 후 F2 Viewer 전환 시점과 WebSocket 연결 책임

D5에서는 실제 `fetch`, `XMLHttpRequest`, WebSocket, AI Engine 호출,
데모사이트 이동, F2 Viewer 이동, 비밀번호·OTP 입력, 예금 가입, 계좌이체와
최종 승인을 구현하지 않는다.
