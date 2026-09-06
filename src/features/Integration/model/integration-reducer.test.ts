import { describe, expect, it } from 'vitest';

import {
  ACCOUNT_DECISION_OPTIONS,
  ACCOUNT_SELECTION_FRAME,
  ACCOUNT_SELECTION_TARGET,
  MOCK_AGREEMENT_TERMS,
  RECIPIENT_SELECTION_FRAME,
  RECIPIENT_SELECTION_TARGET
} from '@/features/Integration/mocks/integration-scenarios';
import {
  createInitialIntegrationState,
  type IntegrationState
} from '@/features/Integration/model/integration-state';
import {
  integrationReducer,
  type IntegrationReducerAction
} from './integration-reducer';

const RUN_ID = 1;

function startedState(): IntegrationState {
  return integrationReducer(createInitialIntegrationState(), {
    type: 'MOCK_SESSION_STARTED',
    runId: RUN_ID,
    scenarioId: 'TRANSFER_ACCOUNT_SELECTION',
    mockSessionId: 'mock-integration-d16-001'
  });
}

function accountRequestState(): IntegrationState {
  return integrationReducer(startedState(), {
    type: 'MOCK_SINGLE_DECISION_REQUEST_RECEIVED',
    runId: RUN_ID,
    request: {
      kind: 'ACCOUNT',
      title: 'Mock 계좌 선택',
      message: '직접 선택해 주세요.',
      options: ACCOUNT_DECISION_OPTIONS
    }
  });
}

function termsRequestState(): IntegrationState {
  const state = integrationReducer(createInitialIntegrationState(), {
    type: 'MOCK_SESSION_STARTED',
    runId: RUN_ID,
    scenarioId: 'DEPOSIT_TERMS_AGREEMENT',
    mockSessionId: 'mock-integration-d16-001'
  });

  return integrationReducer(state, {
    type: 'MOCK_TERMS_REQUEST_RECEIVED',
    runId: RUN_ID,
    request: {
      title: 'Mock 약관',
      message: '각각 선택해 주세요.',
      terms: MOCK_AGREEMENT_TERMS
    }
  });
}

