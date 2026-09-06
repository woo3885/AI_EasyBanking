package com.ddd.backend.service.action;

import org.springframework.stereotype.Component;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Component
public final class BrowserActionRequestRegistry {

    /*
     * sessionId별 처리된 requestId를 보관한다.
     *
     * 같은 requestId로 CLICK이 두 번 실행되는 것을
     * 방지하기 위한 Idempotency Registry다.
     */
    private final ConcurrentMap<String, Set<String>>
            processedRequests =
            new ConcurrentHashMap<>();

    public boolean contains(
            String sessionId,
            String requestId
    ) {
        validateText(
                sessionId,
                "sessionId"
        );

        validateText(
                requestId,
                "requestId"
        );

        Set<String> requestIds =
                processedRequests.get(
                        sessionId
                );

        return requestIds != null
                && requestIds.contains(
                requestId
        );
    }

    /*
     * true:
     * 새 requestId를 정상 예약.
     *
     * false:
     * 이미 존재하는 requestId.
     */
    public boolean reserve(
            String sessionId,
            String requestId
    ) {
        validateText(
                sessionId,
                "sessionId"
        );

        validateText(
                requestId,
                "requestId"
        );

        Set<String> requestIds =
                processedRequests
                        .computeIfAbsent(
                                sessionId,
                                ignored ->
                                        ConcurrentHashMap
                                                .newKeySet()
                        );

        return requestIds.add(
                requestId
        );
    }

    public void removeSession(
            String sessionId
    ) {
        if (sessionId == null
                || sessionId.isBlank()) {

            return;
        }

        processedRequests.remove(
                sessionId
        );
    }

    private void validateText(
            String value,
            String fieldName
    ) {
        if (value == null
                || value.isBlank()) {

            throw new IllegalArgumentException(
                    fieldName
                            + "은 비어 있을 수 없습니다."
            );
        }
    }
}