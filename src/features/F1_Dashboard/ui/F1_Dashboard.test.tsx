import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as orchestratorClient from '@/shared/api/orchestratorClient';
import type { DashboardSessionStartResult } from '../model/dashboard-session';
import F1_Dashboard from './F1_Dashboard';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('F1_Dashboard', () => {
  it('Dashboard와 데모 사이트, 두 업무 및 비거래 안내를 표시한다', () => {
    render(<F1_Dashboard />);

    expect(
      screen.getByRole('heading', { name: '금융 업무 시작' })
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText('금융길잡이 데모뱅크')).toBeInTheDocument();
    expect(screen.getByText('예금 가입')).toBeInTheDocument();
    expect(screen.getByText('계좌이체')).toBeInTheDocument();
    expect(
      screen.getByText('100만 원으로 정기예금 가입 절차를 시작해 주세요.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/12개월/)).not.toBeInTheDocument();
    expect(
      screen.getByRole('group', {
        name: '1. 이용할 사이트 선택'
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('group', {
        name: '2. 진행할 업무 선택'
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        '현재는 시연용 데모 환경이며 실제 금융거래는 발생하지 않습니다.'
      )
    ).toBeInTheDocument();
  });

  it('초기에는 모든 radio가 선택 전이고 시작 버튼과 업무 radio가 비활성화된다', () => {
    render(<F1_Dashboard />);

    const siteRadio = screen.getByRole('radio', {
      name: /금융길잡이 데모뱅크/
    });
    const depositRadio = screen.getByRole('radio', {
      name: /예금 가입/
    });
    const transferRadio = screen.getByRole('radio', {
      name: /계좌이체/
    });

    expect(siteRadio).not.toBeChecked();
    expect(depositRadio).not.toBeChecked();
    expect(transferRadio).not.toBeChecked();
    expect(depositRadio).toBeDisabled();
    expect(transferRadio).toBeDisabled();
    const startButton = screen.getByRole('button', {
      name: '선택한 업무 시작'
    });
    expect(startButton).toBeDisabled();
    expect(startButton).toHaveAttribute('type', 'button');
    expect(startButton).toHaveClass('min-h-14');
  });

  it('사이트를 선택하면 업무를 선택할 수 있지만 시작 버튼은 계속 비활성화된다', async () => {
    const user = userEvent.setup();
    render(<F1_Dashboard />);

    const siteRadio = screen.getByRole('radio', {
      name: /금융길잡이 데모뱅크/
    });
    await user.click(siteRadio);

    expect(siteRadio).toBeChecked();
    expect(siteRadio.closest('label')).toHaveTextContent('선택됨');
    expect(
      screen.getByRole('radio', { name: /예금 가입/ })
    ).toBeEnabled();
    expect(
      screen.getByRole('radio', { name: /계좌이체/ })
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: '선택한 업무 시작' })
    ).toBeDisabled();
  });

  it.each(['예금 가입', '계좌이체'] as const)(
    '사이트와 %s 업무를 선택하면 시작 버튼이 활성화된다',
    async (taskName) => {
      const user = userEvent.setup();
      render(<F1_Dashboard />);

      await user.click(
        screen.getByRole('radio', {
          name: /금융길잡이 데모뱅크/
        })
      );
      const taskRadio = screen.getByRole('radio', {
        name: new RegExp(taskName)
      });
      await user.click(taskRadio);

      expect(taskRadio).toBeChecked();
      expect(taskRadio.closest('label')).toHaveTextContent('선택됨');
      expect(
        screen.getByRole('button', { name: '선택한 업무 시작' })
      ).toBeEnabled();

      const selectionSummary = screen.getByRole('region', {
        name: '선택 결과'
      });
      expect(
        within(selectionSummary).getByText('금융길잡이 데모뱅크')
      ).toBeInTheDocument();
      expect(
        within(selectionSummary).getByText(taskName)
      ).toBeInTheDocument();
    }
  );

  it('키보드만으로 사이트와 업무를 선택할 수 있다', async () => {
    const user = userEvent.setup();
    render(<F1_Dashboard />);

    const siteRadio = screen.getByRole('radio', {
      name: /금융길잡이 데모뱅크/
    });
    const depositRadio = screen.getByRole('radio', {
      name: /예금 가입/
    });

    await user.tab();
    expect(siteRadio).toHaveFocus();
    await user.keyboard('[Space]');
    expect(siteRadio).toBeChecked();

    await user.tab();
    expect(depositRadio).toHaveFocus();
    await user.keyboard('[Space]');
    expect(depositRadio).toBeChecked();
  });

  it('예금 시작 시 선택값을 한 번 전달하고 API 없이 준비 상태를 안내한다', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    const fetchMock = vi.fn();
    const webSocketMock = vi.fn();
    const createSessionSpy = vi.spyOn(
      orchestratorClient,
      'createStreamSession'
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('WebSocket', webSocketMock);
    render(<F1_Dashboard onStart={onStart} />);

    await user.click(
      screen.getByRole('radio', {
        name: /금융길잡이 데모뱅크/
      })
    );
    await user.click(
      screen.getByRole('radio', { name: /예금 가입/ })
    );
    await user.click(
      screen.getByRole('button', { name: '선택한 업무 시작' })
    );

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith({
      siteId: 'demo-bank',
      taskType: 'OPEN_DEPOSIT'
    });
    expect(
      screen.getByText('100만 원으로 정기예금 가입 절차를 시작해 주세요.')
    ).toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent(
      '선택한 업무를 시작할 준비가 완료되었습니다.'
    );
    expect(
      screen.queryByText('금융 업무 세션이 준비되었습니다.')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('dashboard-session-result')
    ).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(createSessionSpy).not.toHaveBeenCalled();
    expect(webSocketMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/WorkflowStatus:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ScreenType:/)).not.toBeInTheDocument();
    expect(
      screen.getByText('WebSocket 연결 안 됨')
    ).toBeInTheDocument();
  });

  it('이체 시작 시 정확한 선택값을 전달하며 onStart가 없어도 동작한다', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    const { rerender } = render(<F1_Dashboard onStart={onStart} />);

    await user.click(
      screen.getByRole('radio', {
        name: /금융길잡이 데모뱅크/
      })
    );
    await user.click(
      screen.getByRole('radio', { name: /계좌이체/ })
    );
    await user.click(
      screen.getByRole('button', { name: '선택한 업무 시작' })
    );

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith({
      siteId: 'demo-bank',
      taskType: 'TRANSFER_MONEY'
    });

    rerender(<F1_Dashboard />);
    await user.click(
      screen.getByRole('button', { name: '선택한 업무 시작' })
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      '선택한 업무를 시작할 준비가 완료되었습니다.'
    );
  });

  it('요청 중 loading과 disabled를 표시하고 중복 시작을 방지한다', async () => {
    const user = userEvent.setup();
    const deferred = createDeferred<DashboardSessionStartResult>();
    const onStart = vi.fn(() => deferred.promise);
    render(<F1_Dashboard onStart={onStart} />);

    await user.click(
      screen.getByRole('radio', {
        name: /금융길잡이 데모뱅크/
      })
    );
    await user.click(
      screen.getByRole('radio', { name: /예금 가입/ })
    );
    const startButton = screen.getByRole('button', {
      name: '선택한 업무 시작'
    });

    fireEvent.click(startButton);
    fireEvent.click(startButton);

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(startButton).toBeDisabled();
    expect(startButton).toHaveAttribute('aria-busy', 'true');
    expect(
      screen.getByRole('radio', {
        name: /금융길잡이 데모뱅크/
      })
    ).toBeDisabled();
    expect(
      screen.getByRole('radio', { name: /예금 가입/ })
    ).toBeDisabled();
    expect(
      screen.getByRole('radio', { name: /계좌이체/ })
    ).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(
      '세션을 준비하고 있습니다.'
    );

    deferred.resolve({
      sessionId: 'session-loading-test',
      createdAt: '2026-07-31T00:00:00.000Z'
    });

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        '금융 업무 세션이 준비되었습니다.'
      );
    });
    expect(startButton).toBeEnabled();
  });

  it('성공 결과에서 최소 세션 정보와 SESSION_READY를 표시한다', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn().mockResolvedValue({
      sessionId: 'session-001',
      createdAt: '2026-07-31T00:00:00.000Z'
    });
    render(<F1_Dashboard onStart={onStart} />);

    await user.click(
      screen.getByRole('radio', {
        name: /금융길잡이 데모뱅크/
      })
    );
    await user.click(
      screen.getByRole('radio', { name: /계좌이체/ })
    );
    await user.click(
      screen.getByRole('button', { name: '선택한 업무 시작' })
    );

    expect(
      await screen.findByText('금융 업무 세션이 준비되었습니다.')
    ).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-session-result')).toHaveTextContent(
      'session-001'
    );
    expect(screen.queryByText(/WorkflowStatus:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ScreenType:/)).not.toBeInTheDocument();
    expect(screen.getByText('WebSocket 연결 안 됨')).toBeInTheDocument();
    expect(screen.queryByText(/createdAt/)).not.toBeInTheDocument();
  });

  it('오류 원문을 숨기고 선택을 유지한 채 재시도할 수 있다', async () => {
    const user = userEvent.setup();
    const onStart = vi
      .fn()
      .mockRejectedValueOnce(
        new Error('internal response from https://private.example.test')
      )
      .mockResolvedValueOnce({
        sessionId: 'session-retry-success',
        createdAt: '2026-07-31T00:00:00.000Z'
      });
    render(<F1_Dashboard onStart={onStart} />);

    const siteRadio = screen.getByRole('radio', {
      name: /금융길잡이 데모뱅크/
    });
    const depositRadio = screen.getByRole('radio', {
      name: /예금 가입/
    });
    await user.click(siteRadio);
    await user.click(depositRadio);
    const startButton = screen.getByRole('button', {
      name: '선택한 업무 시작'
    });

    await user.click(startButton);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '세션을 준비하지 못했습니다. 다시 시도해 주세요.'
    );
    expect(screen.queryByText(/internal response/)).not.toBeInTheDocument();
    expect(siteRadio).toBeChecked();
    expect(depositRadio).toBeChecked();
    expect(startButton).toBeEnabled();

    await user.click(startButton);

    expect(
      await screen.findByText('금융 업무 세션이 준비되었습니다.')
    ).toBeInTheDocument();
    expect(onStart).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByTestId('dashboard-session-result')).toHaveTextContent(
      'session-retry-success'
    );
  });

  it('고정 자동화 ID와 data-testid를 동일하게 유지한다', () => {
    render(<F1_Dashboard />);

    for (const testId of [
      'radio-site-demo-bank',
      'radio-task-open-deposit',
      'radio-task-transfer-money',
      'btn-start-financial-task'
    ]) {
      expect(screen.getByTestId(testId)).toHaveAttribute('id', testId);
    }

    for (const radio of screen.getAllByRole('radio')) {
      expect(radio.closest('label')).toHaveAttribute('for', radio.id);
      expect(radio).toHaveClass('focus-visible:ring-4');
    }
  });

  it('시작 버튼에 활성화 조건 안내를 프로그램적으로 연결한다', () => {
    render(<F1_Dashboard />);

    const startButton = screen.getByTestId('btn-start-financial-task');
    const descriptionId = startButton.getAttribute('aria-describedby');
    expect(descriptionId).toBe('description-dashboard-start-requirements');
    expect(document.getElementById(descriptionId ?? '')).toHaveTextContent(
      '사이트와 업무를 모두 선택해 주세요.'
    );
  });
});
