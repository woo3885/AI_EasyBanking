# D15 Sanitized DOM · Target elementId 통합 규격
**문서 버전:** v1.0  
**상태:** 확정  
**적용 범위:** D13 ~ D16 및 AI Action 연동

---

# 0. 규격 목적

이 문서는 아래 두 규격을 하나로 확정한다.

1. **Sanitized DOM 규격**
   - 브라우저 화면에서 AI 판단에 필요한 정보만 추출
   - 입력값·개인정보·불필요한 HTML 정보 제거
   - AI에는 안전한 JSON만 전달

2. **Target elementId 규격**
   - AI가 CSS Selector/XPath를 직접 만들지 않도록 함
   - AI는 `elementId`로만 대상 요소를 지정
   - Backend가 `elementId → 실제 Playwright Locator`를 관리
   - 오래된 elementId·위조 elementId·존재하지 않는 elementId를 차단

핵심 원칙:

> Raw DOM은 AI 경계를 넘어가지 않는다.

> 사용자가 입력한 실제 값은 AI 판단 데이터에 포함하지 않는다.

> AI는 현재 Sanitized DOM에 포함된 elementId만 Target으로 사용할 수 있다.

> 실제 Locator, Selector, XPath는 Backend 내부에서만 관리한다.

---

# 1. 전체 처리 흐름

```text
실제 웹페이지
   ↓
D13 Interactive Element 추출
   ↓
elementId 발급 + Element Registry 등록
   ↓
D14 Metadata 추출
(role / aria-label / visible / enabled / boundingBox)
   ↓
D15 개인정보 제거·마스킹·길이 제한
   ↓
SanitizedDomSnapshot
   ↓
AI Engine
   ↓
BrowserAction
(targetElementId)
   ↓
Backend Target 검증
   ↓
Element Registry
   ↓
실제 Playwright Locator
   ↓
Action 실행
```

---

# PART A. Sanitized DOM 규격

# 2. 최종 산출물

최종 AI 전달 객체 이름:

```text
SanitizedDomSnapshot
```

권장 JSON 구조:

```json
{
  "schemaVersion": "1.0",
  "snapshotId": "snap-a1b2c3d4",
  "page": {
    "url": "https://demo-bank.example/deposit",
    "title": "예금 상품 선택"
  },
  "elements": [
    {
      "elementId": "el-a1b2c3d4-001",
      "tag": "button",
      "role": "button",
      "text": "다음",
      "ariaLabel": "다음 단계",
      "placeholder": null,
      "inputType": null,
      "visible": true,
      "enabled": true,
      "boundingBox": {
        "x": 820,
        "y": 650,
        "width": 120,
        "height": 48
      },
      "securityPolicy": "NORMAL"
    }
  ]
}
```

---

# 3. page 정보 규칙

## 3.1 page.url

AI에는 기본적으로 아래만 전달한다.

```text
scheme + host + path
```

기본적으로 제거:

```text
query string
fragment
username/password URL component
```

예:

```text
원본:
https://bank.example/transfer?account=123456&token=abc#step2

AI 전달:
https://bank.example/transfer
```

URL의 query parameter가 향후 반드시 필요한 경우에는
별도 Allowlist 규칙을 추가한 뒤 허용한다.

## 3.2 page.title

- 개인정보 마스킹 적용
- 최대 200자
- 초과 시 `[TRUNCATED]`

---

# 4. AI 전달 허용 필드

기본 Allowlist:

```text
elementId
tag
role
text
ariaLabel
placeholder
inputType
visible
enabled
boundingBox
securityPolicy
```

`boundingBox`:

```text
x
y
width
height
```

---

# 5. AI 전달 금지 데이터

Sanitized DOM에는 아래 데이터를 포함하지 않는다.

