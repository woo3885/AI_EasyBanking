import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { FinalConfirmationSummary } from '@/shared/model/final-confirmation';
import {
  FinalConfirmationPanel,
  FINAL_CONFIRMATION_PANEL_SELECTORS,
  type FinalConfirmationPanelProps
} from './FinalConfirmationPanel';

const summary: FinalConfirmationSummary = {
  transactionType: '계좌이체 데모',
  items: [
    { id: 'source-account', label: '출금 계좌', value: '생활비 계좌' },
    { id: 'recipient', label: '수취인', value: '데모 수취인' },
    { id: 'amount', label: '금액', value: '100,000원' }
  ]
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function createProps(
  overrides: Partial<FinalConfirmationPanelProps> = {}
): FinalConfirmationPanelProps {
  return {
    summary,
    confirmed: false,
    onConfirmedChange: vi.fn(),
    onApprove: vi.fn(),
    onEdit: vi.fn(),
    onCancel: vi.fn(),
    ...overrides
  };
}

function expectIdentity(element: HTMLElement, selector: string) {
  expect(element).toHaveAttribute('id', selector);
  expect(element).toHaveAttribute('data-testid', selector);
}

describe('FinalConfirmationPanel', () => {
  it('모든 고정 selector와 접근 가능한 이름을 렌더링한다', () => {
    render(<FinalConfirmationPanel {...createProps()} />);

    for (const selector of Object.values(FINAL_CONFIRMATION_PANEL_SELECTORS)) {
      expectIdentity(screen.getByTestId(selector), selector);
    }
    expect(
      screen.getByRole('region', { name: '최종 거래 확인' })
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(FINAL_CONFIRMATION_PANEL_SELECTORS.panel)
    ).toHaveAttribute(
      'aria-labelledby',
      FINAL_CONFIRMATION_PANEL_SELECTORS.heading
    );
  });

  it('transactionType과 items를 dl, dt, dd 및 안정적인 동적 selector로 표시한다', () => {
    const { container } = render(
      <FinalConfirmationPanel {...createProps()} />
    );

    expect(container.querySelectorAll('dl')).toHaveLength(1);
    expect(container.querySelectorAll('dt')).toHaveLength(4);
    expect(container.querySelectorAll('dd')).toHaveLength(4);
    expect(screen.getByText('계좌이체 데모')).toBeInTheDocument();

    for (const item of summary.items) {
      const selector = `summary-final-confirmation-${item.id}`;
      const row = screen.getByTestId(selector);
      expectIdentity(row, selector);
      expect(within(row).getByText(item.label)).toBeInTheDocument();
      expect(within(row).getByText(item.value)).toBeInTheDocument();
    }
  });

  it('native checkbox와 label을 연결하고 초기 승인 Gate를 닫는다', () => {
    render(<FinalConfirmationPanel {...createProps()} />);

    const checkbox = screen.getByRole('checkbox', {
      name: /표시된 거래 내용을 확인했으며/
    });
    expect(checkbox.tagName).toBe('INPUT');
    expect(checkbox).toHaveAttribute('type', 'checkbox');
    expect(checkbox).not.toBeChecked();
    expect(
      document.querySelector(
        `label[for="${FINAL_CONFIRMATION_PANEL_SELECTORS.checkbox}"]`
      )
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(FINAL_CONFIRMATION_PANEL_SELECTORS.approve)
    ).toBeDisabled();
  });

  it('checkbox 변경은 boolean callback을 한 번 호출하고 approve를 호출하지 않는다', async () => {
    const user = userEvent.setup();
    const onConfirmedChange = vi.fn();
    const onApprove = vi.fn();
    render(
      <FinalConfirmationPanel
        {...createProps({ onConfirmedChange, onApprove })}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    expect(onConfirmedChange).toHaveBeenCalledTimes(1);
    expect(onConfirmedChange).toHaveBeenCalledWith(true);
    expect(onApprove).not.toHaveBeenCalled();
    expect(checkbox).not.toBeChecked();
  });

  it('부모 controlled rerender 후에만 checked와 승인 Gate를 연다', () => {
    const props = createProps();
    const { rerender } = render(<FinalConfirmationPanel {...props} />);

    rerender(<FinalConfirmationPanel {...props} confirmed />);

    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(
      screen.getByTestId(FINAL_CONFIRMATION_PANEL_SELECTORS.approve)
    ).toBeEnabled();
    expect(
      screen.getByTestId(FINAL_CONFIRMATION_PANEL_SELECTORS.status)
    ).toHaveTextContent('승인 버튼을 눌러야 요청이 전달됩니다.');
  });

  it('열린 Gate에서 approve callback을 인수 없이 정확히 한 번 호출한다', async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    render(
      <FinalConfirmationPanel
        {...createProps({ confirmed: true, onApprove })}
      />
    );

    await user.click(
      screen.getByTestId(FINAL_CONFIRMATION_PANEL_SELECTORS.approve)
    );

    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(onApprove).toHaveBeenCalledWith();
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(screen.queryByText(/거래가 완료되었습니다/)).not.toBeInTheDocument();
  });

  it('approvalRequested는 Panel을 유지하고 모든 control과 callback을 차단한다', () => {
    const callbacks = {
      onConfirmedChange: vi.fn(),
      onApprove: vi.fn(),
      onEdit: vi.fn(),
      onCancel: vi.fn()
    };
    render(
      <FinalConfirmationPanel
        {...createProps({
          confirmed: true,
          approvalRequested: true,
          canEdit: true,
          canCancel: true,
          ...callbacks
        })}
      />
    );

    expect(
      screen.getByTestId(FINAL_CONFIRMATION_PANEL_SELECTORS.panel)
    ).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('checkbox')).toBeDisabled();
    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled();
      fireEvent.click(button);
    }
    fireEvent.click(screen.getByRole('checkbox'));
    expect(Object.values(callbacks).every((callback) => callback.mock.calls.length === 0)).toBe(true);
    expect(
      screen.getByTestId(FINAL_CONFIRMATION_PANEL_SELECTORS.status)
    ).toHaveTextContent('처리 결과를 확인할 때까지 기다려 주세요.');
  });

  it.each([
    ['busy', { isBusy: true }],
    ['disabled', { disabled: true }]
  ] satisfies Array<[string, Partial<FinalConfirmationPanelProps>]>)('%s 상태에서는 모든 callback을 차단한다', (_, state) => {
    const callbacks = {
      onConfirmedChange: vi.fn(),
      onApprove: vi.fn(),
      onEdit: vi.fn(),
      onCancel: vi.fn()
    };
    render(
      <FinalConfirmationPanel
        {...createProps({
          confirmed: true,
          canEdit: true,
          canCancel: true,
          ...state,
          ...callbacks
        })}
      />
    );

    fireEvent.click(screen.getByRole('checkbox'));
    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled();
      fireEvent.click(button);
    }
    expect(Object.values(callbacks).every((callback) => callback.mock.calls.length === 0)).toBe(true);
  });

  it('수정 capability가 있을 때만 edit callback을 한 번 호출한다', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const props = createProps({ onEdit });
    const { rerender } = render(<FinalConfirmationPanel {...props} />);
    const editButton = screen.getByTestId(FINAL_CONFIRMATION_PANEL_SELECTORS.edit);

    expect(editButton).toBeDisabled();
    rerender(<FinalConfirmationPanel {...props} canEdit />);
    await user.click(editButton);

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith();
  });

  it('취소 capability가 있을 때만 cancel callback을 한 번 호출한다', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const props = createProps({ onCancel });
    const { rerender } = render(<FinalConfirmationPanel {...props} />);
    const cancelButton = screen.getByTestId(
      FINAL_CONFIRMATION_PANEL_SELECTORS.cancel
    );

    expect(cancelButton).toBeDisabled();
    rerender(<FinalConfirmationPanel {...props} canCancel />);
    await user.click(cancelButton);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledWith();
  });

  it('invalid summary는 raw 값을 표시하지 않고 checkbox와 승인을 차단한다', () => {
    render(
      <FinalConfirmationPanel
        {...createProps({
          confirmed: true,
          summary: {
            transactionType: '데모 거래',
            items: [
              {
                id: 'INVALID_ID',
                label: '노출 금지 label',
                value: '노출 금지 value'
              }
            ]
          }
        })}
      />
    );

    expect(screen.queryByText('노출 금지 label')).not.toBeInTheDocument();
    expect(screen.queryByText('노출 금지 value')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(
      screen.getByTestId(FINAL_CONFIRMATION_PANEL_SELECTORS.approve)
    ).toBeDisabled();
    expect(
      screen.getByTestId(FINAL_CONFIRMATION_PANEL_SELECTORS.status)
    ).toHaveTextContent('안전하게 표시할 수 없습니다.');
  });

  it('단일 status live region과 최소 56px Action 버튼을 사용한다', () => {
    render(<FinalConfirmationPanel {...createProps()} />);

    const status = screen.getByTestId(FINAL_CONFIRMATION_PANEL_SELECTORS.status);
    expect(status).toHaveAttribute('role', 'status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-atomic', 'true');
    for (const selector of [
      FINAL_CONFIRMATION_PANEL_SELECTORS.edit,
      FINAL_CONFIRMATION_PANEL_SELECTORS.cancel,
      FINAL_CONFIRMATION_PANEL_SELECTORS.approve
    ]) {
      expect(screen.getByTestId(selector)).toHaveAttribute('type', 'button');
      expect(screen.getByTestId(selector)).toHaveClass('min-h-14');
      expect(screen.getByTestId(selector)).not.toHaveAttribute('aria-pressed');
    }
  });

  it('title, message와 summary를 raw HTML이 아닌 React text로 렌더링한다', () => {
    render(
      <FinalConfirmationPanel
        {...createProps({
          title: '  <strong>확인 제목</strong>  ',
          message: '  <em>확인 안내</em>  ',
          summary: {
            transactionType: '<b>데모 거래</b>',
            items: [
              {
                id: 'safe-item',
                label: '<span>항목</span>',
                value: '<script>값</script>'
              }
            ]
          }
        })}
      />
    );

    expect(screen.getByText('<strong>확인 제목</strong>')).toBeInTheDocument();
    expect(screen.getByText('<em>확인 안내</em>')).toBeInTheDocument();
    expect(screen.getByText('<b>데모 거래</b>')).toBeInTheDocument();
    expect(screen.getByText('<span>항목</span>')).toBeInTheDocument();
    expect(screen.getByText('<script>값</script>')).toBeInTheDocument();
    expect(
      document.querySelector('strong, em, b, span span, script')
    ).not.toBeInTheDocument();
  });

  it('mount와 사용자 UI 동작에서 외부 효과를 만들지 않는다', () => {
    const fetchMock = vi.fn();
    const webSocketMock = vi.fn();
    const storageGetSpy = vi.spyOn(Storage.prototype, 'getItem');
    const storageSetSpy = vi.spyOn(Storage.prototype, 'setItem');
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const intervalSpy = vi.spyOn(globalThis, 'setInterval');
    const historyPushSpy = vi.spyOn(window.history, 'pushState');
    const historyReplaceSpy = vi.spyOn(window.history, 'replaceState');
    const consoleSpy = vi.spyOn(console, 'log');
    const initialUrl = window.location.href;
    const callbacks = {
      onConfirmedChange: vi.fn(),
      onApprove: vi.fn(),
      onEdit: vi.fn(),
      onCancel: vi.fn()
    };

    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('WebSocket', webSocketMock);
    render(
      <FinalConfirmationPanel
        {...createProps({ canEdit: true, canCancel: true, ...callbacks })}
      />
    );

    expect(Object.values(callbacks).every((callback) => callback.mock.calls.length === 0)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(webSocketMock).not.toHaveBeenCalled();
    expect(storageGetSpy).not.toHaveBeenCalled();
    expect(storageSetSpy).not.toHaveBeenCalled();
    expect(timeoutSpy).not.toHaveBeenCalled();
    expect(intervalSpy).not.toHaveBeenCalled();
    expect(historyPushSpy).not.toHaveBeenCalled();
    expect(historyReplaceSpy).not.toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(window.location.href).toBe(initialUrl);
  });
});