describe('integrationReducer', () => {
  it('초기 상태는 연결·scenario·frame·선택 없이 시작한다', () => {
    const state = createInitialIntegrationState();

    expect(state).toMatchObject({
      connectionState: 'DISCONNECTED',
      scenarioId: null,
      runId: 0,
      mockSessionId: null,
      phase: 'IDLE',
      workflowStatus: 'SESSION_CREATED',
      frame: undefined,
      target: null,
      decisionRequest: null,
      termsRequest: null,
      selectedOptionId: null,
      safeErrorMessage: null
    });
    expect(state.selectedTermIds).toEqual(new Set());
  });

  it('Mock session 시작 시 run과 scenario를 기록한다', () => {
    expect(startedState()).toMatchObject({
      connectionState: 'MOCK_CONNECTED',
      scenarioId: 'TRANSFER_ACCOUNT_SELECTION',
      runId: RUN_ID,
      mockSessionId: 'mock-integration-d16-001',
      phase: 'ACCOUNT_SELECTION'
    });
  });

  it('Mock workflow 상태와 안전한 안내를 수신한다', () => {
    const next = integrationReducer(startedState(), {
      type: 'MOCK_WORKFLOW_STATUS_RECEIVED',
      runId: RUN_ID,
      workflowStatus: 'USER_DECISION_REQUIRED',
      guideMessage: 'Mock 선택을 확인해 주세요.'
    });

    expect(next.workflowStatus).toBe('USER_DECISION_REQUIRED');
    expect(next.guideMessage).toBe('Mock 선택을 확인해 주세요.');
  });

  it('frame과 target을 각각 수신한다', () => {
    const withFrame = integrationReducer(startedState(), {
      type: 'MOCK_FRAME_RECEIVED',
      runId: RUN_ID,
      frame: ACCOUNT_SELECTION_FRAME
    });
    const withTarget = integrationReducer(withFrame, {
      type: 'MOCK_TARGET_RECEIVED',
      runId: RUN_ID,
      target: ACCOUNT_SELECTION_TARGET,
      message: 'Mock target'
    });

    expect(withFrame.frame).toBe(ACCOUNT_SELECTION_FRAME);
    expect(withTarget.target).toEqual(ACCOUNT_SELECTION_TARGET);
    expect(withTarget.targetMessage).toBe('Mock target');
  });

  it('새 frame을 수신하면 이전 target을 제거한다', () => {
    const withTarget = integrationReducer(startedState(), {
      type: 'MOCK_TARGET_RECEIVED',
      runId: RUN_ID,
      target: ACCOUNT_SELECTION_TARGET,
      message: 'old target'
    });
    const next = integrationReducer(withTarget, {
      type: 'MOCK_FRAME_RECEIVED',
      runId: RUN_ID,
      frame: RECIPIENT_SELECTION_FRAME
    });

    expect(next.target).toBeNull();
    expect(next.targetMessage).toBe('');
  });

  it('단일 선택 request를 복사하고 초기 option을 미선택으로 둔다', () => {
    const state = accountRequestState();

    expect(state.decisionRequest?.options).toEqual(ACCOUNT_DECISION_OPTIONS);
    expect(state.decisionRequest?.options).not.toBe(ACCOUNT_DECISION_OPTIONS);
    expect(state.selectedOptionId).toBeNull();
  });

  it('유효하고 활성화된 option만 선택한다', () => {
    const state = accountRequestState();
    const selected = integrationReducer(state, {
      type: 'MOCK_OPTION_SELECTED',
      runId: RUN_ID,
      optionId: 'living-expense'
    });

    expect(selected.selectedOptionId).toBe('living-expense');
    expect(selected.lastActionMessage).toBe(state.lastActionMessage);
    expect(state.selectedOptionId).toBeNull();
  });

  it('unknown option을 거부한다', () => {
    const state = accountRequestState();
    const next = integrationReducer(state, {
      type: 'MOCK_OPTION_SELECTED',
      runId: RUN_ID,
      optionId: 'unknown-option'
    });

    expect(next).toBe(state);
  });

  it('disabled option을 거부한다', () => {
    const state = integrationReducer(startedState(), {
      type: 'MOCK_SINGLE_DECISION_REQUEST_RECEIVED',
      runId: RUN_ID,
      request: {
        kind: 'ACCOUNT',
        title: 'Mock 계좌',
        message: '선택',
        options: [{ id: 'disabled-option', label: '비활성', disabled: true }]
      }
    });

    expect(
      integrationReducer(state, {
        type: 'MOCK_OPTION_SELECTED',
        runId: RUN_ID,
        optionId: 'disabled-option'
      })
    ).toBe(state);
  });

  it('option 선택과 확인 요청을 분리한다', () => {
    const selected = integrationReducer(accountRequestState(), {
      type: 'MOCK_OPTION_SELECTED',
      runId: RUN_ID,
      optionId: 'savings'
    });
    const confirmed = integrationReducer(selected, {
      type: 'MOCK_SINGLE_DECISION_CONFIRM_REQUESTED',
      runId: RUN_ID,
      optionId: 'savings'
    });

    expect(selected.lastActionMessage).not.toContain('저축 계좌');
    expect(confirmed.lastActionMessage).toContain('저축 계좌');
    expect(confirmed.phase).toBe('ACCOUNT_SELECTION');
  });

  it('선택하지 않은 option의 확인 요청을 거부한다', () => {
    const state = accountRequestState();

    expect(
      integrationReducer(state, {
        type: 'MOCK_SINGLE_DECISION_CONFIRM_REQUESTED',
        runId: RUN_ID,
        optionId: 'living-expense'
      })
    ).toBe(state);
  });

  it('수취인 단계 진입과 frame·target 교체를 반영한다', () => {
    const recipient = integrationReducer(accountRequestState(), {
      type: 'MOCK_RECIPIENT_PHASE_ENTERED',
      runId: RUN_ID
    });
    const withFrame = integrationReducer(recipient, {
      type: 'MOCK_FRAME_RECEIVED',
      runId: RUN_ID,
      frame: RECIPIENT_SELECTION_FRAME
    });
    const withTarget = integrationReducer(withFrame, {
      type: 'MOCK_TARGET_RECEIVED',
      runId: RUN_ID,
      target: RECIPIENT_SELECTION_TARGET,
      message: 'Mock recipient target'
    });

    expect(recipient.phase).toBe('RECIPIENT_SELECTION');
    expect(recipient.selectedOptionId).toBeNull();
    expect(withFrame.frame).toBe(RECIPIENT_SELECTION_FRAME);
    expect(withTarget.target).toEqual(RECIPIENT_SELECTION_TARGET);
  });

  it('baseline 도달을 Preview 기준점으로만 기록한다', () => {
    const next = integrationReducer(startedState(), {
      type: 'MOCK_BASELINE_REACHED',
      runId: RUN_ID,
      guideMessage: '기준 시나리오 도달'
    });

    expect(next.phase).toBe('BASELINE_REACHED');
    expect(next.workflowStatus).not.toBe('COMPLETED');
    expect(next.guideMessage).toBe('기준 시나리오 도달');
  });

  it('약관 request는 새 Set과 복사된 약관을 사용한다', () => {
    const state = termsRequestState();

    expect(state.phase).toBe('TERMS_AGREEMENT');
    expect(state.selectedTermIds).toEqual(new Set());
    expect(state.termsRequest?.terms).toEqual(MOCK_AGREEMENT_TERMS);
    expect(state.termsRequest?.terms).not.toBe(MOCK_AGREEMENT_TERMS);
  });

  it('term toggle은 기존 Set을 변경하지 않고 새 Set을 만든다', () => {
    const state = termsRequestState();
    const originalSet = state.selectedTermIds;
    const selected = integrationReducer(state, {
      type: 'MOCK_TERM_TOGGLED',
      runId: RUN_ID,
      termId: 'service-agreement',
      selected: true
    });

    expect(originalSet).toEqual(new Set());
    expect(selected.selectedTermIds).not.toBe(originalSet);
    expect(selected.selectedTermIds).toEqual(new Set(['service-agreement']));
  });

  it('unknown과 disabled term toggle을 거부한다', () => {
    const unknownState = termsRequestState();
    expect(
      integrationReducer(unknownState, {
        type: 'MOCK_TERM_TOGGLED',
        runId: RUN_ID,
        termId: 'unknown-term',
        selected: true
      })
    ).toBe(unknownState);

    const disabledTermState: IntegrationState = {
      ...unknownState,
      termsRequest: {
        title: 'Mock',
        message: 'Mock',
        terms: [{ id: 'disabled-term', label: '비활성', required: false, disabled: true }]
      }
    };
    expect(
      integrationReducer(disabledTermState, {
        type: 'MOCK_TERM_TOGGLED',
        runId: RUN_ID,
        termId: 'disabled-term',
        selected: true
      })
    ).toBe(disabledTermState);
  });

  it('필수 약관 Gate를 통과한 확인 요청만 기록한다', () => {
    let state = termsRequestState();
    state = integrationReducer(state, {
      type: 'MOCK_TERM_TOGGLED',
      runId: RUN_ID,
      termId: 'service-agreement',
      selected: true
    });
    expect(
      integrationReducer(state, {
        type: 'MOCK_TERMS_CONFIRM_REQUESTED',
        runId: RUN_ID,
        selectedTermIds: ['service-agreement']
      })
    ).toBe(state);

    state = integrationReducer(state, {
      type: 'MOCK_TERM_TOGGLED',
      runId: RUN_ID,
      termId: 'personal-information',
      selected: true
    });
    const confirmed = integrationReducer(state, {
      type: 'MOCK_TERMS_CONFIRM_REQUESTED',
      runId: RUN_ID,
      selectedTermIds: ['service-agreement', 'personal-information']
    });
    expect(confirmed.lastActionMessage).toContain('Mock 약관 선택 확인');
  });

  it('reset은 화면 데이터를 지우고 다음 runId를 준비한다', () => {
    const reset = integrationReducer(accountRequestState(), {
      type: 'MOCK_RESET'
    });

    expect(reset).toEqual(createInitialIntegrationState(RUN_ID + 1));
  });

  it('reset 이후 이전 runId action을 무시한다', () => {
    const reset = integrationReducer(startedState(), { type: 'MOCK_RESET' });
    const staleAction: IntegrationReducerAction = {
      type: 'MOCK_FRAME_RECEIVED',
      runId: RUN_ID,
      frame: ACCOUNT_SELECTION_FRAME
    };

    expect(integrationReducer(reset, staleAction)).toBe(reset);
  });

  it('빈 오류 원문 대신 안전한 일반 오류를 표시한다', () => {
    const next = integrationReducer(startedState(), {
      type: 'MOCK_SAFE_ERROR',
      runId: RUN_ID,
      safeMessage: '   '
    });

    expect(next.phase).toBe('ERROR');
    expect(next.safeErrorMessage).toContain('로컬 Mock');
    expect(next.target).toBeNull();
  });

  it('입력 state와 action 배열을 변경하지 않는다', () => {
    const state = termsRequestState();
    const selectedTermIds = ['service-agreement', 'personal-information'];
    const stateSnapshot = {
      ...state,
      selectedTermIds: new Set(state.selectedTermIds)
    };

    integrationReducer(state, {
      type: 'MOCK_TERMS_CONFIRM_REQUESTED',
      runId: RUN_ID,
      selectedTermIds
    });

    expect(state).toEqual(stateSnapshot);
    expect(selectedTermIds).toEqual([
      'service-agreement',
      'personal-information'
    ]);
  });
});
