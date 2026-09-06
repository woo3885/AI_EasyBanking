package com.ddd.backend.security.navigation;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DemoNavigationPolicyTest {

    private DemoBankSiteProperties properties;
    private DemoNavigationPolicy policy;

    @BeforeEach
    void setUp() {
        properties =
                new DemoBankSiteProperties();

        properties.setEnabled(true);
        properties.setBaseUrl(
                "http://127.0.0.1:5190"
        );

        policy =
                new DemoNavigationPolicy(
                        properties
                );
    }

    @Test
    void 허용된_데모_경로를_안전한_URL로_변환한다() {
        DemoNavigationTarget target =
                policy.resolve(
                        "demo-bank",
                        "/transfer/accounts"
                );

        assertThat(
                target.siteId()
        ).isEqualTo(
                "demo-bank"
        );

        assertThat(
                target.initialPath()
        ).isEqualTo(
                "/transfer/accounts"
        );

        assertThat(
                target.targetUri().toString()
        ).isEqualTo(
                "http://127.0.0.1:5190/transfer/accounts"
        );
    }

    @Test
    void 예금_상품_경로도_허용한다() {
        DemoNavigationTarget target =
                policy.resolve(
                        "demo-bank",
                        "/deposit/products"
                );

        assertThat(
                target.targetUri().getPath()
        ).isEqualTo(
                "/deposit/products"
        );
    }

    @Test
    void localhost도_개발_데모에서_허용한다() {
        properties.setBaseUrl(
                "http://localhost:5190"
        );

        DemoNavigationTarget target =
                policy.resolve(
                        "demo-bank",
                        "/transfer/accounts"
                );

        assertThat(
                target.targetUri().getHost()
        ).isEqualTo(
                "localhost"
        );
    }

    @Test
    void 데모_사이트가_비활성화되어_있으면_거부한다() {
        properties.setEnabled(false);

        assertThatThrownBy(
                () -> policy.resolve(
                        "demo-bank",
                        "/transfer/accounts"
                )
        )
                .isInstanceOf(
                        IllegalStateException.class
                )
                .hasMessageContaining(
                        "비활성화"
                );
    }

    @Test
    void 알_수_없는_siteId는_거부한다() {
        assertThatThrownBy(
                () -> policy.resolve(
                        "evil-site",
                        "/transfer/accounts"
                )
        )
                .isInstanceOf(
                        IllegalArgumentException.class
                )
                .hasMessageContaining(
                        "siteId"
                );
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "http://evil.example/transfer/accounts",
            "https://evil.example/transfer/accounts",
            "//evil.example/transfer/accounts",
            "/transfer/accounts?token=abc",
            "/transfer/accounts#step2",
            "/transfer/../accounts",
            "/../transfer/accounts",
            "/%2e%2e/transfer/accounts",
            "/transfer/%2faccounts",
            "/transfer\\accounts",
            "/unknown"
    })
    void 위험하거나_허용되지_않은_경로를_거부한다(
            String initialPath
    ) {
        assertThatThrownBy(
                () -> policy.resolve(
                        "demo-bank",
                        initialPath
                )
        )
                .isInstanceOf(
                        IllegalArgumentException.class
                );
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "file:///tmp/demo",
            "javascript:alert(1)",
            "https://example.com",
            "http://10.0.0.1:5190",
            "http://192.168.0.10:5190",
            "http://169.254.169.254",
            "http://user@127.0.0.1:5190",
            "http://127.0.0.1:5190?token=abc",
            "http://127.0.0.1:5190#fragment",
            "http://127.0.0.1:5190/base"
    })
    void 위험한_데모_BASE_URL_설정을_거부한다(
            String baseUrl
    ) {
        properties.setBaseUrl(
                baseUrl
        );

        assertThatThrownBy(
                () -> policy.resolve(
                        "demo-bank",
                        "/transfer/accounts"
                )
        )
                .isInstanceOf(
                        IllegalStateException.class
                );
    }
}