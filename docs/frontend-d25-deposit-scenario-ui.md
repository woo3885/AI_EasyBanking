# 메인 프론트 D25 정기예금 시나리오 UI

## 목표와 완료 경계

D25는 Dashboard에서 정기예금 업무를 시작한 뒤 production 세션의 Frame, 상태, 사용자 결정 이벤트를 기존 통합 화면으로 표시한다. 상품과 약관은 사용자가 직접 선택하고 별도 확인하며, 비밀번호 화면의 `SECURE_INPUT_REQUIRED`에서 안전하게 중단한다.

완료 흐름은 다음과 같다.

```text
Dashboard
→ /deposit/products 세션 생성
→ PRODUCT_SELECTION
→ 상품 상세와 가입 금액 조건
→ TERMS_AGREEMENT
→ 비밀번호 화면
→ SECURE_INPUT_REQUIRED
→ 보호 상태 유지
```

## Dashboard 요청 계약

예금 업무 카드에는 다음 데모 요청을 선택 전에 표시한다.

```text
100만 원으로 정기예금 가입 절차를 시작해 주세요.
```

`createDashboardSessionRequest()`는 화면에 표시한 `DashboardTaskOption.userRequest`를 그대로 Backend session 생성 요청에 전달한다. Frontend는 `12개월`이나 특정 상품을 숨겨 추가하지 않는다.

- 가입 금액의 authoritative source: 사용자가 화면에서 확인한 `userRequest`
- 상품의 authoritative source: `PRODUCT_SELECTION`에서 사용자가 제출한 Backend option
- 기간의 authoritative source: Backend가 선택 상품과 canonical 상세 URL·DOM·snapshot을 대조한 결과
- 초기 경로: `/deposit/products`

## Production UI 재사용

`SessionIntegrationView`는 D21~D24의 기존 production 통합을 그대로 사용한다.

- Frame: `useSessionFrameIntegration`과 `F2_StreamViewer`
- Workflow 상태·안내·Target: `useSessionStatusIntegration`, `WorkflowStatusPanel`, `F3_SmartOverlay`
- 사용자 결정 제출: `useSessionDecisionIntegration`
- 상품 선택: `UserDecisionPanel`
- 약관 선택: `TermsAgreementPanel`
- 보안 입력 상태: `SecureInputPanel`

상품 option과 약관은 Backend 순서를 유지한다. 초기 자동 선택, 선택 즉시 제출, 추천 상품 선택, 약관 전체 자동 동의는 수행하지 않는다. 결정 제출 ACK 후에는 완료로 간주하지 않고 다음 production event를 기다린다.

## 보안 입력 경계

`SECURE_INPUT_REQUIRED`에서는 일반 Workflow panel 대신 `SecureInputPanel`을 표시해 live region 중복을 막는다. 마지막으로 수신한 안전 Frame은 계속 표시하지만 Viewer Action과 Target은 차단한다.

- 메인 프론트에 비밀번호·OTP input을 만들지 않는다.
- 완료 요청 버튼은 실제 `disabled` 상태다.
- `completionRequested=false`, `isBusy=false`를 유지한다.
- secure 완료 transport와 자동 resume을 만들지 않는다.
- 화면 캡처와 자동 안내가 중단됐음을 알린다.
- 인증 성공이나 예금 가입 완료를 표시하지 않는다.

## 접근성

- 페이지의 기존 단일 `h1` 구조를 유지한다.
- 상품은 native radio, 약관은 native checkbox, 확인은 native button을 사용한다.
- 주요 확인 버튼은 기존 56px 높이와 `focus-visible` 스타일을 유지한다.
- 필수 약관 미선택과 secure 완료 미지원에는 실제 `disabled`를 사용한다.
- option 상태는 텍스트와 checked 상태로 함께 전달한다.
- secure 상태에는 하나의 `role="status"` 발표자만 둔다.
- 자동 focus 이동을 추가하지 않는다.

## D26·D27 이관 범위

다음 기능은 D25에서 구현하지 않는다.

- 보안 입력 완료 요청 전송과 secure 상태 해제
- AI·Frame 자동 재개
- 비밀번호·OTP 자동 입력
- 최종 승인·거절
- 예금 가입 완료와 실제 금융거래
- STT·TTS 및 Main Controller의 production secure capability 연동

## 검증 범위

Frontend 단위·UI 테스트와 production build로 Dashboard 요청, 상품·약관 직접 선택, secure 보호 UI, Viewer Action·Target 차단을 검증한다. Backend·AI Engine·Demo·Frontend를 동시에 실행한 공동 브라우저 E2E는 별도의 통합 환경에서 확인해야 한다.
