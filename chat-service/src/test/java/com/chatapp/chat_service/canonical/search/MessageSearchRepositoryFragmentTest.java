package com.chatapp.chat_service.canonical.search;

import org.junit.jupiter.api.Test;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.convert.MappingElasticsearchConverter;
import org.springframework.data.elasticsearch.core.mapping.SimpleElasticsearchMappingContext;
import org.springframework.data.elasticsearch.repository.support.ElasticsearchRepositoryFactory;
import org.springframework.data.repository.core.support.RepositoryComposition.RepositoryFragments;
import static org.mockito.Mockito.*;

class MessageSearchRepositoryFragmentTest {
    @Test void actualRepositoryFactoryRoutesProjectionCommandToCustomFragment() {
        var operations = mock(ElasticsearchOperations.class, RETURNS_DEEP_STUBS);
        var converter = new MappingElasticsearchConverter(new SimpleElasticsearchMappingContext());
        converter.afterPropertiesSet();
        when(operations.getElasticsearchConverter()).thenReturn(converter);
        when(operations.indexOps(MessageSearchDocument.class).exists()).thenReturn(true);
        var writer = mock(MessageSearchWriter.class);
        var repository = new ElasticsearchRepositoryFactory(operations).getRepository(
                MessageSearchRepository.class, RepositoryFragments.just(writer));
        var snapshot = MessageSearchWriterTest.snapshot(3, false);
        repository.upsertSnapshot(snapshot, false, false);
        verify(writer).upsertSnapshot(snapshot, false, false);
        verifyNoMoreInteractions(writer);
    }
}
