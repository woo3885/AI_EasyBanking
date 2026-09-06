package com.ddd.backend.conversation.overlay;

import com.ddd.backend.automation.dom.SanitizedDomSnapshot;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

final class DomSnapshotFingerprint {
    private DomSnapshotFingerprint() { }
    static String of(SanitizedDomSnapshot snapshot) {
        StringBuilder value = new StringBuilder().append(snapshot.page());
        for (var element : snapshot.elements()) {
            value.append('|').append(element.tag()).append('|').append(element.role())
                    .append('|').append(element.text()).append('|').append(element.ariaLabel())
                    .append('|').append(element.placeholder()).append('|').append(element.inputType())
                    .append('|').append(element.visible()).append('|').append(element.enabled())
                    .append('|').append(element.checked()).append('|').append(element.boundingBox())
                    .append('|').append(element.securityPolicy());
        }
        try {
            return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.toString().getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }
}
