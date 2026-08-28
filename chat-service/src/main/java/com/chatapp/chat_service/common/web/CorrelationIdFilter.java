package com.chatapp.chat_service.common.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationIdFilter extends OncePerRequestFilter {
    public static final String HEADER = "X-Correlation-ID";
    public static final String ATTRIBUTE = CorrelationIdFilter.class.getName() + ".correlationId";

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        String supplied = request.getHeader(HEADER);
        String correlationId = StringUtils.hasText(supplied) && supplied.length() <= 128
                ? supplied
                : UUID.randomUUID().toString();
        request.setAttribute(ATTRIBUTE, correlationId);
        response.setHeader(HEADER, correlationId);
        filterChain.doFilter(request, response);
    }
}
