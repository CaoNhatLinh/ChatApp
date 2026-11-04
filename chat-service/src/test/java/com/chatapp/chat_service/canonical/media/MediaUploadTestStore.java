package com.chatapp.chat_service.canonical.media;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Controlled repository outcomes, not an emulator of Cassandra isolation. */
final class MediaUploadTestStore {
    final Map<UUID, MediaAsset> states = new ConcurrentHashMap<>();
    final Map<UUID, MediaUploadReceipt> receipts = new ConcurrentHashMap<>();

    MediaUploadTestStore(MediaAssetRepository assets) {
        when(assets.claimUpload(any())).thenAnswer(call -> {
            MediaAsset intent = call.getArgument(0);
            return states.putIfAbsent(intent.assetId(), intent) == null;
        });
        when(assets.findById(any())).thenAnswer(call -> states.get(call.getArgument(0)));
        when(assets.completeUpload(any())).thenAnswer(call -> {
            MediaUploadReceipt receipt = call.getArgument(0);
            synchronized (states) {
                MediaAsset current = states.get(receipt.asset().assetId());
                if (current == null || !"PENDING".equals(current.uploadStatus())) return false;
                receipts.put(receipt.asset().assetId(), receipt);
                states.put(receipt.asset().assetId(), receipt.asset());
                return true;
            }
        });
        when(assets.findUploadReceipt(any())).thenAnswer(call -> receipts.get(call.getArgument(0)));
    }
}
