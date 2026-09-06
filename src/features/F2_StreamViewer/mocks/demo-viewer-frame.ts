import demoViewerFrameImage from './demo-viewer-frame.svg';

import {
  VIEWER_FRAME_HEIGHT,
  VIEWER_FRAME_WIDTH
} from '@/features/F2_StreamViewer/model/viewer-constants';
import type { ViewerFrame } from '@/features/F2_StreamViewer/model/viewer-frame';

export const DEMO_VIEWER_FRAME: ViewerFrame = {
  metadata: {
    type: 'BROWSER_FRAME',
    sessionId: 'frontend-d6-mock',
    timestamp: 0,
    width: VIEWER_FRAME_WIDTH,
    height: VIEWER_FRAME_HEIGHT
  },
  imageSrc: demoViewerFrameImage
};
