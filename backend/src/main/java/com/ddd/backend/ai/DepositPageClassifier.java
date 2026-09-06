package com.ddd.backend.ai;

import org.springframework.stereotype.Component;

import java.net.URI;
import java.util.regex.Pattern;

/** URL은 힌트로만 사용하고 DOM 보안 검사는 FrameCaptureGuard와 함께 수행한다. */
@Component
public final class DepositPageClassifier {

    private static final Pattern PRODUCT_DETAIL =
            Pattern.compile("^/deposit/products/[a-zA-Z0-9-]+$");
    private static final Pattern CONDITIONS =
            Pattern.compile("^/deposit/conditions/[a-zA-Z0-9-]+$");
    private static final Pattern TERMS =
            Pattern.compile("^/deposit/terms/[a-zA-Z0-9-]+$");
    private static final Pattern SECURE_PASSWORD =
            Pattern.compile("^/deposit/secure/password/[a-zA-Z0-9-]+$");
    private static final Pattern FINAL_CONFIRMATION =
            Pattern.compile("^/deposit/confirmation/[a-zA-Z0-9-]+$");

    public DepositPage classify(String canonicalUrl) {
        if (canonicalUrl == null || canonicalUrl.isBlank()) {
            return DepositPage.UNKNOWN;
        }
        try {
            URI uri = URI.create(canonicalUrl.trim()).normalize();
            if (!("http".equalsIgnoreCase(uri.getScheme())
                    || "https".equalsIgnoreCase(uri.getScheme()))
                    || uri.getHost() == null
                    || uri.getUserInfo() != null
                    || uri.getQuery() != null
                    || uri.getFragment() != null) {
                return DepositPage.UNKNOWN;
            }
            String path = uri.getPath();
            if ("/deposit/products".equals(path)) return DepositPage.PRODUCT_LIST;
            if (PRODUCT_DETAIL.matcher(path).matches()) return DepositPage.PRODUCT_DETAIL;
            if (CONDITIONS.matcher(path).matches()) return DepositPage.CONDITIONS;
            if (TERMS.matcher(path).matches()) return DepositPage.TERMS;
            if (SECURE_PASSWORD.matcher(path).matches()) return DepositPage.SECURE_PASSWORD;
            if (FINAL_CONFIRMATION.matcher(path).matches()) {
                return DepositPage.FINAL_CONFIRMATION;
            }
            return DepositPage.OTHER;
        } catch (IllegalArgumentException exception) {
            return DepositPage.UNKNOWN;
        }
    }

    public enum DepositPage {
        PRODUCT_LIST, PRODUCT_DETAIL, CONDITIONS, TERMS, SECURE_PASSWORD,
        FINAL_CONFIRMATION, OTHER, UNKNOWN
    }
}
