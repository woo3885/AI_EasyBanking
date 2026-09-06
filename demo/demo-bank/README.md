# 금융길잡이 데모뱅크

## 프로젝트 목적

금융길잡이 데모뱅크는 금융 자동화의 화면 이동, 사용자 직접 선택과 보안 중단 지점을 시연하기 위한 독립 프론트엔드 프로젝트다. 실제 금융회사 시스템과 연결하지 않으며 실제 예금 가입이나 송금을 수행하지 않는다.

## 설치

```bash
cd demo/demo-bank
npm install
```

## 개발 서버 실행

```bash
npm run dev
```

기본 개발 서버 주소는 Vite가 출력하는 로컬 URL을 사용한다.

## 프로덕션 빌드

```bash
npm run build
```

TypeScript 검사가 통과하면 Vite가 `dist/`에 정적 빌드 결과를 생성한다.

## 프로덕션 빌드 미리보기

```bash
npm run preview
```

## D1 규격 문서

D1에서 확정한 화면 흐름, URL과 요소 ID 규격은 상위 `demo/docs`에 있다.

- `../docs/demo-bank-screen-flow.md`
- `../docs/demo-bank-url-spec.md`
- `../docs/demo-bank-element-id-spec.md`

## D3 구현 URL

- `/`
- `/deposit/products`
- `/transfer/accounts`

개발 서버 실행 후 주소창에 각 URL을 직접 입력하거나 상단 개발용 링크로 이동할 수 있다. 경로 끝의 `/` 유무는 같은 화면으로 처리한다.

상단 링크는 세 정적 화면을 개발 중 확인하기 위한 내비게이션이다. 실제 사용자의 업무 시작 버튼과는 별개다.

## D4 업무 시작 이동

- 메인의 `예금 가입 시작` 버튼은 `/deposit/products`로 이동한다.
- 메인의 `계좌이체 시작` 버튼은 `/transfer/accounts`로 이동한다.
- 같은 탭에서 이동하며 브라우저 방문 기록을 남겨 뒤로 가기를 지원한다.
- 상단 링크는 개발 확인용이고 메인 시작 버튼은 사용자의 업무 시작 버튼이다.
- 상품·계좌 선택 버튼은 D4에서는 비활성화된 정적 상태로 유지한다.
- 버튼 이동은 화면 전환만 수행하며 실제 금융거래는 발생하지 않는다.

## D5 Playwright 최소 동작

D5는 개발자 B가 Playwright로 접속하고 고정 selector를 클릭할 수 있는
최소 동작 버전이다.

- 예금 상품 두 개의 선택 버튼을 클릭할 수 있다.
- 출금 계좌 두 개의 선택 버튼을 클릭할 수 있다.
- 선택 버튼의 `aria-pressed`로 현재 선택 상태를 확인할 수 있다.
- 고정 상태 영역에서 사용자에게 보이는 선택 결과를 확인할 수 있다.
- 상품과 계좌는 각 화면에서 하나만 선택되며 다음 화면으로 이동하지 않는다.
- Playwright 전달 규격은 `../docs/demo-bank-d5-playwright-handoff.md`에 있다.
- Playwright 패키지는 이 프로젝트에 설치하지 않는다.
- 예금 다음 단계는 D6 이후, 이체 다음 단계는 D9 이후 구현한다.
- 실제 예금 가입, 계좌이체, API와 WebSocket 통신은 수행하지 않는다.

## D6 예금 상품 상세·가입 조건

D6는 D5의 사용자 직접 상품 선택을 유지하면서 선택 결과를 별도 다음
버튼으로 상세 화면에 연결한다.

- 상품을 선택하기 전에는 `상품 선택 후 다음` 버튼이 비활성화된다.
- 상품 선택 버튼은 선택 상태만 변경하며 URL을 이동하지 않는다.
- 상품 선택 후 다음 버튼을 누르면 선택한 상품의 상세 URL로 이동한다.
- `/deposit/products/deposit-12m`
- `/deposit/products/deposit-preferred`
- 상세 화면은 상품명, 기간, 예시 금리, 최소 가입 금액과 설명을 표시한다.
- 상품과 금리는 데모용 Mock 정보이며 실시간 금융상품 정보가 아니다.
- 실제 가입, 금액 입력, 약관 동의, 비밀번호 입력과 금융거래는 수행하지 않는다.
- 계좌이체 다음 단계는 D9 이후 범위다.

