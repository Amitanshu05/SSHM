package com.smartstorage.api.entity;

import jakarta.persistence.*;

/**
 * Maps to the SQLite table: devices
 *
 * This table is created and updated by the Python worker.
 * Spring Boot only reads from it.
 */
@Entity
@Table(name = "devices")
public class Device {

    @Id
    @Column(name = "id")
    private Long id;

    @Column(name = "device_name")
    private String deviceName;

    @Column(name = "device_type")
    private String deviceType;

    @Column(name = "protocol")
    private String protocol;

    @Column(name = "model_name")
    private String modelName;

    @Column(name = "serial_number")
    private String serialNumber;

    @Column(name = "firmware_version")
    private String firmwareVersion;

    @Column(name = "capacity_bytes")
    private Long capacityBytes;

    @Column(name = "first_seen_epoch_ms")
    private Long firstSeenEpochMs;

    @Column(name = "last_seen_epoch_ms")
    private Long lastSeenEpochMs;

    public Long getId() {
        return id;
    }

    public String getDeviceName() {
        return deviceName;
    }

    public String getDeviceType() {
        return deviceType;
    }

    public String getProtocol() {
        return protocol;
    }

    public String getModelName() {
        return modelName;
    }

    public String getSerialNumber() {
        return serialNumber;
    }

    public String getFirmwareVersion() {
        return firmwareVersion;
    }

    public Long getCapacityBytes() {
        return capacityBytes;
    }

    public Long getFirstSeenEpochMs() {
        return firstSeenEpochMs;
    }

    public Long getLastSeenEpochMs() {
        return lastSeenEpochMs;
    }
}