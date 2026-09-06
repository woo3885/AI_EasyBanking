import { useState } from 'react';
import AppLayout from '@/shared/ui/AppLayout';
import { Button } from '@/shared/ui/Button';
import type { FrontendScreenState, ScreenType } from '@/types/frontend-state';

type MockScreenType = Exclude<ScreenType, 'CERTIFICATE_PASSWORD' | 'USER_QUESTION'>;

const mockStates: Record<MockScreenType, FrontendScreenState> = {
  SESSION_READY: {
    sessionId: 'bs-20260727-001',
    workflowStatus: 'SESSION_CREATED',
    screenType: 'SESSION_READY',
    message: '안전한 금융 업무 안내를 시작할 준비가 되었습니다.',
    isConnected: true,
    isLoading: false
  },
  BROWSER_LOADING: {
    sessionId: 'bs-20260727-001',
    workflowStatus: 'PAGE_LOADING',
    screenType: 'BROWSER_LOADING',
    message: '금융 페이지를 불러오고 있습니다.',
    isConnected: true,
    isLoading: true
  },
  AI_PROGRESS: {
    sessionId: 'bs-20260727-001',
    workflowStatus: 'AI_EXECUTING',
    screenType: 'AI_PROGRESS',
    message: '정기예금 메뉴로 이동하고 있습니다.',
    isConnected: true,
    isLoading: true
  },
  PRODUCT_SELECTION: {
    sessionId: 'bs-20260727-001',
    workflowStatus: 'USER_DECISION_REQUIRED',
    screenType: 'PRODUCT_SELECTION',
    message: '가입할 상품을 직접 선택해 주세요.',
    isConnected: true,
    isLoading: false
  },
  ACCOUNT_SELECTION: {
    sessionId: 'bs-20260727-001',
    workflowStatus: 'USER_DECISION_REQUIRED',
    screenType: 'ACCOUNT_SELECTION',
    message: '출금 계좌를 직접 선택해 주세요.',
    isConnected: true,
    isLoading: false
  },
  RECIPIENT_SELECTION: {
    sessionId: 'bs-20260727-001',
    workflowStatus: 'USER_DECISION_REQUIRED',
    screenType: 'RECIPIENT_SELECTION',
    message: '송금할 수취인을 직접 선택해 주세요.',
    isConnected: true,
    isLoading: false
  },
  TERMS_AGREEMENT: {
    sessionId: 'bs-20260727-001',
    workflowStatus: 'USER_DECISION_REQUIRED',
    screenType: 'TERMS_AGREEMENT',
    message: '약관 내용을 확인하고 각 항목에 직접 동의해 주세요.',
    isConnected: true,
    isLoading: false
  },
  ACCOUNT_PASSWORD: {
    sessionId: 'bs-20260727-001',
    workflowStatus: 'SECURE_INPUT_REQUIRED',
    screenType: 'ACCOUNT_PASSWORD',
    message: '계좌 비밀번호를 금융 화면에 직접 입력해 주세요.',
    isConnected: true,
    isLoading: false
  },
  OTP_INPUT: {
    sessionId: 'bs-20260727-001',
    workflowStatus: 'SECURE_INPUT_REQUIRED',
    screenType: 'OTP_INPUT',
    message: 'OTP 번호를 금융 화면에 직접 입력해 주세요.',
    isConnected: true,
    isLoading: false
  },
  TRANSFER_CONFIRMATION: {
    sessionId: 'bs-20260727-001',
    workflowStatus: 'FINAL_CONFIRMATION_REQUIRED',
    screenType: 'TRANSFER_CONFIRMATION',
    message: '송금 내용을 확인하고 최종 승인해 주세요.',
    isConnected: true,
    isLoading: false
  },
  DEPOSIT_CONFIRMATION: {
    sessionId: 'bs-20260727-001',
    workflowStatus: 'FINAL_CONFIRMATION_REQUIRED',
    screenType: 'DEPOSIT_CONFIRMATION',
    message: '가입 내용을 확인하고 최종 승인해 주세요.',
    isConnected: true,
    isLoading: false
  },
  VOICE_PHISHING_WARNING: {
    sessionId: 'bs-20260727-001',
    workflowStatus: 'RISK_WARNING',
    screenType: 'VOICE_PHISHING_WARNING',
    message: '위험 표현이 감지되어 금융 자동화를 중단했습니다.',
    isConnected: true,
    isLoading: false
  },
  WORKFLOW_COMPLETED: {
    sessionId: 'bs-20260727-001',
    workflowStatus: 'COMPLETED',
    screenType: 'WORKFLOW_COMPLETED',
    message: '요청한 금융 업무가 완료되었습니다.',
    isConnected: true,
    isLoading: false
  },
  WORKFLOW_CANCELLED: {
    sessionId: 'bs-20260727-001',
    workflowStatus: 'CANCELLED',
    screenType: 'WORKFLOW_CANCELLED',
    message: '사용자가 금융 업무를 취소했습니다.',
    isConnected: true,
    isLoading: false
  },
  WORKFLOW_ERROR: {
    sessionId: 'bs-20260727-001',
    workflowStatus: 'ERROR',
    screenType: 'WORKFLOW_ERROR',
    message: '요청을 처리하는 중 오류가 발생했습니다.',
    isConnected: false,
    isLoading: false
  },
  INITIAL_SCREEN: {
    sessionId: null,
    workflowStatus: 'TERMINATED',
    screenType: 'INITIAL_SCREEN',
    message: '세션이 종료되었습니다. 처음 화면에서 다시 시작할 수 있습니다.',
    isConnected: false,
    isLoading: false
  }
};

