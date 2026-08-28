package com.chatapp.chat_service.canonical.appauth;

import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.UUID;

@Component
public class AppRoleBootstrap implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(AppRoleBootstrap.class);
    private final String bootstrapUserId;
    private final AppRoleRepository roles;
    private final CanonicalCqlStore users;

    public AppRoleBootstrap(
            @Value("${app.bootstrap.super-admin-user-id:}") String bootstrapUserId,
            AppRoleRepository roles,
            CanonicalCqlStore users) {
        this.bootstrapUserId = bootstrapUserId;
        this.roles = roles;
        this.users = users;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!StringUtils.hasText(bootstrapUserId)) {
            return;
        }
        UUID userId = UUID.fromString(bootstrapUserId.trim());
        if (users.findUserById(userId) == null) {
            throw new IllegalStateException("APP_BOOTSTRAP_SUPER_ADMIN_USER_ID does not reference an existing user");
        }
        if (roles.findRoles(userId).stream().noneMatch(role -> "SUPER_ADMIN".equals(role.roleCode()))) {
            roles.grant(userId, "SUPER_ADMIN", userId, null);
            log.warn("Bootstrapped SUPER_ADMIN for user {}. Clear APP_BOOTSTRAP_SUPER_ADMIN_USER_ID after first use.", userId);
        }
    }
}
