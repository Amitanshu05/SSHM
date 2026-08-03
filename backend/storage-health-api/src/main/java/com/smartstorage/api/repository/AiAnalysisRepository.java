package com.smartstorage.api.repository;

import com.smartstorage.api.entity.AiAnalysis;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository for reading Python AI/ML analysis results from SQLite.
 */
@Repository
public interface AiAnalysisRepository extends JpaRepository<AiAnalysis, Long> {

    Optional<AiAnalysis> findTopByOrderByTimestampEpochMsDesc();
}
