package com.ddd.backend.ai;

import com.ddd.backend.automation.BrowserActionType;
import com.ddd.backend.automation.dom.SanitizedDomSnapshot;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/** 원문 value나 selector를 보관하지 않는 세션별 금융 Action replay guard. */
@Component
public final class ActionReplayGuard {

    private final ConcurrentHashMap<String, Set<String>> executed =
            new ConcurrentHashMap<>();

    public boolean reserve(
            String sessionId,
            SanitizedDomSnapshot snapshot,
            AiDecisionResponse response
    ) {
        if (response.actionType() != BrowserActionType.CLICK
                && response.actionType() != BrowserActionType.TYPE
                && response.actionType() != BrowserActionType.SELECT) {
            return true;
        }
        String target = snapshot.elements().stream()
                .filter(element -> element.elementId().equals(response.elementId()))
                .findFirst()
                .map(element -> String.join("|",
                        safe(element.tag()), safe(element.role()), safe(element.text()),
                        safe(element.ariaLabel()), safe(element.inputType()),
                        Boolean.toString(element.enabled()),
                        String.valueOf(element.checked()), element.securityPolicy().name()))
                .orElse("missing-target");
        String dom = snapshot.page().url() + "|" + snapshot.elements().stream()
                .map(element -> String.join(":", safe(element.tag()),
                        safe(element.text()), safe(element.ariaLabel()),
                        Boolean.toString(element.enabled()),
                        String.valueOf(element.checked()), element.securityPolicy().name()))
                .reduce("", (left, right) -> left + "|" + right);
        String key = digest(dom) + "|" + response.actionType() + "|"
                + digest(target) + "|" + digest(safe(response.value()));
        return executed.computeIfAbsent(sessionId, ignored -> ConcurrentHashMap.newKeySet())
                .add(key);
    }

    public void removeSession(String sessionId) {
        if (sessionId != null) executed.remove(sessionId);
    }

    private String digest(String value) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(hash, 0, 12);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("Action fingerprint를 생성할 수 없습니다.");
        }
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }
}
