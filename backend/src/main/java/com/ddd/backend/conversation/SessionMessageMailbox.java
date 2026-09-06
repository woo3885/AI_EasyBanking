package com.ddd.backend.conversation;

import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;

/** 세션별 active 1개 + pending 1개만 허용하는 결정적 mailbox. */
@Component
public final class SessionMessageMailbox {

    private final ConcurrentHashMap<String, Mailbox> mailboxes = new ConcurrentHashMap<>();

    public MessageQueueStatus offer(String sessionId, String messageId) {
        Mailbox mailbox = mailboxes.computeIfAbsent(sessionId, ignored -> new Mailbox());
        synchronized (mailbox) {
            if (mailbox.active == null) {
                mailbox.active = messageId;
                return MessageQueueStatus.ACTIVE;
            }
            if (mailbox.active.equals(messageId) || messageId.equals(mailbox.pending)) {
                return MessageQueueStatus.DUPLICATE;
            }
            if (mailbox.pending == null) {
                mailbox.pending = messageId;
                return MessageQueueStatus.PENDING;
            }
            throw new ConversationException(ConversationError.BUSY);
        }
    }

    public String completeActive(String sessionId, String messageId) {
        Mailbox mailbox = mailboxes.get(sessionId);
        if (mailbox == null) return null;
        synchronized (mailbox) {
            if (!messageId.equals(mailbox.active)) return mailbox.active;
            mailbox.active = mailbox.pending;
            mailbox.pending = null;
            if (mailbox.active == null) mailboxes.remove(sessionId, mailbox);
            return mailbox.active;
        }
    }

    public boolean isActive(String sessionId, String messageId) {
        Mailbox mailbox = mailboxes.get(sessionId);
        if (mailbox == null) return false;
        synchronized (mailbox) {
            return messageId != null && messageId.equals(mailbox.active);
        }
    }

    public void removeSession(String sessionId) {
        if (sessionId != null) mailboxes.remove(sessionId);
    }

    private static final class Mailbox {
        private String active;
        private String pending;
    }
}
