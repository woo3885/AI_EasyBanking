# AI Engine 통합 가이드

> **담당:** 개발자 C — AI Engine & Integration  
> **프로젝트:** 금융길잡이 AI  
> **대상 범위:** D1 ~ D24
> **문서 목적:** Frontend(A), Backend(B), AI Engine(C) 간 통합을 위해 C 파트의 역할, 구현 현황, 입출력 계약, 안전 원칙 및 연동 시 주의사항을 한 문서에서 확인할 수 있도록 정리한다.  
> **마지막 정리 기준일:** 2026-08-20 (D24 사용자 선택 결과 보존 및 AI 재개 계약 반영)

---

## 1. 문서 목적

이 문서는 개발자 C가 담당하는 AI Engine의 전체 구조와 D1~D23까지의 주요 구현 내용을 정리한 통합 가이드이다.

Frontend(A)와 Backend(B) 작업자는 이 문서를 통해 다음 내용을 빠르게 확인할 수 있다.

- AI Engine이 어떤 역할을 담당하는지
- AI Engine이 어떤 데이터를 입력으로 받는지
- AI Engine이 어떤 형태의 결과를 반환하는지
- 사용자 요청이 어떤 처리 단계를 거치는지
- Target `elementId`가 어떤 기준으로 선택되는지
- Gemini API 장애나 잘못된 응답 발생 시 어떻게 처리되는지
- 민감정보, 최종 거래, 위험 행동을 어떤 원칙으로 제한하는지
- A/B/C 통합 시 각 파트의 책임 경계가 어디인지

이 문서는 일자별 개발 일지가 아니라 **현재 AI Engine을 연동하기 위한 기준 문서**를 목적으로 한다.

---

# 2. AI Engine 역할

AI Engine은 사용자의 자연어 요청과 현재 웹페이지 정보를 분석하여, 다음에 수행해야 할 안전한 행동을 결정하는 역할을 담당한다.

주요 책임은 다음과 같다.

1. 사용자 의도(Intent) 분석
2. 사용자 목표(UserGoal) 추출
3. 현재 Workflow 상태 확인
4. Sanitized DOM 분석
5. 다음 행동(Next Action) 결정
6. 실행 대상(Target) `elementId` 선택
7. AI Structured Output 생성
8. 응답 Schema 검증
9. Confidence 기반 실행 가능 여부 판단
10. 민감정보·최종 거래·위험 행동 안전 정책 적용
11. Gemini API 장애 시 Retry / Cache / Fallback 처리

AI Engine은 브라우저를 직접 클릭하거나 좌표를 임의로 생성하는 실행 계층이 아니다.

---

# 3. 전체 시스템에서 C의 위치

```text
사용자
  ↓
Frontend (A)
  ↓
Backend (B)
  ↓
AI Engine (C)
  ├─ Intent 분석
  ├─ UserGoal 추출
  ├─ WorkflowContext 확인
  ├─ Sanitized DOM 분석
  ├─ Safety / Risk Policy
  ├─ Next Action 선택
  ├─ Target elementId 선택
  ├─ Confidence 판단
  └─ Structured Output 생성
  ↓
Backend (B)
  ↓
Frontend (A)
  ↓
상태 / 안내 메시지 / Target 표시
  ↓
Backend Automation
  ↓
실제 Browser Action
```

핵심 원칙:

> **AI Engine은 "무엇을 해야 하는지"와 "어떤 elementId를 대상으로 해야 하는지"를 판단한다.**

> **실제 좌표 변환과 Browser Action 실행은 Frontend / Backend의 Viewer 및 Automation 계층이 담당한다.**

---

# 4. AI Engine 디렉터리 개요

```text
ai-engine/
├─ src/
│  ├─ actions/
│  ├─ agent/
│  ├─ api/
│  ├─ clients/
│  ├─ confidence/
│  ├─ config/
│  ├─ dom/
│  ├─ finalAction/
│  ├─ goals/
│  ├─ intents/
│  ├─ output/
│  ├─ policies/
│  ├─ prompts/
│  ├─ risk/
│  ├─ secure/
│  ├─ services/
│  ├─ terms/
│  ├─ tests/
│  └─ index.ts
├─ package.json
└─ package-lock.json
```

| 경로 | 역할 |
|---|---|
| `clients/` | Gemini 등 외부 AI API Client |
| `config/` | 환경변수, 모델 설정 |
| `intents/` | 사용자 요청 Intent 분석 |
| `goals/` | 사용자 목표(UserGoal) 추출 |
| `dom/` | Sanitized DOM 변환 및 직렬화 |
| `actions/` | 다음 행동 및 Target 선택 관련 로직 |
| `agent/` | 내부 Agent Loop 및 상태 처리 |
| `api/` | Backend ↔ AI Engine HTTP Adapter |
| `prompts/` | Gemini에 전달할 System / Action Prompt |
| `policies/` | 안전, 위험, 실행 제한 정책 |
| `confidence/` | AI 판단 신뢰도 및 Fallback 기준 |
| `output/` | Structured Output Schema, Parser, Validator, Mapper, Fallback |
| `terms/` | 약관 관련 안전 판단 |
| `secure/` | 민감정보 입력 관련 안전 처리 |
| `finalAction/` | 최종 거래 확인 관련 처리 |
| `risk/` | 위험 탐지 및 경고 관련 처리 |
| `services/` | AI 호출 및 전체 처리 흐름 |
| `tests/` | 단위 / 계약 / 통합 / Gemini API 테스트 |

---

# 5. D1 ~ D23 주요 구현 이력

## D1 — 공통 규격 및 AI Engine 기반 정리
- 공통 API 계약 확인
- Session / DOM Snapshot / Remote Action 계약 확인
- A/B/C 책임 구분

## D2 — AI Engine 기본 골격 구축
- Gemini Client
- 환경 설정
- AI Service
- Engine 진입점 구성

## D3 — Intent 분석 1차 구현
대표 Intent:
`DEPOSIT`, `TRANSFER`, `INQUIRY`, `CHANGE`, `RISK`, `GENERAL`

## D4 — Prompt 및 Safety Policy 1차
- 위험 행동 제한
- 최종 거래 자동 실행 제한
- DOM에 없는 Target 생성 제한

## D5 — UserGoal 추출
Intent보다 구체적인 금액, 수취인, 조건 등의 목표 정보를 구조화.

## D6 — DOM 분석 및 Mapping
원본 HTML이 아닌 Sanitized DOM을 AI가 이해할 수 있는 형태로 변환.

## D7 — Next Action 및 Target 선택
UserGoal + Sanitized DOM 기준으로 `TYPE`, `CLICK` 등의 다음 행동과 `elementId`를 선택.

## D8 — Structured Output 기반 추가
Gemini 자연어 응답을 Backend가 처리할 수 있는 구조화 JSON으로 변환.

## D9 — 보안 강화
- 내부 IP / 비정상 Target 접근 제한
- 입력 Sanitization 강화

## D10 — WorkflowContext
현재 Workflow 상태를 AI 판단에 포함.

