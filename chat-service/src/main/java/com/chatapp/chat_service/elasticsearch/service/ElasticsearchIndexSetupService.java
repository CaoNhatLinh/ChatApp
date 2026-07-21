package com.chatapp.chat_service.elasticsearch.service;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._types.analysis.Analyzer;
import co.elastic.clients.elasticsearch._types.analysis.CustomAnalyzer;
import co.elastic.clients.elasticsearch._types.analysis.Tokenizer;
import co.elastic.clients.elasticsearch.indices.CreateIndexRequest;
import co.elastic.clients.elasticsearch.indices.ExistsIndexRequest;
import co.elastic.clients.elasticsearch.indices.PutIndexSettingsRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;

@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "elasticsearch.enabled", havingValue = "true")
public class ElasticsearchIndexSetupService {

    private final ElasticsearchClient elasticsearchClient;

    @PostConstruct
    public void setupVietnameseAnalyzer() {
        try {
            setupVietnameseAnalyzerForIndex("messages");
            setupVietnameseAnalyzerForIndex("conversations");
            log.info("Vietnamese analyzer setup completed successfully");
        } catch (Exception e) {
            log.error("Failed to setup Vietnamese analyzer: {}", e.getMessage());
        }
    }

    private void setupVietnameseAnalyzerForIndex(String indexName) {
        try {
            // Check if index exists
            ExistsIndexRequest existsRequest = ExistsIndexRequest.of(e -> e.index(indexName));
            boolean exists = elasticsearchClient.indices().exists(existsRequest).value();

            if (!exists) {
                // Create index with Vietnamese analyzer
                CreateIndexRequest createRequest = CreateIndexRequest.of(c -> c
                        .index(indexName)
                        .settings(s -> s
                                .analysis(a -> a
                                        .analyzer("vietnamese_analyzer", CustomAnalyzer.of(ca -> ca
                                                .tokenizer("standard")
                                                .filter("lowercase", "stop", "vietnamese_stem")
                                        ))
                                        .tokenizer("standard", t -> t
                                                .type("standard")
                                        )
                                        .filter("vietnamese_stem", f -> f
                                                .type("stemmer")
                                                .language("vietnamese")
                                        )
                                )
                        )
                );

                elasticsearchClient.indices().create(createRequest);
                log.info("Created index {} with Vietnamese analyzer", indexName);
            } else {
                log.info("Index {} already exists, skipping creation", indexName);
            }
        } catch (Exception e) {
            log.error("Failed to setup Vietnamese analyzer for index {}: {}", indexName, e.getMessage());
        }
    }
}
