export const ROUTES = {
  HOME: '/',
  DEPOSIT_PRODUCTS: '/deposit/products',
  DEPOSIT_CONDITIONS: '/deposit/conditions',
  DEPOSIT_TERMS: '/deposit/terms',
  DEPOSIT_SECURE_PASSWORD: '/deposit/secure/password',
  DEPOSIT_CONFIRMATION: '/deposit/confirmation',
  DEPOSIT_COMPLETED: '/deposit/completed',
  TRANSFER_ACCOUNTS: '/transfer/accounts',
  TRANSFER_RECIPIENTS: '/transfer/recipients',
  TRANSFER_AMOUNT: '/transfer/amount',
  TRANSFER_SECURE_PASSWORD: '/transfer/secure/password',
  TRANSFER_SECURE_OTP: '/transfer/secure/otp',
  TRANSFER_CONFIRMATION: '/transfer/confirmation',
  TRANSFER_COMPLETED: '/transfer/completed'
} as const;

export type DemoBankRoute = (typeof ROUTES)[keyof typeof ROUTES];

export function createDepositProductDetailPath(productId: string): string {
  return `${ROUTES.DEPOSIT_PRODUCTS}/${encodeURIComponent(productId)}`;
}

export function createDepositConditionsPath(productId: string): string {
  return `${ROUTES.DEPOSIT_CONDITIONS}/${encodeURIComponent(productId)}`;
}

export function createDepositTermsPath(productId: string): string {
  return `${ROUTES.DEPOSIT_TERMS}/${encodeURIComponent(productId)}`;
}

export function createDepositPasswordPath(productId: string): string {
  return `${ROUTES.DEPOSIT_SECURE_PASSWORD}/${encodeURIComponent(productId)}`;
}

export function createDepositConfirmationPath(productId: string): string {
  return `${ROUTES.DEPOSIT_CONFIRMATION}/${encodeURIComponent(productId)}`;
}

export function createDepositCompletedPath(productId: string): string {
  return `${ROUTES.DEPOSIT_COMPLETED}/${encodeURIComponent(productId)}`;
}

export function createTransferRecipientsPath(accountId: string): string {
  return `${ROUTES.TRANSFER_RECIPIENTS}/${encodeURIComponent(accountId)}`;
}

export function createTransferAmountPath(
  accountId: string,
  recipientId: string
): string {
  return `${ROUTES.TRANSFER_AMOUNT}/${encodeURIComponent(accountId)}/${encodeURIComponent(recipientId)}`;
}

export function createTransferPasswordPath(
  accountId: string,
  recipientId: string
): string {
  return `${ROUTES.TRANSFER_SECURE_PASSWORD}/${encodeURIComponent(accountId)}/${encodeURIComponent(recipientId)}`;
}

export function createTransferOtpPath(
  accountId: string,
  recipientId: string
): string {
  return `${ROUTES.TRANSFER_SECURE_OTP}/${encodeURIComponent(accountId)}/${encodeURIComponent(recipientId)}`;
}

export function createTransferConfirmationPath(
  accountId: string,
  recipientId: string
): string {
  return `${ROUTES.TRANSFER_CONFIRMATION}/${encodeURIComponent(accountId)}/${encodeURIComponent(recipientId)}`;
}

export function createTransferCompletedPath(
  accountId: string,
  recipientId: string
): string {
  return `${ROUTES.TRANSFER_COMPLETED}/${encodeURIComponent(accountId)}/${encodeURIComponent(recipientId)}`;
}

export function normalizePathname(pathname: string): string {
  if (pathname === ROUTES.HOME) {
    return ROUTES.HOME;
  }

  const normalizedPathname = pathname.replace(/\/+$/u, '');
  return normalizedPathname || ROUTES.HOME;
}
