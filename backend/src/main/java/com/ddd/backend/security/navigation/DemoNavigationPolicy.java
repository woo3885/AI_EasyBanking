package com.ddd.backend.security.navigation;

import org.springframework.stereotype.Component;

import java.net.URI;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

@Component
public class DemoNavigationPolicy {

    public static final String DEMO_BANK_SITE_ID =
            "demo-bank";

    private static final int MAX_PATH_LENGTH =
            200;

    private static final Set<String> ALLOWED_PATHS =
            Set.of(
                    "/",
                    "/deposit/products",
                    "/transfer/accounts"
            );

    /*
     * 개발용 Demo Bank에 한해서만 허용하는
     * loopback host.
     *
     * 사용자가 직접 host를 보내는 구조가 아니라
     * 서버의 DEMO_BANK_BASE_URL 설정값만 검증한다.
     */
    private static final Set<String> ALLOWED_DEMO_HOSTS =
            Set.of(
                    "127.0.0.1",
                    "localhost"
            );

    /*
     * 경로 traversal 및 encoded slash/backslash 방지.
     *
     * %2e = .
     * %2f = /
     * %5c = \
     */
    private static final Pattern DANGEROUS_ENCODING =
            Pattern.compile(
                    "%(?:2e|2f|5c)",
                    Pattern.CASE_INSENSITIVE
            );

    private final DemoBankSiteProperties properties;

    public DemoNavigationPolicy(
            DemoBankSiteProperties properties
    ) {
        this.properties =
                Objects.requireNonNull(
                        properties,
                        "DemoBankSiteProperties는 필수입니다."
                );
    }

    /*
     * 클라이언트가 전달한 siteId + initialPath를 검증하고
     * 서버 설정에 있는 base URL과 조합하여
     * 실제 탐색 대상 URL을 만든다.
     */
    public DemoNavigationTarget resolve(
            String siteId,
            String initialPath
    ) {
        validateSiteId(
                siteId
        );

        ensureDemoSiteEnabled();

        String safePath =
                validateInitialPath(
                        initialPath
                );

        URI baseUri =
                validateBaseUri();

        URI targetUri =
                baseUri.resolve(
                        safePath
                );

        validateResolvedTarget(
                baseUri,
                targetUri
        );

        return new DemoNavigationTarget(
                DEMO_BANK_SITE_ID,
                safePath,
                targetUri
        );
    }

    /*
     * D17에서 Page.navigate()를 수행한 뒤
     * 실제 도착 URL을 다시 검증한다.
     *
     * navigation 중 redirect가 발생해서
     * 다른 host/path로 빠지는 상황도 차단한다.
     */
    public void validateNavigatedTarget(
            DemoNavigationTarget expectedTarget,
            String actualUrl
    ) {
        Objects.requireNonNull(
                expectedTarget,
                "예상 탐색 대상은 필수입니다."
        );

        if (actualUrl == null
                || actualUrl.isBlank()) {

            throw new IllegalStateException(
                    "탐색 완료 URL을 확인할 수 없습니다."
            );
        }

        final URI actualUri;

        try {
            actualUri =
                    URI.create(
                            actualUrl.trim()
                    );

        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException(
                    "탐색 완료 URL 형식이 올바르지 않습니다."
            );
        }

        URI expectedUri =
                expectedTarget.targetUri();

        /*
         * protocol 변경 금지.
         */
        if (!equalsIgnoreCase(
                expectedUri.getScheme(),
                actualUri.getScheme()
        )) {
            throw new IllegalStateException(
                    "탐색 중 protocol이 변경되었습니다."
            );
        }

        /*
         * host 변경 금지.
         */
        if (!equalsIgnoreCase(
                expectedUri.getHost(),
                actualUri.getHost()
        )) {
            throw new IllegalStateException(
                    "탐색 중 host가 변경되었습니다."
            );
        }

        /*
         * port 변경 금지.
         */
        if (expectedUri.getPort()
                != actualUri.getPort()) {

            throw new IllegalStateException(
                    "탐색 중 port가 변경되었습니다."
            );
        }

        /*
         * D17 시작 화면에서는 요청한 경로와
         * 실제 도착 경로가 정확히 같아야 한다.
         *
         * 같은 Demo Bank 내 다른 페이지로 redirect되더라도
         * 세션 시작 계약상 허용하지 않는다.
         */
        if (!Objects.equals(
                expectedUri.getPath(),
                actualUri.getPath()
        )) {
            throw new IllegalStateException(
                    "탐색 중 path가 변경되었습니다."
            );
        }

        /*
         * query / fragment / userinfo는
         * 세션 시작 URL에서 허용하지 않는다.
         */
        if (actualUri.getUserInfo() != null
                || actualUri.getQuery() != null
                || actualUri.getFragment() != null) {

            throw new IllegalStateException(
                    "탐색 완료 URL이 보안 정책을 위반했습니다."
            );
        }

        /*
         * 최종 경로도 서버 allowlist에 존재해야 한다.
         */
        if (!ALLOWED_PATHS.contains(
                actualUri.getPath()
        )) {
            throw new IllegalStateException(
                    "탐색 완료 경로가 허용 목록에 없습니다."
            );
        }
    }

