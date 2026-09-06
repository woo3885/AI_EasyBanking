package com.ddd.backend.automation.dom;

import com.microsoft.playwright.Locator;
import org.springframework.stereotype.Component;

import java.util.Objects;

/** Snapshot 등록과 locator 재탐색이 공유하는 DOM 의미 추출기. */
@Component
public final class ElementFingerprintExtractor {
    public String semanticText(Locator element) {
        Objects.requireNonNull(element, "Element locator는 필수입니다.");
        Object value = element.evaluate(
                """
                element => {
                  const tag = element.tagName.toLowerCase();
                  if (tag === 'button') {
                    const container = element.closest('article');
                    const heading = container?.querySelector('h1, h2, h3');
                    if (heading?.innerText?.trim()) return heading.innerText;
                  }
                  if (element.textContent?.trim()) return element.textContent;
                  const direct = element.closest('label');
                  if (direct?.innerText?.trim()) return direct.innerText;
                  const id = element.getAttribute('id');
                  if (!id) return null;
                  const label = Array.from(document.querySelectorAll('label'))
                    .find(candidate => candidate.htmlFor === id);
                  return label?.innerText ?? null;
                }
                """);
        return value instanceof String text ? text : null;
    }
}
