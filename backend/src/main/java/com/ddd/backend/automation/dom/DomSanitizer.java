package com.ddd.backend.automation.dom;

import com.ddd.backend.security.SensitiveDataMasker;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URISyntaxException;

@Component
public final class DomSanitizer {

    public static final int MAX_TEXT_LENGTH =
            200;

    public String sanitizeText(
            String value
    ) {
        if (value == null) {
            return "";
        }

        String masked =
                SensitiveDataMasker
                        .maskFreeText(
                                value
                        );

        String normalized =
                masked
                        .trim()
                        .replaceAll(
                                "\\s+",
                                " "
                        );

        return truncate(
                normalized
        );
    }

    public String sanitizeNullableText(
            String value
    ) {
        if (value == null
                || value.isBlank()) {

            return null;
        }

        String sanitized =
                sanitizeText(
                        value
                );

        if (sanitized.isBlank()) {
            return null;
        }

        return sanitized;
    }

    /*
     * D15
     *
     * URL에서:
     * - userinfo
     * - query
     * - fragment
     *
     * 제거.
     */
    public String sanitizeUrl(
            String url
    ) {
        if (url == null
                || url.isBlank()) {

            return "";
        }

        try {
            URI uri =
                    URI.create(
                            url
                    );

            if (uri.getHost() != null) {

                URI sanitized =
                        new URI(
                                uri.getScheme(),
                                null,
                                uri.getHost(),
                                uri.getPort(),
                                uri.getPath(),
                                null,
                                null
                        );

                return truncate(
                        sanitized.toString()
                );
            }

        } catch (IllegalArgumentException
                 | URISyntaxException ignored) {

            /*
             * 아래 fallback 적용.
             */
        }

        String sanitized =
                url;

        int queryIndex =
                sanitized.indexOf(
                        '?'
                );

        if (queryIndex >= 0) {
            sanitized =
                    sanitized.substring(
                            0,
                            queryIndex
                    );
        }

        int fragmentIndex =
                sanitized.indexOf(
                        '#'
                );

        if (fragmentIndex >= 0) {
            sanitized =
                    sanitized.substring(
                            0,
                            fragmentIndex
                    );
        }

        return truncate(
                sanitized
        );
    }

    private String truncate(
            String value
    ) {
        if (value.length()
                <= MAX_TEXT_LENGTH) {

            return value;
        }

        return value.substring(
                0,
                MAX_TEXT_LENGTH
        );
    }
}