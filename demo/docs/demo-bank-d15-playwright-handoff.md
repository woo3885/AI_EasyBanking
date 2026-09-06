# 데모뱅크 D15 Playwright 인수인계

## 1. 목적과 범위

D15는 예금 약관 확인 뒤 사용자가 계좌 비밀번호를 직접 입력하는 보안 입력
화면과 DOM 계약을 제공한다. 실제 인증, 예금 가입, 잔액 변경, 최종 승인,
API와 WebSocket 통신은 수행하지 않는다.

## 2. URL과 상태 경계

정상 URL은 다음과 같다.

- `/deposit/secure/password/deposit-12m`
- `/deposit/secure/password/deposit-preferred`
- 위 두 URL의 trailing slash

pathname에는 공개 Mock `productId`만 포함한다. 가입 금액, 약관 선택·확인
상태, 비밀번호, 인증 상태, 계좌번호와 고객정보는 URL, query, hash 또는
storage에 넣지 않는다.

알려진 상품의 직접 접근은 화면·DOM 계약 확인용 예외다. 직접 접근은 이전
약관 확인, 실제 인증 또는 예금 가입 진행을 의미하지 않는다. ID 누락,
unknown 상품, 추가 segment와 비정규 encoding은 NotFound 대상이다.

## 3. 약관 Gate

사용자가 필수 약관을 모두 선택한 뒤 기존 `btn-deposit-terms-confirm`을
눌러야 별도 `btn-deposit-terms-next`가 활성화된다. 선택 약관을 포함한 어떤
약관이든 변경하면 확인 결과와 다음 Gate가 초기화된다. 체크박스 선택이나
확인 버튼만으로 자동 이동하지 않는다.

## 4. 보안 입력 DOM 계약

- 페이지: `page-deposit-password`
- 상품명: `summary-deposit-password-product-name`
- 상품 기간: `summary-deposit-password-product-period`
- 보안 안내: `notice-deposit-secure-input`
- input: `input-account-password`
- 입력 상태: `status-deposit-password-input`
- 완료 상태: `status-confirmed-deposit-password`
- 완료 버튼: `btn-secure-input-complete`
- 약관 복귀: `btn-deposit-terms-back`
- 데모 흐름 나가기: `btn-deposit-password-cancel`

자동화 대상은 `id`와 `data-testid`가 같다. input은 label과 연결된
uncontrolled native `type="password"`이며 `autocomplete="off"`,
`data-ddd-policy="secure-input"`을 제공한다. React에는 원문이나 길이가 아닌
`EMPTY | ENTERED | COMPLETION_RECORDED`만 저장한다. 사용자가 완료 버튼을
누르면 DOM 값을 즉시 제거하고 input 자체를 DOM에서 제거하며 실제 인증
성공을 표시하지 않는다.

## 5. 자동 검증 가능 항목

- 정상·오류 URL의 화면 또는 NotFound DOM
- 페이지, 상품명과 기간 selector
- input의 존재, type, autocomplete와 `data-ddd-policy`
- label과 `aria-describedby`
- 초기 `EMPTY` 안내와 완료 버튼 disabled
- 보안 안내, 약관 복귀와 데모 흐름 나가기 버튼
- URL, source와 bundle에 민감정보 및 API·WebSocket·storage·로그 부재

HTTP 200은 SPA fallback일 수 있으므로 화면 루트 또는 NotFound DOM을 함께
검증해야 한다.

## 6. 자동화 금지 항목

보안 input에 Playwright `fill()`, `type()`, `pressSequentially()` 또는
`evaluate()` 값 주입·읽기를 사용하지 않는다. 완료 버튼 자동 클릭, 실제
비밀번호 사용, 입력 후 screenshot·trace·video·snapshot·DOM value 기록,
자동 인증 성공 처리와 사용자 개입 없는 자동화 재개도 금지한다.

## 7. 사용자 수동 검증

screenshot, trace, video와 console 수집을 끈 뒤 실제 금융 비밀번호가 아닌
데모용 임의 값을 사용한다. 입력 후 완료 버튼 활성화, 완료 시 password input과
`[data-ddd-policy="secure-input"]` 제거, 완료 버튼 비활성화와
`status-confirmed-deposit-password[data-ddd-secure-state="completed"]`, 실제
인증을 주장하지 않는 안내, 약관 화면 복귀와 데모 흐름 나가기를 확인한다.

## 8. 개발자 B 책임

데모페이지는 `data-ddd-policy="secure-input"` 신호만 제공한다. 개발자 B는
이를 감지해 `SECURE_INPUT_REQUIRED`로 전환하고 자동 입력과 AI·DOM·프레임·
screenshot·trace·video 수집을 중단해야 한다. 원문 없는 완료 신호 처리와
안전한 자동화 재개는 아직 후속 통합 범위다.

## 9. D26 완료 상태 계약

두 지원 상품 URL 모두 같은 생명주기를 사용한다.

1. 완료 전에는 password input과 `data-ddd-policy="secure-input"`이 존재하고
   완료 마커는 없다.
2. 사용자가 `btn-secure-input-complete`를 직접 누르면 DOM 원문을 먼저 지운다.
3. 상태를 `COMPLETION_RECORDED`로 전환하여 input을 DOM에서 제거한다.
4. 기존 안전 상태 요소에만 `data-ddd-secure-state="completed"`를 표시한다.
5. 완료 버튼을 비활성화하고 `입력 완료 요청됨`으로 상태를 알린다.

완료 마커는 인증·가입·거래 성공이 아니다. Backend는 secure-input 요소 부재와
완료 마커를 함께 확인하고 별도 정책에 따라 처리해야 한다. D26은 자동 완료,
자동 이동, 캡처 재개를 구현하지 않으며 최종 승인은 D27 이후 별도 단계다.
