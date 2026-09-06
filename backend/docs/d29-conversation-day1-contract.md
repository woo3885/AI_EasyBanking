# D29 Day 1 대화형 Agent Backend 계약

## 결정

- 3일 MVP는 Demo Bank 동일 Page widget을 사용한다.
- Backend가 headed Playwright BrowserContext/Page와 session ID의 권위를 가진다.
- Browser Extension 배포는 3일 이후 전환 범위로 둔다.
- Agent widget·overlay는 `data-ddd-agent-ui` marker로 구분하고 Day 2 sanitizer에서 제외한다.
- Canvas Viewer는 삭제하지 않고 진단·fallback으로 유지한다.

## 메시지 계약

- 최초 새 계약은 세션 생성 요청의 `requestId`, `messageId`, `content`, `clientOccurredAt`을 사용한다.
- 후속 메시지는 `POST /api/v1/sessions/{sessionId}/messages`로 접수한다.
- ACK는 정제·idempotency 검증·queue 접수만 의미하며 AI 판단이나 Action 성공을 의미하지 않는다.
- Backend가 `sessionId`, 질문 ID, event ID, sequence와 goal revision의 권위를 가진다.
- Frontend가 `requestId`와 user `messageId`를 생성하고 Backend가 검증한다.
- C 응답은 user message ID를 `requestMessageId`로 echo하며 assistant message ID를 생성하지 않는다.
- C의 `goalRevision`은 증가값이 아니라 판단 기준인 `baseGoalRevision`이다.
- C는 typed `goalPatch` 후보만 반환하고 Backend가 expected revision 검증 후 적용·증가시킨다.
- 동일 `requestId + messageId` 재전송은 기존 sequence를 가진 duplicate ACK로 처리한다.
- 같은 request ID를 다른 message ID에 사용하거나 같은 message ID를 다른 request에 사용하면 거부한다.
- `expectedConversationSequence`와 `expectedGoalRevision`이 현재 상태와 달라지면 stale 요청으로 거부한다.
- 세션마다 active AI message 1개와 pending 1개만 허용하며 세 번째 요청은 `MESSAGE_409_BUSY`이다.

## 저장·보안

- 정제된 안전 메시지만 session별 state에 보관한다.
- 대화 상태는 세션 TTL 설정인 `ddd.session-store.ttl`을 공유한다.
- 최근 메시지는 최대 50개로 제한한다.
- password, OTP, PIN, 인증번호 패턴과 제어문자는 fail-closed한다.
- credential 원문은 conversation state, event와 로그에 기록하지 않는다.
- Day 1 snapshot은 sequence, goal revision, active question, 최근 안전 메시지와 만료시각을 제공한다.

## B↔C 계약

- B→C: `sessionId`, `requestId`, `requestMessageId`, `conversationSequence`, `goal`, `userMessage`, `snapshot`
- C→B: `requestId`, `requestMessageId`, `goalId`, `baseGoalRevision`, `mode`, `message`, `confidence`, `reasonCode`, `nextCondition`, `sourceSnapshotId`, `goalPatch`, `question`, `actionCandidate`
- Backend가 `assistantMessageId`, `questionId`, `eventId`, `eventSequence`를 생성한다.
- `ASK_USER`와 DOM 무관 `STOP`은 `sourceSnapshotId=null`을 허용한다.
- DOM 기반 `AUTO_EXECUTE`, `GUIDE_USER`, `SECURE_INPUT_REQUIRED`, `RISK_WARNING`, `FINAL_CONFIRMATION_REQUIRED`, `COMPLETE`는 source snapshot 일치를 요구한다.
- `actionCandidate.snapshotElementRef`는 C가 생성한 ID가 아니라 Backend snapshot reference의 echo이다.
- 사용자 답변에서 Goal 변경 후보만 생성한 경우 mode는 `GOAL_PATCH_PROPOSED`이다.
- `GOAL_PATCH_PROPOSED`는 업무 완료나 Browser Action이 아니며 `goalPatch`가 필수이고 `question`, `actionCandidate`, `sourceSnapshotId`는 null이다.
- Backend는 active turn·active question·goal identity·base revision을 확인한 뒤 patch를 적용하고 revision을 증가시킨다.
- 적용 후 보호 상태를 재검증하고 최신 sanitized DOM snapshot으로 Agent Loop를 exactly-once 재개한다.
- stale revision patch는 폐기하고 현재 revision으로 자동 재적용하지 않는다.

## Day 1 범위 제한

- C의 UserGoal patch와 scripted model이 병합되기 전이므로 AI 질문 생성은 이번 Backend 단독 변경에 포함하지 않는다.
- active message 완료 후 pending 승격은 Day 2 message-driven Agent loop adapter에서 연결한다.
- Redis 영속 conversation repository와 terminal/만료 scheduler 통합은 Day 3 reconnect·cleanup 검증에서 완성한다.
