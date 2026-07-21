package com.chatapp.chat_service.elasticsearch.converter;

import org.springframework.core.convert.converter.Converter;
import org.springframework.data.convert.ReadingConverter;
import org.springframework.data.convert.WritingConverter;

import java.util.UUID;

@ReadingConverter
@WritingConverter
public class UUIDConverter implements Converter<UUID, String> {

    @Override
    public String convert(UUID source) {
        return source.toString();
    }
}
