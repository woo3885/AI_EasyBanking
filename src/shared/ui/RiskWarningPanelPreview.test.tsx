import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RISK_WARNING_FALLBACK_MESSAGE } from '@/shared/model/risk-warning';
import { RISK_WARNING_PANEL_SELECTORS } from './RiskWarningPanel';
import {
  RiskWarningPanelPreview,
  RISK_WARNING_PANEL_PREVIEW_SELECTORS,
  type RiskWarningPreviewState
} from './RiskWarningPanelPreview';

function selectPreviewState(state: RiskWarningPreviewState) {
  fireEvent.change(
    screen.getByTestId(RISK_WARNING_PANEL_PREVIEW_SELECTORS.select),
    { target: { value: state } }
  );
}

function expectIdentity(element: HTMLElement, selector: string) {
  expect(element).toHaveAttribute('id', selector);
  expect(element).toHaveAttribute('data-testid', selector);
}

describe('RiskWarningPanelPreview', () => {
  it('Preview와 select selector의 id와 data-testid를 일치시킨다', () => {
    render(<RiskWarningPanelPreview />);

    expectIdentity(
      screen.getByTestId(RISK_WARNING_PANEL_PREVIEW_SELECTORS.preview),
      RISK_WARNING_PANEL_PREVIEW_SELECTORS.preview
    );
    expectIdentity(
      screen.getByTestId(RISK_WARNING_PANEL_PREVIEW_SELECTORS.select),
      RISK_WARNING_PANEL_PREVIEW_SELECTORS.select
    );
  });

  it.each([
    [
      'GENERAL_WARNING',
      '금융사기 위험 가능성이 있어 요청 내용을 다시 확인해야 합니다.'
    ],
    [
      'VOICE_PHISHING_MESSAGE',
      '보이스피싱으로 의심되는 요청일 수 있어 금융 절차를 진행하지 않습니다.'
    ],
    [
      'SAFE_ACCOUNT_MESSAGE',
      '안전계좌로 자금을 옮기라는 요청은 금융사기 위험 신호일 수 있습니다.'
    ],
    ['INVALID_MESSAGE', RISK_WARNING_FALLBACK_MESSAGE],
    [
      'CUSTOM_MESSAGE',
      '공식 앱이나 웹사이트에서 요청 내용을 직접 확인해 주세요.'
    ]
  ] satisfies Array<[RiskWarningPreviewState, string]>)('%s message 상태를 표시한다', (state, message) => {
    render(<RiskWarningPanelPreview />);
    selectPreviewState(state);

    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it.each([
    ['CANCEL_REQUESTED', '취소 요청 전달됨'],
    ['BUSY', '취소 요청 처리 중'],
    ['DISABLED', '취소 요청 사용 불가'],
    ['CANCEL_UNAVAILABLE', '취소 요청 사용 불가']
  ] satisfies Array<[RiskWarningPreviewState, string]>)('%s 제어 상태를 표시하고 버튼을 비활성화한다', (state, badge) => {
    render(<RiskWarningPanelPreview />);
    selectPreviewState(state);

    expect(
      within(
        screen.getByTestId(RISK_WARNING_PANEL_SELECTORS.panel)
      ).getByText(badge)
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(RISK_WARNING_PANEL_SELECTORS.cancel)
    ).toBeDisabled();
  });

  it('GENERAL_WARNING에서 cancel callback 요청 안내만 갱신한다', () => {
    render(<RiskWarningPanelPreview />);

    fireEvent.click(
      screen.getByTestId(RISK_WARNING_PANEL_SELECTORS.cancel)
    );

    expect(
      screen.getByText(/사용자가 안전한 세션 취소 요청 callback을 전달했습니다/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/실제 서버 요청은 전송하지 않았습니다/)
    ).toBeInTheDocument();
  });

  it('Preview에 실제 전화번호나 미마스킹 계좌번호를 포함하지 않는다', () => {
    const { container } = render(<RiskWarningPanelPreview />);
    const previewText = container.textContent ?? '';

    expect(previewText).not.toMatch(/\b01[016789]-\d{3,4}-\d{4}\b/);
    expect(previewText).not.toMatch(/\b\d{2,6}(?:-\d{2,6}){2,4}\b/);
  });

  it('API·WebSocket·storage·history·timer·console을 사용하지 않는다', () => {
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

    render(<RiskWarningPanelPreview />);
    selectPreviewState('CUSTOM_MESSAGE');
    fireEvent.click(
      screen.getByTestId(RISK_WARNING_PANEL_SELECTORS.cancel)
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(webSocketMock).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(pushStateSpy).not.toHaveBeenCalled();
    expect(replaceStateSpy).not.toHaveBeenCalled();
    expect(timerSpy).not.toHaveBeenCalled();
    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(window.location.href).toBe(originalUrl);

    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
});
