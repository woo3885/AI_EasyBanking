package com.ddd.backend.automation;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PlaywrightBrowserServiceTest {

    @TempDir
    Path tempDirectory;

    @Test
    void opensPageAndCapturesScreenshot() throws Exception {
        PlaywrightBrowserService browserService =
                new PlaywrightBrowserService();

        String html = """
                <!doctype html>
                <html lang="ko">
                <head>
                    <meta charset="UTF-8">
                    <title>데어콘 데모 금융사이트</title>
                </head>
                <body>
                    <h1>금융길잡이 AI</h1>
                    <p>Playwright 서비스 연결 테스트</p>
                </body>
                </html>
                """;

        String encodedHtml = Base64.getEncoder().encodeToString(
                html.getBytes(StandardCharsets.UTF_8)
        );

        String testUrl =
                "data:text/html;base64," + encodedHtml;

        Path screenshotPath = tempDirectory.resolve(
                "playwright-service-test.png"
        );

        BrowserPageResult result =
                browserService.openAndCapture(
                        testUrl,
                        screenshotPath
                );

        assertEquals(
                "데어콘 데모 금융사이트",
                result.title()
        );

        assertTrue(
                result.finalUrl().startsWith(
                        "data:text/html;base64,"
                )
        );

        assertEquals(
                screenshotPath
                        .toAbsolutePath()
                        .normalize(),
                result.screenshotPath()
        );

        assertTrue(Files.exists(screenshotPath));
        assertTrue(Files.size(screenshotPath) > 0);
    }
}