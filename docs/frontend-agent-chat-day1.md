# 대화형 AI 에이전트 Frontend Day 1

## 목적과 범위

Day 1은 Canvas Viewer를 주 화면으로 사용하지 않고, 실제 Demo Bank 업무
화면을 중심에 둔 채 같은 페이지의 오른쪽 또는 하단에 AI 채팅 패널을
제공하는 기반 작업이다. 이번 범위는 대화 상태 모델, 안전한 입력 정책,
채팅 UI shell과 Demo 공통 레이아웃 마운트까지다.

Backend REST/WebSocket, AI Engine, STT/TTS, 실제 Target overlay와 자동 금융
행동은 연결하지 않는다. HTTP ACK도 거래 성공이나 자동화 완료로 해석하지
않는다.

## 화면 구조

- 데스크톱: 실제 Demo Bank 페이지가 주 영역이며 AI 채팅 패널이 오른쪽에
  배치된다.
- 960px 이하 또는 200% 확대: 채팅 패널이 금융 페이지 아래로 이동한다.
- 채팅 패널은 금융 버튼 위를 덮는 fixed overlay가 아니다.
- 패널을 접었다 다시 열어도 현재 문서 안의 안전한 draft는 유지된다.
- 기존 URL, 페이지 루트, 금융 버튼 ID와 `data-testid`는 변경하지 않는다.
- 공통 `DemoBankLayout`에 shell을 한 번 마운트하므로 예금·이체 업무 페이지
  모두 같은 채팅 구조를 갖는다. 기존 링크 이동은 문서를 새로 여는 방식이므로
  페이지 이동 사이의 대화 영속화는 Day 2 snapshot 계약 이후 결정한다.

## 대화 상태 모델

`ConversationMessage`는 다음 식별 정보를 분리한다.

- `messageId`: 메시지 중복 방지용 ID
- `sequence`: Backend 이벤트 순서. 아직 ACK되지 않은 로컬 메시지는 `null`
- `questionId`: AI `QUESTION` 메시지에만 존재
- `goalRevision`: 서버가 확정할 누적 목표 revision
- `occurredAt`: 표시와 복원에 사용할 발생 시각

`ConversationState`는 메시지 목록과 함께 다음 값을 관리한다.

- `lastEventSequence`
- `activeQuestion`
- `draft`
- `submitPhase`
- `pendingRequestId`, `pendingMessageId`
- `safeError`
- `connectionPhase`

`requestId`, `messageId`, 서버 `sequence`는 서로 대체하지 않는다. 서버
sequence보다 같거나 오래된 live 이벤트는 무시하며, 같은 `messageId`는 다시
추가하지 않는다. 오래된 snapshot은 최신 live 상태를 덮어쓰지 않는다.
새 AI 질문은 `activeQuestion`을 교체하고 일반 AI 메시지는 기존 질문을 임의로
지우지 않는다. 이전 요청의 늦은 callback도 현재 pending 요청을 바꾸지 않는다.

## 제출 상태와 ACK 의미

제출 상태는 `IDLE`, `SUBMITTING`, `WAITING_FOR_ACK`, `WAITING_FOR_AI`,
`ERROR`로 분리한다. 처리 중에는 중복 제출과 자동 재시도를 차단한다.

Day 1 shell은 사용자 직접 클릭으로 로컬 사용자 메시지를 추가하고 Backend
전송 경계까지만 호출한다. 실제 endpoint는 없다. Backend ACK가 연결되는
Day 2에도 ACK는 사용자 메시지 접수만 의미하며 금융 업무 성공, 거래 성공,
AI 처리 완료를 의미하지 않는다.

## AI 질문 경계

질문은 `role="AI"`, `kind="QUESTION"`, 비어 있지 않은 `questionId`를 가진
메시지다. 질문 문구, `questionId`, `goalRevision`의 authoritative source는 AI
Engine과 Backend 계약이어야 한다. Frontend는 문구나 URL에서 질문 유형을
재추론하지 않는다.

## UI와 접근성

- `ConversationMessageList`는 `role="log"`, `aria-live="polite"`를 사용한다.
- 사용자와 AI는 색상뿐 아니라 `사용자`, `AI 안내` 텍스트로 구분한다.
- 전송 진행은 `role="status"`, 안전 오류는 `role="alert"`로 제공한다.
- 메시지는 React text node로만 렌더링하며 HTML을 해석하지 않는다.
- composer는 label이 연결된 controlled `<textarea>`와 실제 `<button>`을
  사용한다.
