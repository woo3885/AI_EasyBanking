package com.ddd.backend.ai.engine;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.time.Duration;

@Component
@ConfigurationProperties(prefix = "ddd.ai.engine")
public class AiEngineProperties {

    private boolean enabled = true;

    private String endpoint =
            "http://127.0.0.1:3001/api/ai/action";

    private String conversationEndpoint =
            "http://127.0.0.1:3001/api/ai/conversation/decision";

    private Duration connectTimeout =
            Duration.ofSeconds(3);

    private Duration requestTimeout =
            Duration.ofSeconds(15);

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(
            boolean enabled
    ) {
        this.enabled = enabled;
    }

    public String getEndpoint() {
        return endpoint;
    }

    public void setEndpoint(
            String endpoint
    ) {
        this.endpoint = endpoint;
    }

    public Duration getConnectTimeout() {
        return connectTimeout;
    }

    public void setConnectTimeout(
            Duration connectTimeout
    ) {
        this.connectTimeout = connectTimeout;
    }

    public Duration getRequestTimeout() {
        return requestTimeout;
    }

    public void setRequestTimeout(
            Duration requestTimeout
    ) {
        this.requestTimeout = requestTimeout;
    }

    public URI endpointUri() {

        validate();

        return URI.create(
                endpoint.trim()
        );
    }

    public String getConversationEndpoint() { return conversationEndpoint; }
    public void setConversationEndpoint(String value) { conversationEndpoint = value; }
    public URI conversationEndpointUri() {
        validateUri(conversationEndpoint, "AI Engine conversation endpoint");
        return URI.create(conversationEndpoint.trim());
    }

    public void validate() {

        if (endpoint == null
                || endpoint.isBlank()) {

            throw new IllegalStateException(
                    "AI Engine endpoint가 설정되지 않았습니다."
            );
        }

        URI uri;

        try {
            uri = URI.create(
                    endpoint.trim()
            );

        } catch (IllegalArgumentException exception) {

            throw new IllegalStateException(
                    "AI Engine endpoint 형식이 올바르지 않습니다.",
                    exception
            );
        }

        String scheme =
                uri.getScheme();

        if (!"http".equalsIgnoreCase(scheme)
                && !"https".equalsIgnoreCase(scheme)) {

            throw new IllegalStateException(
                    "AI Engine endpoint는 http 또는 https만 허용됩니다."
            );
        }

        if (uri.getHost() == null
                || uri.getHost().isBlank()) {

            throw new IllegalStateException(
                    "AI Engine endpoint host가 없습니다."
            );
        }

        if (uri.getUserInfo() != null) {

            throw new IllegalStateException(
                    "AI Engine endpoint에 user info를 포함할 수 없습니다."
            );
        }

        if (uri.getQuery() != null
                || uri.getFragment() != null) {

            throw new IllegalStateException(
                    "AI Engine endpoint에는 query 또는 fragment를 포함할 수 없습니다."
            );
        }

        if (connectTimeout == null
                || connectTimeout.isZero()
                || connectTimeout.isNegative()) {

            throw new IllegalStateException(
                    "AI Engine connect timeout이 올바르지 않습니다."
            );
        }

        if (requestTimeout == null
                || requestTimeout.isZero()
                || requestTimeout.isNegative()) {

            throw new IllegalStateException(
                    "AI Engine request timeout이 올바르지 않습니다."
            );
        }
        validateUri(conversationEndpoint, "AI Engine conversation endpoint");
    }

    private void validateUri(String value, String name) {
        if (value == null || value.isBlank()) throw new IllegalStateException(name + " is required");
        URI uri;
        try { uri = URI.create(value.trim()); }
        catch (IllegalArgumentException error) { throw new IllegalStateException(name + " is invalid", error); }
        if (!("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                || uri.getHost() == null || uri.getUserInfo() != null
                || uri.getQuery() != null || uri.getFragment() != null) {
            throw new IllegalStateException(name + " must be a safe HTTP endpoint");
        }
    }
}