개발자 B의 D6 Playwright 전달 규격은
`../docs/demo-bank-d6-playwright-handoff.md`에 있다.

## D7 예금 가입 금액 입력·검증

D7은 선택한 상품 상세에서 가입 금액 입력 화면으로 이동하는 데모
흐름을 제공한다.

- `/deposit/conditions/deposit-12m`
- `/deposit/conditions/deposit-preferred`
- 12개월 정기예금 최소 가입 금액: `100,000원`
- 우대금리 정기예금 최소 가입 금액: `1,000,000원`
- 입력값은 빈 값, 형식 오류, 0 이하, 최소 금액 미만, 안전 정수 초과와
  유효 상태로 구분한다.
- 유효한 금액은 입력창 아래에 `ko-KR` 원화 형식으로 표시한다.
- 확인 버튼은 유효한 금액에서만 활성화되며 로컬 확인 문구만 표시한다.
- 입력 금액은 URL, 브라우저 저장소, 로그, API와 WebSocket에 저장하거나
  전송하지 않는다.
- 실제 예금 가입, 약관 동의, 보안 입력과 최종 승인은 후속 범위다.

개발자 B의 D7 Playwright selector와 검증 예제는
`../docs/demo-bank-d7-playwright-handoff.md`에 있다. Playwright 패키지는
demo-bank 프로젝트에 설치하지 않는다.

## D8 예금 약관 개별 선택

D8은 D7에서 입력 금액을 로컬로 확인한 뒤 별도 버튼으로 상품별 약관
화면에 이동하는 흐름을 제공한다.

- `/deposit/terms/deposit-12m`
- `/deposit/terms/deposit-preferred`
- 약관은 필수 2개와 선택 1개이며 초기값은 모두 미선택이다.
- 전체 동의 기능 없이 사용자가 각 약관을 직접 선택하거나 해제한다.
- 필수 약관 2개를 모두 선택해야 `약관 선택 확인` 버튼이 활성화된다.
- 선택 약관은 확인 버튼의 필수 조건이 아니다.
- 확인 버튼은 로컬 안내 문구만 갱신하며 URL을 이동하지 않는다.
- D7 입력 금액은 약관 URL, 브라우저 저장소 또는 약관 화면에 전달하거나
  저장하지 않는다.
- 실제 예금 가입, 보안 입력, API와 WebSocket 통신은 수행하지 않는다.
- 비밀번호 입력과 최종 승인은 후속 구현 범위다.

개발자 B의 D8 Playwright selector와 검증 예제는
`../docs/demo-bank-d8-playwright-handoff.md`에 있다. Playwright 패키지는
demo-bank 프로젝트에 설치하지 않는다.

## D9 출금 계좌 다음 Gate와 수취인 선택

D9은 기존 출금 계좌 단일 선택을 별도 다음 버튼으로 수취인 후보 화면에
연결한다.

- 출금 계좌를 선택하기 전에는 `출금 계좌 선택 후 다음` 버튼이
  비활성화된다.
- 계좌 선택 버튼은 선택 상태만 변경하며 URL을 이동하지 않는다.
- 다음 버튼은 공개 Mock accountId만 pathname에 넣어 수취인 화면으로
  이동한다.
- `/transfer/recipients/living-expense`
- `/transfer/recipients/savings`
- 전체 계좌번호와 마스킹 계좌번호도 URL에 포함하지 않는다.
- 수취인 후보는 모두 미선택 상태로 시작하고 사용자가 한 명을 직접
  선택한다.
- 수취인을 선택해야 확인 버튼이 활성화되며 확인은 로컬 안내만 표시한다.
- 수취인 변경 시 이전 확인 안내를 초기화한다.
- 직접 URL 접근은 알려진 Mock accountId에 한해 허용하지만 이전 화면의
  사용자 선택 완료를 주장하지 않는다.
- 실제 고객정보, 이체 금액 입력, API, WebSocket과 실제 송금은 없다.
- 이체 금액 입력은 D10 후속 범위다.

개발자 B의 D9 Playwright selector와 검증 예제는
`../docs/demo-bank-d9-playwright-handoff.md`에 있다. Playwright 패키지는
demo-bank 프로젝트에 설치하지 않는다.

## D10 이체 금액 입력·검증

D10은 수취인을 로컬로 확인한 뒤 별도 Gate를 통해 이체 금액 입력
화면으로 이동하는 Mock 흐름을 제공한다.

