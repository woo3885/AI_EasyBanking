# 프론트 D13 Web Speech API 기반 TTS 안내

## 목적과 범위

D13은 부모가 민감정보를 제거한 안전한 한 문장 안내를 Web Speech API로
읽어 주는 프론트 TTS 기능이다. 사용자는 안내 듣기, 다시 듣기, 음성 중지와
속도 선택을 직접 실행한다. App 제품 흐름, API, WebSocket, 실제 금융 Action은
연결하지 않고 F4 개발 Preview와 주입형 Mock으로 계약을 검증한다.

## 계층 구조

```text
model/speech-synthesis.ts
        │ 브라우저 최소 구조 타입·adapter·voice·오류·속도 계약
        ▼
hooks/useSpeechSynthesis.ts
        │ 재생 lifecycle·generation·secure cleanup
        ▼
ui/F4_VoiceController.tsx
        │ STT와 분리된 TTS section
        ▼
ui/F4_VoiceControllerPreview.tsx
          실제 음성 API를 사용하지 않는 주입형 Mock
```

기존 STT model과 hook은 변경하지 않는다. 브라우저 `speechSynthesis`와
`SpeechSynthesisUtterance`는 production adapter 안에서만 접근한다. factory prop의
`undefined`는 production 브라우저 탐지를 시도하고, `null`은 미지원 환경을
강제하며, factory는 테스트와 Preview의 Mock을 주입한다.

## 사용자 클릭 기반 정책

컴포넌트 mount, message 설정·변경, secure input 해제, disabled 해제 또는 속도
변경만으로 utterance를 만들거나 음성을 재생하지 않는다. 최초 factory 호출,
voice listener 등록, `getVoices()`, utterance 생성과 `speak()`는 사용자의 안내
듣기 또는 다시 듣기 요청 안에서만 수행한다.

- 안내 듣기: 안전한 비어 있지 않은 message가 있고 재생 중이 아닐 때 새
  utterance를 생성한다.
- 다시 듣기: 이전 재생 요청이 있어야 하며 현재 queue를 cancel한 뒤 항상 새
  utterance로 처음부터 재생한다.
- 음성 중지: `STARTING` 또는 `SPEAKING`에서 generation과 handler를 무효화하고
  queue를 cancel한 뒤 `IDLE`로 돌아간다.

다시 듣기와 중지 후 자동 재생하지 않는다. 같은 utterance 객체를 재사용하지
않으며 반복 재생 요청으로 queue가 누적되지 않게 한다.

## 상태

| 상태 | 의미 |
| --- | --- |
| `IDLE` | 아직 재생하지 않았거나 사용자가 중지함 |
| `STARTING` | `speak()`를 호출하고 실제 `onstart`를 기다림 |
| `SPEAKING` | 최신 utterance의 `onstart`를 받음 |
| `COMPLETED` | 최신 utterance의 `onend`를 받음 |
| `ERROR` | 최신 utterance에서 예상하지 않은 runtime 오류가 발생함 |
| `UNSUPPORTED` | 필수 Web Speech API를 사용할 수 없음 |

`PAUSED`, `CANCELLED` 상태는 D13에 없다. speak 요청만으로 실제 재생 중이나
완료를 주장하지 않는다.

## 속도 옵션

속도는 실제 `<select>`에서 다음 세 값만 선택한다.

| 문구 | rate |
| --- | ---: |
| 느리게 | `0.8` |
| 보통 | `1.0` |
| 빠르게 | `1.2` |

기본값은 보통 `1.0`이다. 이 값은 서버나 D1 확정 규격이 아니라 D13 UI Mock
계약이며 운영체제와 브라우저에 따라 체감 속도가 다를 수 있다. 변경한 속도는
현재 utterance를 취소하거나 재시작하지 않고 다음 사용자 재생부터 적용한다.

## 한국어 voice 정책

모든 utterance에 `lang = "ko-KR"`를 지정한다. voice 목록에서는 대소문자를
구분하지 않고 다음 순서로 선택한다.

1. `ko-KR` 정확 일치
2. `ko` language prefix
3. 일치 항목이 없으면 voice를 지정하지 않고 브라우저 기본값 사용

특정 voice name, 운영체제 또는 첫 번째 voice를 하드코딩하지 않는다. 첫 사용자
재생 뒤 등록한 `voiceschanged` listener는 최신 목록만 ref에 보관한다. 목록이
늦게 도착해도 현재 음성을 재시작하지 않고 다음 play 또는 replay부터 사용한다.

## message와 보안 계약

F4의 `message`는 부모가 비밀번호, 일회용 인증정보, 전체 계좌번호 등 민감정보를
제거한 안전한 표시 문장이어야 한다. F4는 키워드나 정규식만으로 문장의 안전을
판정하지 않는다. 같은 문장을 화면에 항상 표시하여 음성에만 의존하지 않는다.