    public boolean isAllowedPath(
            String initialPath
    ) {
        return initialPath != null
                && ALLOWED_PATHS.contains(
                initialPath
        );
    }

    private void validateSiteId(
            String siteId
    ) {
        if (siteId == null
                || siteId.isBlank()) {

            throw new IllegalArgumentException(
                    "siteId는 필수입니다."
            );
        }

        if (!DEMO_BANK_SITE_ID.equals(
                siteId.trim()
        )) {
            throw new IllegalArgumentException(
                    "허용되지 않은 siteId입니다."
            );
        }
    }

    private void ensureDemoSiteEnabled() {
        if (!properties.isEnabled()) {
            throw new IllegalStateException(
                    "개발용 데모 사이트가 "
                            + "비활성화되어 있습니다."
            );
        }
    }

    private String validateInitialPath(
            String initialPath
    ) {
        if (initialPath == null
                || initialPath.isBlank()) {

            throw new IllegalArgumentException(
                    "initialPath는 필수입니다."
            );
        }

        String path =
                initialPath.trim();

        if (path.length()
                > MAX_PATH_LENGTH) {

            throw new IllegalArgumentException(
                    "initialPath가 너무 깁니다."
            );
        }

        /*
         * 클라이언트는 URL 전체를 보낼 수 없다.
         *
         * 허용:
         * /transfer/accounts
         *
         * 차단:
         * http://evil.example
         * https://evil.example
         * //evil.example
         */
        if (!path.startsWith("/")
                || path.startsWith("//")) {

            throw new IllegalArgumentException(
                    "허용되지 않은 initialPath입니다."
            );
        }

        /*
         * 세션 시작 경로에는
         * query와 fragment를 허용하지 않는다.
         */
        if (path.contains("?")
                || path.contains("#")) {

            throw new IllegalArgumentException(
                    "initialPath에 query 또는 "
                            + "fragment를 사용할 수 없습니다."
            );
        }

        /*
         * Windows 스타일 경로 및
         * backslash 기반 우회 차단.
         */
        if (path.contains("\\")) {
            throw new IllegalArgumentException(
                    "initialPath에 backslash를 "
                            + "사용할 수 없습니다."
            );
        }

        String lowerPath =
                path.toLowerCase(
                        Locale.ROOT
                );

        /*
         * ../
         * %2e
         * %2f
         * %5c
         *
         * 형태의 traversal / encoding 우회 차단.
         */
        if (lowerPath.contains("..")
                || DANGEROUS_ENCODING
                .matcher(lowerPath)
                .find()) {

            throw new IllegalArgumentException(
                    "경로 traversal은 허용되지 않습니다."
            );
        }

        /*
         * 서버가 알고 있는 정확한 경로만 허용.
         */
        if (!ALLOWED_PATHS.contains(
                path
        )) {
            throw new IllegalArgumentException(
                    "허용되지 않은 데모 경로입니다."
            );
        }

        return path;
    }

