package com.chatapp.chat_service.canonical.media;

import com.chatapp.chat_service.common.exception.BadRequestException;
import com.cloudinary.Cloudinary;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.io.IOException;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CloudinaryMediaUploadTest {
    final Cloudinary cloudinary = mock(Cloudinary.class, withSettings().useConstructor(Map.of("cloud_name", "test")).defaultAnswer(RETURNS_DEEP_STUBS));
    final MediaAssetRepository assets = mock(MediaAssetRepository.class);
    final CloudinaryMediaService service = new CloudinaryMediaService(cloudinary, assets,
            mock(MediaUploadRecoveryRepository.class), mock(MediaDeletionRecoveryRepository.class),
            mock(MediaOrphanRepository.class));
    final MediaUploadTestStore store = new MediaUploadTestStore(assets);
    final UUID actor = UUID.randomUUID();

    @Test void rejectsTextDisguisedAsImageBeforeProviderOrPersistence() {
        var file = new MockMultipartFile("file", "photo.png", "image/png", "not an image".getBytes());
        assertThatThrownBy(() -> service.upload(actor, file)).isInstanceOf(BadRequestException.class);
        verifyNoInteractions(cloudinary, assets);
    }

    @Test void rejectsImageMimeMismatchBeforeProviderOrPersistence() throws Exception {
        var file = new MockMultipartFile("file", "photo.jpg", "image/jpeg", png());
        assertThatThrownBy(() -> service.upload(actor, file)).isInstanceOf(BadRequestException.class);
        verifyNoInteractions(cloudinary, assets);
    }

    @Test void rejectsExcessiveDecodedDimensionsWithoutAllocatingTheRaster() throws Exception {
        byte[] bytes = png();
        // PNG IHDR width/height, 10,000 x 10,000: tiny upload, excessive pixel allocation.
        for (int offset : new int[]{16, 20}) {
            bytes[offset] = 0;
            bytes[offset + 1] = 0;
            bytes[offset + 2] = 0x27;
            bytes[offset + 3] = 0x10;
        }
        var file = new MockMultipartFile("file", "photo.png", "image/png", bytes);
        assertThatThrownBy(() -> service.upload(actor, file)).isInstanceOf(BadRequestException.class);
        verifyNoInteractions(cloudinary, assets);
    }

    @Test void absentMimeIsAClientErrorRatherThanNullPointerFailure() {
        var file = new MockMultipartFile("file", "photo.png", null, new byte[]{1});
        assertThatThrownBy(() -> service.upload(actor, file)).isInstanceOf(BadRequestException.class);
        verifyNoInteractions(cloudinary, assets);
    }

    @Test void actualStreamSizeCannotBypassTenMegabyteLimit() {
        var file = new MockMultipartFile("file", "large.txt", "text/plain", new byte[10 * 1024 * 1024 + 1]) {
            @Override public long getSize() { return 1; }
        };
        assertThatThrownBy(() -> service.upload(actor, file)).isInstanceOf(BadRequestException.class);
        verifyNoInteractions(cloudinary, assets);
    }

    @Test void streamCannotBeEmptyDespiteNonemptyMultipartMetadata() {
        var file = new MockMultipartFile("file", "empty.txt", "text/plain", new byte[]{1}) {
            @Override public InputStream getInputStream() { return InputStream.nullInputStream(); }
        };
        assertThatThrownBy(() -> service.upload(actor, file)).isInstanceOf(BadRequestException.class);
        verifyNoInteractions(cloudinary, assets);
    }

    @Test void validImageReachesProviderUnchangedAndStreamClosesBeforeProviderIo() throws Exception {
        byte[] bytes = png();
        var closed = new AtomicBoolean();
        var file = new MockMultipartFile("file", "photo.png", "image/png", bytes) {
            @Override public byte[] getBytes() { throw new AssertionError("unbounded multipart read"); }
            @Override public InputStream getInputStream() {
                return new ByteArrayInputStream(bytes) {
                    @Override public void close() throws IOException { closed.set(true); super.close(); }
                };
            }
        };
        when(cloudinary.uploader().upload(any(byte[].class), anyMap())).thenAnswer(call -> {
            assertThat(closed).isTrue();
            assertThat((byte[]) call.getArgument(0)).isEqualTo(bytes);
            Map<?, ?> options = call.getArgument(1);
            return Map.of("public_id", options.get("public_id"), "secure_url", "https://res.cloudinary.com/test/image/upload/" + options.get("public_id") + ".png",
                    "resource_type", "image", "width", 2, "height", 3);
        });
        var result = service.upload(actor, file);
        assertThat(result.fileSize()).isEqualTo(bytes.length);
        assertThat(result.width()).isEqualTo(2);
        assertThat(result.height()).isEqualTo(3);
        verify(assets).completeUpload(argThat(receipt -> receipt.asset().byteSize() == bytes.length
                && receipt.asset().mimeType().equals("image/png") && receipt.asset().ownerId().equals(actor)));
    }

    @Test void providerFailureDoesNotCreateReadyAsset() throws Exception {
        when(cloudinary.uploader().upload(any(byte[].class), anyMap())).thenThrow(new IOException("provider unavailable"));
        var file = new MockMultipartFile("file", "photo.png", "image/png", png());
        assertThatThrownBy(() -> service.upload(actor, file)).isInstanceOf(IllegalStateException.class);
        verify(assets).claimUpload(any());
        verify(assets, never()).completeUpload(any());
    }

    static byte[] png() throws Exception {
        var output = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(2, 3, BufferedImage.TYPE_INT_RGB), "png", output);
        return output.toByteArray();
    }
}
