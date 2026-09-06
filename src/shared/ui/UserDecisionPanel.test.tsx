import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { UserDecisionOption } from '@/shared/model/user-decision';
import {
  UserDecisionPanel,
  USER_DECISION_PANEL_SELECTORS,
  type UserDecisionPanelProps
} from './UserDecisionPanel';

const options: readonly UserDecisionOption[] = [
  {
    id: 'deposit-12m',
    label: 'Mock 정기예금',
    description: '시연용 상품 설명'
  },
  {
    id: 'deposit-preferred',
    label: 'Mock 우대 상품',
    description: '시연용 우대 상품 설명'
  }
];

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function createProps(
  overrides: Partial<UserDecisionPanelProps> = {}
): UserDecisionPanelProps {
  return {
    options,
    selectedOptionId: null,
    onSelect: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides
  };
}

function expectIdentity(element: HTMLElement, selector: string) {
  expect(element).toHaveAttribute('id', selector);
  expect(element).toHaveAttribute('data-testid', selector);
}

describe('UserDecisionPanel', () => {
  it('고정 selector, heading, fieldset과 legend를 렌더링한다', () => {
    render(<UserDecisionPanel {...createProps()} />);

    expectIdentity(
      screen.getByTestId(USER_DECISION_PANEL_SELECTORS.panel),
      USER_DECISION_PANEL_SELECTORS.panel
    );
    expectIdentity(
      screen.getByTestId(USER_DECISION_PANEL_SELECTORS.heading),
      USER_DECISION_PANEL_SELECTORS.heading
    );
    expectIdentity(
      screen.getByTestId(USER_DECISION_PANEL_SELECTORS.options),
      USER_DECISION_PANEL_SELECTORS.options
    );
    expectIdentity(
      screen.getByTestId(USER_DECISION_PANEL_SELECTORS.status),
      USER_DECISION_PANEL_SELECTORS.status
    );
    expectIdentity(
      screen.getByTestId(USER_DECISION_PANEL_SELECTORS.confirm),
      USER_DECISION_PANEL_SELECTORS.confirm
    );
    expect(
      screen.getByTestId(USER_DECISION_PANEL_SELECTORS.confirm)
    ).toHaveAttribute(
      'aria-describedby',
      USER_DECISION_PANEL_SELECTORS.status
    );
    expect(screen.getByRole('group', { name: '선택 항목' })).toBeInTheDocument();
  });

  it('동일한 name의 native radio와 안정적인 option selector를 사용한다', () => {
    render(<UserDecisionPanel {...createProps()} />);

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(radios[0]).toHaveAttribute('type', 'radio');
    expect(radios[0]).toHaveAttribute('name', radios[1].getAttribute('name'));
    expectIdentity(radios[0], 'option-user-decision-deposit-12m');
    expectIdentity(radios[1], 'option-user-decision-deposit-preferred');
    expect(radios[0]).not.toHaveAttribute('role');
    expect(radios[0]).not.toHaveAttribute('aria-checked');
  });

  it('description을 radio에 연결한다', () => {
    render(<UserDecisionPanel {...createProps()} />);

    const radio = screen.getByRole('radio', { name: /Mock 정기예금/ });
    expect(radio).toHaveAccessibleDescription('시연용 상품 설명');
  });

  it('초기에는 모두 미선택이며 confirm을 막고 callback이나 focus를 만들지 않는다', () => {
    const onSelect = vi.fn();
    const onConfirm = vi.fn();
    render(
      <UserDecisionPanel {...createProps({ onSelect, onConfirm })} />
    );

    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).not.toBeChecked();
    }
    expect(
      screen.getByTestId(USER_DECISION_PANEL_SELECTORS.confirm)
    ).toBeDisabled();
    expect(
      screen.getByTestId(USER_DECISION_PANEL_SELECTORS.status)
    ).toHaveTextContent('선택된 항목이 없습니다.');
    expect(onSelect).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(document.body);
  });

  it('option 선택은 onSelect만 1회 호출하고 controlled rerender 전 checked를 확정하지 않는다', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onConfirm = vi.fn();
    render(
      <UserDecisionPanel {...createProps({ onSelect, onConfirm })} />
    );

    const radio = screen.getByRole('radio', { name: /Mock 정기예금/ });
    await user.click(radio);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('deposit-12m');
    expect(onConfirm).not.toHaveBeenCalled();
    expect(radio).not.toBeChecked();
  });

  it('selectedOptionId rerender로만 checked와 confirm Gate를 갱신한다', () => {
    const props = createProps();
    const { rerender } = render(<UserDecisionPanel {...props} />);

    rerender(
      <UserDecisionPanel {...props} selectedOptionId="deposit-12m" />
    );
    expect(
      screen.getByRole('radio', { name: /Mock 정기예금/ })
    ).toBeChecked();
    expect(
      screen.getByTestId(USER_DECISION_PANEL_SELECTORS.confirm)
    ).toBeEnabled();

    rerender(
      <UserDecisionPanel {...props} selectedOptionId="deposit-preferred" />
    );
    expect(
      screen.getByRole('radio', { name: /Mock 정기예금/ })
    ).not.toBeChecked();
    expect(
      screen.getByRole('radio', { name: /Mock 우대 상품/ })
    ).toBeChecked();
  });

  it('confirm callback에 검증된 option ID를 정확히 1회 전달한다', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <UserDecisionPanel
        {...createProps({ selectedOptionId: 'deposit-12m', onConfirm })}
      />
    );

    await user.click(
      screen.getByTestId(USER_DECISION_PANEL_SELECTORS.confirm)
    );

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('deposit-12m');
  });

  it('없는 selected ID와 disabled selected option은 미선택으로 보고 confirm을 막는다', () => {
    const disabledOptions = [options[0], { ...options[1], disabled: true }];
    const props = createProps({ options: disabledOptions });
    const { rerender } = render(
      <UserDecisionPanel {...props} selectedOptionId="missing-option" />
    );

    expect(
      screen
        .getAllByRole('radio')
        .every((radio) => !(radio as HTMLInputElement).checked)
    ).toBe(true);
    expect(
      screen.getByTestId(USER_DECISION_PANEL_SELECTORS.confirm)
    ).toBeDisabled();

    rerender(
      <UserDecisionPanel
        {...props}
        selectedOptionId="deposit-preferred"
      />
    );
    expect(
      screen.getByRole('radio', { name: /Mock 우대 상품/ })
    ).toBeDisabled();
    expect(
      screen.getByRole('radio', { name: /Mock 우대 상품/ })
    ).not.toBeChecked();
    expect(screen.getByText('선택 불가')).toBeInTheDocument();
    expect(
      screen.getByTestId(USER_DECISION_PANEL_SELECTORS.confirm)
    ).toBeDisabled();
  });

  it('disabled option을 조작해도 selection callback을 호출하지 않는다', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <UserDecisionPanel
        {...createProps({
          options: [{ ...options[0], disabled: true }],
          onSelect
        })}
      />
    );

    const radio = screen.getByRole('radio');
    await user.click(radio);

    expect(radio).toBeDisabled();
    expect(onSelect).not.toHaveBeenCalled();
    expect(
      document.getElementById('description-user-decision-deposit-12m')
    ).toHaveTextContent('현재 선택할 수 없습니다.');
  });

  it('panel disabled는 모든 control과 callback을 차단한다', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <UserDecisionPanel
        {...createProps({ disabled: true, onSelect })}
      />
    );

    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toBeDisabled();
    }
    await user.click(screen.getAllByRole('radio')[0]);
    expect(onSelect).not.toHaveBeenCalled();
    expect(
      screen.getByTestId(USER_DECISION_PANEL_SELECTORS.confirm)
    ).toBeDisabled();
  });

  it('busy는 aria-busy와 처리 안내를 표시하고 전체 control을 막는다', () => {
    render(
      <UserDecisionPanel
        {...createProps({ selectedOptionId: 'deposit-12m', isBusy: true })}
      />
    );

    expect(
      screen.getByTestId(USER_DECISION_PANEL_SELECTORS.panel)
    ).toHaveAttribute('aria-busy', 'true');
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toBeDisabled();
    }
    expect(
      screen.getByTestId(USER_DECISION_PANEL_SELECTORS.confirm)
    ).toBeDisabled();
    expect(
      screen.getByTestId(USER_DECISION_PANEL_SELECTORS.status)
    ).toHaveTextContent('선택 확인 요청을 처리하고 있습니다.');
  });

  it('EMPTY는 radio 없이 안전한 안내와 disabled confirm을 표시한다', () => {
    render(<UserDecisionPanel {...createProps({ options: [] })} />);

    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(
      screen.getByTestId(USER_DECISION_PANEL_SELECTORS.status)
    ).toHaveTextContent('선택 항목을 준비하고 있습니다.');
    expect(
      screen.getByTestId(USER_DECISION_PANEL_SELECTORS.confirm)
    ).toBeDisabled();
    expect(screen.queryByText(/재시도/)).not.toBeInTheDocument();
  });

  it.each([
    [
      [{ id: 'INVALID_ID', label: '노출하면 안 되는 ID' }],
      'invalid ID'
    ],
    [
      [
        { id: 'duplicate', label: '첫 항목' },
        { id: 'duplicate', label: '둘째 항목' }
      ],
      'duplicate ID'
    ],
    [[{ id: 'blank-label', label: '   ' }], 'blank label']
  ] satisfies Array<[UserDecisionOption[], string]>)(
    '%s는 radio나 원문 없이 INVALID 안내를 표시한다',
    (invalidOptions) => {
      render(
        <UserDecisionPanel {...createProps({ options: invalidOptions })} />
      );

      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
      expect(
        screen.getByTestId(USER_DECISION_PANEL_SELECTORS.status)
      ).toHaveTextContent('선택 항목을 표시할 수 없습니다.');
      expect(screen.queryByText('INVALID_ID')).not.toBeInTheDocument();
      expect(
        screen.getByTestId(USER_DECISION_PANEL_SELECTORS.confirm)
      ).toBeDisabled();
    }
  );

  it('options에서 선택 항목이 제거되면 callback 없이 미선택과 disabled Gate가 된다', () => {
    const onSelect = vi.fn();
    const props = createProps({
      selectedOptionId: 'deposit-12m',
      onSelect
    });
    const { rerender } = render(<UserDecisionPanel {...props} />);

    rerender(
      <UserDecisionPanel {...props} options={[options[1]]} />
    );

    expect(screen.getByRole('radio')).not.toBeChecked();
    expect(
      screen.getByTestId(USER_DECISION_PANEL_SELECTORS.confirm)
    ).toBeDisabled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('선택 option이 disabled로 바뀌면 미선택으로 표현하고 callback 없이 Gate를 막는다', () => {
    const onSelect = vi.fn();
    const props = createProps({
      selectedOptionId: 'deposit-12m',
      onSelect
    });
    const { rerender } = render(<UserDecisionPanel {...props} />);

    rerender(
      <UserDecisionPanel
        {...props}
        options={[{ ...options[0], disabled: true }, options[1]]}
      />
    );

    expect(
      screen.getByRole('radio', { name: /Mock 정기예금/ })
    ).not.toBeChecked();
    expect(
      screen.getByTestId(USER_DECISION_PANEL_SELECTORS.confirm)
    ).toBeDisabled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('option 순서와 최신 label·description을 props 그대로 반영한다', () => {
    const props = createProps({ selectedOptionId: 'deposit-12m' });
    const { rerender } = render(<UserDecisionPanel {...props} />);

    rerender(
      <UserDecisionPanel
        {...props}
        options={[
          options[1],
          {
            ...options[0],
            label: '변경된 Mock 상품',
            description: '변경된 설명'
          }
        ]}
      />
    );

    const group = screen.getByTestId(USER_DECISION_PANEL_SELECTORS.options);
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((radio) => radio.id)).toEqual([
      'option-user-decision-deposit-preferred',
      'option-user-decision-deposit-12m'
    ]);
    expect(screen.getByText('변경된 Mock 상품')).toBeInTheDocument();
    expect(screen.getByText('변경된 설명')).toBeInTheDocument();
  });

  it('공백 title·message는 기본 문구로 대체하고 HTML 모양 문자열을 text로 표시한다', () => {
    const { rerender } = render(
      <UserDecisionPanel {...createProps({ title: ' ', message: '  ' })} />
    );

    expect(screen.getByText('직접 선택해 주세요')).toBeInTheDocument();
    expect(
      screen.getByText(
        '아래 항목을 확인한 뒤 하나를 직접 선택하고 확인해 주세요.'
      )
    ).toBeInTheDocument();

    rerender(
      <UserDecisionPanel
        {...createProps({
          title: '  <strong>제목</strong>  ',
          message: '  <em>안내</em>  ',
          options: [
            {
              id: 'safe-option',
              label: '<b>Mock 항목</b>',
              description: '<script>설명</script>'
            }
          ]
        })}
      />
    );

    expect(screen.getByText('<strong>제목</strong>')).toBeInTheDocument();
    expect(screen.getByText('<em>안내</em>')).toBeInTheDocument();
    expect(screen.getByText('<b>Mock 항목</b>')).toBeInTheDocument();
    expect(screen.getByText('<script>설명</script>')).toBeInTheDocument();
    expect(document.querySelector('strong, em, b, script')).not.toBeInTheDocument();
  });

  it('상태 영역은 polite live region이고 버튼은 최소 56px 스타일을 사용한다', () => {
    render(<UserDecisionPanel {...createProps()} />);

    expect(
      screen.getByTestId(USER_DECISION_PANEL_SELECTORS.status)
    ).toHaveAttribute('role', 'status');
    expect(
      screen.getByTestId(USER_DECISION_PANEL_SELECTORS.status)
    ).toHaveAttribute('aria-live', 'polite');
    expect(
      screen.getByTestId(USER_DECISION_PANEL_SELECTORS.confirm)
    ).toHaveClass('min-h-14');
  });

  it('렌더링과 선택만으로 API·WebSocket·storage·timer·URL 이동을 사용하지 않는다', () => {
    const fetchMock = vi.fn();
    const webSocketMock = vi.fn();
    const storageGetSpy = vi.spyOn(Storage.prototype, 'getItem');
    const storageSetSpy = vi.spyOn(Storage.prototype, 'setItem');
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const intervalSpy = vi.spyOn(globalThis, 'setInterval');
    const initialUrl = window.location.href;

    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('WebSocket', webSocketMock);

    render(<UserDecisionPanel {...createProps()} />);
    fireEvent.click(screen.getByRole('radio', { name: /Mock 정기예금/ }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(webSocketMock).not.toHaveBeenCalled();
    expect(storageGetSpy).not.toHaveBeenCalled();
    expect(storageSetSpy).not.toHaveBeenCalled();
    expect(timeoutSpy).not.toHaveBeenCalled();
    expect(intervalSpy).not.toHaveBeenCalled();
    expect(window.location.href).toBe(initialUrl);
    expect(screen.queryByText(/재시도/)).not.toBeInTheDocument();
  });
});
