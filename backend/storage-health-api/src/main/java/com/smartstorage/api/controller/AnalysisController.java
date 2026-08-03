package com.smartstorage.api.controller;

import com.smartstorage.api.dto.AnalysisResponse;
import com.smartstorage.api.service.AnalysisService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST controller for Python AI/ML storage analysis.
 */
@RestController
@RequestMapping("/api/analysis")
public class AnalysisController {

    private final AnalysisService analysisService;

    public AnalysisController(AnalysisService analysisService) {
        this.analysisService = analysisService;
    }

    /**
     * GET /api/analysis/latest
     *
     * Returns the latest 30-day failure prediction and plain-English summary.
     */
    @GetMapping("/latest")
    public AnalysisResponse getLatestAnalysis() {
        return analysisService.getLatestAnalysis();
    }
}
