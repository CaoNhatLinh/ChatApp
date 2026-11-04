package com.chatapp.chat_service.canonical.conversation;

import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.Test;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

class ConversationUnreadPolicyTest {
    @Test void staleCountsRestartAfterReadPointerCoversPreviousMessage() {
        UUID first = Uuids.startOf(1000), next = Uuids.startOf(2000);
        assertThat(ConversationUnreadPolicy.onMessage(20, first, next, first, false)).isEqualTo(1);
        assertThat(ConversationUnreadPolicy.onMessage(20, first, next, next, true)).isZero();
    }
    @Test void sendingDoesNotClearUnreadMessagesThatHaveNotBeenRead() {
        UUID first = Uuids.startOf(1000), next = Uuids.startOf(2000), latest = Uuids.startOf(3000);
        assertThat(ConversationUnreadPolicy.onMessage(3, next, latest, first, true)).isEqualTo(3);
        assertThat(ConversationUnreadPolicy.onMessage(3, next, latest, first, false)).isEqualTo(4);
    }
    @Test void delayedProjectionDoesNotCountAMessageAlreadyRead() {
        UUID previous = Uuids.startOf(1000), delayed = Uuids.startOf(2000), read = Uuids.endOf(2000);
        assertThat(ConversationUnreadPolicy.onMessage(4, previous, delayed, delayed, false)).isZero();
        assertThat(ConversationUnreadPolicy.onMessage(4, previous, delayed, read, false)).isZero();
        assertThat(ConversationUnreadPolicy.onMessage(4, null, delayed, read, false)).isZero();
    }
    @Test void coveredDelayedMessageDoesNotClearOtherUnreadMessages() {
        UUID delayed = Uuids.startOf(1000), read = Uuids.startOf(2000), previous = Uuids.startOf(3000);
        assertThat(ConversationUnreadPolicy.onMessage(4, previous, delayed, read, false)).isEqualTo(4);
    }
    @Test void olderReadAcknowledgmentDoesNotCoverANewerProjection() {
        UUID first = Uuids.startOf(1000), next = Uuids.startOf(2000);
        assertThat(ConversationUnreadPolicy.covered(next, first)).isFalse();
        assertThat(ConversationUnreadPolicy.covered(first, next)).isTrue();
        assertThat(ConversationUnreadPolicy.covered(first, null)).isFalse();
    }
}
