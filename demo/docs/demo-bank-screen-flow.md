# 데모 금융사이트 화면 흐름

## 1. 문서 목적

이 문서는 실제 금융사이트와 분리된 시연용 자체 데모사이트의 화면 흐름과 사용자 책임 범위를 정의한다. 데모는 금융 자동화의 안전한 중단 지점과 사용자 직접 선택 과정을 재현하기 위한 것이며 실제 금융 거래를 처리하지 않는다.

## 2. 공통 원칙

- 사용자는 상품, 약관, 계좌, 수취인과 최종 승인을 직접 선택한다.
- 비밀번호와 OTP는 사용자가 해당 보안 입력 화면에서 직접 입력한다.
- AI는 일반 화면 이동과 민감하지 않은 일반 값 입력만 수행한다.
- 최종 승인 전에는 예금 가입이나 송금을 완료하지 않는다.
- 약관 전체 동의, 상품 자동 선택, 계좌 자동 선택과 최종 승인 자동 처리를 금지한다.
- 비밀번호, OTP와 계좌번호 원문은 화면 상태, DOM 속성, 자동화 데이터와 로그에 복사하지 않는다.
- 취소 시 입력 중인 민감정보를 폐기하고 `HOME`으로 돌아간다.

## 3. 메인 화면

`HOME`은 다음 시연 흐름의 시작점이다.

- 예금 가입 시작 영역
- 계좌이체 시작 영역
- `RISK_WARNING`으로 이동하는 위험 요청 테스트 진입점

메인 화면은 실제 금융상품 판매 페이지가 아니라 각 데모 흐름으로 진입하기 위한 안내 화면이다.

## 4. 예금 가입 흐름

```mermaid
stateDiagram-v2
    [*] --> HOME
    HOME --> DEPOSIT_PRODUCT_LIST: 예금 가입 시작
    DEPOSIT_PRODUCT_LIST --> HOME: 이전 또는 취소
    DEPOSIT_PRODUCT_LIST --> DEPOSIT_PRODUCT_DETAIL: 상품 직접 선택
    DEPOSIT_PRODUCT_DETAIL --> DEPOSIT_PRODUCT_LIST: 이전 또는 상품 수정
    DEPOSIT_PRODUCT_DETAIL --> HOME: 취소
    DEPOSIT_PRODUCT_DETAIL --> DEPOSIT_CONDITIONS: 가입 진행
    DEPOSIT_CONDITIONS --> DEPOSIT_PRODUCT_DETAIL: 이전
    DEPOSIT_CONDITIONS --> DEPOSIT_CONDITIONS: 금액 또는 기간 수정
    DEPOSIT_CONDITIONS --> HOME: 취소
    DEPOSIT_CONDITIONS --> DEPOSIT_TERMS: 조건 확인
    DEPOSIT_TERMS --> DEPOSIT_CONDITIONS: 이전 또는 조건 수정
    DEPOSIT_TERMS --> DEPOSIT_TERMS: 약관 선택 수정
    DEPOSIT_TERMS --> HOME: 취소
    DEPOSIT_TERMS --> DEPOSIT_PASSWORD: 필수 약관 동의
    DEPOSIT_PASSWORD --> DEPOSIT_TERMS: 이전
    DEPOSIT_PASSWORD --> DEPOSIT_PASSWORD: 비밀번호 직접 수정
    DEPOSIT_PASSWORD --> HOME: 취소
    DEPOSIT_PASSWORD --> DEPOSIT_CONFIRMATION: 보안 입력 완료
    DEPOSIT_CONFIRMATION --> DEPOSIT_PASSWORD: 이전
    DEPOSIT_CONFIRMATION --> DEPOSIT_CONDITIONS: 가입 조건 수정
    DEPOSIT_CONFIRMATION --> DEPOSIT_TERMS: 약관 선택 수정
    DEPOSIT_CONFIRMATION --> HOME: 취소
    DEPOSIT_CONFIRMATION --> DEPOSIT_COMPLETED: 사용자가 최종 승인
    DEPOSIT_COMPLETED --> HOME: 처음으로
```

