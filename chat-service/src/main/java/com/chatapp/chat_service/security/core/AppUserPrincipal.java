package com.chatapp.chat_service.security.core;

import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.security.Principal;
import java.util.Collection;
import java.util.Collections;
import java.util.UUID;

/**
 * ✅ Unified UserPrincipal for both HTTP & WebSocket
 * - Implements UserDetails (Spring Security standard)
 * - Implements Principal (for WebSocket convertAndSendToUser)
 * - Contains userId for easy access
 * - Immutable and thread-safe
 */
@Getter
public class AppUserPrincipal implements UserDetails, Principal {

    private final UUID userId;
    private final String username;
    private final String password;
    private final Collection<? extends GrantedAuthority> authorities;

    public AppUserPrincipal(UUID userId, String username, String password) {
        this.userId = userId;
        this.username = username;
        this.password = password;
        this.authorities = Collections.singletonList(
                new SimpleGrantedAuthority("ROLE_USER")
        );
    }

    public AppUserPrincipal(UUID userId, String username, String password,
                            Collection<? extends GrantedAuthority> authorities) {
        this.userId = userId;
        this.username = username;
        this.password = password;
        this.authorities = authorities != null ? authorities :
                Collections.singletonList(new SimpleGrantedAuthority("ROLE_USER"));
    }

    @Override
    public String getName() {
        return userId.toString();
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }
}