- 수취인 선택만으로는 금액 입력 버튼이 활성화되지 않는다.
- `수취인 선택 확인`을 누르면 별도 `이체 금액 입력하기` 버튼이
  활성화된다.
- 수취인을 변경하면 기존 확인과 금액 입력 Gate가 초기화된다.
- 구현 URL 형식은 `/transfer/amount/:accountId/:recipientId`다.
- pathname에는 공개 Mock accountId와 recipientId만 포함한다.
- 이체 금액은 쉼표 없이 직접 입력하며 빈 값, 형식 오류, 0 이하,
  안전 정수 초과와 출금 가능 Mock 잔액 초과를 구분한다.
- 생활비 계좌의 Mock 잔액은 `2,500,000원`, 저축 계좌는
  `10,000,000원`이며 수수료나 별도 이체 한도는 설정하지 않는다.
- 유효한 금액은 `ko-KR` 원화 형식으로 표시하고 확인 버튼으로 로컬
  안내만 갱신한다.
- 금액은 URL, query, 브라우저 저장소, 로그, API와 WebSocket에 저장하거나
  전송하지 않는다.
- 실제 잔액 차감과 송금은 없으며 비밀번호, OTP와 최종 승인은 후속
  범위다.

개발자 B의 D10 selector, 정상·오류 URL과 Playwright 시나리오는
`../docs/demo-bank-d10-playwright-handoff.md`에 있다. Playwright 패키지는
demo-bank 프로젝트에 설치하지 않는다.

## D11 계좌 비밀번호 보안 입력

D11은 이체 금액을 로컬로 확인한 뒤 별도 버튼으로 계좌 비밀번호 보안
입력 화면에 이동하는 Mock 흐름을 제공한다.

- 구현 URL은 `/transfer/secure/password/:accountId/:recipientId`다.
- pathname에는 공개 Mock accountId와 recipientId만 포함한다.
- 이체 금액, 비밀번호, 완료·인증 상태와 금융정보는 URL에 포함하지 않는다.
- 유효 금액을 입력한 것만으로는 비밀번호 시작 버튼이 활성화되지 않는다.
- 현재 금액을 확인한 뒤에만 `비밀번호 입력 시작` 버튼이 활성화된다.
- 금액을 변경하면 확인 상태와 비밀번호 시작 Gate가 초기화된다.
- 비밀번호는 uncontrolled native `type="password"` input에서 사용자가 직접
  입력한다.
- React state에는 비밀번호 원문 대신 `EMPTY` 또는 `ENTERED` 상태만 둔다.
- D1에 자릿수와 숫자 형식이 없어 별도 형식 규칙을 만들지 않는다.
- 입력 완료 시 DOM input 값을 즉시 제거하고 데모 완료 여부만 표시한다.
- 실제 금융 비밀번호를 사용하지 않으며 자동화와 AI는 입력하지 않는다.
- 비밀번호 입력 완료만으로는 OTP 화면으로 이동하지 않으며 D12의 별도
  시작 버튼을 사용한다.
- 실제 인증, 잔액 차감과 송금은 수행하지 않는다.

개발자 B의 D11 DOM 신호, 자동화 중단 기대 계약과 수동 보안 검증 절차는
`../docs/demo-bank-d11-playwright-handoff.md`에 있다. 보안 입력 화면에서는
Playwright 자동 입력, trace, screenshot과 video를 사용하지 않는다.

## D12 OTP 보안 입력

D12는 데모 비밀번호 입력을 로컬에서 완료한 뒤 별도 버튼으로 OTP 보안 입력
화면에 이동하는 Mock 흐름을 제공한다.

- 구현 URL은 `/transfer/secure/otp/:accountId/:recipientId`다.
- URL에는 공개 Mock accountId와 recipientId만 포함한다.
- 이체 금액, 비밀번호, OTP, 계좌번호와 완료·인증 상태는 URL에 포함하지 않는다.
- 비밀번호 완료와 OTP 화면 이동은 별도 버튼으로 분리한다.
- OTP는 uncontrolled native `type="password"` input에서 사용자가 직접 입력한다.
- React state에는 OTP 원문 대신 `EMPTY` 또는 `ENTERED`와 로컬 완료 여부만 둔다.
- D1에 자릿수와 숫자 형식이 확정되지 않아 형식 검증이나 실제 정답을 만들지 않는다.
- 완료 시 DOM 값을 즉시 제거하며 실제 인증 성공을 의미하지 않는다.
- 실제 송금과 거래 최종 확인 화면 이동은 수행하지 않는다.
- 정상 URL 직접 접근은 보안 DOM 계약 확인용이며 이전 비밀번호 완료를 보장하지 않는다.
- `data-ddd-policy="secure-input"` 탐지 이후 자동화·AI·캡처 중단은 개발자 B 책임이다.
- D12 구현을 위해 패키지를 추가하지 않았다.