## D11 — 약관 관련 안전 처리
필수/선택 약관 구분 및 자동 동의 제한.

## D12 — 민감정보 처리
비밀번호·OTP 등은 일반 TYPE과 분리.

## D13 — 최종 거래 보호
최종 송금·가입·변경 확정 등은 사용자의 명시적 확인 필요.

## D14 — 위험 탐지
위험 감지 시 자동 Action보다 경고와 안전 안내를 우선.

## D15 — Confidence / Sanitized DOM / Target elementId 기준
AI는 Sanitized DOM에 실제 존재하는 `elementId`만 Target으로 사용.

## D16 — Gemini API 실제 연동
Gemini 호출, Cache 동작 및 실제 응답 확인.

## D17 — Retry / Cache / Timeout / Fallback
429, 503, Timeout 등 외부 API 장애를 재시도 후 Fallback 처리.

## D18 — Gemini Structured Output 통합
Parser → Schema Validator → 정상 응답 또는 Fallback 흐름 구성.

## D19 ~ D22 — 통합 준비 및 A/B 선행 작업 반영
D22에서는 Frontend Session Frame Viewer와 Backend Public Browser Action API 기반 사용자 CLICK/SCROLL 원격 조작이 연결되었다.

관련 문서:
`docs/frontend-d22-viewer-remote-actions.md`

---

## D23 — Backend 계약 정합성 및 Production Action 안정화

D23에서는 최신 Backend Production 계약에 맞춰 AI Engine의 실제 Action 출력 경로를 점검하고 안정화했다.

### 주요 목표

```text
C AI 판단
→ Backend가 실제 처리 가능한 Action만 반환
→ Backend Validator 통과
→ Production Target / 상태 이벤트 흐름과 연결
```

### Backend Production 응답 계약

현재 C → B `/api/ai/action` 응답은 D23 Action 6필드를 보존하면서 D24 decision
metadata 10필드를 추가한 Backend의 현재 16필드 계약을 사용한다.

```text
actionType
elementId
value
scrollX
scrollY
waitMillis
status
message
requiresUserAction
executionBlocked
decisionType
sourceSnapshotId
options
terms
```

`decisionId`는 Backend가 생성하므로 C → B 응답에 포함하지 않는다. option/term wire는
`id`, `label`, `required`, `checked`만 사용한다. `checked`는 모델이 아니라 현재
Backend snapshot에서 가져온다.

D23에서는 Backend DTO를 확장하지 않고 현재 계약과의 정합성 확보를 우선했다.

### Production Action Allowlist

허용:

```text
CLICK
TYPE
NONE
WAIT_FOR_USER
PAUSE_FOR_SECURE_INPUT
REQUEST_FINAL_CONFIRMATION
STOP
```

Production structured-output에서는 차단:

```text
SELECT
PRESS_KEY
GO_BACK
REFRESH
SCROLL
WAIT
```

SCROLL과 WAIT는 현재 C가 Backend가 요구하는 payload를 완전히 제공하지 못하므로 Prompt / Schema / Adapter에서 차단한다.

### STOP 의미 통일

```text
STOP
→ STOPPED
→ TERMINATED
```

C에서도 STOP을 정상 완료로 사용하지 않는다.

```text
STOP = 종료 / 중단
COMPLETED = Production wire와 분리된 내부 상태
NONE = 현재 실행할 Action 없음
```

Production LLM은 `COMPLETED` 상태를 반환하지 못하도록 제한한다.

### requestId 신뢰 처리

```text
C requestId 생성
→ Prompt 전달
→ LLM 응답
→ Parser / Schema 검증
→ LLM이 반환한 requestId 폐기
→ C-generated requestId 재바인딩
```

현재 Backend wire에는 requestId가 포함되지 않으므로 A/B/C 전체 correlation ID 계약은 후속 과제이다.

### Backend D23 Production Target 연동

Backend는 AI가 반환한 `elementId`를 현재 Snapshot / Frame과 다시 검증한 뒤 다음 Target 정보를 생성한다.

```text
elementId
label
x
y
width
height
frameId
frameSequence
snapshotId
```

Target label과 실제 좌표는 C가 임의 생성하지 않는다.

### D23 테스트 구조

```text
npm test
→ 오프라인 단위 / 계약 회귀 테스트

npm run test:d23
→ D23 Backend 계약 전용 테스트

npm run test:live
→ Gemini 실제 API 연동 테스트
```

검증 결과:

```text
npm run check
→ 성공

npm test
→ 16 tests / 16 pass

npm run test:d23
→ 6 tests / 6 pass
```

### D23 C 파트 현재 상태

```text
Backend 16필드 wire 계약 연동        완료
D23 Action 6필드 의미 보존           완료
Production Action allowlist         완료
SCROLL / WAIT Production 차단       완료
STOP / TERMINATED 의미 정합화       완료
COMPLETED Production 반환 차단      완료
C-generated requestId 신뢰 처리     완료
오프라인 회귀 테스트                 완료
D23 계약 테스트                     완료
```

D23 전체 완료는 A/B/C 실제 Production E2E 성공을 기준으로 한다.

---

# 6. AI Engine 입력

## 6.1 Production B → C 계약

현재 `/api/ai/action`의 Backend 요청은 다음 두 필드가 기준이다.

```text
userRequest
snapshot
```

```json
{
  "userRequest": "금리가 높은 예금 상품을 찾고 싶어요",
  "snapshot": {
    "schemaVersion": "...",
    "snapshotId": "...",
    "page": {
      "url": "...",
      "title": "..."
    },
    "elements": []
  }
}
```

Snapshot element에는 다음과 같은 정보가 포함될 수 있다.

```text
elementId
tag
role
text
ariaLabel
placeholder
inputType
visible
enabled
boundingBox
securityPolicy
```

## 6.2 C 내부 변환

```text
requestId
UserGoal
DOM Snapshot
AI 판단 Context
```

현재 requestId는 C 내부 생성값이며 Backend가 전달하는 외부 correlation ID는 아니다.

---

# 7. AI Engine 출력

## 7.1 C 내부 Structured Output

```text
requestId
status
action
targetElementId
inputValue
message
confidence
requiresUserAction
decisionType
secureInputType
riskType
options
confirmationId
summary
```

이 정보 중 Backend `AiDecisionResponse`에 정의된 필드만 Production wire로 전달한다.
`confidence`, secure/final/risk 상세 metadata, `confirmationId`, `summary`는 현재
Backend DTO에 없으므로 전달하지 않는다.

## 7.2 Production C → B wire response

```text
actionType
elementId
value
scrollX
scrollY
waitMillis
status
message
requiresUserAction
executionBlocked
decisionType
options
terms
```

예:

```json
{
  "actionType": "CLICK",
  "elementId": "el-a1b2c3d4-001",
  "value": null,
  "scrollX": null,
  "scrollY": null,
  "waitMillis": null,
  "status": "AI_EXECUTING",
  "message": "다음 행동을 진행합니다.",
  "requiresUserAction": false,
  "executionBlocked": false,
  "decisionType": null,
  "sourceSnapshotId": null,
  "options": [],
  "terms": []
}
```

