import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import DepositProductsPage from '../../src/pages/DepositProductsPage';

describe('Demo Bank public Overlay targets', () => {
  it('상품 선택 버튼에 고유 공개 key와 기존 접근성 계약을 함께 유지한다', async () => {
    const user = userEvent.setup();
    render(<DepositProductsPage />);

    const basic = screen.getByRole('button', { name: '12개월 정기예금 선택' });
    const preferred = screen.getByRole('button', { name: '우대금리 정기예금 선택' });
    expect(basic).toHaveTextContent('이 상품 선택');
    expect(preferred).toHaveTextContent('이 상품 선택');
    expect(basic).toHaveAttribute('data-ddd-public-target', 'deposit-product-12m-select');
    expect(preferred).toHaveAttribute('data-ddd-public-target', 'deposit-product-preferred-select');
    expect(basic).toHaveAttribute('id', 'btn-select-deposit-12m');
    expect(basic).toHaveAttribute('data-testid', 'btn-select-deposit-12m');
    expect(preferred).toHaveAttribute('id', 'btn-select-deposit-preferred');
    expect(preferred).toHaveAttribute('data-testid', 'btn-select-deposit-preferred');

    const next = screen.getByRole('button', { name: '상품 선택 후 다음' });
    expect(next).toBeDisabled();
    await user.click(basic);
    expect(basic).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '선택한 상품 상세 보기' })).toBeEnabled();
  });
});
