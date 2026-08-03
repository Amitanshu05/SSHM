CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_name TEXT NOT NULL UNIQUE,
    device_type TEXT,
    protocol TEXT,
    model_name TEXT,
    serial_number TEXT,
    firmware_version TEXT,
    capacity_bytes INTEGER,
    first_seen_epoch_ms INTEGER NOT NULL,
    last_seen_epoch_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS poll_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_epoch_ms INTEGER NOT NULL,
    started_utc TEXT NOT NULL,
    finished_epoch_ms INTEGER,
    finished_utc TEXT,
    status TEXT NOT NULL,
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS smart_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER NOT NULL,
    ts_epoch_ms INTEGER NOT NULL,
    ts_utc TEXT NOT NULL,
    smart_available INTEGER NOT NULL,
    smart_passed INTEGER,
    reallocated_sectors INTEGER,
    power_on_hours INTEGER,
    pending_sectors INTEGER,
    temperature_celsius INTEGER,
    raw_json TEXT,
    error_message TEXT,
    FOREIGN KEY (device_id) REFERENCES devices(id)
);

CREATE TABLE IF NOT EXISTS disk_io_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    disk_name TEXT NOT NULL,
    ts_epoch_ms INTEGER NOT NULL,
    ts_utc TEXT NOT NULL,
    read_bytes_total INTEGER NOT NULL,
    write_bytes_total INTEGER NOT NULL,
    read_count_total INTEGER NOT NULL,
    write_count_total INTEGER NOT NULL,
    read_bytes_per_sec REAL NOT NULL,
    write_bytes_per_sec REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS partition_usage_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mountpoint TEXT NOT NULL,
    device TEXT NOT NULL,
    filesystem TEXT,
    ts_epoch_ms INTEGER NOT NULL,
    ts_utc TEXT NOT NULL,
    total_bytes INTEGER NOT NULL,
    used_bytes INTEGER NOT NULL,
    free_bytes INTEGER NOT NULL,
    usage_percent REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    smart_reading_id INTEGER NOT NULL,
    ts_epoch_ms INTEGER NOT NULL,
    ts_utc TEXT NOT NULL,
    failure_probability_30d REAL NOT NULL,
    health_score REAL NOT NULL,
    risk_level TEXT NOT NULL,
    model_name TEXT NOT NULL,
    model_version TEXT NOT NULL,
    model_confidence REAL NOT NULL,
    analysis_summary TEXT NOT NULL,
    recommendation TEXT NOT NULL,
    top_signals_json TEXT NOT NULL,
    gemini_used INTEGER NOT NULL,
    created_epoch_ms INTEGER NOT NULL,
    created_utc TEXT NOT NULL,
    FOREIGN KEY (smart_reading_id) REFERENCES smart_readings(id)
);

CREATE INDEX IF NOT EXISTS idx_smart_device_time
    ON smart_readings(device_id, ts_epoch_ms DESC);

CREATE INDEX IF NOT EXISTS idx_smart_time
    ON smart_readings(ts_epoch_ms DESC);

CREATE INDEX IF NOT EXISTS idx_io_disk_time
    ON disk_io_readings(disk_name, ts_epoch_ms DESC);

CREATE INDEX IF NOT EXISTS idx_partition_mount_time
    ON partition_usage_readings(mountpoint, ts_epoch_ms DESC);

CREATE INDEX IF NOT EXISTS idx_partition_time
    ON partition_usage_readings(ts_epoch_ms DESC);

CREATE INDEX IF NOT EXISTS idx_poll_runs_time
    ON poll_runs(started_epoch_ms DESC);

CREATE INDEX IF NOT EXISTS idx_ai_analysis_time
    ON ai_analysis(ts_epoch_ms DESC);

CREATE INDEX IF NOT EXISTS idx_ai_analysis_reading
    ON ai_analysis(smart_reading_id);
