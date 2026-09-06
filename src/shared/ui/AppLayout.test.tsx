import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AppLayout from './AppLayout';

describe('AppLayout', () => {
  it('공통 상태와 콘텐츠, 안내 및 Action 영역을 표시한다', () => {
    render(
      <AppLayout
        workflowStatus="SESSION_CREATED"
        screenType="SESSION_READY"
        message="서비스를 시작할 준비가 되었습니다."
        isConnected
        title="테스트 금융길잡이"
        showDeveloperStatus
        fixedAspectRatio
        actions={<button type="button">시작</button>}
      >
        <p>공통 레이아웃 콘텐츠</p>
      </AppLayout>
    );

    expect(screen.getByText('테스트 금융길잡이')).toBeInTheDocument();
    expect(screen.getByText('공통 레이아웃 콘텐츠')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      '서비스를 시작할 준비가 되었습니다.'
    );
    expect(screen.getByText('WebSocket 연결됨')).toHaveClass(
      'bg-emerald-50'
    );
    expect(screen.getByText('WorkflowStatus: SESSION_CREATED')).toBeInTheDocument();
    expect(screen.getByText('ScreenType: SESSION_READY')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '시작' })).toBeInTheDocument();
    expect(screen.getByLabelText('SESSION_READY Mock 화면')).toHaveClass(
      'aspect-video'
    );
  });

  it('운영 기본 화면에서 내부 상태 코드를 숨기고 큰 h1을 사용한다', () => {
    render(
      <AppLayout
        workflowStatus="SESSION_CREATED"
        screenType="INITIAL_SCREEN"
        message="사이트와 업무를 선택해 주세요."
        isConnected={false}
        title="금융길잡이 AI"
      >
        <p>메인 내용</p>
      </AppLayout>
    );

    const heading = screen.getByRole('heading', {
      level: 1,
      name: '금융길잡이 AI'
    });
    expect(heading).toHaveClass('text-3xl');
    expect(screen.queryByText(/WorkflowStatus:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ScreenType:/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('금융길잡이 AI 화면')).toHaveClass(
      'min-h-[45rem]'
    );
  });

  it('위험 상태의 안내와 연결 끊김을 텍스트와 의미 있는 역할로 표시한다', () => {
    render(
      <AppLayout
        workflowStatus="RISK_WARNING"
        screenType="VOICE_PHISHING_WARNING"
        message="위험 표현이 감지되어 작업을 중단했습니다."
        isConnected={false}
        tone="danger"
      >
        <p>위험 안내 화면</p>
      </AppLayout>
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      '위험 표현이 감지되어 작업을 중단했습니다.'
    );
    expect(screen.getByText('WebSocket 연결 안 됨')).toHaveClass('bg-red-50');
  });
});
