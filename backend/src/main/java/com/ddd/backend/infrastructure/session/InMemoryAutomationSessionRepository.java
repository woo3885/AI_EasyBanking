package com.ddd.backend.infrastructure.session;

import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.domain.session.AutomationSessionRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Repository;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Repository
@ConditionalOnProperty(
        prefix = "ddd.session-store",
        name = "type",
        havingValue = "memory",
        matchIfMissing = true
)
public class InMemoryAutomationSessionRepository
        implements AutomationSessionRepository {

    private final Map<String, AutomationSession> sessions =
            new ConcurrentHashMap<>();

    @Override
    public AutomationSession save(
            AutomationSession session
    ) {
        sessions.put(
                session.getSessionId(),
                session
        );

        return session;
    }

    @Override
    public Optional<AutomationSession> findById(
            String sessionId
    ) {
        return Optional.ofNullable(
                sessions.get(
                        sessionId
                )
        );
    }
}