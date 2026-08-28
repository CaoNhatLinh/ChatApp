package com.chatapp.chat_service.common.exception;

import com.chatapp.chat_service.common.dto.ErrorResponse;
import com.chatapp.chat_service.common.web.CorrelationIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {
    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(NotFoundException ex, HttpServletRequest request) {
        return response(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", ex.getMessage(), Map.of(), request);
    }

    @ExceptionHandler(BadRequestException.class)
    public ResponseEntity<ErrorResponse> handleBadRequest(BadRequestException ex, HttpServletRequest request) {
        return response(HttpStatus.BAD_REQUEST, "BAD_REQUEST", ex.getMessage(), Map.of(), request);
    }

    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<ErrorResponse> handleConflict(ConflictException ex, HttpServletRequest request) {
        return response(HttpStatus.CONFLICT, "CONFLICT", ex.getMessage(), Map.of(), request);
    }

    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<ErrorResponse> handleForbidden(ForbiddenException ex, HttpServletRequest request) {
        return response(HttpStatus.FORBIDDEN, "FORBIDDEN", ex.getMessage(), Map.of(), request);
    }

    @ExceptionHandler(TooManyRequestsException.class)
    public ResponseEntity<ErrorResponse> handleTooManyRequests(
            TooManyRequestsException ex, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header(HttpHeaders.RETRY_AFTER, Long.toString(ex.getRetryAfterSeconds()))
                .body(error(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED", ex.getMessage(), Map.of(), request));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(
            MethodArgumentNotValidException ex, HttpServletRequest request) {
        Map<String, String> fields = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(field ->
                fields.putIfAbsent(field.getField(), field.getDefaultMessage()));
        return response(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Request validation failed", fields, request);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorResponse> handleConstraintViolation(
            ConstraintViolationException ex, HttpServletRequest request) {
        Map<String, String> fields = new LinkedHashMap<>();
        ex.getConstraintViolations().forEach(violation ->
                fields.putIfAbsent(violation.getPropertyPath().toString(), violation.getMessage()));
        return response(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Request validation failed", fields, request);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGenericException(Exception ex, HttpServletRequest request) {
        log.error("Unhandled exception [{}]: {}", correlationId(request), ex.getMessage(), ex);
        return response(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR",
                "An internal server error occurred", Map.of(), request);
    }

    private ResponseEntity<ErrorResponse> response(
            HttpStatus status,
            String code,
            String message,
            Map<String, String> fieldErrors,
            HttpServletRequest request) {
        return ResponseEntity.status(status).body(error(status, code, message, fieldErrors, request));
    }

    private ErrorResponse error(
            HttpStatus status,
            String code,
            String message,
            Map<String, String> fieldErrors,
            HttpServletRequest request) {
        return new ErrorResponse(status.value(), code, message, fieldErrors, correlationId(request),
                Instant.now(), request.getRequestURI());
    }

    private String correlationId(HttpServletRequest request) {
        Object value = request.getAttribute(CorrelationIdFilter.ATTRIBUTE);
        return value == null ? "unavailable" : value.toString();
    }
}
