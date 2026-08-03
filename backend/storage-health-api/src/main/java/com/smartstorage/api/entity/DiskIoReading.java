package com.smartstorage.api.entity;

import jakarta.persistence.*;

/**
 * Maps to SQLite table: disk_io_readings
 *
 * This table stores OS-level disk read/write activity collected by Python psutil.
 */
@Entity
@Table(name = "disk_io_readings")
public class DiskIoReading {

    @Id
    @Column(name = "id")
    private Long id;

    @Column(name = "disk_name")
    private String diskName;

    @Column(name = "ts_epoch_ms")
    private Long timestampEpochMs;

    @Column(name = "ts_utc")
    private String timestampUtc;

    @Column(name = "read_bytes_total")
    private Long readBytesTotal;

    @Column(name = "write_bytes_total")
    private Long writeBytesTotal;

    @Column(name = "read_count_total")
    private Long readCountTotal;

    @Column(name = "write_count_total")
    private Long writeCountTotal;

    @Column(name = "read_bytes_per_sec")
    private Double readBytesPerSec;

    @Column(name = "write_bytes_per_sec")
    private Double writeBytesPerSec;

    public Long getId() {
        return id;
    }

    public String getDiskName() {
        return diskName;
    }

    public Long getTimestampEpochMs() {
        return timestampEpochMs;
    }

    public String getTimestampUtc() {
        return timestampUtc;
    }

    public Long getReadBytesTotal() {
        return readBytesTotal;
    }

    public Long getWriteBytesTotal() {
        return writeBytesTotal;
    }

    public Long getReadCountTotal() {
        return readCountTotal;
    }

    public Long getWriteCountTotal() {
        return writeCountTotal;
    }

    public Double getReadBytesPerSec() {
        return readBytesPerSec;
    }

    public Double getWriteBytesPerSec() {
        return writeBytesPerSec;
    }
}