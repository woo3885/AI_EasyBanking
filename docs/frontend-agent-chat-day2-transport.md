# 대화형 AI Agent Day 2 transport

## 목적과 범위

Day 1의 Demo Bank 우측 AI 채팅 패널을 Backend conversation API와 raw STOMP WebSocket에 연결한다. Day 2는 자연어 메시지, 추가 질문과 답변, 대화 snapshot 복원, 수동 STT·TTS까지만 담당한다. Browser Action, DOM overlay, target token, Viewer 제거, 약관 자동 동의, 보안 입력 및 최종 승인 자동화는 포함하지 않는다.

## 실행 설정

Frontend는 `VITE_BACKEND_BASE_URL`을 사용하며 기본값은 `http://127.0.0.1:8080`이다. Backend와 AI Engine을 별도 실행해야 한다. Demo Bank의 개발 주소가 `http://127.0.0.1:5190`이면 Backend REST CORS와 STOMP allowed origin에 이 origin을 명시해야 한다.

```text
VITE_BACKEND_BASE_URL=http://127.0.0.1:8080
WebSocket handshake: ws://127.0.0.1:8080/ws
Subscription: /topic/sessions/{sessionId}/events
```

Demo 프로젝트에 새 WebSocket 패키지를 추가하지 않고 브라우저 WebSocket 위에 필요한 STOMP 1.2 CONNECT·SUBSCRIBE·DISCONNECT frame만 구현했다. Backend의 기존 `/ws` handshake와 `/topic` broker prefix를 그대로 사용한다.

## HTTP 계약

최초 메시지는 `POST /api/v1/sessions`로 보낸다. 본문은 `requestId`, `messageId`, `content`, `siteId: "demo-bank"`, Backend allowlist에 속한 `initialPath`, `clientOccurredAt`을 포함한다. 현재 경로가 `/`, `/deposit/products`, `/transfer/accounts`가 아니면 안전하게 `/`를 사용한다.

후속 답변은 `POST /api/v1/sessions/{sessionId}/messages`로 보낸다. `answerToQuestionId`, `expectedConversationSequence`, `expectedGoalRevision`을 authoritative client state에서 추가한다. 요청은 자동 retry하지 않는다.

두 POST 모두 HTTP 202와 공통 `ApiResponse` envelope를 검사한다. 응답의 `sessionId`, `requestId`, `messageId`, `acceptedSequence`, `queueStatus`, `workflowStatus`, `acceptedAt`, `duplicate`를 runtime에서 검사하며 요청 identity와 다르면 차단한다. 202 ACK는 업무 완료가 아니라 `WAITING_FOR_AI` 전환만 의미한다.

`GET /api/v1/sessions/{sessionId}/conversation`은 `snapshotId`, `eventSequence`, `conversationSequence`, `goalRevision`, safe message, `activeQuestion`, `workflowStatus`를 복원한다. 모든 HTTP 요청은 `AbortSignal`을 받고 unmount 시 중단한다.

## WebSocket event와 복원 순서

지원 event는 다음 세 가지다.

- `USER_MESSAGE_ACCEPTED`: 사용자 메시지의 `acceptedSequence` 복원
- `AI_QUESTION`: 질문 메시지와 `activeQuestion` 갱신
- `AI_MESSAGE`: 일반 AI 안내 갱신

최초 흐름은 `POST → 202 ACK → STOMP 구독 → snapshot 즉시 조회`다. snapshot 조회 중 live event는 버퍼링하고, snapshot보다 큰 `eventSequence`만 정렬해 적용한다. 이 방식으로 구독 전에 발행된 최초 `USER_MESSAGE_ACCEPTED`도 snapshot의 safe message에서 복원한다. reconnect 때도 구독 성공 후 동일한 snapshot 동기화를 수행한다.

다른 `sessionId`, malformed payload, 중복 `eventId`, stale `eventSequence`, 중복 `messageId`는 fail-closed 처리한다. event sequence와 대화 message sequence를 별도로 보존한다. raw Backend 오류나 payload는 사용자에게 표시하지 않고 고정된 안전 안내만 사용한다.

일반 `AI_MESSAGE`는 `activeQuestion`을 직접 제거하지 않는다. 현재 질문보다 높은 `goalRevision`의 AI 메시지가 오면 snapshot을 다시 조회하며, 해당 snapshot의 `activeQuestion`이 `null`일 때만 질문을 제거한다.

## STT와 TTS

STT는 사용자가 `음성 입력 시작`을 누를 때만 Web Speech API를 시작한다. partial과 final transcript 모두 composer draft만 바꾸고 자동 전송하지 않는다. 사용자가 내용을 확인·수정하고 `요청 전송`을 눌러야 한다. 민감정보가 의심되면 transcript를 state에 저장하지 않고 recognition을 중단한다. secure, risk, reconnect, terminal 상태와 unmount에서는 recognition을 중단·정리한다.

TTS는 AI 메시지의 `이 안내 읽어주기` 버튼으로만 실행한다. 사용자 메시지는 읽지 않으며 메시지 수신 시 자동 재생하지 않는다. 민감정보 문맥이 의심되는 AI 문장은 읽지 않는다. secure, risk, reconnect, terminal 상태, session 변경, unmount에서 `speechSynthesis.cancel()`을 호출한다.

## 보안과 수명주기

- 메시지는 앞뒤 공백 제거 후 최대 500 Unicode code point, 최대 5줄이다.
- 비밀번호, OTP, PIN, 인증번호 문맥은 typed input과 STT 양쪽에서 차단한다.
- 민감정보 경고는 사용자가 닫거나 새 안전 입력을 시작해 복구할 수 있으며 세션 전체를 영구 잠그지 않는다.
- raw 메시지를 URL, storage, console에 저장하지 않는다.
- 자동 재전송, 자동 페이지 이동, 자동 Browser Action, 자동 약관 동의, 자동 보안 입력, 자동 최종 승인을 하지 않는다.
- unmount 시 HTTP AbortController, STOMP subscription/reconnect, recognition, speech synthesis를 정리한다.

## 검증 경계

단위·UI 테스트는 request 직렬화, ACK runtime 검증과 identity mismatch, 세 event parser, stale·duplicate·foreign event, snapshot/live race, 질문 복원·제거, reconnect callback, STT draft 전용 동작, TTS 수동 동작, lifecycle cleanup을 검증한다. 실제 Backend·AI Engine 통합은 두 feature가 develop에 병합되거나 별도 프로세스로 함께 실행 가능한 환경에서 추가 확인한다. HTTP ACK만으로 업무 완료 또는 금융거래 성공을 표시하지 않는다.
