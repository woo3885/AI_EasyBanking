package com.ddd.backend.automation.dom;

import com.ddd.backend.automation.session.BrowserSessionManager;
import com.ddd.backend.automation.worker.PlaywrightWorker;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class InteractiveElementMetadataTest {

    private static final String SESSION_ID =
            "interactive-metadata-test-session";

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

    @Test
    void button의_role_visible_enabled_좌표를_추출한다() {

        manager.execute(
                SESSION_ID,
                Duration.ofSeconds(5),
                page -> {

                    page.setContent("""
                            <!doctype html>
                            <html lang="ko">
                            <body>

                                <button
                                    id="confirm"
                                    aria-label="확인 버튼"
                                    style="
                                        position:absolute;
                                        left:100px;
                                        top:120px;
                                        width:150px;
                                        height:50px;
                                    "
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

        InteractiveElement element =
                elements.get(
                        0
                );

        assertThat(
                element.tagName()
        ).isEqualTo(
                "button"
        );

        assertThat(
                element.role()
        ).isEqualTo(
                "button"
        );

        assertThat(
                element.ariaLabel()
        ).isEqualTo(
                "확인 버튼"
        );

        assertThat(
                element.visible()
        ).isTrue();

        assertThat(
                element.enabled()
        ).isTrue();

        assertThat(
                element.hasBoundingBox()
        ).isTrue();

        assertThat(
                element.x()
        ).isCloseTo(
                100.0,
                org.assertj.core.data.Offset.offset(
                        1.0
                )
        );

        assertThat(
                element.y()
        ).isCloseTo(
                120.0,
                org.assertj.core.data.Offset.offset(
                        1.0
                )
        );

        assertThat(
                element.width()
        ).isCloseTo(
                150.0,
                org.assertj.core.data.Offset.offset(
                        1.0
                )
        );

        assertThat(
                element.height()
        ).isCloseTo(
                50.0,
                org.assertj.core.data.Offset.offset(
                        1.0
                )
        );
    }

    @Test
    void disabled_button은_enabled_false로_추출한다() {

        manager.execute(
                SESSION_ID,
                Duration.ofSeconds(5),
                page -> {

                    page.setContent("""
                            <!doctype html>
                            <html lang="ko">
                            <body>

                                <button
                                    id="disabled"
                                    disabled
                                >
                                    비활성
                                </button>

                            </body>
                            </html>
                            """);

                    return null;
                }
        );

        InteractiveElement element =
                extractor.extract(
                                SESSION_ID
                        )
                        .get(
                                0
                        );

        assertThat(
                element.visible()
        ).isTrue();

        assertThat(
                element.enabled()
        ).isFalse();
    }

    @Test
    void display_none_요소는_visible_false이고_좌표가_없다() {

        manager.execute(
                SESSION_ID,
                Duration.ofSeconds(5),
                page -> {

                    page.setContent("""
                            <!doctype html>
                            <html lang="ko">
                            <body>

                                <button
                                    id="hidden"
                                    style="display:none"
                                >
                                    숨김
                                </button>

                            </body>
                            </html>
                            """);

                    return null;
                }
        );

        InteractiveElement element =
                extractor.extract(
                                SESSION_ID
                        )
                        .get(
                                0
                        );

        assertThat(
                element.visible()
        ).isFalse();

        assertThat(
                element.hasBoundingBox()
        ).isFalse();

        assertThat(
                element.x()
        ).isNull();

        assertThat(
                element.y()
        ).isNull();
    }

    @Test
    void input의_type과_semantic_role을_추출한다() {

        manager.execute(
                SESSION_ID,
                Duration.ofSeconds(5),
                page -> {

                    page.setContent("""
                            <!doctype html>
                            <html lang="ko">
                            <body>

                                <input
                                    id="email"
                                    type="email"
                                    aria-label="이메일"
                                />

                                <input
                                    id="agree"
                                    type="checkbox"
                                    aria-label="동의"
                                />

                                <input
                                    id="choice"
                                    type="radio"
                                    aria-label="선택"
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
                3
        );

        assertThat(
                elements.get(0)
                        .inputType()
        ).isEqualTo(
                "email"
        );

        assertThat(
                elements.get(0)
                        .role()
        ).isEqualTo(
                "textbox"
        );

        assertThat(
                elements.get(1)
                        .inputType()
        ).isEqualTo(
                "checkbox"
        );

        assertThat(
                elements.get(1)
                        .role()
        ).isEqualTo(
                "checkbox"
        );

        assertThat(
                elements.get(2)
                        .role()
        ).isEqualTo(
                "radio"
        );
    }

    @Test
    void 명시적_role을_우선한다() {

        manager.execute(
                SESSION_ID,
                Duration.ofSeconds(5),
                page -> {

                    page.setContent("""
                            <!doctype html>
                            <html lang="ko">
                            <body>

                                <div
                                    id="custom"
                                    role="button"
                                    aria-label="직접 지정 버튼"
                                >
                                    실행
                                </div>

                            </body>
                            </html>
                            """);

                    return null;
                }
        );

        InteractiveElement element =
                extractor.extract(
                                SESSION_ID
                        )
                        .get(
                                0
                        );

        assertThat(
                element.role()
        ).isEqualTo(
                "button"
        );

        assertThat(
                element.ariaLabel()
        ).isEqualTo(
                "직접 지정 버튼"
        );
    }

    @Test
    void password_value는_metadata에도_포함하지_않는다() {

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
                                    value="super-secret"
                                    aria-label="비밀번호"
                                />

                            </body>
                            </html>
                            """);

                    return null;
                }
        );

        InteractiveElement element =
                extractor.extract(
                                SESSION_ID
                        )
                        .get(
                                0
                        );

        assertThat(
                element.inputType()
        ).isEqualTo(
                "password"
        );

        assertThat(
                element.text()
        ).isEmpty();

        assertThat(
                element.text()
        ).doesNotContain(
                "super-secret"
        );
    }
}