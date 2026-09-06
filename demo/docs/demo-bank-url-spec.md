# 데모 금융사이트 URL 규격

## 1. 기본 원칙

- URL은 데모 금융사이트 내부 화면을 식별하며 실제 금융회사 도메인과 연결되지 않는다.
- 화면 ID 하나당 대표 URL 하나를 사용한다.
- 직접 접근이 허용되지 않는 화면은 앞 단계에서 필요한 선택 정보가 없으면 `HOME` 또는 해당 흐름의 첫 화면으로 안내한다.
- 보안 입력, 최종 확인과 완료 화면은 선행 단계의 데모 세션 상태가 있을 때만 접근한다.
- D3에서는 메인, 예금 상품 목록, 출금 계좌 선택의 정적 화면만 구현한다.
- 나머지 URL은 D6 이후에 구현한다.

## 2. URL 목록

| URL | 화면 ID | 설명 | 직접 URL 접근 허용 여부 | D3 구현 여부 | 이후 구현 일차 |
| --- | --- | --- | --- | --- | --- |
| `/` | `HOME` | 데모 메인과 업무 시작점 | 허용 | 예 | D3 |
| `/risk-warning` | `RISK_WARNING` | 위험 요청 차단과 안전 안내 | 허용 | 아니오 | D6 이후 |
| `/deposit/products` | `DEPOSIT_PRODUCT_LIST` | 예금 상품 후보 목록 | 허용 | 예 | D3 |
| `/deposit/products/:productId` | `DEPOSIT_PRODUCT_DETAIL` | 선택한 예금 상품 상세 | 유효한 `productId`에 한해 허용 | 아니오 | D6 이후 |
| `/deposit/conditions` | `DEPOSIT_CONDITIONS` | 가입 금액과 기간 설정의 개념 경로 | D7 구현은 유효한 `productId` 필요 | 아니오 | D7 |
| `/deposit/terms` | `DEPOSIT_TERMS` | 필수·선택 약관 개별 선택의 개념 경로 | D8 구현은 유효한 `productId` 필요 | 아니오 | D8 |
| `/deposit/secure/password` | `DEPOSIT_PASSWORD` | 예금 가입용 계좌 비밀번호 직접 입력 | 불가: 약관 동의 필요 | 아니오 | D6 이후 |
| `/deposit/confirmation/:productId` | `DEPOSIT_CONFIRMATION` | 예금 가입 내용 최종 확인 | D27 화면·DOM 계약 확인용 직접 접근 허용 | 아니오 | D27 |
| `/deposit/completed/:productId` | `DEPOSIT_COMPLETED` | 예금 가입 시연 완료 | D27 화면·DOM 계약 확인용 직접 접근 허용 | 아니오 | D27 |
| `/transfer/accounts` | `TRANSFER_ACCOUNT_SELECTION` | 출금 계좌 후보 선택 | 허용 | 예 | D3 |
| `/transfer/recipients` | `TRANSFER_RECIPIENT_SELECTION` | 수취인 후보 선택의 개념 경로 | D9 구현은 유효한 Mock `accountId` 필요 | 아니오 | D9 |
| `/transfer/amount` | `TRANSFER_AMOUNT` | 송금 금액 입력의 개념 경로 | D10 구현은 유효한 Mock `accountId`와 `recipientId` 필요 | 아니오 | D10 |
| `/transfer/secure/password` | `TRANSFER_PASSWORD` | 이체용 계좌 비밀번호 직접 입력 | D11 구현은 화면 계약 확인용 직접 접근 허용 | 아니오 | D11 |
| `/transfer/secure/otp` | `TRANSFER_OTP` | OTP 직접 입력의 개념 경로 | D12 구현은 화면·DOM 계약 확인용 직접 접근 허용 | 아니오 | D12 |
| `/transfer/confirmation` | `TRANSFER_CONFIRMATION` | 송금 내용 최종 확인 | D13 구현은 화면·DOM 계약 확인용 직접 접근 허용 | 아니오 | D13 |
| `/transfer/completed` | `TRANSFER_COMPLETED` | 송금 시연 완료 | D14 구현은 화면·DOM 계약 확인용 직접 접근 허용 | 아니오 | D14 |

