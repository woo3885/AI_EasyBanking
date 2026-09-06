import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CONTROLLER_SELECTORS } from '@/features/F5_MainController/model/controller-action';

import F5_MainController, {
  type MainControllerProps
} from './F5_MainController';

function createProps(
  overrides: Partial<MainControllerProps> = {}
): MainControllerProps {
  return {
    isPaused: false,
    onReplay: vi.fn(),
    onPauseChange: vi.fn(),
    onPrevious: vi.fn(),
    onCancel: vi.fn(),
    ...overrides
  };
}

describe('F5_MainController', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('접근 가능한 section과 네 개의 실제 button 및 고정 selector를 렌더링한다', () => {
    const props = createProps();
    render(<F5_MainController {...props} />);

    const controller = screen.getByRole('region', {
      name: '업무 진행 컨트롤'
    });
    const buttons = [
      ['다시 듣기', CONTROLLER_SELECTORS.replayButton],
      ['일시정지', CONTROLLER_SELECTORS.pauseButton],
      ['이전 단계', CONTROLLER_SELECTORS.previousButton],
      ['취소', CONTROLLER_SELECTORS.cancelButton]
    ] as const;

    expect(controller).toHaveAttribute('id', CONTROLLER_SELECTORS.root);
    expect(controller).toHaveAttribute(
      'data-testid',
      CONTROLLER_SELECTORS.root
    );
    expect(controller).toHaveAttribute('aria-busy', 'false');

    buttons.forEach(([name, selector]) => {
      const button = screen.getByRole('button', { name });
      expect(button).toHaveAttribute('type', 'button');
      expect(button).toHaveAttribute('id', selector);
      expect(button).toHaveAttribute('data-testid', selector);
      expect(button).toHaveClass('min-h-14');
    });

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('id', CONTROLLER_SELECTORS.actionStatus);
    expect(status).toHaveAttribute(
      'data-testid',
      CONTROLLER_SELECTORS.actionStatus
    );

    expect(props.onReplay).not.toHaveBeenCalled();
    expect(props.onPauseChange).not.toHaveBeenCalled();
    expect(props.onPrevious).not.toHaveBeenCalled();
    expect(props.onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(
      '요청된 컨트롤 동작이 없습니다.'
    );
  });

  it('안전 기본값에서는 모든 버튼을 비활성화한다', () => {
    render(<F5_MainController {...createProps()} />);

    expect(screen.getByRole('button', { name: '다시 듣기' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '일시정지' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '이전 단계' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
  });

  it('capability가 있고 busy가 아닐 때 동작 버튼을 활성화한다', () => {
    render(
      <F5_MainController
        {...createProps({
          message: '현재 안내를 다시 확인해 주세요.',
          canReplay: true,
          canPause: true,
          canGoPrevious: true,
          canCancel: true
        })}
      />
    );

    expect(screen.getByRole('button', { name: '다시 듣기' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '일시정지' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '이전 단계' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '취소' })).toBeEnabled();
  });

  it('busy 상태에서는 동작을 막고 controller에 busy 상태를 전달한다', async () => {
    const user = userEvent.setup();
    const props = createProps({
      message: '현재 안내를 다시 확인해 주세요.',
      canReplay: true,
      canPause: true,
      canGoPrevious: true,
      canCancel: true,
      isBusy: true
    });
    render(<F5_MainController {...props} />);

    expect(screen.getByRole('region', { name: '업무 진행 컨트롤' })).toHaveAttribute(
      'aria-busy',
      'true'
    );
    for (const name of ['다시 듣기', '일시정지', '이전 단계', '취소']) {
      const button = screen.getByRole('button', { name });
      expect(button).toBeDisabled();
      await user.click(button);
    }
    expect(props.onReplay).not.toHaveBeenCalled();
    expect(props.onPauseChange).not.toHaveBeenCalled();
    expect(props.onPrevious).not.toHaveBeenCalled();
    expect(props.onCancel).not.toHaveBeenCalled();
  });

  it.each([undefined, '', '   '])(
    'message가 %p이면 다시 듣기를 비활성화한다',
    (message) => {
      render(
        <F5_MainController
          {...createProps({ message, canReplay: true })}
        />
      );

      expect(screen.getByRole('button', { name: '다시 듣기' })).toBeDisabled();
    }
  );

  it('다시 듣기는 message를 전달하지 않고 callback을 한 번 요청한다', async () => {
    const user = userEvent.setup();
    const onReplay = vi.fn();
    const speak = vi.fn();
    vi.stubGlobal('speechSynthesis', { speak });
    render(
      <F5_MainController
        {...createProps({
          message: '현재 안내를 다시 확인해 주세요.',
          canReplay: true,
          onReplay
        })}
      />
    );

    await user.click(screen.getByRole('button', { name: '다시 듣기' }));

    expect(onReplay).toHaveBeenCalledTimes(1);
    expect(onReplay).toHaveBeenCalledWith();
    expect(speak).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(
      '안내 다시 듣기를 요청했습니다.'
    );
  });

  it('pause 상태는 부모의 rerender 전까지 바꾸지 않고 원하는 상태만 요청한다', async () => {
    const user = userEvent.setup();
    const onPauseChange = vi.fn();
    const props = createProps({ canPause: true, onPauseChange });
    const { rerender } = render(<F5_MainController {...props} />);

    const pauseButton = screen.getByRole('button', { name: '일시정지' });
    expect(pauseButton).toHaveAttribute('aria-pressed', 'false');
    await user.click(pauseButton);

    expect(onPauseChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole('button', { name: '일시정지' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      '일시정지를 요청했습니다.'
    );

    rerender(<F5_MainController {...props} isPaused />);
    const resumeButton = screen.getByRole('button', { name: '계속 진행' });
    expect(resumeButton).toHaveAttribute('aria-pressed', 'true');
    await user.click(resumeButton);

    expect(onPauseChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole('status')).toHaveTextContent(
      '계속 진행을 요청했습니다.'
    );
  });

  it('이전 단계는 capability를 따르고 history를 조작하지 않는다', async () => {
    const user = userEvent.setup();
    const onPrevious = vi.fn();
    const historyBack = vi.spyOn(window.history, 'back');
    const props = createProps({ onPrevious });
    const { rerender } = render(<F5_MainController {...props} />);

    expect(screen.getByRole('button', { name: '이전 단계' })).toBeDisabled();
    rerender(<F5_MainController {...props} canGoPrevious />);
    await user.click(screen.getByRole('button', { name: '이전 단계' }));

    expect(onPrevious).toHaveBeenCalledTimes(1);
    expect(historyBack).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(
      '이전 단계 이동을 요청했습니다.'
    );
  });

  it('취소 최초 클릭은 확인 Gate만 열고 안전한 버튼으로 focus를 이동한다', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <F5_MainController {...createProps({ canCancel: true, onCancel })} />
    );

    await user.click(screen.getByRole('button', { name: '취소' }));

    const dialog = screen.getByRole('alertdialog', {
      name: '업무 진행을 취소할까요?'
    });
    const description = screen.getByText(
      '취소를 확인하면 현재 업무를 중단하도록 요청합니다. 실제 중단 완료 여부는 연동 결과로 확인해야 합니다.'
    );
    const dismissButton = screen.getByRole('button', { name: '계속 이용' });
    const confirmButton = screen.getByRole('button', { name: '취소 확인' });
    expect(dialog).toHaveAttribute(
      'id',
      CONTROLLER_SELECTORS.cancelConfirmationPanel
    );
    expect(dialog).toHaveAttribute(
      'data-testid',
      CONTROLLER_SELECTORS.cancelConfirmationPanel
    );
    expect(dialog).toHaveAttribute('aria-describedby', description.id);
    expect(dismissButton).toHaveAttribute(
      'id',
      CONTROLLER_SELECTORS.cancelDismissButton
    );
    expect(dismissButton).toHaveAttribute(
      'data-testid',
      CONTROLLER_SELECTORS.cancelDismissButton
    );
    expect(confirmButton).toHaveAttribute(
      'id',
      CONTROLLER_SELECTORS.cancelConfirmButton
    );
    expect(confirmButton).toHaveAttribute(
      'data-testid',
      CONTROLLER_SELECTORS.cancelConfirmButton
    );
    expect(onCancel).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(dismissButton).toHaveFocus();
    });
  });

  it('계속 이용과 Escape는 Gate를 닫고 onCancel 없이 취소 버튼으로 focus를 복귀한다', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <F5_MainController {...createProps({ canCancel: true, onCancel })} />
    );
    const cancelButton = screen.getByRole('button', { name: '취소' });

    await user.click(cancelButton);
    await user.click(screen.getByRole('button', { name: '계속 이용' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
    await waitFor(() => expect(cancelButton).toHaveFocus());

    await user.click(cancelButton);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '계속 이용' })).toHaveFocus()
    );
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
    await waitFor(() => expect(cancelButton).toHaveFocus());
  });

  it('취소 확인에서만 onCancel을 한 번 호출하고 요청 상태를 안내한다', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <F5_MainController {...createProps({ canCancel: true, onCancel })} />
    );

    await user.click(screen.getByRole('button', { name: '취소' }));
    await user.click(screen.getByRole('button', { name: '취소 확인' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      '업무 취소를 요청했습니다.'
    );
  });

  it('Gate가 열린 뒤 busy가 되면 취소 확인의 중복 요청을 차단한다', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const props = createProps({ canCancel: true, onCancel });
    const { rerender } = render(<F5_MainController {...props} />);

    await user.click(screen.getByRole('button', { name: '취소' }));
    rerender(<F5_MainController {...props} isBusy />);

    const confirmButton = screen.getByRole('button', { name: '취소 확인' });
    expect(confirmButton).toBeDisabled();
    await user.click(confirmButton);
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '계속 이용' })).toBeEnabled();
  });
});
