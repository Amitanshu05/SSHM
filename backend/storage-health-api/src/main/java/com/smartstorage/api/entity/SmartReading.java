package com.smartstorage.api.entity;

import jakarta.persistence.*;

/**
 * Maps to the SQLite table: smart_readings
 *
 * This table stores time-series SMART telemetry collected by the Python worker.
 */
@Entity
@Table(name = "smart_readings")
public class SmartReading {

    @Id
    @Column(name = "id")
    private Long id;

    /**
     * smart_readings.device_id connects to devices.id
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "device_id", nullable = false)
    private Device device;

    @Column(name = "ts_epoch_ms")
    private Long timestampEpochMs;

    @Column(name = "ts_utc")
    private String timestampUtc;

    @Column(name = "smart_available")
    private Integer smartAvailable;

    @Column(name = "smart_passed")
    private Integer smartPassed;

    @Column(name = "reallocated_sectors")
    private Integer reallocatedSectors;

    @Column(name = "power_on_hours")
    private Integer powerOnHours;

    @Column(name = "pending_sectors")
    private Integer pendingSectors;

    @Column(name = "temperature_celsius")
    private Integer temperatureCelsius;

    @Column(name = "error_message")
    private String errorMessage;

    public Long getId() {
        return id;
    }

    public Device getDevice() {
        return device;
    }

    public Long getTimestampEpochMs() {
        return timestampEpochMs;
    }

    public String getTimestampUtc() {
        return timestampUtc;
    }

    public Integer getSmartAvailable() {
        return smartAvailable;
    }

    public Integer getSmartPassed() {
        return smartPassed;
    }

    public Integer getReallocatedSectors() {
        return reallocatedSectors;
    }

    public Integer getPowerOnHours() {
        return powerOnHours;
    }

    public Integer getPendingSectors() {
        return pendingSectors;
    }

    public Integer getTemperatureCelsius() {
        return temperatureCelsius;
    }

    public String getErrorMessage() {
        return errorMessage;
    }
}