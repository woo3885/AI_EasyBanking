package com.ddd.backend.security.secureinput;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SecureInputTransportPolicyTest {
    @Test
    void production은_HTTPS_secure_request만_허용한다() {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("prod");
        SecureInputTransportPolicy policy = new SecureInputTransportPolicy(environment);
        MockHttpServletRequest http = new MockHttpServletRequest();

        assertThatThrownBy(() -> policy.verify(http))
                .isInstanceOf(IllegalStateException.class);

        http.setSecure(true);
        assertThatCode(() -> policy.verify(http)).doesNotThrowAnyException();
    }

    @Test
    void local개발은_HTTP를_허용한다() {
        SecureInputTransportPolicy policy = new SecureInputTransportPolicy(
                new MockEnvironment());
        assertThatCode(() -> policy.verify(new MockHttpServletRequest()))
                .doesNotThrowAnyException();
    }
}