D23의 Action 6필드는 같은 이름과 의미로 유지된다.

D24 USER_DECISION에서는 `status`, `message`, `requiresUserAction`,
`executionBlocked`, `decisionType`, `sourceSnapshotId`, `options`, `terms`를 최신
Backend DTO와 정확히 맞춘다. `decisionId`와 option의 `description`, `disabled`는
추가하지 않는다. option의 `checked`는 DTO에 포함하되 모델이 만들지 않고 현재
Backend snapshot 값만 사용한다.

---

# 8. Target elementId 원칙

## 8.1 기본 원칙

```text
AI Engine은 Sanitized DOM에 존재하는 elementId만 선택한다.
```

AI는 임의 좌표나 임의 Target 이름을 실행 식별자로 만들지 않는다.

## 8.2 좌표 책임

```text
AI Engine
→ elementId 선택

Backend
→ 현재 Snapshot / Frame 기준 element 검증
→ 좌표 및 label 산출
→ Target 이벤트 생성
→ Browser Action 실행

Frontend
→ Viewer / Overlay 표시
```

## 8.3 존재하지 않는 Target

```text
Target elementId
↓
현재 DOM과 대조
↓
존재함 → 다음 처리
존재하지 않음 → 실행 금지 / Fallback / 재판단
```

---

# 9. Structured Output 검증

```text
Gemini Raw Response
↓
Parser
↓
Schema Validator
↓
Policy / Confidence
↓
사용 가능한 AI Response
```

실행 금지 조건:

- JSON 파싱 실패
- 필수 필드 누락
- 허용되지 않은 Action type
- Target 누락
- Schema와 다른 자료형
- 존재하지 않는 `elementId`
- Safety Policy 위반
- Production에서 허용되지 않는 `COMPLETED`
- Production 미지원 Action(SCROLL / WAIT 등)

---

# 10. Confidence 및 Fallback

낮은 Confidence나 불확실한 상황에서는 자동 실행보다 안전한 Fallback을 우선한다.

현재 Production C → B wire response는 16필드이며 Backend DTO에 정의되지 않은 C
내부 confidence와 secure/risk 상세값, confirmationId/authoritative summary는 전달하지 않는다.
D27 final에서는 Backend DTO가 정의한 confirmationType과 confirmationTargetElementId만 전달한다.

---

# 11. Gemini 장애 처리

대응 대상:

```text
HTTP 429
HTTP 503
Timeout
일시적 네트워크 오류
비정상 응답
```

```text
요청
↓
Cache
↓
Gemini
↓
실패
↓
Retry
↓
재실패
↓
Fallback
```

---

# 12. Safety Policy

## 12.1 일반 탐색
메뉴 이동, 검색, 페이지 이동, 일반 정보 확인 등은 안전 조건을 만족하면 자동 안내 가능.

## 12.2 민감정보
비밀번호·OTP 등은 일반 TYPE과 분리.

## 12.3 약관
사용자가 확인해야 하는 약관은 AI가 임의 동의하지 않는다.

## 12.4 최종 거래
최종 송금·가입·변경 확정 등은 사용자의 명시적 확인 필요.

## 12.5 위험 상황
위험이 감지되면 Action보다 경고와 안전 안내를 우선한다.

---

# 13. A / B / C 역할 경계

## 개발자 A — Frontend
- 사용자 입력
- Viewer 표시
- 상태 표시
- 안내 message 표시
- Target 시각화
- Production UI event 수신
- 상태별 Panel 전환

## 개발자 B — Backend & Automation
- Session 관리
- AI Engine 호출
- AI 응답 검증
- Browser Action 실행
- Frame / sequence 관리
- 최종 WorkflowStatus 결정
- Production UI event 발행
- Target 좌표 / label / frame 관계 검증

## 개발자 C — AI Engine
- Intent
- UserGoal
- WorkflowContext 판단
- Sanitized DOM 분석
- Next Action
- Target elementId
- Safety Policy
- Confidence
- Structured Output
- Gemini
- Retry / Cache / Fallback
- Production Action allowlist
- Backend wire 계약 정합성

C는 최종 WorkflowStatus를 직접 확정하지 않는다.

---

# 14. C가 보장하는 것 / 보장하지 않는 것

## C가 보장해야 하는 것

- Schema에 맞는 AI 응답
- Parser / Validator 통과
- 실제 DOM `elementId` 기반 Target 선택
- 낮은 Confidence에서 자동 실행 억제
- 민감정보 / 최종 거래 / 위험 Safety Policy
- Retry 및 Fallback
- 미지원 Production Action 차단
- STOP을 종료 / 중단 의미로 처리
- Production LLM의 `COMPLETED` 반환 차단
- C-generated requestId를 내부 authoritative 값으로 유지

## C가 직접 보장하지 않는 것

- 실제 Browser 좌표 계산
- Viewer 좌표 변환
- Browser Action 실행
- 실제 DOM hit-test
- Backend Session / Frame sequence
- Frontend 상태 UI
- Backend 최종 보안 검증
- 최종 WorkflowStatus
- Target authoritative label
- A/B/C 전체 correlation ID

---

# 15. D22 Public Browser Action 계약 참고

```text
POST /api/v1/sessions/{sessionId}/actions
```

D22 Public API는 `source=USER_VIEWER` 기반 실제 Viewer 사용자 Action용이며 AI Action은 별도 경로를 사용한다.

---

# 16. 통합 시 권장 Golden Scenario

후보:

```text
금리가 높은 예금 상품을 찾고 싶어요
```

예상 흐름:

```text
사용자 입력
↓
Intent = DEPOSIT
↓
UserGoal
↓
현재 DOM
↓
TYPE
↓
새 DOM / Frame
↓
CLICK
↓
검색 결과
```

> **주의:** 실제 E2E 시나리오는 Demo Bank의 최신 Sanitized DOM에 해당 요소가 실제 존재하는지 확인한 뒤 최종 확정한다.

---

# 17. 통합 시 확인해야 할 실패 시나리오

- Gemini Timeout
- Gemini 429 / 503
- 잘못된 JSON
- Schema 불일치
- 존재하지 않는 Target
- 낮은 Confidence
- 최종 금융거래
- Production 미지원 Action
- `COMPLETED + NONE` 생성 시도

`COMPLETED + NONE`은 Production Schema에서 거부되고 Fallback 처리된다.

---

# 18. 개발 및 검증 명령

```powershell
cd C:\2026finance\ddd\ai-engine

npm.cmd run check
npm.cmd test
npm.cmd run test:d23
npm.cmd run test:d24
npm.cmd run test:d24:response
npm.cmd run test:live
```

D23 기준:

```text
npm.cmd run check
→ 성공

npm.cmd test
→ 16 tests / 16 pass

npm.cmd run test:d23
→ 6 tests / 6 pass
```

`test:live`는 Gemini API Key 및 네트워크가 필요하므로 기본 회귀 테스트와 분리한다.

