import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  SECURE_INPUT_PANEL_PREVIEW_SELECTORS
} from './SecureInputPanelPreview';
import SecureInputPanelPreview from './SecureInputPanelPreview';
import { SECURE_INPUT_PANEL_SELECTORS } from './SecureInputPanel';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function selectState(value: string) {
  fireEvent.change(
    screen.getByTestId(SECURE_INPUT_PANEL_PREVIEW_SELECTORS.stateSelect),
    { target: { value } }
  );
}

describe('SecureInputPanelPreview', () => {
  it('Preview와 상태 선택 selector의 id와 data-testid를 일치시킨다', () => {
    render(<SecureInputPanelPreview />);

    for (const selector of Object.values(
      SECURE_INPUT_PANEL_PREVIEW_SELECTORS
    )) {
      const element = screen.getByTestId(selector);
      expect(element).toHaveAttribute('id', selector);
      expect(element).toHaveAttribute('data-testid', selector);
    }

    expect(screen.getByRole('combobox', { name: '확인할 보호 모드 상태' })).toBeInTheDocument();
  });

  it('WAITING 상태에서 버튼을 활성화하고 자동 callback을 실행하지 않는다', () => {
    render(<SecureInputPanelPreview />);

    expect(screen.getByRole('button', { name: '입력 완료 요청' })).toBeEnabled();
    expect(screen.getByText('Preview에서 완료 요청을 보내지 않았습니다.')).toBeInTheDocument();
  });

  it('COMPLETION_REQUESTED 상태에서 버튼과 보호 모드를 유지한다', () => {
    render(<SecureInputPanelPreview />);
    selectState('COMPLETION_REQUESTED');

    expect(screen.getByRole('button', { name: '입력 완료 요청' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(
      '입력 완료 요청을 전달했습니다.'
    );
    expect(screen.getByRole('region', { name: '개인정보 보호 모드' })).toBeInTheDocument();
  });

  it('BUSY 상태에서 aria-busy와 disabled를 표시한다', () => {
    render(<SecureInputPanelPreview />);
    selectState('BUSY');

    expect(screen.getByTestId(SECURE_INPUT_PANEL_SELECTORS.panel)).toHaveAttribute(
      'aria-busy',
      'true'
    );
    expect(screen.getByRole('button', { name: '입력 완료 요청' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('처리하고 있습니다');
  });

  it('DISABLED 상태에서 완료 요청을 차단한다', () => {
    render(<SecureInputPanelPreview />);
    selectState('DISABLED');

    expect(screen.getByRole('button', { name: '입력 완료 요청' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(
      '요청을 보낼 수 없습니다'
    );
  });

  it('CUSTOM_MESSAGE를 trim해 표시한다', () => {
    render(<SecureInputPanelPreview />);
    selectState('CUSTOM_MESSAGE');

    expect(
      screen.getByText('보호된 정보는 원격 금융 화면에서 직접 입력해 주세요.')
    ).toBeInTheDocument();
  });

  it('EMPTY_MESSAGE는 안전한 기본 안내를 사용한다', () => {
    render(<SecureInputPanelPreview />);
    selectState('EMPTY_MESSAGE');

    expect(
      screen.getAllByText(/원격 금융 화면에서 보안 정보를 직접 입력/)
    ).not.toHaveLength(0);
  });

  it('완료 버튼 클릭을 부모의 controlled 갱신과 안전한 Preview 안내로 표현한다', () => {
    render(<SecureInputPanelPreview />);

    fireEvent.click(screen.getByRole('button', { name: '입력 완료 요청' }));

    expect(screen.getByRole('button', { name: '입력 완료 요청' })).toBeDisabled();
    expect(screen.getByRole('combobox')).toHaveValue('COMPLETION_REQUESTED');
    expect(
      screen.getByText(
        'Preview에서 입력 완료 요청만 확인했습니다. 보호 모드는 계속 유지됩니다.'
      )
    ).toBeInTheDocument();
  });

  it('실제 보안값 input을 만들지 않는다', () => {
    const { container } = render(<SecureInputPanelPreview />);

    expect(container.querySelector('input')).not.toBeInTheDocument();
  });

  it('API·WebSocket·storage·timer를 사용하지 않는다', () => {
    const storageSet = vi.spyOn(Storage.prototype, 'setItem');
    const timeout = vi.spyOn(globalThis, 'setTimeout');
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const fetchMock = vi.fn();
    const webSocketMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('WebSocket', webSocketMock);

    render(<SecureInputPanelPreview />);
    fireEvent.click(screen.getByRole('button', { name: '입력 완료 요청' }));

    expect(storageSet).not.toHaveBeenCalled();
    expect(timeout).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(webSocketMock).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
  });
});
