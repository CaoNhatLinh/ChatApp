package com.chatapp.chat_service.common.config;

import com.cloudinary.Cloudinary;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;

class CloudinaryConfigTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(CloudinaryConfig.class);

    @Test
    void doesNotCreateClientWhenDisabled() {
        contextRunner
                .withPropertyValues("app.integrations.cloudinary.enabled=false")
                .run(context -> assertThat(context).doesNotHaveBean(Cloudinary.class));
    }

    @Test
    void createsSecureClientWhenEnabledAndConfigured() {
        contextRunner
                .withPropertyValues(
                        "app.integrations.cloudinary.enabled=true",
                        "cloudinary.cloud-name=test-cloud",
                        "cloudinary.api-key=test-key",
                        "cloudinary.api-secret=test-secret",
                        "cloudinary.secure=true")
                .run(context -> {
                    assertThat(context).hasSingleBean(Cloudinary.class);
                    assertThat(context.getBean(Cloudinary.class).config.secure).isTrue();
                });
    }

    @Test
    void failsFastWhenEnabledWithoutCredentials() {
        contextRunner
                .withPropertyValues("app.integrations.cloudinary.enabled=true")
                .run(context -> assertThat(context).hasFailed());
    }
}
