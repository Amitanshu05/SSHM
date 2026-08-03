#!/usr/bin/env python3
"""
Smart Storage Health Monitor - Phase 1 Engine
Data Acquisition & Persistence Worker

This background service collects:
1. smartctl / smartmontools data:
   - Device protocol
   - SMART health status
   - Power-on hours where available
   - Temperature where available
   - ATA SMART attributes where available

2. psutil OS-level metrics:
   - Disk I/O speed
   - Partition usage

3. Windows fallback:
   - Uses PowerShell Get-PhysicalDisk when smartctl cannot read full NVMe data.
   - Helps fill model name, serial number, capacity, and health status.

Run once:
    python storage_health_worker.py --once

Run continuously every 5 minutes:
    python storage_health_worker.py --interval 300
"""

from __future__ import annotations

import argparse
import json
import logging
import shutil
import signal
import sqlite3
import subprocess
import sys
import time
from contextlib import contextmanager
from dataclasses import dataclass
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import psutil


# =========================
# Configuration
# =========================

DEFAULT_DB_PATH = "storage_health.db"
DEFAULT_POLL_INTERVAL_SECONDS = 300
SMARTCTL_TIMEOUT_SECONDS = 20
IO_SAMPLE_SECONDS = 1.0
LOG_FILE = "storage_health_worker.log"

IS_WINDOWS = sys.platform.startswith("win")


# =========================
# Logging
# =========================

def setup_logging(log_file: str = LOG_FILE) -> logging.Logger:
    """
    Configure console and rotating file logging.
    """
    logger = logging.getLogger("storage-health-worker")
    logger.setLevel(logging.INFO)
    logger.handlers.clear()

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S%z",
    )

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)

    file_handler = RotatingFileHandler(
        log_file,
        maxBytes=5_000_000,
        backupCount=5,
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)

    logger.addHandler(console_handler)
    logger.addHandler(file_handler)

    return logger


logger = setup_logging()


# =========================
# Data Models
# =========================

@dataclass
class DeviceInfo:
    """
    Represents one physical storage device.
    """
    name: str
    device_type: Optional[str]
    protocol: Optional[str]
    model_name: Optional[str] = None
    serial_number: Optional[str] = None
    firmware_version: Optional[str] = None
    capacity_bytes: Optional[int] = None


@dataclass
class SmartReading:
    """
    One SMART reading for one storage device.
    """
    device_name: str
    ts_epoch_ms: int
    ts_utc: str
    smart_available: bool
    smart_passed: Optional[bool]
    reallocated_sectors: Optional[int]
    power_on_hours: Optional[int]
    pending_sectors: Optional[int]
    temperature_celsius: Optional[int]
    raw_json: Optional[str]
    error_message: Optional[str]


@dataclass
class DiskIoReading:
    """
    One disk I/O reading.
    """
    disk_name: str
    ts_epoch_ms: int
    ts_utc: str
    read_bytes_total: int
    write_bytes_total: int
    read_count_total: int
    write_count_total: int
    read_bytes_per_sec: float
    write_bytes_per_sec: float


@dataclass
class PartitionUsageReading:
    """
    One partition usage reading.
    """
    mountpoint: str
    device: str
    filesystem: str
    ts_epoch_ms: int
    ts_utc: str
    total_bytes: int
    used_bytes: int
    free_bytes: int
    usage_percent: float


# =========================
# Time Helpers
# =========================

def now_utc() -> Tuple[int, str]:
    """
    Return current UTC timestamp as epoch milliseconds and ISO string.
    """
    current = time.time()
    epoch_ms = int(current * 1000)
    iso_utc = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(current))
    return epoch_ms, iso_utc


# =========================
# SQLite Database
# =========================

