package com.smartstorage.api.repository;

import com.smartstorage.api.entity.PartitionUsageReading;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for reading partition usage metrics from SQLite.
 */
@Repository
public interface PartitionUsageReadingRepository extends JpaRepository<PartitionUsageReading, Long> {

    /**
     * Finds all partition readings from the latest timestamp.
     *
     * First we find the max timestamp, then fetch rows from that timestamp.
     */
    List<PartitionUsageReading> findByTimestampEpochMsOrderByMountpointAsc(Long timestampEpochMs);

    /**
     * Finds the latest single partition row.
     * We use this to discover the newest timestamp.
     */
    PartitionUsageReading findTopByOrderByTimestampEpochMsDesc();
}