import { useMockBrowserFrameStream } from '@/features/F2_StreamViewer/hooks/useMockBrowserFrameStream';
import {
  DEMO_VIEWER_FRAMES,
  MOCK_VIEWER_FRAME_INTERVAL_MS,
  MOCK_VIEWER_SESSION_ID
} from '@/features/F2_StreamViewer/mocks/demo-viewer-frames';
import {
  VIEWER_FRAME_HEIGHT,
  VIEWER_FRAME_WIDTH
} from '@/features/F2_StreamViewer/model/viewer-constants';
import F3_SmartOverlay, {
  type TargetHighlightTarget
} from '@/features/F3_SmartOverlay/ui/F3_SmartOverlay';
import { NoticeBox } from '@/shared/ui/NoticeBox';

import F2_StreamViewer from './F2_StreamViewer';

const MOCK_TARGET: TargetHighlightTarget = {
  elementId: 'el-d9-demo-target',
  x: 420,
  y: 310,
  width: 180,
  height: 60
};

const MOCK_TARGET_MESSAGE = '정기예금 메뉴를 선택하겠습니다.';
const MOCK_SERVER_SIZE = {
  width: VIEWER_FRAME_WIDTH,
  height: VIEWER_FRAME_HEIGHT
};

export default function F2_StreamViewerTargetPreview() {
  const { currentFrame } = useMockBrowserFrameStream({
    frames: DEMO_VIEWER_FRAMES,
    sessionId: MOCK_VIEWER_SESSION_ID,
    intervalMs: MOCK_VIEWER_FRAME_INTERVAL_MS
  });

  return (
    <section
      id="viewer-target-highlight-preview"
      data-testid="viewer-target-highlight-preview"
      className="space-y-4"
      aria-label="D10 Target 집중 안내 Mock Preview"
    >
      <NoticeBox
        variant="info"
        title="D10 Target 집중 안내 Mock Preview"
        announce="off"
        role="note"
      >
        실제 WebSocket 연결 없이 Target 외부 암전·블러와 확대 화면을 표시합니다.
      </NoticeBox>

      <F2_StreamViewer
        frame={currentFrame}
        renderOverlay={({ displaySize, frameStatus, imageSrc }) => (
          <F3_SmartOverlay
            target={MOCK_TARGET}
            serverSize={MOCK_SERVER_SIZE}
            displaySize={displaySize}
            message={MOCK_TARGET_MESSAGE}
            focusEffectsEnabled={frameStatus === 'READY'}
            magnifierImageSrc={imageSrc}
            frameStatus={frameStatus}
          />
        )}
      />
    </section>
  );
}
