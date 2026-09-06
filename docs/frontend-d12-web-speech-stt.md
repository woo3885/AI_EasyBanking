# 프론트 D12 Web Speech API 기반 STT 입력

## 목적과 범위

D12는 기존 F4 음성 제어 Placeholder를 사용자 클릭으로만 시작되는 Web Speech API 기반 STT 입력으로 교체한다. 브라우저의 중간·최종 인식 결과를 기존 `SttEvent` 계약으로 변환하지만, App 제품 흐름에는 연결하지 않는다. 실제 Intent API, WebSocket, TTS, 영구 저장, 음성 파일 저장과 금융 실행은 범위 밖이다.

## 계층 구조

- `model/speech-recognition.ts`: 브라우저 API 최소 구조 타입, 생성자 탐지, 설정, confidence 및 오류 변환
- `hooks/useSpeechRecognition.ts`: 발화 lifecycle, 로컬 transcript, `SttEvent` 생성, cleanup과 보안 Gate
- `ui/F4_VoiceController.tsx`: 시작·중지·재시도·지우기 UI와 상태·결과·오류 안내
- `ui/F4_VoiceControllerPreview.tsx`: 주입형 Mock factory로 동작을 확인하는 개발 전용 Preview

전역 ambient declaration은 만들지 않는다. 브라우저 타입은 alternative, result, result list, event, error event, instance, constructor, factory에 필요한 속성만 구조 타입으로 선언한다. `window.SpeechRecognition`을 먼저 확인하고 없으면 `window.webkitSpeechRecognition`을 사용한다. 둘 다 없으면 `UNSUPPORTED`다. 생성자 탐지는 구조적으로 수행하며 브라우저 이름으로 분기하지 않는다.

## Web Speech 설정과 권한 시작점

생성한 instance는 다음 값으로 고정한다.

- `lang = "ko-KR"`
- `interimResults = true`
- `continuous = false`: 한 번의 사용자 발화 단위로 종료한다.
- `maxAlternatives = 1`: 각 result의 첫 번째 후보만 사용한다.

instance 생성 자체는 `start()`를 호출하지 않는다. 컴포넌트 mount, 상태 변화 또는 retry 가능 상태만으로 마이크를 자동 시작하지 않는다. 브라우저 권한 요청을 유발할 수 있는 `recognition.start()`는 사용자가 `음성 입력 시작` 또는 `다시 시도` 버튼을 누른 callback 안에서만 실행한다.

## 상태와 발화 lifecycle

상태는 `IDLE`, `STARTING`, `LISTENING`, `STOPPING`, `COMPLETED`, `ERROR`, `UNSUPPORTED`를 사용한다.

- `start`: 이전 로컬 결과를 지우고 새 utterance ID와 generation을 만든 뒤 `STARTING`으로 전환한다.
- `onstart`: 활성 generation과 보안 상태를 다시 확인하고 `LISTENING` 및 `STT_STARTED`를 생성한다.
- `stop`: `STARTING` 또는 `LISTENING`에서 한 번만 호출하며 `STOPPING`으로 바꾼다. stop 뒤 도착한 final은 수용한다.
- `retry`: 재시도 가능한 `ERROR`에서만 기존 instance를 정리한 뒤 사용자의 버튼 클릭으로 새 발화를 시작한다.
- `clear`: 실행 중이면 의도적으로 abort하고 중간·최종 결과와 오류를 지운다. 빈 transcript 이벤트는 만들지 않는다.
- `onend`: final 뒤에는 `COMPLETED`, 오류 뒤에는 `ERROR`, 사용자 stop 뒤 final이 없으면 `IDLE`을 유지한다. 그 외 예기치 않은 종료는 재시도 가능한 `UNKNOWN_ERROR`이며 자동 재시작하지 않는다.

각 발화는 사용자가 시작할 때 새 `utteranceId`를 가진다. `crypto.randomUUID()`를 우선 사용하고 지원되지 않으면 민감정보 없는 로컬 ID를 만든다. `sequence`는 발화마다 0에서 시작해 전달 이벤트마다 증가하고, `timestamp`는 이벤트 생성 시 `Date.now()`를 사용한다. 테스트에서는 두 함수를 주입한다.

## partial·final 변환 정책

`resultIndex`부터 result list를 순회하고 첫 alternative만 사용한다. trim 후 빈 문장은 전달하지 않는다. 같은 callback의 여러 partial 또는 final segment는 원래 순서대로 공백 한 칸으로 합친다.

- partial은 `STT_PARTIAL_RESULT`, `isFinal=false`, `language="ko-KR"`로 전달한다.
- final은 `STT_FINAL_RESULT`, `isFinal=true`로 발화당 정확히 한 번 전달하며 이후 partial을 폐기한다.
- Web Speech API 결과에 신뢰할 수 있는 단어별 시간이 없으므로 `startedAt`, `endedAt`, `durationMs`, `words`를 만들지 않는다.
- confidence는 유한한 0~1 값만 사용한다. 여러 segment가 모두 유효하면 보수적으로 최솟값을 사용하고 하나라도 비정상이면 `null`이다.

## 오류 매핑

