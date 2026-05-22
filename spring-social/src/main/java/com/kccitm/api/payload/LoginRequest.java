package com.kccitm.api.payload;

import java.util.Date;

import com.fasterxml.jackson.annotation.JsonFormat;

/**
 * Login request for the unified login endpoint.
 *
 * <p>Two modes (selected by {@link #mode}):
 * <ul>
 *   <li>{@code "staff"} (default): {@link #email} + {@link #password} authenticated
 *       against the local provider via the AuthenticationManager.</li>
 *   <li>{@code "student"}: {@link #email} carries a username OR email and
 *       {@link #dob} is the secret — students have no password. The backend verifies
 *       the user has a UserStudent record before issuing a session.</li>
 * </ul>
 *
 * <p>Field-level bean validation is intentionally relaxed (no {@code @Email}/{@code @NotBlank})
 * because the same body serves both modes; per-mode validation happens in the controller.
 */
public class LoginRequest {

    private String email;

    private String password;

    /** "staff" (default) or "student". */
    private String mode;

    /** Student date of birth (student mode only). */
    @JsonFormat(pattern = "dd-MM-yyyy")
    private Date dob;

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public Date getDob() {
        return dob;
    }

    public void setDob(Date dob) {
        this.dob = dob;
    }

    public boolean isStudentMode() {
        return "student".equalsIgnoreCase(mode);
    }
}