- 전송 버튼은 최소 56px이며 invalid 또는 pending 상태에서 실제
  `disabled`가 된다.
- mount, 음성 입력 결과 수신, 빠른 요청 선택만으로 전송하지 않는다.
- 새 메시지 수신 시 focus를 자동 이동하지 않는다.

빠른 요청 예시는 `100만 원으로 예금 가입하기`, `예금 상품 알아보기`다.
선택하면 draft만 채우며 메시지 전송, 금융 버튼 클릭, 약관 선택 또는 최종
승인을 실행하지 않는다.

## Agent UI sanitizer 경계

채팅 UI 최상위에는 다음 마커를 사용한다.

```html
<aside data-ddd-agent-ui="true">
```

Agent UI는 Demo Bank 업무 DOM과 구분되는 이 subtree 안에만 존재한다. Day 1은
Backend sanitizer를 수정하지 않았다. Backend/AI Engine은 이 마커와 하위
요소를 분석 snapshot 및 자동화 후보에서 제외하는 계약을 별도로 확인해야
한다.

## 입력 보안 정책

다음을 전송 전에 차단한다.

- 빈 문자열과 공백만 있는 입력
- Frontend 임시 최대 500 Unicode 문자 초과
- Frontend 임시 최대 5줄 초과
- 허용하지 않은 제어 문자
- 비밀번호, 패스워드, OTP, PIN, 인증번호/인증코드 문맥
- 이전 요청이 pending인 동안의 중복 제출

금액과 기간 자체는 민감정보로 간주하지 않는다. `100만 원`, `1000000원`,
`12개월` 같은 정상 금융 요청은 허용한다. 차단 안내와 전송 오류에는 원문,
내부 URL, stack, selector나 세션 ID를 넣지 않는다. console, storage, URL에도
대화 원문을 저장하지 않는다.

민감 키워드가 입력 중 감지되면 해당 candidate를 controlled draft로 전달하지
않고 기존 draft를 즉시 비운다. 입력란은 읽기 전용으로 잠기며 사용자가 고정
안전 안내를 닫은 뒤에만 새 요청을 작성할 수 있다. 따라서 감지된 실제 값은
대화 메시지나 React 대화 상태에 남지 않는다.

500자와 5줄은 Backend 공통 상수가 아직 없어서 둔 Day 1 Frontend 임시값이다.
Day 2 계약 확정 후 Backend와 동일한 공유 기준으로 교체해야 한다.

## 기존 안전 Gate 회귀 방지

이번 변경은 기존 금융 업무 UI의 다음 계약을 수정하지 않는다.

- 사용자 직접 상품·계좌·수취인·약관 선택
- `data-ddd-policy="secure-input"` 보안 입력 Gate
- `data-ddd-policy="final-confirmation"` 최종 승인 Gate
- `btn-final-approve`와 완료 URL
- 위험 상태 및 실제 거래 미실행 원칙

채팅 shell은 금융 버튼을 자동 클릭하지 않으며 빠른 요청도 자동 행동으로
연결하지 않는다.

## Day 2 후속 작업

- Backend 최초 요청 endpoint와 메시지 ACK 연결
- AI 메시지·추가 질문 event 및 reconnect snapshot 연결
- 서버 sequence, message ID, question ID, goal revision 교차 계약 확정
- 민감정보 거절 오류 코드와 공통 길이·줄 수 상수 합의
- STT 결과를 draft에만 삽입하고 사용자 확인 후 전송
- AI 안내 TTS의 읽기·일시정지·다시 듣기·속도 조절
- 실제 DOM Target의 ID, label, role, rect, viewport, scroll, DOM version 계약
- stale Target 차단과 사용자 직접 클릭 확인

## Shared Gate 1 상태

- A Frontend Day 1: 모델, reducer, 보안 정책, 채팅 shell, 실제 Demo 페이지
  공통 마운트와 단위/UI 테스트 완료
- Shared Gate 1 vertical slice: 대기

대기 사유는 실제 `사용자 메시지 → Backend ACK → AI 추가 질문` 흐름에 필요한
Backend endpoint/event와 AI 질문 계약이 아직 이번 Frontend 범위에 연결되지
않았기 때문이다. A UI는 해당 데이터를 controlled props와 reducer action으로
받을 경계를 제공한다.
