package com.chatapp.chat_service.canonical.search;

import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.document.Document;
import org.springframework.data.elasticsearch.core.query.UpdateQuery;
import org.springframework.data.elasticsearch.core.query.ScriptType;
import java.util.LinkedHashMap;
import java.util.Map;

/** Spring Data fragment; atomic per-document comparison happens in Elasticsearch. */
public class MessageSearchWriterImpl implements MessageSearchWriter {
    // https://www.elastic.co/docs/reference/elasticsearch/rest-apis/update-document#run-a-scripted-upsert
    static final String SCRIPT = """
            boolean creating = ctx.op == 'create';
            if (!creating && (ctx._source.revision == null || ctx._source.pinRevision == null)) {
                throw new IllegalStateException('Search document requires canonical revision');
            }
            if (creating || (params.snapshot.revision > ctx._source.revision
                && !(ctx._source.isDeleted && !params.snapshot.isDeleted))) {
                ctx._source.putAll(params.snapshot);
            }
            if (creating) { ctx._source.pinRevision = 0; ctx._source.isPinned = false; }
            if (params.pinEvent && params.pinRevision > ctx._source.pinRevision) {
                ctx._source.isPinned = params.pinned;
                ctx._source.pinRevision = params.pinRevision;
            }
            if (ctx._source.isDeleted) {
                ctx._source.content = '';
                ctx._source.hasAttachments = false;
                ctx._source.isPinned = false;
                ctx._source.mentionedUserIds = [];
            } else if (params.mentionsProvided) {
                ctx._source.mentionedUserIds = params.mentions;
            }
            """;
    private final ElasticsearchOperations operations;

    public MessageSearchWriterImpl(ElasticsearchOperations operations) { this.operations = operations; }

    @Override public void upsertSnapshot(MessageSearchDocument snapshot, boolean mentionsProvided, boolean pinEvent) {
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("snapshot", content(snapshot));
        params.put("pinEvent", pinEvent);
        params.put("pinRevision", snapshot.getPinRevision());
        params.put("pinned", snapshot.isPinned());
        params.put("mentionsProvided", mentionsProvided);
        params.put("mentions", snapshot.getMentionedUserIds());
        var query = UpdateQuery.builder(snapshot.getId()).withScriptType(ScriptType.INLINE).withLang("painless").withScript(SCRIPT)
                .withParams(params).withScriptedUpsert(true).withUpsert(Document.create())
                .withRetryOnConflict(3).build();
        operations.update(query, operations.getIndexCoordinatesFor(MessageSearchDocument.class));
    }

    private Map<String, Object> content(MessageSearchDocument snapshot) {
        Map<String, Object> fields = new LinkedHashMap<>();
        fields.put("id", snapshot.getId());
        fields.put("revision", snapshot.getRevision());
        fields.put("messageId", snapshot.getMessageId());
        fields.put("conversationId", snapshot.getConversationId());
        fields.put("messageBucket", snapshot.getMessageBucket());
        fields.put("senderId", snapshot.getSenderId());
        fields.put("replyToSenderId", snapshot.getReplyToSenderId());
        fields.put("messageType", snapshot.getMessageType());
        fields.put("content", snapshot.isDeleted() ? "" : snapshot.getContent());
        fields.put("hasAttachments", !snapshot.isDeleted() && snapshot.isHasAttachments());
        fields.put("isDeleted", snapshot.isDeleted());
        fields.put("createdAt", snapshot.getCreatedAt().toString());
        return fields;
    }
}
