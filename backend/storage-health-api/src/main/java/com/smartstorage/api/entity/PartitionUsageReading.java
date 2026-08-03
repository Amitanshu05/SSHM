package com.smartstorage.api.entity;

import jakarta.persistence.*;

/**
 * Maps to SQLite table: partition_usage_readings
 *
 * This table stores partition-level storage usage collected by Python psutil.
 */
@Entity
@Table(name = "partition_usage_readings")
public class PartitionUsageReading {

    @Id
    @Column(name = "id")
    private Long id;

    @Column(name = "mountpoint")
    private String mountpoint;

    @Column(name = "device")
    private String device;

    @Column(name = "filesystem")
    private String filesystem;

    @Column(name = "ts_epoch_ms")
    private Long timestampEpochMs;

    @Column(name = "ts_utc")
    private String timestampUtc;

    @Column(name = "total_bytes")
    private Long totalBytes;

    @Column(name = "used_bytes")
    private Long usedBytes;

    @Column(name = "free_bytes")
    private Long freeBytes;

    @Column(name = "usage_percent")
    private Double usagePercent;

    public Long getId() {
        return id;
    }

    public String getMountpoint() {
        return mountpoint;
    }

    public String getDevice() {
        return device;
    }

    public String getFilesystem() {
        return filesystem;
    }

    public Long getTimestampEpochMs() {
        return timestampEpochMs;
    }

    public String getTimestampUtc() {
        return timestampUtc;
    }

    public Long getTotalBytes() {
        return totalBytes;
    }

    public Long getUsedBytes() {
        return usedBytes;
    }

    public Long getFreeBytes() {
        return freeBytes;
    }

    public Double getUsagePercent() {
        return usagePercent;
    }
}