```text
input.value
textarea.value
contenteditable 내부 실제 입력값
password
OTP
인증번호
주민등록번호
카드번호
계좌번호 원문
전화번호 원문
이메일 원문
사용자가 입력한 이름 등 개인정보 원문

cookie
document.cookie
sessionStorage
localStorage

Authorization header
access token
refresh token
CSRF token

innerHTML
outerHTML
script 내용
style 내용

onclick
onchange
oninput 등 이벤트 핸들러
href 원문
src 원문
data-* 전체
class 전체
```

특히 `value` 필드는 AI 전달 JSON 규격 자체에 존재하지 않는다.

---

# 6. 입력 요소 처리 규칙

실제 DOM:

```html
<input
    type="password"
    value="MyPassword123!"
    aria-label="인터넷뱅킹 비밀번호">
```

AI 전달:

```json
{
  "elementId": "el-a1b2c3d4-105",
  "tag": "input",
  "role": "textbox",
  "text": null,
  "ariaLabel": "인터넷뱅킹 비밀번호",
  "placeholder": null,
  "inputType": "password",
  "visible": true,
  "enabled": true,
  "boundingBox": {
    "x": 100,
    "y": 250,
    "width": 240,
    "height": 40
  },
  "securityPolicy": "SECURE_INPUT"
}
```

AI에는 입력값 자체가 전달되지 않는다.

---

# 7. 개인정보 마스킹

마스킹 대상:

```text
text
ariaLabel
placeholder
page.title
```

예:

```text
010-1234-5678
→ [PHONE]

abc@example.com
→ [EMAIL]

110-123-456789
→ [ACCOUNT]
```

이름처럼 단순 패턴으로 정확히 판단하기 어려운 데이터는
무조건 모든 한글 이름을 제거하지 않는다.

이름 마스킹은 다음 정보를 함께 활용하는 구조로 한다.

```text
label
aria-label
주변 필드명
민감 필드 분류 결과
명확한 데이터 패턴
```

---

# 8. securityPolicy 규격

AI에 전달 가능한 정규화된 정책 값:

```text
NORMAL
USER_DECISION
SECURE_INPUT
FINAL_CONFIRMATION
BLOCKED
```

의미:

| 값 | 의미 |
|---|---|
| NORMAL | 일반 자동화 가능 |
| USER_DECISION | 사용자가 직접 선택해야 함 |
| SECURE_INPUT | 비밀번호·OTP 등 사용자가 직접 입력 |
| FINAL_CONFIRMATION | 최종 거래·가입 전 사용자 승인 필요 |
| BLOCKED | 자동 실행 금지 |

HTML의 실제 `data-*` 값 전체를 AI에 전달하지 않는다.

Backend에서 정책을 판정한 뒤 위 값으로 정규화한다.

---

# 9. 길이·개수 제한

```text
page.title 최대: 200자
element.text 최대: 200자
ariaLabel 최대: 200자
placeholder 최대: 200자

한 Snapshot 최대 element: 300개
```

초과 문자열:

```text
[TRUNCATED]
```

을 붙여 절단한다.

---

# 10. 추출 대상 Element

D13 기본 대상:

```text
a
button
input
select
textarea
summary
```

추가 대상:

```text
[role="button"]
[role="link"]
[role="checkbox"]
[role="radio"]
[role="combobox"]
[role="textbox"]
[role="option"]
[tabindex]
contenteditable
```

단순 장식 요소나 실행 불가능한 숨김 요소는 기본 제외한다.

---

# 11. visible / enabled 규칙

AI에는 실제 실행 가능성 판단을 위해 아래를 제공한다.

```text
visible
enabled
```

기본 원칙:

- 보이지 않는 요소는 `visible=false`
- disabled 요소는 `enabled=false`
- Action 실행 시 Backend가 다시 한 번 현재 상태를 확인
- Sanitized DOM의 상태만 믿고 바로 실행하지 않는다

---

# 12. checked / selected 상태

v1.0에서는 AI용 Sanitized DOM에 사용자가 선택한 실제 상태값을
기본 전달하지 않는다.

