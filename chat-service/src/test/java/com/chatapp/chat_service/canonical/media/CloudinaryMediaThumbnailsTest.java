package com.chatapp.chat_service.canonical.media;

import com.chatapp.chat_service.common.exception.*;
import com.cloudinary.Cloudinary;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import java.time.Instant;
import java.util.*;
import static com.chatapp.chat_service.canonical.media.MediaThumbnail.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CloudinaryMediaThumbnailsTest {
    final Cloudinary cloudinary = mock(Cloudinary.class, withSettings().useConstructor(Map.of("cloud_name", "test")).defaultAnswer(RETURNS_DEEP_STUBS));
    final MediaAssetRepository assets = mock(MediaAssetRepository.class);
    final CloudinaryMediaService service = new CloudinaryMediaService(cloudinary, assets,
            mock(MediaUploadRecoveryRepository.class), mock(MediaDeletionRecoveryRepository.class),
            mock(MediaOrphanRepository.class));
    final MediaUploadTestStore store = new MediaUploadTestStore(assets);
    final UUID actor = UUID.randomUUID(), assetId = UUID.randomUUID();

    @Test void uploadRequestsSynchronousEagerAndPublishesOnlyProviderConfirmedSmallUrl() throws Exception {
        when(cloudinary.uploader().upload(any(byte[].class), anyMap())).thenAnswer(call -> {
            Map<?, ?> options = call.getArgument(1);
            assertThat(options.get("resource_type")).isEqualTo("image");
            assertThat(options.get("eager_async")).isEqualTo(false);
            var sdk = new Cloudinary(Map.of("cloud_name", "fixture"));
            assertThat(sdk.uploader().buildUploadParams(options).get("eager"))
                    .isEqualTo(String.join("|", CloudinaryThumbnailPolicy.transformations()));
            return response(List.of(CloudinaryThumbnailPolicyTest.ready(Variant.LARGE),
                    CloudinaryThumbnailPolicyTest.ready(Variant.SMALL), CloudinaryThumbnailPolicyTest.ready(Variant.MEDIUM)), options);
        });
        var upload = service.upload(actor, image());
        assertThat(upload.thumbnailUrl()).isEqualTo("https://res.cloudinary.com/test/image/upload/SMALL/" + upload.storageKey() + ".png");
        assertThat(upload.thumbnails()).allMatch(row -> row.status() == Status.READY);
        verify(assets).completeUpload(argThat(receipt -> receipt.asset().assetId().equals(upload.assetId()) && receipt.asset().uploadStatus().equals("READY")));
        verify(cloudinary, never()).url();
    }

    @Test void missingEagerDoesNotManufactureUrlOrLoseOriginalUpload() throws Exception {
        when(cloudinary.uploader().upload(any(byte[].class), anyMap())).thenAnswer(call -> response(null, call.getArgument(1)));
        var upload = service.upload(actor, image());
        assertThat(upload.url()).endsWith(upload.storageKey() + ".png");
        assertThat(upload.thumbnailUrl()).isNull();
        assertThat(upload.thumbnails()).hasSize(3).allMatch(row -> row.status() == Status.UNAVAILABLE && row.url() == null);
        verify(assets).repairUploadThumbnails(argThat(receipt -> receipt.thumbnails().equals(upload.thumbnails())));
    }

    @Test void partialFailureIsPersistedWithoutClaimingSmallThumbnailSuccess() throws Exception {
        when(cloudinary.uploader().upload(any(byte[].class), anyMap())).thenAnswer(call -> response(List.of(
                Map.of("transformation", CloudinaryThumbnailPolicy.transformation(Variant.SMALL), "state", "failed"),
                CloudinaryThumbnailPolicyTest.ready(Variant.LARGE)), call.getArgument(1)));
        var upload = service.upload(actor, image());
        assertThat(upload.thumbnailUrl()).isNull();
        assertThat(upload.thumbnails()).extracting(MediaThumbnail::status).containsExactly(Status.FAILED, Status.UNAVAILABLE, Status.READY);
        verify(assets).repairUploadThumbnails(argThat(receipt -> receipt.thumbnails().equals(upload.thumbnails())));
    }

    @Test void invalidOriginalProviderMetadataCannotBecomeAReadyAsset() throws Exception {
        var uploader = cloudinary.uploader();
        for (String field : List.of("public_id", "secure_url", "resource_type", "width", "height", "duration")) {
            doAnswer(call -> {
                var response = response(null, call.getArgument(1));
                response.put(field, field.equals("secure_url") ? "javascript:alert(1)" : "invalid");
                return response;
            }).when(uploader).upload(any(byte[].class), anyMap());
            assertThatThrownBy(() -> service.upload(actor, image())).isInstanceOf(IllegalStateException.class);
        }
        verify(assets, never()).completeUpload(any());
    }

    @Test void rawUploadNeverRequestsImageDerivativesAndMatchesDeletionResourceType() throws Exception {
        when(cloudinary.uploader().upload(any(byte[].class), anyMap())).thenAnswer(call -> {
            Map<?, ?> options = call.getArgument(1);
            assertThat(options.get("resource_type")).isEqualTo("raw");
            assertThat((String) options.get("public_id")).endsWith(".pdf");
            assertThat(options.containsKey("eager")).isFalse();
            return Map.of("public_id", options.get("public_id"), "secure_url", "https://res.cloudinary.com/test/raw/upload/" + options.get("public_id"), "resource_type", "raw");
        });
        var upload = service.upload(actor, new MockMultipartFile("file", "file.pdf", "application/pdf", new byte[]{1}));
        assertThat(upload.thumbnailUrl()).isNull();
        assertThat(upload.thumbnails()).isEmpty();
        verify(assets).repairUploadThumbnails(argThat(receipt -> receipt.thumbnails().isEmpty()));
    }

    @Test void differentTenantTypeOrAssetUrlCannotBecomeReadyDespiteMatchingPublicId() throws Exception {
        var uploader = cloudinary.uploader();
        for (String wrong : List.of("https://elsewhere.test/test/image/upload/", "https://res.cloudinary.com/other/image/upload/",
                "https://res.cloudinary.com/test/video/upload/", "https://res.cloudinary.com/test/image/upload/other-asset/")) {
            doAnswer(call -> {
                var body = response(null, call.getArgument(1));
                body.put("secure_url", wrong + ((Map<?, ?>) call.getArgument(1)).get("public_id") + ".png");
                return body;
            }).when(uploader).upload(any(byte[].class), anyMap());
            assertThatThrownBy(() -> service.upload(actor, image())).isInstanceOf(IllegalStateException.class);
        }
        verify(assets, never()).completeUpload(any());
    }

    @Test void ownerInspectionReadsOnlyPersistedVariantStatesAndNeverCallsProvider() {
        doReturn(asset(actor, "READY", "image/png")).when(assets).findById(assetId);
        var rows = CloudinaryThumbnailPolicy.read(null, "https://res.cloudinary.com/test/image.png", "source", Instant.now());
        when(assets.findThumbnails(assetId)).thenReturn(rows);
        assertThat(service.thumbnails(actor, assetId).variants()).isEqualTo(rows);
        verifyNoInteractions(cloudinary);
    }

    @Test void outsiderMissingAndDeletingAssetsCannotDiscloseThumbnails() {
        assertThatThrownBy(() -> service.thumbnails(actor, assetId)).isInstanceOf(NotFoundException.class);
        doReturn(asset(UUID.randomUUID(), "READY", "image/png")).when(assets).findById(assetId);
        assertThatThrownBy(() -> service.thumbnails(actor, assetId)).isInstanceOf(ForbiddenException.class);
        doReturn(asset(actor, "DELETING", "image/png")).when(assets).findById(assetId);
        assertThatThrownBy(() -> service.thumbnails(actor, assetId)).isInstanceOf(NotFoundException.class);
        verify(assets, never()).findThumbnails(any());
        verifyNoInteractions(cloudinary);
    }

    @Test void nonImageInspectionIsExplicitlyNotApplicable() {
        doReturn(asset(actor, "READY", "application/pdf")).when(assets).findById(assetId);
        assertThat(service.thumbnails(actor, assetId).applicable()).isFalse();
        verify(assets, never()).findThumbnails(any());
    }

    @Test void failedMetadataPersistenceDoesNotReturnSuccessfulUpload() throws Exception {
        when(cloudinary.uploader().upload(any(byte[].class), anyMap())).thenAnswer(call -> response(null, call.getArgument(1)));
        doThrow(new IllegalStateException("database unavailable")).when(assets).completeUpload(any());
        assertThatThrownBy(() -> service.upload(actor, image())).isInstanceOf(IllegalStateException.class);
    }

    MediaAsset asset(UUID owner, String status, String mimeType) {
        return new MediaAsset(assetId, owner, "CLOUDINARY", "source", "https://res.cloudinary.com/source.png",
                "source.png", mimeType, 12, 2, 3, null, null, status, "PENDING", "PENDING", Instant.now(), null);
    }
    static MockMultipartFile image() throws Exception {
        return new MockMultipartFile("file", "image.png", "image/png", CloudinaryMediaUploadTest.png());
    }
    static Map<String, Object> response(Object eager, Map<?, ?> options) {
        String key = (String) options.get("public_id");
        var response = new HashMap<String, Object>(Map.of("public_id", key, "secure_url",
                "https://res.cloudinary.com/test/image/upload/" + key + ".png", "resource_type", "image", "width", 2, "height", 3));
        if (eager instanceof List<?> rows) response.put("eager", rows.stream().map(item -> {
            Map<Object, Object> row = new HashMap<>();
            row.putAll((Map<?, ?>) item);
            if (row.get("secure_url") instanceof String url) row.put("secure_url", url.replace("source", key));
            return row;
        }).toList());
        return response;
    }
}