## 3. D3 구현 URL

D3 정적 화면 구현 범위는 다음 세 URL로 한정한다.

- `/`
- `/deposit/products`
- `/transfer/accounts`

이 단계에서는 URL 간 정적 이동만 제공하며 실제 예금 가입, 송금, 인증이나 외부 금융사이트 연결을 구현하지 않는다.

## 4. 화면 ID 연결 확인

| 구분 | 화면 수 | 연결 상태 |
| --- | ---: | --- |
| 공통 | 2 | `HOME`, `RISK_WARNING` 모두 URL 연결 |
| 예금 | 7 | `DEPOSIT_PRODUCT_LIST`부터 `DEPOSIT_COMPLETED`까지 모두 URL 연결 |
| 계좌이체 | 7 | `TRANSFER_ACCOUNT_SELECTION`부터 `TRANSFER_COMPLETED`까지 모두 URL 연결 |
| 합계 | 16 | 모든 예정 화면 ID에 대표 URL 존재 |

## 5. D7 예금 가입 금액 경로 구체화

D1의 `/deposit/conditions`는 예금 가입 조건 입력 단계를 나타내는 개념
경로로 유지한다. D7 구현에서는 별도 전역 상태나 저장소 없이 선택 상품
문맥을 안전하게 전달하기 위해 공개 Mock 상품 ID를 pathname에 추가한다.

- `/deposit/conditions/deposit-12m`
- `/deposit/conditions/deposit-preferred`
- 구현 형식: `/deposit/conditions/:productId`

가입 금액은 URL에 포함하지 않는다. query parameter, `localStorage`,
`sessionStorage`도 사용하지 않는다. 알려진 Mock 상품 ID에 한해서만 금액
입력 화면을 표시하며 `/deposit/conditions`, 잘못된 상품 ID와 예상하지
않은 추가 segment는 NotFound 화면으로 처리한다.

## 6. D8 예금 약관 경로 구체화

D1의 `/deposit/terms`는 예금 약관 선택 단계를 나타내는 개념 경로로
유지한다. D8 구현에서는 공개 Mock 상품 식별자만 pathname에 추가한다.

- `/deposit/terms/deposit-12m`
- `/deposit/terms/deposit-preferred`
- 구현 형식: `/deposit/terms/:productId`

가입 금액은 URL에 포함하지 않으며 query parameter, `localStorage`와
`sessionStorage`도 사용하지 않는다. 알려진 Mock 상품 ID의 약관 URL은
직접 접근할 수 있지만 모든 약관은 미선택 상태로 시작한다. 직접 접근한
화면은 앞 단계 금액 입력이 완료되었다고 표시하지 않으며 금액을 표시하지
않는다. `/deposit/terms`, 잘못된 상품 ID와 예상하지 않은 추가 segment는
NotFound 화면으로 처리한다.

## 7. D9 수취인 선택 경로 구체화

D1의 `/transfer/recipients`는 수취인 후보 선택을 나타내는 개념 경로로
유지한다. D9 구현에서는 별도 전역 상태나 브라우저 저장소 없이 출금 계좌
문맥을 전달하기 위해 공개 Mock accountId를 pathname에 추가한다.

- `/transfer/recipients/living-expense`
- `/transfer/recipients/savings`
- 구현 형식: `/transfer/recipients/:accountId`

전체 계좌번호와 마스킹 계좌번호도 URL에 포함하지 않는다. query parameter,
`localStorage`, `sessionStorage`를 사용하지 않는다. 알려진 Mock accountId는
직접 접근할 수 있지만 이전 계좌 화면에서 사용자가 실제로 선택을 완료했다고
표시하지 않는다. `/transfer/recipients`, 잘못된 accountId와 예상하지 않은
추가 segment는 NotFound 화면으로 처리한다. 정상 URL의 trailing slash는
기존 pathname 정규화 규칙으로 허용한다.

## 8. D10 이체 금액 경로 구체화

