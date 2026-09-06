import { describe, expect, it } from 'vitest';

import type { SessionViewerFrame } from '@/features/Integration/api/session-frame-transport';
import { sessionFrameReducer } from './session-frame-reducer';
import {
  canSubmitViewerAction,
  createInitialSessionFrameState,
  initialSessionFrameState
} from './session-frame-state';

const frame: SessionViewerFrame = {
  metadata: {
    type: 'BROWSER_FRAME' as const,
    sessionId: 'session-123',
    frameId: 'frm-123',
    sequence: 1,
    timestamp: 1_786_350_000_000,
    width: 1280,
    height: 720,
    mimeType: 'image/png' as const,
    byteLength: 4
  },
  imageSrc: 'blob:frame'
};

describe('sessionFrameReducer', () => {
  it('안전한 초기 상태를 제공한다', () => {
    expect(initialSessionFrameState).toEqual({
      runId: 0,
      phase: 'IDLE',
      message: expect.any(String),
      frame: undefined,
      hasReceivedFirstFrame: false,
      canReset: false,
      actionPending: false,
      pendingActionType: null,
      expectedActionFrame: null,
      actionMessage: expect.any(String),
      actionError: null,
      recoveryAttempt: 0,
      recoveryMaxAttempts: null,
      canRetryManually: false,
      recoveryPending: false
    });
  });

  it('Action 요청 중 중복 전송을 막고 matching frame에서 완료한다', () => {
    const ready = {
      ...createInitialSessionFrameState(3),
      phase: 'FRAME_READY' as const,
      frame,
      hasReceivedFirstFrame: true,
      canReset: true
    };
    const pending = sessionFrameReducer(ready, {
      type: 'ACTION_REQUESTED',
      runId: 3,
      actionType: 'CLICK'
    });
    const waiting = sessionFrameReducer(pending, {
      type: 'ACTION_FRAME_EXPECTED',
      runId: 3,
      frameId: 'frm-124',
      sequence: 2
    });
    const staleFrame = {
      ...frame,
      metadata: { ...frame.metadata, frameId: 'frm-other', sequence: 2 }
    };
    const stillWaiting = sessionFrameReducer(waiting, {
      type: 'FRAME_RECEIVED',
      runId: 3,
      frame: staleFrame
    });
    const matchingFrame = {
      ...frame,
      metadata: { ...frame.metadata, frameId: 'frm-124', sequence: 2 }
    };
    const completed = sessionFrameReducer(stillWaiting, {
      type: 'FRAME_RECEIVED',
      runId: 3,
      frame: matchingFrame
    });

    expect(canSubmitViewerAction(pending)).toBe(false);
    expect(stillWaiting.actionPending).toBe(true);
    expect(completed).toMatchObject({
      actionPending: false,
      pendingActionType: null,
      expectedActionFrame: null,
      actionError: null
    });
  });

  it('non-advanced 응답과 안전한 오류에서 pending을 해제한다', () => {
    const pending = sessionFrameReducer(
      {
        ...createInitialSessionFrameState(4),
        phase: 'FRAME_READY',
        frame
      },
      { type: 'ACTION_REQUESTED', runId: 4, actionType: 'SCROLL' }
    );
    const noFrame = sessionFrameReducer(pending, {
      type: 'ACTION_FINISHED_WITHOUT_FRAME',
      runId: 4,
      message: '차단됨'
    });
    const failed = sessionFrameReducer(pending, {
      type: 'ACTION_FAILED',
      runId: 4,
      message: '안전한 오류'
    });

    expect(noFrame).toMatchObject({ actionPending: false, actionMessage: '차단됨' });
    expect(failed).toMatchObject({
      actionPending: false,
      actionError: '안전한 오류'
    });
  });

  it('session 생성부터 첫 frame까지 phase를 순서대로 전환한다', () => {
    const creating = sessionFrameReducer(initialSessionFrameState, {
      type: 'START_REQUESTED',
      runId: 1
    });
    const connecting = sessionFrameReducer(creating, {
      type: 'SESSION_CREATED',
      runId: 1
    });
    const waiting = sessionFrameReducer(connecting, {
      type: 'FRAME_CONNECTED',
      runId: 1
    });
    const ready = sessionFrameReducer(waiting, {
      type: 'FRAME_RECEIVED',
      runId: 1,
      frame
    });

    expect(creating.phase).toBe('CREATING_SESSION');
    expect(connecting.phase).toBe('CONNECTING_FRAME');
    expect(waiting.phase).toBe('WAITING_FIRST_FRAME');
    expect(ready).toMatchObject({
      phase: 'FRAME_READY',
      frame,
      hasReceivedFirstFrame: true,
      canReset: true
    });
    expect(ready.frame?.metadata).toMatchObject({
      frameId: 'frm-123',
      sequence: 1,
      timestamp: 1_786_350_000_000
    });
  });

  it('연결 종료와 안전한 오류에서 frame을 제거한다', () => {
    const ready = {
      ...createInitialSessionFrameState(2),
      phase: 'FRAME_READY' as const,
      frame,
      hasReceivedFirstFrame: true,
      canReset: true
    };

    expect(
      sessionFrameReducer(ready, { type: 'DISCONNECTED', runId: 2 })
    ).toMatchObject({ phase: 'DISCONNECTED', frame: undefined });
    expect(
      sessionFrameReducer(ready, {
        type: 'SAFE_ERROR',
        runId: 2,
        message: '안전한 안내입니다.'
      })
    ).toMatchObject({
      phase: 'ERROR',
      message: '안전한 안내입니다.',
      frame: undefined
    });
  });

  it('DISCONNECTED에서 RECONNECTING을 거쳐 새 frame으로 복구한다', () => {
    const ready = {
      ...createInitialSessionFrameState(6),
      phase: 'FRAME_READY' as const,
      frame,
      hasReceivedFirstFrame: true,
      canReset: true
    };
    const disconnected = sessionFrameReducer(ready, {
      type: 'DISCONNECTED',
      runId: 6,
      canRetryManually: true
    });
    const reconnecting = sessionFrameReducer(disconnected, {
      type: 'RECONNECT_SCHEDULED',
      runId: 6,
      attempt: 1,
      maxAttempts: 3
    });
    const connected = sessionFrameReducer(reconnecting, {
      type: 'FRAME_CONNECTED',
      runId: 6
    });
    const recoveredFrame = {
      ...frame,
      metadata: { ...frame.metadata, frameId: 'frm-124', sequence: 2 },
      imageSrc: 'blob:frame-2'
    };
    const recovered = sessionFrameReducer(connected, {
      type: 'FRAME_RECEIVED',
      runId: 6,
      frame: recoveredFrame
    });

    expect(disconnected).toMatchObject({
      phase: 'DISCONNECTED',
      canRetryManually: true,
      recoveryPending: false
    });
    expect(reconnecting).toMatchObject({
      phase: 'RECONNECTING',
      recoveryAttempt: 1,
      recoveryMaxAttempts: 3,
      recoveryPending: true,
      frame: undefined
    });
    expect(connected.phase).toBe('RECONNECTING');
    expect(recovered).toMatchObject({
      phase: 'FRAME_READY',
      recoveryAttempt: 0,
      recoveryPending: false,
      frame: recoveredFrame
    });
  });

  it('복구 실패 후 수동 retry를 한 번 시작할 수 있는 상태를 제공한다', () => {
    const failed = sessionFrameReducer(createInitialSessionFrameState(7), {
      type: 'RECOVERY_FAILED',
      runId: 7
    });
    const retrying = sessionFrameReducer(failed, {
      type: 'MANUAL_RETRY_STARTED',
      runId: 7
    });

    expect(failed).toMatchObject({
      phase: 'ERROR',
      canRetryManually: true,
      recoveryPending: false
    });
    expect(retrying).toMatchObject({
      phase: 'RECONNECTING',
      canRetryManually: false,
      recoveryPending: true
    });
  });

  it('Viewer Action은 복구가 끝난 FRAME_READY에서만 허용한다', () => {
    const ready = {
      ...createInitialSessionFrameState(8),
      phase: 'FRAME_READY' as const,
      frame,
      recoveryPending: false
    };

    expect(canSubmitViewerAction(ready)).toBe(true);
    expect(canSubmitViewerAction({ ...ready, recoveryPending: true })).toBe(false);
    expect(canSubmitViewerAction({ ...ready, phase: 'RECONNECTING' })).toBe(false);
    expect(canSubmitViewerAction({ ...ready, phase: 'DISCONNECTED' })).toBe(false);
    expect(canSubmitViewerAction({ ...ready, phase: 'ERROR' })).toBe(false);
  });

  it('reset은 runId를 바꾸고 초기 상태로 복원한다', () => {
    const state = { ...createInitialSessionFrameState(3), canReset: true, frame };
    expect(
      sessionFrameReducer(state, { type: 'RESET', nextRunId: 4 })
    ).toEqual(createInitialSessionFrameState(4));
  });

  it('이전 runId callback을 무시하고 입력 state를 변경하지 않는다', () => {
    const state = { ...createInitialSessionFrameState(5), canReset: true };
    const result = sessionFrameReducer(state, {
      type: 'FRAME_RECEIVED',
      runId: 4,
      frame
    });

    expect(result).toBe(state);
    expect(state).toEqual({ ...createInitialSessionFrameState(5), canReset: true });
  });
});
