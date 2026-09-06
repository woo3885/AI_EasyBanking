import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import HomePage from '../../src/pages/HomePage';
import {
  SAFE_MESSAGE_SUBMIT_ERROR,
  type ConversationMessage
} from '../../src/features/AgentChat/model/conversation-types';
import AgentChatPanel from '../../src/features/AgentChat/ui/AgentChatPanel';
import AgentChatShell from '../../src/features/AgentChat/ui/AgentChatShell';

const messages: ConversationMessage[] = [
  {
    messageId: 'user-1',
    role: 'USER',
    kind: 'MESSAGE',
    sequence: 1,
    text: '예금 상품을 알아보고 싶어요.',
    questionId: null,
    goalRevision: 1,
    occurredAt: '2026-09-01T00:00:00.000Z'
  },
  {
    messageId: 'ai-2',
    role: 'AI',
    kind: 'QUESTION',
    sequence: 2,
    text: '가입 금액은 얼마로 할까요?',
    questionId: 'question-1',
    goalRevision: 2,
    occurredAt: '2026-09-01T00:00:01.000Z'
  }
];

function ControlledPanel({
  onSubmit = vi.fn()
}: {
  onSubmit?: (message: string) => void;
}) {
  const [value, setValue] = useState('');

  return (
    <AgentChatPanel
      value={value}
      messages={[]}
      submitPhase="IDLE"
      safeError={null}
      onDraftChange={setValue}
      onSubmit={onSubmit}
      onDismissError={vi.fn()}
    />
  );
}

