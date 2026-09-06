package com.ddd.backend.api.dto.session;

import jakarta.validation.constraints.NotBlank;

import java.time.Instant;

public record CreateSessionRequest(

        String userRequest,

        @NotBlank(message = "siteId는 비어 있을 수 없습니다.")
        String siteId,

        @NotBlank(message = "initialPath는 비어 있을 수 없습니다.")
        String initialPath,

        String requestId,

        String messageId,

        String content,

        Instant clientOccurredAt

) {

        /*
         * 기존 단위 테스트 코드 호환용 생성자.
         *
         * 실제 REST API에서는 Jackson이 canonical constructor를
         * 사용하므로 siteId / initialPath가 누락되면
         * @NotBlank 검증에서 거부된다.
         */
        public CreateSessionRequest(
                String userRequest
        ) {
                this(userRequest, "demo-bank", "/transfer/accounts",
                        null, null, null, null);
        }

        public CreateSessionRequest(String userRequest, String siteId, String initialPath) {
                this(userRequest, siteId, initialPath, null, null, null, null);
        }

        public boolean usesConversationContract() {
                return requestId != null || messageId != null || content != null;
        }

        public String resolvedContent() {
                return content != null ? content : userRequest;
        }

        @jakarta.validation.constraints.AssertTrue(
                message = "사용자 요청은 비어 있을 수 없습니다.")
        public boolean isMessageContractValid() {
                if (!usesConversationContract()) {
                        return userRequest != null && !userRequest.isBlank();
                }
                return requestId != null && !requestId.isBlank()
                        && messageId != null && !messageId.isBlank()
                        && content != null && !content.isBlank();
        }
}
