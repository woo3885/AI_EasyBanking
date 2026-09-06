# AI Engine

담당: 개발자 C — AI Engine & Integration

사용자의 요청과 웹사이트 정보를 분석하여 다음 행동을 결정하고, 사용자에게 안내 메시지를 생성하는 AI 모듈입니다.

## 주요 역할

* 사용자 의도 분류
* 사용자 요청에서 UserGoal 추출
* DOM Snapshot 분석
* 다음 클릭 대상 추론
* 사용자 안내 메시지 생성
* 안전 행동 정책 판단
* 민감정보 탐지 및 마스킹
* Backend Automation 모듈과의 연동
* 구조화된 AI 응답 생성

## 기술 스택

* Node.js
* TypeScript
* Google Gemini API
* Google Gen AI SDK
* dotenv

## 프로젝트 구조

```text
ai-engine/
├─ src/
│  ├─ clients/
│  │  └─ gemini.client.ts
│  ├─ config/
│  │  └─ env.ts
│  ├─ goals/
│  │  ├─ userGoal.extractor.ts
│  │  └─ userGoal.types.ts
│  ├─ intents/
│  │  └─ intent.classifier.ts
│  ├─ policy/
│  │  ├─ actionPolicy.ts
│  │  └─ safetyPolicy.ts
│  ├─ prompts/
│  │  ├─ promptTypes.ts
│  │  └─ systemPrompt.ts
│  ├─ services/
│  │  └─ ai.service.ts
│  └─ index.ts
├─ .env.example
├─ .gitignore
├─ package.json
├─ package-lock.json
├─ tsconfig.json
└─ README.md
```

## 환경 요구사항

* Node.js 18 이상
* Gemini API Key

현재 개발 환경에서는 Node.js v24.15.0을 사용합니다.

## 설치

```bash
cd ai-engine
npm install
```

## 환경변수 설정

`.env.example` 파일을 복사하여 `.env` 파일을 생성합니다.

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.5-flash
```

실제 API 키가 포함된 `.env` 파일은 Git에 커밋하지 않습니다.

## 실행

AI Engine을 실행합니다.

```bash
npm start
```

개발 중 파일 변경을 감지하여 자동 재실행하려면 다음 명령을 사용합니다.

```bash
npm run dev
```

## 타입 검사

```bash
npm run check
```

또는 다음 명령으로 TypeScript 타입 오류를 확인할 수 있습니다.

```bash
npx tsc --noEmit
```

## 빌드

```bash
npm run build
```

빌드가 완료되면 `dist` 폴더에 JavaScript 파일이 생성됩니다.

## 현재 구현 상태

* Gemini API 환경변수 설정
* 필수 환경변수 검증
* Gemini Client 생성
* 기본 AI Service 생성
* 텍스트 프롬프트 전송
* Gemini 응답 출력
* 사용자 요청 Intent 분류
* UserGoal 구조체 정의
* 사용자 요청에서 금액 추출
* 사용자 요청에서 기간 추출
* 사용자 요청에서 수취인 추출
* 사용자 요청에서 추가 조건 추출
* 부족한 필수 정보 판단
* 시스템 프롬프트 1차 작성
* 자동 실행 및 사용자 확인 경계 정의
* 안전 행동 정책 평가
* 금융 및 보안 행동 차단 정책
* 전화번호, 카드번호, 주민등록번호 탐지 및 마스킹
* TypeScript 타입 검사
* TypeScript 빌드

현재 AI Engine의 기본 데이터 흐름은 다음과 같습니다.

```text
사용자 키보드 입력 또는 STT 변환 결과
  ↓
intents/intent.classifier.ts
  ↓
goals/userGoal.extractor.ts
  ↓
UserGoal
  ↓
policy/actionPolicy.ts
  ↓
안전 행동 판단
  ↓
services/ai.service.ts
  ↓
Gemini API
```

Gemini API 설정 흐름은 다음과 같습니다.

```text
.env
  ↓
config/env.ts
  ↓
clients/gemini.client.ts
  ↓
services/ai.service.ts
  ↓
