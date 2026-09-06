package com.ddd.backend.conversation.navigation;

import org.springframework.stereotype.Component;

@Component
public final class BrowserSemanticRouteMapper {
    public String toPath(BrowserSemanticRoute route) {
        if (route == null) throw new IllegalArgumentException("semanticRoute는 필수입니다.");
        return switch (route) {
            case DEPOSIT_PRODUCTS -> "/deposit/products";
            case TRANSFER_ACCOUNTS -> "/transfer/accounts";
        };
    }
}
