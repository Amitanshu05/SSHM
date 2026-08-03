package com.smartstorage.api.repository;

import com.smartstorage.api.entity.DiskIoReading;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository for reading latest disk I/O metrics from SQLite.
 */
@Repository
public interface DiskIoReadingRepository extends JpaRepository<DiskIoReading, Long> {

    /**
     * Finds the newest disk I/O reading.
     *
     * Similar to:
     * SELECT * FROM disk_io_readings ORDER BY ts_epoch_ms DESC LIMIT 1;
     */
    Optional<DiskIoReading> findTopByOrderByTimestampEpochMsDesc();
}