import type { ReactNode } from 'react';

import { ELEMENT_IDS, elementIdentity } from '../constants/element-ids';
import { ROUTES } from '../constants/routes';

interface DemoBankLayoutProps {
  pageId: string;
  currentPath: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
}

const navigationItems = [
  {
    elementId: ELEMENT_IDS.NAV_HOME,
    href: ROUTES.HOME,
    label: '메인'
  },
  {
    elementId: ELEMENT_IDS.NAV_DEPOSIT,
    href: ROUTES.DEPOSIT_PRODUCTS,
    label: '예금 상품'
  },
  {
    elementId: ELEMENT_IDS.NAV_TRANSFER,
    href: ROUTES.TRANSFER_ACCOUNTS,
    label: '출금 계좌'
  }
];

export default function DemoBankLayout({
  pageId,
  currentPath,
  eyebrow,
  title,
  children
}: DemoBankLayoutProps) {
  return (
      <div className="site-shell">
        <header className="site-header">
          <div className="header-content">
            <p className="service-name">금융길잡이 데모뱅크</p>

            <nav aria-label="개발용 데모 화면 확인">
              <ul className="developer-nav">
                {navigationItems.map((item) => (
                  <li key={item.href}>
                    <a
                      {...elementIdentity(item.elementId)}
                      href={item.href}
                      aria-current={
                        currentPath === item.href ? 'page' : undefined
                      }
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </header>

        <main {...elementIdentity(pageId)} className="page-content">
          <div className="page-heading">
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
          </div>
          {children}
        </main>

        <footer className="site-footer">
          이 사이트는 금융 자동화 시연용입니다. 실제 금융거래와 민감정보
          입력을 수행하지 않습니다.
        </footer>
      </div>
  );
}
