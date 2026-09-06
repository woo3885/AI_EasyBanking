import { describe, expect, it } from 'vitest';

import {
  PREVIEW_FRAME_RECONNECT_POLICY,
  classifyFrameConnectionClose,
  createFrameReconnectPolicy,
  getFrameReconnectDelay,
  getFrameReconnectMaxAttempts
} from './frame-reconnect-policy';

describe('frame reconnect policy', () => {
  it.each([1001, 1006, 1011, 1012, 1013, 1014])(
    '일시적 close code %s만 retry 가능으로 분류한다',
    (code) => {
      expect(classifyFrameConnectionClose({ code, wasClean: false })).toMatchObject({
        category: 'TRANSIENT',
        retryable: true
      });
    }
  );

  it.each([
    [1000, 'NORMAL'],
    [1002, 'PROTOCOL'],
    [1003, 'UNSUPPORTED_DATA'],
    [1007, 'INVALID_PAYLOAD'],
    [1008, 'POLICY_VIOLATION'],
    [1009, 'MESSAGE_TOO_LARGE'],
    [1015, 'SECURITY']
  ] as const)('close code %s를 retry 불가 %s로 분류한다', (code, category) => {
    expect(classifyFrameConnectionClose({ code, wasClean: code === 1000 })).toMatchObject({
      category,
      retryable: false
    });
  });

  it('알 수 없는 close code는 fail-closed로 처리한다', () => {
    expect(classifyFrameConnectionClose({ code: 4999, wasClean: false })).toEqual({
      category: 'UNKNOWN',
      retryable: false,
      message: '원격 화면 연결이 종료되었습니다.'
    });
  });

  it('주입한 delay 순서와 최대 시도 횟수를 제공한다', () => {
    const policy = createFrameReconnectPolicy([0, 500, 1_500]);

    expect(getFrameReconnectDelay(policy, 1)).toBe(0);
    expect(getFrameReconnectDelay(policy, 2)).toBe(500);
    expect(getFrameReconnectDelay(policy, 3)).toBe(1_500);
    expect(getFrameReconnectDelay(policy, 4)).toBeNull();
    expect(getFrameReconnectMaxAttempts(policy)).toBe(3);
  });

  it('정책이 없으면 production 자동 reconnect가 활성화되지 않는다', () => {
    expect(getFrameReconnectDelay(undefined, 1)).toBeNull();
    expect(getFrameReconnectMaxAttempts(undefined)).toBeNull();
  });

  it('잘못된 delay 정책은 생성 단계에서 거부한다', () => {
    expect(() => createFrameReconnectPolicy([-1])).toThrow();
    expect(() => createFrameReconnectPolicy([1.5])).toThrow();
  });

  it('Preview Mock 정책은 production 기본값과 분리된 명시적 3회 정책이다', () => {
    expect(PREVIEW_FRAME_RECONNECT_POLICY.delaysMs).toEqual([0, 1_000, 3_000]);
    expect(Object.isFrozen(PREVIEW_FRAME_RECONNECT_POLICY.delaysMs)).toBe(true);
  });
});