---

# 19. Git / Branch 기준

C 작업 브랜치:

```text
feature/ai-schema-and-policy
```

공통 통합 브랜치:

```text
develop
```

작업 완료 후:

```powershell
git add ai-engine docs/ai-engine-integration-guide.md
git status
git commit -m "<작업 내용>"
git push origin feature/ai-schema-and-policy
```

이후 `develop` 대상 Pull Request 생성.

---

# 20. A/B 작업자가 C와 연동할 때 반드시 알아야 할 핵심

1. AI Engine Target은 `elementId` 기반이다.
2. AI Engine은 임의 x/y 좌표를 생성하지 않는다.
3. Gemini Raw Response를 직접 실행하지 않는다.
4. Parser / Validator / Safety / Confidence 검증 후 사용한다.
5. Gemini 장애 시 Retry / Fallback을 지원한다.
6. 민감정보 입력은 일반 TYPE과 분리한다.
7. 최종 금융거래는 명시적 사용자 확인이 필요하다.
8. Target은 현재 DOM에 존재하는지 Backend에서 다시 검증한다.
9. Backend의 보안 검증이 최종 우선권을 가진다.
10. 현재 requestId는 C 내부 추적용이며 A/B/C 전체 correlation ID는 후속 계약이다.
11. USER_VIEWER Action과 AI Production Action은 별도 계약이다.
12. D23 Production Action은 allowlist 기반으로 제한한다.
13. STOP은 정상 완료가 아니라 종료 / 중단 의미이다.
14. 최종 WorkflowStatus는 Backend가 결정한다.

---

# 21. D23 이후 문서 갱신 원칙

다음 변경 시 본 문서를 함께 갱신한다.

```text
AI Response Schema 변경
Target 계약 변경
WorkflowStatus 변경
Action Type 추가
Production Action allowlist 변경
Fallback 정책 변경
Safety Policy 변경
Gemini 모델 / Client 구조 변경
A/B/C API 계약 변경
requestId / correlation ID 계약 변경
정상 완료 wire 계약 추가
상태별 payload 확장
```

---

# 22. 현재 상태 요약

D23 C 파트에서는 최신 Backend Production 계약에 맞춰 Action 출력 경로를 안정화했다.

```text
Production Action allowlist
+
STOP / TERMINATED 의미 통일
+
COMPLETED Production 차단
+
requestId 신뢰 경계 강화
+
D23 계약 회귀 테스트
```

Backend D23에서는 Production UI event envelope와 Target / Target Clear 흐름이 추가되었다.

현재 남은 최종 단계:

```text
A Production live event 연결
→ A/B/C 동일 시나리오 E2E
→ 상태 / message / Target / Frame 전체 확인
```

D23 최종 완료 기준:

> **A·B·C 세 팀이 동일한 시나리오에서 상태·메시지·Target 흐름을 끝까지 성공시키는 것**

---

# 23. D24 사용자 선택 결과 보존 및 AI 재개 계약

## B → C Production 요청

Backend의 `AiDecisionRequest.userDecision`은 최초 호출에서는 생략될 수 있고,
사용자 선택 후 재호출에서는 다음 네 필드를 전달한다.

```text
decisionId
decisionType
selectedOptionIds
sourceSnapshotId
```

`decisionType`은 다음 다섯 값만 허용한다.

```text
PRODUCT_SELECTION
SOURCE_ACCOUNT_SELECTION
RECIPIENT_SELECTION
TERMS_AGREEMENT
ADDITIONAL_INFORMATION
```

`ACCOUNT_SELECTION` alias와 알 수 없는 값은 허용하지 않는다. 약관 선택도 별도
`selectedTermIds` 없이 `selectedOptionIds`를 사용한다. Backend가 전달한 opaque ID와
배열 순서는 C에서 변경하지 않는다.

## Production 처리 흐름과 책임

```text
Backend 검증 및 사용자 선택 적용
→ 새 Sanitized DOM Snapshot 생성
→ /api/ai/action 재호출(userDecision 포함)
→ C runtime validation 및 request-scoped context 변환
→ verified decision 전용 Prompt section
→ 다음 안전한 Action 판단
```

Production resume orchestrator와 authoritative state owner는 Backend다. Backend가
stale/duplicate/frame/allowed option/required term을 검증한다. C는 `sessionId`나 이전
pause 결과를 받지 않으므로 전역 상태를 구성하지 않고, 현재 요청에 포함된 verified
context만 사용한다.

`UserDecisionContextStore`는 내부 Agent Loop와 테스트용 유틸리티이며 Production의
authoritative store가 아니다. `resumeAgentLoopAfterUserDecision()`도 Production HTTP
route에서 직접 호출하지 않는다. 같은 Backend retry가 들어와도 C 프로세스 전역
duplicate registry 때문에 실패하지 않는 stateless 처리다.

Backend 구현은 선택 적용 후 항상 새로운 snapshot ID를 생성한다. 따라서 C는
`sourceSnapshotId === snapshot.snapshotId`인 재개 요청을 malformed/stale 요청으로
거부한다.

## Runtime validation과 Prompt 정책

- `decisionId`와 `sourceSnapshotId`: nonblank exact string, trim 보정 없음
- `selectedOptionIds`: 최대 20개, nonblank exact string, 중복 금지, 순서 보존
- 단일 선택 유형 네 가지: 정확히 1개
- `TERMS_AGREEMENT`: 0~20개
- request와 `userDecision`의 unknown field: 거부
- 필수 약관 충족 여부: Backend가 authoritative하게 검증
- verified selected ID: 다시 CLICK/SELECT하지 않음
- 해결된 동일 decision: 다시 요청하지 않음
- 별개의 새 사용자 결정이 필요한 경우에만 `WAIT_FOR_USER` 허용
- secure input, final confirmation, risk protection이 항상 우선

Prompt에는 `userRequest`에 이어 붙이는 자연어가 아니라 별도의 JSON section으로 네
필드를 직렬화한다. C는 ID를 추가·삭제·정렬·정규화·추천값으로 교체하지 않는다.

## C → B 응답과 A UI 데이터

C의 Production wire response는 다음 16필드다.

```text
actionType
elementId
value
scrollX
scrollY
waitMillis
status
message
requiresUserAction
executionBlocked
decisionType
sourceSnapshotId
options
terms
confirmationType
confirmationTargetElementId
```

USER_DECISION rich response는 `WAIT_FOR_USER`, null Action payload,
`requiresUserAction=true`, `executionBlocked=true`를 사용한다. `TERMS_AGREEMENT`는
`terms`에, 나머지 지원 DecisionType은 `options`에 매핑한다. 각 item은 `id`, `label`,
`required`, `checked`를 정확히 포함한다. `sourceSnapshotId`에는 새 결정을 생성한 현재
request의 `snapshot.snapshotId`를 사용한다. 일반 Action에서는 `sourceSnapshotId=null`이다.

