import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { USER_DECISION_PANEL_SELECTORS } from './UserDecisionPanel';
import {
  UserDecisionPanelPreview,
  USER_DECISION_PANEL_PREVIEW_SELECTORS
} from './UserDecisionPanelPreview';
import { WORKFLOW_STATUS_PANEL_SELECTORS } from './WorkflowStatusPanel';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function expectIdentity(element: HTMLElement, selector: string) {
  expect(element).toHaveAttribute('id', selector);
  expect(element).toHaveAttribute('data-testid', selector);
}

describe('UserDecisionPanelPreview', () => {
  it('Preview root와 유형 select의 고정 selector를 표시한다', () => {
    render(<UserDecisionPanelPreview />);

    expectIdentity(
      screen.getByTestId(USER_DECISION_PANEL_PREVIEW_SELECTORS.preview),
      USER_DECISION_PANEL_PREVIEW_SELECTORS.preview
    );
    expectIdentity(
      screen.getByRole('combobox', { name: '확인할 사용자 선택 유형' }),
      USER_DECISION_PANEL_PREVIEW_SELECTORS.select
    );
  });

  it('기본 상품 유형을 자동 선택 없이 표시한다', () => {
    render(<UserDecisionPanelPreview />);

    expect(screen.getByText('가입할 Mock 상품 선택')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(
      screen
        .getAllByRole('radio')
        .every((radio) => !(radio as HTMLInputElement).checked)
    ).toBe(true);
    expect(screen.getByText(/마지막 Preview 동작: 요청이 없습니다/)).toBeInTheDocument();
  });

  it('상품 option 선택과 confirm 요청을 분리해 표시한다', async () => {
    const user = userEvent.setup();
    render(<UserDecisionPanelPreview />);

    await user.click(screen.getByRole('radio', { name: /Mock 12개월 정기예금/ }));
    expect(screen.getByText(/선택 요청: deposit-12m/)).toBeInTheDocument();
    expect(
      screen.getByTestId(USER_DECISION_PANEL_SELECTORS.confirm)
    ).toBeEnabled();

    await user.click(screen.getByTestId(USER_DECISION_PANEL_SELECTORS.confirm));
    expect(screen.getByText(/확인 요청: deposit-12m/)).toBeInTheDocument();
  });

  it.each([
    ['ACCOUNT', '출금할 Mock 계좌 선택', 'living-expense'],
    ['RECIPIENT', 'Mock 수취인 선택', 'hong-gildong']
  ])('%s 유형으로 전환해 공개 Mock option을 표시한다', async (value, title, optionId) => {
    const user = userEvent.setup();
    render(<UserDecisionPanelPreview />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: '확인할 사용자 선택 유형' }),
      value
    );

    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByTestId(`option-user-decision-${optionId}`)).toBeInTheDocument();
  });

  it('유형 전환 시 selection과 lastAction을 초기화한다', async () => {
    const user = userEvent.setup();
    render(<UserDecisionPanelPreview />);

    await user.click(screen.getByRole('radio', { name: /Mock 12개월 정기예금/ }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: '확인할 사용자 선택 유형' }),
      'ACCOUNT'
    );

    expect(
      screen
        .getAllByRole('radio')
        .every((radio) => !(radio as HTMLInputElement).checked)
    ).toBe(true);
    expect(screen.getByText(/마지막 Preview 동작: 요청이 없습니다/)).toBeInTheDocument();
  });

  it.each([
    ['EMPTY', '선택 항목을 준비하고 있습니다.'],
    ['BUSY', '선택 확인 요청을 처리하고 있습니다.'],
    ['PANEL_DISABLED', '현재는 선택 기능을 사용할 수 없습니다.']
  ])('%s 경계 상태를 표시한다', async (value, expectedText) => {
    const user = userEvent.setup();
    render(<UserDecisionPanelPreview />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: '확인할 사용자 선택 유형' }),
      value
    );

    expect(
      screen.getByTestId(USER_DECISION_PANEL_SELECTORS.status)
    ).toHaveTextContent(expectedText);
  });

  it('disabled option 유형은 해당 radio와 선택 불가 텍스트를 표시한다', async () => {
    const user = userEvent.setup();
    render(<UserDecisionPanelPreview />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: '확인할 사용자 선택 유형' }),
      'DISABLED_OPTION'
    );

    expect(
      screen.getByTestId('option-user-decision-deposit-preferred')
    ).toBeDisabled();
    expect(screen.getByText('선택 불가')).toBeInTheDocument();
  });

  it('busy와 panel disabled는 radio와 confirm을 실제 비활성화한다', async () => {
    const user = userEvent.setup();
    render(<UserDecisionPanelPreview />);
    const typeSelect = screen.getByRole('combobox', {
      name: '확인할 사용자 선택 유형'
    });

    for (const value of ['BUSY', 'PANEL_DISABLED']) {
      await user.selectOptions(typeSelect, value);
      expect(
        screen
          .getAllByRole('radio')
          .every((radio) => (radio as HTMLInputElement).disabled)
      ).toBe(true);
      expect(
        screen.getByTestId(USER_DECISION_PANEL_SELECTORS.confirm)
      ).toBeDisabled();
    }
  });

  it('WorkflowStatusPanel과 UserDecisionPanel을 형제 요소로 조합한다', () => {
    render(<UserDecisionPanelPreview />);

    const workflowPanel = screen.getByTestId(
      WORKFLOW_STATUS_PANEL_SELECTORS.panel
    );
    const decisionPanel = screen.getByTestId(
      USER_DECISION_PANEL_SELECTORS.panel
    );

    expect(workflowPanel.parentElement).toBe(decisionPanel.parentElement);
    expect(
      screen.getByText('사용자 선택 필요')
    ).toBeInTheDocument();
  });

  it('API·WebSocket·storage·timer나 실제 금융 Action을 사용하지 않는다', () => {
    const fetchMock = vi.fn();
    const webSocketMock = vi.fn();
    const storageGetSpy = vi.spyOn(Storage.prototype, 'getItem');
    const storageSetSpy = vi.spyOn(Storage.prototype, 'setItem');
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const intervalSpy = vi.spyOn(globalThis, 'setInterval');

    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('WebSocket', webSocketMock);

    render(<UserDecisionPanelPreview />);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(webSocketMock).not.toHaveBeenCalled();
    expect(storageGetSpy).not.toHaveBeenCalled();
    expect(storageSetSpy).not.toHaveBeenCalled();
    expect(timeoutSpy).not.toHaveBeenCalled();
    expect(intervalSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /송금|가입|실행/ })).not.toBeInTheDocument();
  });
});