const mockScreenTypes = Object.keys(mockStates) as MockScreenType[];

function getAppLayoutProps(state: FrontendScreenState) {
  return {
    workflowStatus: state.workflowStatus,
    screenType: state.screenType,
    message: state.message,
    isConnected: state.isConnected,
    isLoading: state.isLoading,
    showDeveloperStatus: true,
    fixedAspectRatio: true
  };
}

function SelectionCard({
  title,
  detail,
  selected,
  onSelect
}: {
  title: string;
  detail: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`w-full rounded border-2 p-2 text-left text-[10px] sm:p-4 sm:text-sm ${
        selected ? 'border-slate-900 bg-slate-100' : 'border-slate-300 bg-white'
      }`}
    >
      <strong className="block">{title}</strong>
      <span className="text-slate-600">{detail}</span>
    </button>
  );
}

function ChoiceScreen({
  state,
  title,
  options
}: {
  state: FrontendScreenState;
  title: string;
  options: Array<{ title: string; detail: string }>;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <AppLayout
      {...getAppLayoutProps(state)}
      actions={
        <>
          <Button variant="secondary">이전</Button>
          <Button variant="danger">취소</Button>
          <Button disabled={selected === null}>다음</Button>
        </>
      }
    >
      <div className="w-full max-w-3xl">
        <h2 className="mb-2 text-center text-base font-bold sm:mb-5 sm:text-2xl">{title}</h2>
        <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
          {options.map((option) => (
            <SelectionCard
              key={option.title}
              {...option}
              selected={selected === option.title}
              onSelect={() => setSelected(option.title)}
            />
          ))}
        </div>
        <p className="mt-2 text-center text-[10px] text-slate-600 sm:mt-4 sm:text-sm">
          선택은 AI가 대신하지 않으며 사용자가 직접 결정합니다.
        </p>
      </div>
    </AppLayout>
  );
}

function SecureInputScreen({
  state,
  label
}: {
  state: FrontendScreenState;
  label: string;
}) {
  return (
    <AppLayout
      {...getAppLayoutProps(state)}
      tone="secure"
      actions={
        <>
          <Button variant="danger">취소</Button>
          <Button>입력 완료</Button>
        </>
      }
    >
      <div className="w-full max-w-xl border-2 border-slate-800 bg-white p-3 text-center sm:p-7">
        <div className="mb-2 inline-block border-2 border-slate-800 px-3 py-1 text-[10px] font-black sm:mb-5 sm:text-base">
          개인정보 보호 모드
        </div>
        <h2 className="text-base font-bold sm:text-2xl">{label}를 직접 입력해 주세요</h2>
        <div
          role="textbox"
          aria-label={`${label} 입력 영역 예시`}
          aria-readonly="true"
          className="mx-auto mt-3 w-3/4 rounded border-2 border-dashed border-slate-500 bg-slate-100 px-4 py-2 font-mono tracking-[0.5em] text-slate-500 sm:mt-6 sm:py-4 sm:text-xl"
        >
          ● ● ● ●
        </div>
        <div className="mt-3 flex justify-center gap-2 text-[9px] font-bold sm:mt-6 sm:text-sm">
          <span className="border border-slate-600 px-2 py-1">AI 작업 중단</span>
          <span className="border border-slate-600 px-2 py-1">화면 캡처 중단</span>
        </div>
      </div>
    </AppLayout>
  );
}

