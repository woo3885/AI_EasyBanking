package com.ddd.backend.security.navigation;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "ddd.demo-bank")
public class DemoBankSiteProperties {

    private boolean enabled = false;

    private String baseUrl =
            "http://127.0.0.1:5190";

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(
            boolean enabled
    ) {
        this.enabled = enabled;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(
            String baseUrl
    ) {
        this.baseUrl = baseUrl;
    }
}