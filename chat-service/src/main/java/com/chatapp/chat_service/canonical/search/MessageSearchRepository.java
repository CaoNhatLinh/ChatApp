package com.chatapp.chat_service.canonical.search;

import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;

public interface MessageSearchRepository extends ElasticsearchRepository<MessageSearchDocument, String> {
}
