import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WORKFLOW_STATUS_PANEL_SELECTORS } from './WorkflowStatusPanel';
import {
  WorkflowStatusPanelPreview,
  WORKFLOW_STATUS_PANEL_PREVIEW_SELECTORS
} from './WorkflowStatusPanelPreview';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function expectIdentity(element: HTMLElement, selector: string) {
  expect(element).toHaveAttribute('id', selector);
  expect(element).toHaveAttribute('data-testid', selector);
}

describe('WorkflowStatusPanelPreview', () => {
  it('Preview root와 실제 select의 고정 selector를 표시한다', () => {
    render(<WorkflowStatusPanelPreview />);

    const preview = screen.getByTestId(
      WORKFLOW_STATUS_PANEL_PREVIEW_SELECTORS.preview
    );
    const select = screen.getByRole('combobox', {
      name: '확인할 Workflow 상태'
    });

    expectIdentity(preview, WORKFLOW_STATUS_PANEL_PREVIEW_SELECTORS.preview);
    expectIdentity(select, WORKFLOW_STATUS_PANEL_PREVIEW_SELECTORS.select);
  });

  it('기본 AI_EXECUTING을 자동 전환 없이 표시한다', () => {
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const intervalSpy = vi.spyOn(globalThis, 'setInterval');

    render(<WorkflowStatusPanelPreview />);

    expect(screen.getByText('AI 안내 작업 진행 중')).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: '확인할 Workflow 상태' })
    ).toHaveValue('AI_EXECUTING');
    expect(timeoutSpy).not.toHaveBeenCalled();
    expect(intervalSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['PAGE_LOADING', '금융 페이지를 불러오는 중'],
    ['ERROR', '업무 처리 오류'],
    ['CANCELLED', '업무 취소'],
    ['COMPLETED', '업무 안내 완료']
  ])('%s 선택 시 해당 상태 패널로 변경한다', async (value, heading) => {
    const user = userEvent.setup();
    render(<WorkflowStatusPanelPreview />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: '확인할 Workflow 상태' }),
      value
    );

    expect(screen.getByTestId(WORKFLOW_STATUS_PANEL_SELECTORS.heading)).toHaveTextContent(
      heading
    );
  });

  it('알 수 없는 sentinel은 원문을 숨기고 안전한 fallback을 표시한다', async () => {
    const user = userEvent.setup();
    render(<WorkflowStatusPanelPreview />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: '확인할 Workflow 상태' }),
      'UNKNOWN_RUNTIME_STATUS'
    );

    expect(screen.getByText('상태를 확인하고 있음')).toBeInTheDocument();
    expect(
      screen.queryByText('UNKNOWN_RUNTIME_STATUS')
    ).not.toBeInTheDocument();
  });

  it('API·WebSocket·storage를 사용하거나 action을 제공하지 않는다', () => {
    const fetchMock = vi.fn();
    const webSocketMock = vi.fn();
    const storageGetSpy = vi.spyOn(Storage.prototype, 'getItem');
    const storageSetSpy = vi.spyOn(Storage.prototype, 'setItem');

    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('WebSocket', webSocketMock);

    render(<WorkflowStatusPanelPreview />);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(webSocketMock).not.toHaveBeenCalled();
    expect(storageGetSpy).not.toHaveBeenCalled();
    expect(storageSetSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText('재시도')).not.toBeInTheDocument();
  });
});
