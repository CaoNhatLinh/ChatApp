package com.chatapp.chat_service.canonical.media;

import com.cloudinary.Api;
import com.cloudinary.Cloudinary;
import com.cloudinary.api.ApiResponse;
import com.cloudinary.api.exceptions.NotFound;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.withSettings;

class CloudinaryUploadProofTest {
    private static final String PUBLIC_ID = "chatapp/test/test.txt";
    private static final String PROOF = "e334a4e289f34c63741a3dd818524d6ea2d4a83bc91d01e66840ccc6c6a22f54";
    private static final Map<String, Object> LOOKUP_OPTIONS = Map.of("resource_type", "raw", "type", "upload", "context", true);
    private static final MediaAsset PENDING = new MediaAsset(UUID.randomUUID(), UUID.randomUUID(), "CLOUDINARY",
            PUBLIC_ID, null, "test.txt", "text/plain", 5, null, null, null, "a".repeat(64),
            "PENDING", "PENDING", "PENDING", Instant.EPOCH, null);

    private final Cloudinary cloudinary = cloudinary(Map.of("api_secret", "test-proof-secret"));
    private final Api api = mock(Api.class);

    @Test
    void bindsVersionedProofAndReadsOnlyTheMatchingResource() throws Exception {
        var options = new HashMap<String, Object>();
        CloudinaryUploadProof.bind(cloudinary, options, PENDING);
        assertThat(options).containsEntry("context", "noi_upload_proof=" + PROOF);

        var resource = validResource();
        mockResources(List.of(resource));
        assertThat(CloudinaryUploadProof.read(cloudinary, PENDING, "raw")).isSameAs(resource);
    }

    @Test
    void refusesMissingOrMismatchedProofAndProviderMetadata() throws Exception {
        var mismatches = Map.of(
                "public_id", "another/asset.txt",
                "resource_type", "image",
                "type", "authenticated",
                "bytes", 5.5,
                "context", Map.of("custom", Map.of("noi_upload_proof", "b".repeat(64))));
        for (var mismatch : mismatches.entrySet()) {
            var resource = validResource();
            resource.put(mismatch.getKey(), mismatch.getValue());
            mockResources(List.of(resource));
            assertThat(CloudinaryUploadProof.read(cloudinary, PENDING, "raw")).isNull();
        }
        var resource = validResource();
        resource.remove("context");
        mockResources(List.of(resource));
        assertThat(CloudinaryUploadProof.read(cloudinary, PENDING, "raw")).isNull();
        mockResources(List.of(validResource(), validResource()));
        assertThat(CloudinaryUploadProof.read(cloudinary, PENDING, "raw")).isNull();
    }

    @Test
    void treatsMissingResourceAsUnconfirmedButPropagatesProviderFailures() throws Exception {
        when(cloudinary.api()).thenReturn(api);
        when(api.resourcesByIds(List.of(PUBLIC_ID), LOOKUP_OPTIONS)).thenThrow(new NotFound("missing"));
        assertThat(CloudinaryUploadProof.read(cloudinary, PENDING, "raw")).isNull();

        var failure = new IOException("provider unavailable");
        doThrow(failure).when(api).resourcesByIds(List.of(PUBLIC_ID), LOOKUP_OPTIONS);
        assertThatThrownBy(() -> CloudinaryUploadProof.read(cloudinary, PENDING, "raw")).isSameAs(failure);
    }

    @Test
    void skipsBindingAndLookupWithoutAConfiguredSecret() throws Exception {
        var unconfigured = cloudinary(Map.of("api_secret", ""));
        var options = new HashMap<String, Object>();
        CloudinaryUploadProof.bind(unconfigured, options, PENDING);
        assertThat(options).isEmpty();
        assertThat(CloudinaryUploadProof.read(unconfigured, PENDING, "raw")).isNull();
        verifyNoInteractions(unconfigured);
    }

    private static Cloudinary cloudinary(Map<String, String> configuration) {
        return mock(Cloudinary.class, withSettings().useConstructor(configuration));
    }

    private static Map<String, Object> validResource() {
        return new HashMap<>(Map.of("public_id", PUBLIC_ID, "resource_type", "raw", "type", "upload", "bytes", 5,
                "context", Map.of("custom", Map.of("noi_upload_proof", PROOF))));
    }

    private void mockResources(List<Map<String, Object>> resources) throws Exception {
        var response = mock(ApiResponse.class);
        when(response.get("resources")).thenReturn(resources);
        when(cloudinary.api()).thenReturn(api);
        when(api.resourcesByIds(List.of(PUBLIC_ID), LOOKUP_OPTIONS)).thenReturn(response);
    }
}
