import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  SecureInputPanel,
  SECURE_INPUT_PANEL_SELECTORS,
  type SecureInputPanelProps
} from './SecureInputPanel';

function createProps(
  overrides: Partial<SecureInputPanelProps> = {}
): SecureInputPanelProps {
  return {
    onComplete: vi.fn(),
    ...overrides
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('SecureInputPanel', () => {
  it('고정 selector와 접근 가능한 보호 모드 section을 렌더링한다', () => {
    render(<SecureInputPanel {...createProps()} />);

    const panel = screen.getByRole('region', {
      name: '개인정보 보호 모드'
    });
    const selectors = Object.values(SECURE_INPUT_PANEL_SELECTORS);

    for (const selector of selectors) {
      const element = screen.getByTestId(selector);
      expect(element).toHaveAttribute('id', selector);
      expect(element).toHaveAttribute('data-testid', selector);
    }

    expect(panel).toBe(screen.getByTestId(SECURE_INPUT_PANEL_SELECTORS.panel));
    expect(panel).toHaveAttribute(
      'aria-labelledby',
      SECURE_INPUT_PANEL_SELECTORS.heading
    );
  });

  it('실제 대형 button을 사용하고 보안값 입력 요소를 만들지 않는다', () => {
    const { container } = render(<SecureInputPanel {...createProps()} />);
    const button = screen.getByRole('button', { name: '입력 완료 요청' });

    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveClass('min-h-14');
    expect(button).toBeEnabled();
    expect(container.querySelector('input')).not.toBeInTheDocument();
    expect(container.querySelector('input[type="password"]')).not.toBeInTheDocument();
    expect(container.querySelector('input[type="hidden"]')).not.toBeInTheDocument();
  });

  it('초기 대기 상태를 표시하고 mount만으로 callback을 호출하지 않는다', () => {
    const props = createProps();
    render(<SecureInputPanel {...props} />);

    expect(screen.getByRole('status')).toHaveTextContent(
      '원격 금융 화면에서 보안 정보를 직접 입력한 뒤 입력 완료 버튼을 눌러 주세요.'
    );
    expect(props.onComplete).not.toHaveBeenCalled();
  });

  it('활성 버튼 클릭 시 인수 없이 callback을 정확히 한 번 호출한다', () => {
    const props = createProps();
    render(<SecureInputPanel {...props} />);

    fireEvent.click(screen.getByRole('button', { name: '입력 완료 요청' }));

    expect(props.onComplete).toHaveBeenCalledOnce();
    expect(props.onComplete).toHaveBeenCalledWith();
  });

  it('클릭만으로 완료 상태를 확정하지 않고 부모 rerender를 따른다', () => {
    const props = createProps();
    const { rerender } = render(<SecureInputPanel {...props} />);
    const button = screen.getByRole('button', { name: '입력 완료 요청' });

    fireEvent.click(button);
    expect(button).toBeEnabled();
    expect(screen.getByRole('status')).toHaveTextContent(
      '직접 입력한 뒤 입력 완료 버튼을 눌러 주세요.'
    );

    rerender(<SecureInputPanel {...props} completionRequested />);

    expect(button).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(
      '입력 완료 요청을 전달했습니다.'
    );
    expect(screen.getByRole('region', { name: '개인정보 보호 모드' })).toBeInTheDocument();
    expect(screen.getByText(/이 패널은 보안 입력값을 받지 않으며/)).toBeInTheDocument();
  });

  it('busy 상태를 알리고 실제 disabled로 중복 callback을 차단한다', () => {
    const props = createProps({ isBusy: true });
    render(<SecureInputPanel {...props} />);
    const panel = screen.getByRole('region', {
      name: '개인정보 보호 모드'
    });
    const button = screen.getByRole('button', { name: '입력 완료 요청' });

    expect(panel).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(
      '입력 완료 요청을 처리하고 있습니다.'
    );
    fireEvent.click(button);
    expect(props.onComplete).not.toHaveBeenCalled();
  });

  it('disabled 상태에서 callback을 차단하고 안전한 상태를 표시한다', () => {
    const props = createProps({ disabled: true });
    render(<SecureInputPanel {...props} />);
    const button = screen.getByRole('button', { name: '입력 완료 요청' });

    expect(button).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(
      '현재는 입력 완료 요청을 보낼 수 없습니다.'
    );
    fireEvent.click(button);
    expect(props.onComplete).not.toHaveBeenCalled();
  });

  it('status에 polite live와 atomic 속성을 한 곳에서 제공한다', () => {
    render(<SecureInputPanel {...createProps()} />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-atomic', 'true');
    expect(screen.getByTestId(SECURE_INPUT_PANEL_SELECTORS.protectionNotice)).toHaveAttribute(
      'role',
      'note'
    );
    expect(
      screen.getByTestId(SECURE_INPUT_PANEL_SELECTORS.protectionNotice)
    ).not.toHaveAttribute('aria-live');
  });

  it('custom message를 trim하고 공백 message는 안전한 기본 안내로 대체한다', () => {
    const props = createProps({
      message: '  보호된 정보는 원격 금융 화면에서 직접 입력해 주세요.  '
    });
    const { rerender } = render(<SecureInputPanel {...props} />);

    expect(
      screen.getByText('보호된 정보는 원격 금융 화면에서 직접 입력해 주세요.')
    ).toBeInTheDocument();

    rerender(<SecureInputPanel {...props} message="   " />);
    expect(
      screen.getAllByText(/원격 금융 화면에서 보안 정보를 직접 입력/)
    ).not.toHaveLength(0);
  });

  it('완료 요청 상태에서도 성공을 주장하는 문구를 표시하지 않는다', () => {
    const { container } = render(
      <SecureInputPanel {...createProps()} completionRequested />
    );

    expect(container.textContent).not.toMatch(
      /인증 성공|검증 성공|비밀번호 정답|OTP 성공|자동화 재개 완료/
    );
  });

  it('URL·네트워크·storage·timer·console에 부작용을 만들지 않는다', () => {
    const originalHref = window.location.href;
    const historyPush = vi.spyOn(window.history, 'pushState');
    const historyReplace = vi.spyOn(window.history, 'replaceState');
    const storageSet = vi.spyOn(Storage.prototype, 'setItem');
    const timeout = vi.spyOn(globalThis, 'setTimeout');
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const fetchMock = vi.fn();
    const webSocketMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('WebSocket', webSocketMock);
    const props = createProps();

    render(<SecureInputPanel {...props} />);
    fireEvent.click(screen.getByRole('button', { name: '입력 완료 요청' }));

    expect(window.location.href).toBe(originalHref);
    expect(historyPush).not.toHaveBeenCalled();
    expect(historyReplace).not.toHaveBeenCalled();
    expect(storageSet).not.toHaveBeenCalled();
    expect(timeout).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(webSocketMock).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
  });
});