예금 완료 화면은 사용자가 `DEPOSIT_CONFIRMATION`에서 최종 승인 체크와 승인 버튼을 직접 수행한 경우에만 진입한다.

## 5. 계좌이체 흐름

```mermaid
stateDiagram-v2
    [*] --> HOME
    HOME --> TRANSFER_ACCOUNT_SELECTION: 계좌이체 시작
    TRANSFER_ACCOUNT_SELECTION --> HOME: 이전 또는 취소
    TRANSFER_ACCOUNT_SELECTION --> TRANSFER_ACCOUNT_SELECTION: 출금 계좌 수정
    TRANSFER_ACCOUNT_SELECTION --> TRANSFER_RECIPIENT_SELECTION: 계좌 직접 선택 후 다음
    TRANSFER_RECIPIENT_SELECTION --> TRANSFER_ACCOUNT_SELECTION: 이전 또는 계좌 수정
    TRANSFER_RECIPIENT_SELECTION --> TRANSFER_RECIPIENT_SELECTION: 수취인 수정
    TRANSFER_RECIPIENT_SELECTION --> HOME: 취소
    TRANSFER_RECIPIENT_SELECTION --> TRANSFER_AMOUNT: 수취인 직접 선택
    TRANSFER_AMOUNT --> TRANSFER_RECIPIENT_SELECTION: 이전
    TRANSFER_AMOUNT --> TRANSFER_AMOUNT: 송금 금액 수정
    TRANSFER_AMOUNT --> HOME: 취소
    TRANSFER_AMOUNT --> TRANSFER_PASSWORD: 금액 확인
    TRANSFER_PASSWORD --> TRANSFER_AMOUNT: 이전
    TRANSFER_PASSWORD --> TRANSFER_PASSWORD: 비밀번호 직접 수정
    TRANSFER_PASSWORD --> HOME: 취소
    TRANSFER_PASSWORD --> TRANSFER_OTP: 비밀번호 입력 완료
    TRANSFER_OTP --> TRANSFER_PASSWORD: 이전
    TRANSFER_OTP --> TRANSFER_OTP: OTP 직접 수정
    TRANSFER_OTP --> HOME: 취소
    TRANSFER_OTP --> TRANSFER_CONFIRMATION: OTP 로컬 입력 완료 후 별도 시작
    TRANSFER_CONFIRMATION --> TRANSFER_OTP: 이전
    TRANSFER_CONFIRMATION --> TRANSFER_ACCOUNT_SELECTION: 출금 계좌 수정
    TRANSFER_CONFIRMATION --> TRANSFER_RECIPIENT_SELECTION: 수취인 수정
    TRANSFER_CONFIRMATION --> TRANSFER_AMOUNT: 송금 금액 수정
    TRANSFER_CONFIRMATION --> HOME: 취소
    TRANSFER_CONFIRMATION --> TRANSFER_COMPLETED: 로컬 승인 후 별도 완료 화면 이동
    TRANSFER_COMPLETED --> HOME: 처음으로
```

송금 완료 화면은 사용자가 `TRANSFER_CONFIRMATION`에서 수취인과 금액을 다시 확인하고 최종 승인한 경우에만 진입한다.

## 6. 위험 요청 흐름

```mermaid
stateDiagram-v2
    [*] --> HOME
    HOME --> RISK_WARNING: 위험 요청 테스트
    RISK_WARNING --> HOME: 안전 안내 확인 후 돌아가기
    RISK_WARNING --> [*]: 세션 종료
```

`RISK_WARNING`에서는 송금, 이체, 예금 가입, 승인 등 금융 실행 버튼을 표시하지 않는다. 사용자는 홈으로 돌아가거나 세션을 종료할 수 있다.

## 7. 화면별 정보

