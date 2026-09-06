package com.ddd.backend.conversation.navigation;

import org.springframework.stereotype.Component;

import java.net.URI;
import java.util.Set;
import java.util.regex.Pattern;

import static com.ddd.backend.conversation.navigation.BrowserNavigationError.NAVIGATION_ROUTE_MISMATCH;

@Component
public final class BrowserNavigationRoutePolicy {
    private static final Set<String> ALLOWED_ROUTES = Set.of(
            "/deposit/products", "/transfer/accounts");
    private static final Pattern SENSITIVE = Pattern.compile(
            "(?i)(password|passwd|otp|authorization|account(number)?|비밀번호|인증번호|계좌번호)");

    public String requireAllowed(String route) {
        if (route == null || route.isBlank() || route.startsWith("//")
                || route.contains("\\") || route.contains("..")
                || route.contains("?") || route.contains("#") || SENSITIVE.matcher(route).find()) {
            throw new BrowserNavigationException(NAVIGATION_ROUTE_MISMATCH);
        }
        URI uri;
        try { uri = URI.create(route); }
        catch (RuntimeException invalid) { throw new BrowserNavigationException(NAVIGATION_ROUTE_MISMATCH); }
        if (uri.isAbsolute() || uri.getHost() != null || !ALLOWED_ROUTES.contains(uri.getPath())) {
            throw new BrowserNavigationException(NAVIGATION_ROUTE_MISMATCH);
        }
        return uri.getPath();
    }
}
