package com.chatapp.chat_service.canonical.media;

import com.chatapp.chat_service.common.exception.BadRequestException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.*;

class ImageUploadPreflightTest {
    @ParameterizedTest
    @CsvSource({"png,image/png", "jpeg,image/jpeg", "gif,image/gif"})
    void nativeImageHeadersRemainSupported(String format, String mimeType) throws Exception {
        var output = new ByteArrayOutputStream();
        assertThat(ImageIO.write(new BufferedImage(2, 3, BufferedImage.TYPE_INT_RGB), format, output)).isTrue();
        assertThatCode(() -> ImageUploadPreflight.validate(output.toByteArray(), mimeType)).doesNotThrowAnyException();
    }

    @ParameterizedTest
    @CsvSource({"1,1", "5000,5000", "16384,1", "1,16384"})
    void acceptsInclusiveDimensionLimits(int width, int height) {
        assertThatCode(() -> ImageUploadPreflight.requireDimensions(width, height)).doesNotThrowAnyException();
    }

    @ParameterizedTest
    @CsvSource({"0,1", "1,0", "-1,1", "16385,1", "1,16385", "5001,5000", "2147483647,2147483647"})
    void rejectsInvalidOrExcessiveDimensionsWithoutIntegerOverflow(int width, int height) {
        assertThatThrownBy(() -> ImageUploadPreflight.requireDimensions(width, height))
                .isInstanceOf(BadRequestException.class);
    }

    @Test void truncatedImageHeadersAreClientErrors() {
        for (String type : new String[]{"image/png", "image/jpeg", "image/gif", "image/webp"}) {
            for (int length = 0; length < 30; length++) {
                byte[] bytes = new byte[length];
                assertThatThrownBy(() -> ImageUploadPreflight.validate(bytes, type))
                        .isInstanceOf(BadRequestException.class);
            }
        }
    }

    @Test void boundsGifLogicalCanvasSeparatelyFromFrame() throws Exception {
        var output = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(2, 3, BufferedImage.TYPE_INT_RGB), "gif", output);
        byte[] bytes = output.toByteArray();
        bytes[6] = (byte) 0xff;
        bytes[7] = (byte) 0xff;
        assertThatThrownBy(() -> ImageUploadPreflight.validate(bytes, "image/gif"))
                .isInstanceOf(BadRequestException.class);
    }

    @Test void preflightDoesNotPretendToValidateNonImageFormats() {
        assertThatCode(() -> ImageUploadPreflight.validate(new byte[]{1}, "application/pdf"))
                .doesNotThrowAnyException();
    }

    @Test void webpSupportsLossyLosslessAndExtendedCanvasHeaders() {
        // Deliberately header fixtures, not evidence of successful full-image decoding.
        for (String type : new String[]{"VP8 ", "VP8L", "VP8X"}) {
            assertThatCode(() -> ImageUploadPreflight.validate(webp(type), "image/webp"))
                    .doesNotThrowAnyException();
        }
        byte[] minimalLossless = Arrays.copyOf(webp("VP8L"), 26);
        writeLE(minimalLossless, 4, 18, 4);
        writeLE(minimalLossless, 16, 5, 4);
        assertThatCode(() -> ImageUploadPreflight.validate(minimalLossless, "image/webp"))
                .doesNotThrowAnyException();
    }

    @Test void webpRejectsWrongRiffLengthChunkOverflowPaddingAndUnknownHeader() {
        byte[] original = webp("VP8 ");
        for (int offset : new int[]{0, 4, 8, 12, 16, 23}) {
            byte[] bytes = original.clone();
            bytes[offset] = (byte) 0xff;
            assertThatThrownBy(() -> ImageUploadPreflight.validate(bytes, "image/webp"))
                    .isInstanceOf(BadRequestException.class);
        }
        byte[] odd = Arrays.copyOf(webp("VP8L"), 26);
        writeLE(odd, 4, 18, 4);
        writeLE(odd, 16, 5, 4);
        odd[25] = 1;
        assertThatThrownBy(() -> ImageUploadPreflight.validate(odd, "image/webp"))
                .isInstanceOf(BadRequestException.class);
    }

    @Test void webpBoundsExtendedCanvasAndLosslessPixels() {
        byte[] extended = webp("VP8X");
        writeLE(extended, 24, 16_384, 3);
        assertThatThrownBy(() -> ImageUploadPreflight.validate(extended, "image/webp"))
                .isInstanceOf(BadRequestException.class);
        byte[] lossless = webp("VP8L");
        writeLE(lossless, 21, 9_999 | (9_999L << 14), 4);
        assertThatThrownBy(() -> ImageUploadPreflight.validate(lossless, "image/webp"))
                .isInstanceOf(BadRequestException.class);
    }

    @Test void webpRejectsReservedVersionFlagsAndNonKeyLossyFrame() {
        for (String type : new String[]{"VP8X", "VP8L", "VP8 "}) {
            byte[] bytes = webp(type);
            if (type.equals("VP8X")) bytes[20] = (byte) 0x80;
            else if (type.equals("VP8L")) bytes[24] = (byte) 0xe0;
            else bytes[20] = 1;
            assertThatThrownBy(() -> ImageUploadPreflight.validate(bytes, "image/webp"))
                    .isInstanceOf(BadRequestException.class);
        }
    }

    static byte[] webp(String type) {
        byte[] bytes = new byte[30];
        System.arraycopy("RIFF".getBytes(StandardCharsets.US_ASCII), 0, bytes, 0, 4);
        writeLE(bytes, 4, 22, 4);
        System.arraycopy("WEBP".getBytes(StandardCharsets.US_ASCII), 0, bytes, 8, 4);
        System.arraycopy(type.getBytes(StandardCharsets.US_ASCII), 0, bytes, 12, 4);
        writeLE(bytes, 16, 10, 4);
        if (type.equals("VP8 ")) {
            bytes[23] = (byte) 0x9d;
            bytes[24] = 1;
            bytes[25] = 0x2a;
            bytes[26] = 2;
            bytes[28] = 3;
        } else if (type.equals("VP8L")) {
            bytes[20] = 0x2f;
            writeLE(bytes, 21, 1 | (2 << 14), 4);
        } else {
            writeLE(bytes, 24, 1, 3);
            writeLE(bytes, 27, 2, 3);
        }
        return bytes;
    }

    static void writeLE(byte[] bytes, int offset, long value, int count) {
        for (int index = 0; index < count; index++) bytes[offset + index] = (byte) (value >>> (8 * index));
    }
}
