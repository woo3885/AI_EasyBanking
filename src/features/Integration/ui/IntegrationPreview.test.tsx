import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as mockTransportModule from '@/features/Integration/api/mock-integration-transport';
import type { IntegrationTransport } from '@/features/Integration/api/integration-transport';
import {
  ACCOUNT_SELECTION_FRAME,
  RECIPIENT_SELECTION_FRAME
} from '@/features/Integration/mocks/integration-scenarios';
import {
  INTEGRATION_PREVIEW_SELECTORS
} from './IntegrationPreview';
import IntegrationPreview from './IntegrationPreview';

const clearRect = vi.fn();
const drawImage = vi.fn();
const canvasContext = {
  clearRect,
  drawImage
} as unknown as CanvasRenderingContext2D;

class MockImage {
  static instances: MockImage[] = [];

  onload: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  src = '';

  constructor() {
    MockImage.instances.push(this);
  }
}

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();

  constructor(_callback: ResizeObserverCallback) {}
}

function completeLatestImageLoad() {
  const image = MockImage.instances[MockImage.instances.length - 1];
  act(() => {
    image?.onload?.(new Event('load'));
  });
}

function startAccountScenario() {
  fireEvent.click(
    screen.getByTestId(INTEGRATION_PREVIEW_SELECTORS.startButton)
  );
}

function startTermsScenario() {
  fireEvent.change(
    screen.getByTestId(INTEGRATION_PREVIEW_SELECTORS.scenarioSelect),
    { target: { value: 'DEPOSIT_TERMS_AGREEMENT' } }
  );
  startAccountScenario();
}

