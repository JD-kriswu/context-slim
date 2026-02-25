# test/fixtures Overview (L1)

## test/fixtures/User.java

```java
package com.example.model

imports: java.* (3), javax.* (1), lombok.* (2)

@Entity @Data @Builder
public class User implements Serializable, Comparable, User
int compareTo(User other)
boolean isAdmin()
void updateTimestamp()
T getMetadataAs(String key, Class<T> type)
void addTags(String... tags)

public class UserBuilder
UserBuilder withDefaults()

public enum UserRole
```

## test/fixtures/UserService.java

```java
package com.example.service

imports: java.* (2), org.* (2)

@Service
public class UserService
List<User> findAll()
Optional<User> findById(Long id)
User create(String name, String email)
void delete(Long id)
```
