package com.chatapp.chat_service.canonical.search;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/search/messages")
@ConditionalOnProperty(prefix = "app.integrations.elasticsearch", name = "enabled", havingValue = "true", matchIfMissing = true)
public class MessageSearchController {
    private final MessageSearchService search;
    private final SecurityContextHelper securityContext;

    public MessageSearchController(MessageSearchService search, SecurityContextHelper securityContext) {
        this.search = search;
        this.securityContext = securityContext;
    }

    @PostMapping
    public MessageSearchService.SearchPage search(
            @RequestBody CanonicalApiContracts.MessageSearchRequest request) {
        return search.search(securityContext.getCurrentUserId(), request);
    }
}
