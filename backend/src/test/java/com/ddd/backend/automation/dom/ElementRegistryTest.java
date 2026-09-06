package com.ddd.backend.automation.dom;

import com.ddd.backend.automation.BrowserActionPolicyContextResolver;
import com.ddd.backend.automation.session.BrowserSessionManager;
import com.ddd.backend.automation.worker.PlaywrightWorker;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ElementRegistryTest {

    private static final String SESSION_ID =
            "element-registry-test-session";

    private static final String OTHER_SESSION_ID =
            "element-registry-other-session";

    private PlaywrightWorker worker;

    private BrowserSessionManager manager;

    private ElementRegistry registry;

    private ElementLocatorResolver locatorResolver;

    private SanitizedDomSnapshotService snapshotService;

    @BeforeEach
    void setUp() {
        worker =
                new PlaywrightWorker();

        manager =
                new BrowserSessionManager(
                        worker
                );

        DomSanitizer sanitizer =
                new DomSanitizer();

        registry =
                new ElementRegistry(
                        sanitizer
                );

        InteractiveElementExtractor extractor =
                new InteractiveElementExtractor(
                        manager
                );

        BrowserActionPolicyContextResolver policyResolver =
                new BrowserActionPolicyContextResolver(
                        manager
                );

        snapshotService =
                new SanitizedDomSnapshotService(
                        manager,
                        extractor,
                        policyResolver,
                        sanitizer,
                        registry
                );

        locatorResolver =
                new ElementLocatorResolver(
                        manager,
                        registry
                );

        manager.createSession(
                SESSION_ID
        );

        manager.createSession(
                OTHER_SESSION_ID
        );
    }

    @AfterEach
    void tearDown() {
        if (manager != null) {
            manager.close();
        }

        if (worker != null) {
            worker.close();
        }
    }

    /*
     * D16 핵심.
     *
     * Snapshot 뒤 DOM Element 객체 자체가 교체되어도
     * 같은 fingerprint라면 새 Locator를 다시 찾아
     * 정상 실행할 수 있어야 한다.
     */
    @Test
    void elementId로_DOM이_재생성된_요소를_다시찾는다() {

        manager.execute(
                SESSION_ID,
                Duration.ofSeconds(5),
                page -> {

                    page.setContent("""
                            <!doctype html>
                            <html lang="ko">
                            <body>

                                <button
                                    id="btn-next"
                                    aria-label="다음 단계"
                                    onclick="
                                        document
                                            .querySelector('#status')
                                            .textContent='완료'
                                    "
                                >
                                    다음
                                </button>

                                <div id="status">
                                    실행 전
                                </div>

                            </body>
                            </html>
                            """);

                    return null;
                }
        );

        SanitizedDomSnapshot snapshot =
                snapshotService.createSnapshot(
                        SESSION_ID
                );

        String elementId =
                snapshot.elements()
                        .get(
                                0
                        )
                        .elementId();

        /*
         * 기존 button 객체를 제거하고
         * 동일한 의미의 새 button 객체를 생성.
         *
         * 예전 Locator 객체를 저장했다면
         * 여기서 문제가 생길 수 있지만,
         * Registry는 현재 DOM을 다시 검색한다.
         */
        manager.execute(
                SESSION_ID,
                Duration.ofSeconds(5),
                page -> {

                    page.evaluate(
                            """
                            () => {
                                const oldButton =
                                    document.querySelector(
                                        '#btn-next'
                                    );

                                const newButton =
                                    document.createElement(
                                        'button'
                                    );

                                newButton.id =
                                    'btn-next';

                                newButton.setAttribute(
                                    'aria-label',
                                    '다음 단계'
                                );

                                newButton.textContent =
                                    '다음';

                                newButton.onclick =
                                    () => {
                                        document
                                            .querySelector(
                                                '#status'
                                            )
                                            .textContent =
                                                '완료';
                                    };

                                oldButton.replaceWith(
                                    newButton
                                );
                            }
                            """
                    );

                    return null;
                }
        );

        locatorResolver.withLocator(
                SESSION_ID,
                elementId,
                locator -> {

                    locator.click();

                    return null;
                }
        );

        String status =
                manager.execute(
                        SESSION_ID,
                        Duration.ofSeconds(5),
                        page ->
                                page.locator(
                                                "#status"
                                        )
                                        .innerText()
                                        .trim()
                );

        assertThat(
                status
        ).isEqualTo(
                "완료"
        );
    }

    /*
     * 새 Snapshot이 생성되면
     * 이전 elementId는 즉시 stale.
     */
    @Test
    void 이전_Snapshot의_elementId는_차단한다() {

        manager.execute(
                SESSION_ID,
                Duration.ofSeconds(5),
                page -> {

                    page.setContent("""
                            <button id="btn">
                                다음
                            </button>
                            """);

                    return null;
                }
        );

        SanitizedDomSnapshot firstSnapshot =
                snapshotService.createSnapshot(
                        SESSION_ID
                );

        String oldElementId =
                firstSnapshot.elements()
                        .get(
                                0
                        )
                        .elementId();

        /*
         * 최신 Snapshot으로 교체.
         */
        snapshotService.createSnapshot(
                SESSION_ID
        );

        assertThatThrownBy(
                () ->
                        locatorResolver.withLocator(
                                SESSION_ID,
                                oldElementId,
                                locator -> null
                        )
        )
                .isInstanceOf(
                        IllegalStateException.class
                );
    }

    /*
     * 현재 Snapshot token을 흉내 내도
     * 등록되지 않은 ID는 사용할 수 없다.
     */
    @Test
    void 위조된_elementId는_차단한다() {

        manager.execute(
                SESSION_ID,
                Duration.ofSeconds(5),
                page -> {

                    page.setContent("""
                            <button id="btn">
                                다음
                            </button>
                            """);

                    return null;
                }
        );

        SanitizedDomSnapshot snapshot =
                snapshotService.createSnapshot(
                        SESSION_ID
                );

        String token =
                snapshot.snapshotId()
                        .substring(
                                "snap-".length()
                        );

        String fakeElementId =
                "el-"
                        + token
                        + "-999";

        assertThatThrownBy(
                () ->
                        locatorResolver.withLocator(
                                SESSION_ID,
                                fakeElementId,
                                locator -> null
                        )
        )
                .isInstanceOf(
                        IllegalStateException.class
                );
    }

    /*
     * 같은 id를 그대로 재사용했더라도
     * 버튼의 의미가 달라졌으면
     * Snapshot의 Element와 동일하다고 보면 안 된다.
     */
    @Test
    void 같은_DOM_id라도_내용이_바뀌면_차단한다() {

        manager.execute(
                SESSION_ID,
                Duration.ofSeconds(5),
                page -> {

                    page.setContent("""
                            <button id="btn-action">
                                다음
                            </button>
                            """);

                    return null;
                }
        );

        SanitizedDomSnapshot snapshot =
                snapshotService.createSnapshot(
                        SESSION_ID
                );

        String elementId =
                snapshot.elements()
                        .get(
                                0
                        )
                        .elementId();

        manager.execute(
                SESSION_ID,
                Duration.ofSeconds(5),
                page -> {

                    page.locator(
                            "#btn-action"
                    ).evaluate(
                            """
                            element => {
                                element.textContent =
                                    '송금하기';

                                element.setAttribute(
                                    'data-ddd-policy',
                                    'final-confirmation'
                                );
                            }
                            """
                    );

                    return null;
                }
        );

        assertThatThrownBy(
                () ->
                        locatorResolver.withLocator(
                                SESSION_ID,
                                elementId,
                                locator -> null
                        )
        )
                .isInstanceOf(
                        IllegalStateException.class
                );
    }

    /*
     * 다른 세션의 elementId를 재사용할 수 없다.
     */
    @Test
    void 다른_세션에서_elementId를_재사용할_수_없다() {

        manager.execute(
                SESSION_ID,
                Duration.ofSeconds(5),
                page -> {

                    page.setContent("""
                            <button id="btn">
                                확인
                            </button>
                            """);

                    return null;
                }
        );

        SanitizedDomSnapshot snapshot =
                snapshotService.createSnapshot(
                        SESSION_ID
                );

        String elementId =
                snapshot.elements()
                        .get(
                                0
                        )
                        .elementId();

        manager.execute(
                OTHER_SESSION_ID,
                Duration.ofSeconds(5),
                page -> {

                    page.setContent("""
                            <button id="btn">
                                확인
                            </button>
                            """);

                    return null;
                }
        );

        assertThatThrownBy(
                () ->
                        locatorResolver.withLocator(
                                OTHER_SESSION_ID,
                                elementId,
                                locator -> null
                        )
        )
                .isInstanceOf(
                        IllegalStateException.class
                );
    }

    @Test
    void Registry에서_세션을_삭제할_수_있다() {

        manager.execute(
                SESSION_ID,
                Duration.ofSeconds(5),
                page -> {

                    page.setContent("""
                            <button>
                                확인
                            </button>
                            """);

                    return null;
                }
        );

        snapshotService.createSnapshot(
                SESSION_ID
        );

        assertThat(
                registry.containsSession(
                        SESSION_ID
                )
        ).isTrue();

        registry.removeSession(
                SESSION_ID
        );

        assertThat(
                registry.containsSession(
                        SESSION_ID
                )
        ).isFalse();
    }
}