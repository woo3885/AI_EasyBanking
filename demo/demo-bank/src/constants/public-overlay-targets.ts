import { ROUTES } from './routes';

export const PUBLIC_OVERLAY_TARGET_KEYS = {
  DEPOSIT_PRODUCT_12M_SELECT: 'deposit-product-12m-select',
  DEPOSIT_PRODUCT_PREFERRED_SELECT: 'deposit-product-preferred-select'
} as const;

export type PublicOverlayTargetKey =
  (typeof PUBLIC_OVERLAY_TARGET_KEYS)[keyof typeof PUBLIC_OVERLAY_TARGET_KEYS];

export const DEPOSIT_PRODUCT_PUBLIC_TARGET_KEYS: Readonly<Record<string, PublicOverlayTargetKey>> = {
  'deposit-12m': PUBLIC_OVERLAY_TARGET_KEYS.DEPOSIT_PRODUCT_12M_SELECT,
  'deposit-preferred': PUBLIC_OVERLAY_TARGET_KEYS.DEPOSIT_PRODUCT_PREFERRED_SELECT
};

export const PUBLIC_OVERLAY_TARGET_ROUTES: Readonly<Record<PublicOverlayTargetKey, string>> = {
  [PUBLIC_OVERLAY_TARGET_KEYS.DEPOSIT_PRODUCT_12M_SELECT]: ROUTES.DEPOSIT_PRODUCTS,
  [PUBLIC_OVERLAY_TARGET_KEYS.DEPOSIT_PRODUCT_PREFERRED_SELECT]: ROUTES.DEPOSIT_PRODUCTS
};

export function getPublicOverlayTargetRoute(key: string): string | null {
  return Object.prototype.hasOwnProperty.call(PUBLIC_OVERLAY_TARGET_ROUTES, key)
    ? PUBLIC_OVERLAY_TARGET_ROUTES[key as PublicOverlayTargetKey]
    : null;
}
