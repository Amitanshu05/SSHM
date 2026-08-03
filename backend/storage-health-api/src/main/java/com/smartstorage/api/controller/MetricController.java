package com.smartstorage.api.controller;

import com.smartstorage.api.dto.DashboardSummaryResponse;
import com.smartstorage.api.dto.MetricResponse;
import com.smartstorage.api.service.MetricService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST Controller for exposing storage telemetry metrics to the frontend.
 *
 * Base URL:
 * /api/metrics
 */
@RestController
@RequestMapping("/api/metrics")
public class MetricController {

    private final MetricService metricService;

    public MetricController(MetricService metricService) {
        this.metricService = metricService;
    }

    /**
     * GET /api/metrics/latest
     *
     * Returns the latest SMART telemetry reading.
     */
    @GetMapping("/latest")
    public MetricResponse getLatestMetric() {
        return metricService.getLatestMetric();
    }

    /**
     * GET /api/metrics/history
     *
     * Returns SMART telemetry readings from the last 24 hours.
     * This is useful for frontend charts.
     */
    @GetMapping("/history")
    public List<MetricResponse> getMetricHistory(
            @RequestParam(name = "hours", defaultValue = "24") Integer hours
    ) {
        return metricService.getHistoryForHours(hours);
    }

    /**
     * GET /api/metrics/dashboard-summary
     *
     * Returns a combined dashboard response:
     * - latest SMART health
     * - latest disk I/O speed
     * - latest partition usage
     *
     * This is the best endpoint for dashboard cards.
     */
    @GetMapping("/dashboard-summary")
    public DashboardSummaryResponse getDashboardSummary() {
        return metricService.getDashboardSummary();
    }
}
