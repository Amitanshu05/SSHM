package com.smartstorage.api.dto;

import java.util.List;

/**
 * Request body accepted from the local Python telemetry agent.
 */
public class IngestSnapshotRequest {

    private DevicePayload device;
    private SmartPayload smart;
    private DiskIoPayload diskIo;
    private List<PartitionPayload> partitions;
    private AnalysisPayload analysis;

    public DevicePayload getDevice() {
        return device;
    }

    public void setDevice(DevicePayload device) {
        this.device = device;
    }

    public SmartPayload getSmart() {
        return smart;
    }

    public void setSmart(SmartPayload smart) {
        this.smart = smart;
    }

    public DiskIoPayload getDiskIo() {
        return diskIo;
    }

    public void setDiskIo(DiskIoPayload diskIo) {
        this.diskIo = diskIo;
    }

    public List<PartitionPayload> getPartitions() {
        return partitions;
    }

    public void setPartitions(List<PartitionPayload> partitions) {
        this.partitions = partitions;
    }

    public AnalysisPayload getAnalysis() {
        return analysis;
    }

    public void setAnalysis(AnalysisPayload analysis) {
        this.analysis = analysis;
    }

    public static class DevicePayload {
        private String deviceName;
        private String deviceType;
        private String protocol;
        private String modelName;
        private String serialNumber;
        private String firmwareVersion;
        private Long capacityBytes;

        public String getDeviceName() {
            return deviceName;
        }

        public void setDeviceName(String deviceName) {
            this.deviceName = deviceName;
        }

        public String getDeviceType() {
            return deviceType;
        }

        public void setDeviceType(String deviceType) {
            this.deviceType = deviceType;
        }

        public String getProtocol() {
            return protocol;
        }

        public void setProtocol(String protocol) {
            this.protocol = protocol;
        }

        public String getModelName() {
            return modelName;
        }

        public void setModelName(String modelName) {
            this.modelName = modelName;
        }

        public String getSerialNumber() {
            return serialNumber;
        }

        public void setSerialNumber(String serialNumber) {
            this.serialNumber = serialNumber;
        }

        public String getFirmwareVersion() {
            return firmwareVersion;
        }

        public void setFirmwareVersion(String firmwareVersion) {
            this.firmwareVersion = firmwareVersion;
        }

        public Long getCapacityBytes() {
            return capacityBytes;
        }

        public void setCapacityBytes(Long capacityBytes) {
            this.capacityBytes = capacityBytes;
        }
    }

    public static class SmartPayload {
        private Long timestampEpochMs;
        private String timestampUtc;
        private Boolean smartAvailable;
        private Boolean smartPassed;
        private Integer reallocatedSectors;
        private Integer powerOnHours;
        private Integer pendingSectors;
        private Integer temperatureCelsius;
        private String rawJson;
        private String errorMessage;

        public Long getTimestampEpochMs() {
            return timestampEpochMs;
        }

        public void setTimestampEpochMs(Long timestampEpochMs) {
            this.timestampEpochMs = timestampEpochMs;
        }

        public String getTimestampUtc() {
            return timestampUtc;
        }

        public void setTimestampUtc(String timestampUtc) {
            this.timestampUtc = timestampUtc;
        }

        public Boolean getSmartAvailable() {
            return smartAvailable;
        }

        public void setSmartAvailable(Boolean smartAvailable) {
            this.smartAvailable = smartAvailable;
        }

        public Boolean getSmartPassed() {
            return smartPassed;
        }

        public void setSmartPassed(Boolean smartPassed) {
            this.smartPassed = smartPassed;
        }

        public Integer getReallocatedSectors() {
            return reallocatedSectors;
        }

        public void setReallocatedSectors(Integer reallocatedSectors) {
            this.reallocatedSectors = reallocatedSectors;
        }

        public Integer getPowerOnHours() {
            return powerOnHours;
        }

        public void setPowerOnHours(Integer powerOnHours) {
            this.powerOnHours = powerOnHours;
        }

        public Integer getPendingSectors() {
            return pendingSectors;
        }

        public void setPendingSectors(Integer pendingSectors) {
            this.pendingSectors = pendingSectors;
        }

        public Integer getTemperatureCelsius() {
            return temperatureCelsius;
        }

        public void setTemperatureCelsius(Integer temperatureCelsius) {
            this.temperatureCelsius = temperatureCelsius;
        }

        public String getRawJson() {
            return rawJson;
        }

        public void setRawJson(String rawJson) {
            this.rawJson = rawJson;
        }

        public String getErrorMessage() {
            return errorMessage;
        }

        public void setErrorMessage(String errorMessage) {
            this.errorMessage = errorMessage;
        }
    }

    public static class DiskIoPayload {
        private String diskName;
        private Long timestampEpochMs;
        private String timestampUtc;
        private Long readBytesTotal;
        private Long writeBytesTotal;
        private Long readCountTotal;
        private Long writeCountTotal;
        private Double readBytesPerSec;
        private Double writeBytesPerSec;

        public String getDiskName() {
            return diskName;
        }

        public void setDiskName(String diskName) {
            this.diskName = diskName;
        }

        public Long getTimestampEpochMs() {
            return timestampEpochMs;
        }

        public void setTimestampEpochMs(Long timestampEpochMs) {
            this.timestampEpochMs = timestampEpochMs;
        }

        public String getTimestampUtc() {
            return timestampUtc;
        }

