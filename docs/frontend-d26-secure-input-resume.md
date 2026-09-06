# Frontend D26 보안 입력 완료 및 안전 재개

## 목표와 보안 경계

D26은 `SECURE_INPUT_REQUIRED`에서 사용자가 보호된 원격 금융 화면에 직접 입력한 뒤, 프론트가 Backend에 **입력 절차 완료 확인**만 요청하는 흐름이다. 이 요청은 비밀번호나 OTP의 정답, 인증 성공, 금융 업무 완료를 뜻하지 않는다.

일반 Viewer는 캡처된 화면을 표시할 뿐 보안 값을 입력하는 경계가 아니다. 로컬 공동 시연에서는 Backend의 명시적 headed secure takeover 설정과 동일한 Playwright Page를 통해 사용자가 직접 입력한다. 프론트는 입력 원문·길이·마스킹 값을 DOM, 상태, 요청, 로그, URL, storage에 저장하지 않는다.

## Production 계약

완료 요청:

```text
POST /api/v1/sessions/{sessionId}/secure-inputs/{secureRequestId}/complete
```

요청 본문은 다음 세 필드만 허용한다.

```json
{
  "requestId": "completion-request-id",
  "expectedFrameId": "last-safe-frame-id",
  "expectedSequence": 7
}
```

응답의 `COMPLETION_ACCEPTED`는 HTTP 요청 접수만 뜻한다. UI는 ACK 직후 보호 상태를 해제하지 않고 `SECURE_INPUT_RESOLVED`, `SECURE_INPUT_CLEAR` 또는 검증된 후속 snapshot/status를 기다린다.

## 이벤트와 상태 모델

`SECURE_INPUT_REQUIRED` 이벤트와 latest snapshot은 다음 공개 메타데이터만 보관한다.

- `secureRequestId`
- `secureInputType`: `ACCOUNT_PASSWORD`, `OTP`, `CERTIFICATE_PASSWORD`
- 마지막 안전 `frameId`, `frameSequence`
- 민감정보를 제거한 사용자 안내 `message`

로컬 제출 상태는 다음과 같다.

- `WAITING_FOR_USER`: 사용자가 보호 화면에서 직접 입력하는 단계
- `SUBMITTING`: 완료 확인 요청 전송 중
- `WAITING_FOR_RESUME`: HTTP ACK 후 Backend 후속 이벤트 대기
- `ERROR`: 안전 문장을 표시하고 사용자의 명시적 재시도만 허용

새 `secureRequestId`가 오면 로컬 제출 상태를 초기화한다. 동일 요청의 중복 클릭은 in-flight 식별자와 제출 phase로 차단한다. snapshot은 reconnect 시 active secure 요청을 복원하고, 기존 sequence 정책으로 stale·duplicate·다른 session 이벤트를 폐기한다.

## 완료 요청 Gate

다음 조건을 모두 만족해야 완료 버튼이 활성화된다.

- WorkflowStatus가 `SECURE_INPUT_REQUIRED`
- UI status transport가 `CONNECTED`
- active secure metadata가 존재
- 표시 중인 Frame identity가 secure source Frame과 일치
- Frame이 준비됐고 reconnect 중이 아님
- Viewer Action pending이 아님
- 제출 상태가 `WAITING_FOR_USER` 또는 명시적 재시도가 가능한 `ERROR`

요청 중과 ACK 후에는 실제 `disabled`를 유지한다. reset·연결 단절·화면 이탈 시 진행 중 HTTP 요청을 abort하고 stale callback을 무시한다.

## 기존 UI 적용

기존 `SecureInputPanel` 내부 구현은 변경하지 않았다. `SessionIntegrationView`가 live secure metadata와 controlled 제출 상태를 props로 전달한다. secure 상태에서는 Target, Viewer Action, decision·terms UI를 차단하고 마지막 안전 Frame은 읽기 전용으로만 유지한다.

F4 STT와 F5 TTS는 현재 production `SessionIntegrationView`에 조합돼 있지 않으므로 D26에서 새로 마운트하지 않았다. 이후 조합 시 secure 상태에서 중단하고 자동 재시작·자동 재생하지 않는 capability gate가 필요하다.

## 검증 범위

단위·UI 테스트는 exact-key 요청, runtime 응답 검증, 오류 안전 변환, 중복 제출 방지, reconnect snapshot 복원, 후속 event 전 보호 상태 유지, Viewer·Target·decision 차단, 접근 가능한 busy/status/alert를 검증한다.

Backend·AI Engine·Demo·Frontend 공동 실행은 Java 21, Playwright Chromium, Backend의 명시적 headed secure takeover 설정이 갖춰진 환경에서 별도로 수행한다. 코드 검증만으로 실제 보안 입력과 재개 E2E를 완료했다고 판단하지 않는다.
