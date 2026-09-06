package com.ddd.backend.automation;

import java.nio.file.Path;

public record BrowserPageResult(
        String title,
        String finalUrl,
        Path screenshotPath
) {
}