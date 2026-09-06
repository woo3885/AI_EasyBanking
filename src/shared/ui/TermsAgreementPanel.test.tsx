import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AgreementTerm } from '@/shared/model/terms-agreement';
import {
  TermsAgreementPanel,
  TERMS_AGREEMENT_PANEL_SELECTORS,
  type TermsAgreementPanelProps
} from './TermsAgreementPanel';

const terms: readonly AgreementTerm[] = [
  {
    id: 'service-agreement',
    label: '서비스 이용약관',
    required: true,
    description: '서비스 이용 조건을 확인하는 Mock 설명입니다.'
  },
  {
    id: 'personal-information',
    label: '개인정보 수집·이용',
    required: true,
    description: '개인정보 처리 범위를 확인하는 Mock 설명입니다.'
  },
  {
    id: 'marketing-information',
    label: '마케팅 정보 수신',
    required: false
  }
];

function createProps(
  overrides: Partial<TermsAgreementPanelProps> = {}
): TermsAgreementPanelProps {
  return {
    terms,
    selectedTermIds: new Set(),
    onToggle: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides
  };
}

function expectIdentity(element: HTMLElement, selector: string) {
  expect(element).toHaveAttribute('id', selector);
  expect(element).toHaveAttribute('data-testid', selector);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('TermsAgreementPanel', () => {
  it('이름 있는 Panel과 모든 고정 selector를 렌더링한다', () => {
    render(<TermsAgreementPanel {...createProps()} />);

    const panel = screen.getByTestId(TERMS_AGREEMENT_PANEL_SELECTORS.panel);
    expectIdentity(panel, TERMS_AGREEMENT_PANEL_SELECTORS.panel);
    expectIdentity(
      screen.getByTestId(TERMS_AGREEMENT_PANEL_SELECTORS.heading),
      TERMS_AGREEMENT_PANEL_SELECTORS.heading
    );
    expectIdentity(
      screen.getByTestId(TERMS_AGREEMENT_PANEL_SELECTORS.options),
      TERMS_AGREEMENT_PANEL_SELECTORS.options
    );
    expectIdentity(
      screen.getByTestId(TERMS_AGREEMENT_PANEL_SELECTORS.status),
      TERMS_AGREEMENT_PANEL_SELECTORS.status
    );
    expectIdentity(
      screen.getByTestId(TERMS_AGREEMENT_PANEL_SELECTORS.confirm),
      TERMS_AGREEMENT_PANEL_SELECTORS.confirm
    );
    expect(
      screen.getByTestId(TERMS_AGREEMENT_PANEL_SELECTORS.confirm)
    ).toHaveAttribute(
      'aria-describedby',
      TERMS_AGREEMENT_PANEL_SELECTORS.status
    );
    expect(panel).toHaveAccessibleName('약관 확인');
  });

  it('fieldset과 legend를 각각 하나만 사용하고 native checkbox를 표시한다', () => {
    const { container } = render(<TermsAgreementPanel {...createProps()} />);

    expect(container.querySelectorAll('fieldset')).toHaveLength(1);
    expect(container.querySelectorAll('legend')).toHaveLength(1);
    expect(screen.getByText('개별 약관 선택')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(
      screen.getAllByRole('checkbox').every((checkbox) => checkbox.tagName === 'INPUT')
    ).toBe(true);
  });

  it('모든 동적 checkbox selector의 id와 data-testid가 일치하고 label과 연결된다', () => {
    render(<TermsAgreementPanel {...createProps()} />);

    for (const term of terms) {
      const selector = `term-user-agreement-${term.id}`;
      const checkbox = screen.getByTestId(selector);
      expectIdentity(checkbox, selector);
      expect(
        document.querySelector(`label[for="${selector}"]`)
      ).toBeInTheDocument();
    }

    const renderedIds = Array.from(document.querySelectorAll('[id]')).map(
      (element) => element.id
    );
    expect(new Set(renderedIds).size).toBe(renderedIds.length);
  });

  it('초기 기본 선택 없이 필수·선택 구분과 상태 텍스트를 표시한다', () => {
    render(<TermsAgreementPanel {...createProps()} />);

    expect(
      screen
        .getAllByRole('checkbox')
        .every((checkbox) => !(checkbox as HTMLInputElement).checked)
    ).toBe(true);
    expect(screen.getAllByText('[필수]')).toHaveLength(2);
    expect(screen.getByText('[선택]')).toBeInTheDocument();
    expect(screen.getAllByText('선택 전')).toHaveLength(3);
    expect(
      screen.getByTestId(TERMS_AGREEMENT_PANEL_SELECTORS.confirm)
    ).toBeDisabled();
    expect(
      screen.getByTestId(TERMS_AGREEMENT_PANEL_SELECTORS.confirm)
    ).toHaveAttribute('type', 'button');
    expect(
      screen.getByText(
        '필수 약관과 선택 약관을 각각 확인하고 직접 선택해 주세요.'
      )
    ).toBeInTheDocument();
    expect(document.activeElement).toBe(document.body);
  });

  it('필수 checkbox에 native required를 적용하고 선택 checkbox에는 적용하지 않는다', () => {
    render(<TermsAgreementPanel {...createProps()} />);

    expect(
      screen.getByRole('checkbox', { name: /서비스 이용약관/ })
    ).toBeRequired();
    expect(
      screen.getByRole('checkbox', { name: /개인정보 수집·이용/ })
    ).toBeRequired();
    expect(
      screen.getByRole('checkbox', { name: /마케팅 정보 수신/ })
    ).not.toBeRequired();
  });

  it('description을 checkbox의 aria-describedby와 연결한다', () => {
    render(<TermsAgreementPanel {...createProps()} />);

    const checkbox = screen.getByRole('checkbox', {
      name: /서비스 이용약관/
    });
    const descriptionId = checkbox.getAttribute('aria-describedby');

    expect(descriptionId).toBe('description-terms-agreement-service-agreement');
    expect(document.getElementById(descriptionId ?? '')).toHaveTextContent(
      '서비스 이용 조건을 확인하는 Mock 설명입니다.'
    );
  });

  it('label 클릭 시 onToggle을 한 번 호출하지만 onConfirm은 호출하지 않는다', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const onConfirm = vi.fn();
    render(
      <TermsAgreementPanel
        {...createProps({ onToggle, onConfirm })}
      />
    );

    await user.click(screen.getByText('서비스 이용약관'));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('service-agreement', true);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('controlled rerender 전에는 자체 선택을 유지하지 않고 부모 값만 반영한다', async () => {
    const user = userEvent.setup();
    const props = createProps();
    const { rerender } = render(<TermsAgreementPanel {...props} />);
    const checkbox = screen.getByRole('checkbox', {
      name: /서비스 이용약관/
    });

    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();

    rerender(
      <TermsAgreementPanel
        {...props}
        selectedTermIds={new Set(['service-agreement'])}
      />
    );
    expect(checkbox).toBeChecked();
    expect(screen.getByText('선택됨')).toBeInTheDocument();
  });

  it('필수 약관 일부 선택에서는 확인 버튼을 비활성화한다', () => {
    render(
      <TermsAgreementPanel
        {...createProps({ selectedTermIds: new Set(['service-agreement']) })}
      />
    );

    expect(
      screen.getByTestId(TERMS_AGREEMENT_PANEL_SELECTORS.confirm)
    ).toBeDisabled();
    expect(
      screen.getByTestId(TERMS_AGREEMENT_PANEL_SELECTORS.status)
    ).toHaveTextContent('필수 약관 2개 중 1개를 선택했습니다.');
  });

  it('필수 약관을 모두 선택하면 선택 약관 없이도 확인 버튼을 활성화한다', () => {
    render(
      <TermsAgreementPanel
        {...createProps({
          selectedTermIds: new Set([
            'service-agreement',
            'personal-information'
          ])
        })}
      />
    );

    expect(
      screen.getByTestId(TERMS_AGREEMENT_PANEL_SELECTORS.confirm)
    ).toBeEnabled();
    expect(
      screen.getByTestId(TERMS_AGREEMENT_PANEL_SELECTORS.status)
    ).toHaveTextContent('필수 약관 2개를 모두 선택했습니다.');
  });

  it('모두 선택 약관인 READY 목록은 확인 버튼을 활성화한다', () => {
    render(
      <TermsAgreementPanel
        {...createProps({
          terms: [{ id: 'optional-news', label: '소식 수신', required: false }]
        })}
      />
    );

    expect(
      screen.getByTestId(TERMS_AGREEMENT_PANEL_SELECTORS.confirm)
    ).toBeEnabled();
    expect(
      screen.getByTestId(TERMS_AGREEMENT_PANEL_SELECTORS.status)
    ).toHaveTextContent('필수 약관이 없습니다.');
  });

  it('선택 약관 선택과 해제를 다음 controlled 값으로 전달한다', () => {
    const onToggle = vi.fn();
    const props = createProps({ onToggle });
    const { rerender } = render(<TermsAgreementPanel {...props} />);
    const optional = screen.getByRole('checkbox', {
      name: /마케팅 정보 수신/
    });

    fireEvent.click(optional);
    expect(onToggle).toHaveBeenLastCalledWith('marketing-information', true);

    rerender(
      <TermsAgreementPanel
        {...props}
        selectedTermIds={new Set(['marketing-information'])}
      />
    );
    fireEvent.click(optional);
    expect(onToggle).toHaveBeenLastCalledWith('marketing-information', false);
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it('확인 클릭 시 terms 순서의 ID 배열을 정확히 한 번 전달한다', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <TermsAgreementPanel
        {...createProps({
          selectedTermIds: new Set([
            'marketing-information',
            'personal-information',
            'service-agreement'
          ]),
          onConfirm
        })}
      />
    );

    await user.click(
      screen.getByTestId(TERMS_AGREEMENT_PANEL_SELECTORS.confirm)
    );

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith([
      'service-agreement',
      'personal-information',
      'marketing-information'
    ]);
  });

  it('disabled 선택 약관은 선택되지 않은 상태로 표시하고 payload에서 제외한다', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const onConfirm = vi.fn();
    render(
      <TermsAgreementPanel
        {...createProps({
          terms: [terms[0], terms[1], { ...terms[2], disabled: true }],
          selectedTermIds: new Set([
            'service-agreement',
            'personal-information',
            'marketing-information'
          ]),
          onToggle,
          onConfirm
        })}
      />
    );

    const optional = screen.getByRole('checkbox', {
      name: /마케팅 정보 수신/
    });
    expect(optional).toBeDisabled();
    expect(optional).not.toBeChecked();
    expect(screen.getByText('선택 불가')).toBeInTheDocument();

    await user.click(
      screen.getByTestId(TERMS_AGREEMENT_PANEL_SELECTORS.confirm)
    );
    expect(onToggle).not.toHaveBeenCalled();
    expect(onConfirm).toHaveBeenCalledWith([
      'service-agreement',
      'personal-information'
    ]);
  });

  it('disabled 필수 약관은 선택 Set에 있어도 Gate를 차단한다', () => {
    render(
      <TermsAgreementPanel
        {...createProps({
          terms: [{ ...terms[0], disabled: true }, terms[1], terms[2]],
          selectedTermIds: new Set([
            'service-agreement',
            'personal-information'
          ])
        })}
      />
    );

    expect(
      screen.getByRole('checkbox', { name: /서비스 이용약관/ })
    ).not.toBeChecked();
    expect(
      screen.getByTestId(TERMS_AGREEMENT_PANEL_SELECTORS.confirm)
    ).toBeDisabled();
    expect(
      screen.getByTestId(TERMS_AGREEMENT_PANEL_SELECTORS.status)
    ).toHaveTextContent('선택할 수 없는 필수 약관');
  });

  it.each([
    ['panel disabled', { disabled: true, isBusy: false }],
    ['busy', { disabled: false, isBusy: true }]
  ])('%s 상태에서는 checkbox와 확인 버튼을 실제로 비활성화한다', (_, state) => {
    render(<TermsAgreementPanel {...createProps(state)} />);

    expect(
      screen
        .getAllByRole('checkbox')
        .every((checkbox) => (checkbox as HTMLInputElement).disabled)
    ).toBe(true);
    expect(
      screen.getByTestId(TERMS_AGREEMENT_PANEL_SELECTORS.confirm)
    ).toBeDisabled();
    expect(
      screen.getByTestId(TERMS_AGREEMENT_PANEL_SELECTORS.panel)
    ).toHaveAttribute('aria-busy', String(Boolean(state.isBusy)));
  });

  it('unknown selected ID가 있으면 Gate를 차단하고 원본 ID를 표시하지 않는다', () => {
    render(
      <TermsAgreementPanel
        {...createProps({
          selectedTermIds: new Set([
            'service-agreement',
            'personal-information',
            'unknown-sensitive-value'
          ])
        })}
      />
    );

    expect(
      screen.getByTestId(TERMS_AGREEMENT_PANEL_SELECTORS.confirm)
    ).toBeDisabled();
    expect(screen.queryByText('unknown-sensitive-value')).not.toBeInTheDocument();
    expect(
      screen.getByTestId(TERMS_AGREEMENT_PANEL_SELECTORS.status)
    ).toHaveTextContent('현재 약관 목록과 선택 상태가 일치하지 않아');
  });

  it.each([
    ['EMPTY', []],
    [
      'INVALID',
      [{ id: 'INVALID_ID', label: '노출되면 안 되는 원본', required: true }]
    ]
  ] satisfies Array<[string, AgreementTerm[]]>)(
    '%s 목록에서는 checkbox 없이 일반 안내와 disabled 확인 버튼을 표시한다',
    (state, stateTerms) => {
      render(
        <TermsAgreementPanel
          {...createProps({ terms: stateTerms })}
        />
      );

      expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
      expect(
        screen.getByTestId(TERMS_AGREEMENT_PANEL_SELECTORS.confirm)
      ).toBeDisabled();
      expect(screen.getByTestId(TERMS_AGREEMENT_PANEL_SELECTORS.status)).toHaveTextContent(
        state === 'EMPTY'
          ? '선택 항목을 준비하고 있습니다.'
          : '약관 항목을 표시할 수 없습니다.'
      );
      expect(screen.queryByText('INVALID_ID')).not.toBeInTheDocument();
      expect(screen.queryByText('노출되면 안 되는 원본')).not.toBeInTheDocument();
    }
  );

  it('terms 제거·순서 변경·disabled 변경을 다음 렌더링에 그대로 반영한다', () => {
    const props = createProps({
      selectedTermIds: new Set(['service-agreement', 'personal-information'])
    });
    const { rerender } = render(<TermsAgreementPanel {...props} />);

    rerender(
      <TermsAgreementPanel
        {...props}
        terms={[{ ...terms[1], disabled: true }, terms[2]]}
      />
    );

    const group = screen.getByTestId(TERMS_AGREEMENT_PANEL_SELECTORS.options);
    expect(
      within(group).queryByTestId('term-user-agreement-service-agreement')
    ).not.toBeInTheDocument();
    expect(within(group).getAllByRole('checkbox').map((checkbox) => checkbox.id)).toEqual([
      'term-user-agreement-personal-information',
      'term-user-agreement-marketing-information'
    ]);
    expect(
      screen.getByTestId('term-user-agreement-personal-information')
    ).not.toBeChecked();
  });

  it('상태 안내는 polite live region이고 행과 버튼은 최소 56px 스타일을 사용한다', () => {
    render(<TermsAgreementPanel {...createProps()} />);

    const status = screen.getByTestId(TERMS_AGREEMENT_PANEL_SELECTORS.status);
    expect(status).toHaveAttribute('role', 'status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(
      screen.getByTestId(TERMS_AGREEMENT_PANEL_SELECTORS.confirm)
    ).toHaveClass('min-h-14');
    expect(
      screen
        .getByTestId('term-user-agreement-service-agreement')
        .closest('label')
    ).toHaveClass('min-h-14');
    expect(
      screen
        .getByTestId('term-user-agreement-service-agreement')
        .closest('label')
    ).toHaveClass('focus-within:ring-4');
  });

  it('title·message·label·description을 HTML이 아닌 React text로 렌더링한다', () => {
    render(
      <TermsAgreementPanel
        {...createProps({
          title: '<strong>약관 제목</strong>',
          message: '<em>약관 안내</em>',
          terms: [
            {
              id: 'safe-term',
              label: '<b>약관 이름</b>',
              description: '<script>약관 설명</script>',
              required: false
            }
          ]
        })}
      />
    );

    expect(screen.getByText('<strong>약관 제목</strong>')).toBeInTheDocument();
    expect(screen.getByText('<em>약관 안내</em>')).toBeInTheDocument();
    expect(screen.getByText('<b>약관 이름</b>')).toBeInTheDocument();
    expect(screen.getByText('<script>약관 설명</script>')).toBeInTheDocument();
    expect(document.querySelector('strong, em, b, script')).not.toBeInTheDocument();
  });

  it('mount 시 callback을 호출하지 않고 API·WebSocket·storage·timer·URL을 사용하지 않는다', () => {
    const fetchMock = vi.fn();
    const webSocketMock = vi.fn();
    const storageGetSpy = vi.spyOn(Storage.prototype, 'getItem');
    const storageSetSpy = vi.spyOn(Storage.prototype, 'setItem');
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const intervalSpy = vi.spyOn(globalThis, 'setInterval');
    const onToggle = vi.fn();
    const onConfirm = vi.fn();
    const initialUrl = window.location.href;

    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('WebSocket', webSocketMock);

    render(
      <TermsAgreementPanel
        {...createProps({ onToggle, onConfirm })}
      />
    );

    expect(onToggle).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(webSocketMock).not.toHaveBeenCalled();
    expect(storageGetSpy).not.toHaveBeenCalled();
    expect(storageSetSpy).not.toHaveBeenCalled();
    expect(timeoutSpy).not.toHaveBeenCalled();
    expect(intervalSpy).not.toHaveBeenCalled();
    expect(window.location.href).toBe(initialUrl);
  });
});
