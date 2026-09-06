# 금융길잡이 AI Backend API 명세

## 1. 기본 정보

- Base URL: `/api/v1`
- Content-Type: `application/json`
- 문자 인코딩: `UTF-8`

## 2. 공통 응답 형식

### 성공 응답

```json
{
  "success": true,
  "data": {},
  "errorCode": null,
  "message": null
}
```

### 실패 응답

```json
{
  "success": false,
  "data": null,
  "errorCode": "SESSION_404",
  "message": "자동화 세션을 찾을 수 없습니다."
}
```

## 3. 공통 오류 코드

| 오류 코드 | HTTP 상태 | 설명 |
|---|---:|---|
| `COMMON_400` | 400 | 요청값이 올바르지 않은 경우 |
| `SESSION_404` | 404 | 자동화 세션을 찾을 수 없는 경우 |
| `SESSION_409` | 409 | 현재 세션 상태에서 요청을 처리할 수 없는 경우 |
| `COMMON_500` | 500 | 예상하지 못한 서버 오류가 발생한 경우 |

예상하지 못한 서버 내부 예외의 상세 메시지와 요청 본문은 오류 응답 및 로그에 그대로 노출하지 않는다.


## 4. 상태 확인 API

### 백엔드 서버 상태 확인

- Method: `GET`
- URL: `/api/v1/hello`

#### 응답 예시

```json
{
  "success": true,
  "data": {
    "service": "finance-guide-backend",
    "message": "백엔드 서버가 정상 실행 중입니다."
  },
  "errorCode": null,
  "message": null
}
```

## 5. 자동화 세션 API

### 5.1 자동화 세션 생성

사용자의 금융 업무 요청을 기반으로 새로운 자동화 세션을 생성한다.

- Method: `POST`
- URL: `/api/v1/sessions`
- Content-Type: `application/json`
- 성공 상태 코드: `201 Created`

#### 요청

```json
{
  "userRequest": "적금 상품을 비교해 줘"
}
```

#### 요청 필드

| 필드 | 타입 | 필수 | 설명 |
|---|---|---:|---|
| `userRequest` | String | O | 사용자가 요청한 금융 업무 |

#### 성공 응답

```json
{
  "success": true,
  "data": {
    "sessionId": "a5181e9f-2627-4bab-bf1e-347fccbf3e17",
    "userRequest": "적금 상품을 비교해 줘",
    "status": "SESSION_CREATED",
    "createdAt": "2026-07-28T08:24:18.022376Z",
    "updatedAt": "2026-07-28T08:24:18.022376Z"
  },
  "errorCode": null,
  "message": "자동화 세션이 생성되었습니다."
}
```

#### 요청값 검증 실패

- 상태 코드: `400 Bad Request`

```json
{
  "success": false,
  "data": null,
  "errorCode": "COMMON_400",
  "message": "사용자 요청은 비어 있을 수 없습니다."
}
```

---

### 5.2 자동화 세션 조회

세션 ID를 기준으로 현재 자동화 세션의 상태를 조회한다.

- Method: `GET`
- URL: `/api/v1/sessions/{sessionId}`
- 성공 상태 코드: `200 OK`

#### 성공 응답

```json
{
  "success": true,
  "data": {
    "sessionId": "a5181e9f-2627-4bab-bf1e-347fccbf3e17",
    "userRequest": "적금 상품을 비교해 줘",
    "status": "SESSION_CREATED",
    "createdAt": "2026-07-28T08:24:18.022376Z",
    "updatedAt": "2026-07-28T08:24:18.022376Z"
  },
  "errorCode": null,
  "message": null
}
```

#### 세션이 존재하지 않는 경우

- 상태 코드: `404 Not Found`

```json
{
  "success": false,
  "data": null,
  "errorCode": "SESSION_404",
  "message": "자동화 세션을 찾을 수 없습니다. sessionId=not-found-session"
}
```

---

### 5.3 자동화 세션 취소

진행 중인 자동화 세션을 취소한다.

- Method: `POST`
- URL: `/api/v1/sessions/{sessionId}/cancel`
- 성공 상태 코드: `200 OK`

#### 성공 응답

```json
{
  "success": true,
  "data": {
    "sessionId": "a5181e9f-2627-4bab-bf1e-347fccbf3e17",
    "userRequest": "적금 상품을 비교해 줘",
    "status": "CANCELLED",
    "createdAt": "2026-07-28T08:24:18.022376Z",
    "updatedAt": "2026-07-28T08:26:07.369907Z"
  },
  "errorCode": null,
  "message": "자동화 세션이 취소되었습니다."
}
```

