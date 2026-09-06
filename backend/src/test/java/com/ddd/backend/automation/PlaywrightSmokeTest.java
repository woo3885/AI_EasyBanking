package com.ddd.backend.automation;

import com.microsoft.playwright.Browser;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PlaywrightSmokeTest {

    @Test
    void chromiumLaunchesAndCapturesScreenshot() throws Exception {
        Path screenshotPath = Paths.get(
                "build",
                "playwright",
                "smoke-test.png"
        );

        Files.createDirectories(screenshotPath.getParent());

        try (Playwright playwright = Playwright.create()) {
            Browser browser = playwright.chromium().launch();

            try {
                Page page = browser.newPage();

                page.setContent("""
                        <!doctype html>
                        <html lang="ko">
                        <head>
                            <meta charset="UTF-8">
                            <title>데어콘 Playwright 테스트</title>
                        </head>
                        <body>
                            <h1>Playwright 연결 성공</h1>
                        </body>
                        </html>
                        """);

                assertEquals(
                        "데어콘 Playwright 테스트",
                        page.title()
                );

                page.screenshot(
                        new Page.ScreenshotOptions()
                                .setPath(screenshotPath)
                                .setFullPage(true)
                );
            } finally {
                browser.close();
            }
        }

        assertTrue(Files.exists(screenshotPath));
        assertTrue(Files.size(screenshotPath) > 0);
    }
}