package com.ddd.backend.conversation;

import org.springframework.stereotype.Component;

import java.util.regex.Pattern;

@Component
public final class ConversationMessagePolicy {

    private static final int MAX_CODE_POINTS = 500;
    private static final int MAX_LINES = 5;
    private static final Pattern CONTROL = Pattern.compile("[\\p{Cc}&&[^\\r\\n\\t]]");
    private static final Pattern CREDENTIAL = Pattern.compile(
            "(?i)(password|passwd|비밀번호|otp|인증번호|pin|보안카드)\\s*[:=]?\\s*[0-9A-Za-z!@#$%^&*]{3,}");

    public String sanitize(String rawContent) {
        if (rawContent == null) {
            throw new ConversationException(ConversationError.INVALID_CONTENT);
        }
        String content = rawContent.strip();
        if (content.isEmpty()
                || content.codePointCount(0, content.length()) > MAX_CODE_POINTS
                || lineCount(content) > MAX_LINES
                || CONTROL.matcher(content).find()) {
            throw new ConversationException(ConversationError.INVALID_CONTENT);
        }
        if (CREDENTIAL.matcher(content).find()) {
            throw new ConversationException(ConversationError.SENSITIVE_CONTENT);
        }
        String sanitized = content.replaceAll("[ \\t]+", " ");
        if (sanitized.codePointCount(0, sanitized.length()) > MAX_CODE_POINTS
                || lineCount(sanitized) > MAX_LINES) {
            throw new ConversationException(ConversationError.INVALID_CONTENT);
        }
        return sanitized;
    }

    private int lineCount(String value) {
        return value.split("\\r\\n|\\r|\\n", -1).length;
    }
}