| 화면 ID | 화면 이름 | 사용 목적 | 주요 표시 정보 | 사용자 입력 | 주요 버튼 | 다음 화면 | 보안 주의사항 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `HOME` | 메인 | 데모 업무 선택 | 서비스 설명, 예금·이체 진입점, 위험 테스트 | 업무 선택 | 예금 시작, 이체 시작, 위험 테스트 | `DEPOSIT_PRODUCT_LIST`, `TRANSFER_ACCOUNT_SELECTION`, `RISK_WARNING` | 실제 금융사이트로 오해할 표현 금지 |
| `RISK_WARNING` | 위험 경고 | 위험 요청 차단과 안전 안내 | 자동화 중단, 공식 연락처 확인 안내 | 홈 복귀 또는 종료 선택 | 홈으로, 세션 종료 | `HOME` 또는 세션 종료 | 금융 실행 버튼 표시 금지 |
| `DEPOSIT_PRODUCT_LIST` | 예금 상품 목록 | 가입할 상품 후보 확인 | 상품명, 기간, 금리 예시 | 상품 직접 선택 | 상품 선택, 이전, 취소 | `DEPOSIT_PRODUCT_DETAIL`, `HOME` | AI 자동 선택 금지 |
| `DEPOSIT_PRODUCT_DETAIL` | 예금 상품 상세 | 선택 상품 조건 확인 | 상품 설명, 기간, 금리, 유의사항 | 진행 여부 | 이전, 가입 진행, 취소 | `DEPOSIT_PRODUCT_LIST`, `DEPOSIT_CONDITIONS`, `HOME` | 수익 보장 표현 금지 |
| `DEPOSIT_CONDITIONS` | 예금 가입 조건 | 금액과 기간 설정 | 선택 상품, 가능 기간, 금액 범위 | 가입 금액, 기간 | 이전, 다음, 취소 | `DEPOSIT_PRODUCT_DETAIL`, `DEPOSIT_TERMS`, `HOME` | 일반 값만 상태에 저장 |
| `DEPOSIT_TERMS` | 예금 약관 | 필수·선택 약관 개별 동의 | 필수 약관, 선택 약관, 동의 상태 | 약관별 체크 | 이전, 다음, 취소 | `DEPOSIT_CONDITIONS`, `DEPOSIT_PASSWORD`, `HOME` | 전체 동의 자동 처리 금지 |
| `DEPOSIT_PASSWORD` | 예금 비밀번호 입력 | 사용자 본인 확인 입력 | 보호 모드, AI·캡처 중단 상태 | 계좌 비밀번호 직접 입력 | 이전, 입력 완료, 취소 | `DEPOSIT_TERMS`, `DEPOSIT_CONFIRMATION`, `HOME` | 실제 값의 상태·DOM 속성·로그 복사 금지 |
| `DEPOSIT_CONFIRMATION` | 예금 최종 확인 | Demo 가입 내용 검토와 최종 승인·거절 | 상품, 기간, 금액 | 최종 승인 체크 | 비밀번호 화면으로, 최종 승인, 최종 승인 거절 | `DEPOSIT_PASSWORD`, `DEPOSIT_COMPLETED`, `HOME` | 승인 전 완료 화면 이동 금지 |
| `DEPOSIT_COMPLETED` | 예금 Demo 완료 | 시연 절차 종료 안내 | 공개 Mock 상품명, 실제 거래 미실행 안내 | 없음 | Demo 메인으로 | `HOME` | 실제 가입·잔액 변경으로 표현 금지 |
| `TRANSFER_ACCOUNT_SELECTION` | 출금 계좌 선택 | 출금 계좌 후보 확인 | 계좌 별칭, 마스킹 번호, 잔액 예시 | 계좌 직접 선택 | 계좌 선택, 선택 후 다음, 이전, 취소 | `TRANSFER_RECIPIENT_SELECTION`, `HOME` | 계좌번호는 마스킹된 값만 표시 |
| `TRANSFER_RECIPIENT_SELECTION` | 수취인 선택 | 송금 대상 확인 | Mock 수취인 이름, 관계, 은행, 마스킹 정보 | 수취인 직접 단일 선택 | 이전, 선택 확인, 금액 입력 시작, 취소 | `TRANSFER_ACCOUNT_SELECTION`, `TRANSFER_AMOUNT`, `HOME` | AI 자동 선택 및 실제 고객정보 사용 금지 |
| `TRANSFER_AMOUNT` | 송금 금액 | 송금 금액 입력과 로컬 검토 | 출금 계좌 별칭, 수취인, Mock 잔액, 금액 안내 | 송금 금액 | 이전, 금액 확인, 취소 | `TRANSFER_RECIPIENT_SELECTION`, 후속 `TRANSFER_PASSWORD`, `HOME` | D10은 잔액 초과만 검증하며 실제 송금 금지 |
| `TRANSFER_PASSWORD` | 이체 비밀번호 입력 | 사용자 본인 확인 입력 | 보호 모드, AI·캡처 중단 상태 | 계좌 비밀번호 직접 입력 | 이전, 입력 완료, 취소 | `TRANSFER_AMOUNT`, `TRANSFER_OTP`, `HOME` | 실제 값의 상태·DOM 속성·로그 복사 금지 |
| `TRANSFER_OTP` | OTP 입력 | 추가 본인 확인 입력 | 보호 모드, AI·캡처 중단 상태 | OTP 직접 입력 | 이전, 입력 완료, 취소 | `TRANSFER_PASSWORD`, `TRANSFER_CONFIRMATION`, `HOME` | OTP 원문 저장·출력 금지 |
| `TRANSFER_CONFIRMATION` | 송금 최종 확인 | 송금 내용 검토와 최종 승인 | 거래 유형, 계좌 별칭, 수취인, 금액 | 최종 승인 체크 | 이전, 수정, 최종 승인, 취소 | `TRANSFER_OTP`, 수정 대상 화면, `TRANSFER_COMPLETED`, `HOME` | 승인 전 송금 완료 금지 |
| `TRANSFER_COMPLETED` | 송금 완료 | 시연 결과 확인 | 처리 결과 요약 | 없음 | 처음으로 | `HOME` | OTP와 계좌번호 원문 표시 금지 |

