package com.chatapp.chat_service.canonical.auth;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.auth.FirebaseAuth;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.Assert;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

@Configuration
public class FirebaseAuthConfiguration {

    @Bean(destroyMethod = "delete")
    @ConditionalOnProperty(name = "app.auth.google.enabled", havingValue = "true")
    FirebaseApp firebaseApp(
            @Value("${app.auth.firebase.project-id:}") String projectId,
            @Value("${app.auth.firebase.allow-emulator:false}") boolean allowEmulator,
            @Value("${app.auth.firebase.credentials-path:}") String credentialsPath) throws IOException {
        Assert.hasText(projectId, "app.auth.firebase.project-id is required when Google auth is enabled");
        String emulatorHost = System.getenv("FIREBASE_AUTH_EMULATOR_HOST");
        Assert.state(emulatorHost == null || emulatorHost.isBlank() || allowEmulator,
                "FIREBASE_AUTH_EMULATOR_HOST requires app.auth.firebase.allow-emulator=true");
        FirebaseOptions options = FirebaseOptions.builder()
                .setCredentials(loadCredentials(credentialsPath))
                .setProjectId(projectId.trim())
                .build();
        return FirebaseApp.initializeApp(options, "noi-google-auth");
    }

    private GoogleCredentials loadCredentials(String credentialsPath) throws IOException {
        if (!StringUtils.hasText(credentialsPath)) {
            return GoogleCredentials.getApplicationDefault();
        }
        try (InputStream input = Files.newInputStream(Path.of(credentialsPath.trim()))) {
            return GoogleCredentials.fromStream(input);
        }
    }

    @Bean
    @ConditionalOnProperty(name = "app.auth.google.enabled", havingValue = "true")
    FirebaseAuth firebaseAuth(FirebaseApp firebaseApp) {
        return FirebaseAuth.getInstance(firebaseApp);
    }

    @Bean
    @ConditionalOnMissingBean(GoogleIdentityVerifier.class)
    GoogleIdentityVerifier disabledGoogleIdentityVerifier() {
        return new DisabledGoogleIdentityVerifier();
    }
}
