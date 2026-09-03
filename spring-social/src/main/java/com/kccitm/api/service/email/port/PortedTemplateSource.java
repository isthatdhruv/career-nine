package com.kccitm.api.service.email.port;

import java.util.List;

/**
 * A group of {@link PortedTemplate}s, one Spring bean per area of the codebase
 * (auth, payments, counselling, …). {@code CodePortSeeder} collects every bean on boot.
 */
public interface PortedTemplateSource {
    List<PortedTemplate> templates();
}