D1의 `/transfer/amount`는 이체 금액 입력 단계를 나타내는 개념 경로로
유지한다. D10 구현에서는 전역 상태나 브라우저 저장소 없이 출금 계좌와
수취인 문맥을 복원하기 위해 공개 Mock ID 두 개를 pathname에 추가한다.

- 구현 형식: `/transfer/amount/:accountId/:recipientId`
- `/transfer/amount/living-expense/hong-gildong`
- `/transfer/amount/living-expense/demo-saved`
- `/transfer/amount/savings/hong-gildong`
- `/transfer/amount/savings/demo-saved`

pathname에는 공개 Mock accountId와 recipientId만 포함한다. 이체 금액,
잔액, 전체 또는 마스킹 계좌번호와 수취인 금융정보는 포함하지 않는다.
query parameter, `localStorage`와 `sessionStorage`도 사용하지 않는다.

알려진 두 ID의 조합은 직접 접근할 수 있지만, 화면은 URL에서 Mock 문맥을
확인했다고만 표시하고 이전 화면에서 사용자가 선택·확인을 완료했다고
주장하지 않는다. base 경로만 있는 경우, ID가 누락되거나 알려지지 않은
경우, 추가 segment와 canonical 경로가 아닌 encoding은 NotFound로
처리한다. 정상 URL의 trailing slash는 기존 pathname 정규화로 허용한다.

## 9. D11 이체 비밀번호 경로 구체화

D1 개념 경로 `/transfer/secure/password`를 유지하면서 공개 Mock 계좌와
수취인 문맥을 복원하기 위해 다음 형식으로 구체화한다.

```text
/transfer/secure/password/:accountId/:recipientId
```

정상 URL은 다음 네 조합과 각 trailing slash다.

- `/transfer/secure/password/living-expense/hong-gildong`
- `/transfer/secure/password/living-expense/demo-saved`
- `/transfer/secure/password/savings/hong-gildong`
- `/transfer/secure/password/savings/demo-saved`

pathname에는 공개 Mock accountId와 recipientId만 포함한다. 이체 금액,
비밀번호, 완료·인증 상태, 잔액, 계좌번호와 수취인 금융정보는 pathname,
query와 hash에 포함하지 않는다.

알려진 조합의 직접 접근은 D11 화면과 보안 DOM 계약을 확인하기 위한 Mock
예외로 허용한다. 직접 접근 시 이전 금액 입력·확인, 사용자 인증 또는
자동화 중단이 완료됐다고 표시하지 않는다. 누락 segment, 알려지지 않은 ID,
추가 segment와 canonical path에 맞지 않는 encoding은 NotFound로 처리한다.

## 10. D12 이체 OTP 경로 구체화

D1 개념 경로 `/transfer/secure/otp`를 유지하면서 공개 Mock 계좌와 수취인
문맥만 복원하기 위해 다음 형식으로 구체화한다.

```text
/transfer/secure/otp/:accountId/:recipientId
```

정상 URL은 다음 네 조합과 각 trailing slash다.

- `/transfer/secure/otp/living-expense/hong-gildong`
- `/transfer/secure/otp/living-expense/demo-saved`
- `/transfer/secure/otp/savings/hong-gildong`
- `/transfer/secure/otp/savings/demo-saved`

pathname에는 공개 Mock accountId와 recipientId만 포함한다. 이체 금액,
비밀번호, OTP, 계좌번호, 잔액, 완료·인증 상태와 실제 고객정보는 pathname,
query와 hash에 포함하지 않는다.

알려진 조합의 직접 접근은 D12 화면과 보안 DOM 계약을 확인하기 위한 Mock
예외다. 직접 접근 시 이전 비밀번호 입력 완료나 실제 인증 완료를 주장하지
않는다. 누락 segment, 알려지지 않은 ID, 추가 segment와 canonical path에
맞지 않는 encoding은 NotFound로 처리한다.

## 11. D13 이체 최종 확인 경로 구체화

D1 개념 경로 `/transfer/confirmation`을 유지하면서 공개 Mock 계좌와 수취인
문맥만 복원하기 위해 다음 형식으로 구체화한다.

```text
/transfer/confirmation/:accountId/:recipientId
```

정상 URL은 다음 네 조합과 각 trailing slash다.

