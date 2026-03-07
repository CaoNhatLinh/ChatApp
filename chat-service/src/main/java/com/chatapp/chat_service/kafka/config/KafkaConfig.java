package com.chatapp.chat_service.kafka.config;

import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.KafkaException;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.*;
import org.springframework.kafka.listener.ContainerProperties;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.kafka.support.serializer.JsonDeserializer;
import org.springframework.kafka.support.serializer.JsonSerializer;
import org.springframework.util.backoff.FixedBackOff;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Kafka Configuration for distributed environment.
 * Supports Persistence (Shared Group) and Broadcast (Unique Group Per Instance) listeners.
 */
@Configuration
public class KafkaConfig {

    @Value("${spring.kafka.bootstrap-servers}")
    private String bootstrapServers;

    @Bean
    public ProducerFactory<String, Object> producerFactory() {
        Map<String, Object> configProps = new HashMap<>();
        configProps.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        configProps.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        configProps.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, JsonSerializer.class);
        configProps.put(JsonSerializer.ADD_TYPE_INFO_HEADERS, true);
        configProps.put(ProducerConfig.ACKS_CONFIG, "all");
        configProps.put(ProducerConfig.RETRIES_CONFIG, 3);
        configProps.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true); 
        return new DefaultKafkaProducerFactory<>(configProps);
    }

    @Bean
    public KafkaTemplate<String, Object> kafkaTemplate() {
        return new KafkaTemplate<>(producerFactory());
    }

    @Bean
    public DefaultErrorHandler commonKafkaErrorHandler() {
        DefaultErrorHandler errorHandler = new DefaultErrorHandler(new FixedBackOff(1000L, 3L));
        errorHandler.setLogLevel(KafkaException.Level.ERROR);
        errorHandler.addNotRetryableExceptions(
                org.springframework.kafka.support.serializer.DeserializationException.class,
                org.apache.kafka.common.errors.RecordDeserializationException.class,
                IllegalArgumentException.class
        );
        return errorHandler;
    }

    private Map<String, Object> consumerProps(String groupId) {
        Map<String, Object> props = new HashMap<>();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ConsumerConfig.GROUP_ID_CONFIG, groupId);
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, JsonDeserializer.class);
        props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false); 
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        return props;
    }

    private <T> ConsumerFactory<String, Object> createConsumerFactory(String groupId) {
        JsonDeserializer<Object> deserializer = new JsonDeserializer<>();
        deserializer.addTrustedPackages("*");
        deserializer.setUseTypeHeaders(true);
        return new DefaultKafkaConsumerFactory<>(consumerProps(groupId), new StringDeserializer(), deserializer);
    }

    private ConcurrentKafkaListenerContainerFactory<String, Object> createListenerFactory(
            ConsumerFactory<String, Object> consumerFactory, DefaultErrorHandler errorHandler) {
        ConcurrentKafkaListenerContainerFactory<String, Object> factory = new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(consumerFactory);
        factory.setCommonErrorHandler(errorHandler);
        factory.getContainerProperties().setAckMode(ContainerProperties.AckMode.MANUAL_IMMEDIATE);
        return factory;
    }


    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, Object> messagePersistenceListenerFactory(DefaultErrorHandler errorHandler) {
        return createListenerFactory(createConsumerFactory("chat-service-msg-persistence"), errorHandler);
    }

    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, Object> friendshipPersistenceListenerFactory(DefaultErrorHandler errorHandler) {
        return createListenerFactory(createConsumerFactory("chat-service-friend-persistence"), errorHandler);
    }


    private String uniqueGroupId(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, Object> messageBroadcastListenerFactory(DefaultErrorHandler errorHandler) {
        return createListenerFactory(createConsumerFactory(uniqueGroupId("chat-service-msg-broadcast")), errorHandler);
    }

    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, Object> friendshipBroadcastListenerFactory(DefaultErrorHandler errorHandler) {
        return createListenerFactory(createConsumerFactory(uniqueGroupId("chat-service-friend-broadcast")), errorHandler);
    }
}