package com.smartstorage.api.entity;

import jakarta.persistence.*;

/**
 * Maps to SQLite table: ai_analysis
 *
 * This table stores Python AI/ML predictions generated from the latest
 * telemetry snapshot.
 */
@Entity
@Table(name = "ai_analysis")
public class AiAnalysis {

    @Id
    @Column(name = "id")
    private Long id;

    @Column(name = "smart_reading_id")
    private Long smartReadingId;

    @Column(name = "ts_epoch_ms")
    private Long timestampEpochMs;

    @Column(name = "ts_utc")
    private String timestampUtc;

    @Column(name = "failure_probability_30d")
    private Double failureProbability30d;

    @Column(name = "health_score")
    private Double healthScore;

    @Column(name = "risk_level")
    private String riskLevel;

    @Column(name = "model_name")
    private String modelName;

    @Column(name = "model_version")
    private String modelVersion;

    @Column(name = "model_confidence")
    private Double modelConfidence;

    @Column(name = "analysis_summary")
    private String analysisSummary;

    @Column(name = "recommendation")
    private String recommendation;

    @Column(name = "top_signals_json")
    private String topSignalsJson;

    @Column(name = "gemini_used")
    private Integer geminiUsed;

    @Column(name = "created_epoch_ms")
    private Long createdEpochMs;

    @Column(name = "created_utc")
    private String createdUtc;

    public Long getId() {
        return id;
    }

    public Long getSmartReadingId() {
        return smartReadingId;
    }

    public Long getTimestampEpochMs() {
        return timestampEpochMs;
    }

    public String getTimestampUtc() {
        return timestampUtc;
    }

    public Double getFailureProbability30d() {
        return failureProbability30d;
    }

    public Double getHealthScore() {
        return healthScore;
    }

    public String getRiskLevel() {
        return riskLevel;
    }

    public String getModelName() {
        return modelName;
    }

    public String getModelVersion() {
        return modelVersion;
    }

    public Double getModelConfidence() {
        return modelConfidence;
    }

    public String getAnalysisSummary() {
        return analysisSummary;
    }

    public String getRecommendation() {
        return recommendation;
    }

    public String getTopSignalsJson() {
        return topSignalsJson;
    }

    public Integer getGeminiUsed() {
        return geminiUsed;
    }

    public Long getCreatedEpochMs() {
        return createdEpochMs;
    }

    public String getCreatedUtc() {
        return createdUtc;
    }
}
