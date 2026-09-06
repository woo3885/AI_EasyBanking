import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CONTROLLER_PREVIEW_SELECTORS,
  CONTROLLER_SELECTORS
} from '@/features/F5_MainController/model/controller-action';

import F5_MainControllerPreview from './F5_MainControllerPreview';

describe('F5_MainControllerPreview', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('Mock 전용 안내와 활성화된 네 컨트롤을 표시한다', () => {
    render(<F5_MainControllerPreview />);

    const preview = screen.getByTestId(CONTROLLER_PREVIEW_SELECTORS.root);
    expect(preview).toHaveAttribute('id', CONTROLLER_PREVIEW_SELECTORS.root);
    expect(preview).toHaveAttribute(
      'data-testid',
      CONTROLLER_PREVIEW_SELECTORS.root
    );
    const previewStatus = screen.getByTestId(
      CONTROLLER_PREVIEW_SELECTORS.actionStatus
    );
    expect(previewStatus).toHaveAttribute(
      'id',
      CONTROLLER_PREVIEW_SELECTORS.actionStatus
    );
    expect(previewStatus).toHaveAttribute(
      'data-testid',
      CONTROLLER_PREVIEW_SELECTORS.actionStatus
    );
    expect(
      screen.getByText(/실제 API나 음성 기능 없이 callback 계약만 확인/)
    ).toBeInTheDocument();
    for (const name of ['다시 듣기', '일시정지', '이전 단계', '취소']) {
      expect(screen.getByRole('button', { name })).toBeEnabled();
    }
  });

  it('다시 듣기와 이전 단계 callback 결과를 표시한다', async () => {
    const user = userEvent.setup();
    render(<F5_MainControllerPreview />);
    const previewStatus = screen.getByTestId(
      CONTROLLER_PREVIEW_SELECTORS.actionStatus
    );

    await user.click(screen.getByRole('button', { name: '다시 듣기' }));
    expect(previewStatus).toHaveTextContent(
      '마지막 callback: 안내 다시 듣기를 요청했습니다.'
    );

    await user.click(screen.getByRole('button', { name: '이전 단계' }));
    expect(previewStatus).toHaveTextContent(
      '마지막 callback: 이전 단계 이동을 요청했습니다.'
    );
  });

  it('일시정지와 계속 진행을 controlled 상태로 전환한다', async () => {
    const user = userEvent.setup();
    render(<F5_MainControllerPreview />);
    const previewStatus = screen.getByTestId(
      CONTROLLER_PREVIEW_SELECTORS.actionStatus
    );

    await user.click(screen.getByRole('button', { name: '일시정지' }));
    expect(screen.getByRole('button', { name: '계속 진행' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(previewStatus).toHaveTextContent(
      '마지막 callback: 일시정지를 요청했습니다.'
    );

    await user.click(screen.getByRole('button', { name: '계속 진행' }));
    expect(screen.getByRole('button', { name: '일시정지' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(previewStatus).toHaveTextContent(
      '마지막 callback: 계속 진행을 요청했습니다.'
    );
  });

  it('취소 최초 클릭과 닫기는 callback 결과를 바꾸지 않고 확인에서만 변경한다', async () => {
    const user = userEvent.setup();
    render(<F5_MainControllerPreview />);
    const previewStatus = screen.getByTestId(
      CONTROLLER_PREVIEW_SELECTORS.actionStatus
    );

    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(previewStatus).toHaveTextContent(
      '마지막 callback: 요청된 컨트롤 동작이 없습니다.'
    );
    await user.click(screen.getByRole('button', { name: '계속 이용' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(previewStatus).toHaveTextContent(
      '마지막 callback: 요청된 컨트롤 동작이 없습니다.'
    );

    await user.click(screen.getByRole('button', { name: '취소' }));
    await user.click(screen.getByRole('button', { name: '취소 확인' }));
    expect(previewStatus).toHaveTextContent(
      '마지막 callback: 업무 취소를 요청했습니다.'
    );
  });

  it('실제 네트워크·음성·history 기능을 호출하지 않는다', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    const webSocketMock = vi.fn();
    const speakMock = vi.fn();
    const historyBack = vi.spyOn(window.history, 'back');
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('WebSocket', webSocketMock);
    vi.stubGlobal('speechSynthesis', { speak: speakMock });
    render(<F5_MainControllerPreview />);

    await user.click(screen.getByTestId(CONTROLLER_SELECTORS.replayButton));
    await user.click(screen.getByTestId(CONTROLLER_SELECTORS.pauseButton));
    await user.click(screen.getByTestId(CONTROLLER_SELECTORS.previousButton));
    await user.click(screen.getByTestId(CONTROLLER_SELECTORS.cancelButton));
    await user.click(
      screen.getByTestId(CONTROLLER_SELECTORS.cancelConfirmButton)
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(webSocketMock).not.toHaveBeenCalled();
    expect(speakMock).not.toHaveBeenCalled();
    expect(historyBack).not.toHaveBeenCalled();
  });
});