## 8. D10 이체 금액 Mock 경계

D10은 `TRANSFER_RECIPIENT_SELECTION`에서 수취인을 선택한 뒤 기존 확인
버튼으로 로컬 확인을 완료해야 별도 금액 입력 시작 버튼이 활성화되는
Gate를 구현한다. 수취인을 바꾸면 확인 상태와 Gate를 함께 초기화한다.

`TRANSFER_AMOUNT`에서는 URL로 확인한 공개 Mock 계좌·수취인 문맥과 계좌별
Mock 잔액을 표시한다. 사용자가 금액을 직접 입력하며 형식, 0 이하,
JavaScript 안전 정수와 잔액 초과를 검증한다. 수수료, 일일 한도와 1회
한도는 임의로 만들지 않는다.

유효한 금액의 확인은 로컬 안내만 갱신한다. 금액은 pathname, query,
브라우저 저장소, API와 WebSocket에 전달하지 않으며 잔액 차감이나 실제
송금을 실행하지 않는다. `TRANSFER_PASSWORD`, `TRANSFER_OTP`, 최종 승인과
완료는 후속 범위다.

## 9. D11 이체 비밀번호 보안 입력 Mock 경계

`TRANSFER_AMOUNT`에서 유효한 현재 금액을 사용자가 직접 확인해야 별도
비밀번호 입력 시작 버튼이 활성화된다. 금액을 변경하면 확인된 금액 상태와
Gate를 함께 초기화한다. 확인된 금액은 컴포넌트 로컬 상태에만 있고 비밀번호
URL이나 화면에는 전달하지 않는다.

`TRANSFER_PASSWORD`는 `/transfer/secure/password/:accountId/:recipientId`
형식으로 공개 Mock 계좌·수취인 문맥만 복원한다. 실제 계좌번호, 잔액, 이체
금액과 수취인 금융정보는 다시 표시하지 않는다. 정상 직접 URL 접근은 보안
화면 계약 확인용 Mock 예외이며 앞 단계 완료를 주장하지 않는다.

계좌 비밀번호는 사용자가 uncontrolled native password input에 직접 입력한다.
원문은 React 상태, URL, storage, 로그, callback, API와 WebSocket에 복사하지
않는다. React에는 `EMPTY`, `ENTERED` 상태와 로컬 완료 boolean만 저장하며
D1에 없는 자릿수·숫자 형식을 추가하지 않는다. 입력 완료 시 DOM 값을 즉시
제거하고 실제 인증·OTP 이동·송금 없이 데모 완료 안내만 표시한다.

