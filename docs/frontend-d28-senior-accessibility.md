# Frontend D28 고령층 접근성 점검표

## 1. 기준 origin/develop

- 기준 커밋: `ffefb3c7525ec82f1440265f18daa4306bdb2c4d`
- 기준 메시지: `Merge pull request #112 from woo3885/feature/frontend-d27-final-confirmation-resume`
- 작업 브랜치: `feature/frontend-d28-senior-accessibility`
- D26 Frontend merge `8791f10`, D27 Frontend merge `ffefb3c`: 둘 다 기준 `develop`에 포함됨.

## 2. 점검한 production 화면

| 흐름 | production 구성 | 상태 |
| --- | --- | --- |
| 세션 시작 | `App` → `F1_Dashboard` | PASS |
| Viewer·Target | `SessionIntegrationView` → `F2_StreamViewer`, `F3_SmartOverlay` | PASS |
| 상품·계좌·수취인 선택 | `UserDecisionPanel` | PASS |
| 약관 선택 | `TermsAgreementPanel` | PASS |
| 보안 입력 전환 | `SecureInputPanel` | PASS |
| 위험 경고 | `WorkflowStatusPanel` `RISK_WARNING` 표현 | PASS |
| 상세 위험 정보 | `RiskWarningPanel`은 production detail 계약 없음 | BLOCKED |
| 최종 승인·거절 | `FinalConfirmationPanel` | PASS |
| 로딩·AI 실행·오류 | `WorkflowStatusPanel` | PASS |
| 연결 끊김·재연결 | Frame/UI 연결 상태 패널과 Action Gate | PASS |
| 취소·세션 종료 | `SessionIntegrationView` 세션 종료 | PASS |
| STT·TTS | production `F4_VoiceController` | PASS |

## 3. 적용한 접근성 기준

- 기준 화면은 1280×720이며 production layout은 내용을 잘라내지 않고 세로 스크롤한다.
- 화면 제목 30px, 주요 안내 18px, 본문 16px, 보조 문구 14px 이상의 기존 `Text` 계층을 사용한다.
- 주요 Action은 `Button size="lg"`의 최소 56px 높이를 사용한다.
- 선택은 native radio·checkbox, Action은 native button, 비활성은 실제 `disabled`를 사용한다.
- 상태는 색상과 텍스트를 함께 제공하고, 처리 상태는 live region과 `aria-busy`를 사용한다.
- 글로벌 `focus-visible` 3px outline과 컴포넌트 ring을 유지하고 `prefers-reduced-motion` 설정을 존중한다.
- 자동 선택·자동 승인·자동 음성 재생은 허용하지 않는다.

## 4. 글자 점검 결과

- PASS: production `AppLayout`의 h1을 30px `title`로 통일했다.
- PASS: Dashboard에서 `WorkflowStatus`, `ScreenType` 내부 코드를 기본으로 노출하지 않는다.
- PASS: 안내·상태·선택 결과·오류가 시각 텍스트로 남는다.
- PASS: 거래 요약은 `dl/dt/dd` 구조를 유지한다.
- BLOCKED: 실제 200% 확대와 OS 글자 크기 조건의 잘림·겹침은 제어 가능한 브라우저가 없어 수동 확인하지 못했다.

## 5. 버튼·터치 점검 결과

- PASS: 주요 시작·확인·승인·거절·종료 버튼은 56px 규칙을 유지한다.
- PASS: 버튼·radio·checkbox는 native control이며 Enter·Space 기본 동작을 변경하지 않았다.
- PASS: Dashboard 시작 버튼을 활성화하는 조건을 `aria-describedby`로 연결했다.
- PASS: 선택·약관 확인 버튼은 현재 상태 안내와 `aria-describedby`로 연결된다.
- PASS: loading 중 `disabled`, `aria-busy`, 스크린리더용 처리 중 문구를 유지한다.
- BLOCKED: 실제 터치 장치의 오터치와 Tab 순서는 수동 확인이 필요하다.

## 6. 음성 기능 점검 결과

