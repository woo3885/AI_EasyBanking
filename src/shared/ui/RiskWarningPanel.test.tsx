import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  RiskWarningPanel,
  RISK_WARNING_PANEL_SELECTORS,
  type RiskWarningPanelProps
} from './RiskWarningPanel';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function createProps(
  overrides: Partial<RiskWarningPanelProps> = {}
): RiskWarningPanelProps {
  return {
    details: {
      message: '금융사기 위험 가능성이 있어 요청 내용을 다시 확인해야 합니다.'
    },
    canCancel: true,
    onCancel: vi.fn(),
    ...overrides
  };
}

function expectIdentity(element: HTMLElement, selector: string) {
  expect(element).toHaveAttribute('id', selector);
  expect(element).toHaveAttribute('data-testid', selector);
}

describe('RiskWarningPanel', () => {
  it('production selector와 접근 가능한 위험 구조를 렌더링한다', () => {
    render(<RiskWarningPanel {...createProps()} />);

    for (const selector of Object.values(RISK_WARNING_PANEL_SELECTORS)) {
      expectIdentity(screen.getByTestId(selector), selector);
    }

    const panel = screen.getByRole('region', { name: '금융사기 위험 경고' });
    expect(panel).toHaveAttribute(
      'aria-labelledby',
      RISK_WARNING_PANEL_SELECTORS.heading
    );
    expect(panel).toHaveAttribute(
      'aria-describedby',
      RISK_WARNING_PANEL_SELECTORS.status
    );
    expect(panel).toHaveAttribute('aria-busy', 'false');
    expect(
      screen.getByRole('heading', { name: '금융사기 위험 경고', level: 2 })
    ).toBeInTheDocument();

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveAttribute('aria-live', 'assertive');
    expect(alerts[0]).toHaveAttribute('aria-atomic', 'true');

    const guidance = screen.getByTestId(
      RISK_WARNING_PANEL_SELECTORS.guidance
    );
    expect(guidance.tagName).toBe('UL');
    expect(within(guidance).getAllByRole('listitem')).toHaveLength(4);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-atomic', 'true');

    const cancelButton = screen.getByRole('button', {
      name: '세션 취소 요청'
    });
    expect(cancelButton).toHaveAttribute('type', 'button');
    expect(cancelButton).toHaveClass('min-h-14');
    expect(cancelButton).not.toBeDisabled();
  });

  it('초기 mount에는 callback을 호출하지 않고 허용 클릭 1회에 인수 없이 한 번 호출한다', () => {
    const onCancel = vi.fn();
    render(<RiskWarningPanel {...createProps({ onCancel })} />);

    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '세션 취소 요청' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledWith();
  });

  it('부모 rerender 전에는 cancelRequested를 자체 변경하지 않는다', () => {
    const onCancel = vi.fn();
    const initialProps = createProps({ onCancel });
    const { rerender } = render(<RiskWarningPanel {...initialProps} />);
    const button = screen.getByRole('button', { name: '세션 취소 요청' });

    fireEvent.click(button);

    expect(button).not.toBeDisabled();
    expect(
      screen.getByText('안전을 위해 현재 절차를 계속 진행하지 않습니다.')
    ).toBeInTheDocument();

    rerender(<RiskWarningPanel {...initialProps} cancelRequested />);

    expect(button).toBeDisabled();
    expect(
      screen.getByText(
        '취소 요청을 전달했습니다. 처리 결과를 확인할 때까지 위험 경고를 유지합니다.'
      )
    ).toBeInTheDocument();
    fireEvent.click(button);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'busy',
      { isBusy: true },
      '안전한 취소 요청을 처리하고 있습니다.'
    ],
    [
      'disabled',
      { disabled: true },
      '현재 이 패널에서는 취소 요청을 사용할 수 없습니다. 금융 절차를 계속 진행하지 마세요.'
    ],
    [
      'canCancel=false',
      { canCancel: false },
      '현재 이 패널에서는 취소 요청을 사용할 수 없습니다. 금융 절차를 계속 진행하지 마세요.'
    ],
    [
      'cancelRequested',
      { cancelRequested: true },
      '취소 요청을 전달했습니다. 처리 결과를 확인할 때까지 위험 경고를 유지합니다.'
    ]
  ] satisfies Array<[
    string,
    Partial<RiskWarningPanelProps>,
    string
  ]>)('%s 상태에서 취소 요청을 차단한다', (_, overrides, statusMessage) => {
    const onCancel = vi.fn();
    render(
      <RiskWarningPanel {...createProps({ ...overrides, onCancel })} />
    );

    const button = screen.getByRole('button', { name: '세션 취소 요청' });
    expect(button).toBeDisabled();
    expect(screen.getByText(statusMessage)).toBeInTheDocument();
    fireEvent.click(button);
    expect(onCancel).not.toHaveBeenCalled();

    if ((overrides as Partial<RiskWarningPanelProps>).isBusy) {
      expect(screen.getByTestId(RISK_WARNING_PANEL_SELECTORS.panel)).toHaveAttribute(
        'aria-busy',
        'true'
      );
    }
  });

  it('금지 control과 금융 Action을 렌더링하지 않는다', () => {
    render(<RiskWarningPanel {...createProps()} />);

    for (const name of [
      /계속 진행/,
      /위험 무시/,
      /닫기|dismiss/i,
      /중단|stop/i,
      /이전 단계/,
      /수정/,
      /승인/,
      /송금/,
      /가입/,
      /재시도/,
      /위험 해제/
    ]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByTestId('btn-risk-stop')).not.toBeInTheDocument();
  });

  it('HTML처럼 보이는 message를 실행하지 않고 text로 표시한다', () => {
    const message = '<strong>위험 가능성을 확인해 주세요.</strong>';
    const { container } = render(
      <RiskWarningPanel {...createProps({ details: { message } })} />
    );

    expect(screen.getByText(message)).toBeInTheDocument();
    expect(container.querySelector('strong')).not.toBeInTheDocument();
  });

  it('완료를 단정하는 상태 문구를 표시하지 않는다', () => {
    render(<RiskWarningPanel {...createProps({ cancelRequested: true })} />);

    for (const text of [
      '세션이 종료되었습니다',
      '거래가 취소되었습니다',
      '피해가 차단되었습니다',
      '위험이 해제되었습니다'
    ]) {
      expect(screen.queryByText(text)).not.toBeInTheDocument();
    }
  });

  it('취소 요청이 URL·API·WebSocket·storage·timer·console을 사용하지 않는다', () => {
    const originalUrl = window.location.href;
    const fetchMock = vi.fn();
    const webSocketMock = vi.fn();
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const pushStateSpy = vi.spyOn(window.history, 'pushState');
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
    const timerSpy = vi.spyOn(window, 'setTimeout');
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('WebSocket', webSocketMock);

    render(<RiskWarningPanel {...createProps()} />);
    fireEvent.click(screen.getByRole('button', { name: '세션 취소 요청' }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(webSocketMock).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(pushStateSpy).not.toHaveBeenCalled();
    expect(replaceStateSpy).not.toHaveBeenCalled();
    expect(timerSpy).not.toHaveBeenCalled();
    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(window.location.href).toBe(originalUrl);
  });
});
