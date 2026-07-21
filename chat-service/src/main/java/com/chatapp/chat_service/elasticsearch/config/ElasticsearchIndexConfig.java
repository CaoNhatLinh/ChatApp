package com.chatapp.chat_service.elasticsearch.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.elasticsearch.client.ClientConfiguration;
import org.springframework.data.elasticsearch.client.elc.ElasticsearchConfiguration;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.convert.ElasticsearchCustomConversions;
import org.springframework.data.elasticsearch.repository.config.EnableElasticsearchRepositories;

import java.util.List;

@Configuration
@ConditionalOnProperty(name = "elasticsearch.enabled", havingValue = "true")
@EnableElasticsearchRepositories(basePackages = "com.chatapp.chat_service.elasticsearch.repository")
public class ElasticsearchIndexConfig extends ElasticsearchConfiguration {

    @Value("${elasticsearch.host:localhost}")
    private String elasticsearchHost;

    @Value("${elasticsearch.port:9200}")
    private int elasticsearchPort;

    @Override
    public ClientConfiguration clientConfiguration() {
        return ClientConfiguration.builder()
                .connectedTo(elasticsearchHost + ":" + elasticsearchPort)
                .withConnectTimeout(java.time.Duration.ofSeconds(5))
                .withSocketTimeout(java.time.Duration.ofSeconds(30))
                .build();
    }

    @Override
    public ElasticsearchCustomConversions elasticsearchCustomConversions() {
        return new ElasticsearchCustomConversions(List.of(
            new UUIDConverter(),
            new InstantConverter()
        ));
    }
}