- PASS: `F4_VoiceController`를 실제 `SessionIntegrationView`에 마운트했다.
- PASS: STT 시작·청취·완료·오류와 재시도 상태가 텍스트로 표시된다.
- PASS: TTS 듣기·다시 듣기·일시정지·계속 듣기·중지·속도 조절을 제공한다.
- PASS: 일시정지 상태는 버튼 문구, `aria-pressed`, live status로 구분된다.
- PASS: 음성은 사용자가 버튼을 누를 때만 시작하고 선택·승인·Viewer Action을 실행하지 않는다.
- PASS: secure input 중 STT·TTS를 취소하고 재생 문장·인식 결과를 숨기며 자동 재개하지 않는다.
- PASS: Web Speech API 미지원 안내와 화면 버튼 대체 동선이 존재한다.
- BLOCKED: 실제 한국어 인식·음성 품질과 OS 별 pause/resume 체감은 브라우저 수동 검증이 필요하다.

## 7. 취소 동선 점검 결과

- PASS: 실시간 세션에 일관된 `세션 종료 후 대시보드로` Action이 있다.
- PASS: 종료 시 decision·secure·confirmation pending 요청을 abort한 뒤 session reset/cancel 경계를 호출한다.
- PASS: 종료 요청 중 버튼을 실제 `disabled`로 바꾸고 중복 클릭을 차단하며 live status를 안내한다.
- PASS: 최종 확인의 거절은 승인과 다른 danger Action이며 수동 선택 전에 승인할 수 없다.
- PASS: 위험 상태에서 WorkflowStatusPanel은 금융 진행 Action을 노출하지 않고 세션 종료 동선만 유지한다.
- BLOCKED: Backend 응답 후 실제 브라우저에서 pending snapshot이 완전히 제거되는지는 공동 E2E가 필요하다.

## 8. 키보드·스크린리더 구조 점검 결과

- PASS: 화면별 h1 하나, 패널 h2, 하위 영역 h3의 기존 계층을 유지한다.
- PASS: radio·checkbox와 label, fieldset·legend의 연결을 유지한다.
- PASS: 오류는 `role="alert"`, 처리·선택 상태는 `role="status"`/`aria-live` 구조를 사용한다.
- PASS: StatusBadge의 장식용 점과 loading spinner는 `aria-hidden`이다.
- PASS: 자동 focus 이동을 추가하지 않았다.
- BLOCKED: NVDA·Narrator의 실제 발화 순서와 Tab 전체 순서는 수동 확인이 필요하다.

## 9. 발견한 문제

1. production Dashboard에 내부 `WorkflowStatus`·`ScreenType`과 `Mock 화면` accessible label이 노출됨.
2. production `AppLayout`이 16:9 비율·`overflow-hidden`을 강제해 확대 시 내용 유실 가능성이 있음.
3. Dashboard 시작, 사용자 선택 확인, 약관 확인 버튼의 disabled 이유가 버튼과 직접 연결되지 않음.
4. 세션 종료 비동기 처리 중 중복 요청 차단과 별도 상태 안내가 없음.
5. STT·TTS 컨트롤이 Preview에만 마운트되어 production 세션에서 사용할 수 없음.
6. TTS에 다시 듣기·중지·속도는 있지만 일시정지·계속 듣기가 없음.
7. 상세 `RiskWarningPanel`을 production에 구성할 권위 있는 detail 이벤트 계약이 없음.

## 10. 수정한 문제

- `AppLayout`의 내부 상태 표시와 1280×720 고정 비율을 명시적 opt-in으로 바꿔 production은 스크롤 가능한 레이아웃을 사용한다. Wireframe Gallery는 기존 개발 표시와 비율을 유지한다.
- AppLayout h1을 30px 기준으로 복구하고 헤더·Action 영역이 줄바꿈할 수 있게 했다.
- Dashboard·UserDecision·Terms 확인 버튼에 상태 안내를 프로그램적으로 연결했다.
- 세션 종료에 in-flight guard, loading·disabled, live status를 추가했다.
- production 세션에 F4 VoiceController를 연결했고 reconnect·secure·exit 중 비활성화했다.
- Web Speech API adapter·hook·UI에 pause/resume 상태와 대형 버튼을 추가했다.

## 11. 수정하지 못한 문제와 담당 영역

| 항목 | 상태 | 필요 조치·담당 |
| --- | --- | --- |
| 상세 위험 경고 detail production 연결 | BLOCKED | Backend event/snapshot에 마스킹된 detail 계약 합의 후 Frontend 연결 |
| D26 secure takeover 실제 브라우저 | BLOCKED | Backend·Demo·Frontend 공동 headed E2E |
| D27 승인·거절 실제 거래 재개 | BLOCKED | `GEMINI_API_KEY`와 제어 가능한 headed browser 필요 |
| 200% 확대·NVDA·실제 Web Speech 품질 | BLOCKED | 수동 브라우저·보조기기 테스트 |

