package com.ddd.backend.automation;

import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.options.WaitUntilState;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

@Service
public class PlaywrightBrowserService {

    public BrowserPageResult openAndCapture(
            String url,
            Path screenshotPath
    ) throws IOException {

        if (url == null || url.isBlank()) {
            throw new IllegalArgumentException(
                    "접속할 URL은 비어 있을 수 없습니다."
            );
        }

        if (screenshotPath == null) {
            throw new IllegalArgumentException(
                    "스크린샷 저장 경로는 필수입니다."
            );
        }

        Path parentPath = screenshotPath.getParent();

        if (parentPath != null) {
            Files.createDirectories(parentPath);
        }

        try (Playwright playwright = Playwright.create()) {
            Browser browser = playwright.chromium().launch(
                    new BrowserType.LaunchOptions()
                            .setHeadless(true)
            );

            BrowserContext context = browser.newContext();

            try {
                Page page = context.newPage();

                page.navigate(
                        url,
                        new Page.NavigateOptions()
                                .setWaitUntil(
                                        WaitUntilState.DOMCONTENTLOADED
                                )
                );

                page.screenshot(
                        new Page.ScreenshotOptions()
                                .setPath(screenshotPath)
                                .setFullPage(true)
                );

                return new BrowserPageResult(
                        page.title(),
                        page.url(),
                        screenshotPath
                                .toAbsolutePath()
                                .normalize()
                );
            } finally {
                context.close();
                browser.close();
            }
        }
    }
}