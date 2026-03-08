# Gmail SMTP Email Service Implementation

## Overview

A standalone Gmail SMTP email service has been successfully implemented for the Career-9 platform. This service provides a secure, flexible, and production-ready email solution using Spring Boot's JavaMailSender.

## What Was Implemented

### 1. Maven Dependency
- Added `spring-boot-starter-mail` dependency to `pom.xml`
- Location: Line 73-76

### 2. SMTP Configuration
- Configured SMTP settings in `application.yml` for all three profiles (dev, staging, production)
- Settings include:
  - Host: smtp.gmail.com
  - Port: 587 (STARTTLS)
  - Environment-based credentials (SMTP_USERNAME, SMTP_PASSWORD)
  - Connection timeouts: 5000ms (dev), 10000ms (staging/production)

### 3. New Java Classes

#### Exception Class
**File:** `/spring-social/src/main/java/com/kccitm/api/exception/EmailSendException.java`
- Custom exception for email sending failures
- Returns HTTP 500 (Internal Server Error)

#### DTO Class
**File:** `/spring-social/src/main/java/com/kccitm/api/model/userDefinedModel/SmtpEmailRequest.java`
- Request object for complex email scenarios
- Supports:
  - Multiple recipients (TO, CC, BCC)
  - HTML and text content
  - File attachments with content type specification
  - Custom from address and name

#### Configuration Class
**File:** `/spring-social/src/main/java/com/kccitm/api/config/SmtpMailConfig.java`
- Spring Configuration that creates JavaMailSender bean
- Reads all SMTP properties from application.yml
- Configures authentication, STARTTLS, and timeouts

#### Service Interface
**File:** `/spring-social/src/main/java/com/kccitm/api/service/SmtpEmailService.java`
- Defines four methods:
  1. `sendSimpleEmail()` - Simple text emails
  2. `sendHtmlEmail()` - HTML formatted emails
  3. `sendEmail()` - Comprehensive email with all features
  4. `sendEmailWithAttachment()` - Convenience method for attachments

#### Service Implementation
**File:** `/spring-social/src/main/java/com/kccitm/api/service/SmtpEmailServiceImpl.java`
- Complete implementation with:
  - Comprehensive input validation
  - SLF4J logging (INFO for success, ERROR for failures)
  - Exception handling with cause chaining
  - UTF-8 encoding support
  - Multipart email support (HTML + text fallback)
  - Attachment handling via ByteArrayDataSource

## Usage Examples

### Simple Text Email
```java
@Autowired
private SmtpEmailService smtpEmailService;

smtpEmailService.sendSimpleEmail(
    "student@example.com",
    "Assessment Reminder",
    "Your assessment starts tomorrow."
);
```

### HTML Email
```java
String htmlBody = "<h1>Welcome!</h1><p>Your account is ready.</p>";
smtpEmailService.sendHtmlEmail(
    "student@kccitm.edu.in",
    "Welcome to KCCITM",
    htmlBody
);
```

### Email with Attachment
```java
smtpEmailService.sendEmailWithAttachment(
    "student@kccitm.edu.in",
    "Your ID Card",
    "Please find your ID card attached.",
    "ID_Card.pdf",
    pdfBytes,
    "application/pdf"
);
```

### Complex Email with Custom Details
```java
SmtpEmailRequest request = new SmtpEmailRequest();
request.getTo().add("student@kccitm.edu.in");
request.getCc().add("admin@kccitm.edu.in");
request.setFromName("KCCITM Administration");
request.setSubject("Your Assessment Results");
request.setHtmlContent("<p>Please find your results attached.</p>");

// Add PDF attachment
SmtpEmailRequest.EmailAttachment attachment = new SmtpEmailRequest.EmailAttachment(
    "Results.pdf",
    pdfBytes,
    "application/pdf"
);
request.getAttachments().add(attachment);

smtpEmailService.sendEmail(request);
```

## Gmail Setup Requirements

### Step 1: Generate Gmail App Password

Since you're using `notifications@career-9.net` (or any Gmail account), you need to generate a Gmail App Password:

#### Detailed Steps:

1. **Go to Google Account Security**
   - Visit: https://myaccount.google.com/security
   - Sign in with your `notifications@career-9.net` account

2. **Enable 2-Step Verification** (if not already enabled)
   - Click on "2-Step Verification"
   - Follow the setup process (verify phone number, etc.)

3. **Generate App Password**
   - Go back to Security settings
   - Click "2-Step Verification"
   - Scroll down to "App passwords"
   - Click "App passwords"

4. **Create New App Password**
   - Select app: **Mail**
   - Select device: **Other (Custom name)**
   - Enter name: `Career-9 SMTP`
   - Click **Generate**

