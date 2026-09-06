import { ELEMENT_IDS } from '../constants/element-ids';

export interface TransferRecipient {
  id: string;
  displayName: string;
  relationshipLabel: string;
  bankLabel: string;
  maskedAccountLabel: string;
  cardElementId: string;
  selectButtonElementId: string;
}

export const transferRecipients: readonly TransferRecipient[] = [
  {
    id: 'hong-gildong',
    displayName: '홍길동',
    relationshipLabel: '가족 Mock',
    bankLabel: '데모은행',
    maskedAccountLabel: 'Mock 계좌 · 끝자리 **56',
    cardElementId: ELEMENT_IDS.RECIPIENT_HONG_GILDONG,
    selectButtonElementId:
      ELEMENT_IDS.BUTTON_SELECT_RECIPIENT_HONG_GILDONG
  },
  {
    id: 'demo-saved',
    displayName: '데모 수취인 A',
    relationshipLabel: '등록 수취인 Mock',
    bankLabel: '데모은행',
    maskedAccountLabel: 'Mock 계좌 · 끝자리 **21',
    cardElementId: ELEMENT_IDS.RECIPIENT_DEMO_SAVED,
    selectButtonElementId: ELEMENT_IDS.BUTTON_SELECT_RECIPIENT_DEMO_SAVED
  }
];