function TermsAgreementScreen({ state }: { state: FrontendScreenState }) {
  const [requiredTerms, setRequiredTerms] = useState([false, false]);
  const [optionalTerm, setOptionalTerm] = useState(false);
  const allRequired = requiredTerms.every(Boolean);

  const toggleRequired = (index: number) => {
    setRequiredTerms((current) =>
      current.map((checked, itemIndex) => (itemIndex === index ? !checked : checked))
    );
  };

  return (
    <AppLayout
      {...getAppLayoutProps(state)}
      actions={
        <>
          <Button variant="secondary">이전</Button>
          <Button variant="danger">취소</Button>
          <Button disabled={!allRequired}>다음</Button>
        </>
      }
    >
      <div className="w-full max-w-3xl">
        <h2 className="mb-2 text-center text-base font-bold sm:mb-4 sm:text-2xl">약관 직접 선택</h2>
        <fieldset className="grid gap-2 text-[10px] sm:text-sm">
          <legend className="font-bold">필수 약관</legend>
          {['서비스 이용약관', '개인정보 수집·이용'].map((label, index) => (
            <label key={label} className="flex items-center gap-2 border-2 border-slate-300 p-2">
              <input
                type="checkbox"
                checked={requiredTerms[index]}
                onChange={() => toggleRequired(index)}
              />
              [필수] {label}
            </label>
          ))}
          <legend className="pt-1 font-bold">선택 약관</legend>
          <label className="flex items-center gap-2 border-2 border-slate-300 p-2">
            <input
              type="checkbox"
              checked={optionalTerm}
              onChange={() => setOptionalTerm((checked) => !checked)}
            />
            [선택] 마케팅 정보 수신
          </label>
        </fieldset>
        <p className="mt-2 text-center text-[9px] font-semibold sm:text-sm">
          전체 동의 버튼은 제공하지 않습니다. 각 약관을 직접 확인해 주세요.
        </p>
      </div>
    </AppLayout>
  );
}

function ConfirmationScreen({
  state,
  kind
}: {
  state: FrontendScreenState;
  kind: 'transfer' | 'deposit';
}) {
  const [approved, setApproved] = useState(false);
  const details =
    kind === 'transfer'
      ? [
          ['거래 유형', '계좌이체'],
          ['출금 계좌', '생활비 계좌'],
          ['수취인', '홍길동'],
          ['금액', '100,000원']
        ]
      : [
          ['상품명', '12개월 정기예금'],
          ['가입 기간', '12개월'],
          ['가입 금액', '10,000,000원'],
          ['약관 동의 결과', '필수 약관 동의 완료']
        ];

  return (
    <AppLayout
      {...getAppLayoutProps(state)}
      actions={
        <>
          <Button variant="danger">취소</Button>
          <Button size="lg" disabled={!approved}>
            {kind === 'transfer' ? '최종 승인 및 송금' : '최종 승인 및 가입'}
          </Button>
        </>
      }
    >
      <div className="w-full max-w-2xl">
        <h2 className="mb-2 text-center text-base font-bold sm:mb-4 sm:text-2xl">
          {kind === 'transfer' ? '송금 최종 확인' : '예금 가입 최종 확인'}
        </h2>
        <dl className="grid grid-cols-2 border-l border-t border-slate-400 text-[10px] sm:text-sm">
          {details.map(([term, description]) => (
            <div key={term} className="contents">
              <dt className="border-b border-r border-slate-400 bg-slate-100 p-1.5 font-bold sm:p-3">
                {term}
              </dt>
              <dd className="border-b border-r border-slate-400 p-1.5 sm:p-3">{description}</dd>
            </div>
          ))}
        </dl>
        <label className="mt-2 flex items-center justify-center gap-2 border-2 border-slate-500 p-2 text-[10px] font-bold sm:mt-4 sm:text-sm">
          <input
            type="checkbox"
            checked={approved}
            onChange={() => setApproved((checked) => !checked)}
          />
          위 내용을 확인했으며 최종 실행에 동의합니다.
        </label>
      </div>
    </AppLayout>
  );
}

