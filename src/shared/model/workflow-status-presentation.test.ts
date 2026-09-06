import { describe, expect, it } from 'vitest';

import type { WorkflowStatus } from '@/types/frontend-state';
import {
  getWorkflowStatusPresentation,
  isWorkflowErrorStatus,
  isWorkflowExecutingStatus,
  isWorkflowLoadingStatus
} from './workflow-status-presentation';

const WORKFLOW_STATUSES = [
  'SESSION_CREATED',
  'PAGE_LOADING',
  'AI_EXECUTING',
  'USER_DECISION_REQUIRED',
  'SECURE_INPUT_REQUIRED',
  'FINAL_CONFIRMATION_REQUIRED',
  'ADDITIONAL_INFORMATION_REQUIRED',
  'RISK_WARNING',
  'COMPLETED',
  'CANCELLED',
  'ERROR',
  'TERMINATED'
] as const satisfies readonly WorkflowStatus[];

describe('workflow status presentation', () => {
  it('12개 WorkflowStatus를 빠짐없이 안전한 표현으로 변환한다', () => {
    expect(WORKFLOW_STATUSES).toHaveLength(12);

    for (const status of WORKFLOW_STATUSES) {
      const presentation = getWorkflowStatusPresentation(status);

      expect(presentation.title.trim()).not.toBe('');
      expect(presentation.description.trim()).not.toBe('');
    }
  });

  it('PAGE_LOADING만 loading으로 분류한다', () => {
    expect(isWorkflowLoadingStatus('PAGE_LOADING')).toBe(true);
    expect(isWorkflowLoadingStatus('SESSION_CREATED')).toBe(false);
    expect(isWorkflowLoadingStatus('AI_EXECUTING')).toBe(false);
  });

  it('AI_EXECUTING만 executing으로 분류한다', () => {
    expect(isWorkflowExecutingStatus('AI_EXECUTING')).toBe(true);
    expect(isWorkflowExecutingStatus('PAGE_LOADING')).toBe(false);
  });

  it('ERROR만 error로 분류한다', () => {
    expect(isWorkflowErrorStatus('ERROR')).toBe(true);
    expect(isWorkflowErrorStatus('RISK_WARNING')).toBe(false);
    expect(isWorkflowErrorStatus('CANCELLED')).toBe(false);
  });

  it('busy와 indicator를 로딩 및 AI 실행 상태에만 적용한다', () => {
    for (const status of WORKFLOW_STATUSES) {
      const presentation = getWorkflowStatusPresentation(status);
      const expectedBusy = status === 'PAGE_LOADING' || status === 'AI_EXECUTING';

      expect(presentation.isBusy).toBe(expectedBusy);
      expect(presentation.showIndicator).toBe(expectedBusy);
    }
  });

  it('완료·취소·오류·종료의 terminal과 tone을 구분한다', () => {
    expect(getWorkflowStatusPresentation('COMPLETED')).toMatchObject({
      tone: 'success',
      isTerminal: true,
      isError: false
    });
    expect(getWorkflowStatusPresentation('CANCELLED')).toMatchObject({
      isTerminal: true,
      isError: false
    });
    expect(getWorkflowStatusPresentation('ERROR')).toMatchObject({
      tone: 'danger',
      isTerminal: true,
      isError: true
    });
    expect(getWorkflowStatusPresentation('TERMINATED')).toMatchObject({
      isTerminal: true,
      isError: false
    });
  });

  it('알 수 없는 runtime 값과 null·undefined를 안전한 fallback으로 처리한다', () => {
    for (const status of ['UNKNOWN_RUNTIME_STATUS', null, undefined]) {
      const presentation = getWorkflowStatusPresentation(status);

      expect(presentation).toMatchObject({
        title: '상태를 확인하고 있음',
        tone: 'neutral',
        isBusy: false,
        isError: false,
        isTerminal: false,
        showIndicator: false
      });
      expect(`${presentation.title} ${presentation.description}`).not.toContain(
        'UNKNOWN_RUNTIME_STATUS'
      );
    }
  });

  it('동일 입력은 같은 내용을 반환하고 외부 변경은 다음 호출에 영향을 주지 않는다', () => {
    const first = getWorkflowStatusPresentation('AI_EXECUTING');
    const original = { ...first };

    first.title = '외부에서 변경한 제목';

    expect(getWorkflowStatusPresentation('AI_EXECUTING')).toEqual(original);
  });

  it('분류 helper와 presentation 값이 일치한다', () => {
    for (const status of WORKFLOW_STATUSES) {
      const presentation = getWorkflowStatusPresentation(status);

      expect(presentation.isBusy).toBe(
        isWorkflowLoadingStatus(status) || isWorkflowExecutingStatus(status)
      );
      expect(presentation.isError).toBe(isWorkflowErrorStatus(status));
    }
  });
});
