package com.ddd.backend.automation.session;

import com.microsoft.playwright.Page;

@FunctionalInterface
public interface BrowserCommand<T> {

    T execute(Page page) throws Exception;
}