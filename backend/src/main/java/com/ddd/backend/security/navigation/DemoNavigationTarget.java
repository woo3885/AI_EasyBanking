package com.ddd.backend.security.navigation;

import java.net.URI;

public record DemoNavigationTarget(
        String siteId,
        String initialPath,
        URI targetUri
) {
}