Gemini API
```

## 공통 계약

프론트엔드, 백엔드 및 AI Engine 사이의 공통 요청·응답 타입은 다음 파일을 기준으로 합니다.

```text
contracts/api.ts
```

주요 공통 타입:

* `SystemStatus`
* `CreateSession`
* `DomSnapshot`
* `ClickableElement`
* `RemoteAction`

AI Engine은 향후 `DomSnapshot`과 사용자 요청을 입력받아 다음 행동을 구조화된 형태로 반환합니다.

## 향후 구현 범위

* `DomSnapshot` 입력 처리
* 클릭 가능한 요소 분석
* 다음 target 추론
* `CLICK`, `INPUT`, `SCROLL`, `BACK` 행동 결정
* guide message 생성
* JSON 기반 구조화 응답
* UserGoal과 DOM 분석 결과 결합
* Backend Automation 모듈 연동
* 오류 및 재시도 처리
* 정규식으로 추출하기 어려운 자연어를 Gemini로 보완

## 보안 주의사항

* `.env` 파일은 Git에 커밋하지 않습니다.
* Gemini API Key를 소스 코드에 직접 작성하지 않습니다.
* 로그에 API Key나 민감한 사용자 정보를 출력하지 않습니다.
* AI 응답을 바로 실행하지 않고 공통 계약과 안전 정책에 따라 검증한 후 사용합니다.
* 비밀번호, OTP, 인증번호 및 보안카드 정보는 AI가 대신 입력하지 않습니다.
* 안전 여부가 불확실한 행동은 자동으로 실행하지 않습니다.

## 안전 행동 정책

AI Engine은 웹페이지에서 수행할 행동을 다음 세 단계로 구분합니다.

### SAFE

사용자의 자산이나 개인정보에 직접적인 영향을 주지 않는 행동입니다.

* 메뉴 이동
* 금융 상품 조회
* 페이지 스크롤
* 이전 페이지 이동
* 상품 비교 화면 이동

`SAFE` 행동은 자동으로 실행할 수 있습니다.

### CONFIRM_REQUIRED

사용자의 금융 거래, 권리 또는 개인정보에 영향을 줄 수 있는 행동입니다.

* 금융 상품 가입
* 송금 및 이체
* 결제
* 대출 신청
* 계좌 개설
* 약관 동의
* 개인정보 제공 동의
* 최종 제출

해당 행동은 사용자의 명시적인 확인을 받은 후 실행해야 합니다.

### BLOCKED

AI가 대신 수행해서는 안 되는 보안 관련 행동입니다.

* 비밀번호 입력
* OTP 입력
* 인증번호 입력
* 보안카드 정보 입력
* 보안 절차 우회
* 사용자 동의 없는 금융 거래

해당 행동은 사용자가 직접 수행해야 하며 AI는 자동으로 실행하지 않습니다.

안전 여부가 명확하지 않은 행동은 기본적으로 `CONFIRM_REQUIRED`로 처리합니다.

## 민감정보 보호

사용자 입력에서 다음 민감정보를 탐지하고 마스킹합니다.

* 전화번호
* 카드번호
* 주민등록번호

예시:

```text
입력: 제 전화번호는 010-1234-5678입니다.
출력: 제 전화번호는 [민감정보 숨김]입니다.
```

민감정보가 포함된 입력값은 로그나 AI 안내 문장에서 원문 그대로 반복하지 않습니다.

## UserGoal 추출

사용자의 자연어 요청에서 금융 목적 수행에 필요한 주요 정보를 추출하여 `UserGoal` 구조체로 변환합니다.

추출 항목:

* 원본 사용자 요청
* Intent
* Intent 신뢰도
* 금액
* 통화
* 기간
* 수취인
* 추가 조건
* 부족한 필수 정보

예시:

```text
입력: 친구 계좌로 10만 원을 보내고 싶어요

Intent: TRANSFER
신뢰도: 0.65
금액: 100000
통화: KRW
수취인: 친구
기간: 없음
조건: 없음
부족한 정보: 없음
```

기간과 조건이 포함된 요청도 구조화할 수 있습니다.

```text
입력: 6개월 동안 금리가 높은 예금 상품을 찾고 싶어요

Intent: DEPOSIT
금액: 없음
기간: 6 MONTH
조건: 금리가 높은
부족한 정보: 없음
```

정보가 부족한 경우 `missingFields`에 필요한 항목을 저장합니다.

```text
입력: 10만 원을 보내고 싶어요

Intent: TRANSFER
금액: 100000
수취인: 없음
부족한 정보: recipient
```

위 결과를 사용하면 AI가 다음과 같이 부족한 정보를 사용자에게 요청할 수 있습니다.

```text
누구에게 10만 원을 보낼까요?
```

## STT 연동

개발자 A의 STT 모듈은 사용자의 음성을 텍스트로 변환합니다.

```text
사용자 음성
  ↓
STT
  ↓
"친구에게 10만 원 보내줘"
  ↓
UserGoal 추출
```

AI Engine은 입력 출처가 키보드인지 음성인지 구분하지 않고 전달받은 문자열을 동일하게 분석합니다.

```ts
const sttText = "친구에게 10만 원 보내줘";
const userGoal = extractUserGoal(sttText);
```

## 현재 UserGoal 추출 범위

현재는 정규식과 키워드를 이용하여 다음과 같이 숫자가 포함된 명확한 표현을 처리합니다.

```text
10만 원
50,000원
300만 원
6개월
1년
민수에게
친구 계좌로
금리가 높은
수수료 없는
```

다음과 같은 복잡하거나 구어적인 표현은 향후 Gemini 분석으로 보완할 예정입니다.

```text
십만 원
반년
다음 달까지
엄마한테 용돈 좀 보내줘
최대한 금리가 좋은 상품
```
