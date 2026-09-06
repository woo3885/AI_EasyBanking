# D27 generic AI fallback Backend 계약

## 적용 범위

- AI Engine의 timeout, malformed JSON, schema invalid, policy reject 등 일반 오류
- Backend의 AI 응답 소비와 Workflow 상태 전환
- Frontend에는 기존 상태 이벤트 계약만 제공하며 Frontend/AI Engine 코드는 변경하지 않는다.

## C → B 계약

일반 오류 fallback은 기존 DTO를 그대로 사용한다.

- `actionType: NONE`
- `status: ERROR`
- `requiresUserAction: true`
- `executionBlocked: true`

새 `actionType`, `status`, `decisionType`은 추가하지 않는다. Backend는 `status: ERROR`를
브라우저 Action보다 우선하는 authoritative 상태로 취급한다.

## Backend 처리

1. 응답 검증 후 `status: ERROR`이면 어떤 Action도 실행하지 않는다.
2. 세션을 `WorkflowStatus.ERROR`로 저장한다.
3. 기존 Target을 제거한다.
4. Frontend에는 `AI 행동 판단 중 오류가 발생했습니다.`라는 고정 메시지를 발행한다.
5. AI Engine이 보낸 내부 오류 message는 사용자에게 전달하지 않는다.

`ERROR`, `CANCELLED`, `TERMINATED`, `COMPLETED`, 사용자 개입 대기 및 위험 차단 상태에서는
Snapshot 생성과 AI 호출 전에 재실행을 거부한다. Agent Loop도 같은 상태 집합에서 중단되므로
fallback의 외부 재호출과 자동 재시작 모두 Action 실행으로 이어지지 않는다.
