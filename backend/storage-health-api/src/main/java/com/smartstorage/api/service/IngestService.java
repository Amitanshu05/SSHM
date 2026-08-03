package com.smartstorage.api.service;

import com.smartstorage.api.dto.IngestSnapshotRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Stores live telemetry snapshots pushed by the local Python agent.
 */
@Service
public class IngestService {

    private final JdbcTemplate jdbcTemplate;

    public IngestService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Map<String, Object> ingestSnapshot(IngestSnapshotRequest request) {
        validateRequest(request);

        Long deviceId = upsertDevice(request.getDevice(), request.getSmart().getTimestampEpochMs());
        Long smartReadingId = upsertSmartReading(deviceId, request.getSmart());

        if (request.getDiskIo() != null) {
            upsertDiskIo(request.getDiskIo());
        }

        if (request.getPartitions() != null) {
            request.getPartitions().forEach(this::upsertPartition);
        }

        if (request.getAnalysis() != null) {
            upsertAnalysis(smartReadingId, request.getAnalysis());
        }

        return Map.of(
                "status", "accepted",
                "deviceId", deviceId,
                "smartReadingId", smartReadingId,
                "partitionCount", request.getPartitions() == null ? 0 : request.getPartitions().size()
        );
    }

    private void validateRequest(IngestSnapshotRequest request) {
        if (request == null || request.getDevice() == null || request.getSmart() == null) {
            throw new RuntimeException("Ingest request must include device and SMART telemetry.");
        }

        if (!StringUtils.hasText(request.getDevice().getDeviceName())) {
            throw new RuntimeException("Device name is required for ingest.");
        }

        if (request.getSmart().getTimestampEpochMs() == null || !StringUtils.hasText(request.getSmart().getTimestampUtc())) {
            throw new RuntimeException("SMART timestamp is required for ingest.");
        }
    }

    private Long upsertDevice(IngestSnapshotRequest.DevicePayload device, Long seenEpochMs) {
        long nowMs = seenEpochMs == null ? Instant.now().toEpochMilli() : seenEpochMs;

        jdbcTemplate.update(
                """
                INSERT INTO devices (
                    device_name,
                    device_type,
                    protocol,
                    model_name,
                    serial_number,
                    firmware_version,
                    capacity_bytes,
                    first_seen_epoch_ms,
                    last_seen_epoch_ms
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(device_name)
                DO UPDATE SET
                    device_type = COALESCE(excluded.device_type, devices.device_type),
                    protocol = COALESCE(excluded.protocol, devices.protocol),
                    model_name = COALESCE(excluded.model_name, devices.model_name),
                    serial_number = COALESCE(excluded.serial_number, devices.serial_number),
                    firmware_version = COALESCE(excluded.firmware_version, devices.firmware_version),
                    capacity_bytes = COALESCE(excluded.capacity_bytes, devices.capacity_bytes),
                    last_seen_epoch_ms = excluded.last_seen_epoch_ms
                """,
                device.getDeviceName(),
                device.getDeviceType(),
                device.getProtocol(),
                device.getModelName(),
                device.getSerialNumber(),
                device.getFirmwareVersion(),
                device.getCapacityBytes(),
                nowMs,
                nowMs
        );

        return jdbcTemplate.queryForObject(
                "SELECT id FROM devices WHERE device_name = ?",
                Long.class,
                device.getDeviceName()
        );
    }

