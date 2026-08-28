package com.chatapp.chat_service.canonical.appauth;

import com.chatapp.chat_service.common.exception.ForbiddenException;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class AppAuthorizationService {
    private final AppRoleRepository roles;

    public AppAuthorizationService(AppRoleRepository roles) {
        this.roles = roles;
    }

    public Set<AppPermission> permissions(UUID userId) {
        EnumSet<AppPermission> permissions = EnumSet.noneOf(AppPermission.class);
        for (var grant : roles.findRoles(userId)) {
            if ("SUPER_ADMIN".equals(grant.roleCode())) {
                return EnumSet.allOf(AppPermission.class);
            }
            permissions.addAll(roles.findPermissions(grant.roleCode()));
        }
        return permissions;
    }

    public void require(UUID userId, AppPermission permission) {
        if (!permissions(userId).contains(permission)) {
            throw new ForbiddenException("missing app permission: " + permission);
        }
    }

    public List<GrantedAuthority> authorities(UUID userId) {
        List<GrantedAuthority> authorities = new ArrayList<>();
        authorities.add(new SimpleGrantedAuthority("ROLE_USER"));
        for (var role : roles.findRoles(userId)) {
            authorities.add(new SimpleGrantedAuthority("ROLE_" + role.roleCode()));
        }
        permissions(userId).stream()
                .map(permission -> new SimpleGrantedAuthority(permission.name()))
                .forEach(authorities::add);
        return List.copyOf(authorities);
    }
}