`decisionId`, option의 `description`/`disabled`, secure/risk 상세 metadata는
C → B wire에 추가하지 않는다. D27 final은 `confirmationType`과
`confirmationTargetElementId`만 전달하며 confirmationId/summary는 전달하지 않는다.
Backend가 현재 snapshot과 ID를 검증하고 decisionId, disabled, frame 정보를 생성하여
`DECISION_REQUIRED` event를 authoritative하게 발행한다.

C → B rich decision response에서 허용되는 유형은 다음 네 가지다.

```text
PRODUCT_SELECTION
SOURCE_ACCOUNT_SELECTION
RECIPIENT_SELECTION
TERMS_AGREEMENT
```

`ADDITIONAL_INFORMATION`은 B → C의 검증된 재개 context에서는 허용되지만 새 C → B
rich decision response에서는 Backend validator와 동일하게 거부한다.
`ACCOUNT_SELECTION` alias는 양방향 모두 거부한다.

C는 model option을 wire로 보내기 전에 각 ID가 현재 snapshot에 존재하고 해당 요소가
visible/enabled이며 `securityPolicy=USER_DECISION`인지 교차 검증한다. ID와 배열 순서는
변경하지 않는다. label은 모델 값을 사용하지 않고 snapshot의
`ariaLabel → text → placeholder → role → tag` 순서로 재구성하여 sanitizer를 적용한다.
약관 required 값도 snapshot label의 `필수`/`required` marker를 기준으로 만든다.
`checked`는 B가 snapshot에 포함한 nullable Boolean에서만 가져온다. 약관은 snapshot의
`checked`가 boolean이 아니면 안전하게 응답 생성을 거부하며, 모델의 checked 추정값은
사용하지 않는다. Backend는 C 응답의 약관 checked와 동일 snapshot의 checked가 정확히
일치하는지 재검증하고, UI event 발행 직전 현재 DOM 상태도 다시 확인한다.

B → C `userDecision.sourceSnapshotId`는 사용자가 선택했던 이전 decision source를
가리킨다. C → B `response.sourceSnapshotId`는 현재 새 결정을 만든 snapshot을 가리키므로
둘을 재사용하거나 혼동하지 않는다.

B → C `userDecision` 재개 요청은 기존과 동일하게 request-scoped context로만 소비한다.
Production 전역 `UserDecisionContextStore`나 `resumeAgentLoopAfterUserDecision()` 직접
호출은 사용하지 않는다.

## 보안과 검증 결과

Production structured action 경로에서 raw Gemini response와 parsing/validation error
payload 로그를 제거했다. 사용자 메시지 sanitizer는 prompt/reasoning, HTML, URL과
internal endpoint, password/OTP, 계좌·카드·전화번호 형태의 민감값 노출을 차단한다.

2026-08-20 오프라인 검증 결과:

```text
npm.cmd run check     PASS
npm.cmd test          47/47 PASS
npm.cmd run test:d23   6/6 PASS
npm.cmd run test:d24  31/31 PASS
npm.cmd run test:d24:response  8/8 PASS
```

실제 Gemini API를 호출하는 `test:live`는 기본 회귀 테스트에서 분리되어 있다.

## 남은 통합 확인 항목

Backend:

- decision TTL 정책
- AI 재호출 실패 시 복구 및 재시도 정책

Frontend:

- A의 D24 Production 구현이 develop에 병합되었는지 별도 확인
- decision event/submit/reconnect 전 구간 E2E 검증

---

# 24. D25 정기예금 시나리오 판단 및 안전 안내

## 범위와 완료 경계

D25 Production 경로는 다음 시나리오를 지원한다.

```text
상품 목록(PRODUCT_SELECTION)
→ 검증된 상품 선택 결과로 stateless 재호출
→ 상품 상세의 안전한 NORMAL navigation
→ 사용자 요청에 명시된 가입 금액 TYPE
→ 약관(TERMS_AGREEMENT)
→ 검증된 약관 선택 결과로 stateless 재호출
→ 새 snapshot의 안전한 NORMAL navigation
→ 비밀번호 화면(SECURE_INPUT_REQUIRED)
→ Browser Action 없이 중단
```

D25의 종료점은 `SECURE_INPUT_REQUIRED`다. 보안 입력 완료와 복귀는 D26,
최종 확인과 거래 완료는 D27 범위이며 이번 Production 흐름에서 생성하지 않는다.

## 화면 단계 판정

`DepositScenarioStage`는 `PRODUCT_LIST`, `PRODUCT_DETAIL`, `AMOUNT_ENTRY`,
`TERMS`, `SECURE_INPUT`, `UNKNOWN`으로 구성한다. 판정은 현재 Sanitized DOM의
label, `securityPolicy`, role/tag/inputType, visible/enabled 상태와 request-scoped
`userDecision` context를 우선 사용한다. URL은 상품 상세 판정의 보조 신호일 뿐이며,
URL만으로 어떤 단계도 확정하지 않는다. 보안 입력 요소는 다른 신호보다 우선한다.

## 단계별 정책

- 상품 목록: `PRODUCT_SELECTION`, `WAIT_FOR_USER`, `USER_DECISION_REQUIRED`로
  자동 실행을 차단한다. 현재 snapshot의 visible/enabled `USER_DECISION` 요소만
  options 후보로 만들고, D24 정책이 membership과 snapshot 기반 label을 다시 검증한다.
  Demo의 표시 문구는 두 버튼 모두 `이 상품 선택`이지만 명시적 aria-label은 각각
  `12개월 정기예금 선택`, `우대금리 정기예금 선택`이다. Backend extractor는 같은
  카드의 heading을 sanitized text로 전달하며 C는 ariaLabel을 우선해 option label을
  만든다. 빈 label과 중복 canonical label은 금융 Action 없이 fail closed한다.
- 상품 선택 재개: Backend가 검증한 네 필드 context와 selected ID 순서를 그대로
  사용한다. 선택 요소를 재CLICK하거나 동일 결정을 재발행하지 않고 새 snapshot의
  enabled NORMAL `선택한 상품 상세 보기`만 `CLICK`한다.
- 상품 상세: Backend가 검증해 `page.productId`, `page.productName`,
  `page.productPeriod`로 전달한 semantic context만 실제 선택 상품 조건으로 사용한다.
  C는 product ID와 canonical detail path가 일치하고 product period가 양의 정수
  `개월` 한 값일 때만 context를 수용한다. URL 숫자, element ID, 상품 순번, 모델 출력,
  hardcoded 상품명 매핑으로 기간을 만들지 않는다.
- 요청 기간과 실제 기간: 초기 요청의 기간은 선택 조건이고 생략 가능하다. 기간이
  없으면 검증된 실제 상품 기간을 변경하지 않은 채 진행한다. 기간이 있으면 월 단위로
  비교하며 불일치, 모호한 복수 기간, 잘못된 semantic context에서는 금융 Action 없는
  blocked `NONE`을 반환한다. 정상 상세에서는 visible/enabled/NORMAL
  `가입 금액 입력하기`만 `CLICK`한다.