5. **Copy the 16-Character Password**
   - Google will show a 16-character password (e.g., `abcd efgh ijkl mnop`)
   - Copy it **without spaces**: `abcdefghijklmnop`
   - This is your `SMTP_PASSWORD`

6. **Save It Securely**
   - You won't be able to see it again
   - Store it in a password manager or secure location

### Step 2: Configure SMTP Credentials

You have several options to set your SMTP username and password:

#### Option 1: Environment Variables (Recommended for Production)

**On Linux/Mac:**
```bash
# Add to your ~/.bashrc or ~/.zshrc for permanent setup
export SMTP_USERNAME="notifications@career-9.net"
export SMTP_PASSWORD="your-app-password-here"

# Apply changes
source ~/.bashrc  # or source ~/.zshrc

# Then run your application
cd spring-social
mvn spring-boot:run
```

**Or set temporarily for current session:**
```bash
export SMTP_USERNAME="notifications@career-9.net"
export SMTP_PASSWORD="abcdefghijklmnop"
cd spring-social
mvn spring-boot:run
```

**On Windows (Command Prompt):**
```cmd
set SMTP_USERNAME=notifications@career-9.net
set SMTP_PASSWORD=abcdefghijklmnop

cd spring-social
mvn spring-boot:run
```

**On Windows (PowerShell):**
```powershell
$env:SMTP_USERNAME="notifications@career-9.net"
$env:SMTP_PASSWORD="abcdefghijklmnop"

cd spring-social
mvn spring-boot:run
```

#### Option 2: Pass as Command Line Arguments

```bash
cd spring-social
mvn spring-boot:run -Dspring-boot.run.arguments="--SMTP_USERNAME=notifications@career-9.net --SMTP_PASSWORD=abcdefghijklmnop"
```

#### Option 3: IDE Configuration

**IntelliJ IDEA:**
1. Go to **Run → Edit Configurations**
2. Select your Spring Boot application
3. In **Environment Variables** section, click the folder icon
4. Click **+** to add variables:
   - Name: `SMTP_USERNAME`, Value: `notifications@career-9.net`
   - Name: `SMTP_PASSWORD`, Value: `your-app-password-here`
5. Click **OK** and run the application

**Eclipse/STS:**
1. Right-click your project → **Run As → Run Configurations**
2. Select **Environment** tab
3. Click **New** to add each variable:
   - Name: `SMTP_USERNAME`, Value: `notifications@career-9.net`
   - Name: `SMTP_PASSWORD`, Value: `your-app-password-here`
4. Click **Apply** then **Run**

**VS Code:**
1. Create or edit `.vscode/launch.json`
2. Add environment variables to your configuration:
```json
{
  "configurations": [
    {
      "type": "java",
      "name": "Spring Boot App",
      "request": "launch",
      "mainClass": "com.kccitm.api.ApiApplication",
      "env": {
        "SMTP_USERNAME": "notifications@career-9.net",
        "SMTP_PASSWORD": "your-app-password-here"
      }
    }
  ]
}
```

#### Option 4: Docker/Docker Compose

**Edit your docker-compose.yml:**
```yaml
services:
  api:
    image: your-api-image
    environment:
      - SMTP_USERNAME=notifications@career-9.net
      - SMTP_PASSWORD=your-app-password-here
    # ... other configurations
```

**Or use an .env file (more secure):**

Create `.env` file in your docker-compose directory:
```bash
# .env file
SMTP_USERNAME=notifications@career-9.net
SMTP_PASSWORD=abcdefghijklmnop
```

Then reference in docker-compose.yml:
```yaml
services:
  api:
    env_file:
      - .env
```

**Important:** Add `.env` to your `.gitignore` to prevent committing credentials!

#### Option 5: System Environment Variables (Permanent)

**Linux/Mac:**
```bash
# Edit system profile
sudo nano /etc/environment

# Add these lines:
SMTP_USERNAME="notifications@career-9.net"
SMTP_PASSWORD="your-app-password-here"

# Save and reboot or re-login
```

**Windows:**
1. Search for "Environment Variables" in Windows Search
2. Click "Edit the system environment variables"
3. Click "Environment Variables" button
4. Under "System variables" or "User variables", click "New"
5. Add:
   - Variable name: `SMTP_USERNAME`
   - Variable value: `notifications@career-9.net`
6. Repeat for `SMTP_PASSWORD`
7. Click OK and restart your terminal/IDE

### Step 3: Verify Configuration

**Check if variables are set:**
```bash
# Linux/Mac
echo $SMTP_USERNAME
echo $SMTP_PASSWORD  # Won't show value for security

# Windows CMD
echo %SMTP_USERNAME%
echo %SMTP_PASSWORD%

# Windows PowerShell
echo $env:SMTP_USERNAME
echo $env:SMTP_PASSWORD
```

