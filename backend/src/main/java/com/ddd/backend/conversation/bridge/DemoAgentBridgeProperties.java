package com.ddd.backend.conversation.bridge;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.LinkedHashSet;
import java.util.Set;

@Component
@ConfigurationProperties(prefix = "ddd.demo-agent-bridge")
public class DemoAgentBridgeProperties {
    private boolean enabled;
    private boolean headedEnabled;
    private Duration ttl = Duration.ofMinutes(30);
    private Set<String> allowedOrigins = new LinkedHashSet<>(Set.of("http://127.0.0.1:5190"));

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public boolean isHeadedEnabled() { return headedEnabled; }
    public void setHeadedEnabled(boolean headedEnabled) { this.headedEnabled = headedEnabled; }
    public Duration getTtl() { return ttl; }
    public void setTtl(Duration ttl) { this.ttl = ttl; }
    public Set<String> getAllowedOrigins() { return Set.copyOf(allowedOrigins); }
    public void setAllowedOrigins(Set<String> allowedOrigins) {
        this.allowedOrigins = allowedOrigins == null ? new LinkedHashSet<>() : new LinkedHashSet<>(allowedOrigins);
    }
}