| 브라우저 오류 | `SttErrorCode` | 재시도 | 사용자 문구 |
|---|---|---:|---|
| `no-speech` | `NO_SPEECH_DETECTED` | 가능 | 음성이 들리지 않았습니다. 다시 말씀해 주세요. |
| `audio-capture` | `MICROPHONE_UNAVAILABLE` | 가능 | 마이크를 사용할 수 없습니다. |
| `not-allowed` | `PERMISSION_DENIED` | 불가 | 마이크 사용 권한을 확인해 주세요. |
| `service-not-allowed` | `PERMISSION_DENIED` | 불가 | 음성 인식 서비스 사용이 허용되지 않았습니다. |
| `network` | `STT_SERVER_ERROR` | 가능 | 음성 인식 서비스에 연결할 수 없습니다. |
| `language-not-supported` | `UNKNOWN_ERROR` | 불가 | 한국어 음성 인식을 지원하지 않습니다. |
| 예상하지 않은 `aborted` | `UNKNOWN_ERROR` | 가능 | 음성 입력이 중단되었습니다. |
| 기타·legacy 설정 오류 | `UNKNOWN_ERROR` | 불가 | 안전한 고정 문구 사용 |

브라우저 원본 오류 메시지는 UI나 이벤트에 노출하지 않는다. secure, clear, disabled, unmount에 의한 의도적 abort는 오류 이벤트가 아니다. 오류 callback은 발화당 한 번만 전달한다.

## Secure Input Gate와 개인정보

`isSecureInput=true`가 되면 generation을 먼저 갱신하고 handler를 제거한 뒤 active instance를 abort한다. 중간·최종 transcript와 오류를 즉시 삭제하며 이후 늦게 도착한 callback을 폐기한다. secure 해제 뒤에도 자동 재개하지 않고 사용자가 다시 시작해야 한다. `disabled=true`도 실행 중 인식을 abort하지만 기존 transcript는 보존한다.

transcript는 hook의 React 로컬 state에만 존재한다. URL, 전역 store, `localStorage`, `sessionStorage`, 로그, 서버 또는 파일에 저장하지 않는다. 보안 입력 화면에서는 비밀번호나 일회용 인증번호를 음성으로 말하지 않도록 안내한다. 브라우저 또는 브라우저가 사용하는 음성 서비스가 음성 데이터를 외부에서 처리할 수 있으므로 제품 배포 전에 개인정보·국외 이전·보존 정책을 별도로 검토해야 한다.

## 고정 selector와 접근성

`id`와 `data-testid`는 같은 값을 쓴다.

- `controller-voice-input`
- `btn-stt-start`, `btn-stt-stop`, `btn-stt-retry`, `btn-stt-clear`
- `status-stt-recognition`
- `transcript-stt-interim`, `transcript-stt-final`
- `notice-stt-unsupported`, `notice-stt-secure-disabled`
- Preview: `preview-voice-controller`, `status-preview-stt-event`

Controller는 이름 있는 `section`과 `aria-busy`를 사용한다. 모든 조작은 `type="button"`인 공통 `Button size="lg"`로 최소 높이 56px, 실제 `disabled`, 기존 `focus-visible` 정책을 유지한다. 시작 버튼은 `aria-pressed`, 상태는 `role="status"`/`aria-live="polite"`, 오류는 `role="alert"`, 중간 결과는 `aria-live="off"`, 최종 결과는 `aria-live="polite"`를 사용한다. 상태 의미는 색상만이 아니라 문구로 전달한다.

## 개발 전용 Preview

Preview는 App과 Wireframe Gallery에 연결하지 않는다. 기존 개인정보 없는 STT JSON의 문장만 재사용하고 주입형 Mock recognition으로 시작, partial, final, 오류, clear, secure와 unsupported 상태를 확인한다. 실제 브라우저 recognition 생성자, 마이크, AI, 서버, WebSocket 또는 TTS를 호출하지 않는다.

## 검증과 수동 확인 범위

자동 검증은 adapter 순수 함수, hook lifecycle, JSDOM UI 상호작용, Preview Mock, 전체 회귀 테스트, TypeScript와 Vite production build를 포함한다. 실행 명령은 다음과 같다.

```text
npm.cmd test -- --run src/features/F4_VoiceController/model/speech-recognition.test.ts
npm.cmd test -- --run src/features/F4_VoiceController/hooks/useSpeechRecognition.test.ts
npm.cmd test -- --run src/features/F4_VoiceController/ui/F4_VoiceController.test.tsx
npm.cmd test -- --run src/features/F4_VoiceController/ui/F4_VoiceControllerPreview.test.tsx
npm.cmd test
npm.cmd run build
git diff --check
```

실제 마이크 검증은 D12 자동 검증에 포함하지 않는다. 지원 브라우저에서 HTTPS 또는 localhost로 열고 사용자의 권한 허용·거부, 실제 `ko-KR` 인식 품질, 운영 환경의 음성 서비스 데이터 처리를 수동 검증해야 한다.

구현 완료 시 adapter 17개, hook 22개, Controller 7개, Preview 5개 테스트가 각각 통과했다. 전체 회귀 테스트는 32개 파일의 356개 테스트가 통과했고, `tsc -b && vite build` production build도 성공했다.

## 개발자 C와의 계약

- partial은 Intent를 실행하지 않고 final만 Intent 후보로 사용한다.
- `sessionId`는 상위 계층이 제공하고 `utteranceId`는 사용자 시작마다 생성한다.
- `sequence`는 발화별로 증가하고 `timestamp`는 이벤트 생성 시각이다.
- 지원되지 않는 words·timing은 생략하고 비정상 confidence는 `null`로 보낸다.
- 빈 transcript, 브라우저 원본 오류, secure 전환 이후 결과는 전달하지 않는다.
- 실제 개발자 C API 호출과 `SttEvent` 소비는 F4 바깥의 후속 통합 계층에서 처리한다.

## 후속 범위

D13에서는 확정된 안내 문장을 읽는 TTS와 속도 제어를 별도로 구현한다. D12에는 TTS, 실제 Intent 호출, App 통합, 자동 듣기, wake word, raw audio 처리와 금융 Action이 없다. 기존 화면을 통한 실제 제품 진입점 연결과 개발자 C 계약의 운영 검증도 후속 작업이다.
