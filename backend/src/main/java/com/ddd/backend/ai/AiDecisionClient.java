package com.ddd.backend.ai;

public interface AiDecisionClient {

    AiDecisionResponse decide(
            AiDecisionRequest request
    );
}