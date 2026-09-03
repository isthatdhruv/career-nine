package com.kccitm.api.controller;

import java.net.URI;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.ShortLink;
import com.kccitm.api.service.link.ShortLinkService;

/**
 * The redirect behind every short link we email or WhatsApp: {@code /s/{code}} → the real URL.
 *
 * <p>Anonymous by design, and listed in {@code SecurityConfig.PUBLIC_PATHS}. It has to be: the
 * whole point is a student opening a link from their phone with no session. There is nothing to
 * authorise here — the code reveals a URL, and that URL's own token is what decides whether the
 * page behind it opens. A guessed code buys an attacker exactly what an intercepted email would,
 * which is the threat model these tokenized links already live with.
 *
 * <p>302 rather than 301 on purpose. A permanent redirect is cached by the browser forever, and
 * these targets carry tokens that expire; a stale cached hop would be untraceable and impossible
 * to correct.
 */
@RestController
public class ShortLinkController {

    private static final Logger logger = LoggerFactory.getLogger(ShortLinkController.class);

    @Autowired
    private ShortLinkService shortLinkService;

    /**
     * @param code 4–16 URL-safe characters. The pattern is on the mapping so that a stray
     *             {@code /s/something/else} 404s at routing rather than reaching this method.
     */
    @GetMapping("/s/{code:[A-Za-z0-9]{4,16}}")
    public ResponseEntity<String> follow(@PathVariable String code) {
        Optional<ShortLink> found = shortLinkService.resolve(code);
        if (!found.isPresent()) {
            logger.info("Short link {} is unknown or expired", code);
            return expiredPage();
        }

        ShortLink link = found.get();
        String target = link.getTargetUrl();
        // We only ever store URLs we built ourselves, so this cannot currently fail — it is here
        // so that it stays true if anything ever writes to the table from elsewhere.
        if (target == null || !(target.startsWith("https://") || target.startsWith("http://"))) {
            logger.error("Short link {} points at something that is not an http(s) URL — refusing", code);
            return expiredPage();
        }

        shortLinkService.recordHit(link.getId());

        HttpHeaders headers = new HttpHeaders();
        headers.setLocation(URI.create(target));
        // The mapping is a secret in the same sense the target is: keep it out of shared caches
        // and out of search engines.
        headers.setCacheControl("no-store, no-cache, must-revalidate");
        headers.add("X-Robots-Tag", "noindex, nofollow");
        return new ResponseEntity<>(headers, HttpStatus.FOUND);
    }

    /**
     * What a dead code shows. A bare 404 reads as "the site is broken" and generates a support
     * mail; this says what happened and what to do about it.
     */
    private ResponseEntity<String> expiredPage() {
        String html = "<!DOCTYPE html><html><head><meta charset=\"UTF-8\">"
                + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
                + "<title>This link is no longer active</title></head>"
                + "<body style=\"margin:0;background:#f1f4f9;font-family:-apple-system,"
                + "BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;\">"
                + "<div style=\"max-width:520px;margin:0 auto;padding:48px 20px;\">"
                // Same masthead and card as the mail that carried the link here.
                + "<div style=\"background:#047857;"
                + "background-image:linear-gradient(135deg,#059669 0%,#047857 100%);"
                + "border-radius:12px 12px 0 0;padding:20px 28px;font-size:17px;font-weight:700;"
                + "letter-spacing:1.5px;color:#ffffff;\">CAREER&#8209;9</div>"
                + "<div style=\"background:#ffffff;border:1px solid #e4e7ec;border-top:none;"
                + "border-radius:0 0 12px 12px;padding:32px 28px;\">"
                + "<h1 style=\"margin:0 0 14px 0;font-size:21px;line-height:1.35;color:#101828;\">"
                + "This link is no longer active</h1>"
                + "<p style=\"margin:0 0 14px 0;font-size:15px;line-height:1.65;color:#101828;\">"
                + "It may have expired, or it may have been mistyped &mdash; links from us are "
                + "easiest to open by tapping them in the email rather than copying them out.</p>"
                + "<p style=\"margin:0;font-size:15px;line-height:1.65;color:#101828;\">"
                + "Reply to the email you received and we will send you a fresh one.</p>"
                + "</div>"
                + "<p style=\"padding:18px 8px 0 8px;font-size:11px;line-height:1.7;color:#667085;\">"
                + "&copy; Career-9. All rights reserved.</p>"
                + "</div></body></html>";
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .contentType(MediaType.TEXT_HTML)
                .cacheControl(org.springframework.http.CacheControl.noStore())
                .body(html);
    }
}
