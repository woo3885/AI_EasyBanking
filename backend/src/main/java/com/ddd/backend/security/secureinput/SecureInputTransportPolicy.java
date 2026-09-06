package com.ddd.backend.security.secureinput;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

@Component
public final class SecureInputTransportPolicy {
    private final Environment environment;

    public SecureInputTransportPolicy(Environment environment) {
        this.environment = environment;
    }

    public void verify(HttpServletRequest request) {
        if (environment.acceptsProfiles(Profiles.of("prod")) && !request.isSecure()) {
            throw new IllegalStateException("보안 입력 전송 정책을 충족하지 않습니다.");
        }
    }
}
