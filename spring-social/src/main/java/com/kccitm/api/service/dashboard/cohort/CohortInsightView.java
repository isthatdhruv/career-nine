package com.kccitm.api.service.dashboard.cohort;

import java.util.Date;

/** What the read endpoint returns for one (institute, assessment) card/detail. */
public class CohortInsightView {
    public Long instituteCode;
    public Long assessmentId;
    public String status;             // null = NOT_GENERATED; else PENDING/GENERATING/GENERATED/FAILED
    public String logicVersion;       // version stamped on the stored payload
    public String currentLogicVersion;// current aggregator version (for stale comparison)
    public boolean logicStale;        // stored logicVersion != current aggregator version
    public Integer includedCount;     // students folded into the stored generation
    public Integer completedCount;    // completed-count at generation time
    public int newSinceGeneration;    // current completed-count - includedCount (>=0)
    public Date computedAt;           // school_report.updatedAt
    public CohortInsightPayload payload; // non-null only when GENERATED
}