describe('AgentChatPanel', () => {
  it('대화를 log live region에 표시하고 사용자와 AI를 텍스트로 구분한다', () => {
    render(
      <AgentChatPanel
        value=""
        messages={messages}
        submitPhase="IDLE"
        safeError={null}
        onDraftChange={vi.fn()}
        onSubmit={vi.fn()}
        onDismissError={vi.fn()}
      />
    );

    const log = screen.getByRole('log', { name: 'AI 도우미 대화' });
    expect(log).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('사용자')).toBeInTheDocument();
    expect(screen.getByText('AI 안내')).toBeInTheDocument();
    expect(screen.getByText('질문')).toBeInTheDocument();
  });

  it('전송 대기는 status로, 안전한 실패는 alert로 표시한다', () => {
    render(
      <AgentChatPanel
        value="예금 상품 알아보기"
        messages={[]}
        submitPhase="WAITING_FOR_ACK"
        safeError={SAFE_MESSAGE_SUBMIT_ERROR}
        onDraftChange={vi.fn()}
        onSubmit={vi.fn()}
        onDismissError={vi.fn()}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'Backend 요청 접수를 기다리고 있습니다.'
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      '요청을 전송하지 못했습니다.'
    );
  });

  it('입력 label·허용 조건을 연결하고 빈 요청은 실제 disabled 처리한다', () => {
    render(<ControlledPanel />);

    const textarea = screen.getByRole('textbox', { name: '업무 요청' });
    const submitButton = screen.getByRole('button', { name: '요청 전송' });

    expect(textarea).not.toHaveAttribute('aria-describedby');
    expect(submitButton).toBeDisabled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('빠른 요청은 draft만 바꾸고 자동 전송하지 않는다', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ControlledPanel onSubmit={onSubmit} />);

    await user.click(
      screen.getByRole('button', { name: '100만 원으로 예금 가입하기' })
    );

    expect(screen.getByRole('textbox', { name: '업무 요청' })).toHaveValue(
      '100만 원으로 예금 가입하기'
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('민감정보 의심 문장을 고정 안내로 차단하고 원문을 오류에 노출하지 않는다', async () => {
    const user = userEvent.setup();
    render(<ControlledPanel />);

    await user.type(
      screen.getByRole('textbox', { name: '업무 요청' }),
      '비밀번호는 4321이야'
    );

    expect(screen.getByRole('button', { name: '요청 전송' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      '비밀번호나 인증번호는 채팅에 입력할 수 없습니다.'
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent('4321');
    expect(screen.getByRole('textbox', { name: '업무 요청' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: '업무 요청' })).toHaveAttribute(
      'readonly'
    );
    await user.click(screen.getByRole('button', { name: '안내 닫기' }));
    await user.type(screen.getByRole('textbox', { name: '업무 요청' }), '예금 기간을 알려줘');
    expect(screen.getByRole('textbox', { name: '업무 요청' })).toHaveValue('예금 기간을 알려줘');
  });

  it('AI 메시지의 HTML 문자열을 DOM으로 해석하지 않는다', () => {
    const htmlMessage: ConversationMessage = {
      ...messages[0],
      messageId: 'unsafe-looking-message',
      role: 'AI',
      text: '<img src=x onerror=alert(1)>'
    };
    render(
      <AgentChatPanel
        value=""
        messages={[htmlMessage]}
        submitPhase="IDLE"
        safeError={null}
        onDraftChange={vi.fn()}
        onSubmit={vi.fn()}
        onDismissError={vi.fn()}
      />
    );

    expect(
      screen.getByText('<img src=x onerror=alert(1)>')
    ).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('패널 마운트만으로 전송 callback을 호출하지 않는다', () => {
    const onSubmitRequest = vi.fn();
    render(<AgentChatShell onSubmitRequest={onSubmitRequest} />);

    expect(onSubmitRequest).not.toHaveBeenCalled();
    expect(
      document.querySelector('[data-ddd-agent-ui="true"]')
    ).toBeInTheDocument();
  });

  it('패널을 접고 다시 열어도 안전한 draft를 유지한다', async () => {
    const user = userEvent.setup();
    render(<AgentChatShell />);

    await user.type(
      screen.getByRole('textbox', { name: '업무 요청' }),
      '예금 상품 알아보기'
    );
    await user.click(screen.getByRole('button', { name: 'AI 채팅 접기' }));
    await user.click(screen.getByRole('button', { name: 'AI 채팅 열기' }));

    expect(screen.getByRole('textbox', { name: '업무 요청' })).toHaveValue(
      '예금 상품 알아보기'
    );
  });

  it('사용자 직접 제출을 한 번만 전달하고 ACK 전 중복 제출을 막는다', async () => {
    const user = userEvent.setup();
    const onSubmitRequest = vi.fn();
    render(<AgentChatShell onSubmitRequest={onSubmitRequest} />);

    await user.type(
      screen.getByRole('textbox', { name: '업무 요청' }),
      '100만 원으로 예금 가입하기'
    );
    const submitButton = screen.getByRole('button', { name: '요청 전송' });
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);

    await waitFor(() => expect(onSubmitRequest).toHaveBeenCalledTimes(1));
    expect(onSubmitRequest.mock.calls[0][0].message).toMatchObject({
      role: 'USER',
      kind: 'MESSAGE',
      sequence: null,
      text: '100만 원으로 예금 가입하기'
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Backend 요청 접수를 기다리고 있습니다.'
    );
    expect(screen.getByRole('button', { name: '요청 전송' })).toBeDisabled();
  });

  it('입력 완료 상태를 전송 버튼의 안내 문구와 직접 연결한다', () => {
    render(<AgentChatPanel value="예금 상품을 알아봐 줘" messages={[]} submitPhase="IDLE" safeError={null}
      onDraftChange={vi.fn()} onSubmit={vi.fn()} onDismissError={vi.fn()} />);
    expect(screen.getByRole('button', { name: '요청 전송' }))
      .toHaveAttribute('aria-describedby', 'status-agent-message-validation');
    expect(screen.getByText('안전한 요청을 전송할 수 있습니다.'))
      .toBeInTheDocument();
  });

  it('실제 Demo Bank 페이지와 채팅 shell을 동일 레이아웃에 렌더링한다', () => {
    render(<HomePage />);

    expect(screen.getByTestId('page-home')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '예금 가입 시작' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'AI 금융 도우미' })
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-ddd-agent-ui="true"]')
    ).toBeInTheDocument();
  });
});