**Start the application:**
```bash
cd spring-social
mvn spring-boot:run
```

**Look for these in the logs:**
- `Creating JavaMailSender bean` - Configuration loaded
- No errors related to mail configuration

## Security Features

✅ **No Hardcoded Credentials** - All credentials via environment variables
✅ **Gmail App Passwords** - Uses app-specific passwords, not account password
✅ **No Credential Logging** - Sensitive data never logged
✅ **Environment-Specific Config** - Dev has fallback defaults, staging/prod require explicit env vars

### ⚠️ Important Security Notes

1. **Never Commit Credentials to Git**
   - Always use environment variables
   - Add `.env` files to `.gitignore`
   - Never hardcode passwords in `application.yml`

2. **Use App Passwords, Not Account Passwords**
   - App passwords are more secure
   - Can be revoked individually
   - Doesn't expose your main account password

3. **Protect Your App Password**
   - Store in password manager
   - Don't share via email or chat
   - Regenerate if compromised

4. **Environment-Specific Configuration**
   - **Dev profile:** Has fallback default (`notifications@career-9.net`) for convenience
   - **Staging/Production:** Requires explicit environment variables (no defaults)

5. **For Production Deployment**
   - Use Google Workspace account for higher limits
   - Configure SPF/DKIM records for your domain
   - Monitor email sending rates
   - Set up email logging/monitoring

## Quick Testing Guide

### Test 1: Create a Test Controller

Create this controller to verify the email service works:

```java
package com.kccitm.api.controller;

import com.kccitm.api.service.SmtpEmailService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/test-email")
public class EmailTestController {

    @Autowired
    private SmtpEmailService smtpEmailService;

    @GetMapping("/simple")
    public ResponseEntity<String> sendSimpleTest(@RequestParam String to) {
        try {
            smtpEmailService.sendSimpleEmail(
                to,
                "Test Email from Career-9",
                "This is a test email from the Career-9 SMTP service. If you receive this, the email service is working correctly!"
            );
            return ResponseEntity.ok("Simple email sent successfully to: " + to);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body("Failed to send email: " + e.getMessage());
        }
    }

    @GetMapping("/html")
    public ResponseEntity<String> sendHtmlTest(@RequestParam String to) {
        try {
            String htmlContent = """
                <html>
                <body>
                    <h1 style="color: #007bff;">Career-9 SMTP Service</h1>
                    <p>This is a <strong>test HTML email</strong>.</p>
                    <p>If you can see this formatted message, HTML emails are working!</p>
                    <hr>
                    <p style="color: #6c757d; font-size: 12px;">Sent from Career-9 Email Service</p>
                </body>
                </html>
                """;

            smtpEmailService.sendHtmlEmail(to, "HTML Test Email", htmlContent);
            return ResponseEntity.ok("HTML email sent successfully to: " + to);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body("Failed to send email: " + e.getMessage());
        }
    }
}
```

### Test 2: Send Test Emails

**Start your application:**
```bash
cd spring-social
mvn spring-boot:run
```

**Send a simple test email:**
```bash
curl "http://localhost:8091/test-email/simple?to=your-email@example.com"
```

**Send an HTML test email:**
```bash
curl "http://localhost:8091/test-email/html?to=your-email@example.com"
```

**Or test via browser:**
- http://localhost:8091/test-email/simple?to=your-email@example.com
- http://localhost:8091/test-email/html?to=your-email@example.com

### Test 3: Check Application Logs

Look for these log entries:

**Success logs:**
```
INFO  c.k.a.service.SmtpEmailServiceImpl - Sending simple email to: your-email@example.com with subject: Test Email from Career-9
INFO  c.k.a.service.SmtpEmailServiceImpl - Simple email sent successfully to: your-email@example.com
```

**Error logs (if credentials are wrong):**
```
ERROR c.k.a.service.SmtpEmailServiceImpl - Failed to send simple email to: your-email@example.com. Error: Authentication failed
```

### Test 4: Verify Email Delivery

1. Check your inbox for test emails
2. Check spam/junk folder if not in inbox
3. Verify sender shows as `notifications@career-9.net`
4. Verify HTML formatting works correctly

## Troubleshooting

### Issue: "Authentication failed" error

**Solution:**
- Verify SMTP_USERNAME is correct
- Verify SMTP_PASSWORD is the 16-character app password (no spaces)
- Ensure 2-Step Verification is enabled on Google Account
- Regenerate app password if needed

### Issue: "Connection timeout" error