데모페이지는 `type="password"`와 `data-ddd-policy="secure-input"` DOM 신호를
제공한다. `SECURE_INPUT_REQUIRED` 생성, 캡처·AI DOM 전달 중단과 입력 완료 후
자동화 재개는 개발자 B 및 후속 통합 책임이다.

## 10. D12 이체 OTP 보안 입력 Mock 경계

`TRANSFER_PASSWORD`에서 데모 비밀번호 입력 완료 버튼을 누르면 원문을 DOM에서
즉시 제거하고 로컬 완료 상태만 저장한다. 이 상태에서만 별도 OTP 시작 버튼이
활성화되며, 사용자가 직접 눌러
`/transfer/secure/otp/:accountId/:recipientId`로 이동한다. 비밀번호 완료와
화면 이동의 책임은 결합하지 않는다.

`TRANSFER_OTP`는 공개 Mock accountId와 recipientId로 계좌 별칭과 수취인
이름만 복원한다. 정상 직접 URL 접근은 화면·DOM 계약 확인용 예외이며 이전
비밀번호 입력이나 인증 완료를 보장하지 않는다.

OTP는 uncontrolled native `type="password"` input에서 사용자가 직접 입력한다.
React에는 `EMPTY`, `ENTERED` 상태와 로컬 데모 완료 boolean만 저장한다. D1에
자릿수, 숫자 형식, 정답, 만료와 재전송 규격이 없으므로 이를 추가하지 않는다.
완료 시 DOM 값을 즉시 제거하며 실제 인증, 최종 확인 이동과 송금은 수행하지
않는다.

데모페이지는 `data-ddd-policy="secure-input"` 신호를 제공한다. 보안 입력
탐지, `SECURE_INPUT_REQUIRED` 전환, 자동화·AI·캡처 중단과 안전한 재개는
개발자 B의 후속 통합 책임이다.

## 11. D13 이체 최종 확인 Mock 경계

`TRANSFER_OTP`에서 사용자가 입력 완료 버튼을 누르면 OTP 원문을 DOM에서
제거하고 로컬 완료 상태만 저장한다. 그 뒤 별도 최종 확인 시작 버튼을
사용자가 직접 눌러 `/transfer/confirmation/:accountId/:recipientId`로
이동한다. OTP 원문과 완료 상태는 다음 화면으로 전달하지 않는다.

`TRANSFER_CONFIRMATION`은 공개 Mock 계좌·수취인 문맥과 D1 최종 승인 DOM
Gate를 확인하는 화면이다. D10 입력 금액은 화면 이동 후 소멸하므로 임의
금액을 만들지 않고 `전달되지 않음`으로 표시한다. 따라서 이 화면은 실제
거래 요약이나 송금 준비 완료를 의미하지 않는다.

최종 승인 checkbox는 초기 미선택이며 사용자가 직접 선택한 뒤에만 승인
버튼이 활성화된다. 승인 버튼은 `data-ddd-policy="final-confirmation"`을
제공하며 클릭 시 로컬 확인 안내만 표시한다. API, WebSocket, 실제 송금과
잔액 변경은 수행하지 않는다. 직접 URL 접근도 앞 단계 완료를 증명하지
않는다.

## 12. D14 이체 데모 완료 Mock 경계

`TRANSFER_CONFIRMATION`에서 checkbox를 직접 선택하는 것만으로는 완료 화면
Gate가 열리지 않는다. 사용자가 `btn-final-approve`를 직접 눌러 로컬 승인
상태가 된 뒤에만 별도 완료 화면 이동 버튼이 활성화된다. checkbox 변경이나
취소는 로컬 승인과 Gate를 초기화한다.

