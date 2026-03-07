package com.chatapp.chat_service.auth.service;

import com.chatapp.chat_service.auth.entity.User;
import com.chatapp.chat_service.auth.repository.UserRepository;
import com.chatapp.chat_service.security.core.AppUserPrincipal;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

/**
 * ✅ Clean UserDetailsService Implementation
 * - Load user by username
 * - Convert to AppUserPrincipal
 * - Used by both HTTP & Authentication Manager
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userRepository.findFirstByUsername(username)
                .orElseThrow(() -> {
                    log.warn("⚠️ User not found: {}", username);
                    return new UsernameNotFoundException("User not found: " + username);
                });

        log.debug("✅ Loaded user: {}", username);

        return new AppUserPrincipal(
                user.getUserId(),
                user.getUsername(),
                user.getPassword()
        );
    }
}