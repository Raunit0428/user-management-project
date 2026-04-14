package com.example.usermanagement.repository;

import com.example.usermanagement.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Integer> {

    Optional<User> findByEmailIgnoreCase(String email);

    default Optional<User> findByEmail(String email) {
        return findByEmailIgnoreCase(email);
    }

    boolean existsByEmailIgnoreCase(String email);

    default boolean existsByEmail(String email) {
        return existsByEmailIgnoreCase(email);
    }

    // Search by name OR email, case-insensitive, partial match
    @Query("SELECT u FROM User u WHERE " +
           "LOWER(u.name) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
           "LOWER(u.email) LIKE LOWER(CONCAT('%', :q, '%'))")
    List<User> searchByNameOrEmail(@Param("q") String query);
}
