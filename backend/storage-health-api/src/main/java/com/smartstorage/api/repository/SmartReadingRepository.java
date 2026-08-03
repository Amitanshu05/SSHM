package com.smartstorage.api.repository;

import com.smartstorage.api.entity.SmartReading;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository layer for reading SMART telemetry from SQLite.
 */
@Repository
public interface SmartReadingRepository extends JpaRepository<SmartReading, Long> {

    /**
     * Finds the newest SMART reading from the smart_readings table.
     *
     * Equivalent idea:
     * SELECT * FROM smart_readings ORDER BY ts_epoch_ms DESC LIMIT 1;
     */
    Optional<SmartReading> findTopByOrderByTimestampEpochMsDesc();

    /**
     * Finds all readings from a given timestamp onwards.
     *
     * Used for last 24 hours chart data.
     */
    List<SmartReading> findByTimestampEpochMsGreaterThanEqualOrderByTimestampEpochMsAsc(Long fromEpochMs);
}