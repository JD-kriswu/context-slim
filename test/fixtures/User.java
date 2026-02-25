package com.example.model;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import javax.persistence.*;
import lombok.Data;
import lombok.Builder;

/**
 * User entity with various field types and annotations
 */
@Entity
@Table(name = "users")
@Data
@Builder
public class User implements Serializable, Comparable<User> {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, unique = true)
    private String email;
    
    @Column(nullable = false)
    private String name;
    
    @Enumerated(EnumType.STRING)
    private UserRole role;
    
    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL)
    private List<Order> orders;
    
    @ElementCollection
    private Map<String, String> metadata;
    
    @Transient
    private transient String tempData;
    
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    public enum UserRole {
        ADMIN, USER, GUEST
    }
    
    // Inner class for builder pattern
    public static class UserBuilder {
        public UserBuilder withDefaults() {
            this.role = UserRole.USER;
            this.createdAt = LocalDateTime.now();
            return this;
        }
    }
    
    @Override
    public int compareTo(User other) {
        return this.email.compareTo(other.email);
    }
    
    public boolean isAdmin() {
        return role == UserRole.ADMIN;
    }
    
    protected void updateTimestamp() {
        this.updatedAt = LocalDateTime.now();
    }
    
    private void validateEmail() {
        if (!email.contains("@")) {
            throw new IllegalArgumentException("Invalid email");
        }
    }
    
    // Generic method
    public <T> T getMetadataAs(String key, Class<T> type) {
        String value = metadata.get(key);
        // conversion logic
        return null;
    }
    
    // Varargs method
    public void addTags(String... tags) {
        for (String tag : tags) {
            metadata.put("tag:" + tag, "true");
        }
    }
}
