package com.kccitm.api.model.email;

/**
 * Whether the code path that sends this mail actually renders this template.
 *
 * <p>{@code PORTED}: the call site goes through the dispatcher with a placeholder context, so
 * making this template the default changes what recipients get. {@code CONTENT_ONLY}: the
 * content was lifted from an inline builder so it can be seen and reviewed, but the sender
 * still builds the mail in Java; the template cannot be made the default until that sender
 * is migrated, because its placeholders would render empty.
 */
public enum PortState {
    PORTED,
    CONTENT_ONLY
}