- `/transfer/confirmation/living-expense/hong-gildong`
- `/transfer/confirmation/living-expense/demo-saved`
- `/transfer/confirmation/savings/hong-gildong`
- `/transfer/confirmation/savings/demo-saved`

pathname에는 공개 Mock accountId와 recipientId만 포함한다. 이체 금액,
비밀번호, OTP, 계좌번호, 잔액, 인증·입력 완료 상태, 사용자 승인 상태와
거래 결과는 pathname, query와 hash에 포함하지 않는다.

알려진 조합의 직접 접근은 D13 최종 확인 화면과 DOM Gate를 확인하기 위한
Mock 예외다. 직접 접근은 앞 단계 입력·인증·승인 완료를 증명하지 않는다.
누락 segment, 알려지지 않은 ID, 추가 segment와 canonical path에 맞지 않는
encoding은 NotFound로 처리한다.

## 12. D14 이체 데모 완료 경로 구체화

D1 개념 경로 `/transfer/completed`를 유지하면서 공개 Mock 계좌와 수취인
문맥만 복원하기 위해 다음 형식으로 구체화한다.

```text
/transfer/completed/:accountId/:recipientId
```

정상 URL은 다음 네 조합과 각 trailing slash다.

- `/transfer/completed/living-expense/hong-gildong`
- `/transfer/completed/living-expense/demo-saved`
- `/transfer/completed/savings/hong-gildong`
- `/transfer/completed/savings/demo-saved`

pathname에는 공개 Mock accountId와 recipientId만 포함한다. 금액, 사용자
승인·인증 상태, 실제 거래 결과, 거래번호, 잔액, 계좌번호와 보안 입력은
pathname, query와 hash에 포함하지 않는다.

알려진 조합의 직접 접근은 D14 화면과 DOM 계약 확인용 Mock 예외다. URL은
이전 checkbox 선택, 사용자 승인, 실제 인증과 송금을 증명하지 않는다.
누락 segment, 알려지지 않은 ID, 추가 segment와 canonical path에 맞지 않는
encoding은 NotFound로 처리한다.

## 13. D15 예금 비밀번호 경로 구체화

D1 개념 경로 `/deposit/secure/password`를 유지하면서 공개 Mock 상품 문맥만
복원하기 위해 다음 형식으로 구체화한다.

```text
/deposit/secure/password/:productId
```

정상 URL은 다음 두 경로와 각 trailing slash다.

- `/deposit/secure/password/deposit-12m`
- `/deposit/secure/password/deposit-preferred`

pathname에는 공개 Mock `productId`만 포함한다. 가입 금액, 약관 선택·확인
상태, 비밀번호, 인증 상태, 계좌번호와 실제 고객정보는 pathname, query,
hash 또는 브라우저 저장소에 포함하지 않는다.

알려진 상품의 직접 접근은 D15 화면과 보안 DOM 계약 확인용 Mock 예외다.
URL은 이전 약관 확인이나 실제 인증·가입을 증명하지 않는다. `productId`
누락, 알려지지 않은 상품, 추가 segment와 canonical path에 맞지 않는 encoding은
NotFound로 처리한다. 기존 pathname 정규화 정책에 따라 정상 trailing slash는
허용한다.

## 14. D27 예금 최종 확인·완료 경로 구체화

D27은 공개 Mock 상품 ID를 pathname에 포함해 다음 경로를 제공한다.

- `/deposit/confirmation/deposit-12m`
- `/deposit/confirmation/deposit-preferred`
- `/deposit/completed/deposit-12m`
- `/deposit/completed/deposit-preferred`
- 구현 형식: `/deposit/confirmation/:productId`, `/deposit/completed/:productId`

정상 직접 접근은 화면과 DOM 계약 확인용이다. 이전 약관 동의, 보안 입력 완료,
최종 승인 완료를 증명하지 않는다. 알려진 Mock 상품 ID만 허용하고 누락되거나
알 수 없는 ID 및 추가 segment는 NotFound로 처리한다. pathname, query와
storage에는 비밀번호, 인증정보, 계좌번호와 승인 상태를 저장하지 않는다.
