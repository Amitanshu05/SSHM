package com.smartstorage.api.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartstorage.api.dto.AnalysisResponse;
import com.smartstorage.api.entity.AiAnalysis;
import com.smartstorage.api.repository.AiAnalysisRepository;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Service layer for Python AI/ML analysis results.
 */
@Service
public class AnalysisService {

    private final AiAnalysisRepository aiAnalysisRepository;
    private final ObjectMapper objectMapper;

    public AnalysisService(AiAnalysisRepository aiAnalysisRepository, ObjectMapper objectMapper) {
        this.aiAnalysisRepository = aiAnalysisRepository;
        this.objectMapper = objectMapper;
    }

    public AnalysisResponse getLatestAnalysis() {
        AiAnalysis latestAnalysis = aiAnalysisRepository
                .findTopByOrderByTimestampEpochMsDesc()
                .orElseThrow(() -> new RuntimeException("No AI analysis found. Run the Python worker or analyzer first."));

        return convertToAnalysisResponse(latestAnalysis);
    }

    public AnalysisResponse getLatestAnalysisOrNull() {
        return aiAnalysisRepository
                .findTopByOrderByTimestampEpochMsDesc()
                .map(this::convertToAnalysisResponse)
                .orElse(null);
    }

    public AnalysisResponse convertToAnalysisResponse(AiAnalysis analysis) {
        return new AnalysisResponse(
                analysis.getId(),
                analysis.getSmartReadingId(),
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
                parseTopSignals(analysis.getTopSignalsJson()),
                convertIntegerToBoolean(analysis.getGeminiUsed()),
                analysis.getCreatedEpochMs(),
                analysis.getCreatedUtc()
        );
    }

    private List<AnalysisResponse.SignalResponse> parseTopSignals(String topSignalsJson) {
        if (topSignalsJson == null || topSignalsJson.isBlank()) {
            return List.of();
        }

        try {
            return objectMapper.readValue(
                    topSignalsJson,
                    new TypeReference<List<AnalysisResponse.SignalResponse>>() {}
            );
        } catch (Exception ex) {
            return List.of(
                    new AnalysisResponse.SignalResponse(
                            "Analysis payload",
                            "Warning",
                            "Top signal details could not be parsed.",
                            0.0
                    )
            );
        }
    }

    private Boolean convertIntegerToBoolean(Integer value) {
        if (value == null) {
            return null;
        }

        return value == 1;
    }
}