function renderMockScreen(state: FrontendScreenState) {
  switch (state.screenType) {
    case 'SESSION_READY':
      return (
        <AppLayout {...getAppLayoutProps(state)} actions={<Button>시작</Button>}>
          <div className="text-center">
            <div className="mx-auto mb-3 size-12 rounded-full border-4 border-slate-500 sm:size-20" />
            <h2 className="text-lg font-black sm:text-3xl">금융 업무를 안전하게 안내합니다</h2>
            <p className="mt-2 text-[10px] text-slate-600 sm:text-base">
              AI가 일반 탐색을 돕고 중요한 선택은 사용자가 직접 결정합니다.
            </p>
          </div>
        </AppLayout>
      );
    case 'BROWSER_LOADING':
      return (
        <AppLayout
          {...getAppLayoutProps(state)}
          actions={<Button variant="danger">취소</Button>}
        >
          <div className="text-center">
            <div className="mx-auto size-10 animate-spin rounded-full border-4 border-slate-300 border-t-slate-800 sm:size-16" />
            <h2 className="mt-4 text-base font-bold sm:text-2xl">금융 페이지 로딩 중</h2>
            <p className="mt-2 text-[10px] text-slate-600 sm:text-sm">잠시만 기다려 주세요.</p>
          </div>
        </AppLayout>
      );
    case 'AI_PROGRESS':
      return (
        <AppLayout
          {...getAppLayoutProps(state)}
          actions={
            <>
              <Button variant="secondary">일시정지</Button>
              <Button variant="danger">취소</Button>
            </>
          }
        >
          <div className="w-full max-w-4xl">
            <h2 className="mb-2 text-center text-sm font-bold sm:text-xl">
              AI 작업: 정기예금 메뉴를 찾고 있습니다
            </h2>
            <div className="relative mx-auto aspect-video w-[72%] overflow-hidden border-2 border-slate-700 bg-slate-100">
              <div className="border-b border-slate-400 bg-white px-2 py-1 text-[7px] sm:text-xs">
                1280 × 720 브라우저 프레임 축소 Mock
              </div>
              <div className="grid h-full grid-cols-3 gap-[3%] p-[5%]">
                <div className="border border-slate-300 bg-white" />
                <div className="relative border border-slate-300 bg-white">
                  <div className="absolute left-[16%] top-[34%] h-[22%] w-[68%] border-4 border-dashed border-slate-900 bg-slate-200">
                    <span className="absolute -top-5 left-0 whitespace-nowrap bg-slate-900 px-1 text-[7px] text-white sm:text-[10px]">
                      Target Highlight
                    </span>
                  </div>
                </div>
                <div className="border border-slate-300 bg-white" />
              </div>
            </div>
          </div>
        </AppLayout>
      );
    case 'PRODUCT_SELECTION':
      return (
        <ChoiceScreen
          state={state}
          title="가입할 상품 선택"
          options={[
            { title: '12개월 정기예금', detail: '기본금리 연 3.2%' },
            { title: '우대금리 정기예금', detail: '조건 충족 시 연 3.5%' }
          ]}
        />
      );
    case 'ACCOUNT_SELECTION':
      return (
        <ChoiceScreen
          state={state}
          title="출금 계좌 선택"
          options={[
            { title: '생활비 계좌', detail: '계좌번호 110-***-**1234' },
            { title: '급여 계좌', detail: '계좌번호 110-***-**5678' }
          ]}
        />
      );
    case 'RECIPIENT_SELECTION':
      return (
        <ChoiceScreen
          state={state}
          title="수취인 선택"
          options={[
            { title: '홍길동', detail: '최근 이체 대상' },
            { title: '김영희', detail: '등록된 수취인' }
          ]}
        />
      );
    case 'TERMS_AGREEMENT':
      return <TermsAgreementScreen state={state} />;
    case 'ACCOUNT_PASSWORD':
      return <SecureInputScreen state={state} label="계좌 비밀번호" />;
    case 'OTP_INPUT':
      return <SecureInputScreen state={state} label="OTP" />;
    case 'TRANSFER_CONFIRMATION':
      return <ConfirmationScreen state={state} kind="transfer" />;
    case 'DEPOSIT_CONFIRMATION':
      return <ConfirmationScreen state={state} kind="deposit" />;
    case 'VOICE_PHISHING_WARNING':
      return (
        <AppLayout
          {...getAppLayoutProps(state)}
          tone="danger"
          actions={<Button variant="danger">세션 종료</Button>}
        >
          <div className="max-w-2xl border-4 border-red-800 bg-white p-4 text-center sm:p-8">
            <div className="text-3xl font-black text-red-800 sm:text-6xl">위험 경고</div>
            <h2 className="mt-2 text-sm font-bold sm:mt-5 sm:text-2xl">
              금융 자동화가 즉시 중단되었습니다
            </h2>
            <p className="mt-2 text-[10px] sm:mt-4 sm:text-base">
              안전계좌 송금을 요구받았다면 보이스피싱일 가능성이 있습니다.
            </p>
            <p className="mt-2 border-t border-red-300 pt-2 text-[9px] font-bold sm:mt-4 sm:pt-4 sm:text-sm">
              금융회사 또는 기관의 공식 연락처를 직접 확인해 주세요.
            </p>
          </div>
        </AppLayout>
      );
    case 'WORKFLOW_COMPLETED':
      return (
        <AppLayout {...getAppLayoutProps(state)} actions={<Button>처음으로</Button>}>
          <div className="text-center">
            <div className="text-3xl sm:text-6xl">✓</div>
            <h2 className="text-lg font-black sm:text-3xl">업무가 완료되었습니다</h2>
            <div className="mt-3 border-2 border-slate-400 bg-white p-3 text-[10px] sm:text-sm">
              처리 결과: 계좌이체 요청이 정상적으로 완료됨
            </div>
          </div>
        </AppLayout>
      );
    case 'WORKFLOW_CANCELLED':
      return (
        <AppLayout {...getAppLayoutProps(state)} actions={<Button>처음으로</Button>}>
          <div className="text-center">
            <h2 className="text-lg font-black sm:text-3xl">업무가 취소되었습니다</h2>
            <p className="mt-3 text-[10px] text-slate-600 sm:text-base">
              사용자의 요청으로 진행 중인 작업을 중단했습니다.
            </p>
          </div>
        </AppLayout>
      );
    case 'WORKFLOW_ERROR':
      return (
        <AppLayout
          {...getAppLayoutProps(state)}
          actions={
            <>
              <Button variant="secondary">재시도</Button>
              <Button variant="danger">종료</Button>
            </>
          }
        >
          <div className="text-center">
            <div className="text-3xl font-black sm:text-6xl">!</div>
            <h2 className="text-lg font-black sm:text-3xl">처리 중 오류가 발생했습니다</h2>
            <p className="mt-3 text-[10px] text-slate-600 sm:text-base">
              연결 상태를 확인한 뒤 다시 시도해 주세요.
            </p>
          </div>
        </AppLayout>
      );
    case 'INITIAL_SCREEN':
      return (
        <AppLayout {...getAppLayoutProps(state)} actions={<Button>처음 화면</Button>}>
          <div className="text-center">
            <h2 className="text-lg font-black sm:text-3xl">세션 종료</h2>
            <p className="mt-3 text-[10px] text-slate-600 sm:text-base">
              안전하게 세션을 정리했습니다.
            </p>
          </div>
        </AppLayout>
      );
    default:
      return null;
  }
}