    private Long upsertSmartReading(Long deviceId, IngestSnapshotRequest.SmartPayload smart) {
        List<Long> existing = jdbcTemplate.queryForList(
                """
                SELECT id
                FROM smart_readings
                WHERE device_id = ? AND ts_epoch_ms = ?
                ORDER BY id DESC
                LIMIT 1
                """,
                Long.class,
                deviceId,
                smart.getTimestampEpochMs()
        );

        if (!existing.isEmpty()) {
            return existing.get(0);
        }

        jdbcTemplate.update(
                """
                INSERT INTO smart_readings (
                    device_id,
                    ts_epoch_ms,
                    ts_utc,
                    smart_available,
                    smart_passed,
                    reallocated_sectors,
                    power_on_hours,
                    pending_sectors,
                    temperature_celsius,
                    raw_json,
                    error_message
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                deviceId,
                smart.getTimestampEpochMs(),
                smart.getTimestampUtc(),
                boolToInt(smart.getSmartAvailable()),
                nullableBoolToInt(smart.getSmartPassed()),
                smart.getReallocatedSectors(),
                smart.getPowerOnHours(),
                smart.getPendingSectors(),
                smart.getTemperatureCelsius(),
                smart.getRawJson(),
                smart.getErrorMessage()
        );

        return jdbcTemplate.queryForObject(
                """
                SELECT id
                FROM smart_readings
                WHERE device_id = ? AND ts_epoch_ms = ?
                ORDER BY id DESC
                LIMIT 1
                """,
                Long.class,
                deviceId,
                smart.getTimestampEpochMs()
        );
    }

    private void upsertDiskIo(IngestSnapshotRequest.DiskIoPayload diskIo) {
        if (!StringUtils.hasText(diskIo.getDiskName()) || diskIo.getTimestampEpochMs() == null) {
            return;
        }

        if (exists("disk_io_readings", "disk_name", diskIo.getDiskName(), diskIo.getTimestampEpochMs())) {
            return;
        }

        jdbcTemplate.update(
                """
                INSERT INTO disk_io_readings (
                    disk_name,
                    ts_epoch_ms,
                    ts_utc,
                    read_bytes_total,
                    write_bytes_total,
                    read_count_total,
                    write_count_total,
                    read_bytes_per_sec,
                    write_bytes_per_sec
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                diskIo.getDiskName(),
                diskIo.getTimestampEpochMs(),
                diskIo.getTimestampUtc(),
                diskIo.getReadBytesTotal(),
                diskIo.getWriteBytesTotal(),
                diskIo.getReadCountTotal(),
                diskIo.getWriteCountTotal(),
                diskIo.getReadBytesPerSec(),
                diskIo.getWriteBytesPerSec()
        );
    }

    private void upsertPartition(IngestSnapshotRequest.PartitionPayload partition) {
        if (!StringUtils.hasText(partition.getMountpoint()) || partition.getTimestampEpochMs() == null) {
            return;
        }

        if (exists("partition_usage_readings", "mountpoint", partition.getMountpoint(), partition.getTimestampEpochMs())) {
            return;
        }

        jdbcTemplate.update(
                """
                INSERT INTO partition_usage_readings (
                    mountpoint,
                    device,
                    filesystem,
                    ts_epoch_ms,
                    ts_utc,
                    total_bytes,
                    used_bytes,
                    free_bytes,
                    usage_percent
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                partition.getMountpoint(),
                partition.getDevice(),
                partition.getFilesystem(),
                partition.getTimestampEpochMs(),
                partition.getTimestampUtc(),
                partition.getTotalBytes(),
                partition.getUsedBytes(),
                partition.getFreeBytes(),
                partition.getUsagePercent()
        );
    }

    private void upsertAnalysis(Long smartReadingId, IngestSnapshotRequest.AnalysisPayload analysis) {
        if (analysis.getTimestampEpochMs() == null) {
            return;
        }

        List<Long> existing = jdbcTemplate.queryForList(
                """
                SELECT id
                FROM ai_analysis
                WHERE smart_reading_id = ? AND ts_epoch_ms = ?
                ORDER BY id DESC
                LIMIT 1
                """,
                Long.class,
                smartReadingId,
                analysis.getTimestampEpochMs()
        );

        if (!existing.isEmpty()) {
            return;
        }

        long createdEpochMs = Instant.now().toEpochMilli();
        String createdUtc = Instant.ofEpochMilli(createdEpochMs).toString();

        jdbcTemplate.update(
                """
                INSERT INTO ai_analysis (
                    smart_reading_id,
                    ts_epoch_ms,
                    ts_utc,
                    failure_probability_30d,
                    health_score,
                    risk_level,
                    model_name,
                    model_version,
                    model_confidence,
                    analysis_summary,
                    recommendation,
                    top_signals_json,
                    gemini_used,
                    created_epoch_ms,
                    created_utc
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                smartReadingId,
                analysis.getTimestampEpochMs(),
                analysis.getTimestampUtc(),
                analysis.getFailureProbability30d(),
                analysis.getHealthScore(),
                analysis.getRiskLevel(),
                analysis.getModelName(),
                analysis.getModelVersion(),
                analysis.getModelConfidence(),
                analysis.getAnalysisSummary(),
                analysis.getRecommendation(),
                analysis.getTopSignalsJson(),
                boolToInt(analysis.getGeminiUsed()),
                createdEpochMs,
                createdUtc
        );
    }

    private boolean exists(String tableName, String identityColumn, String identityValue, Long timestampEpochMs) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM " + tableName + " WHERE " + identityColumn + " = ? AND ts_epoch_ms = ?",
                Integer.class,
                identityValue,
                timestampEpochMs
        );

        return count != null && count > 0;
    }

    private Integer boolToInt(Boolean value) {
        return Boolean.TRUE.equals(value) ? 1 : 0;
    }

    private Integer nullableBoolToInt(Boolean value) {
        if (value == null) {
            return null;
        }

        return boolToInt(value);
    }
}
