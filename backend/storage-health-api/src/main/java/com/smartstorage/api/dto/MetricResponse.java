package com.smartstorage.api.dto;

/**
 * This class defines the exact JSON structure returned by the API.
 *
 * React frontend will receive data in this format.
 */
public class MetricResponse {

    private Long readingId;
    private Long deviceId;

    private String deviceName;
    private String modelName;
    private String protocol;

    private Long timestampEpochMs;
    private String timestampUtc;

    private Boolean smartAvailable;
    private Boolean smartPassed;

    private Integer reallocatedSectors;
    private Integer powerOnHours;
    private Integer pendingSectors;
    private Integer temperatureCelsius;

    private String errorMessage;

    public MetricResponse(
            Long readingId,
            Long deviceId,
            String deviceName,
            String modelName,
            String protocol,
            Long timestampEpochMs,
            String timestampUtc,
            Boolean smartAvailable,
            Boolean smartPassed,
            Integer reallocatedSectors,
            Integer powerOnHours,
            Integer pendingSectors,
            Integer temperatureCelsius,
            String errorMessage
    ) {
        this.readingId = readingId;
        this.deviceId = deviceId;
        this.deviceName = deviceName;
        this.modelName = modelName;
        this.protocol = protocol;
        this.timestampEpochMs = timestampEpochMs;
        this.timestampUtc = timestampUtc;
        this.smartAvailable = smartAvailable;
        this.smartPassed = smartPassed;
        this.reallocatedSectors = reallocatedSectors;
        this.powerOnHours = powerOnHours;
        this.pendingSectors = pendingSectors;
        this.temperatureCelsius = temperatureCelsius;
        this.errorMessage = errorMessage;
    }

    public Long getReadingId() {
        return readingId;
    }

    public Long getDeviceId() {
        return deviceId;
    }

    public String getDeviceName() {
        return deviceName;
    }

    public String getModelName() {
        return modelName;
    }

    public String getProtocol() {
        return protocol;
    }

    public Long getTimestampEpochMs() {
        return timestampEpochMs;
    }

    public String getTimestampUtc() {
        return timestampUtc;
    }

    public Boolean getSmartAvailable() {
        return smartAvailable;
    }

    public Boolean getSmartPassed() {
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