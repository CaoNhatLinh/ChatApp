package com.chatapp.chat_service.canonical.email;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;

/** https://docs.svix.com/receiving/verifying-payloads/how-manual */
final class ResendSignatureVerifier {
    private ResendSignatureVerifier() { }

    static boolean verify(byte[] body, String id, String timestamp, String signatures, String secret, Instant now) {
        if (secret.isBlank() || id == null || id.length() > 256 || timestamp == null
                || signatures == null || signatures.length() > 4096) return false;
        try {
            long seconds = Long.parseLong(timestamp);
            if (seconds < now.getEpochSecond() - 300 || seconds > now.getEpochSecond() + 300) return false;
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(Base64.getDecoder().decode(secret.substring(6)), "HmacSHA256"));
            mac.update((id + "." + timestamp + ".").getBytes(StandardCharsets.UTF_8));
            byte[] expected = mac.doFinal(body);
            for (String signature : signatures.split(" ")) {
                if (signature.startsWith("v1,")) {
                    try {
                        if (MessageDigest.isEqual(expected, Base64.getDecoder().decode(signature.substring(3)))) return true;
                    } catch (IllegalArgumentException ignored) { /* Other rotation signatures may still match. */ }
                }
            }
        } catch (Exception exception) {
            return false;
        }
        return false;
    }
}
