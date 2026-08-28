package com.chatapp.chat_service.canonical.controller;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.service.CanonicalBackendService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/invites")
public class PublicInviteController {
    private final CanonicalBackendService backend;

    public PublicInviteController(CanonicalBackendService backend) {
        this.backend = backend;
    }

    @GetMapping("/{token}")
    public CanonicalApiContracts.InvitePreview preview(@PathVariable String token) {
        return backend.previewInvite(token);
    }
}