## 12. 보안·Gate 회귀 결과

- PASS: 약관·최종 확인은 수동 선택을 유지한다.
- PASS: 자동 승인·자동 거절·Demo 최종 Action을 추가하지 않았다.
- PASS: secure input value를 React 상태·이벤트·로그에 저장하지 않고 음성 인식·재생을 중단한다.
- PASS: stale frame, reconnect, Viewer Action pending, D24 decision, D26 secure, D27 confirmation Gate 조건을 변경하지 않았다.
- PASS: 위험 상태에서 금융 진행 Action을 노출하지 않는다.
- PASS: raw Backend 오류·stack·selector·내부 URL을 새로 노출하지 않았다.

## 13. 자동 테스트 결과

- D28 선택 테스트: 8 files, 131 tests PASS.
- 추가·보완 검증: 운영 내부 상태 숨김, 30px h1, 확대 레이아웃, disabled reason 연결, voice production props, secure voice Gate, TTS pause/resume, 세션 종료 exactly-once.
- D26·D27 Frontend 회귀 테스트: 8 files, 129 tests PASS.
- Main Frontend `src/**` 전체: 73 files, 1,091 tests PASS.
- Root `npm.cmd test`: Frontend 73 files·1,091 tests는 PASS했으나 전체 명령은 FAIL. 기존 Vitest가 `ai-engine/src/tests` Node test를 17개 suite로 오수집하여 `No test suite found`를 발생시켰고, `geminiApi`·`geminiStructuredOutput`은 `GEMINI_API_KEY` 미설정을 보고했다. D28에서 Vitest 설정을 변경하지 않았다.

## 14. Build 결과

- `npm.cmd run build`: PASS.
- TypeScript project build와 Vite production bundle 생성이 완료됨.

## 15. 수동 화면 점검 결과

- PASS: Vite development server가 `http://127.0.0.1:5173/`에서 HTTP 200을 반환함.
- PASS: 서버 종료 후 5173 포트 해제를 확인함.
- BLOCKED: 제어 가능한 브라우저가 없어 1280×720 screenshot, 200% 확대, Tab·Space, reconnect·secure·risk·final fixture 시각 확인을 수행하지 못함.
- 이 점검은 fixture 또는 실제 공동 E2E로 계산하지 않음.

## 16. D26·D27 E2E 미완료 상태

```text
코드 구현 완료
공동 E2E 미완료
최종 통합 완료 판정 보류
```

미완료 원인은 `GEMINI_API_KEY` 미설정과 제어 가능한 headed 브라우저 부재이다. D28 변경은 기존 `test/d26-d27-integration-e2e-verification` 브랜치와 `4340fd8acf40a437e88c3d5fcaeb1ff9c763a667` 커밋을 변경하지 않았다.

## 17. 팀 피드백 반영 여부

```text
팀 피드백: 미수집
상태: 후속 반영 대기
```

## 18. 남은 blocker

- 실제 headed browser·화면 확대·스크린리더·터치 장치 수동 검증.
- 실제 Web Speech API의 한국어 음성 품질과 브라우저별 pause/resume 검증.
- Backend 권위 detail을 활용한 상세 위험 패널 production 계약.
- D26·D27 공동 E2E 환경 준비와 재검증.
- 팀 피드백 수집·반영.

## 19. 최종 D28 판정

| 판정 항목 | 상태 | 근거 |
| --- | --- | --- |
| production 코드 접근성 점검·수정 | PASS | 글자·버튼·음성·취소·live status 보완 |
| 자동 테스트·TypeScript·build | PASS | 검증 명령 기록 참조 |
| 실제 브라우저·보조기기 수동 검증 | BLOCKED | 제어 가능한 브라우저 없음 |
| 팀 피드백 | BLOCKED | 미수집 |
| D26·D27 공동 E2E | BLOCKED | API key·headed browser 환경 |

**현재 판정: D28 Frontend 1차 완료.** 코드·자동 테스트·build 범위는 완료했지만, 팀 피드백과 실제 브라우저·보조기기 검증 후에만 `D28 최종 완료`로 판정한다.
