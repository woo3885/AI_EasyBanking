# D28 최종 확인 동시성·trace 계약

D28의 authoritative 승인 gate는 Frontend `FinalConfirmationPanel` 하나로 통일한다. Demo 최종
화면은 C가 안전하게 탐지할 수 있는 enabled final target을 제공하며, Backend는 기존 pending
target을 사용자 승인 전에는 실행하지 않는다. Demo 내부 checkbox를 위한 자동 선택, polling,
독자 retry 또는 Agent Loop 재개는 추가하지 않는다.

Backend 승인·거절 endpoint가 같은 confirmation에 동시에 도착하면 session별 active latch를 먼저
consume한 단 하나의 요청만 수락한다. 다른 요청은 confirmation 전용 conflict로 종료하며 final
CLICK은 최대 한 번만 실행한다. 승인과 거절 어느 쪽이 이기더라도 latch와 reconnect confirmation
snapshot은 남지 않는다.

통합 trace harness는 한 session에서 다음 identity 연결을 검증한다.

1. source Frame의 `frameId/frameSequence`
2. `CONFIRMATION_REQUIRED`의 confirmation 및 snapshot identity
3. 승인 ACK의 request/confirmation/source Frame identity
4. final CLICK 이후 강제로 증가한 새 Frame identity
5. `CONFIRMATION_RESOLVED`와 `CONFIRMATION_CLEAR`의 동일 confirmation identity
6. 단조 증가하는 `eventSequence`와 clear된 latest snapshot

이 harness는 raw DOM, selector, 보안 입력값 또는 내부 URL을 trace에 저장하지 않는다.
