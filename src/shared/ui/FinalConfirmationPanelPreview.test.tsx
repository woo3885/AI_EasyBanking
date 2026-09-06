import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  FINAL_CONFIRMATION_PANEL_SELECTORS
} from './FinalConfirmationPanel';
import {
  FinalConfirmationPanelPreview,
  FINAL_CONFIRMATION_PANEL_PREVIEW_SELECTORS
} from './FinalConfirmationPanelPreview';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function expectIdentity(element: HTMLElement, selector: string) {
  expect(element).toHaveAttribute('id', selector);
  expect(element).toHaveAttribute('data-testid', selector);
}

async function selectPreviewState(value: string) {
  const user = userEvent.setup();
  await user.selectOptions(
    screen.getByTestId(FINAL_CONFIRMATION_PANEL_PREVIEW_SELECTORS.select),
    value
  );
}

describe('FinalConfirmationPanelPreview', () => {
  it('Preview와 상태 선택 selector의 id와 data-testid를 일치시킨다', () => {
    render(<FinalConfirmationPanelPreview />);

    expectIdentity(
      screen.getByTestId(FINAL_CONFIRMATION_PANEL_PREVIEW_SELECTORS.preview),
      FINAL_CONFIRMATION_PANEL_PREVIEW_SELECTORS.preview
    );
    expectIdentity(
      screen.getByTestId(FINAL_CONFIRMATION_PANEL_PREVIEW_SELECTORS.select),
      FINAL_CONFIRMATION_PANEL_PREVIEW_SELECTORS.select
    );
  });

  it('이체 초기 상태는 Mock 요약과 미선택·disabled 승인 Gate를 표시한다', () => {
    render(<FinalConfirmationPanelPreview />);

    expect(screen.getByText('계좌이체 데모')).toBeInTheDocument();
    expect(screen.getByText('데모 수취인')).toBeInTheDocument();
    expect(screen.getByText('100,000원')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(
      screen.getByTestId(FINAL_CONFIRMATION_PANEL_SELECTORS.approve)
    ).toBeDisabled();
  });

  it('이체 확인 선택 Preview는 checked와 열린 승인 Gate를 표시한다', async () => {
    render(<FinalConfirmationPanelPreview />);

    await selectPreviewState('TRANSFER_CONFIRMED');

    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(
      screen.getByTestId(FINAL_CONFIRMATION_PANEL_SELECTORS.approve)
    ).toBeEnabled();
  });

  it('예금 Preview는 안전한 Mock 상품·기간·금액·약관 결과를 표시한다', async () => {
    render(<FinalConfirmationPanelPreview />);

    await selectPreviewState('DEPOSIT_UNCONFIRMED');

    expect(screen.getByText('정기예금 가입 데모')).toBeInTheDocument();
    expect(screen.getByText('12개월 정기예금 Mock')).toBeInTheDocument();
    expect(screen.getByText('12개월')).toBeInTheDocument();
    expect(screen.getByText('500,000원')).toBeInTheDocument();
    expect(screen.getByText('사용자 확인 완료')).toBeInTheDocument();
  });

  it('승인 요청 Preview는 패널을 유지하고 모든 Action을 차단한다', async () => {
    render(<FinalConfirmationPanelPreview />);

    await selectPreviewState('APPROVAL_REQUESTED');

    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(
      screen.getByTestId(FINAL_CONFIRMATION_PANEL_SELECTORS.panel)
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(FINAL_CONFIRMATION_PANEL_SELECTORS.status)
    ).toHaveTextContent('처리 결과를 확인할 때까지 기다려 주세요.');
    expect(
      screen
        .getAllByRole('button')
        .every((button) => (button as HTMLButtonElement).disabled)
    ).toBe(true);
  });

  it.each([
    ['BUSY', '최종 승인 요청을 처리하고 있습니다.'],
    ['DISABLED', '현재는 최종 확인 요청을 진행할 수 없습니다.']
  ])('%s Preview는 disabled control과 안전한 상태 문장을 표시한다', async (state, message) => {
    render(<FinalConfirmationPanelPreview />);

    await selectPreviewState(state);

    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(
      screen.getByTestId(FINAL_CONFIRMATION_PANEL_SELECTORS.status)
    ).toHaveTextContent(message);
    expect(
      screen
        .getAllByRole('button')
        .every((button) => (button as HTMLButtonElement).disabled)
    ).toBe(true);
  });

  it('invalid summary Preview는 raw 항목 없이 fail-closed 안내를 표시한다', async () => {
    render(<FinalConfirmationPanelPreview />);

    await selectPreviewState('INVALID_SUMMARY');

    expect(screen.queryByText('표시 금지 항목')).not.toBeInTheDocument();
    expect(screen.queryByText('표시 금지 원본')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(
      screen.getByTestId(FINAL_CONFIRMATION_PANEL_SELECTORS.approve)
    ).toBeDisabled();
  });

  it('수정 요청은 안전한 callback 결과만 표시하고 URL을 바꾸지 않는다', async () => {
    const initialUrl = window.location.href;
    render(<FinalConfirmationPanelPreview />);

    await selectPreviewState('EDIT_REQUESTED');
    await userEvent.click(
      screen.getByTestId(FINAL_CONFIRMATION_PANEL_SELECTORS.edit)
    );

    expect(screen.getByText(/내용 수정 요청을 전달했습니다/)).toBeInTheDocument();
    expect(window.location.href).toBe(initialUrl);
  });

  it('취소 요청은 안전한 callback 결과만 표시하고 세션 완료를 주장하지 않는다', async () => {
    render(<FinalConfirmationPanelPreview />);

    await selectPreviewState('CANCEL_REQUESTED');
    await userEvent.click(
      screen.getByTestId(FINAL_CONFIRMATION_PANEL_SELECTORS.cancel)
    );

    expect(screen.getByText(/최종 확인 취소 요청을 전달했습니다/)).toBeInTheDocument();
    expect(screen.queryByText(/거래 취소가 완료되었습니다/)).not.toBeInTheDocument();
  });

  it('사용자 확인과 승인 요청을 로컬 controlled 상태로만 표현한다', async () => {
    const user = userEvent.setup();
    render(<FinalConfirmationPanelPreview />);

    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(screen.getByText(/사용자가 최종 확인 항목을 선택했습니다/)).toBeInTheDocument();

    await user.click(
      screen.getByTestId(FINAL_CONFIRMATION_PANEL_SELECTORS.approve)
    );
    expect(
      screen.getAllByText(/최종 승인 요청을 전달했습니다/)
    ).toHaveLength(2);
    expect(
      screen.getByTestId(FINAL_CONFIRMATION_PANEL_SELECTORS.approve)
    ).toBeDisabled();
  });

  it('API, WebSocket, storage, history, timer와 console을 사용하지 않는다', () => {
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

    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('WebSocket', webSocketMock);
    render(<FinalConfirmationPanelPreview />);
    fireEvent.click(screen.getByRole('checkbox'));

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
    expect(screen.queryByText(/송금이 완료되었습니다/)).not.toBeInTheDocument();
  });
});
