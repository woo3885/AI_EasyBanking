package com.ddd.backend.api.controller;

import com.ddd.backend.api.dto.conversation.BrowserPageReadyResponse;
import com.ddd.backend.config.RestCorsProperties;
import com.ddd.backend.conversation.navigation.BrowserNavigationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(BrowserNavigationController.class)
@EnableConfigurationProperties(RestCorsProperties.class)
class BrowserNavigationControllerTest {
    @Autowired MockMvc mockMvc;
    @MockitoBean BrowserNavigationService service;

    @Test
    void pageReady는_전용_identity_headers와_안전한_DTO로_접수한다() throws Exception {
        when(service.pageReady(eq("session-1"), eq("secret"),
                eq("http://127.0.0.1:5173"), eq("binding-1"), eq("page-source"), any()))
                .thenReturn(new BrowserPageReadyResponse(
                        "session-1", "request-1", "navigation-1", "binding-1",
                        "page-source", "page-destination", 1, "/deposit/products",
                        "PAGE_READY_ACCEPTED",
                        "화면 준비 상태가 접수되었습니다. AI 실행이나 금융 업무 완료를 의미하지 않습니다."));

        mockMvc.perform(post("/api/v1/sessions/session-1/browser-bindings/page-ready")
                        .header("Origin", "http://127.0.0.1:5173")
                        .header(ConversationBridgeController.BRIDGE_TOKEN_HEADER, "secret")
                        .header(ConversationBridgeController.BROWSER_BINDING_ID_HEADER, "binding-1")
                        .header(ConversationBridgeController.PAGE_IDENTITY_HEADER, "page-source")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validBody()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PAGE_READY_ACCEPTED"))
                .andExpect(jsonPath("$.data.browserBindingId").value("binding-1"))
                .andExpect(jsonPath("$.data.pageIdentity").value("page-destination"));
    }

    @Test
    void pageReady는_DOM_cookie_selector_같은_unknown_field를_거부한다() throws Exception {
        mockMvc.perform(post("/api/v1/sessions/session-1/browser-bindings/page-ready")
                        .header("Origin", "http://127.0.0.1:5173")
                        .header(ConversationBridgeController.BRIDGE_TOKEN_HEADER, "secret")
                        .header(ConversationBridgeController.BROWSER_BINDING_ID_HEADER, "binding-1")
                        .header(ConversationBridgeController.PAGE_IDENTITY_HEADER, "page-source")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validBody().replace("\n}", ",\n  \"cookie\":\"secret\"\n}")))
                .andExpect(status().isBadRequest());

        verify(service, never()).pageReady(any(), any(), any(), any(), any(), any());
    }

    private String validBody() {
        return """
                {
                  "requestId":"request-1",
                  "navigationId":"navigation-1",
                  "sourcePageIdentity":"page-source",
                  "destinationPageIdentity":"page-destination",
                  "routeRevision":1,
                  "renderedRoute":"/deposit/products",
                  "viewportWidth":1280,
                  "viewportHeight":720,
                  "devicePixelRatio":2.0
                }
                """;
    }
}