즉 아래 필드는 기본 규격에서 제외한다.

```text
checked
selectedValue
inputValue
```

사용자 결정 결과는 `/decisions` 등 별도 사용자 결정 API를 통해 처리한다.

향후 UI 판단에 반드시 필요해질 경우,
민감도 검토 후 별도 필드로 확장한다.

---

# PART B. Target elementId 규격

# 13. elementId 목적

`elementId`는 AI와 실제 DOM/Locator 사이의 안전한 간접 참조 ID다.

AI:

```text
elementId만 사용
```

Backend:

```text
elementId
↓
Element Registry
↓
실제 Locator
```

AI에게 다음 정보를 노출하지 않는다.

```text
CSS Selector
XPath
Playwright Locator
DOM Node reference
실제 내부 Registry key 구조
```

---

# 14. elementId 형식

확정 형식:

```text
el-{snapshotToken}-{sequence}
```

예:

```text
el-a1b2c3d4-001
el-a1b2c3d4-002
el-a1b2c3d4-105
```

규칙:

```text
prefix: el-
snapshotToken: 현재 Snapshot을 식별하는 비의미성 토큰
sequence: Snapshot 내 순번
```

권장 정규식:

```regex
^el-[a-z0-9]{8}-[0-9]{3}$
```

`elementId`에는 아래 정보를 넣지 않는다.

```text
사용자 이름
계좌번호
버튼 text
DOM id
CSS selector
URL
개인정보
```

즉 elementId는 **Opaque ID**로 취급한다.

---

# 15. snapshotId 형식

확정 형식:

```text
snap-{snapshotToken}
```

예:

```text
snap-a1b2c3d4
```

같은 Snapshot의 elementId는 동일한 snapshotToken을 가진다.

예:

```text
snapshotId:
snap-a1b2c3d4

elements:
el-a1b2c3d4-001
el-a1b2c3d4-002
el-a1b2c3d4-003
```

---

# 16. elementId 유일성

elementId는 최소한 다음 범위에서 유일해야 한다.

```text
해당 Automation Session의 활성 Snapshot
```

실제 구현에서는 snapshotToken을 새로 발급하므로
세션 내 이전 Snapshot과도 사실상 충돌하지 않도록 한다.

동일 elementId를 다른 요소에 재사용하지 않는다.

---

# 17. elementId 재발급 규칙

새 Sanitized DOM Snapshot을 생성하면
**모든 elementId를 새로 발급**한다.

재발급 조건:

```text
새 AI 판단 Cycle 시작
페이지 navigation 완료
새 탭 / popup으로 current Page 변경
페이지 reload
명시적인 DOM Snapshot 재생성
Action 실패 후 재탐색을 위해 새 Snapshot 생성
```

예:

```text
기존:
snap-a1b2c3d4
el-a1b2c3d4-001

새 Snapshot:
snap-f5e6d7c8
el-f5e6d7c8-001
```

이전 elementId는 새 Snapshot에서 사용할 수 없다.

---

# 18. elementId 수명

elementId의 기본 수명:

```text
현재 Snapshot이 활성 상태인 동안
```

다음 시점에 만료:

```text
새 Snapshot 생성
세션 종료
페이지 변경
BrowserContext 종료
Registry 초기화
```

오래된 elementId를 장기간 재사용하지 않는다.

---

# 19. Element Registry 규격

Backend 내부 개념 구조:

```text
ElementRegistryEntry
- sessionId
- snapshotId
- elementId
- pageIdentity
- locatorDescriptor
- createdAt
```

`locatorDescriptor`는 Backend 내부 전용이다.

AI 응답이나 WebSocket 이벤트에 포함하지 않는다.

---

# 20. Locator 저장 원칙

elementId는 실제 Locator와 직접 연결한다.

예:

```text
el-a1b2c3d4-017
↓
Backend Element Registry
↓
Playwright Locator / LocatorDescriptor
```

