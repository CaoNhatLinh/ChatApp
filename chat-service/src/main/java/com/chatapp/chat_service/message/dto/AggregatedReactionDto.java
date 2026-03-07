package com.chatapp.chat_service.message.dto;

import com.chatapp.chat_service.auth.dto.UserDTO;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AggregatedReactionDto {
    private String emoji;
    private long count;
    private List<UserDTO> latestUsers;
    private boolean reactedByCurrentUser;
}