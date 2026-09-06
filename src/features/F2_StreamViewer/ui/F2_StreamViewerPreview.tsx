import { useMockBrowserFrameStream } from '@/features/F2_StreamViewer/hooks/useMockBrowserFrameStream';
import {
  DEMO_VIEWER_FRAMES,
  MOCK_VIEWER_FRAME_COUNT,
  MOCK_VIEWER_FRAME_INTERVAL_MS,
  MOCK_VIEWER_SESSION_ID
} from '@/features/F2_StreamViewer/mocks/demo-viewer-frames';
import { NoticeBox } from '@/shared/ui/NoticeBox';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { Text } from '@/shared/ui/Text';

import F2_StreamViewer from './F2_StreamViewer';

export default function F2_StreamViewerPreview() {
  const { currentFrame } = useMockBrowserFrameStream({
    frames: DEMO_VIEWER_FRAMES,
    sessionId: MOCK_VIEWER_SESSION_ID,
    intervalMs: MOCK_VIEWER_FRAME_INTERVAL_MS
  });
  const currentFrameIndex = currentFrame
    ? DEMO_VIEWER_FRAMES.indexOf(currentFrame)
    : -1;

  return (
    <section
      id="viewer-frame-stream-preview"
      data-testid="viewer-frame-stream-preview"
      className="space-y-4"
      aria-label="D7 Mock 프레임 스트림 Preview"
    >
      <NoticeBox
        variant="info"
        title="개발용 Mock Preview"
        announce="off"
        role="note"
      >
        실제 WebSocket 연결이 아닌 로컬 SVG Mock 프레임 재생입니다.
      </NoticeBox>

      <div
        id="status-mock-frame-stream"
        data-testid="status-mock-frame-stream"
        className="flex flex-wrap items-center gap-3"
        role="status"
        aria-live="polite"
      >
        <StatusBadge variant="progress">Mock 프레임</StatusBadge>
        <Text variant="body">
          {currentFrame
            ? `${currentFrameIndex + 1}/${MOCK_VIEWER_FRAME_COUNT} 프레임 표시 · timestamp ${currentFrame.metadata.timestamp}`
            : 'Mock 프레임을 준비하고 있습니다.'}
        </Text>
      </div>

      <F2_StreamViewer frame={currentFrame} />
    </section>
  );
}