**Solution:**
- Check internet connection
- Verify firewall allows outbound connections on port 587
- Check if your network blocks SMTP

### Issue: Environment variables not loaded

**Solution:**
```bash
# Verify variables are set
echo $SMTP_USERNAME
echo $SMTP_PASSWORD

# If not set, export them again
export SMTP_USERNAME="notifications@career-9.net"
export SMTP_PASSWORD="your-app-password"

# Then restart application
```

### Issue: Emails going to spam

**Solution:**
- Configure SPF records for your domain
- Set up DKIM signing
- Use Google Workspace instead of free Gmail
- Avoid spam trigger words in subject/body

### Issue: Rate limit exceeded

**Solution:**
- Gmail free account: 500 emails/day limit
- Google Workspace: 2,000 emails/day limit
- Implement rate limiting in your application
- Consider using email queue for bulk sending

## Key Features

- ✅ **Standalone Service** - No dependencies on existing email infrastructure
- ✅ **Multiple Recipient Types** - TO, CC, BCC support
- ✅ **HTML + Text Support** - Multipart emails with fallback
- ✅ **File Attachments** - Any file type via byte arrays
- ✅ **Custom From Address** - Configurable sender name and email
- ✅ **Comprehensive Logging** - Full audit trail of email operations
- ✅ **Robust Error Handling** - Custom exceptions with cause chaining
- ✅ **UTF-8 Encoding** - International character support
- ✅ **Production Ready** - Timeout configuration, connection pooling

## Verification Steps

### 1. Compilation Check ✅
```bash
cd spring-social
mvn clean compile
```
**Status:** Successful - All 277 source files compiled without errors

### 2. Bean Creation (After Starting App)
Check logs for JavaMailSender bean creation confirmation

### 3. Test Email Send
Create a simple test controller endpoint:
```java
@RestController
@RequestMapping("/test-email")
public class EmailTestController {

    @Autowired
    private SmtpEmailService smtpEmailService;

    @GetMapping("/send")
    public String sendTestEmail() {
        smtpEmailService.sendSimpleEmail(
            "test@example.com",
            "Test Email",
            "This is a test email from Career-9 SMTP service."
        );
        return "Email sent successfully!";
    }
}
```

## Limitations & Considerations

### Gmail Rate Limits
- **Free Gmail:** 500 emails/day
- **Google Workspace:** 2,000 emails/day
- **Recommendation:** Use Google Workspace account for production

### Attachment Size
- Maximum: 25MB per email (Gmail limit)

### Synchronous Operation
- Current implementation is synchronous
- For bulk operations, consider implementing async sending using `@Async`

### Future Enhancements (Optional)
1. **Async Email Sending** - For bulk operations
2. **Email Templates** - Reusable HTML templates
3. **Email Queue** - For retry logic and rate limiting
4. **Email Tracking** - Read receipts and delivery status
5. **Batch Sending** - Optimized for multiple recipients

## Production Deployment Checklist

- [ ] Configure Google Workspace account (higher sending limits)
- [ ] Set SMTP_USERNAME and SMTP_PASSWORD environment variables
- [ ] Configure SPF and DKIM records for your domain
- [ ] Monitor email sending rates
- [ ] Set up email logging/monitoring
- [ ] Test with actual user scenarios
- [ ] Configure firewall rules for SMTP port 587

## Files Modified/Created

### Modified Files (2)
1. `/spring-social/pom.xml` - Added spring-boot-starter-mail dependency
2. `/spring-social/src/main/resources/application.yml` - Added SMTP configuration for all profiles

### New Files (5)
1. `/spring-social/src/main/java/com/kccitm/api/exception/EmailSendException.java`
2. `/spring-social/src/main/java/com/kccitm/api/model/userDefinedModel/SmtpEmailRequest.java`
3. `/spring-social/src/main/java/com/kccitm/api/config/SmtpMailConfig.java`
4. `/spring-social/src/main/java/com/kccitm/api/service/SmtpEmailService.java`
5. `/spring-social/src/main/java/com/kccitm/api/service/SmtpEmailServiceImpl.java`

## Next Steps

1. **Set up Gmail credentials** using the instructions above
2. **Start the application** to verify bean creation
3. **Create a test controller** to validate email sending
4. **Test with actual email body/details** provided by users
5. **Monitor logs** for successful email delivery
6. **Configure for production** with Google Workspace account

## Support

For issues or questions:
- Check application logs for detailed error messages
- Verify Gmail App Password is correct (16 characters, no spaces)
- Ensure 2-Step Verification is enabled on Google Account
- Check firewall allows outbound connections on port 587

---

**Implementation Date:** 2026-02-06
**Compilation Status:** ✅ Successful
**Ready for Testing:** Yes