- 가입 금액: 기존 UserGoal parser가 원 요청에서 읽은 양의 safe integer만 사용한다.
  `약관 확인으로 이동` enabled, `입력 금액 확인` enabled, 금액 input 순서로 phase를
  판정한다. 따라서 sanitizer가 input value를 제거해도 enabled 버튼이 있으면 TYPE을
  반복하지 않는다. 아직 입력 phase일 때만 NORMAL 금액 입력란에 `TYPE`한다.
  금액이 없으면 `ADDITIONAL_INFORMATION` wire를
  임의 생성하지 않고 안내 message를 가진 안전한 `NONE`을 반환한다. 이 응답은
  `AI_EXECUTING`, `requiresUserAction=true`, `executionBlocked=true`, null Action payload와
  null decision metadata, 빈 `options`/`terms`와 null confirmation metadata를 가진 현재 16필드 계약이다.
- 약관: `TERMS_AGREEMENT`, `WAIT_FOR_USER`, `USER_DECISION_REQUIRED`로 자동 동의를
  차단한다. `terms` 순서와 snapshot의 실제 `checked`를 보존하며 `required`는 현재
  label의 필수 marker에서 D24 정책이 canonicalize한다.
- 약관 재개: selected IDs를 다시 실행하거나 선택 약관을 추가하지 않는다. Backend가
  적용한 새 snapshot에서 `약관 선택 확인`을 실행한다. 다음 snapshot에서
  `비밀번호 입력으로 이동`이 enabled이면 userDecision이 이미 소비됐더라도 약관
  decision을 반복하지 않고 해당 NORMAL navigation을 실행한다.
- 보안 입력: password/PIN/OTP/인증번호 또는 `SECURE_INPUT` 요소를 감지하면
  `PAUSE_FOR_SECURE_INPUT`, `SECURE_INPUT_REQUIRED`, `requiresUserAction=true`,
  `executionBlocked=true`를 반환한다. Action payload와 decision metadata는 비우고
  Agent Loop를 즉시 중단한다.

모델이 D25 예금 요청에서 `FINAL_CONFIRMATION_REQUIRED`,
`REQUEST_FINAL_CONFIRMATION` 또는 `confirmationId`를 생성해도 Product/Detail/Amount/Terms와
semantic UNKNOWN 단계에서 D27 상태로 전달하지 않고 안전한 `NONE`으로 차단한다.
secure 및 risk 보호는 이 경계보다 우선한다.

## Backend 선택 상품 및 추가정보 계약

Backend는 사용자가 확정한 PRODUCT_SELECTION의 실제 DOM ID를 세션별 선택 상품
context에 기록한다. 상품 상세에서 실제 product ID/name/period와 원 요청 기간을
검증하며, 기간이 없으면 유효한 선택 상품 조건으로 계속 진행하고 기간이 다르면
`ADDITIONAL_INFORMATION_REQUIRED`로 전환한 뒤 C 호출 전에 Agent Loop를 중단한다.
금액 화면도 같은 선택 상품 context와 canonical product ID가 일치해야 C를 호출한다.

금액이 없어서 C가 조건 화면에서 반환한 16필드 blocked `NONE`은 Backend
`AiDecisionExecutionService`가 `ADDITIONAL_INFORMATION_REQUIRED`로 전환한다. C는
`ADDITIONAL_INFORMATION` decisionType이나 새 status/DTO를 생성하지 않는다. C의
period mismatch `NONE`은 direct route의 fail-closed 경계이며, 실제 Production 상태
전환의 authoritative owner는 Backend다.

Production Action allowlist와 C → B 16필드 rich response는 D23/D24 action·decision 계약을 그대로
유지한다. `SELECT`, `SCROLL`, `WAIT`를 활성화하지 않으며 Production 전역
`UserDecisionContextStore`와 `resumeAgentLoopAfterUserDecision()` 직접 호출을 사용하지
않는다.

## 고령층 안내와 TTS 안전 문장

단계별 고정 의미는 다음과 같다.

```text
상품 선택: 가입할 예금 상품을 직접 선택해 주세요.
상품 상세: 가입 기간과 금리를 확인해 주세요.
가입 금액: 가입 금액을 확인해 주세요.
금액 확인: 입력한 가입 금액을 확인해 주세요.
금액 없음: 가입 금액을 확인하려면 추가 정보가 필요합니다.
상품 검증 실패: 선택한 상품의 상세 조건을 다시 확인해 주세요.
기간 불일치: 선택한 상품의 가입 기간을 다시 확인해 주세요.
약관 이동: 약관 내용을 확인해 주세요.
약관: 필수 약관과 선택 약관을 직접 선택해 주세요.
약관 확인: 약관 선택 내용을 확인해 주세요.
보안 화면 이동: 비밀번호 입력 화면으로 이동합니다.
보안 입력: 비밀번호는 금융 화면에 직접 입력해 주세요.
```

message sanitizer는 prompt/reasoning, 내부 endpoint, selector/elementId/raw DOM,
HTML/URL, 금융 비밀, 완료·성공 선단정, 상품 추천과 자동 선택·동의 표현을 차단한다.
C는 Frontend가 읽을 수 있는 안전한 문장만 제공하며 TTS 재생 자체는 수행하지 않는다.

## Agent Loop과 장애 안전성

Action 뒤 동일 `snapshotId`가 반환되면 재실행하지 않고 `ERROR`로 종료한다. 서로 다른
snapshot이 계속 와도 기존 maxSteps 상한이 적용된다. 사용자 결정과 보안 입력에서는
Browser Action을 실행하지 않으며 secure/final/risk 보호와 STOP/COMPLETED 정책도
변경하지 않는다. Gemini 장애 시 금융 Action 없는 fallback을 사용하되, 현재 DOM이
보안 입력 단계이면 모델 없이도 보안 pause로 fail closed한다.

## Production route와 검증

Demo Bank React DOM, Backend extractor 순서와 Sanitized DOM 직렬화에서 파생한 fixture로
실제 `POST /api/ai/action`의 request validation, stage/context 정책, Structured Output,
D24 option 검증, 16필드 adapter와 HTTP response를 검증한다. 순서는 상품 선택,
상품 선택 적용, 상세, 금액 TYPE, 금액 확인, 약관 이동, 약관 선택, 약관 확인,
비밀번호 이동, 보안 중단이다. 실제 고객정보, 계좌번호, 비밀번호, API key 또는 raw
Gemini output은 fixture와 로그에 포함하지 않는다.

기간이 없는 100만 원 요청은 두 Demo 상품 각각에서 실제 상세 metadata의 12개월을
검증한 후 `TYPE 1000000`, 금액 확인, 약관 이동까지 진행한다. 요청 12개월과 실제
12개월 일치는 진행하고, 요청 6개월과 실제 12개월 불일치는 기간을 덮어쓰거나 다른
상품을 선택하지 않고 blocked `NONE`으로 종료한다. Backend Production Agent Loop에서는
동일 충돌을 `ADDITIONAL_INFORMATION_REQUIRED`로 전환한다.

2026-08-21 오프라인 검증 기준:

