package com.chatapp.chat_service.auth.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Transient;
import org.springframework.data.cassandra.core.mapping.Column;
import org.springframework.data.cassandra.core.mapping.PrimaryKey;
import org.springframework.data.cassandra.core.mapping.Table;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.Instant;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table("users")
@JsonIgnoreProperties(ignoreUnknown = true)
public class User implements UserDetails {

    @PrimaryKey("user_id")
    private UUID userId;
    
    @Column("username")
    private String username;
    
    @JsonIgnore
    @Column("password")
    private String password;
    
    @Column("display_name")
    private String displayName;
    
    @Column("nickname")
    private String nickname;
    
    @Column("avatar_url")
    private String avatarUrl;
    
    @Column("created_at")
    private Instant createdAt;

    @Column("status_preference")
    private String statusPreference;

    @Column("status_updated_at")
    private Instant statusUpdatedAt;

    @JsonIgnore
    @Transient
    @Builder.Default
    private List<GrantedAuthority> authorities = Collections.emptyList();

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities != null ? authorities : Collections.emptyList();
    }

    @Override
    @JsonIgnore
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    @JsonIgnore
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    @JsonIgnore
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    @JsonIgnore
    public boolean isEnabled() {
        return true;
    }
}