        public void setTimestampUtc(String timestampUtc) {
            this.timestampUtc = timestampUtc;
        }

        public Long getReadBytesTotal() {
            return readBytesTotal;
        }

        public void setReadBytesTotal(Long readBytesTotal) {
            this.readBytesTotal = readBytesTotal;
        }

        public Long getWriteBytesTotal() {
            return writeBytesTotal;
        }

        public void setWriteBytesTotal(Long writeBytesTotal) {
            this.writeBytesTotal = writeBytesTotal;
        }

        public Long getReadCountTotal() {
            return readCountTotal;
        }

        public void setReadCountTotal(Long readCountTotal) {
            this.readCountTotal = readCountTotal;
        }

        public Long getWriteCountTotal() {
            return writeCountTotal;
        }

        public void setWriteCountTotal(Long writeCountTotal) {
            this.writeCountTotal = writeCountTotal;
        }

        public Double getReadBytesPerSec() {
            return readBytesPerSec;
        }

        public void setReadBytesPerSec(Double readBytesPerSec) {
            this.readBytesPerSec = readBytesPerSec;
        }

        public Double getWriteBytesPerSec() {
            return writeBytesPerSec;
        }

        public void setWriteBytesPerSec(Double writeBytesPerSec) {
            this.writeBytesPerSec = writeBytesPerSec;
        }
    }

    public static class PartitionPayload {
        private String mountpoint;
        private String device;
        private String filesystem;
        private Long timestampEpochMs;
        private String timestampUtc;
        private Long totalBytes;
        private Long usedBytes;
        private Long freeBytes;
        private Double usagePercent;

        public String getMountpoint() {
            return mountpoint;
        }

        public void setMountpoint(String mountpoint) {
            this.mountpoint = mountpoint;
        }

        public String getDevice() {
            return device;
        }

        public void setDevice(String device) {
            this.device = device;
        }

        public String getFilesystem() {
            return filesystem;
        }

        public void setFilesystem(String filesystem) {
            this.filesystem = filesystem;
        }

        public Long getTimestampEpochMs() {
            return timestampEpochMs;
        }

        public void setTimestampEpochMs(Long timestampEpochMs) {
            this.timestampEpochMs = timestampEpochMs;
        }

        public String getTimestampUtc() {
            return timestampUtc;
        }

        public void setTimestampUtc(String timestampUtc) {
            this.timestampUtc = timestampUtc;
        }

        public Long getTotalBytes() {
            return totalBytes;
        }

        public void setTotalBytes(Long totalBytes) {
            this.totalBytes = totalBytes;
        }

        public Long getUsedBytes() {
            return usedBytes;
        }

        public void setUsedBytes(Long usedBytes) {
            this.usedBytes = usedBytes;
        }

        public Long getFreeBytes() {
            return freeBytes;
        }

        public void setFreeBytes(Long freeBytes) {
            this.freeBytes = freeBytes;
        }

        public Double getUsagePercent() {
            return usagePercent;
        }

        public void setUsagePercent(Double usagePercent) {
            this.usagePercent = usagePercent;
        }
    }

    public static class AnalysisPayload {
        private Long timestampEpochMs;
        private String timestampUtc;
        private Double failureProbability30d;
        private Double healthScore;
        private String riskLevel;
        private String modelName;
        private String modelVersion;
        private Double modelConfidence;
        private String analysisSummary;
        private String recommendation;
        private String topSignalsJson;
        private Boolean geminiUsed;

        public Long getTimestampEpochMs() {
            return timestampEpochMs;
        }

        public void setTimestampEpochMs(Long timestampEpochMs) {
            this.timestampEpochMs = timestampEpochMs;
        }

        public String getTimestampUtc() {
            return timestampUtc;
        }

        public void setTimestampUtc(String timestampUtc) {
            this.timestampUtc = timestampUtc;
        }

        public Double getFailureProbability30d() {
            return failureProbability30d;
        }

        public void setFailureProbability30d(Double failureProbability30d) {
            this.failureProbability30d = failureProbability30d;
        }

        public Double getHealthScore() {
            return healthScore;
        }

        public void setHealthScore(Double healthScore) {
            this.healthScore = healthScore;
        }

        public String getRiskLevel() {
            return riskLevel;
        }

        public void setRiskLevel(String riskLevel) {
            this.riskLevel = riskLevel;
        }

        public String getModelName() {
            return modelName;
        }

        public void setModelName(String modelName) {
            this.modelName = modelName;
        }

        public String getModelVersion() {
            return modelVersion;
        }

        public void setModelVersion(String modelVersion) {
            this.modelVersion = modelVersion;
        }

        public Double getModelConfidence() {
            return modelConfidence;
        }

        public void setModelConfidence(Double modelConfidence) {
            this.modelConfidence = modelConfidence;
        }

        public String getAnalysisSummary() {
            return analysisSummary;
        }

        public void setAnalysisSummary(String analysisSummary) {
            this.analysisSummary = analysisSummary;
        }

        public String getRecommendation() {
            return recommendation;
        }

        public void setRecommendation(String recommendation) {
            this.recommendation = recommendation;
        }

        public String getTopSignalsJson() {
            return topSignalsJson;
        }

        public void setTopSignalsJson(String topSignalsJson) {
            this.topSignalsJson = topSignalsJson;
        }

        public Boolean getGeminiUsed() {
            return geminiUsed;
        }

        public void setGeminiUsed(Boolean geminiUsed) {
            this.geminiUsed = geminiUsed;
        }
    }
}
