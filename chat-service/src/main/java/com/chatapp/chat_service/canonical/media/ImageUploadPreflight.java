package com.chatapp.chat_service.canonical.media;

import com.chatapp.chat_service.common.exception.BadRequestException;

import javax.imageio.ImageIO;
import javax.imageio.stream.MemoryCacheImageInputStream;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Locale;
import java.util.Map;

/** Header/canvas preflight only; Cloudinary must still decode the complete image. */
final class ImageUploadPreflight {
    static final int MAX_EDGE = 16_384;
    static final long MAX_PIXELS = 25_000_000;
    private static final Map<String, String> FORMATS = Map.of(
            "image/jpeg", "jpeg", "image/png", "png", "image/gif", "gif");

    private ImageUploadPreflight() {}

    static void validate(byte[] bytes, String mimeType) {
        if (!mimeType.startsWith("image/")) return;
        if ("image/webp".equals(mimeType)) {
            WebpUploadHeader.validate(bytes);
            return;
        }
        // Avoid ImageIO's process-global disk-cache setting and never allocate a decoded raster.
        try (var input = new MemoryCacheImageInputStream(new ByteArrayInputStream(bytes))) {
            var readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) throw invalid();
            var reader = readers.next();
            try {
                if (!reader.getFormatName().toLowerCase(Locale.ROOT).equals(FORMATS.get(mimeType))) {
                    throw invalid();
                }
                reader.setInput(input, true, true);
                requireDimensions(reader.getWidth(0), reader.getHeight(0));
                if ("image/gif".equals(mimeType)) {
                    // A GIF's logical canvas can be larger than its first frame.
                    if (bytes.length < 13) throw invalid();
                    requireDimensions((bytes[6] & 255) | ((bytes[7] & 255) << 8),
                            (bytes[8] & 255) | ((bytes[9] & 255) << 8));
                }
            } finally {
                reader.dispose();
            }
        } catch (IOException exception) {
            throw invalid();
        }
    }

    static void requireDimensions(int width, int height) {
        if (width < 1 || height < 1 || width > MAX_EDGE || height > MAX_EDGE
                || (long) width * height > MAX_PIXELS) {
            throw new BadRequestException("image exceeds the 16384 edge or 25000000 pixel limit");
        }
    }

    static BadRequestException invalid() {
        return new BadRequestException("image header does not match its media type or is invalid");
    }
}
