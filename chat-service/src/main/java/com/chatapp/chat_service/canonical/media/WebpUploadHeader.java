package com.chatapp.chat_service.canonical.media;

import java.nio.charset.StandardCharsets;

/** WebP RIFF canvas preflight, not a WebP decoder. See Google's WebP container specification. */
final class WebpUploadHeader {
    private WebpUploadHeader() {}

    static void validate(byte[] bytes) {
        if (bytes.length < 26 || (bytes.length & 1) != 0 || !tag(bytes, 0, "RIFF") || !tag(bytes, 8, "WEBP")
                || littleEndian(bytes, 4, 4) != bytes.length - 8L) throw ImageUploadPreflight.invalid();
        long size = littleEndian(bytes, 16, 4);
        if (size < 5 || 20L + size + (size & 1) > bytes.length) throw ImageUploadPreflight.invalid();
        if ((size & 1) != 0 && bytes[20 + (int) size] != 0) throw ImageUploadPreflight.invalid();
        if (tag(bytes, 12, "VP8X")) {
            if (size != 10 || (bytes[20] & 0xc1) != 0 || bytes[21] != 0 || bytes[22] != 0 || bytes[23] != 0) {
                throw ImageUploadPreflight.invalid();
            }
            ImageUploadPreflight.requireDimensions(1 + (int) littleEndian(bytes, 24, 3),
                    1 + (int) littleEndian(bytes, 27, 3));
        } else if (tag(bytes, 12, "VP8L")) {
            if ((bytes[20] & 255) != 0x2f || (bytes[24] & 0xe0) != 0) throw ImageUploadPreflight.invalid();
            long bits = littleEndian(bytes, 21, 4);
            ImageUploadPreflight.requireDimensions(1 + (int) (bits & 0x3fff),
                    1 + (int) ((bits >>> 14) & 0x3fff));
        } else if (tag(bytes, 12, "VP8 ")) {
            if (size < 10 || (bytes[20] & 1) != 0 || (bytes[23] & 255) != 0x9d
                    || (bytes[24] & 255) != 0x01 || (bytes[25] & 255) != 0x2a) {
                throw ImageUploadPreflight.invalid();
            }
            ImageUploadPreflight.requireDimensions((int) littleEndian(bytes, 26, 2) & 0x3fff,
                    (int) littleEndian(bytes, 28, 2) & 0x3fff);
        } else {
            throw ImageUploadPreflight.invalid();
        }
    }

    private static boolean tag(byte[] bytes, int offset, String expected) {
        return expected.equals(new String(bytes, offset, 4, StandardCharsets.US_ASCII));
    }

    private static long littleEndian(byte[] bytes, int offset, int count) {
        long value = 0;
        for (int index = 0; index < count; index++) value |= (long) (bytes[offset + index] & 255) << (index * 8);
        return value;
    }
}
