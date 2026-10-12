package com.chatapp.chat_service.canonical.architecture;

import com.chatapp.chat_service.canonical.controller.CanonicalAuthController;
import com.chatapp.chat_service.canonical.controller.CanonicalChatAppearanceController;
import com.chatapp.chat_service.canonical.controller.CanonicalCommunityController;
import com.chatapp.chat_service.canonical.controller.CanonicalDeviceController;
import com.chatapp.chat_service.canonical.controller.CanonicalInviteController;
import com.chatapp.chat_service.canonical.controller.CanonicalMessageController;
import com.chatapp.chat_service.canonical.controller.CanonicalNotificationController;
import com.chatapp.chat_service.canonical.controller.CanonicalPollController;
import com.chatapp.chat_service.canonical.controller.CanonicalUserController;
import com.chatapp.chat_service.canonical.controller.PublicInviteController;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.message.MessageService;
import com.chatapp.chat_service.canonical.service.ConversationService;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.lang.reflect.Field;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CanonicalArchitectureTest {

    @Test
    void extractedControllersDoNotReachIntoCassandraOrStomp() {
        List<Class<?>> controllers = List.of(
                CanonicalAuthController.class,
                CanonicalChatAppearanceController.class,
                CanonicalCommunityController.class,
                CanonicalDeviceController.class,
                CanonicalInviteController.class,
                CanonicalMessageController.class,
                CanonicalNotificationController.class,
                CanonicalPollController.class,
                PublicInviteController.class,
                CanonicalUserController.class);

        List<Class<?>> fieldTypes = controllers.stream()
                .flatMap(controller -> List.of(controller.getDeclaredFields()).stream())
                .map(Field::getType)
                .toList();

        assertThat(fieldTypes)
                .doesNotContain(CanonicalCqlStore.class, SimpMessagingTemplate.class);

        assertThat(List.of(CanonicalMessageController.class.getDeclaredFields()).stream()
                .map(Field::getType))
                .doesNotContain(ConversationService.class);

        assertThat(List.of(MessageService.class.getDeclaredFields()).stream()
                .map(Field::getType))
                .doesNotContain(ConversationService.class);
    }
}