#### 이미 종료된 세션을 취소하는 경우

- 상태 코드: `409 Conflict`

```json
{
  "success": false,
  "data": null,
  "errorCode": "SESSION_409",
  "message": "현재 상태에서는 세션을 취소할 수 없습니다."
}
```

## 6. 현재 저장 방식

현재 자동화 세션은 서버 메모리의 `ConcurrentHashMap`에 임시 저장한다.

- 서버를 재시작하면 기존 세션은 삭제된다.
- 이후 Redis 기반 저장소로 교체할 예정이다.
- 도메인 계층은 저장 방식과 분리하기 위해 `AutomationSessionRepository` 인터페이스를 사용한다.

## 7. 사용자 결정 API

사용자가 금융상품, 출금 계좌, 수취인, 약관 또는 추가 정보를 직접 선택한 결과를 백엔드에 전달한다.

AI는 해당 항목을 사용자를 대신해 선택하지 않는다.

### 7.1 사용자 선택 전달

- Method: `POST`
- URL: `/api/v1/sessions/{sessionId}/decisions`
- 구현 상태: 완료

요청 본문:

```json
{
  "decisionType": "PRODUCT_SELECTION",
  "selectedOptionIds": [
    "product-001"
  ]
}
```

지원하는 `decisionType`:

- `PRODUCT_SELECTION`
- `SOURCE_ACCOUNT_SELECTION`
- `RECIPIENT_SELECTION`
- `TERMS_AGREEMENT`
- `ADDITIONAL_INFORMATION`

검증 규칙:

- 상품, 출금 계좌, 수취인 및 추가 정보는 한 개의 항목만 선택할 수 있다.
- 약관 동의는 여러 항목을 선택할 수 있다.
- 선택 항목은 최대 20개까지 전달할 수 있다.
- 비어 있는 선택 항목 ID는 허용하지 않는다.
- 동일한 선택 항목 ID를 중복해서 전달할 수 없다.
- 일반 사용자 결정은 `USER_DECISION_REQUIRED` 상태에서만 제출할 수 있다.
- 추가 정보는 `ADDITIONAL_INFORMATION_REQUIRED` 상태에서만 제출할 수 있다.

처리 성공 후 세션 상태:

```text
AI_EXECUTING
```

### 7.2 최종 실행 승인

- Method: `POST`
- URL: `/api/v1/sessions/{sessionId}/confirm`
- 구현 상태: 완료

요청 본문:

```json
{
  "confirmationId": "confirm-001",
  "approved": true
}
```

검증 규칙:

- `confirmationId`는 필수다.
- `confirmationId`는 100자를 초과할 수 없다.
- 승인 API의 `approved` 값은 반드시 `true`여야 한다.
- 세션 상태가 `FINAL_CONFIRMATION_REQUIRED`일 때만 승인할 수 있다.

처리 성공 후 세션 상태:

```text
AI_EXECUTING
```

사용자 승인 이후에만 최종 금융 Action을 실행할 수 있다.

### 7.3 최종 실행 거절

- Method: `POST`
- URL: `/api/v1/sessions/{sessionId}/reject`
- 구현 상태: 완료

요청 본문:

```json
{
  "confirmationId": "confirm-001",
  "approved": false
}
```

검증 규칙:

- `confirmationId`는 필수다.
- 거절 API의 `approved` 값은 반드시 `false`여야 한다.
- 세션 상태가 `FINAL_CONFIRMATION_REQUIRED`일 때만 거절할 수 있다.

처리 성공 후 세션 상태:

```text
CANCELLED
```

브라우저 세션이 존재하면 함께 종료한다.

### 7.4 오류 응답

- 요청값 오류: `400 COMMON_400`
- 존재하지 않는 세션: `404 SESSION_404`
- 잘못된 세션 상태: `409 SESSION_409`

### 7.5 현재 제한사항

현재 버전은 `confirmationId`의 필수 여부와 형식만 검증한다.

백엔드 세션에 대기 중인 `confirmationId`를 저장하고 요청값과 일치하는지 검증하는 기능은 AI 응답 및 최종 확인 요청 저장 구조를 연결할 때 추가한다.

## 8. 주요 워크플로 상태

- `SESSION_CREATED`
- `PAGE_LOADING`
- `AI_EXECUTING`
- `USER_DECISION_REQUIRED`
- `SECURE_INPUT_REQUIRED`
- `FINAL_CONFIRMATION_REQUIRED`
- `ADDITIONAL_INFORMATION_REQUIRED`
- `RISK_WARNING`
- `COMPLETED`
- `CANCELLED`
- `ERROR`
- `TERMINATED`