`isSecureInput=true`가 되면 실행 중 음성을 즉시 cancel하고 handler와 활성
utterance 참조를 제거한다. play, replay, stop, 속도 select를 모두 disabled로
표시하며 일반적인 보안 안내만 제공한다. secure input이 해제돼도 자동 재생하지
않고 사용자가 새로 안내 듣기 버튼을 눌러야 한다.

## stale callback과 cleanup

재생 요청마다 generation을 증가시킨다. replay, stop, message 변경, disabled
전환, secure input 진입, factory 변경, 새 utterance와 unmount는 이전 generation을
무효화한다. cancel된 utterance의 늦은 `onstart`, `onend`, `onerror`는 상태를
변경하지 않는다.

utterance, adapter, voice 목록은 React state가 아닌 ref에 저장한다. unmount 시
handler와 `voiceschanged` listener를 제거하고 실행 중 queue를 cancel한다. 다만
브라우저별 구현 차이 때문에 cleanup 호출만으로 모든 환경에서 오디오가 즉시
끝난다고 보장하지 않는다.

## 오류 처리

Web Speech 오류는 안전한 고정 한국어 문구로 변환하고 provider 원문이나 message를
오류 영역에 포함하지 않는다. 의도적인 cancel은 handler와 generation을 먼저
무효화하여 `ERROR`로 만들지 않는다. 최신 활성 utterance의 예상하지 않은 오류만
`ERROR`와 접근 가능한 alert로 표시한다. TTS 상태를 서버 이벤트나 WebSocket으로
전송하지 않는다.

## selector

모든 자동화 대상은 `id`와 `data-testid`에 같은 값을 사용한다.

- `controller-tts`
- `btn-tts-play`
- `btn-tts-replay`
- `btn-tts-stop`
- `select-tts-rate`
- `status-tts-playback`
- `status-tts-rate`
- `notice-tts-security`
- `notice-tts-unsupported`
- Preview: `status-preview-tts-action`

기존 STT selector는 변경하지 않는다.

## 접근성

TTS는 제목으로 이름이 연결된 별도 section이다. 조작 버튼은 실제
`button type="button"`과 공통 `size="lg"`를 사용하고 실제 disabled와 기존
focus-visible 정책을 유지한다. 속도 선택은 label이 연결된 실제 select다.
재생·속도 상태는 `role="status"`, `aria-live="polite"`이며 오류는
`role="alert"`로 전달한다. 상태는 색상뿐 아니라 문장으로 제공한다.

## Preview와 Mock

Preview의 synthesis factory는 speak·cancel 횟수, 생성 utterance, text, lang,
rate, 선택 voice, `onstart`, `onend`, `onerror`, voiceschanged를 메모리에서
제어한다. 실제 `window.speechSynthesis`, 실제 `SpeechSynthesisUtterance`, 음성
출력, 마이크, API 또는 WebSocket을 호출하지 않는다. Preview는 App에 연결하지
않는다.

## F5 Main Controller 경계

F5 `onReplay()`는 현재 안내를 다시 듣고 싶다는 callback 요청이다. 후속 제품
통합에서는 부모가 이 callback을 TTS hook의 replay와 연결할 수 있다. D13은 F4
Preview에서 TTS를 독립 검증하며 F5 코드를 수정하지 않는다.

F5의 workflow 일시정지는 AI 업무 흐름 제어이고 D13의 음성 중지는 브라우저
음성 queue 제어다. 두 기능을 합치지 않으며 history, `BrowserActionType` 또는
WebSocket으로 연결하지 않는다.

## 실제 브라우저 수동 검증

자동 테스트는 JSDOM의 주입형 Mock과 production build까지만 검증한다. 실제
음성이 재생됐다고 주장하지 않는다. 지원 브라우저에서 다음을 수동 확인해야 한다.

- 사용자 클릭 후 한국어 음성 출력
- 운영체제의 한국어 voice 존재 여부와 기본 voice fallback
- 느리게·보통·빠르게 체감 차이
- replay가 처음부터 재생하는지
- stop과 secure input 진입 시 실제 음성이 중단되는지
- secure 해제 후 자동 재생되지 않는지
- 스크린리더 상태 안내
- 비지원 브라우저 안내

## 제외 범위

- mount·message 변경·secure 해제 자동 재생
- 음성 pause/resume 및 F5 workflow pause 변경
- App 제품 흐름과 F5 실제 연결
- backend TTS·외부 TTS API·음성 파일
- TTS WebSocket·서버 이벤트
- 민감정보 낭독과 로그·storage 저장
- 실제 금융 Action
- backend, demo-bank, ai-engine 및 package 변경
