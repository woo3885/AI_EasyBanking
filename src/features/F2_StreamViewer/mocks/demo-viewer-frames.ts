import demoViewerFrameImage from './demo-viewer-frame.svg';
import demoViewerFrameProgressImage from './demo-viewer-frame-progress.svg';

import {
  VIEWER_FRAME_HEIGHT,
  VIEWER_FRAME_WIDTH
} from '@/features/F2_StreamViewer/model/viewer-constants';
import type { ViewerFrame } from '@/features/F2_StreamViewer/model/viewer-frame';

export const MOCK_VIEWER_SESSION_ID = 'bs-d7-mock-001';
export const MOCK_VIEWER_FRAME_INTERVAL_MS = 1_000;

export const DEMO_VIEWER_FRAMES: readonly ViewerFrame[] = [
  {
    metadata: {
      type: 'BROWSER_FRAME',
      sessionId: MOCK_VIEWER_SESSION_ID,
      timestamp: 1_000,
      width: VIEWER_FRAME_WIDTH,
      height: VIEWER_FRAME_HEIGHT
    },
    imageSrc: demoViewerFrameImage
  },
  {
    metadata: {
      type: 'BROWSER_FRAME',
      sessionId: MOCK_VIEWER_SESSION_ID,
      timestamp: 2_000,
      width: VIEWER_FRAME_WIDTH,
      height: VIEWER_FRAME_HEIGHT
    },
    imageSrc: demoViewerFrameProgressImage
  }
];

export const MOCK_VIEWER_FRAME_COUNT = DEMO_VIEWER_FRAMES.length;