개발자 B의 selector, 자동화 금지 항목과 수동 검증 절차는
`../docs/demo-bank-d12-playwright-handoff.md`에 있다.

## D13 이체 최종 확인

D13은 OTP 원문을 제거하고 로컬 입력 완료 상태가 된 뒤 별도 버튼으로
최종 확인 Mock 화면에 이동하는 흐름을 제공한다.

- 구현 URL은 `/transfer/confirmation/:accountId/:recipientId`다.
- pathname에는 공개 Mock accountId와 recipientId만 포함한다.
- D10 입력 금액은 저장·전달되지 않으므로 숫자를 임의 생성하지 않고
  `전달되지 않음`으로 표시한다.
- 화면은 실제 거래 요약이 아니라 D1 selector와 사용자 직접 승인 Gate를
  확인하기 위한 Mock이다.
- 최종 승인 checkbox는 초기 미선택이고 승인 버튼은 실제 disabled다.
- 사용자가 checkbox를 선택해야 `btn-final-approve`가 활성화된다.
- 승인 버튼은 `data-ddd-policy="final-confirmation"`을 제공하고 로컬 안내만
  갱신한다.
- 수정 버튼은 동일 Mock 문맥의 금액 입력 화면으로 이동하지만 이전 금액을
  복원하지 않는다.
- 취소 버튼은 로컬 선택과 승인 상태만 초기화하며 거래 취소 API를 호출하지
  않는다.
- 실제 인증, 승인 API, 송금, 잔액 변경, API와 WebSocket은 없다.
- 직접 URL 접근은 이전 금액 입력, 비밀번호·OTP 인증 또는 승인 완료를
  증명하지 않는다.

개발자 B의 selector, 자동화 중단 계약과 수동 승인 검증 절차는
`../docs/demo-bank-d13-playwright-handoff.md`에 있다.

## D14 이체 데모 완료

D14는 D13에서 사용자가 checkbox와 승인 버튼을 직접 조작해 로컬 승인
상태가 된 뒤, 별도 버튼으로 이동하는 데모 안내 흐름 결과 화면이다.

- 구현 URL은 `/transfer/completed/:accountId/:recipientId`다.
- pathname에는 공개 Mock accountId와 recipientId만 포함한다.
- checkbox 선택만으로는 완료 화면 버튼이 활성화되지 않는다.
- 사용자가 `btn-final-approve`를 직접 클릭한 뒤에만
  `btn-transfer-completion-start`가 활성화된다.
- 완료 화면은 데모 흐름과 사용자 승인 UI 절차를 확인했다는 의미다.
- 실제 송금, 잔액 변경, 인증 결과, 거래번호와 영수증은 없다.
- D10 금액은 완료 화면에 전달하거나 임의 생성하지 않는다.
- 정상 직접 접근은 화면·DOM 계약 확인용이며 이전 사용자 승인을 증명하지
  않는다.
- `btn-transfer-home`은 같은 탭에서 데모 메인으로 돌아간다.
- 같은 거래 재실행, API, WebSocket과 실제 금융 Action은 제공하지 않는다.

개발자 B의 selector, 직접 접근 경계와 수동 검증 절차는
`../docs/demo-bank-d14-playwright-handoff.md`에 있다.

## D15 예금 비밀번호 보안 입력

D15는 예금 약관을 로컬로 확인한 뒤 별도 다음 버튼으로 예금 비밀번호 보안
입력 화면에 진입하는 Mock 흐름이다.

- 구현 URL은 `/deposit/secure/password/:productId`다.
- 지원 URL은 `/deposit/secure/password/deposit-12m`과
  `/deposit/secure/password/deposit-preferred`다.
- pathname에는 공개 Mock `productId`만 포함한다.
- 약관 확인 버튼과 `btn-deposit-terms-next` 이동 Gate를 분리한다.
- 약관을 변경하면 확인 결과와 이동 Gate를 함께 초기화한다.
- 정상 직접 접근은 화면·DOM 계약 확인용이며 이전 약관 확인이나 실제 인증을
  증명하지 않는다.
