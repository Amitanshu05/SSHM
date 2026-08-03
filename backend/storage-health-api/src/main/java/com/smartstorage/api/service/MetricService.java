package com.smartstorage.api.service;

import com.smartstorage.api.dto.DashboardSummaryResponse;
import com.smartstorage.api.dto.AnalysisResponse;
import com.smartstorage.api.dto.MetricResponse;
import com.smartstorage.api.entity.Device;
import com.smartstorage.api.entity.DiskIoReading;
import com.smartstorage.api.entity.PartitionUsageReading;
import com.smartstorage.api.entity.SmartReading;
import com.smartstorage.api.repository.DiskIoReadingRepository;
import com.smartstorage.api.repository.PartitionUsageReadingRepository;
import com.smartstorage.api.repository.SmartReadingRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

/**
 * Service layer for storage telemetry.
 *
 * This class contains backend logic for:
 * - latest SMART metric
 * - last 24 hours SMART history
 * - dashboard summary including SMART + disk I/O + partition usage
 *
 * Controller calls this service.
 * This service calls repositories.
 * Repositories read SQLite.
 *
 * Basically: Controller -> Service -> Repository -> SQLite
 */
@Service
public class MetricService {

    private final SmartReadingRepository smartReadingRepository;
    private final DiskIoReadingRepository diskIoReadingRepository;
    private final PartitionUsageReadingRepository partitionUsageReadingRepository;
    private final AnalysisService analysisService;

    public MetricService(
            SmartReadingRepository smartReadingRepository,
            DiskIoReadingRepository diskIoReadingRepository,
            PartitionUsageReadingRepository partitionUsageReadingRepository,
            AnalysisService analysisService
    ) {
        this.smartReadingRepository = smartReadingRepository;
        this.diskIoReadingRepository = diskIoReadingRepository;
        this.partitionUsageReadingRepository = partitionUsageReadingRepository;
        this.analysisService = analysisService;
    }

    /**
     * Returns the latest SMART telemetry reading.
     *
     * Used by:
     * GET /api/metrics/latest
     */
    public MetricResponse getLatestMetric() {
        SmartReading latestReading = smartReadingRepository
                .findTopByOrderByTimestampEpochMsDesc()
                .orElseThrow(() -> new RuntimeException("No SMART telemetry data found. Run the Python worker first."));

        return convertToMetricResponse(latestReading);
    }

    /**
     * Returns SMART telemetry readings from the last 24 hours.
     *
     * Used by:
     * GET /api/metrics/history
     */
    public List<MetricResponse> getLast24HoursHistory() {
        return getHistoryForHours(24);
    }

    /**
     * Returns SMART telemetry readings for the requested time window.
     *
     * The frontend uses this for the dashboard range selector.
     */
    public List<MetricResponse> getHistoryForHours(Integer requestedHours) {
        int safeHours = requestedHours == null ? 24 : requestedHours;
        safeHours = Math.max(1, Math.min(safeHours, 24 * 90));

        long currentTimeMs = Instant.now().toEpochMilli();
        long cutoffTimeMs = currentTimeMs - (safeHours * 60L * 60L * 1000L);

        return smartReadingRepository
                .findByTimestampEpochMsGreaterThanEqualOrderByTimestampEpochMsAsc(cutoffTimeMs)
                .stream()
                .map(this::convertToMetricResponse)
                .toList();
    }

    /**
     * Returns a combined dashboard summary.
     *
     * This gives the frontend one clean API response containing:
     * - latest SMART health
     * - latest disk read/write speed
     * - latest partition usage
     *
     * This is better for dashboard cards because React does not need to make
     * five separate requests like it is collecting Infinity Stones.
     */
    public DashboardSummaryResponse getDashboardSummary() {
        MetricResponse latestSmartMetric = getLatestMetric();

        DashboardSummaryResponse.DiskIoResponse latestDiskIo = getLatestDiskIoResponse();

        List<DashboardSummaryResponse.PartitionUsageResponse> partitionResponses =
                getLatestPartitionUsageResponses();

        AnalysisResponse latestAnalysis = analysisService.getLatestAnalysisOrNull();

        return new DashboardSummaryResponse(
                latestSmartMetric,
                latestDiskIo,
                partitionResponses,
                latestAnalysis
        );
    }

