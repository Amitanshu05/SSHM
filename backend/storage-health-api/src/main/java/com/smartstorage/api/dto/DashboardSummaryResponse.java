package com.smartstorage.api.dto;

import java.util.List;

/**
 * Combined dashboard response.
 *
 * This DTO gives the React dashboard one clean object containing:
 * - latest SMART health
 * - latest disk I/O speed
 * - latest partition usage rows
 */
public class DashboardSummaryResponse {

    private MetricResponse latestSmartMetric;
    private DiskIoResponse latestDiskIo;
    private List<PartitionUsageResponse> partitions;
    private AnalysisResponse latestAnalysis;

    public DashboardSummaryResponse(
            MetricResponse latestSmartMetric,
            DiskIoResponse latestDiskIo,
            List<PartitionUsageResponse> partitions,
            AnalysisResponse latestAnalysis
    ) {
        this.latestSmartMetric = latestSmartMetric;
        this.latestDiskIo = latestDiskIo;
        this.partitions = partitions;
        this.latestAnalysis = latestAnalysis;
    }

    public MetricResponse getLatestSmartMetric() {
        return latestSmartMetric;
    }

    public DiskIoResponse getLatestDiskIo() {
        return latestDiskIo;
    }

    public List<PartitionUsageResponse> getPartitions() {
        return partitions;
    }

    public AnalysisResponse getLatestAnalysis() {
        return latestAnalysis;
    }

    /**
     * DTO for latest disk I/O speed.
     */
    public static class DiskIoResponse {

        private Long id;
        private String diskName;
        private Long timestampEpochMs;
        private String timestampUtc;

        private Double readBytesPerSec;
        private Double writeBytesPerSec;

        private Double readMBPerSec;
        private Double writeMBPerSec;

        public DiskIoResponse(
                Long id,
                String diskName,
                Long timestampEpochMs,
                String timestampUtc,
                Double readBytesPerSec,
                Double writeBytesPerSec
        ) {
            this.id = id;
            this.diskName = diskName;
            this.timestampEpochMs = timestampEpochMs;
            this.timestampUtc = timestampUtc;
            this.readBytesPerSec = readBytesPerSec;
            this.writeBytesPerSec = writeBytesPerSec;

            this.readMBPerSec = bytesToMb(readBytesPerSec);
            this.writeMBPerSec = bytesToMb(writeBytesPerSec);
        }

        private Double bytesToMb(Double bytes) {
            if (bytes == null) {
                return null;
            }

            return bytes / (1024.0 * 1024.0);
        }

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

        public Double getReadBytesPerSec() {
            return readBytesPerSec;
        }

        public Double getWriteBytesPerSec() {
            return writeBytesPerSec;
        }

        public Double getReadMBPerSec() {
            return readMBPerSec;
        }

        public Double getWriteMBPerSec() {
            return writeMBPerSec;
        }
    }

    /**
     * DTO for partition usage cards.
     */
    public static class PartitionUsageResponse {

        private Long id;
        private String mountpoint;
        private String device;
        private String filesystem;
        private Long timestampEpochMs;
        private String timestampUtc;

        private Long totalBytes;
        private Long usedBytes;
        private Long freeBytes;
        private Double usagePercent;

        private Double totalGB;
        private Double usedGB;
        private Double freeGB;

        public PartitionUsageResponse(
                Long id,
                String mountpoint,
                String device,
                String filesystem,
                Long timestampEpochMs,
                String timestampUtc,
                Long totalBytes,
                Long usedBytes,
                Long freeBytes,
                Double usagePercent
        ) {
            this.id = id;
            this.mountpoint = mountpoint;
            this.device = device;
            this.filesystem = filesystem;
            this.timestampEpochMs = timestampEpochMs;
            this.timestampUtc = timestampUtc;
            this.totalBytes = totalBytes;
            this.usedBytes = usedBytes;
            this.freeBytes = freeBytes;
            this.usagePercent = usagePercent;

            this.totalGB = bytesToGb(totalBytes);
            this.usedGB = bytesToGb(usedBytes);
            this.freeGB = bytesToGb(freeBytes);
        }

        private Double bytesToGb(Long bytes) {
            if (bytes == null) {
                return null;
            }

            return bytes / (1024.0 * 1024.0 * 1024.0);
        }

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

        public Double getTotalGB() {
            return totalGB;
        }

        public Double getUsedGB() {
            return usedGB;
        }

        public Double getFreeGB() {
            return freeGB;
        }
    }
}