`TRANSFER_COMPLETED`는 `/transfer/completed/:accountId/:recipientId`에서 공개
Mock 계좌·수취인 문맥만 표시한다. 사용자 승인 UI 절차와 데모 안내 흐름을
확인했다는 의미이며 실제 송금 성공, 인증 결과, 잔액 변경이나 거래 영수증을
의미하지 않는다. 금액도 전달되지 않으며 임의 값을 만들지 않는다.

정상 직접 URL 접근은 화면·DOM 계약 확인용 예외다. URL 자체는 앞 단계
checkbox 선택과 승인을 증명하지 않는다. 메인 복귀만 제공하며 같은 거래를
다시 실행하는 버튼, API, WebSocket과 실제 금융 Action은 제공하지 않는다.

## 13. D15 예금 비밀번호 보안 입력 Mock 경계

`DEPOSIT_TERMS`에서 필수 약관을 모두 직접 선택한 뒤 기존 확인 버튼을
눌러야 `btn-deposit-terms-next`가 활성화된다. 약관 확인과 화면 이동은 서로
다른 사용자 행동이며, 약관 선택을 바꾸면 확인 결과와 다음 Gate를 함께
초기화한다.

`DEPOSIT_PASSWORD`는 `/deposit/secure/password/:productId`에서 공개 Mock
상품명과 기간만 복원한다. 정상 직접 URL 접근은 화면과 보안 DOM 계약을
확인하기 위한 예외이며 이전 약관 확인, 실제 인증 또는 가입 진행을
증명하지 않는다.

비밀번호는 uncontrolled native `type="password"` input에서 사용자가 직접
입력한다. React에는 `EMPTY`, `ENTERED` 상태와 로컬 완료 boolean만 저장하며
원문이나 길이는 저장하지 않는다. 입력 완료 시 DOM 값을 즉시 제거하고
실제 인증, 예금 가입, 잔액 변경과 최종 확인 화면 이동은 수행하지 않는다.

데모페이지는 `data-ddd-policy="secure-input"` 신호를 제공한다. 보안 입력
탐지 후 자동화·AI·DOM·프레임·screenshot·trace·video 수집 중단과 안전한
재개는 개발자 B의 후속 통합 책임이다.

## 14. D27 예금 최종 확인·완료 Mock 경계

`DEPOSIT_PASSWORD`에서 사용자가 보안 입력 완료를 직접 요청한 뒤 별도
`btn-deposit-confirmation-start` 버튼으로
`/deposit/confirmation/:productId`에 진입한다. 보안 입력 완료와 화면 이동은
서로 다른 사용자 행동이며 비밀번호 원문이나 완료 상태를 다음 화면에 전달하지
않는다.

`DEPOSIT_CONFIRMATION`은 상품 데이터의 상품명·기간과 D25 공동 시나리오의
Demo 가입 금액 `1,000,000원`을 고정 순서로 표시한다. Demo 내부
checkbox는 선택적인 내용 확인 표시이며 `btn-final-approve` 활성화
조건이 아니다. enabled approve 버튼은 `data-ddd-policy="final-confirmation"`을
유지한다. Production 통합에서 C는 해당 버튼을 자동 CLICK하지 않고
Frontend 최종 승인을 기다린다. Backend는 Frontend checkbox 선택과 별도
approve Action을 검증한 후에만 pending final CLICK을 exactly-once로
실행한다. 거절은 pending CLICK과 완료 화면 이동을 실행하지 않는다.

`DEPOSIT_COMPLETED`는 사용자 확인 UI 절차가 끝났다는 Demo 안내만 제공한다.
실제 예금 가입, 금융기관 처리, 인증 결과, 잔액 변경, 거래번호나 영수증을
생성하지 않는다. 정상 직접 URL 접근은 DOM 계약 확인용이며 선행 단계의 완료를
증명하지 않는다.

## 15. D1 완료 체크리스트

- [x] 예금 전체 화면 흐름 존재
- [x] 계좌이체 전체 화면 흐름 존재
- [x] 위험 경고 흐름 존재
- [x] 모든 예정 화면의 URL 정의
- [x] D3 구현 URL 구분
- [x] 요소 ID 접두사 규칙 정의
- [x] Playwright용 고정 ID 예시 정의
- [x] 민감정보 DOM 처리 원칙 정의
