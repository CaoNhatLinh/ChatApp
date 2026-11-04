package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.media.MediaAssetRepository;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationMember;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.social.FriendshipRepository;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;

/** Bounded, member-scoped archive traversal. Empty pages can have continuation. */
@Service
public class SharedContentService {
    private static final int SCAN = 20;
    private static final Pattern LINK = Pattern.compile("https?://[^\\s<>\"\\p{Cntrl}]+", Pattern.CASE_INSENSITIVE);
    private final CanonicalCqlStore store;
    private final MessageRepository messages;
    private final MediaAssetRepository assets;
    private final FriendshipRepository friendships;

    public SharedContentService(CanonicalCqlStore store, MessageRepository messages,
                                MediaAssetRepository assets, FriendshipRepository friendships) {
        this.store = store;
        this.messages = messages;
        this.assets = assets;
        this.friendships = friendships;
    }

    public record Item(String id, UUID messageId, String messageBucket, Instant createdAt,
                       String url, String name, String mimeType, Long byteSize, boolean spoiler) { }
    public record Page(List<Item> content, String nextCursor, boolean hasNext) { }
    private record Position(Instant hour, UUID before, String resumeBucket, UUID resumeMessage, UUID afterAttachment) { }

    public Page list(UUID actor, UUID conversation, String kind, String cursor) {
        var member = requireMember(actor, conversation);
        if (kind == null || !Set.of("IMAGES", "FILES", "LINKS").contains(kind))
            throw new BadRequestException("kind must be IMAGES, FILES or LINKS");
        String scope = actor + "/" + conversation + "/" + kind;
        Position position = decode(cursor, scope, kind);
        Page result = readPage(actor, conversation, kind, scope, position);
        if (!result.content().isEmpty()) requireSameMembership(actor, conversation, member.joinedAt());
        return result;
    }

    private Page readPage(UUID actor, UUID conversation, String kind, String scope, Position position) {
        if (position.resumeMessage() != null) {
            CanonicalMessage message = messages.find(conversation, position.resumeBucket(), position.resumeMessage());
            if (visible(actor, message)) return attachments(scope, kind, position, message);
            return page(List.of(), scope, new Position(position.hour(), position.resumeMessage(), null, null, null));
        }
        // At most sixteen shards per hour. Fetch one extra metadata row to detect an older hour.
        var buckets = messages.findBuckets(conversation, position.hour(), 17);
        if (buckets.isEmpty()) return new Page(List.of(), null, false);
        Instant hour = buckets.get(0).bucketHour();
        List<CanonicalMessage> candidates = new ArrayList<>();
        for (var bucket : buckets) {
            if (!bucket.bucketHour().equals(hour)) break;
            candidates.addAll(position.before() == null
                    ? messages.findByBucket(conversation, bucket.value(), SCAN + 1)
                    : messages.findByBucketBefore(conversation, bucket.value(), position.before(), SCAN + 1));
        }
        candidates.sort((a, b) -> MessageOrder.compare(b.messageId(), a.messageId()));
        int count = Math.min(SCAN, candidates.size());
        List<Item> links = new ArrayList<>();
        for (int index = 0; index < count; index++) {
            CanonicalMessage message = candidates.get(index);
            if (!visible(actor, message)) continue;
            if (kind.equals("LINKS")) {
                // Return one message per nonempty page, so link identity/source remain stable.
                links.addAll(links(message));
                if (!links.isEmpty()) return page(links, scope, new Position(hour, message.messageId(), null, null, null));
            } else if (Boolean.TRUE.equals(message.hasAttachments())) {
                return attachments(scope, kind, new Position(hour, null, null, null, null), message);
            }
        }
        if (candidates.size() > SCAN)
            return page(List.of(), scope, new Position(hour, candidates.get(count - 1).messageId(), null, null, null));
        if (buckets.stream().anyMatch(bucket -> bucket.bucketHour().isBefore(hour)))
            return page(List.of(), scope, new Position(hour.minusSeconds(3600), null, null, null, null));
        return new Page(List.of(), null, false);
    }

