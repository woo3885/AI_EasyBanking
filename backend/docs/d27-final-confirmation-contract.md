# D27 예금 가입 최종 확인 계약

AI Engine은 `REQUEST_FINAL_CONFIRMATION`, `FINAL_CONFIRMATION_REQUIRED`,
`DEPOSIT_SUBSCRIPTION`, 현재 `sourceSnapshotId`, 현재 Snapshot의
`confirmationTargetElementId`를 반환한다. `elementId`를 포함한 일반 Action payload는 비운다.

Backend는 응답의 상태·type·snapshot·target 정책을 검증하고 `confirmationId`와 안전한
가입 요약을 생성한다. active confirmation에는 ID, type, pending target, source snapshot,
`sourceFrameId`, `sourceFrameSequence`, summary를 저장한다. 가입 요약은 상품명·가입 기간·금액이
모두 안전한 형식이어야 하며 민감정보가 감지되거나 필드가 누락되면 fail-closed한다.
HTML/script, 모든 ISO 제어문자, password/비밀번호, OTP/인증번호/PIN 및 금액 토큰 외의
구분자 없는 10~12자리 계좌번호를 허용하지 않는다. 세 필드 중 하나라도 위반하면 일부 필드만
제외해 이벤트를 만들지 않고 confirmation 전체 생성을 중단한다.

상품 선택 시 검증한 `productId`와 상세 화면에서 확인한 `productName/productPeriod`, 금액
화면에서 확인한 `amount`는 세션별 authoritative context로 보존한다. final confirmation
snapshot은 `/deposit/confirmation/:productId`의 semantic DOM 네 필드와 이 context가 모두
일치할 때만 `PageSnapshot`에 값을 싣는다. 직접 URL 접근, 이전 상품/금액과 다른 DOM,
누락된 이전 context는 summary 생성 전에 fail-closed한다.

승인/거절 요청은 아래 필드를 모두 보낸다.

- `requestId`: 1~100자, 승인/거절 처리의 exactly-once key
- `confirmationId`: 현재 active confirmation ID
- `approved`: confirm endpoint는 `true`, reject endpoint는 `false`
- `expectedFrameId`: 사용자가 확인한 Viewer frame ID
- `expectedSequence`: 사용자가 확인한 Viewer frame sequence(1 이상)

Backend는 `expectedFrameId/expectedSequence`가 active confirmation의 source frame 및 요청
시점의 current frame과 모두 일치할 때만 처리한다. 어느 하나라도 다르면 승인과 거절을 모두
fail-closed하며 active confirmation은 유지한다. 같은 `requestId`는 재실행하지 않는다.
승인 API는 위 검증 후 pending final target을 한 번만 실행한다. 거절과 terminal 상태에서는
latch와 UI snapshot을 제거한다.

승인·거절 endpoint는 session domain을 노출하지 않고 `ConfirmationActionResponse`만
반환한다. 응답에는 URL과 동일한 `sessionId`, 원문 `requestId`, active latch의
`confirmationId`, `sourceFrameId/sourceFrameSequence`, `APPROVAL_ACCEPTED` 또는
`REJECTION_ACCEPTED`가 포함된다. ACK는 요청 접수 결과이며 거래 완료를 의미하지 않는다.

공개 summary는 DOM 표시 순서를 유지하는 `transactionType/items` 구조이다. item 순서는
`product-name`, `deposit-amount`, `deposit-period`이고 각 항목은 공개 kebab-case `id`, 고정
`label`, authoritative `value`를 가진다. 중복·누락·빈 값·길이 초과·HTML·제어문자·credential·
주민등록번호·전화번호·미마스킹 계좌번호·내부 selector/element/session 식별자가 하나라도
감지되면 summary 전체를 폐기한다. 금액과 기간은 재계산하지 않는다.

UI event는 `CONFIRMATION_REQUIRED`, `CONFIRMATION_RESOLVED`,
`CONFIRMATION_REJECTED`, `CONFIRMATION_CLEAR`를 사용하며 reconnect snapshot은 active
confirmation만 복원한다. C와 B가 공유할 canonical fixture는
`src/test/resources/contracts/d27-final-confirmation-*.json` 세트이다.

required event는 summary를 포함하고 resolved/rejected/clear event는 동일한
`confirmationId`, `confirmationType`, `sourceSnapshotId`, `frameId`, `frameSequence` identity를
포함한다. 내부 `confirmationTargetElementId`는 wire에 노출하지 않는다. clear identity는 latch
제거 전에 복사하며 secure input, risk warning, cancelled, error, terminated, completed 전환 시
clear event를 새 상태 event보다 먼저 발행한다.

active latch timeout은 `ddd.final-confirmation.timeout`으로 설정하며 기본값은 5분이다.
WebSocket disconnect만으로 latch를 제거하지 않으므로 제한 시간 안의 reconnect snapshot 복원이
가능하다. 최종 만료 시 pending target과 snapshot을 제거하고 identity clear 및 안전한 ERROR
안내를 발행한다. timeout task는 consume/clear/session 제거 시 취소하며 만료 후 자동 승인·retry·
재활성화는 하지 않는다.

승인 consume 이후 Action 실패는 retry나 latch 재활성화 없이 identity clear 후 ERROR로 전환한다.
Action 성공 뒤 Frame capture/send가 실패하면 CLICK을 재실행하지 않고
`CONFIRMATION_FRAME_CAPTURE_FAILED`로 구분한다. confirmation 오류는
`CONFIRMATION_*` 전용 application code를 사용하며 응답·로그에 selector, DOM, 내부 URL 또는
민감정보를 포함하지 않는다.
