package com.ddd.backend.automation.dom;

public final class ElementResolutionException extends IllegalStateException {
    private final ElementResolutionError error;

    public ElementResolutionException(ElementResolutionError error) {
        super("DOM target를 안전하게 재탐색할 수 없습니다.");
        this.error = error;
    }

    public ElementResolutionError error() {
        return error;
    }
}