beforeEach(() => {
  clearRect.mockClear();
  drawImage.mockClear();
  MockImage.instances = [];
  vi.stubGlobal('Image', MockImage);
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    canvasContext
  );
  vi.spyOn(
    HTMLCanvasElement.prototype,
    'getBoundingClientRect'
  ).mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 640,
    bottom: 360,
    width: 640,
    height: 360,
    toJSON: () => undefined
  } as DOMRect);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('IntegrationPreview', () => {
  it('필수 selector의 id와 data-testid를 동일하게 렌더링한다', () => {
    render(<IntegrationPreview />);

    Object.values(INTEGRATION_PREVIEW_SELECTORS).forEach((selector) => {
      expect(screen.getByTestId(selector)).toHaveAttribute('id', selector);
    });
  });

  it('명확한 heading과 고정 Mock 경고를 표시한다', () => {
    render(<IntegrationPreview />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'D16 통합 Mock Preview' })
    ).toBeInTheDocument();
    const notice = screen.getByTestId(INTEGRATION_PREVIEW_SELECTORS.notice);
    expect(notice).toHaveTextContent('실제 Backend, AI Engine, WebSocket 및 데모사이트에 연결되지 않았습니다.');
    expect(notice).toHaveTextContent('표시되는 frame·Target·상태·선택 요청은 로컬 Mock입니다.');
    expect(notice).toHaveTextContent('실제 금융거래나 브라우저 조작은 발생하지 않습니다.');
  });

  it('mount 시 disconnected이며 자동으로 scenario를 시작하지 않는다', () => {
    render(<IntegrationPreview />);

    expect(
      screen.getByTestId(INTEGRATION_PREVIEW_SELECTORS.connectionStatus)
    ).toHaveTextContent('Mock 연결 전');
    expect(
      screen.getByTestId(INTEGRATION_PREVIEW_SELECTORS.phaseStatus)
    ).toHaveTextContent('시작 전');
    expect(MockImage.instances).toHaveLength(0);
    expect(screen.queryByTestId('panel-user-decision')).not.toBeInTheDocument();
  });

  it('start 클릭 후 계좌 frame·상태·선택 request를 표시한다', () => {
    render(<IntegrationPreview />);

    startAccountScenario();

    expect(
      screen.getByTestId(INTEGRATION_PREVIEW_SELECTORS.startButton)
    ).toBeDisabled();
    expect(
      screen.getByTestId(INTEGRATION_PREVIEW_SELECTORS.connectionStatus)
    ).toHaveTextContent('로컬 Mock 연결됨');
    expect(MockImage.instances[MockImage.instances.length - 1]?.src).toBe(
      ACCOUNT_SELECTION_FRAME.imageSrc
    );
    expect(screen.getByTestId('viewer-remote-screen')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-remote-screen')).toBeInTheDocument();
    expect(screen.getByTestId('panel-workflow-status')).toHaveTextContent(
      '사용자 선택 필요'
    );
    expect(screen.getByTestId('panel-user-decision')).toBeInTheDocument();
  });

  it('최신 frame이 READY가 된 뒤에만 Target과 focus effect를 표시한다', () => {
    render(<IntegrationPreview />);
    startAccountScenario();

    expect(
      screen.queryByTestId('overlay-target-highlight')
    ).not.toBeInTheDocument();

    completeLatestImageLoad();

    expect(screen.getByTestId('overlay-target-highlight')).toBeInTheDocument();
    expect(screen.getByTestId('border-target-highlight')).toBeInTheDocument();
    expect(screen.getByTestId('pointer-target-highlight')).toBeInTheDocument();
    expect(screen.getByTestId('magnifier-target-highlight')).toBeInTheDocument();
  });

  it('초기 option은 미선택이고 확인 버튼은 disabled다', () => {
    render(<IntegrationPreview />);
    startAccountScenario();

    expect(
      screen.getByRole('radio', { name: /생활비 계좌/ })
    ).not.toBeChecked();
    expect(
      screen.getByRole('radio', { name: /저축 계좌/ })
    ).not.toBeChecked();
    expect(screen.getByTestId('btn-user-decision-confirm')).toBeDisabled();
  });

  it('option 선택만으로 confirm을 호출하거나 단계를 바꾸지 않는다', () => {
    render(<IntegrationPreview />);
    startAccountScenario();

    fireEvent.click(screen.getByRole('radio', { name: /생활비 계좌/ }));

    expect(
      screen.getByRole('radio', { name: /생활비 계좌/ })
    ).toBeChecked();
    expect(screen.getByTestId('btn-user-decision-confirm')).toBeEnabled();
    expect(
      screen.getByTestId(INTEGRATION_PREVIEW_SELECTORS.phaseStatus)
    ).toHaveTextContent('Mock 계좌 선택');
    expect(MockImage.instances).toHaveLength(1);
  });

  it('별도 확인 후 recipient frame·target과 baseline 대기 상태로 전환한다', () => {
    render(<IntegrationPreview />);
    startAccountScenario();
    fireEvent.click(screen.getByRole('radio', { name: /생활비 계좌/ }));

    fireEvent.click(screen.getByTestId('btn-user-decision-confirm'));

    expect(MockImage.instances[MockImage.instances.length - 1]?.src).toBe(
      RECIPIENT_SELECTION_FRAME.imageSrc
    );
    expect(
      screen.getByTestId(INTEGRATION_PREVIEW_SELECTORS.phaseStatus)
    ).toHaveTextContent('기준 시나리오 도달');
    expect(screen.getByTestId('panel-user-decision')).toHaveTextContent(
      'Mock 수취인 선택 대기'
    );
    expect(screen.getByTestId('panel-user-decision')).toHaveTextContent(
      '현재는 선택 기능을 사용할 수 없습니다.'
    );
    expect(screen.getByTestId('btn-user-decision-confirm')).toBeDisabled();
    expect(
      screen.getByTestId(INTEGRATION_PREVIEW_SELECTORS.lastActionStatus)
    ).toHaveTextContent('Mock 선택 확인 callback');

    completeLatestImageLoad();
    expect(screen.getByTestId('status-target-highlight')).toHaveTextContent(
      'Mock 안내: 수취인 선택 위치입니다.'
    );
    expect(screen.getByTestId('status-target-highlight')).not.toHaveTextContent(
      'btn-select-recipient-hong-gildong'
    );
  });

  it('recipient 기준점에서도 USER_DECISION_REQUIRED를 유지한다', () => {
    render(<IntegrationPreview />);
    startAccountScenario();
    fireEvent.click(screen.getByRole('radio', { name: /저축 계좌/ }));
    fireEvent.click(screen.getByTestId('btn-user-decision-confirm'));

    expect(screen.getByTestId('panel-workflow-status')).toHaveTextContent(
      '사용자 선택 필요'
    );
    expect(document.body).not.toHaveTextContent('금융거래 완료');
  });

  it('약관 scenario는 모두 미선택이며 필수 Gate를 유지한다', () => {
    render(<IntegrationPreview />);
    startTermsScenario();

    const service = screen.getByRole('checkbox', { name: /서비스 이용약관/ });
    const personal = screen.getByRole('checkbox', { name: /개인정보 수집·이용/ });
    const marketing = screen.getByRole('checkbox', { name: /마케팅 정보 수신/ });
    const confirm = screen.getByTestId('btn-terms-agreement-confirm');

    expect(service).not.toBeChecked();
    expect(personal).not.toBeChecked();
    expect(marketing).not.toBeChecked();
    expect(confirm).toBeDisabled();

    fireEvent.click(marketing);
    expect(confirm).toBeDisabled();
    fireEvent.click(service);
    expect(confirm).toBeDisabled();
    fireEvent.click(personal);
    expect(confirm).toBeEnabled();
    expect(screen.queryByRole('checkbox', { name: /전체 동의/ })).not.toBeInTheDocument();
  });

  it('약관 confirm은 Mock callback만 기록하고 workflow를 진행하지 않는다', () => {
    render(<IntegrationPreview />);
    startTermsScenario();
    fireEvent.click(screen.getByRole('checkbox', { name: /서비스 이용약관/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /개인정보 수집·이용/ }));

    fireEvent.click(screen.getByTestId('btn-terms-agreement-confirm'));

    expect(
      screen.getByTestId(INTEGRATION_PREVIEW_SELECTORS.lastActionStatus)
    ).toHaveTextContent('Mock 약관 선택 확인 callback');
    expect(
      screen.getByTestId(INTEGRATION_PREVIEW_SELECTORS.phaseStatus)
    ).toHaveTextContent('Mock 약관 선택');
    expect(screen.getByTestId('panel-terms-agreement')).toBeInTheDocument();
  });

  it('F4를 음성 transport 미연결·강제 비활성 상태로 조합한다', () => {
    render(<IntegrationPreview />);

    expect(screen.getByText('음성 transport 미연결')).toBeInTheDocument();
    expect(screen.getByTestId('btn-stt-start')).toBeDisabled();
    expect(screen.getByTestId('btn-tts-play')).toBeDisabled();
  });

  it('F5 pause와 cancel은 실제 동작 없이 Mock 요청만 기록한다', () => {
    render(<IntegrationPreview />);
    startAccountScenario();

    fireEvent.click(screen.getByTestId('btn-controller-pause'));
    expect(
      screen.getByTestId(INTEGRATION_PREVIEW_SELECTORS.lastActionStatus)
    ).toHaveTextContent('Mock 요청: 로컬 일시정지');

    fireEvent.click(screen.getByTestId('btn-controller-cancel'));
    fireEvent.click(screen.getByTestId('btn-controller-cancel-confirm'));
    expect(
      screen.getByTestId(INTEGRATION_PREVIEW_SELECTORS.lastActionStatus)
    ).toHaveTextContent('Mock 요청: 실제 세션 취소는 수행하지 않습니다.');
  });

  it('reset은 frame·target·선택·마지막 action을 초기화한다', () => {
    render(<IntegrationPreview />);
    startAccountScenario();
    fireEvent.click(screen.getByRole('radio', { name: /생활비 계좌/ }));
    completeLatestImageLoad();

    fireEvent.click(
      screen.getByTestId(INTEGRATION_PREVIEW_SELECTORS.resetButton)
    );

    expect(
      screen.getByTestId(INTEGRATION_PREVIEW_SELECTORS.connectionStatus)
    ).toHaveTextContent('Mock 연결 전');
    expect(screen.queryByTestId('panel-user-decision')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('overlay-target-highlight')
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId(INTEGRATION_PREVIEW_SELECTORS.lastActionStatus)
    ).toHaveTextContent('아직 요청한 Mock 동작이 없습니다.');
  });

  it('unmount 시 unsubscribe와 transport stop을 호출한다', () => {
    const actualTransport = mockTransportModule.createMockIntegrationTransport();
    const unsubscribe = vi.fn();
    const originalSubscribe = actualTransport.subscribe.bind(actualTransport);
    const transport: IntegrationTransport = {
      ...actualTransport,
      subscribe: vi.fn((listener) => {
        const originalUnsubscribe = originalSubscribe(listener);
        return () => {
          originalUnsubscribe();
          unsubscribe();
        };
      }),
      stop: vi.fn(actualTransport.stop.bind(actualTransport))
    };
    vi.spyOn(
      mockTransportModule,
      'createMockIntegrationTransport'
    ).mockReturnValue(transport);
    const { unmount } = render(<IntegrationPreview />);
    startAccountScenario();

    unmount();

    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(transport.stop).toHaveBeenCalledOnce();
  });

  it('rerender만으로 lifecycle을 다시 시작하지 않는다', () => {
    const { rerender } = render(<IntegrationPreview />);
    startAccountScenario();
    const imageCount = MockImage.instances.length;

    rerender(<IntegrationPreview />);

    expect(MockImage.instances).toHaveLength(imageCount);
    expect(
      screen.getByTestId(INTEGRATION_PREVIEW_SELECTORS.startButton)
    ).toBeDisabled();
  });

  it('실제 navigation 없이 현재 URL을 유지한다', () => {
    const initialUrl = window.location.href;
    render(<IntegrationPreview />);
    startAccountScenario();
    fireEvent.click(screen.getByRole('radio', { name: /생활비 계좌/ }));
    fireEvent.click(screen.getByTestId('btn-user-decision-confirm'));

    expect(window.location.href).toBe(initialUrl);
  });

  it('API·WebSocket·storage·timer를 사용하지 않는다', () => {
    const fetchSpy = vi.fn();
    const webSocketSpy = vi.fn();
    const timerSpy = vi.spyOn(globalThis, 'setTimeout');
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem');
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('WebSocket', webSocketSpy);

    render(<IntegrationPreview />);
    startAccountScenario();
    fireEvent.click(screen.getByRole('radio', { name: /생활비 계좌/ }));
    fireEvent.click(screen.getByTestId('btn-user-decision-confirm'));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(webSocketSpy).not.toHaveBeenCalled();
    expect(storageSpy).not.toHaveBeenCalled();
    expect(timerSpy).not.toHaveBeenCalled();
  });

  it('실제 연결·조작·거래 완료를 주장하는 문구를 표시하지 않는다', () => {
    render(<IntegrationPreview />);
    startAccountScenario();

    [
      '서버 연결 완료',
      'AI 연결 완료',
      '실시간 frame',
      '실제 브라우저 조작 완료',
      'Playwright Action 완료',
      '실제 사용자 선택 제출 완료',
      '금융거래 완료'
    ].forEach((forbiddenText) => {
      expect(document.body).not.toHaveTextContent(forbiddenText);
    });
  });

  it('주요 control은 label·disabled·56px 최소 높이 기준을 제공한다', () => {
    render(<IntegrationPreview />);

    expect(
      screen.getByLabelText('Mock 시나리오')
    ).toBe(screen.getByTestId(INTEGRATION_PREVIEW_SELECTORS.scenarioSelect));
    expect(
      screen.getByTestId(INTEGRATION_PREVIEW_SELECTORS.startButton)
    ).toHaveClass('min-h-14');
    expect(
      screen.getByTestId(INTEGRATION_PREVIEW_SELECTORS.resetButton)
    ).toHaveClass('min-h-14');
    expect(document.activeElement).toBe(document.body);
  });
});
