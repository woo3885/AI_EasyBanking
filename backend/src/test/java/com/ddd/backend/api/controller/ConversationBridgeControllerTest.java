package com.ddd.backend.api.controller;

import com.ddd.backend.config.RestCorsProperties;
import com.ddd.backend.conversation.bridge.UserBrowserBridgeBinding;
import com.ddd.backend.conversation.bridge.DemoAgentBridgeAuthenticationException;
import com.ddd.backend.conversation.bridge.UserBrowserBridgeRegistry;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.service.AutomationSessionService;
import com.ddd.backend.conversation.overlay.OverlayTargetStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.context.annotation.Import;
import com.ddd.backend.config.RestCorsConfig;

import java.time.Instant;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ConversationBridgeController.class)
@EnableConfigurationProperties(RestCorsProperties.class)
@Import(RestCorsConfig.class)
class ConversationBridgeControllerTest {
    @Autowired MockMvc mockMvc;
    @MockitoBean AutomationSessionService sessions;
    @MockitoBean UserBrowserBridgeRegistry bridges;
    @MockitoBean OverlayTargetStore targets;

    private final Instant expiresAt = Instant.parse("2026-09-06T12:00:00Z");

    @BeforeEach
    void setUp() {
        when(sessions.getSession("session-1"))
                .thenReturn(AutomationSession.create("request without secret"));
        when(bridges.require("session-1", "secret", "http://127.0.0.1:5190", "binding-1", "page-1"))
                .thenReturn(new UserBrowserBridgeBinding(
                        "session-1", "binding-1", "secret", "page-1",
                        "http://127.0.0.1:5190", expiresAt));
        when(bridges.require("session-1", null, "http://127.0.0.1:5190", null, null))
                .thenThrow(new DemoAgentBridgeAuthenticationException());
    }

    @Test
    void 새_문서는_identity_검증후_재구독_계약을_받는다() throws Exception {
        mockMvc.perform(get("/api/v1/sessions/session-1/conversation/bridge")
                        .header("Origin", "http://127.0.0.1:5190")
                        .header(ConversationBridgeController.BRIDGE_TOKEN_HEADER, "secret")
                        .header(ConversationBridgeController.BROWSER_BINDING_ID_HEADER, "binding-1")
                        .header(ConversationBridgeController.PAGE_IDENTITY_HEADER, "page-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.sessionId").value("session-1"))
                .andExpect(jsonPath("$.data.pageIdentity").value("page-1"))
                .andExpect(jsonPath("$.data.eventSubscription")
                        .value("/topic/sessions/session-1/events"))
                .andExpect(jsonPath("$.data.conversationSnapshotPath")
                        .value("/api/v1/sessions/session-1/conversation"))
                .andExpect(jsonPath("$.data.activeTarget").doesNotExist())
                .andExpect(jsonPath("$..bridgeToken").doesNotExist())
                .andExpect(jsonPath("$..content").doesNotExist());
    }

    @Test
    void identity_header가_없으면_요청을_거부한다() throws Exception {
        mockMvc.perform(get("/api/v1/sessions/session-1/conversation/bridge")
                        .header("Origin", "http://127.0.0.1:5190"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value("BRIDGE_401_INVALID_IDENTITY"));
    }

    @Test
    void demo_origin_recovery_preflight는_필요한_identity_header만_허용한다() throws Exception {
        mockMvc.perform(options("/api/v1/sessions/session-1/conversation/bridge")
                        .header("Origin", "http://127.0.0.1:5190")
                        .header("Access-Control-Request-Method", "GET")
                        .header("Access-Control-Request-Headers",
                                "X-DDD-Bridge-Token,X-DDD-Browser-Binding-Id,X-DDD-Page-Identity,Content-Type"))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .header().string("Access-Control-Allow-Origin", "http://127.0.0.1:5190"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .header().string("Access-Control-Allow-Headers",
                                org.hamcrest.Matchers.containsString("X-DDD-Bridge-Token")));
    }

    @Test
    void 허용되지_않은_origin과_header의_preflight는_차단한다() throws Exception {
        mockMvc.perform(options("/api/v1/sessions/session-1/conversation/bridge")
                        .header("Origin", "https://evil.example")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isForbidden());
        mockMvc.perform(options("/api/v1/sessions/session-1/conversation/bridge")
                        .header("Origin", "http://127.0.0.1:5190")
                        .header("Access-Control-Request-Method", "GET")
                        .header("Access-Control-Request-Headers", "X-Unsafe-Header"))
                .andExpect(status().isForbidden());
    }
}
