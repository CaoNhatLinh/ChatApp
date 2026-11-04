package com.chatapp.chat_service.canonical.media;

import com.cloudinary.Cloudinary;
import com.cloudinary.api.exceptions.NotFound;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

final class CloudinaryUploadProof {
    private static final String CONTEXT_KEY = "noi_upload_proof";
    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final Pattern SHA256_HEX = Pattern.compile("[0-9a-f]{64}");

    private CloudinaryUploadProof() { }

    static void bind(Cloudinary cloudinary, Map<String, Object> options, MediaAsset pending) {
        String proof = expectedProof(cloudinary, pending);
        if (proof != null) options.put("context", CONTEXT_KEY + "=" + proof);
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> read(Cloudinary cloudinary, MediaAsset pending, String resourceType) throws Exception {
        String expected = expectedProof(cloudinary, pending);
        if (expected == null) return null;

        Object resources;
        try {
            var response = cloudinary.api().resourcesByIds(List.of(pending.storageKey()),
                    Map.of("resource_type", resourceType, "type", "upload", "context", true));
            resources = response == null ? null : response.get("resources");
        } catch (NotFound missing) {
            return null;
        }
        if (!(resources instanceof List<?> entries) || entries.size() != 1
                || !(entries.get(0) instanceof Map<?, ?> resource)) return null;
        if (!pending.storageKey().equals(resource.get("public_id"))
                || !resourceType.equals(resource.get("resource_type")) || !"upload".equals(resource.get("type"))
                || !matchesByteSize(resource.get("bytes"), pending.byteSize())) return null;
        if (!(resource.get("context") instanceof Map<?, ?> context)
                || !(context.get("custom") instanceof Map<?, ?> custom)
                || !(custom.get(CONTEXT_KEY) instanceof String actual)
                || !SHA256_HEX.matcher(actual).matches()) return null;

        return MessageDigest.isEqual(expected.getBytes(StandardCharsets.US_ASCII),
                actual.getBytes(StandardCharsets.US_ASCII)) ? (Map<String, Object>) resource : null;
    }

    private static boolean matchesByteSize(Object bytes, long expected) {
        if (!(bytes instanceof Number number)) return false;
        try {
            return new BigDecimal(number.toString()).longValueExact() == expected;
        } catch (NumberFormatException | ArithmeticException invalid) {
            return false;
        }
    }

    private static String expectedProof(Cloudinary cloudinary, MediaAsset pending) {
        String secret = cloudinary.config == null ? null : cloudinary.config.apiSecret;
        if (secret == null || secret.isBlank() || pending.storageKey() == null || pending.storageKey().isBlank()
                || pending.byteSize() <= 0 || pending.checksumSha256() == null
                || !SHA256_HEX.matcher(pending.checksumSha256()).matches()) return null;

        String binding = "noi-upload-proof-v1\n" + pending.storageKey() + "\n"
                + pending.checksumSha256() + "\n" + pending.byteSize();
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM));
            return HexFormat.of().formatHex(mac.doFinal(binding.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException failure) {
            throw new IllegalStateException("Cannot initialize Cloudinary upload proof", failure);
        }
    }
}
