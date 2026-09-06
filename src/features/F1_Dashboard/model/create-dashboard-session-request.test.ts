import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createDashboardSessionRequest,
  DEFAULT_DEMO_BANK_BASE_URL
} from './create-dashboard-session-request';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('createDashboardSessionRequest', () => {
  it('예금 선택을 기본 데모 URL과 사용자 요청으로 변환한다', () => {
    vi.stubEnv('VITE_DEMO_BANK_BASE_URL', '');

    const request = createDashboardSessionRequest({
      siteId: 'demo-bank',
      taskType: 'OPEN_DEPOSIT'
    });

    expect(request).toEqual({
      siteId: 'demo-bank',
      taskType: 'OPEN_DEPOSIT',
      initialPath: '/deposit/products',
      initialUrl: `${DEFAULT_DEMO_BANK_BASE_URL}/deposit/products`,
      userRequest: '100만 원으로 정기예금 가입 절차를 시작해 주세요.'
    });
    expect(request.userRequest).not.toContain('12개월');
    expect(request).not.toHaveProperty('intent');
  });

  it('이체 선택을 환경변수 URL과 사용자 요청으로 변환한다', () => {
    vi.stubEnv(
      'VITE_DEMO_BANK_BASE_URL',
      'https://demo.example.com/bank///'
    );

    const request = createDashboardSessionRequest({
      siteId: 'demo-bank',
      taskType: 'TRANSFER_MONEY'
    });

    expect(request).toEqual({
      siteId: 'demo-bank',
      taskType: 'TRANSFER_MONEY',
      initialPath: '/transfer/accounts',
      initialUrl: 'https://demo.example.com/bank/transfer/accounts',
      userRequest: '계좌이체 절차를 시작해 주세요.'
    });
    expect(request).not.toHaveProperty('intent');
  });

  it.each([
    'ftp://demo.example.com',
    'file:///tmp/demo',
    'javascript:alert(1)',
    'not-a-url'
  ])('잘못된 데모 URL %s를 거부한다', (configuredUrl) => {
    vi.stubEnv('VITE_DEMO_BANK_BASE_URL', configuredUrl);

    expect(() =>
      createDashboardSessionRequest({
        siteId: 'demo-bank',
        taskType: 'OPEN_DEPOSIT'
      })
    ).toThrow(/http 또는 https URL/);
  });

  it('인증정보, 쿼리 또는 해시가 포함된 URL을 거부한다', () => {
    vi.stubEnv(
      'VITE_DEMO_BANK_BASE_URL',
      'https://user:secret@demo.example.com/?source=test#section'
    );

    expect(() =>
      createDashboardSessionRequest({
        siteId: 'demo-bank',
        taskType: 'TRANSFER_MONEY'
      })
    ).toThrow(/인증정보, 쿼리 또는 해시/);
  });
});
