package com.ddd.backend.ai.engine;

import java.net.URI;

public interface AiEngineHttpTransport {

    String post(
            String requestBody
    );

    default String post(URI endpoint, String requestBody) {
        throw new UnsupportedOperationException("Explicit endpoint is not supported");
    }
}