    /**
     * Fetches latest disk I/O row and converts it into DTO.
     */
    private DashboardSummaryResponse.DiskIoResponse getLatestDiskIoResponse() {
        DiskIoReading latestDiskIo = diskIoReadingRepository
                .findTopByOrderByTimestampEpochMsDesc()
                .orElseThrow(() -> new RuntimeException("No disk I/O data found. Run the Python worker first."));

        return new DashboardSummaryResponse.DiskIoResponse(
                latestDiskIo.getId(),
                latestDiskIo.getDiskName(),
                latestDiskIo.getTimestampEpochMs(),
                latestDiskIo.getTimestampUtc(),
                latestDiskIo.getReadBytesPerSec(),
                latestDiskIo.getWriteBytesPerSec()
        );
    }

    /**
     * Fetches latest partition usage rows.
     *
     * The Python worker inserts one row per partition per polling cycle.
     * So to get the latest snapshot, we:
     * 1. Find the newest partition row.
     * 2. Use its timestamp.
     * 3. Fetch all partition rows from that same timestamp.
     */
    private List<DashboardSummaryResponse.PartitionUsageResponse> getLatestPartitionUsageResponses() {
        PartitionUsageReading latestPartitionRow =
                partitionUsageReadingRepository.findTopByOrderByTimestampEpochMsDesc();

        if (latestPartitionRow == null) {
            throw new RuntimeException("No partition usage data found. Run the Python worker first.");
        }

        Long latestTimestamp = latestPartitionRow.getTimestampEpochMs();

        return partitionUsageReadingRepository
                .findByTimestampEpochMsOrderByMountpointAsc(latestTimestamp)
                .stream()
                .map(this::convertToPartitionUsageResponse)
                .toList();
    }

    /**
     * Converts SmartReading Entity into MetricResponse DTO.
     *
     * We do this instead of returning Entity directly, because returning
     * Hibernate entities to frontend is how lazy-loading demons enter your house.
     */
    private MetricResponse convertToMetricResponse(SmartReading reading) {
        Device device = reading.getDevice();

        return new MetricResponse(
                reading.getId(),
                device.getId(),
                device.getDeviceName(),
                device.getModelName(),
                device.getProtocol(),
                reading.getTimestampEpochMs(),
                reading.getTimestampUtc(),
                convertIntegerToBoolean(reading.getSmartAvailable()),
                convertIntegerToBoolean(reading.getSmartPassed()),
                reading.getReallocatedSectors(),
                reading.getPowerOnHours(),
                reading.getPendingSectors(),
                reading.getTemperatureCelsius(),
                reading.getErrorMessage()
        );
    }

    /**
     * Converts PartitionUsageReading Entity into PartitionUsageResponse DTO.
     */
    private DashboardSummaryResponse.PartitionUsageResponse convertToPartitionUsageResponse(
            PartitionUsageReading reading
    ) {
        return new DashboardSummaryResponse.PartitionUsageResponse(
                reading.getId(),
                reading.getMountpoint(),
                reading.getDevice(),
                reading.getFilesystem(),
                reading.getTimestampEpochMs(),
                reading.getTimestampUtc(),
                reading.getTotalBytes(),
                reading.getUsedBytes(),
                reading.getFreeBytes(),
                reading.getUsagePercent()
        );
    }

    /**
     * SQLite stores booleans as 0/1.
     * This converts them into Java true/false for clean JSON.
     */
    private Boolean convertIntegerToBoolean(Integer value) {
        if (value == null) {
            return null;
        }

        return value == 1;
    }
}