```text
npm.cmd run check                 PASS
npm.cmd test                      70/70 PASS
npm.cmd run test:d23               6/6 PASS
npm.cmd run test:d24              31/31 PASS
npm.cmd run test:d24:response      8/8 PASS
npm.cmd run test:d25              23/23 PASS
git diff --check                  PASS
```

`test:live`는 Gemini/API 의존 테스트이므로 기본 오프라인 회귀에서 제외한다.

---

# 25. D26 보안 입력 보호 평가

## Backend authoritative secure channel

D26 Backend 구현은 AI Engine과 분리된 secure channel을 소유한다. Agent Loop는
`FrameCaptureGuard`가 `SECURE_INPUT_BLOCKED`를 반환하면 DOM snapshot 생성, C 호출,
일반 Browser Action 실행 전에 중단하고 `SECURE_INPUT_REQUIRED`로 전환한다.
`SanitizedDomSnapshotService`, `BrowserFrameCaptureService`,
`BrowserActionExecutionService`도 active latch 동안 각각 snapshot, frame capture,
일반 Action을 차단한다.

UI event envelope는 다음 필드로 구성된다.

```text
eventId, eventSequence, eventType, sessionId, status, message,
actionRequired, target, decision, secureInput, occurredAt
```

`SECURE_INPUT_REQUIRED`의 `secureInput`은 다음 public metadata만 포함한다.

```text
secureRequestId, secureInputType, frameId, frameSequence, message
```

`secureInputType`은 `ACCOUNT_PASSWORD`, `OTP`, `CERTIFICATE_PASSWORD`다. event는
`/topic/sessions/{sessionId}/events`에 발행된다. reconnect용
`GET /api/v1/sessions/{sessionId}/events/latest` 응답은
`sessionId`, `latestEventSequence`, `state`, `guide`, `target`, `decision`,
`secureInput`을 포함하며 required event를 보존하고 resolved/clear event에서 제거한다.

secure submit 계약은 Backend/Frontend 전용이다.

```text
POST /api/v1/sessions/{sessionId}/secure-inputs/{secureRequestId}/submit

request:  requestId, value, expectedFrameId, expectedSequence
response: requestId, secureRequestId, status, message
```

C는 이 endpoint를 호출하지 않고 위 DTO를 구현하지 않는다. Production에서는 HTTPS가
필수다. Backend registry는 session별 active request를 하나만 유지하고, secure request,
source frame, request ID, in-flight 및 processed request ID를 원자적으로 검증한다.
중복 claim과 stale frame을 거부한다.

제출 성공 시 Backend만 secure DOM에 값을 채우고 완료 버튼을 실행한다. secure 요소가
제거된 것을 확인한 뒤 한 번의 safe frame capture만 허용하고, 새 frame을 publish한 다음
latch를 resolve하며 `SECURE_INPUT_RESOLVED`를 발행한다. 이후 session을 `PAGE_LOADING`으로
전환하고 Agent Loop를 비동기로 예약한다. submit ACK는 secure channel 처리가
`COMPLETED`됐다는 뜻일 뿐, 재개된 Agent Loop나 금융 거래 완료를 뜻하지 않는다.

## C 책임 경계와 fail-closed 정책

Backend의 `AiDecisionRequest`는 `userRequest`, `snapshot`, optional `userDecision`만
포함한다. `secureRequestId`, frame ID/sequence, submit value는 C에 전달되지 않는다.
재개 시 C는 latch 해제 후 Backend가 새로 만든 sanitized snapshot만 독립 request로
평가한다. exactly-once와 duplicate submit은 Backend 소유이며 C는 process-global secure
store, latch 또는 duplicate registry를 만들지 않는다.

C는 defense-in-depth로 visible `SECURITY_POLICY:SECURE_INPUT` 요소를 모델 호출과 prompt
생성보다 먼저 검사한다. 해당 화면에서는 모델 후보와 Gemini 장애 여부에 관계없이
다음 내부 응답을 canonical하게 만든 후 현재 16필드 adapter로 전달한다.

```text
status=SECURE_INPUT_REQUIRED
action=PAUSE_FOR_SECURE_INPUT
targetElementId=null
inputValue=null
requiresUserAction=true
decision/options/final/risk metadata=null
```

Backend wire에서는 `actionType=PAUSE_FOR_SECURE_INPUT`,
`elementId/value/scrollX/scrollY/waitMillis=null`, `requiresUserAction=true`, `executionBlocked=true`,
`decisionType/sourceSnapshotId=null`, `options/terms=[]`가 된다. secure type은 C 내부
안전 안내 선택에만 사용되며 현재 16필드 C→B response에 추가하지 않는다.

- `ACCOUNT_PASSWORD`: `비밀번호는 금융 화면에 직접 입력해 주세요.`
- `OTP`: `인증번호는 금융 화면에 직접 입력해 주세요.`
- `CERTIFICATE_PASSWORD`: `인증서 비밀번호는 금융 화면에 직접 입력해 주세요.`

모델이 secure 화면에서 TYPE/CLICK, 값, final confirmation, confirmation ID/summary 또는
risk payload를 만들어도 canonical pause가 우선한다. 반대로 current snapshot에 secure
요소가 없는데 모델만 secure transition을 만들면 이를 신뢰하지 않고 금융 Action 없는
fallback으로 종료한다. 따라서 secure에서 D27 final approval로 자동 이동하거나 risk를
이용해 raw 입력/Browser Action으로 우회할 수 없다.

내부 Agent Loop resume는 clean pause payload, 이전과 다른 snapshot ID, secure 요소가
제거된 새 snapshot을 요구한다. 같은 snapshot 또는 새 ID이지만 secure 요소가 남아 있는
snapshot은 거부한다. 제거된 secure element ID를 모델이 target으로 재사용하면 current
snapshot membership 검사에서 fallback된다. C request에는 frame metadata가 없으므로
frame freshness 및 단 한 번의 safe capture는 Backend가 authoritative하게 검증한다.

AI request validator는 Backend snapshot/page/element/bounding-box field allowlist를
검증한다. `value`, `secureRequestId`, `frameId`, `frameSequence` 같은 secure channel 필드를
AI request에 넣으면 unknown field로 거부한다. Production 오류 로그는 고정 문장만
사용하며 request body, model raw output, reasoning 또는 prompt를 출력하지 않는다.

## D26 오프라인 평가

`d26SecureInputEvaluation.test.ts`에는 37개 deterministic 평가가 있다.

- ACCOUNT_PASSWORD 5개: pause, TYPE/value 차단, 안전 message, 16필드 wire
- OTP 5개: pause, TYPE/숫자 생성 차단, model 미호출, 안전 message
- CERTIFICATE_PASSWORD 5개: pause, TYPE/default 차단, prompt, 안전 message
- completion 전 5개: resume/CLICK/final/risk/Gemini 우회 차단
- resume 5개: 새 snapshot, raw context 부재, 제거 target, duplicate, stateless
- stale/error 6개: 동일/잔존 secure snapshot, frame field, invented transition,
  malformed pause, raw value field 차단
