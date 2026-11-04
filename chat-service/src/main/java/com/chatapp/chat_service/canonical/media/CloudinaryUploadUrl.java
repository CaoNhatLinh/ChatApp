package com.chatapp.chat_service.canonical.media;

import java.net.URI;
import java.util.regex.Pattern;

/** The configured shared-CDN original, never an arbitrary HTTPS provider field. */
final class CloudinaryUploadUrl {
    private CloudinaryUploadUrl() { }

    static boolean matches(String url, String cloudName, String resourceType, String publicId) {
        if (url == null || cloudName == null || cloudName.isBlank() || publicId == null) return false;
        try {
            URI uri = URI.create(url);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || !"res.cloudinary.com".equalsIgnoreCase(uri.getHost())
                    || (uri.getPort() != -1 && uri.getPort() != 443) || uri.getRawUserInfo() != null
                    || uri.getRawQuery() != null || uri.getRawFragment() != null) return false;
            String prefix = "/" + cloudName + "/" + resourceType + "/upload/";
            String path = uri.getRawPath();
            if (path == null || !path.startsWith(prefix)) return false;
            String asset = path.substring(prefix.length()).replaceFirst("^v[0-9]+/", "");
            return "raw".equals(resourceType) ? asset.equals(publicId)
                    : asset.matches(Pattern.quote(publicId) + "\\.[a-zA-Z0-9]{1,12}");
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }
}
