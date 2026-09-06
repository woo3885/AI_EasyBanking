package com.ddd.backend.ai.engine;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AiEnginePropertiesTest {

    @Test
    void 기본_AI_Engine_endpoint는_C의_3001_API다() {

        AiEngineProperties properties =
                new AiEngineProperties();

        assertThat(
                properties.endpointUri()
                        .toString()
        ).isEqualTo(
                "http://127.0.0.1:3001/api/ai/action"
        );
    }

    @Test
    void http_https_외의_endpoint는_거부한다() {

        AiEngineProperties properties =
                new AiEngineProperties();

        properties.setEndpoint(
                "file:///tmp/test"
        );

        assertThatThrownBy(
                properties::validate
        )
                .isInstanceOf(
                        IllegalStateException.class
                );
    }

    @Test
    void userInfo가_있는_endpoint는_거부한다() {

        AiEngineProperties properties =
                new AiEngineProperties();

        properties.setEndpoint(
                "http://user:password@127.0.0.1:3001/api/ai/action"
        );

        assertThatThrownBy(
                properties::validate
        )
                .isInstanceOf(
                        IllegalStateException.class
                );
    }
}