class StorageHealthDatabase:
    """
    SQLite database layer.

    Python writes telemetry.
    Spring Boot reads telemetry.
    """

    def __init__(self, db_path: str):
        self.db_path = db_path
        self.initialize()

    @contextmanager
    def connect(self) -> Iterable[sqlite3.Connection]:
        """
        Open SQLite connection safely.
        """
        conn = sqlite3.connect(self.db_path, timeout=30)
        conn.row_factory = sqlite3.Row

        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def initialize(self) -> None:
        """
        Create tables and indexes if missing.
        """
        with self.connect() as conn:
            conn.execute("PRAGMA journal_mode = WAL;")
            conn.execute("PRAGMA synchronous = NORMAL;")
            conn.execute("PRAGMA foreign_keys = ON;")

            conn.executescript(
                """
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

                CREATE INDEX IF NOT EXISTS idx_ai_analysis_time
                    ON ai_analysis(ts_epoch_ms DESC);

                CREATE INDEX IF NOT EXISTS idx_ai_analysis_reading
                    ON ai_analysis(smart_reading_id);
                """
            )

        logger.info("SQLite database initialized at %s", self.db_path)

    def start_poll_run(self) -> int:
        """
        Insert a poll run entry.
        """
        started_epoch_ms, started_utc = now_utc()

        with self.connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO poll_runs (started_epoch_ms, started_utc, status)
                VALUES (?, ?, ?)
                """,
                (started_epoch_ms, started_utc, "RUNNING"),
            )

            return int(cursor.lastrowid)

    def finish_poll_run(
        self,
        poll_run_id: int,
        status: str,
        error_message: Optional[str] = None,
    ) -> None:
        """
        Mark a poll run as success or failed.
        """
        finished_epoch_ms, finished_utc = now_utc()

        with self.connect() as conn:
            conn.execute(
                """
                UPDATE poll_runs
                SET finished_epoch_ms = ?,
                    finished_utc = ?,
                    status = ?,
                    error_message = ?
                WHERE id = ?
                """,
                (
                    finished_epoch_ms,
                    finished_utc,
                    status,
                    error_message,
                    poll_run_id,
                ),
            )

    def upsert_device(self, device: DeviceInfo) -> int:
        """
        Insert or update device information.

        Important:
        COALESCE prevents newer null values from wiping old useful values.
        """
        now_ms, _ = now_utc()

        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO devices (
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
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(device_name)
                DO UPDATE SET
                    device_type = COALESCE(excluded.device_type, devices.device_type),
                    protocol = COALESCE(excluded.protocol, devices.protocol),
                    model_name = COALESCE(excluded.model_name, devices.model_name),
                    serial_number = COALESCE(excluded.serial_number, devices.serial_number),
                    firmware_version = COALESCE(excluded.firmware_version, devices.firmware_version),
                    capacity_bytes = COALESCE(excluded.capacity_bytes, devices.capacity_bytes),
                    last_seen_epoch_ms = excluded.last_seen_epoch_ms
                """,
                (
                    device.name,
                    device.device_type,
                    device.protocol,
                    device.model_name,
                    device.serial_number,
                    device.firmware_version,
                    device.capacity_bytes,
                    now_ms,
                    now_ms,
                ),
            )

            row = conn.execute(
                "SELECT id FROM devices WHERE device_name = ?",
                (device.name,),
            ).fetchone()

            return int(row["id"])

    def insert_smart_reading(self, reading: SmartReading) -> None:
        """
        Insert one SMART reading.

        The device must already exist in devices table.
        """
        with self.connect() as conn:
            row = conn.execute(
                "SELECT id FROM devices WHERE device_name = ?",
                (reading.device_name,),
            ).fetchone()

            if row is None:
                raise RuntimeError(
                    f"Device {reading.device_name} was not found before inserting SMART reading."
                )

            device_id = int(row["id"])

            conn.execute(
                """
                INSERT INTO smart_readings (
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
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    device_id,
                    reading.ts_epoch_ms,
                    reading.ts_utc,
                    int(reading.smart_available),
                    None if reading.smart_passed is None else int(reading.smart_passed),
                    reading.reallocated_sectors,
                    reading.power_on_hours,
                    reading.pending_sectors,
                    reading.temperature_celsius,
                    reading.raw_json,
                    reading.error_message,
                ),
            )

    def insert_disk_io_readings(self, readings: List[DiskIoReading]) -> None:
        """
        Insert disk I/O readings.
        """
        if not readings:
            return

        with self.connect() as conn:
            conn.executemany(
                """
                INSERT INTO disk_io_readings (
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
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        r.disk_name,
                        r.ts_epoch_ms,
                        r.ts_utc,
                        r.read_bytes_total,
                        r.write_bytes_total,
                        r.read_count_total,
                        r.write_count_total,
                        r.read_bytes_per_sec,
                        r.write_bytes_per_sec,
                    )
                    for r in readings
                ],
            )

    def insert_partition_usage_readings(self, readings: List[PartitionUsageReading]) -> None:
        """
        Insert partition usage readings.
        """
        if not readings:
            return

        with self.connect() as conn:
            conn.executemany(
                """
                INSERT INTO partition_usage_readings (
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
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        r.mountpoint,
                        r.device,
                        r.filesystem,
                        r.ts_epoch_ms,
                        r.ts_utc,
                        r.total_bytes,
                        r.used_bytes,
                        r.free_bytes,
                        r.usage_percent,
                    )
                    for r in readings
                ],
            )


# =========================
# Windows Fallback
# =========================

def get_windows_physical_disk_fallback() -> Optional[Dict[str, Any]]:
    """
    Windows fallback using PowerShell Get-PhysicalDisk.

    This helps when smartctl detects NVMe but fails to read full NVMe details.

    Can usually provide:
    - FriendlyName
    - SerialNumber
    - MediaType
    - HealthStatus
    - Size

    Usually cannot provide:
    - Power-on hours
    - Temperature
    """
    if not IS_WINDOWS:
        return None

    powershell_command = [
        "powershell",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        (
            "Get-PhysicalDisk | "
            "Select-Object FriendlyName, SerialNumber, MediaType, HealthStatus, Size | "
            "ConvertTo-Json -Depth 3"
        ),
    ]

    try:
        completed = subprocess.run(
            powershell_command,
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )
    except Exception as exc:
        logger.warning("Windows physical disk fallback failed: %s", exc)
        return None

    if completed.returncode != 0 or not completed.stdout.strip():
        logger.warning(
            "Windows physical disk fallback returned no usable output. stderr=%s",
            completed.stderr.strip(),
        )
        return None

    try:
        parsed = json.loads(completed.stdout)
    except json.JSONDecodeError:
        logger.warning("Windows physical disk fallback returned invalid JSON.")
        return None

    if isinstance(parsed, list):
        if not parsed:
            return None

        # For now, use first disk. Your current system has one NVMe disk.
        return parsed[0]

    if isinstance(parsed, dict):
        return parsed

    return None


# =========================
# smartctl Integration
# =========================

class SmartctlError(Exception):
    """
    Raised when smartctl cannot produce usable JSON.
    """


def smartctl_exists() -> bool:
    """
    Check whether smartctl is available.
    """
    return shutil.which("smartctl") is not None


def run_smartctl(args: List[str]) -> Dict[str, Any]:
    """
    Run smartctl and parse JSON output.

    smartctl may return non-zero exit codes even when JSON is still useful.
    So we parse stdout first.
    """
    command = ["smartctl", *args]

    try:
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=SMARTCTL_TIMEOUT_SECONDS,
            check=False,
        )
    except FileNotFoundError as exc:
        raise SmartctlError(
            "smartctl not found. Install smartmontools and ensure it is in PATH."
        ) from exc
    except subprocess.TimeoutExpired as exc:
        raise SmartctlError(
            f"smartctl timed out after {SMARTCTL_TIMEOUT_SECONDS}s: {' '.join(command)}"
        ) from exc
    except PermissionError as exc:
        raise SmartctlError(
            "Permission denied while running smartctl. Try running terminal as Administrator."
        ) from exc

    stdout = completed.stdout.strip()
    stderr = completed.stderr.strip()

    if not stdout:
        raise SmartctlError(
            f"smartctl returned no output. code={completed.returncode}, stderr={stderr}"
        )

    try:
        data = json.loads(stdout)
    except json.JSONDecodeError as exc:
        raise SmartctlError(
            f"smartctl output was not valid JSON. code={completed.returncode}, stderr={stderr}"
        ) from exc

    if completed.returncode != 0:
        logger.warning(
            "smartctl returned non-zero code=%s but JSON was parsed. stderr=%s",
            completed.returncode,
            stderr,
        )

    return data


def discover_smart_devices() -> List[DeviceInfo]:
    """
    Discover storage devices using smartctl.
    """
    if not smartctl_exists():
        logger.error("smartctl not found. SMART polling will be skipped.")
        return []

    try:
        data = run_smartctl(["--scan-open", "-j"])
    except SmartctlError as exc:
        logger.error("Failed to discover SMART devices: %s", exc)
        return []

    devices: List[DeviceInfo] = []

    for item in data.get("devices", []):
        name = item.get("name")

        if not name:
            continue

        devices.append(
            DeviceInfo(
                name=name,
                device_type=item.get("type"),
                protocol=item.get("protocol"),
            )
        )

    logger.info("Discovered %d SMART device(s)", len(devices))
    return devices


def extract_ata_smart_attribute(data: Dict[str, Any], attribute_id: int) -> Optional[int]:
    """
    Extract raw SMART value from ATA/SATA SMART attributes.

    Common IDs:
    5   = Reallocated Sector Count
    9   = Power-On Hours
    197 = Current Pending Sector Count
    194 = Temperature
    """
    table = data.get("ata_smart_attributes", {}).get("table", [])

    for attr in table:
        if attr.get("id") == attribute_id:
            raw = attr.get("raw", {})

            if isinstance(raw, dict):
                value = raw.get("value")
                if isinstance(value, int):
                    return value

                string_value = raw.get("string")
                if isinstance(string_value, str):
                    first_number = string_value.split()[0]
                    if first_number.isdigit():
                        return int(first_number)

            value = attr.get("value")
            if isinstance(value, int):
                return value

    return None


def extract_temperature_celsius(data: Dict[str, Any]) -> Optional[int]:
    """
    Extract temperature for ATA or NVMe where smartctl provides it.
    """
    temperature = data.get("temperature", {})
    current = temperature.get("current")

    if isinstance(current, int):
        return current

    nvme_log = data.get("nvme_smart_health_information_log", {})
    nvme_temp = nvme_log.get("temperature")

    if isinstance(nvme_temp, int):
        return nvme_temp

    return extract_ata_smart_attribute(data, 194)


def extract_power_on_hours(data: Dict[str, Any]) -> Optional[int]:
    """
    Extract power-on hours for ATA or NVMe where smartctl provides it.
    """
    ata_value = extract_ata_smart_attribute(data, 9)

    if ata_value is not None:
        return ata_value

    nvme_log = data.get("nvme_smart_health_information_log", {})
    nvme_value = nvme_log.get("power_on_hours")

    if isinstance(nvme_value, int):
        return nvme_value

    return None


def extract_smart_passed(data: Dict[str, Any]) -> Optional[bool]:
    """
    Extract SMART pass/fail status.

    First tries smartctl.
    If missing on Windows NVMe, falls back to PowerShell Get-PhysicalDisk.
    """
    smart_status = data.get("smart_status", {})
    passed = smart_status.get("passed")

    if isinstance(passed, bool):
        return passed

    if IS_WINDOWS:
        fallback = get_windows_physical_disk_fallback()

        if fallback:
            health_status = str(fallback.get("HealthStatus", "")).strip().lower()

            if health_status == "healthy":
                return True

            if health_status in {"unhealthy", "warning", "unknown"}:
                return False

    return None


def extract_smart_available(data: Dict[str, Any]) -> bool:
    """
    Determine whether SMART appears available.
    """
    support = data.get("smart_support", {})
    available = support.get("available")

    if isinstance(available, bool):
        return available

    protocol = data.get("device", {}).get("protocol")

    if protocol == "NVMe":
        return True

    return True


def enrich_device_info(device: DeviceInfo, data: Dict[str, Any]) -> DeviceInfo:
    """
    Enrich device information using smartctl JSON.

    If smartctl fails to provide full NVMe data on Windows,
    use PowerShell Get-PhysicalDisk fallback.
    """
    user_capacity = data.get("user_capacity", {})
    capacity_bytes = user_capacity.get("bytes")

    device_block = data.get("device", {})

    protocol = (
        device_block.get("protocol")
        or device.protocol
    )

    device_type = (
        device_block.get("type")
        or device.device_type
    )

    model_name = (
        data.get("model_name")
        or data.get("model_family")
        or data.get("device_model")
    )

    serial_number = data.get("serial_number")
    firmware_version = data.get("firmware_version")

    if IS_WINDOWS and (model_name is None or capacity_bytes is None or serial_number is None):
        fallback = get_windows_physical_disk_fallback()

        if fallback:
            model_name = model_name or fallback.get("FriendlyName")
            serial_number = serial_number or fallback.get("SerialNumber")

            fallback_size = fallback.get("Size")
            if capacity_bytes is None and isinstance(fallback_size, int):
                capacity_bytes = fallback_size

    return DeviceInfo(
        name=device.name,
        device_type=device_type,
        protocol=protocol,
        model_name=model_name,
        serial_number=serial_number,
        firmware_version=firmware_version,
        capacity_bytes=capacity_bytes if isinstance(capacity_bytes, int) else None,
    )


def collect_smart_reading(device: DeviceInfo) -> Tuple[DeviceInfo, SmartReading]:
    """
    Collect SMART telemetry for one device.
    """
    ts_epoch_ms, ts_utc = now_utc()

    args = ["-a", "-j"]

    if device.device_type:
        args.extend(["-d", device.device_type])

    args.append(device.name)

    try:
        data = run_smartctl(args)

        enriched_device = enrich_device_info(device, data)

        reading = SmartReading(
            device_name=device.name,
            ts_epoch_ms=ts_epoch_ms,
            ts_utc=ts_utc,
            smart_available=extract_smart_available(data),
            smart_passed=extract_smart_passed(data),
            reallocated_sectors=extract_ata_smart_attribute(data, 5),
            power_on_hours=extract_power_on_hours(data),
            pending_sectors=extract_ata_smart_attribute(data, 197),
            temperature_celsius=extract_temperature_celsius(data),
            raw_json=json.dumps(data, separators=(",", ":")),
            error_message=None,
        )

        return enriched_device, reading

    except SmartctlError as exc:
        logger.error("SMART collection failed for %s: %s", device.name, exc)

        reading = SmartReading(
            device_name=device.name,
            ts_epoch_ms=ts_epoch_ms,
            ts_utc=ts_utc,
            smart_available=False,
            smart_passed=None,
            reallocated_sectors=None,
            power_on_hours=None,
            pending_sectors=None,
            temperature_celsius=None,
            raw_json=None,
            error_message=str(exc),
        )

        return device, reading


# =========================
# psutil Collection
# =========================

def collect_disk_io_speed(sample_seconds: float = IO_SAMPLE_SECONDS) -> List[DiskIoReading]:
    """
    Collect disk I/O speed.

    psutil disk counters are cumulative since boot, so speed is calculated
    by sampling twice and dividing the delta by elapsed time.
    """
    first = psutil.disk_io_counters(perdisk=True)
    start_time = time.monotonic()

    time.sleep(sample_seconds)

    second = psutil.disk_io_counters(perdisk=True)
    end_time = time.monotonic()

    elapsed = max(end_time - start_time, 0.001)
    ts_epoch_ms, ts_utc = now_utc()

    readings: List[DiskIoReading] = []

    for disk_name, after in second.items():
        before = first.get(disk_name)

        if before is None:
            continue

        read_delta = max(after.read_bytes - before.read_bytes, 0)
        write_delta = max(after.write_bytes - before.write_bytes, 0)

        readings.append(
            DiskIoReading(
                disk_name=disk_name,
                ts_epoch_ms=ts_epoch_ms,
                ts_utc=ts_utc,
                read_bytes_total=after.read_bytes,
                write_bytes_total=after.write_bytes,
                read_count_total=after.read_count,
                write_count_total=after.write_count,
                read_bytes_per_sec=read_delta / elapsed,
                write_bytes_per_sec=write_delta / elapsed,
            )
        )

    return readings


def collect_partition_usage() -> List[PartitionUsageReading]:
    """
    Collect partition usage/stress.
    """
    ts_epoch_ms, ts_utc = now_utc()
    readings: List[PartitionUsageReading] = []

    partitions = psutil.disk_partitions(all=False)

    for partition in partitions:
        try:
            usage = psutil.disk_usage(partition.mountpoint)
        except PermissionError:
            logger.warning("Permission denied reading partition usage: %s", partition.mountpoint)
            continue
        except FileNotFoundError:
            logger.warning("Partition disappeared during polling: %s", partition.mountpoint)
            continue
        except OSError as exc:
            logger.warning("Could not read partition %s: %s", partition.mountpoint, exc)
            continue

        readings.append(
            PartitionUsageReading(
                mountpoint=partition.mountpoint,
                device=partition.device,
                filesystem=partition.fstype,
                ts_epoch_ms=ts_epoch_ms,
                ts_utc=ts_utc,
                total_bytes=usage.total,
                used_bytes=usage.used,
                free_bytes=usage.free,
                usage_percent=usage.percent,
            )
        )

    return readings


# =========================
# Worker Service
# =========================

class StorageHealthWorker:
    """
    Background worker.

    It:
    - discovers storage devices
    - polls SMART data
    - polls OS disk metrics
    - writes to SQLite
    """

    def __init__(self, db_path: str, interval_seconds: int):
        self.db = StorageHealthDatabase(db_path)
        self.interval_seconds = interval_seconds
        self.stop_requested = False

    def request_stop(self, signum: Optional[int] = None, frame: Any = None) -> None:
        """
        Graceful shutdown handler.
        """
        logger.info("Stop requested. Finishing current cycle before shutdown.")
        self.stop_requested = True

    def run_forever(self) -> None:
        """
        Run forever using polling interval.
        """
        logger.info(
            "Storage Health Worker started. interval=%ss",
            self.interval_seconds,
        )

        while not self.stop_requested:
            cycle_start = time.monotonic()
            self.run_once()

            elapsed = time.monotonic() - cycle_start
            sleep_for = max(self.interval_seconds - elapsed, 0)

            logger.info(
                "Polling cycle finished in %.2fs. Sleeping for %.2fs.",
                elapsed,
                sleep_for,
            )

            self._sleep_interruptibly(sleep_for)

        logger.info("Storage Health Worker stopped.")

    def run_once(self) -> None:
        """
        Run one polling cycle.
        """
        poll_run_id = self.db.start_poll_run()

        try:
            devices = discover_smart_devices()

            for device in devices:
                enriched_device, reading = collect_smart_reading(device)

                # Save device first.
                self.db.upsert_device(enriched_device)

                # Then save SMART reading linked to that device.
                self.db.insert_smart_reading(reading)

            io_readings = collect_disk_io_speed()
            self.db.insert_disk_io_readings(io_readings)

            partition_readings = collect_partition_usage()
            self.db.insert_partition_usage_readings(partition_readings)

            try:
                from storage_ai_analyzer import StorageAiAnalyzer

                analysis = StorageAiAnalyzer(self.db.db_path).analyze_latest_and_store()
                logger.info(
                    "AI analysis stored: risk=%s, probability_30d=%.2f%%, confidence=%.2f%%",
                    analysis.risk_level,
                    analysis.failure_probability_30d,
                    analysis.model_confidence,
                )
            except Exception as exc:
                logger.warning("AI analysis skipped: %s", exc)

            self.db.finish_poll_run(poll_run_id, "SUCCESS")

            logger.info(
                "Poll success: smart_devices=%d, io_disks=%d, partitions=%d",
                len(devices),
                len(io_readings),
                len(partition_readings),
            )

        except Exception as exc:
            logger.exception("Unexpected polling failure: %s", exc)
            self.db.finish_poll_run(poll_run_id, "FAILED", str(exc))

    def _sleep_interruptibly(self, seconds: float) -> None:
        """
        Sleep in short chunks so Ctrl+C works quickly.
        """
        end_time = time.monotonic() + seconds

        while not self.stop_requested and time.monotonic() < end_time:
            time.sleep(min(1.0, end_time - time.monotonic()))


# =========================
# CLI
# =========================

def parse_args() -> argparse.Namespace:
    """
    Parse command-line arguments.
    """
    parser = argparse.ArgumentParser(
        description="Smart Storage Health Monitor background telemetry worker"
    )

    parser.add_argument(
        "--db",
        default=DEFAULT_DB_PATH,
        help=f"SQLite database path. Default: {DEFAULT_DB_PATH}",
    )

    parser.add_argument(
        "--interval",
        type=int,
        default=DEFAULT_POLL_INTERVAL_SECONDS,
        help=f"Polling interval in seconds. Default: {DEFAULT_POLL_INTERVAL_SECONDS}",
    )

    parser.add_argument(
        "--once",
        action="store_true",
        help="Run one polling cycle and exit.",
    )

    parser.add_argument(
        "--log-file",
        default=LOG_FILE,
        help=f"Log file path. Default: {LOG_FILE}",
    )

    return parser.parse_args()


def main() -> None:
    """
    Program entry point.
    """
    args = parse_args()

    global logger
    logger = setup_logging(args.log_file)

    db_path = str(Path(args.db).resolve())

    worker = StorageHealthWorker(
        db_path=db_path,
        interval_seconds=args.interval,
    )

    signal.signal(signal.SIGINT, worker.request_stop)
    signal.signal(signal.SIGTERM, worker.request_stop)

    if args.once:
        logger.info("Running single polling cycle.")
        worker.run_once()
        logger.info("Single polling cycle complete.")
        return

    worker.run_forever()


if __name__ == "__main__":
    main()
