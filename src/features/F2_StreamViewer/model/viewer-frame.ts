import type { BrowserFrameEvent } from '@/types/websocket-events';

export type ViewerFrameStatus = 'EMPTY' | 'LOADING' | 'READY' | 'ERROR';

export interface ViewerFrame {
  metadata: BrowserFrameEvent;
  imageSrc: string;
}