Locator는 Backend가 실행 직전에 다시 현재 DOM에서 확인한다.

다음 조건을 다시 검증한다.

```text
요소 존재
visible 여부
enabled 여부
현재 Page 소속 여부
보안 Policy
Action Type과 Target 호환 여부
```

---

# 21. AI Target 규격

AI Action 예:

```json
{
  "actionType": "CLICK",
  "targetElementId": "el-a1b2c3d4-017"
}
```

Target이 필요한 Action:

```text
CLICK
TYPE
SELECT
```

필요에 따라 Target을 사용할 수 있는 Action:

```text
SCROLL
PRESS_KEY
```

Target이 기본적으로 필요 없는 Action:

```text
GO_BACK
REFRESH
WAIT
WAIT_FOR_USER
PAUSE_FOR_SECURE_INPUT
REQUEST_FINAL_CONFIRMATION
STOP
NONE
```

최종 Action별 필수 Target 여부는 `BrowserActionValidator`에서 검증한다.

---

# 22. AI가 임의 elementId를 생성한 경우

AI가 Sanitized DOM에 존재하지 않는 ID를 보내면 실행하지 않는다.

예:

```text
AI:
el-zzzzzzzz-999

현재 Registry:
존재하지 않음
```

처리:

```text
Action 실행 차단
→ Target 검증 실패
→ 최신 Snapshot 재생성
→ AI 재판단 요청
```

임의 Selector fallback을 하지 않는다.

---

# 23. 오래된 elementId 처리

예:

```text
AI가 받은 Snapshot:
snap-a1b2c3d4

현재 Backend Snapshot:
snap-f5e6d7c8

AI 요청:
el-a1b2c3d4-003
```

이 요청은 **Stale Target**으로 처리한다.

동작:

```text
실행 금지
→ 오래된 Target 폐기
→ 현재 Snapshot 기준 재판단
```

이전 Snapshot의 elementId를 현재 DOM의 비슷한 요소에
임의로 매핑하지 않는다.

---

# 24. DOM 변경 시 Locator 재탐색

같은 Snapshot의 요소가 동적 DOM 변경으로 Locator 실행에 실패할 수 있다.

Backend는 D12 재탐색 정책에 따라
제한된 범위에서만 재탐색할 수 있다.

원칙:

```text
재탐색 횟수 제한
무한 재시도 금지
후보가 여러 개면 자동 선택 금지
대상이 명확하지 않으면 새 Snapshot 생성
```

Selector/Text가 비슷하다는 이유만으로
다른 금융상품·계좌·수취인 요소를 임의 선택하지 않는다.

---

# 25. 페이지 이동·새 탭과 elementId

D10의 latest Page 추적과 연결한다.

현재 Page가 변경되면:

```text
기존 Element Registry 무효화
↓
새 Page 기준 Snapshot 생성
↓
새 snapshotId
↓
새 elementId 발급
```

기존 Page의 elementId를 새 Page에서 사용할 수 없다.

---

# 26. Action 실행 직전 최종 검증

elementId가 Registry에 존재하더라도
바로 실행하지 않는다.

실행 직전:

```text
1. 현재 Session 확인
2. 현재 Snapshot 확인
3. elementId 존재 확인
4. current Page 일치 확인
5. 요소 존재 확인
6. visible / enabled 재확인
7. ActionType 허용 여부 확인
8. securityPolicy 확인
9. 사용자 결정 / 보안 입력 / 최종 승인 Gate 확인
10. 통과한 경우에만 Playwright Action 실행
```

---

# 27. 보안상 금지되는 Fallback

아래 방식은 사용하지 않는다.

```text
AI가 준 text로 임의 클릭
AI가 CSS Selector 직접 전달
AI가 XPath 직접 전달
Target을 못 찾았을 때 첫 번째 비슷한 버튼 클릭
계좌/상품/수취인을 텍스트 유사도로 자동 선택
오래된 elementId를 새 DOM 요소에 강제 재매핑
```

