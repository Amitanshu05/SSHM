INSERT OR IGNORE INTO devices (
    id,
    device_name,
    device_type,
    protocol,
    model_name,
    serial_number,
    firmware_version,
    capacity_bytes,
    first_seen_epoch_ms,
    last_seen_epoch_ms
)
VALUES (
    900001,
    '/dev/demo0',
    'nvme',
    'NVMe',
    'SanDisk Demo NVMe 1TB',
    'DEMO-SD-2026',
    '1.0',
    1000204886016,
    CAST(strftime('%s', 'now') AS INTEGER) * 1000,
    CAST(strftime('%s', 'now') AS INTEGER) * 1000
);

INSERT INTO smart_readings (
    id,
    device_id,
    ts_epoch_ms,
    ts_utc,
    smart_available,
    smart_passed,
    reallocated_sectors,
    power_on_hours,
    pending_sectors,
    temperature_celsius,
    raw_json,
    error_message
)
SELECT
    900001,
    900001,
    1700000000000,
    '2023-11-14T22:13:20Z',
    1,
    1,
    0,
    4280,
    0,
    34,
    '{}',
    NULL
WHERE NOT EXISTS (SELECT 1 FROM smart_readings);

INSERT INTO disk_io_readings (
    id,
    disk_name,
    ts_epoch_ms,
    ts_utc,
    read_bytes_total,
    write_bytes_total,
    read_count_total,
    write_count_total,
    read_bytes_per_sec,
    write_bytes_per_sec
)
SELECT
    900001,
    'demo-disk0',
    1700000000000,
    '2023-11-14T22:13:20Z',
    98000000000,
    74000000000,
    140220,
    118900,
    1572864.0,
    943718.4
WHERE NOT EXISTS (SELECT 1 FROM disk_io_readings);

INSERT INTO partition_usage_readings (
    id,
    mountpoint,
    device,
    filesystem,
    ts_epoch_ms,
    ts_utc,
    total_bytes,
    used_bytes,
    free_bytes,
    usage_percent
)
SELECT
    900001,
    'C:',
    'demo-disk0p1',
    'NTFS',
    1700000000000,
    '2023-11-14T22:13:20Z',
    700000000000,
    511000000000,
    189000000000,
    73.0
WHERE NOT EXISTS (SELECT 1 FROM partition_usage_readings WHERE id = 900001);

INSERT INTO partition_usage_readings (
    id,
    mountpoint,
    device,
    filesystem,
    ts_epoch_ms,
    ts_utc,
    total_bytes,
    used_bytes,
    free_bytes,
    usage_percent
)
SELECT
    900002,
    'D:',
    'demo-disk0p2',
    'NTFS',
    1700000000000,
    '2023-11-14T22:13:20Z',
    300000000000,
    264000000000,
    36000000000,
    88.0
WHERE NOT EXISTS (SELECT 1 FROM partition_usage_readings WHERE id = 900002);

INSERT INTO ai_analysis (
    id,
    smart_reading_id,
    ts_epoch_ms,
    ts_utc,
    failure_probability_30d,
    health_score,
    risk_level,
    model_name,
    model_version,
    model_confidence,
    analysis_summary,
    recommendation,
    top_signals_json,
    gemini_used,
    created_epoch_ms,
    created_utc
)
SELECT
    900001,
    900001,
    1700000000000,
    '2023-11-14T22:13:20Z',
    12.4,
    87.6,
    'Low Risk',
    'Local Random Forest Storage Failure Predictor',
    'rf-baseline-2026.05',
    82.0,
    'SanDisk Demo NVMe 1TB is classified as low risk with a 12.4% estimated 30-day failure probability. SMART status is passing, but partition pressure is elevated on D:. Keep backups current and monitor storage usage.',
    'Drive risk is low. Free space on D: and keep routine backups enabled.',
    '[{"label":"Partition pressure","severity":"Warning","detail":"Maximum partition usage is 88.0%.","impactScore":28.0},{"label":"SMART self-test","severity":"Healthy","detail":"SMART pass status is currently normal.","impactScore":8.0},{"label":"Temperature","severity":"Healthy","detail":"Latest temperature is 34C.","impactScore":7.0}]',
    0,
    1700000000000,
    '2023-11-14T22:13:20Z'
WHERE NOT EXISTS (SELECT 1 FROM ai_analysis);
