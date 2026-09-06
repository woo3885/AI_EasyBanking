package com.ddd.backend.common.exception;

import com.ddd.backend.common.response.ApiResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log =
            LoggerFactory.getLogger(
                    GlobalExceptionHandler.class
            );

    @ExceptionHandler(com.ddd.backend.conversation.bridge.DemoAgentBridgeAuthenticationException.class)
    public ResponseEntity<ApiResponse<Void>> handleDemoAgentBridgeAuthentication(
            com.ddd.backend.conversation.bridge.DemoAgentBridgeAuthenticationException exception
    ) {
        log.warn("Demo Agent bridge authentication rejected.");
        return ResponseEntity.status(org.springframework.http.HttpStatus.UNAUTHORIZED)
                .body(new ApiResponse<>(false, null, "BRIDGE_401_INVALID_IDENTITY",
                        "Demo Agent bridge 인증에 실패했습니다."));
    }

    @ExceptionHandler(com.ddd.backend.conversation.ConversationException.class)
    public ResponseEntity<ApiResponse<Void>> handleConversation(
            com.ddd.backend.conversation.ConversationException exception
    ) {
        var error = exception.error();
        log.warn("Conversation request rejected. errorCode={}", error.code());
        return ResponseEntity.status(error.status())
                .body(com.ddd.backend.common.response.ConversationErrorResponseFactory.create(error));
    }

    @ExceptionHandler(com.ddd.backend.service.confirmation.ConfirmationException.class)
    public ResponseEntity<ApiResponse<Void>> handleConfirmation(
            com.ddd.backend.service.confirmation.ConfirmationException exception
    ) {
        ErrorCode errorCode = exception.getErrorCode();
        log.warn("Confirmation request rejected. errorCode={}, exceptionType={}",
                errorCode.getCode(), exception.getClass().getSimpleName());
        return ResponseEntity.status(errorCode.getHttpStatus())
                .body(ApiResponse.failure(errorCode));
    }

    @ExceptionHandler(UserDecisionResumeException.class)
    public ResponseEntity<ApiResponse<Void>> handleUserDecisionResume(
            UserDecisionResumeException exception
    ) {
        ErrorCode errorCode = ErrorCode.USER_DECISION_RESUME_FAILED;
        log.warn("User decision resume failed. errorCode={}, exceptionType={}",
                errorCode.getCode(), exception.getClass().getSimpleName());
        return ResponseEntity.status(errorCode.getHttpStatus())
                .body(ApiResponse.failure(errorCode));
    }

    @ExceptionHandler(
            SessionNotFoundException.class
    )
    public ResponseEntity<ApiResponse<Void>>
    handleSessionNotFound(
            SessionNotFoundException exception
    ) {
        ErrorCode errorCode =
                ErrorCode.SESSION_NOT_FOUND;

        log.warn(
                "Application error handled. "
                        + "errorCode={}, exceptionType={}",
                errorCode.getCode(),
                exception
                        .getClass()
                        .getSimpleName()
        );

        return ResponseEntity
                .status(
                        errorCode.getHttpStatus()
                )
                .body(
                        ApiResponse.failure(
                                errorCode
                        )
                );
    }

    @ExceptionHandler(
            BrowserActionRequestException.class
    )
    public ResponseEntity<ApiResponse<Void>>
    handleBrowserActionRequest(
            BrowserActionRequestException exception
    ) {
        ErrorCode errorCode =
                exception.getErrorCode();

        /*
         * requestId / elementId / sessionId는
         * 로그에 남기지 않는다.
         */
        log.warn(
                "Browser Action request rejected. "
                        + "errorCode={}, exceptionType={}",
                errorCode.getCode(),
                exception
                        .getClass()
                        .getSimpleName()
        );

        return ResponseEntity
                .status(
                        errorCode.getHttpStatus()
                )
                .body(
                        ApiResponse.failure(
                                errorCode,
                                exception.getMessage()
                        )
                );
    }

    @ExceptionHandler(
            MethodArgumentNotValidException.class
    )
    public ResponseEntity<ApiResponse<Void>>
    handleValidation(
            MethodArgumentNotValidException exception
    ) {
        if (exception.getParameter().getParameterType().getName().contains("conversation")) {
            var error = com.ddd.backend.conversation.ConversationError.INVALID_REQUEST;
            return ResponseEntity.status(error.status())
                    .body(com.ddd.backend.common.response.ConversationErrorResponseFactory.create(error));
        }
        String message =
                exception
                        .getBindingResult()
                        .getFieldErrors()
                        .stream()
                        .findFirst()
                        .map(
                                error ->
                                        error.getDefaultMessage()
                        )
                        .orElseGet(() -> exception.getBindingResult().getGlobalErrors()
                                .stream()
                                .findFirst()
                                .map(error -> error.getDefaultMessage())
                                .orElse(ErrorCode.INVALID_REQUEST.getMessage()));

        ErrorCode errorCode =
                ErrorCode.INVALID_REQUEST;

        log.warn(
                "Request validation failed. "
                        + "errorCode={}, "
                        + "validationErrorCount={}",
                errorCode.getCode(),
                exception
                        .getBindingResult()
                        .getErrorCount()
        );

        return ResponseEntity
                .status(
                        errorCode.getHttpStatus()
                )
                .body(
                        ApiResponse.failure(
                                errorCode,
                                message
                        )
                );
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> handleUnreadableRequest(
            HttpMessageNotReadableException exception
    ) {
        ErrorCode errorCode = ErrorCode.INVALID_REQUEST;
        log.warn("Request body rejected. errorCode={}, exceptionType={}",
                errorCode.getCode(), exception.getClass().getSimpleName());
        return ResponseEntity.status(errorCode.getHttpStatus())
                .body(ApiResponse.failure(errorCode));
    }

    @ExceptionHandler(
            IllegalArgumentException.class
    )
    public ResponseEntity<ApiResponse<Void>>
    handleIllegalArgument(
            IllegalArgumentException exception
    ) {
        ErrorCode errorCode =
                ErrorCode.INVALID_REQUEST;

        log.warn(
                "Application error handled. "
                        + "errorCode={}, exceptionType={}",
                errorCode.getCode(),
                exception
                        .getClass()
                        .getSimpleName()
        );

        return ResponseEntity
                .status(
                        errorCode.getHttpStatus()
                )
                .body(
                        ApiResponse.failure(
                                errorCode,
                                exception.getMessage()
                        )
                );
    }

    @ExceptionHandler(
            IllegalStateException.class
    )
    public ResponseEntity<ApiResponse<Void>>
    handleIllegalState(
            IllegalStateException exception
    ) {
        ErrorCode errorCode =
                ErrorCode.INVALID_SESSION_STATE;

        log.warn(
                "Application error handled. "
                        + "errorCode={}, exceptionType={}",
                errorCode.getCode(),
                exception
                        .getClass()
                        .getSimpleName()
        );

        return ResponseEntity
                .status(
                        errorCode.getHttpStatus()
                )
                .body(
                        ApiResponse.failure(
                                errorCode,
                                exception.getMessage()
                        )
                );
    }

    @ExceptionHandler(com.ddd.backend.security.secureinput.SecureInputException.class)
    public ResponseEntity<ApiResponse<Void>> handleSecureInput(
            com.ddd.backend.security.secureinput.SecureInputException exception
    ) {
        ErrorCode errorCode = exception.getErrorCode();
        log.warn("Secure input request rejected. errorCode={}, exceptionType={}",
                errorCode.getCode(), exception.getClass().getSimpleName());
        return ResponseEntity.status(errorCode.getHttpStatus())
                .body(ApiResponse.failure(errorCode));
    }

    @ExceptionHandler(
            Exception.class
    )
    public ResponseEntity<ApiResponse<Void>>
    handleUnexpectedException(
            Exception exception
    ) {
        ErrorCode errorCode =
                ErrorCode.INTERNAL_SERVER_ERROR;

        log.error(
                "Unexpected server error. "
                        + "errorCode={}, exceptionType={}",
                errorCode.getCode(),
                exception
                        .getClass()
                        .getSimpleName()
        );

        return ResponseEntity
                .status(
                        errorCode.getHttpStatus()
                )
                .body(
                        ApiResponse.failure(
                                errorCode
                        )
                );
    }
}
