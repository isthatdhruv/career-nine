package com.kccitm.api.model.career9;

import java.io.Serializable;
import java.time.Instant;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Index;
import javax.persistence.Lob;
import javax.persistence.Table;
import javax.persistence.UniqueConstraint;

@Entity
@Table(
    name = "dashboard_snapshot",
    uniqueConstraints = @UniqueConstraint(columnNames = {"snapshot_key"}),
    indexes = {
        @Index(name = "idx_dashboard_snapshot_key", columnList = "snapshot_key")
    }
)
public class DashboardSnapshot implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "snapshot_key", nullable = false, length = 128)
    private String snapshotKey;

    // Snapshot payload can be hundreds of MB on a real DB; store as LONGTEXT
    // so MySQL doesn't truncate at TEXT's ~64KB limit.
    @Lob
    @Column(name = "payload_json", nullable = false, columnDefinition = "LONGTEXT")
    private String payloadJson;

    @Column(name = "computed_at", nullable = false)
    private Instant computedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getSnapshotKey() { return snapshotKey; }
    public void setSnapshotKey(String v) { this.snapshotKey = v; }

    public String getPayloadJson() { return payloadJson; }
    public void setPayloadJson(String v) { this.payloadJson = v; }

    public Instant getComputedAt() { return computedAt; }
    public void setComputedAt(Instant v) { this.computedAt = v; }
}