- Production HTTP 6개: 세 secure type, stale secure snapshot, valid safe resume,
  raw logging 정적 검사

`POST /api/ai/action` 평가에는 request validation, structured policy, 16필드 adapter와 실제
HTTP JSON이 모두 포함된다. fixture에는 synthetic placeholder만 사용하며 secure 화면은
model generator 호출 전 반환되므로 해당 placeholder가 prompt/model/log/wire에 전달되지
않는다. D23 Action allowlist, D24 rich/stateless decision, D25 Demo/기간/반복 차단과
secure/final/risk 우선순위는 그대로 유지한다. D27 final metadata는 아래 계약에서만 채운다.

---

# 26. D27 정기예금 최종 확인과 안전 중단

## Deterministic final target

C는 `/deposit/confirmation/deposit-12m`과
`/deposit/confirmation/deposit-preferred`에서만 예금 최종 확인을 판단한다. URL은
query/fragment/user-info가 없는 canonical HTTP(S) 경로여야 하며, 현재 sanitized snapshot의
`FINAL_CONFIRMATION` 요소가 정확히 하나이고 visible/enabled button이며 label이
`Demo 예금 최종 승인` 또는 동등한 예금 승인 의미일 때만 target으로 인정한다.

missing/duplicate/hidden/disabled target, checkbox, cancel, unknown label·상품·URL은
fail-closed한다. disabled 승인 버튼은 사용자가 Demo checkbox를 직접 선택해야 하는 상태로
보고 `NONE`을 반환하며 C가 checkbox를 선택하거나 승인 target을 CLICK하지 않는다.
`confirmationTargetElementId`는 모델 값이 아니라 현재 snapshot membership에서 파생한다.
stale/non-member model target, unknown confirmation type, model confirmation ID/summary는
금융 Action 없는 `NONE`으로 제거한다.

Final 화면과 completion 화면은 prompt/model 호출보다 먼저 deterministic하게 처리된다.
모델이 상품 목록·상세·금액·약관·일반 화면에서 만든 premature final 신호도 runtime
policy에서 차단한다. 우선순위는 secure → risk/BLOCKED → final이며 secure 화면은 기존 D26
model-before-prompt 차단을 그대로 사용한다.

## C → B 16필드 final response

```json
{
  "actionType": "REQUEST_FINAL_CONFIRMATION",
  "elementId": null,
  "value": null,
  "scrollX": null,
  "scrollY": null,
  "waitMillis": null,
  "status": "FINAL_CONFIRMATION_REQUIRED",
  "message": "예금 가입 전 최종 확인이 필요합니다.",
  "requiresUserAction": true,
  "executionBlocked": true,
  "decisionType": null,
  "sourceSnapshotId": "<current snapshot id>",
  "options": [],
  "terms": [],
  "confirmationType": "DEPOSIT_SUBSCRIPTION",
  "confirmationTargetElementId": "<current enabled final target>"
}
```

일반 `elementId`에는 final target을 넣지 않는다. adapter는 위 action/status/blocking/type/
target/snapshot 조합만 허용하고 `CLICK + FINAL_CONFIRMATION_REQUIRED`, final metadata와
`AI_EXECUTING`, 잘못된 enum casing을 거부한다. Backend canonical fixture
`backend/src/test/resources/contracts/d27-final-confirmation-response.json`를 C 테스트에서 직접
읽어 field name, 순서, null/empty 규칙과 enum casing을 교차 검증한다.

## Backend 소유 경계

Backend만 `confirmationId`와 authoritative summary를 생성하고 active confirmation latch,
source frame identity, current live frame 비교, approve/reject request, requestId idempotency,
pending target exactly-once CLICK과 confirmation event/reconnect lifecycle을 소유한다. C는
summary나 confirmation ID를 생성·전송하지 않고 approve/reject endpoint를 호출하지 않는다.

Backend summary는 productName/productPeriod/amount 중 하나라도 누락되거나 HTML/모든 ISO
제어문자/password·비밀번호/OTP·인증번호/PIN/미마스킹 계좌번호가 발견되면 confirmation
전체를 fail-closed한다. `FinalConfirmationSummary`는 고정 3필드 record라 duplicate summary
ID 검사는 적용되지 않는다.

승인/거절은 Backend가 요청의 expectedFrameId/expectedSequence를 active confirmation의
sourceFrameId/sourceFrameSequence와 current live frame에 모두 비교한 뒤 수행한다. stale
approve/reject에서는 pending CLICK이 실행되지 않는다.

## Agent Loop과 completion

정확한 final response를 받으면 C Agent Loop는 `WAITING_FOR_FINAL_CONFIRMATION`으로 한 step에
멈추고 `execute`나 새 snapshot 조회를 호출하지 않는다. C에는 final resume API나
process-global confirmation store가 없다. 승인/거절 이후 재개 여부는 Backend가 소유한다.

`/deposit/completed/:productId`에서는 모델 호출 없이 `AI_EXECUTING + NONE`과
`데모 가입 절차가 완료되었습니다.`만 반환한다. Backend가 WorkflowStatus의 authoritative
owner이므로 C가 `COMPLETED`를 wire에 만들지 않는다. 화면의 Demo 메인 버튼도 CLICK하지 않고
실제 금융기관 가입·거래 성공을 주장하지 않는다.

## 공동 E2E authoritative context

2026-08-26 `origin/develop`의 Backend는 검증된 상품 선택, 상품 상세의 상품명·기간, 가입 금액을
세션별 `SelectedDepositProductStore`에 보존한다. final 화면에서 읽은 `productId`,
`productName`, `productPeriod`, `depositAmount`가 이 context와 모두 일치할 때만 final snapshot을
생성하고, `FinalConfirmationSummaryExtractor`가 그 snapshot으로 authoritative summary를 만든다.
불일치나 누락은 confirmation activation 전에 fail-closed한다.

C request validator는 최신 snapshot의 `page.depositAmount`를 수신할 수 있지만 이 값을 모델
입력으로 전달하거나 summary 생성에 사용하지 않는다. C는 계속 valid 16필드 response만 반환하며
summary와 confirmation ID의 생성·검증·보존은 Backend가 소유한다.

## D27 오프라인 평가

`d27FinalConfirmation.test.ts`는 두 Demo 상품, target validation, premature final,
secure/risk 우선순위, loop stop, completion, adapter invariant, Backend canonical fixture와
실제 Express route와 Backend-owned amount 수신 경계를 포함한 45개 deterministic 테스트를 제공한다. package script는
추가하지 않고 `npm.cmd exec -- tsx --test src/tests/d27FinalConfirmation.test.ts`로 실행한다.

---

## 관련 문서

```text
docs/D15_Sanitized_DOM_Target_elementId_통합규격_v1.0.md
docs/frontend-d22-viewer-remote-actions.md
```

본 문서는 위 세부 문서를 대체하지 않으며, AI Engine 전체 구조와 A/B/C 통합 관점을 빠르게 파악하기 위한 상위 가이드 역할을 한다.
