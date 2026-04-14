package com.example.usermanagement.controller;

import com.example.usermanagement.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.naming.NamingException;
import javax.naming.directory.Attributes;
import javax.naming.directory.InitialDirContext;
import java.util.Hashtable;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * EmailValidationController
 *
 * Three endpoints for real-time frontend email checks:
 *
 *  GET /email/format-check?email=        — regex + TLD rules
 *  GET /email/mx-check?email=            — real DNS MX record lookup (proves domain can receive mail)
 *  GET /email/duplicate-check?email=&excludeId=  — DB duplicate guard
 */
@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/email")
public class EmailValidationController {

    private static final Pattern EMAIL_PATTERN = Pattern.compile(
        "^[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}$"
    );

    // Known disposable/fake email providers that should be blocked
    private static final Set<String> BLOCKED_DOMAINS = Set.of(
        "mailinator.com", "guerrillamail.com", "tempmail.com", "throwaway.email",
        "fakeinbox.com", "sharklasers.com", "yopmail.com", "trashmail.com",
        "dispostable.com", "maildrop.cc", "spam4.me", "test.com",
        "example.com", "fake.com", "nomail.com", "noemail.com"
    );

    @Autowired
    private UserRepository userRepository;

    /** Step 1 — format check */
    @GetMapping("/format-check")
    public ResponseEntity<Map<String, Object>> checkFormat(@RequestParam String email) {
        if (email == null || email.isBlank())
            return ok(false, "Email is required");

        String e = email.trim().toLowerCase();

        if (!EMAIL_PATTERN.matcher(e).matches())
            return ok(false, "Invalid format — use user@domain.com");

        String domain = e.substring(e.indexOf('@') + 1);

        if (!domain.contains("."))
            return ok(false, "Domain must contain a dot (e.g. gmail.com)");

        String tld = domain.substring(domain.lastIndexOf('.') + 1);
        if (tld.length() < 2)
            return ok(false, "Invalid top-level domain");

        if (BLOCKED_DOMAINS.contains(domain))
            return ok(false, "Disposable or test email addresses are not allowed");

        // Local part checks
        String local = e.substring(0, e.indexOf('@'));
        if (local.startsWith(".") || local.endsWith("."))
            return ok(false, "Email local part cannot start or end with a dot");
        if (local.contains(".."))
            return ok(false, "Email local part cannot have consecutive dots");

        return ok(true, "Format is valid");
    }

    /**
     * Step 2 — real DNS MX record lookup.
     * This proves the domain is configured to actually receive email.
     * Works entirely server-side — no third-party API key needed.
     */
    @GetMapping("/mx-check")
    public ResponseEntity<Map<String, Object>> checkMx(@RequestParam String email) {
        if (email == null || email.isBlank())
            return okMx(false, "Email is required");

        String domain = email.trim().toLowerCase();
        int at = domain.indexOf('@');
        if (at < 0) return okMx(false, "Invalid email");
        domain = domain.substring(at + 1);

        try {
            Hashtable<String, String> env = new Hashtable<>();
            env.put("java.naming.factory.initial", "com.sun.jndi.dns.DnsContextFactory");
            env.put("com.sun.jndi.dns.timeout.initial", "3000");
            env.put("com.sun.jndi.dns.timeout.retries", "1");

            InitialDirContext ctx = new InitialDirContext(env);
            Attributes attrs = ctx.getAttributes("dns:/" + domain, new String[]{"MX"});
            ctx.close();

            if (attrs.get("MX") != null && attrs.get("MX").size() > 0) {
                return okMx(true, "Domain can receive email ✓");
            } else {
                // No MX record — try A record fallback (some small domains use A-record delivery)
                Attributes aAttrs = new InitialDirContext(env)
                    .getAttributes("dns:/" + domain, new String[]{"A"});
                if (aAttrs.get("A") != null) {
                    return okMx(true, "Domain exists ✓");
                }
                return okMx(false, "This domain cannot receive emails (no MX record)");
            }
        } catch (NamingException ex) {
            // Domain does not exist in DNS
            return okMx(false, "Domain does not exist or cannot be reached");
        }
    }

    /** Step 3 — duplicate check in DB */
    @GetMapping("/duplicate-check")
    public ResponseEntity<Map<String, Object>> checkDuplicate(
            @RequestParam String email,
            @RequestParam(required = false) Integer excludeId) {

        if (email == null || email.isBlank())
            return ResponseEntity.ok(Map.of("available", false, "message", "Email is required"));

        String trimmed = email.trim().toLowerCase();

        boolean exists = userRepository.findByEmail(trimmed)
                .map(user -> excludeId == null || !user.getId().equals(excludeId))
                .orElse(false);

        if (exists)
            return ResponseEntity.ok(Map.of("available", false, "message", "This email is already registered"));

        return ResponseEntity.ok(Map.of("available", true, "message", "Email is available"));
    }

    // ── helpers ──────────────────────────────────────────
    private ResponseEntity<Map<String, Object>> ok(boolean valid, String msg) {
        return ResponseEntity.ok(Map.of("valid", valid, "message", msg));
    }

    private ResponseEntity<Map<String, Object>> okMx(boolean valid, String msg) {
        return ResponseEntity.ok(Map.of("valid", valid, "message", msg));
    }
}
