package com.kccitm.api.controller;

import java.net.URI;

import javax.validation.Valid;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import com.kccitm.api.exception.BadRequestException;
import com.kccitm.api.model.AuthProvider;
import com.kccitm.api.model.User;
import com.kccitm.api.payload.ApiResponse;
import com.kccitm.api.payload.AuthResponse;
import com.kccitm.api.payload.LoginRequest;
import com.kccitm.api.payload.SignUpRequest;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.security.TokenProvider;

@RestController
@RequestMapping("/auth")

public class AuthController {

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private com.kccitm.api.service.SmtpEmailService smtpEmailService;

    @Autowired
    private TokenProvider tokenProvider;

    @PostMapping("/login")
    public ResponseEntity<?> authenticateUser(@Valid @RequestBody LoginRequest loginRequest) {
        User user = userRepository.findByEmail(loginRequest.getEmail());
        if (user == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiResponse(false, "Invalid email or password."));
        }
        if (user.getIsActive() == null || !user.getIsActive()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiResponse(false, "Your registration is under Process"));
        }

        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        loginRequest.getEmail(),
                        loginRequest.getPassword()));

        SecurityContextHolder.getContext().setAuthentication(authentication);

        String token = tokenProvider.createToken(authentication);
        return ResponseEntity.ok(new AuthResponse(token));
    }

    @PostMapping("/signup")
    public ResponseEntity<?> registerUser(@Valid @RequestBody SignUpRequest signUpRequest) {
        if (userRepository.existsByEmail(signUpRequest.getEmail())) {
            throw new BadRequestException("Email address already in use.");
        }
        if (signUpRequest.getPhone() == null || signUpRequest.getPhone().trim().isEmpty()) {
            throw new BadRequestException("Phone number is required.");
        }
        if (userRepository.existsByPhone(signUpRequest.getPhone())) {
            throw new BadRequestException("Phone number already in use.");
        }
        if (signUpRequest.getAcceptTerms() == null || !signUpRequest.getAcceptTerms()) {
            throw new BadRequestException("You must accept the terms and conditions.");
        }

    // Creating user's account
    User user = new User();
    // set name from firstname+lastname if available otherwise use provided name
    String fullName = (signUpRequest.getFirstname() != null && !signUpRequest.getFirstname().isBlank())
        ? signUpRequest.getFirstname() + " " + signUpRequest.getLastname()
        : "";
    user.setName(signUpRequest.getFirstname() + " " + signUpRequest.getLastname());
    user.setEmail(signUpRequest.getEmail());
    user.setPhone(signUpRequest.getPhone());
    user.setOrganisation(signUpRequest.getOrganisation());
    user.setDesignation(signUpRequest.getDesignation());
    user.setAcceptTerms(signUpRequest.getAcceptTerms());
    user.setProvider(AuthProvider.local);

    user.setPassword(passwordEncoder.encode(signUpRequest.getPassword()));

    User result = userRepository.save(user);

        URI location = ServletUriComponentsBuilder
                .fromCurrentContextPath().path("/user/me")
                .buildAndExpand(result.getId()).toUri();

    // Send welcome email asynchronously (fire-and-forget)
    try {
        String subject = "Welcome to Career-9";
        String body = "Hello " + fullName + ",\n\nThank you for registering.We will get back to you soon.\n\nRegards,\nCareer-9 Team";
        smtpEmailService.sendSimpleEmail(result.getEmail(), subject, body);
    } catch (Exception e) {
        // log and continue - do not fail registration because of email
    }

    return ResponseEntity.created(location)
        .body(new ApiResponse(true, "User registered successfully"));
    }

}
