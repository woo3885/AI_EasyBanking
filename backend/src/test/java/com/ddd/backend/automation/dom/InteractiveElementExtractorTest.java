package com.ddd.backend.automation.dom;

import com.ddd.backend.automation.session.BrowserSessionManager;
import com.ddd.backend.automation.worker.PlaywrightWorker;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class InteractiveElementExtractorTest {

    private static final String SESSION_ID =
            "interactive-element-test-session";

    private PlaywrightWorker worker;

    private BrowserSessionManager manager;

    private InteractiveElementExtractor extractor;

    @BeforeEach
    void setUp() {
        worker =
                new PlaywrightWorker();

        manager =
                new BrowserSessionManager(
                        worker
                );

        extractor =
                new InteractiveElementExtractor(
                        manager
                );

        manager.createSession(
                SESSION_ID
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
     * D13 핵심.
     *
     * 조작 가능한 요소만 후보로 추출한다.
     */
    @Test
    void interactive_element만_추출한다() {

        manager.execute(
                SESSION_ID,
                Duration.ofSeconds(5),
                page -> {

                    page.setContent("""
                            <!doctype html>
                            <html lang="ko">
                            <body>

                                <button id="confirm">
                                    확인
                                </button>

                                <a
                                    id="next"
                                    href="/next"
                                >
                                    다음
                                </a>

                                <input
                                    id="name"
                                    type="text"
                                />

                                <input
                                    id="hidden-value"
                                    type="hidden"
                                    value="secret"
                                />

                                <select id="product">
                                    <option value="deposit">
                                        예금
                                    </option>
                                </select>

                                <textarea id="memo"></textarea>

                                <div
                                    id="custom-button"
                                    role="button"
                                >
                                    커스텀 버튼
                                </div>

                                <div
                                    id="editable"
                                    contenteditable="true"
                                >
                                    편집 가능
                                </div>

                                <div id="normal-text">
                                    일반 텍스트
                                </div>

                            </body>
                            </html>
                            """);

                    return null;
                }
        );

        List<InteractiveElement> elements =
                extractor.extract(
                        SESSION_ID
                );

        /*
         * button
         * a
         * text input
         * select
         * textarea
         * role=button
         * contenteditable
         *
         * 총 7개.
         *
         * hidden input과 일반 div는 제외.
         */
        assertThat(
                elements
        ).hasSize(
                7
        );

        assertThat(
                elements
        )
                .extracting(
                        InteractiveElement::tagName
                )
                .containsExactly(
                        "button",
                        "a",
                        "input",
                        "select",
                        "textarea",
                        "div",
                        "div"
                );

        assertThat(
                elements
        )
                .extracting(
                        InteractiveElement::text
                )
                .contains(
                        "확인",
                        "다음",
                        "커스텀 버튼",
                        "편집 가능"
                );
    }

    @Test
    void agent_widget과_overlay_하위_DOM은_snapshot_후보에서_제외한다() {
        manager.execute(SESSION_ID, Duration.ofSeconds(5), page -> {
            page.setContent("""
                    <main>
                      <button id="site-action">예금 상품 선택</button>
                    </main>
                    <aside data-ddd-agent-ui="chat">
                      <button id="agent-send">요청 전송</button>
                      <input id="agent-message" aria-label="AI 요청" />
                      <div data-ddd-agent-ui="overlay">
                        <button id="overlay-proxy">여기를 누르세요</button>
                      </div>
                    </aside>
                    """);
            return null;
        });

        List<InteractiveElement> elements = extractor.extract(SESSION_ID);

        assertThat(elements).hasSize(1);
        assertThat(elements.getFirst().domId()).isEqualTo("site-action");
        assertThat(elements)
                .extracting(InteractiveElement::text)
                .doesNotContain("요청 전송", "여기를 누르세요");
    }

    /*
     * 하나의 element가
     * button이면서 role=button이더라도
     * 중복 추출되면 안 된다.
     */
    @Test
    void 여러_조건에_동시에_해당해도_요소를_중복_추출하지_않는다() {

        manager.execute(
                SESSION_ID,
                Duration.ofSeconds(5),
                page -> {

                    page.setContent("""
                            <!doctype html>
                            <html lang="ko">
                            <body>

                                <button
                                    id="button"
                                    role="button"
                                >
                                    확인
                                </button>

                            </body>
                            </html>
                            """);

                    return null;
                }
        );

        List<InteractiveElement> elements =
                extractor.extract(
                        SESSION_ID
                );

        assertThat(
                elements
        ).hasSize(
                1
        );

        assertThat(
                elements.get(0)
                        .tagName()
        ).isEqualTo(
                "button"
        );

        assertThat(
                elements.get(0)
                        .text()
        ).isEqualTo(
                "확인"
        );
    }

    /*
     * 일반 div/span/p는
     * Action 후보가 아니다.
     */
    @Test
    void 일반_표시요소는_추출하지_않는다() {

        manager.execute(
                SESSION_ID,
                Duration.ofSeconds(5),
                page -> {

                    page.setContent("""
                            <!doctype html>
                            <html lang="ko">
                            <body>

                                <div>
                                    일반 DIV
                                </div>

                                <span>
                                    일반 SPAN
                                </span>

                                <p>
                                    일반 문단
                                </p>

                            </body>
                            </html>
                            """);

                    return null;
                }
        );

        List<InteractiveElement> elements =
                extractor.extract(
                        SESSION_ID
                );

        assertThat(
                elements
        ).isEmpty();
    }

    /*
     * password도 interactive 후보 자체에는 포함된다.
     *
     * 그러나 값은 절대 추출하지 않는다.
     *
     * 이후 D15에서 secure input 요소는
     * AI 전달 대상에서 더 강하게 제거/마스킹한다.
     */
    @Test
    void password_input의_value는_추출하지_않는다() {

        manager.execute(
                SESSION_ID,
                Duration.ofSeconds(5),
                page -> {

                    page.setContent("""
                            <!doctype html>
                            <html lang="ko">
                            <body>

                                <input
                                    id="password"
                                    type="password"
                                    value="super-secret-password"
                                />

                            </body>
                            </html>
                            """);

                    return null;
                }
        );

        List<InteractiveElement> elements =
                extractor.extract(
                        SESSION_ID
                );

        assertThat(
                elements
        ).hasSize(
                1
        );

        InteractiveElement element =
                elements.get(
                        0
                );

        assertThat(
                element.tagName()
        ).isEqualTo(
                "input"
        );

        assertThat(
                element.text()
        )
                .doesNotContain(
                        "super-secret-password"
                )
                .isEmpty();
    }

    @Test
    void index는_DOM_순서대로_0부터_부여한다() {

        manager.execute(
                SESSION_ID,
                Duration.ofSeconds(5),
                page -> {

                    page.setContent("""
                            <!doctype html>
                            <html lang="ko">
                            <body>

                                <button>
                                    첫 번째
                                </button>

                                <a href="/next">
                                    두 번째
                                </a>

                                <input type="text" />

                            </body>
                            </html>
                            """);

                    return null;
                }
        );

        List<InteractiveElement> elements =
                extractor.extract(
                        SESSION_ID
                );

        assertThat(
                elements
        )
                .extracting(
                        InteractiveElement::index
                )
                .containsExactly(
                        0,
                        1,
                        2
                );
    }

    @Test
    void checkbox와_aria_checkbox의_checked_상태를_추출한다() {
        manager.execute(SESSION_ID, Duration.ofSeconds(5), page -> {
            page.setContent("""
                    <input id="required" type="checkbox" checked>
                    <input id="optional" type="checkbox">
                    <div id="custom" role="checkbox" aria-checked="true">custom</div>
                    """);
            return null;
        });

        List<InteractiveElement> elements = extractor.extract(SESSION_ID);

        assertThat(elements).extracting(InteractiveElement::checked)
                .containsExactly(true, false, true);
    }
}
