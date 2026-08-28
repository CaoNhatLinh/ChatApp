package com.chatapp.chat_service.common.config;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.Assert;

@Configuration
@ConditionalOnProperty(prefix = "app.integrations.cloudinary", name = "enabled", havingValue = "true")
public class CloudinaryConfig {

    @Bean
    Cloudinary cloudinary(
            @Value("${cloudinary.cloud-name:}") String cloudName,
            @Value("${cloudinary.api-key:}") String apiKey,
            @Value("${cloudinary.api-secret:}") String apiSecret,
            @Value("${cloudinary.secure:true}") boolean secure) {
        Assert.hasText(cloudName, "CLOUDINARY_CLOUD_NAME is required when Cloudinary is enabled");
        Assert.hasText(apiKey, "CLOUDINARY_API_KEY is required when Cloudinary is enabled");
        Assert.hasText(apiSecret, "CLOUDINARY_API_SECRET is required when Cloudinary is enabled");

        // Official Java SDK configuration:
        // https://cloudinary.com/documentation/java_integration#configure
        return new Cloudinary(ObjectUtils.asMap(
                "cloud_name", cloudName,
                "api_key", apiKey,
                "api_secret", apiSecret,
                "secure", secure));
    }
}
