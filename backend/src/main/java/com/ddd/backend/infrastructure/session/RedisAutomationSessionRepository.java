package com.ddd.backend.infrastructure.session;

import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.domain.session.AutomationSessionRepository;
import com.ddd.backend.domain.session.WorkflowStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Repository
@ConditionalOnProperty(
        prefix = "ddd.session-store",
        name = "type",
        havingValue = "redis"
)
public class RedisAutomationSessionRepository
        implements AutomationSessionRepository {

    private static final String KEY_PREFIX =
            "ddd:automation-session:";

    private static final String FIELD_SESSION_ID =
            "sessionId";

    private static final String FIELD_USER_REQUEST =
            "userRequest";

    private static final String FIELD_STATUS =
            "status";

    private static final String FIELD_CREATED_AT =
            "createdAt";

    private static final String FIELD_UPDATED_AT =
            "updatedAt";

    private static final String FIELD_CURRENT_URL =
            "currentUrl";

    private static final String FIELD_LAST_ACCESSED_AT =
            "lastAccessedAt";

    private final StringRedisTemplate redisTemplate;

    /*
     * D8
     * 세션이 마지막으로 저장된 시점부터 유지되는 시간.
     *
     * 세션 접근 → touch() → save()가 실행되면
     * TTL도 다시 처음부터 갱신된다.
     */
    private final Duration sessionTtl;

    public RedisAutomationSessionRepository(
            StringRedisTemplate redisTemplate,
            @Value("${ddd.session-store.ttl:30m}")
            Duration sessionTtl
    ) {
        this.redisTemplate =
                redisTemplate;

        if (sessionTtl == null
                || sessionTtl.isZero()
                || sessionTtl.isNegative()) {

            throw new IllegalArgumentException(
                    "Redis 세션 TTL은 0보다 커야 합니다."
            );
        }

        this.sessionTtl =
                sessionTtl;
    }

    @Override
    public AutomationSession save(
            AutomationSession session
    ) {
        String key =
                key(
                        session.getSessionId()
                );

        Map<String, String> fields =
                new HashMap<>();

        fields.put(
                FIELD_SESSION_ID,
                session.getSessionId()
        );

        fields.put(
                FIELD_USER_REQUEST,
                session.getUserRequest()
        );

        fields.put(
                FIELD_STATUS,
                session.getStatus().name()
        );

        fields.put(
                FIELD_CREATED_AT,
                session.getCreatedAt().toString()
        );

        fields.put(
                FIELD_UPDATED_AT,
                session.getUpdatedAt().toString()
        );

        fields.put(
                FIELD_LAST_ACCESSED_AT,
                session.getLastAccessedAt().toString()
        );

        if (session.getCurrentUrl() != null) {

            fields.put(
                    FIELD_CURRENT_URL,
                    session.getCurrentUrl()
            );

        } else {

            redisTemplate
                    .opsForHash()
                    .delete(
                            key,
                            FIELD_CURRENT_URL
                    );
        }

        redisTemplate
                .opsForHash()
                .putAll(
                        key,
                        fields
                );

        /*
         * D8 핵심.
         *
         * 최초 생성뿐 아니라 save() 할 때마다
         * TTL을 다시 설정한다.
         *
         * 따라서 세션을 계속 사용하는 동안에는
         * Redis Key가 만료되지 않는다.
         */
        redisTemplate.expire(
                key,
                sessionTtl
        );

        return session;
    }

    @Override
    public Optional<AutomationSession> findById(
            String sessionId
    ) {
        String key =
                key(
                        sessionId
                );

        Map<Object, Object> values =
                redisTemplate
                        .opsForHash()
                        .entries(
                                key
                        );

        if (values == null
                || values.isEmpty()) {

            return Optional.empty();
        }

        String storedSessionId =
                requiredValue(
                        values,
                        FIELD_SESSION_ID
                );

        String userRequest =
                requiredValue(
                        values,
                        FIELD_USER_REQUEST
                );

        WorkflowStatus status =
                WorkflowStatus.valueOf(
                        requiredValue(
                                values,
                                FIELD_STATUS
                        )
                );

        Instant createdAt =
                Instant.parse(
                        requiredValue(
                                values,
                                FIELD_CREATED_AT
                        )
                );

        Instant updatedAt =
                Instant.parse(
                        requiredValue(
                                values,
                                FIELD_UPDATED_AT
                        )
                );

        Instant lastAccessedAt =
                Instant.parse(
                        requiredValue(
                                values,
                                FIELD_LAST_ACCESSED_AT
                        )
                );

        String currentUrl =
                optionalValue(
                        values,
                        FIELD_CURRENT_URL
                );

        return Optional.of(
                AutomationSession.restore(
                        storedSessionId,
                        userRequest,
                        status,
                        createdAt,
                        updatedAt,
                        currentUrl,
                        lastAccessedAt
                )
        );
    }

    private String key(
            String sessionId
    ) {
        if (sessionId == null
                || sessionId.isBlank()) {

            throw new IllegalArgumentException(
                    "세션 ID는 비어 있을 수 없습니다."
            );
        }

        return KEY_PREFIX
                + sessionId.trim();
    }

    private String requiredValue(
            Map<Object, Object> values,
            String field
    ) {
        Object value =
                values.get(
                        field
                );

        if (value == null) {

            throw new IllegalStateException(
                    "Redis 세션 데이터가 올바르지 않습니다. field="
                            + field
            );
        }

        String text =
                value.toString();

        if (text.isBlank()) {

            throw new IllegalStateException(
                    "Redis 세션 데이터가 비어 있습니다. field="
                            + field
            );
        }

        return text;
    }

    private String optionalValue(
            Map<Object, Object> values,
            String field
    ) {
        Object value =
                values.get(
                        field
                );

        if (value == null) {
            return null;
        }

        String text =
                value.toString();

        if (text.isBlank()) {
            return null;
        }

        return text;
    }
}