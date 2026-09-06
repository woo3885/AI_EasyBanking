package com.ddd.backend.websocket.publisher;

import com.ddd.backend.automation.dom.ElementLocatorResolver;
import com.ddd.backend.automation.dom.SanitizedDomSnapshot;
import com.ddd.backend.frame.BrowserFrameStore;
import com.ddd.backend.security.capture.CapturedBrowserFrame;
import com.ddd.backend.websocket.dto.AutomationUiEvent;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.options.BoundingBox;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.List;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AutomationTargetEventServiceTest {

    @SuppressWarnings("unchecked")
    @Test
    void 현재_DOM_좌표를_Frame과_결합해_Target을_발행한다() {
        ElementLocatorResolver locatorResolver = mock(ElementLocatorResolver.class);
        Locator locator = mock(Locator.class);
        BoundingBox currentBox = new BoundingBox();
        currentBox.x = 30;
        currentBox.y = 40;
        currentBox.width = 120;
        currentBox.height = 50;
        when(locator.boundingBox()).thenReturn(currentBox);
        when(locatorResolver.withLocator(
                eq("session-001"),
                eq("el-12345678-001"),
                any()
        )).thenAnswer(invocation -> {
            Function<Locator, Object> task = invocation.getArgument(2);
            return task.apply(locator);
        });

        BrowserFrameStore frameStore = new BrowserFrameStore();
        frameStore.publish(
                "session-001",
                new CapturedBrowserFrame(
                        new byte[]{1, 2, 3}, 1280, 720, "image/png")
        );

        SimpMessagingTemplate template = mock(SimpMessagingTemplate.class);
        AutomationStatusEventPublisher publisher =
                new AutomationStatusEventPublisher(template);
        AutomationTargetEventService service = new AutomationTargetEventService(
                locatorResolver, frameStore, publisher);

        SanitizedDomSnapshot snapshot = new SanitizedDomSnapshot(
                "1.0",
                "snap-12345678",
                new SanitizedDomSnapshot.PageSnapshot("http://example.test", "테스트"),
                List.of(new SanitizedDomSnapshot.ElementSnapshot(
                        "el-12345678-001", "button", "button", "예금 상품 선택",
                        null, null, null, true, true,
                        new SanitizedDomSnapshot.BoundingBoxSnapshot(1, 2, 3, 4),
                        SanitizedDomSnapshot.SecurityPolicy.NORMAL
                ))
        );

        service.publishCurrentTarget(
                "session-001", snapshot, "el-12345678-001");

        ArgumentCaptor<AutomationUiEvent> captor =
                ArgumentCaptor.forClass(AutomationUiEvent.class);
        verify(template).convertAndSend(
                eq("/topic/sessions/session-001/events"), captor.capture());

        AutomationUiEvent event = captor.getValue();
        assertThat(event.target().x()).isEqualTo(30);
        assertThat(event.target().width()).isEqualTo(120);
        assertThat(event.target().frameSequence()).isEqualTo(1L);
        assertThat(event.target().snapshotId()).isEqualTo("snap-12345678");
        assertThat(event.target().label()).isEqualTo("예금 상품 선택");
    }
}