    private Page attachments(String scope, String kind, Position position, CanonicalMessage message) {
        var refs = messages.findAttachments(message.conversationId(), message.messageBucket(), message.messageId(), position.afterAttachment(), 25);
        List<Item> items = new ArrayList<>();
        for (var ref : refs) {
            var asset = ref.assetId() == null ? null : assets.findById(ref.assetId());
            if (asset == null || asset.deletedAt() != null || !"READY".equals(asset.uploadStatus())
                    || !safeUrl(asset.publicUrl())) continue;
            boolean image = asset.mimeType() != null && asset.mimeType().startsWith("image/");
            if (image != kind.equals("IMAGES")) continue;
            items.add(new Item(ref.attachmentId().toString(), message.messageId(), message.messageBucket(),
                    message.createdAt(), asset.publicUrl(), asset.fileName(), asset.mimeType(), asset.byteSize(), Boolean.TRUE.equals(ref.isSpoiler())));
        }
        Position next = refs.size() == 25
                ? new Position(position.hour(), null, message.messageBucket(), message.messageId(), refs.get(refs.size() - 1).attachmentId())
                : new Position(position.hour(), message.messageId(), null, null, null);
        return page(items, scope, next);
    }

    private boolean visible(UUID actor, CanonicalMessage message) {
        return message != null && !Boolean.TRUE.equals(message.isDeleted())
                && !friendships.isBlocked(actor, message.senderId());
    }

    public CanonicalMessage source(UUID actor, UUID conversation, String bucket, UUID messageId) {
        var member = requireMember(actor, conversation);
        var message = messages.find(conversation, bucket, messageId);
        if (!visible(actor, message)) throw new com.chatapp.chat_service.common.exception.NotFoundException("shared source unavailable");
        var source = PublicMessageView.withPinned(message, messages.findPinState(conversation).contains(bucket, messageId));
        requireSameMembership(actor, conversation, member.joinedAt());
        return source;
    }

    private CanonicalConversationMember requireMember(UUID actor, UUID conversation) {
        var member = actor == null ? null : store.findConversationMember(conversation, actor);
        if (member == null || member.joinedAt() == null) throw new ForbiddenException("not member of conversation");
        return member;
    }

    private void requireSameMembership(UUID actor, UUID conversation, Instant joinedAt) {
        if (!joinedAt.equals(requireMember(actor, conversation).joinedAt())) {
            throw new ForbiddenException("conversation membership changed");
        }
    }

    private List<Item> links(CanonicalMessage message) {
        var matcher = LINK.matcher(Objects.toString(message.content(), ""));
        Set<String> seen = new LinkedHashSet<>();
        List<Item> result = new ArrayList<>();
        while (matcher.find()) {
            String url = matcher.group().replaceAll("[.,;!?)\\]}]+$", "");
            if (!safeUrl(url) || !seen.add(url)) continue;
            result.add(new Item(message.messageId() + ":" + matcher.start(), message.messageId(), message.messageBucket(),
                    message.createdAt(), url, URI.create(url).getHost(), null, null, false));
        }
        return result;
    }

    private static boolean safeUrl(String value) {
        try {
            URI uri = URI.create(value);
            return ("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))
                    && uri.getHost() != null && uri.getUserInfo() == null;
        } catch (RuntimeException exception) { return false; }
    }

    private Page page(List<Item> items, String scope, Position next) {
        String raw = scope + "|" + next.hour() + "|" + value(next.before()) + "|" + value(next.resumeBucket())
                + "|" + value(next.resumeMessage()) + "|" + value(next.afterAttachment());
        return new Page(items, Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8)), true);
    }

    private static String value(Object value) { return value == null ? "" : value.toString(); }
    private Position decode(String cursor, String scope, String kind) {
        if (cursor == null) return new Position(null, null, null, null, null);
        try {
            if (cursor.length() > 1024) throw new IllegalArgumentException();
            String[] parts = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8).split("\\|", -1);
            if (parts.length != 6 || !parts[0].equals(scope)) throw new IllegalArgumentException();
            UUID before = parts[2].isEmpty() ? null : UUID.fromString(parts[2]);
            UUID resume = parts[4].isEmpty() ? null : UUID.fromString(parts[4]);
            UUID after = parts[5].isEmpty() ? null : UUID.fromString(parts[5]);
            if (before != null && before.version() != 1 || resume != null && resume.version() != 1) throw new IllegalArgumentException();
            if (resume == null) {
                if (!parts[3].isEmpty() || after != null) throw new IllegalArgumentException();
            } else if ("LINKS".equals(kind) || before != null || after == null
                    || !parts[3].matches("\\d{4}-\\d{2}-\\d{2}-\\d{2}:\\d{2}")) {
                throw new IllegalArgumentException();
            }
            return new Position(Instant.parse(parts[1]), before, parts[3], resume, after);
        } catch (RuntimeException exception) { throw new BadRequestException("invalid shared content cursor"); }
    }
}
