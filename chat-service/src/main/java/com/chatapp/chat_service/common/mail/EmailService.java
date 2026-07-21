package com.chatapp.chat_service.common.mail;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@ConditionalOnProperty(name = "email.enabled", havingValue = "true", matchIfMissing = false)
public class EmailService {

    private final JavaMailSender mailSender;
    private final String fromEmail;

    public EmailService(JavaMailSender mailSender,
                       @Value("${spring.mail.from:noreply@chatapp.com}") String fromEmail) {
        this.mailSender = mailSender;
        this.fromEmail = fromEmail;
    }

    public void sendFriendRequestUpdateEmail(String toEmail, String fromUser, String status) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromEmail);
            message.setTo(toEmail);
            message.setSubject("Friend Request Update");
            message.setText(String.format("Your friend request from %s has been %s", fromUser, status.toLowerCase()));

            mailSender.send(message);
            log.info("Email sent successfully to {} for friend request from {}", toEmail, fromUser);
        } catch (Exception e) {
            log.error("Failed to send email to {}: {}", toEmail, e.getMessage());
            // Fallback to logging if email sending fails
            log.info("Email notification: {} - Your friend request from {} has been {}", toEmail, fromUser, status.toLowerCase());
        }
    }
}
