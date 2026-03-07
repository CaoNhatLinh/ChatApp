package com.chatapp.chat_service.auth.service;

import com.chatapp.chat_service.auth.dto.UpdateProfileRequest;
import com.chatapp.chat_service.auth.dto.UserDTO;
import com.chatapp.chat_service.auth.entity.User;
import com.chatapp.chat_service.auth.repository.UserRepository;
import com.chatapp.chat_service.common.exception.NotFoundException;
import com.chatapp.chat_service.presence.service.PresenceService;

import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class UserService {
    private final UserRepository userRepository;
    private final PresenceService presenceService;

    public UserService(UserRepository userRepository, PresenceService presenceService) {
        this.userRepository = userRepository;
        this.presenceService = presenceService;
    }
    
    public UserDTO updateProfile(UUID userId, UpdateProfileRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));

        if (request.getDisplayName() != null) user.setDisplayName(request.getDisplayName());
        if (request.getAvatarUrl() != null) user.setAvatarUrl(request.getAvatarUrl());
        if (request.getNickname() != null) user.setNickname(request.getNickname());

        User savedUser = userRepository.save(user);
        return toUserDTO(savedUser);
    }
    
    private UserDTO toUserDTO(User user) {
        return UserDTO.builder()
            .userId(user.getUserId())
            .userName(user.getUsername())
            .displayName(user.getDisplayName())
            .avatarUrl(user.getAvatarUrl())
            .build();
    }
    public UserDTO getUserById(UUID userId) {
        return userRepository.findById(userId)
                .map(this::toUserDTO)  
                .orElseThrow(() -> new NotFoundException("User not found"));
    }

    public UserDTO findByUsername(String query) {
        return userRepository.findFirstByUsername(query)
                .map(this::toUserDTO)
                .orElse(null);
    }


    public User save(User user) {
        return userRepository.save(user);
    }
    public Optional<User> findById(UUID userId) {
        return userRepository.findById(userId);
    }

    /**
     * Get user profile DTO.
     * Online status is NOT included here — callers query PresenceService directly when needed.
     */
    public UserDTO getUserProfile(UUID userId) {
        return userRepository.findById(userId)
                .map(this::toUserDTO)
                .orElseGet(() -> UserDTO.builder()
                        .userId(userId)
                        .userName("Unknown User")
                        .displayName("Unknown User")
                        .build());
    }
    
    /**
     * Kiểm tra user có online không
     */
    public boolean isUserOnline(UUID userId) {
        return presenceService.isUserOnline(userId);
    }
    public Map<UUID,UserDTO> getUserDetailsMap(Set<UUID> userIds) {
        List<User> users = userRepository.findAllById(userIds);
        return users.stream()
                .collect(Collectors.toMap(
                        User::getUserId,
                        this::toUserDTO
                ));
    }
}
