package com.chatapp.chat_service.conversation.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateMemberRoleRequest {
    @NotBlank(message = "Role is required")
    @Pattern(regexp = "^(admin|moderator|member)$", message = "Role must be: admin, moderator, or member")
    private String role;
}
