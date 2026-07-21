package com.chatapp.chat_service.elasticsearch.converter;

import org.springframework.core.convert.converter.Converter;
import org.springframework.data.convert.ReadingConverter;
import org.springframework.data.convert.WritingConverter;

import java.time.Instant;

@ReadingConverter
@WritingConverter
public class InstantConverter implements Converter<Instant, String> {

    @Override
    public String convert(Instant source) {
        return source.toString();
    }
}
