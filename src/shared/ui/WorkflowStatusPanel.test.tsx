import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  WorkflowStatusPanel,
  WORKFLOW_STATUS_PANEL_SELECTORS
} from './WorkflowStatusPanel';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function expectIdentity(element: HTMLElement, selector: string) {
  expect(element).toHaveAttribute('id', selector);
  expect(element).toHaveAttribute('data-testid', selector);
}

describe('WorkflowStatusPanel', () => {
  it('root와 heading·message 고정 selector 및 기본 문구를 표시한다', () => {
    render(<WorkflowStatusPanel status="SESSION_CREATED" />);

    const panel = screen.getByTestId(WORKFLOW_STATUS_PANEL_SELECTORS.panel);
    const heading = screen.getByTestId(WORKFLOW_STATUS_PANEL_SELECTORS.heading);
    const message = screen.getByTestId(WORKFLOW_STATUS_PANEL_SELECTORS.message);

    expectIdentity(panel, WORKFLOW_STATUS_PANEL_SELECTORS.panel);
    expectIdentity(heading, WORKFLOW_STATUS_PANEL_SELECTORS.heading);
    expectIdentity(message, WORKFLOW_STATUS_PANEL_SELECTORS.message);
    expect(heading).toHaveTextContent('세션 준비 완료');
    expect(message).toHaveTextContent('금융 업무 안내를 시작할 준비가 되었습니다.');
    expect(panel).toHaveAttribute('aria-labelledby', heading.id);
    expect(panel).toHaveAttribute('aria-describedby', message.id);
  });

  it('앞뒤 공백을 제거한 custom message를 React text로 안전하게 표시한다', () => {
    render(
      <WorkflowStatusPanel
        status="SESSION_CREATED"
        message="  <strong>안전한 사용자 안내</strong>  "
      />
    );

    expect(
      screen.getByTestId(WORKFLOW_STATUS_PANEL_SELECTORS.message)
    ).toHaveTextContent('<strong>안전한 사용자 안내</strong>');
    expect(document.querySelector('strong')).not.toBeInTheDocument();
  });

  it('공백 message는 상태의 안전한 기본 설명으로 대체한다', () => {
    render(<WorkflowStatusPanel status="PAGE_LOADING" message="   " />);

    expect(
      screen.getByTestId(WORKFLOW_STATUS_PANEL_SELECTORS.message)
    ).toHaveTextContent('페이지가 준비될 때까지 현재 화면에서 기다려 주세요.');
  });

  it('PAGE_LOADING을 polite status와 busy indicator로 표시한다', () => {
    render(<WorkflowStatusPanel status="PAGE_LOADING" />);

    const panel = screen.getByRole('status');
    const indicator = screen.getByTestId(
      WORKFLOW_STATUS_PANEL_SELECTORS.indicator
    );

    expect(panel).toHaveAttribute('aria-live', 'polite');
    expect(panel).toHaveAttribute('aria-busy', 'true');
    expectIdentity(indicator, WORKFLOW_STATUS_PANEL_SELECTORS.indicator);
    expect(indicator).toHaveAttribute('aria-hidden', 'true');
    expect(indicator).toHaveClass('motion-safe:animate-spin');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('AI_EXECUTING도 busy와 indeterminate indicator를 표시한다', () => {
    render(<WorkflowStatusPanel status="AI_EXECUTING" />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(
      screen.getByTestId(WORKFLOW_STATUS_PANEL_SELECTORS.indicator)
    ).toBeInTheDocument();
    expect(screen.getByText('AI 안내 작업 진행 중')).toBeInTheDocument();
  });

  it('ERROR는 assertive alert와 안전한 기본 문구를 표시한다', () => {
    render(<WorkflowStatusPanel status="ERROR" />);

    const alert = screen.getByRole('alert');

    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByText('업무 처리 오류')).toBeInTheDocument();
    expect(
      screen.getByText(
        '요청을 처리하지 못했습니다. 현재 화면의 안내를 확인해 주세요.'
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId(WORKFLOW_STATUS_PANEL_SELECTORS.indicator)
    ).not.toBeInTheDocument();
  });

  it('완료와 취소는 indicator나 오류 alert 없이 구분해 표시한다', () => {
    const { rerender } = render(<WorkflowStatusPanel status="COMPLETED" />);

    expect(screen.getByText('업무 안내 완료')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(WORKFLOW_STATUS_PANEL_SELECTORS.indicator)
    ).not.toBeInTheDocument();

    rerender(<WorkflowStatusPanel status="CANCELLED" />);

    expect(screen.getByText('업무 취소')).toBeInTheDocument();
    expect(screen.getByText('상태 안내')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('status prop rerender 시 최신 표현만 남긴다', () => {
    const { rerender } = render(<WorkflowStatusPanel status="PAGE_LOADING" />);

    expect(
      screen.getByTestId(WORKFLOW_STATUS_PANEL_SELECTORS.indicator)
    ).toBeInTheDocument();

    rerender(<WorkflowStatusPanel status="ERROR" />);

    expect(screen.queryByText('금융 페이지를 불러오는 중')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(WORKFLOW_STATUS_PANEL_SELECTORS.indicator)
    ).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('추가 className을 root에 적용하고 action UI를 만들지 않는다', () => {
    render(
      <WorkflowStatusPanel status="SESSION_CREATED" className="max-w-xl" />
    );

    expect(
      screen.getByTestId(WORKFLOW_STATUS_PANEL_SELECTORS.panel)
    ).toHaveClass('max-w-xl');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('렌더링만으로 API·WebSocket·timer를 호출하지 않는다', () => {
    const fetchMock = vi.fn();
    const webSocketMock = vi.fn();
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const intervalSpy = vi.spyOn(globalThis, 'setInterval');

    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('WebSocket', webSocketMock);

    render(<WorkflowStatusPanel status="AI_EXECUTING" />);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(webSocketMock).not.toHaveBeenCalled();
    expect(timeoutSpy).not.toHaveBeenCalled();
    expect(intervalSpy).not.toHaveBeenCalled();
  });
});