- 비밀번호는 uncontrolled native input에서 사용자가 직접 입력한다.
- React에는 원문이나 길이 대신
  `EMPTY | ENTERED | COMPLETION_RECORDED`만 저장한다.
- 입력 완료 시 DOM 값을 즉시 제거하고 보안 input 자체를 DOM에서 제거한다.
  기존 안전 상태 요소에 `data-ddd-secure-state="completed"`를 표시하지만 실제
  인증·가입·잔액 변경은 수행하지 않는다.
- `data-ddd-policy="secure-input"` 탐지 이후 자동화·AI·캡처 중단과 안전한
  재개는 개발자 B의 후속 통합 책임이다.

Playwright DOM 계약, 자동화 금지 사항과 수동 검증 절차는
`../docs/demo-bank-d15-playwright-handoff.md`에 있다.

## D26 보안 입력 완료 상태

D26은 예금 비밀번호, 이체 비밀번호와 OTP Mock의 완료 생명주기를 통일한다.
완료는 사용자의 직접 클릭으로만 기록되고 원문 제거 뒤 secure input이 DOM에서
사라진다. 완료 마커는 안전한 상태 요소에만 표시되며 인증이나 거래 성공을
뜻하지 않는다. Backend는 secure-input 요소 부재와 완료 마커를 함께 검증해야
한다. 다음 화면 이동은 기존 별도 사용자 버튼을 유지하며 D26에서 자동화하지
않는다. 최종 승인·거절과 Demo 완료 안내는 D27에 구현한다.

## D27 예금 최종 확인·Demo 완료

D27은 예금 비밀번호 완료 뒤 사용자가 별도 버튼으로 최종 확인 화면에 진입하고,
상품명·가입 금액·가입 기간을 확인한 뒤 직접 승인 또는 거절하는 Mock 흐름이다.

- 최종 확인: `/deposit/confirmation/:productId`
- Demo 완료: `/deposit/completed/:productId`
- 지원 상품 ID: `deposit-12m`, `deposit-preferred`
- 가입 금액은 D25·D27 공동 시나리오 값 `1,000,000원`을 표시한다.
- 가입 기간은 상품 데이터의 `periodLabel`을 사용한다.
- `checkbox-final-confirmation`은 초기 미선택이고 `btn-final-approve`는 실제
  disabled다.
- checkbox 선택만으로 승인되지 않으며 승인 버튼을 직접 눌러야 Demo 완료
  화면으로 이동한다.
- `btn-final-cancel`은 완료 화면에 진입하지 않고 메인으로 돌아간다.
- 승인 버튼은 `data-ddd-policy="final-confirmation"`을 제공한다.
- 완료 화면은 UI 절차 종료 안내일 뿐 실제 금융기관 가입, 인증, 잔액 변경,
  거래번호 또는 영수증을 생성하지 않는다.

Playwright selector, 요약 DOM 순서, 자동화 중단 규칙과 수동 검증 절차는
`../docs/demo-bank-d27-playwright-handoff.md`에 있다.

## D3 Mock 데이터

- 예금 상품: 12개월 정기예금, 우대금리 정기예금
- 출금 계좌: 생활비 계좌, 저축 계좌
- 계좌번호는 마스킹된 예시만 사용
- 금액은 `ko-KR` 형식으로 표시

Mock 데이터는 `src/data/demo-data.ts`에서 관리한다.

## 요소 ID 규격

페이지, 개발용 링크, 상품·계좌 카드와 정적 버튼에는 `../docs/demo-bank-element-id-spec.md`의 고정 ID 규칙을 적용한다. 자동화 대상 요소는 `id`와 동일한 `data-testid`를 사용한다.

## 현재 구현 범위

D27은 세 기본 화면, 메인 업무 이동, 상품·출금 계좌의 로컬 단일 선택,
예금 상품 상세, 가입 금액 로컬 검증, 예금 약관 개별 선택과 수취인 로컬
선택·확인, 이체 금액 로컬 검증, 계좌 비밀번호와 OTP 보안 입력 Mock까지
제공하며 이체 최종 확인 DOM, 사용자 승인 Gate와 별도 데모 완료 화면을
제공한다. 예금 약관 확인 뒤 별도 Gate와 예금 비밀번호 보안 입력 Mock도
포함하고 예금 최종 승인·거절 Gate와 Demo 완료 안내를 제공한다. 실제 예금
가입, 송금, 잔액 차감, 인증, API, WebSocket과 외부 금융사이트 연결은
구현하지 않는다.
