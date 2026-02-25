package com.example.service;

import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * User service for managing user operations
 */
@Service
public class UserService {
    
    @Autowired
    private UserRepository userRepository;
    
    private final String defaultRole = "USER";
    
    public List<User> findAll() {
        return userRepository.findAll();
    }
    
    public Optional<User> findById(Long id) {
        return userRepository.findById(id);
    }
    
    public User create(String name, String email) {
        User user = new User(name, email);
        user.setRole(defaultRole);
        return userRepository.save(user);
    }
    
    public void delete(Long id) {
        userRepository.deleteById(id);
    }
    
    private void validateEmail(String email) {
        if (!email.contains("@")) {
            throw new IllegalArgumentException("Invalid email");
        }
    }
}
