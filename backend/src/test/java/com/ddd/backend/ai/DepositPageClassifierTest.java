package com.ddd.backend.ai;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class DepositPageClassifierTest {

    private final DepositPageClassifier classifier = new DepositPageClassifier();

    @Test
    void D25_예금_화면을_canonical_path로_분류한다() {
        assertEquals(DepositPageClassifier.DepositPage.PRODUCT_LIST,
                classifier.classify("http://127.0.0.1:5190/deposit/products"));
        assertEquals(DepositPageClassifier.DepositPage.PRODUCT_DETAIL,
                classifier.classify("http://127.0.0.1:5190/deposit/products/deposit-12m"));
        assertEquals(DepositPageClassifier.DepositPage.CONDITIONS,
                classifier.classify("http://127.0.0.1:5190/deposit/conditions/deposit-12m"));
        assertEquals(DepositPageClassifier.DepositPage.TERMS,
                classifier.classify("http://127.0.0.1:5190/deposit/terms/deposit-12m"));
        assertEquals(DepositPageClassifier.DepositPage.SECURE_PASSWORD,
                classifier.classify("http://127.0.0.1:5190/deposit/secure/password/deposit-12m"));
    }

    @Test
    void query_fragment_userinfo가_있는_URL은_분류하지_않는다() {
        assertEquals(DepositPageClassifier.DepositPage.UNKNOWN,
                classifier.classify("http://user@127.0.0.1/deposit/products"));
        assertEquals(DepositPageClassifier.DepositPage.UNKNOWN,
                classifier.classify("http://127.0.0.1/deposit/products?next=evil"));
    }
}
