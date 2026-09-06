import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  TERMS_AGREEMENT_PANEL_SELECTORS
} from './TermsAgreementPanel';
import {
  TermsAgreementPanelPreview,
  TERMS_AGREEMENT_PANEL_PREVIEW_SELECTORS
} from './TermsAgreementPanelPreview';
import { WORKFLOW_STATUS_PANEL_SELECTORS } from './WorkflowStatusPanel';

function expectIdentity(element: HTMLElement, selector: string) {
  expect(element).toHaveAttribute('id', selector);
  expect(element).toHaveAttribute('data-testid', selector);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('TermsAgreementPanelPreview', () => {
  it('Preview와 상태 select의 고정 selector를 렌더링한다', () => {
    render(<TermsAgreementPanelPreview />);

    expectIdentity(
      screen.getByTestId(TERMS_AGREEMENT_PANEL_PREVIEW_SELECTORS.preview),
      TERMS_AGREEMENT_PANEL_PREVIEW_SELECTORS.preview
    );
    expectIdentity(
      screen.getByRole('combobox', { name: '확인할 약관 패널 상태' }),
      TERMS_AGREEMENT_PANEL_PREVIEW_SELECTORS.select
    );
    expectIdentity(
      screen.getByTestId(TERMS_AGREEMENT_PANEL_PREVIEW_SELECTORS.status),
      TERMS_AGREEMENT_PANEL_PREVIEW_SELECTORS.status
    );
  });

  it('DEFAULT mount는 모든 checkbox가 미선택이고 callback 결과가 없다', () => {
    render(<TermsAgreementPanelPreview />);

    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(
      screen
        .getAllByRole('checkbox')
        .every((checkbox) => !(checkbox as HTMLInputElement).checked)
    ).toBe(true);
    expect(
      screen.getByTestId(TERMS_AGREEMENT_PANEL_SELECTORS.confirm)
    ).toBeDisabled();
    expect(
      screen.getByTestId(TERMS_AGREEMENT_PANEL_PREVIEW_SELECTORS.status)
    ).toHaveTextContent('요청이 없습니다. 실제 서버로 전송되지 않았습니다.');
  });

  it('WorkflowStatusPanel과 TermsAgreementPanel을 형제 요소로 조합한다', () => {
    render(<TermsAgreementPanelPreview />);

    const workflowPanel = screen.getByTestId(
      WORKFLOW_STATUS_PANEL_SELECTORS.panel
    );
    const agreementPanel = screen.getByTestId(
      TERMS_AGREEMENT_PANEL_SELECTORS.panel
    );

    expect(workflowPanel.parentElement).toBe(agreementPanel.parentElement);
    expect(screen.getByText('사용자 선택 필요')).toBeInTheDocument();
    expect(
      screen.getByText('사용자가 약관을 직접 확인하고 선택해야 합니다.')
    ).toBeInTheDocument();
  });

  it.each([
    ['ONE_REQUIRED_SELECTED', 1, false],
    ['ALL_REQUIRED_SELECTED', 2, true],
    ['OPTIONAL_SELECTED', 3, true]
  ])(
    '%s 상태에서 선택 수와 Gate를 명시적으로 재현한다',
    async (value, checkedCount, confirmEnabled) => {
      const user = userEvent.setup();
      render(<TermsAgreementPanelPreview />);

      await user.selectOptions(
        screen.getByRole('combobox', { name: '확인할 약관 패널 상태' }),
        value
      );

      expect(
        screen
          .getAllByRole('checkbox')
          .filter((checkbox) => (checkbox as HTMLInputElement).checked)
      ).toHaveLength(checkedCount);
      const confirm = screen.getByTestId(
        TERMS_AGREEMENT_PANEL_SELECTORS.confirm
      );
      if (confirmEnabled) {
        expect(confirm).toBeEnabled();
      } else {
        expect(confirm).toBeDisabled();
      }
    }
  );

  it.each([
    ['EMPTY', '선택 항목을 준비하고 있습니다.'],
    ['INVALID', '약관 항목을 표시할 수 없습니다.']
  ])('%s 상태에서 checkbox 없이 안전한 안내를 표시한다', async (value, text) => {
    const user = userEvent.setup();
    render(<TermsAgreementPanelPreview />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: '확인할 약관 패널 상태' }),
      value
    );

    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(
      screen.getByTestId(TERMS_AGREEMENT_PANEL_SELECTORS.status)
    ).toHaveTextContent(text);
    expect(screen.queryByText('노출 금지 원본')).not.toBeInTheDocument();
  });

  it('DISABLED_OPTIONAL 상태에서 선택 약관만 미선택·disabled로 표시한다', async () => {
    const user = userEvent.setup();
    render(<TermsAgreementPanelPreview />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: '확인할 약관 패널 상태' }),
      'DISABLED_OPTIONAL'
    );

    const optional = screen.getByRole('checkbox', {
      name: /마케팅 정보 수신/
    });
    expect(optional).toBeDisabled();
    expect(optional).not.toBeChecked();
    expect(
      screen.getByTestId(TERMS_AGREEMENT_PANEL_SELECTORS.confirm)
    ).toBeEnabled();
  });

  it('DISABLED_REQUIRED 상태에서 필수 Gate를 차단한다', async () => {
    const user = userEvent.setup();
    render(<TermsAgreementPanelPreview />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: '확인할 약관 패널 상태' }),
      'DISABLED_REQUIRED'
    );

    expect(
      screen.getByRole('checkbox', { name: /서비스 이용약관/ })
    ).toBeDisabled();
    expect(
      screen.getByTestId(TERMS_AGREEMENT_PANEL_SELECTORS.confirm)
    ).toBeDisabled();
    expect(
      screen.getByTestId(TERMS_AGREEMENT_PANEL_SELECTORS.status)
    ).toHaveTextContent('선택할 수 없는 필수 약관');
  });

  it.each(['BUSY', 'PANEL_DISABLED'])(
    '%s 상태에서 모든 입력과 확인 버튼을 비활성화한다',
    async (value) => {
      const user = userEvent.setup();
      render(<TermsAgreementPanelPreview />);

      await user.selectOptions(
        screen.getByRole('combobox', { name: '확인할 약관 패널 상태' }),
        value
      );

      expect(
        screen
          .getAllByRole('checkbox')
          .every((checkbox) => (checkbox as HTMLInputElement).disabled)
      ).toBe(true);
      expect(
        screen.getByTestId(TERMS_AGREEMENT_PANEL_SELECTORS.confirm)
      ).toBeDisabled();
    }
  );

  it('toggle 요청을 ID와 다음 상태로 안내한다', async () => {
    const user = userEvent.setup();
    render(<TermsAgreementPanelPreview />);

    await user.click(
      screen.getByRole('checkbox', { name: /서비스 이용약관/ })
    );

    expect(
      screen.getByTestId(TERMS_AGREEMENT_PANEL_PREVIEW_SELECTORS.status)
    ).toHaveTextContent('선택 요청: service-agreement 선택');
  });

  it('confirm 요청은 정렬된 ID만 안내하고 서버 제출 완료를 주장하지 않는다', async () => {
    const user = userEvent.setup();
    render(<TermsAgreementPanelPreview />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: '확인할 약관 패널 상태' }),
      'OPTIONAL_SELECTED'
    );
    await user.click(
      screen.getByTestId(TERMS_AGREEMENT_PANEL_SELECTORS.confirm)
    );

    const status = screen.getByTestId(
      TERMS_AGREEMENT_PANEL_PREVIEW_SELECTORS.status
    );
    expect(status).toHaveTextContent(
      '확인 요청: service-agreement, personal-information, marketing-information'
    );
    expect(status).toHaveTextContent('실제 서버로 전송되지 않았습니다.');
    expect(screen.queryByText(/제출 완료|가입 완료/)).not.toBeInTheDocument();
  });

  it('mount에서 API·WebSocket·storage·timer를 사용하지 않는다', () => {
    const fetchMock = vi.fn();
    const webSocketMock = vi.fn();
    const storageGetSpy = vi.spyOn(Storage.prototype, 'getItem');
    const storageSetSpy = vi.spyOn(Storage.prototype, 'setItem');
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const intervalSpy = vi.spyOn(globalThis, 'setInterval');

    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('WebSocket', webSocketMock);

    render(<TermsAgreementPanelPreview />);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(webSocketMock).not.toHaveBeenCalled();
    expect(storageGetSpy).not.toHaveBeenCalled();
    expect(storageSetSpy).not.toHaveBeenCalled();
    expect(timeoutSpy).not.toHaveBeenCalled();
    expect(intervalSpy).not.toHaveBeenCalled();
  });
});