export default function FrontendWireframeGallery() {
  const [selectedScreen, setSelectedScreen] = useState<MockScreenType>('SESSION_READY');
  const currentState = mockStates[selectedScreen];

  return (
    <div className="min-h-screen bg-slate-200 p-3 sm:p-6">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-3 flex flex-col gap-2 border-2 border-dashed border-slate-500 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <strong className="block text-sm">개발용 Mock 화면 선택기</strong>
            <span className="text-xs text-slate-600">실제 서비스 UI가 아닌 1일차 정적 와이어프레임입니다.</span>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold">
            ScreenType
            <select
              aria-label="Mock ScreenType"
              value={selectedScreen}
              onChange={(event) => setSelectedScreen(event.target.value as MockScreenType)}
              className="max-w-full border-2 border-slate-500 bg-white px-2 py-1"
            >
              {mockScreenTypes.map((screenType) => (
                <option key={screenType} value={screenType}>
                  {screenType}
                </option>
              ))}
            </select>
          </label>
        </div>

        {renderMockScreen(currentState)}

        <p className="mt-2 text-center text-xs text-slate-600">
          기준 캔버스 1280 × 720 · 좌표 원점 (0, 0) · 화면 폭에 맞춰 비율 유지 축소
        </p>
      </div>
    </div>
  );
}