---

# PART C. D13~D16 역할 분리

# 28. 일정별 역할

| Day | 역할 | 핵심 산출물 |
|---|---|---|
| D13 | Interactive Element 추출 + elementId 발급 | `InteractiveElement`, `InteractiveDomExtractor` |
| D14 | role·aria-label·visible·enabled·좌표 추출 | `ElementMetadataExtractor` |
| D15 | 개인정보 마스킹·불필요 데이터 제거 | `SanitizedDomSnapshot`, `DomSanitizer` |
| D16 | elementId와 실제 Locator 연결·재탐색 | `ElementRegistry` |

---

# 29. 권장 클래스 구조

```text
Browser Page
     ↓
InteractiveDomExtractor
     ↓
InteractiveElement
     ↓
ElementMetadataExtractor
     ↓
RawDomSnapshot
     ↓
ElementRegistry 등록
     ↓
DomSanitizer
     ↓
SanitizedDomSnapshot
     ↓
AI Engine
     ↓
BrowserAction(targetElementId)
     ↓
BrowserActionValidator
     ↓
ElementRegistry.resolve(elementId)
     ↓
Playwright Locator
     ↓
BrowserActionExecutor
```

---

# PART D. 완료 기준

# 30. Sanitized DOM 완료 기준

```text
✓ 일반 버튼 text 전달
✓ elementId 전달
✓ role 전달
✓ aria-label 전달
✓ visible / enabled 전달
✓ boundingBox 전달

✓ password value 미전달
✓ 일반 input value 미전달
✓ OTP 미전달
✓ 이메일 마스킹
✓ 전화번호 마스킹
✓ 계좌번호 마스킹

✓ query string 기본 제거
✓ fragment 제거

✓ script 제거
✓ style 제거
✓ innerHTML 미전달
✓ outerHTML 미전달
✓ cookie/storage/token 미전달

✓ 긴 text 제한
✓ 최대 Element 300개 제한

✓ AI에는 Sanitized DOM만 전달
```

---

# 31. Target elementId 완료 기준

```text
✓ elementId가 Snapshot별로 발급됨
✓ elementId가 Opaque ID임
✓ 개인정보가 ID에 포함되지 않음
✓ elementId → Locator Registry 연결

✓ 현재 Registry의 elementId만 실행 가능
✓ 임의 elementId 차단
✓ 이전 Snapshot elementId 차단
✓ 새 Snapshot 생성 시 기존 ID 무효화

✓ 새 탭/페이지 이동 시 기존 Registry 무효화
✓ current Page 불일치 시 실행 차단

✓ 실행 직전 visible/enabled 재검증
✓ securityPolicy 재검증

✓ Target 미존재 시 임의 Selector fallback 금지
✓ 유사한 상품/계좌/수취인 자동 선택 금지
✓ Locator 재탐색 횟수 제한
✓ 무한 재시도 금지
```

---

# 32. 최종 확정 사항

## Sanitized DOM

```text
AI 입력 = SanitizedDomSnapshot만 허용
Raw DOM 전달 금지
사용자 입력값 전달 금지
민감 텍스트 마스킹
Attribute Allowlist 적용
최대 300 Element
문자열 최대 200자
```

## Target elementId

```text
형식 = el-{snapshotToken}-{sequence}
예시 = el-a1b2c3d4-001

Snapshot 형식 = snap-{snapshotToken}
예시 = snap-a1b2c3d4

AI는 elementId만 Target으로 지정
Selector/XPath는 Backend 내부 전용
새 Snapshot마다 elementId 재발급
오래된/위조/미존재 elementId 실행 금지
실행 직전 현재 Page·요소·보안 Policy 재검증
```

이 문서를 D13~D16 및 AI BrowserAction Target 연동의 기준 규격으로 사용한다.
