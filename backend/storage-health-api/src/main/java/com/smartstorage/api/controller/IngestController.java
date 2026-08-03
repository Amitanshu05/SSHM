package com.smartstorage.api.controller;

import com.smartstorage.api.dto.IngestSnapshotRequest;
import com.smartstorage.api.service.IngestService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

/**
 * Accepts live telemetry snapshots from the local Python agent.
 */
@RestController
@RequestMapping("/api/ingest")
public class IngestController {

    private final IngestService ingestService;
    private final String ingestApiKey;

    public IngestController(
            IngestService ingestService,
            @Value("${app.ingest.api-key:}") String ingestApiKey
    ) {
        this.ingestService = ingestService;
        this.ingestApiKey = ingestApiKey;
    }

    @PostMapping("/snapshot")
    public Map<String, Object> ingestSnapshot(
            @RequestHeader(name = "X-Ingest-Key", required = false) String providedKey,
            @RequestBody IngestSnapshotRequest request
    ) {
        if (!ingestApiKey.isBlank() && !ingestApiKey.equals(providedKey)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid ingest key.");
        }

        return ingestService.ingestSnapshot(request);
    }
}