    private URI validateBaseUri() {
        String configuredBaseUrl =
                properties.getBaseUrl();

        if (configuredBaseUrl == null
                || configuredBaseUrl.isBlank()) {

            throw new IllegalStateException(
                    "DEMO_BANK_BASE_URL 설정이 "
                            + "비어 있습니다."
            );
        }

        final URI baseUri;

        try {
            baseUri =
                    URI.create(
                            configuredBaseUrl.trim()
                    );

        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException(
                    "DEMO_BANK_BASE_URL 형식이 "
                            + "올바르지 않습니다."
            );
        }

        String scheme =
                baseUri.getScheme();

        if (scheme == null
                || (!scheme.equalsIgnoreCase("http")
                && !scheme.equalsIgnoreCase("https"))) {

            throw new IllegalStateException(
                    "데모 사이트는 http 또는 https만 "
                            + "사용할 수 있습니다."
            );
        }

        /*
         * 설정 URL에도 userinfo/query/fragment를
         * 허용하지 않는다.
         */
        if (baseUri.getUserInfo() != null
                || baseUri.getQuery() != null
                || baseUri.getFragment() != null) {

            throw new IllegalStateException(
                    "DEMO_BANK_BASE_URL에 "
                            + "userinfo, query, fragment를 "
                            + "사용할 수 없습니다."
            );
        }

        String host =
                baseUri.getHost();

        /*
         * D17 개발 Demo Bank는
         * loopback에서만 실행한다.
         */
        if (host == null
                || !ALLOWED_DEMO_HOSTS.contains(
                host.toLowerCase(
                        Locale.ROOT
                )
        )) {

            throw new IllegalStateException(
                    "개발용 데모 사이트는 "
                            + "127.0.0.1 또는 localhost만 "
                            + "사용할 수 있습니다."
            );
        }

        /*
         * base URL 자체에는 별도 path를 넣지 않는다.
         *
         * 예:
         * 허용: http://127.0.0.1:5190
         * 차단: http://127.0.0.1:5190/demo
         */
        String path =
                baseUri.getPath();

        if (path != null
                && !path.isBlank()
                && !"/".equals(path)) {

            throw new IllegalStateException(
                    "DEMO_BANK_BASE_URL에는 "
                            + "경로를 포함할 수 없습니다."
            );
        }

        return baseUri;
    }

    /*
     * resolve 직후에도 server-side URL 조합 결과를
     * 다시 검증한다.
     */
    private void validateResolvedTarget(
            URI baseUri,
            URI targetUri
    ) {
        if (!equalsIgnoreCase(
                baseUri.getScheme(),
                targetUri.getScheme()
        )) {
            throw new IllegalStateException(
                    "탐색 대상 protocol이 변경되었습니다."
            );
        }

        if (!equalsIgnoreCase(
                baseUri.getHost(),
                targetUri.getHost()
        )) {
            throw new IllegalStateException(
                    "탐색 대상 host가 변경되었습니다."
            );
        }

        if (baseUri.getPort()
                != targetUri.getPort()) {

            throw new IllegalStateException(
                    "탐색 대상 port가 변경되었습니다."
            );
        }

        if (!ALLOWED_PATHS.contains(
                targetUri.getPath()
        )) {
            throw new IllegalStateException(
                    "최종 탐색 경로가 "
                            + "허용 목록과 일치하지 않습니다."
            );
        }

        if (targetUri.getQuery() != null
                || targetUri.getFragment() != null
                || targetUri.getUserInfo() != null) {

            throw new IllegalStateException(
                    "최종 탐색 URL이 "
                            + "보안 정책을 위반했습니다."
            );
        }
    }

    private boolean equalsIgnoreCase(
            String left,
            String right
    ) {
        return left != null
                && right != null
                && left.equalsIgnoreCase(
                right
        );
    }
}