package com.smartstorage.api.dto;

import java.util.List;

/**
 * JSON response for the latest Python AI/ML storage analysis.
 */
public class AnalysisResponse {

    private Long id;
    private Long smartReadingId;
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
    private List<SignalResponse> topSignals;
    private Boolean geminiUsed;
    private Long createdEpochMs;
    private String createdUtc;

    public AnalysisResponse(
            Long id,
            Long smartReadingId,
            Long timestampEpochMs,
            String timestampUtc,
            Double failureProbability30d,
            Double healthScore,
            String riskLevel,
            String modelName,
            String modelVersion,
            Double modelConfidence,
            String analysisSummary,
            String recommendation,
            List<SignalResponse> topSignals,
            Boolean geminiUsed,
            Long createdEpochMs,
            String createdUtc
    ) {
        this.id = id;
        this.smartReadingId = smartReadingId;
        this.timestampEpochMs = timestampEpochMs;
        this.timestampUtc = timestampUtc;
        this.failureProbability30d = failureProbability30d;
        this.healthScore = healthScore;
        this.riskLevel = riskLevel;
        this.modelName = modelName;
        this.modelVersion = modelVersion;
        this.modelConfidence = modelConfidence;
        this.analysisSummary = analysisSummary;
        this.recommendation = recommendation;
        this.topSignals = topSignals;
        this.geminiUsed = geminiUsed;
        this.createdEpochMs = createdEpochMs;
        this.createdUtc = createdUtc;
    }

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

    public List<SignalResponse> getTopSignals() {
        return topSignals;
    }

    public Boolean getGeminiUsed() {
        return geminiUsed;
    }

    public Long getCreatedEpochMs() {
        return createdEpochMs;
    }

    public String getCreatedUtc() {
        return createdUtc;
    }

    public static class SignalResponse {

        private String label;
        private String severity;
        private String detail;
        private Double impactScore;

        public SignalResponse() {
        }

        public SignalResponse(String label, String severity, String detail, Double impactScore) {
            this.label = label;
            this.severity = severity;
            this.detail = detail;
            this.impactScore = impactScore;
        }

        public String getLabel() {
            return label;
        }

        public void setLabel(String label) {
            this.label = label;
        }

        public String getSeverity() {
            return severity;
        }

        public void setSeverity(String severity) {
            this.severity = severity;
        }

        public String getDetail() {
            return detail;
        }

        public void setDetail(String detail) {
            this.detail = detail;
        }

        public Double getImpactScore() {
            return impactScore;
        }

        public void setImpactScore(Double impactScore) {
            this.impactScore = impactScore;
        }
    }
}
