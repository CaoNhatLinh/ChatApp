package com.chatapp.chat_service.common.mail;

import org.springframework.stereotype.Service;

@Service
public class EmailService {
    public void sendFriendRequestUpdateEmail(String toEmail, String fromUser, String status) {
        System.out.printf("Sending email to %s: Your friend request from %s has been %s%n",
                toEmail, fromUser, status.toLowerCase());
    }
}
