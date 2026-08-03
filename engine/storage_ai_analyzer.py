#!/usr/bin/env python3
"""
Smart Storage Health Monitor - Python AI/ML Analysis Pipeline

This module reads the latest telemetry from SQLite, runs a local serialized
Random-Forest-style risk model, optionally asks Gemini for a short explanation,
and stores the final plain-English analysis back into SQLite.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import pickle
import sqlite3
import time
import urllib.error
import urllib.request
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


DEFAULT_DB_PATH = "storage_health.db"
DEFAULT_MODEL_PATH = Path(__file__).resolve().parent / "models" / "storage_failure_forest.pkl"
GEMINI_MODEL = "gemini-1.5-flash"


FEATURE_NAMES = [
    "smart_failed",
    "smart_unavailable",
    "reallocated_sectors",
    "pending_sectors",
    "temperature_celsius",
    "power_on_hours",
    "max_partition_usage_percent",
    "avg_partition_usage_percent",
    "io_activity_mb_sec",
    "telemetry_age_minutes",
    "error_present",
    "missing_smart_attributes",
]


def now_utc() -> Tuple[int, str]:
    current = time.time()
    epoch_ms = int(current * 1000)
    iso_utc = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(current))
    return epoch_ms, iso_utc


def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


@dataclass
class TelemetryContext:
    smart: Dict[str, Any]
    disk_io: Optional[Dict[str, Any]]
    partitions: List[Dict[str, Any]]


@dataclass
class AnalysisResult:
    smart_reading_id: int
    timestamp_epoch_ms: int
    timestamp_utc: str
    failure_probability_30d: float
    health_score: float
    risk_level: str
    model_name: str
    model_version: str
    model_confidence: float
    analysis_summary: str
    recommendation: str
    top_signals: List[Dict[str, Any]]
    gemini_used: bool


class StorageFailureForest:
    """
    Small serialized ensemble used for local hackathon inference.

    It behaves like a compact Random Forest: several decision trees vote a
    failure probability, then the average is treated as the 30-day risk score.
    """

    def __init__(self, payload: Dict[str, Any]):
        self.payload = payload
        self.trees = payload["trees"]
        self.model_name = payload["model_name"]
        self.model_version = payload["model_version"]

    def predict_probability(self, features: Dict[str, float]) -> Tuple[float, List[float]]:
        tree_votes = [self._eval_tree(tree, features) for tree in self.trees]
        probability = sum(tree_votes) / max(len(tree_votes), 1)
        return clamp(probability, 1.0, 99.0), tree_votes

    def _eval_tree(self, node: Dict[str, Any], features: Dict[str, float]) -> float:
        if "probability" in node:
            return float(node["probability"])

        feature = node["feature"]
        threshold = float(node["threshold"])
        value = float(features.get(feature, 0.0))
        branch = "right" if value >= threshold else "left"
        return self._eval_tree(node[branch], features)


def default_model_payload() -> Dict[str, Any]:
    return {
        "model_name": "Local Random Forest Storage Failure Predictor",
        "model_version": "rf-baseline-2026.05",
        "feature_names": FEATURE_NAMES,
        "training_note": (
            "Hackathon baseline calibrated from common SMART failure heuristics "
            "and Backblaze-style drive health factors."
        ),
        "trees": [
            {
                "feature": "smart_failed",
                "threshold": 0.5,
                "left": {
                    "feature": "pending_sectors",
                    "threshold": 1,
                    "left": {"feature": "max_partition_usage_percent", "threshold": 92, "left": {"probability": 7}, "right": {"probability": 20}},
                    "right": {"feature": "pending_sectors", "threshold": 10, "left": {"probability": 38}, "right": {"probability": 68}},
                },
                "right": {"probability": 82},
            },
            {
                "feature": "reallocated_sectors",
                "threshold": 1,
                "left": {
                    "feature": "temperature_celsius",
                    "threshold": 50,
                    "left": {"probability": 6},
                    "right": {"probability": 26},
                },
                "right": {
                    "feature": "reallocated_sectors",
                    "threshold": 25,
                    "left": {"probability": 32},
                    "right": {"probability": 72},
                },
            },
            {
                "feature": "smart_unavailable",
                "threshold": 0.5,
                "left": {"feature": "error_present", "threshold": 0.5, "left": {"probability": 8}, "right": {"probability": 31}},
                "right": {"feature": "missing_smart_attributes", "threshold": 3, "left": {"probability": 24}, "right": {"probability": 42}},
            },
            {
                "feature": "power_on_hours",
                "threshold": 30000,
                "left": {
                    "feature": "max_partition_usage_percent",
                    "threshold": 95,
                    "left": {"probability": 9},
                    "right": {"probability": 25},
                },
                "right": {"feature": "temperature_celsius", "threshold": 45, "left": {"probability": 24}, "right": {"probability": 47}},
            },
            {
                "feature": "temperature_celsius",
                "threshold": 55,
                "left": {
                    "feature": "telemetry_age_minutes",
                    "threshold": 60,
                    "left": {"probability": 8},
                    "right": {"probability": 18},
                },
                "right": {"feature": "pending_sectors", "threshold": 1, "left": {"probability": 34}, "right": {"probability": 74}},
            },
            {
                "feature": "io_activity_mb_sec",
                "threshold": 0.02,
                "left": {
                    "feature": "smart_unavailable",
                    "threshold": 0.5,
                    "left": {"probability": 14},
                    "right": {"probability": 36},
                },
                "right": {"feature": "smart_failed", "threshold": 0.5, "left": {"probability": 7}, "right": {"probability": 78}},
            },
            {
                "feature": "missing_smart_attributes",
                "threshold": 3,
                "left": {
                    "feature": "avg_partition_usage_percent",
                    "threshold": 88,
                    "left": {"probability": 8},
                    "right": {"probability": 22},
                },
                "right": {"feature": "smart_unavailable", "threshold": 0.5, "left": {"probability": 19}, "right": {"probability": 39}},
            },
            {
                "feature": "pending_sectors",
                "threshold": 1,
                "left": {"feature": "reallocated_sectors", "threshold": 1, "left": {"probability": 6}, "right": {"probability": 30}},
                "right": {"feature": "smart_failed", "threshold": 0.5, "left": {"probability": 44}, "right": {"probability": 87}},
            },
            {
                "feature": "max_partition_usage_percent",
                "threshold": 98,
                "left": {"feature": "temperature_celsius", "threshold": 42, "left": {"probability": 8}, "right": {"probability": 18}},
                "right": {"feature": "smart_failed", "threshold": 0.5, "left": {"probability": 27}, "right": {"probability": 85}},
            },
        ],
    }


def ensure_model_file(model_path: Path = DEFAULT_MODEL_PATH) -> Path:
    model_path.parent.mkdir(parents=True, exist_ok=True)

    if not model_path.exists():
        with model_path.open("wb") as handle:
            pickle.dump(default_model_payload(), handle)

    return model_path


def load_model(model_path: Path = DEFAULT_MODEL_PATH) -> StorageFailureForest:
    ensure_model_file(model_path)

    try:
        with model_path.open("rb") as handle:
            payload = pickle.load(handle)
    except (EOFError, pickle.UnpicklingError):
        with model_path.open("wb") as handle:
            payload = default_model_payload()
            pickle.dump(payload, handle)

    return StorageFailureForest(payload)


class StorageAiAnalyzer:
    def __init__(self, db_path: str, model_path: Path = DEFAULT_MODEL_PATH):
        self.db_path = db_path
        self.model = load_model(model_path)
        self.ensure_schema()

    @contextmanager
    def connect(self) -> Iterable[sqlite3.Connection]:
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

    def ensure_schema(self) -> None:
        with self.connect() as conn:
            conn.executescript(
                """
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

    def latest_context(self) -> Optional[TelemetryContext]:
        with self.connect() as conn:
            smart = conn.execute(
                """
                SELECT
                    s.id AS smart_reading_id,
                    s.ts_epoch_ms,
                    s.ts_utc,
                    s.smart_available,
                    s.smart_passed,
                    s.reallocated_sectors,
                    s.power_on_hours,
                    s.pending_sectors,
                    s.temperature_celsius,
                    s.raw_json,
                    s.error_message,
                    d.id AS device_id,
                    d.device_name,
                    d.device_type,
                    d.model_name,
                    d.serial_number,
                    d.firmware_version,
                    d.protocol,
                    d.capacity_bytes
                FROM smart_readings s
                JOIN devices d ON d.id = s.device_id
                ORDER BY s.ts_epoch_ms DESC
                LIMIT 1
                """
            ).fetchone()

            if smart is None:
                return None

            disk_io = conn.execute(
                """
                SELECT *
                FROM disk_io_readings
                ORDER BY ts_epoch_ms DESC
                LIMIT 1
                """
            ).fetchone()

            latest_partition_timestamp = conn.execute(
                "SELECT MAX(ts_epoch_ms) AS latest_ts FROM partition_usage_readings"
            ).fetchone()

            partitions: List[Dict[str, Any]] = []
            if latest_partition_timestamp and latest_partition_timestamp["latest_ts"] is not None:
                partitions = [
                    dict(row)
                    for row in conn.execute(
                        """
                        SELECT *
                        FROM partition_usage_readings
                        WHERE ts_epoch_ms = ?
                        ORDER BY mountpoint ASC
                        """,
                        (latest_partition_timestamp["latest_ts"],),
                    ).fetchall()
                ]

            return TelemetryContext(
                smart=dict(smart),
                disk_io=dict(disk_io) if disk_io is not None else None,
                partitions=partitions,
            )

    def analyze_latest_and_store(self) -> AnalysisResult:
        context = self.latest_context()
        if context is None:
            raise RuntimeError("No SMART telemetry data found. Run the Python worker first.")

        features = build_feature_vector(context)
        probability, tree_votes = self.model.predict_probability(features)
        health_score = clamp(100.0 - probability, 1.0, 99.0)
        risk_level = risk_level_for_probability(probability)
        confidence = confidence_from_votes(tree_votes, features)
        top_signals = build_top_signals(context, features)
        recommendation = build_recommendation(risk_level, probability, top_signals)
        summary, gemini_used = build_plain_english_summary(
            context=context,
            probability=probability,
            health_score=health_score,
            risk_level=risk_level,
            recommendation=recommendation,
            top_signals=top_signals,
        )

        result = AnalysisResult(
            smart_reading_id=int(context.smart["smart_reading_id"]),
            timestamp_epoch_ms=int(context.smart["ts_epoch_ms"]),
            timestamp_utc=str(context.smart["ts_utc"]),
            failure_probability_30d=round(probability, 2),
            health_score=round(health_score, 2),
            risk_level=risk_level,
            model_name=self.model.model_name,
            model_version=self.model.model_version,
            model_confidence=round(confidence, 2),
            analysis_summary=summary,
            recommendation=recommendation,
            top_signals=top_signals,
            gemini_used=gemini_used,
        )

        self.insert_analysis(result)
        return result

    def insert_analysis(self, result: AnalysisResult) -> None:
        created_epoch_ms, created_utc = now_utc()

        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO ai_analysis (
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
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    result.smart_reading_id,
                    result.timestamp_epoch_ms,
                    result.timestamp_utc,
                    result.failure_probability_30d,
                    result.health_score,
                    result.risk_level,
                    result.model_name,
                    result.model_version,
                    result.model_confidence,
                    result.analysis_summary,
                    result.recommendation,
                    json.dumps(result.top_signals, separators=(",", ":")),
                    int(result.gemini_used),
                    created_epoch_ms,
                    created_utc,
                ),
            )


def build_feature_vector(context: TelemetryContext) -> Dict[str, float]:
    smart = context.smart
    partitions = context.partitions
    disk_io = context.disk_io or {}
    now_ms, _ = now_utc()

    smart_available = smart.get("smart_available")
    smart_passed = smart.get("smart_passed")
    reallocated = numeric_or_zero(smart.get("reallocated_sectors"))
    pending = numeric_or_zero(smart.get("pending_sectors"))
    temperature = numeric_or_default(smart.get("temperature_celsius"), 30)
    power_on_hours = numeric_or_zero(smart.get("power_on_hours"))
    read_mb = numeric_or_zero(disk_io.get("read_bytes_per_sec")) / (1024 * 1024)
    write_mb = numeric_or_zero(disk_io.get("write_bytes_per_sec")) / (1024 * 1024)
    partition_usage = [numeric_or_zero(item.get("usage_percent")) for item in partitions]
    timestamp = numeric_or_zero(smart.get("ts_epoch_ms"))
    telemetry_age_minutes = max((now_ms - timestamp) / 60000.0, 0.0) if timestamp else 999.0
    missing_count = sum(
        1
        for key in ["reallocated_sectors", "pending_sectors", "temperature_celsius", "power_on_hours"]
        if smart.get(key) is None
    )

    return {
        "smart_failed": 1.0 if smart_passed == 0 else 0.0,
        "smart_unavailable": 1.0 if smart_available == 0 else 0.0,
        "reallocated_sectors": reallocated,
        "pending_sectors": pending,
        "temperature_celsius": temperature,
        "power_on_hours": power_on_hours,
        "max_partition_usage_percent": max(partition_usage) if partition_usage else 0.0,
        "avg_partition_usage_percent": sum(partition_usage) / len(partition_usage) if partition_usage else 0.0,
        "io_activity_mb_sec": read_mb + write_mb,
        "telemetry_age_minutes": telemetry_age_minutes,
        "error_present": 1.0 if smart.get("error_message") else 0.0,
        "missing_smart_attributes": float(missing_count),
    }


def numeric_or_zero(value: Any) -> float:
    return numeric_or_default(value, 0.0)


def numeric_or_default(value: Any, default: float) -> float:
    try:
        if value is None:
            return float(default)
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def confidence_from_votes(tree_votes: List[float], features: Dict[str, float]) -> float:
    if not tree_votes:
        return 60.0

    mean = sum(tree_votes) / len(tree_votes)
    variance = sum((vote - mean) ** 2 for vote in tree_votes) / len(tree_votes)
    disagreement_penalty = math.sqrt(variance) * 0.45
    missing_penalty = features["missing_smart_attributes"] * 4.0
    unavailable_penalty = features["smart_unavailable"] * 7.0
    age_penalty = 8.0 if features["telemetry_age_minutes"] > 120 else 0.0

    return clamp(96.0 - disagreement_penalty - missing_penalty - unavailable_penalty - age_penalty, 55.0, 96.0)


def risk_level_for_probability(probability: float) -> str:
    if probability >= 65:
        return "Critical Risk"
    if probability >= 40:
        return "High Risk"
    if probability >= 22:
        return "Moderate Risk"
    return "Low Risk"


def build_top_signals(context: TelemetryContext, features: Dict[str, float]) -> List[Dict[str, Any]]:
    signals: List[Dict[str, Any]] = []

    add_signal(
        signals,
        "SMART self-test",
        "Critical" if features["smart_failed"] else "Healthy",
        "SMART reports a failing status." if features["smart_failed"] else "SMART pass status is currently normal.",
        92 if features["smart_failed"] else 8,
    )
    add_signal(
        signals,
        "Pending sectors",
        "Critical" if features["pending_sectors"] >= 10 else "Warning" if features["pending_sectors"] >= 1 else "Healthy",
        f"{int(features['pending_sectors'])} pending sector(s) reported.",
        78 if features["pending_sectors"] >= 10 else 42 if features["pending_sectors"] >= 1 else 6,
    )
    add_signal(
        signals,
        "Reallocated sectors",
        "Critical" if features["reallocated_sectors"] >= 25 else "Warning" if features["reallocated_sectors"] >= 1 else "Healthy",
        f"{int(features['reallocated_sectors'])} reallocated sector(s) reported.",
        74 if features["reallocated_sectors"] >= 25 else 38 if features["reallocated_sectors"] >= 1 else 5,
    )
    add_signal(
        signals,
        "Temperature",
        "Critical" if features["temperature_celsius"] >= 55 else "Warning" if features["temperature_celsius"] >= 45 else "Healthy",
        f"Latest temperature is {features['temperature_celsius']:.0f}C.",
        62 if features["temperature_celsius"] >= 55 else 30 if features["temperature_celsius"] >= 45 else 7,
    )
    add_signal(
        signals,
        "Partition pressure",
        "Critical" if features["max_partition_usage_percent"] >= 95 else "Warning" if features["max_partition_usage_percent"] >= 85 else "Healthy",
        f"Maximum partition usage is {features['max_partition_usage_percent']:.1f}%.",
        54 if features["max_partition_usage_percent"] >= 95 else 28 if features["max_partition_usage_percent"] >= 85 else 6,
    )

    if features["smart_unavailable"]:
        add_signal(
            signals,
            "SMART availability",
            "Warning",
            "SMART data is limited for the latest reading.",
            34,
        )

    if features["telemetry_age_minutes"] > 120:
        add_signal(
            signals,
            "Telemetry freshness",
            "Warning",
            f"Latest SMART sample is {features['telemetry_age_minutes']:.0f} minutes old.",
            24,
        )

    return sorted(signals, key=lambda item: item["impactScore"], reverse=True)[:5]


def add_signal(signals: List[Dict[str, Any]], label: str, severity: str, detail: str, impact_score: float) -> None:
    signals.append(
        {
            "label": label,
            "severity": severity,
            "detail": detail,
            "impactScore": round(float(impact_score), 2),
        }
    )


def build_recommendation(risk_level: str, probability: float, top_signals: List[Dict[str, Any]]) -> str:
    if risk_level == "Critical Risk":
        return "Back up important files immediately, stop heavy write workloads, and prepare to replace the drive."

    if risk_level == "High Risk":
        return "Run a full backup today, keep the machine powered and cooled, and monitor SMART attributes closely."

    if risk_level == "Moderate Risk":
        return "Verify your latest backup, free storage pressure if needed, and re-check drive health within 24 hours."

    elevated = next((signal for signal in top_signals if signal["severity"] != "Healthy"), None)
    if elevated:
        return f"Drive risk is low, but keep watching {elevated['label'].lower()} and maintain a current backup."

    return "Drive risk is low. Continue regular monitoring and keep routine backups enabled."


def build_plain_english_summary(
    context: TelemetryContext,
    probability: float,
    health_score: float,
    risk_level: str,
    recommendation: str,
    top_signals: List[Dict[str, Any]],
) -> Tuple[str, bool]:
    local_summary = build_local_summary(context, probability, health_score, risk_level, recommendation, top_signals)
    gemini_summary = try_gemini_summary(context, probability, health_score, risk_level, recommendation, top_signals)

    if gemini_summary:
        return gemini_summary, True

    return local_summary, False


def build_local_summary(
    context: TelemetryContext,
    probability: float,
    health_score: float,
    risk_level: str,
    recommendation: str,
    top_signals: List[Dict[str, Any]],
) -> str:
    smart = context.smart
    model_name = smart.get("model_name") or "the monitored storage device"
    top_signal = top_signals[0] if top_signals else None
    signal_text = top_signal["detail"] if top_signal else "No severe SMART attribute is currently reported."

    return (
        f"{model_name} is classified as {risk_level.lower()} with a "
        f"{probability:.1f}% estimated 30-day failure probability and a "
        f"{health_score:.0f}% health score. {signal_text} {recommendation}"
    )


def try_gemini_summary(
    context: TelemetryContext,
    probability: float,
    health_score: float,
    risk_level: str,
    recommendation: str,
    top_signals: List[Dict[str, Any]],
) -> Optional[str]:
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None

    prompt = {
        "device": context.smart.get("model_name") or context.smart.get("device_name"),
        "protocol": context.smart.get("protocol"),
        "riskLevel": risk_level,
        "failureProbability30d": round(probability, 2),
        "healthScore": round(health_score, 2),
        "smartPassed": context.smart.get("smart_passed"),
        "temperatureCelsius": context.smart.get("temperature_celsius"),
        "reallocatedSectors": context.smart.get("reallocated_sectors"),
        "pendingSectors": context.smart.get("pending_sectors"),
        "partitions": [
            {
                "mountpoint": item.get("mountpoint"),
                "usagePercent": item.get("usage_percent"),
            }
            for item in context.partitions
        ],
        "topSignals": top_signals,
        "recommendation": recommendation,
    }

    body = {
        "contents": [
            {
                "parts": [
                    {
                        "text": (
                            "Convert this storage telemetry prediction into one concise, "
                            "plain-English health briefing for a non-technical user. "
                            "Keep it under 75 words and include a concrete next action.\n\n"
                            f"{json.dumps(prompt, separators=(',', ':'))}"
                        )
                    }
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.25,
            "maxOutputTokens": 120,
        },
    }

    endpoint = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
        f"?key={api_key}"
    )

    request = urllib.request.Request(
        endpoint,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            data = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, KeyError):
        return None

    candidates = data.get("candidates") or []
    if not candidates:
        return None

    parts = candidates[0].get("content", {}).get("parts") or []
    if not parts:
        return None

    text = str(parts[0].get("text", "")).strip()
    return text or None


def result_to_dict(result: AnalysisResult) -> Dict[str, Any]:
    return {
        "smartReadingId": result.smart_reading_id,
        "timestampEpochMs": result.timestamp_epoch_ms,
        "timestampUtc": result.timestamp_utc,
        "failureProbability30d": result.failure_probability_30d,
        "healthScore": result.health_score,
        "riskLevel": result.risk_level,
        "modelName": result.model_name,
        "modelVersion": result.model_version,
        "modelConfidence": result.model_confidence,
        "analysisSummary": result.analysis_summary,
        "recommendation": result.recommendation,
        "topSignals": result.top_signals,
        "geminiUsed": result.gemini_used,
    }


def sync_latest_snapshot_to_cloud(
    db_path: str,
    analysis: AnalysisResult,
    endpoint: Optional[str] = None,
    token: Optional[str] = None,
) -> Dict[str, Any]:
    endpoint = endpoint or resolve_cloud_ingest_endpoint()

    if not endpoint:
        return {"enabled": False, "synced": False, "reason": "cloud ingest endpoint not configured"}

    analyzer = StorageAiAnalyzer(db_path=db_path)
    context = analyzer.latest_context()

    if context is None:
        raise RuntimeError("No local telemetry is available to sync.")

    payload = build_ingest_payload(context, analysis)
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    request = urllib.request.Request(
        endpoint,
        data=body,
        headers={
            "Content-Type": "application/json",
            **ingest_auth_header(token),
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            response_text = response.read().decode("utf-8")
            response_data = json.loads(response_text) if response_text.strip() else {}
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"Cloud ingest failed: {exc}") from exc

    return {
        "enabled": True,
        "synced": True,
        "endpoint": endpoint,
        "response": response_data,
    }


def resolve_cloud_ingest_endpoint() -> Optional[str]:
    explicit = os.environ.get("CLOUD_INGEST_URL", "").strip()
    if explicit:
        return explicit

    base_url = os.environ.get("CLOUD_API_BASE_URL", "").strip()
    if not base_url:
        return None

    normalized = base_url.rstrip("/")
    if normalized.endswith("/api"):
        return f"{normalized}/ingest/snapshot"

    return f"{normalized}/api/ingest/snapshot"


def ingest_auth_header(token: Optional[str] = None) -> Dict[str, str]:
    resolved_token = token if token is not None else os.environ.get("CLOUD_INGEST_TOKEN", "")
    resolved_token = resolved_token.strip()

    if not resolved_token:
        return {}

    return {"X-Ingest-Key": resolved_token}


def build_ingest_payload(context: TelemetryContext, analysis: AnalysisResult) -> Dict[str, Any]:
    smart = context.smart
    disk_io = context.disk_io or {}

    return {
        "device": {
            "deviceName": smart.get("device_name"),
            "deviceType": smart.get("device_type"),
            "protocol": smart.get("protocol"),
            "modelName": smart.get("model_name"),
            "serialNumber": smart.get("serial_number"),
            "firmwareVersion": smart.get("firmware_version"),
            "capacityBytes": smart.get("capacity_bytes"),
        },
        "smart": {
            "timestampEpochMs": smart.get("ts_epoch_ms"),
            "timestampUtc": smart.get("ts_utc"),
            "smartAvailable": int_to_bool(smart.get("smart_available")),
            "smartPassed": int_to_optional_bool(smart.get("smart_passed")),
            "reallocatedSectors": smart.get("reallocated_sectors"),
            "powerOnHours": smart.get("power_on_hours"),
            "pendingSectors": smart.get("pending_sectors"),
            "temperatureCelsius": smart.get("temperature_celsius"),
            "rawJson": smart.get("raw_json"),
            "errorMessage": smart.get("error_message"),
        },
        "diskIo": {
            "diskName": disk_io.get("disk_name"),
            "timestampEpochMs": disk_io.get("ts_epoch_ms"),
            "timestampUtc": disk_io.get("ts_utc"),
            "readBytesTotal": disk_io.get("read_bytes_total"),
            "writeBytesTotal": disk_io.get("write_bytes_total"),
            "readCountTotal": disk_io.get("read_count_total"),
            "writeCountTotal": disk_io.get("write_count_total"),
            "readBytesPerSec": disk_io.get("read_bytes_per_sec"),
            "writeBytesPerSec": disk_io.get("write_bytes_per_sec"),
        } if disk_io else None,
        "partitions": [
            {
                "mountpoint": partition.get("mountpoint"),
                "device": partition.get("device"),
                "filesystem": partition.get("filesystem"),
                "timestampEpochMs": partition.get("ts_epoch_ms"),
                "timestampUtc": partition.get("ts_utc"),
                "totalBytes": partition.get("total_bytes"),
                "usedBytes": partition.get("used_bytes"),
                "freeBytes": partition.get("free_bytes"),
                "usagePercent": partition.get("usage_percent"),
            }
            for partition in context.partitions
        ],
        "analysis": {
            "timestampEpochMs": analysis.timestamp_epoch_ms,
            "timestampUtc": analysis.timestamp_utc,
            "failureProbability30d": analysis.failure_probability_30d,
            "healthScore": analysis.health_score,
            "riskLevel": analysis.risk_level,
            "modelName": analysis.model_name,
            "modelVersion": analysis.model_version,
            "modelConfidence": analysis.model_confidence,
            "analysisSummary": analysis.analysis_summary,
            "recommendation": analysis.recommendation,
            "topSignalsJson": json.dumps(analysis.top_signals, separators=(",", ":")),
            "geminiUsed": analysis.gemini_used,
        },
    }


def int_to_bool(value: Any) -> bool:
    return int_to_optional_bool(value) is True


def int_to_optional_bool(value: Any) -> Optional[bool]:
    if value is None:
        return None

    try:
        return int(value) == 1
    except (TypeError, ValueError):
        return None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run storage AI/ML analysis over the latest SQLite telemetry.")
    parser.add_argument("--db", default=DEFAULT_DB_PATH, help=f"SQLite database path. Default: {DEFAULT_DB_PATH}")
    parser.add_argument("--model", default=str(DEFAULT_MODEL_PATH), help="Serialized model path.")
    parser.add_argument("--init-model", action="store_true", help="Create the serialized model file and exit.")
    parser.add_argument("--json", action="store_true", help="Print the latest analysis as JSON.")
    parser.add_argument("--sync-cloud", action="store_true", help="Push the latest local telemetry snapshot to the cloud ingest endpoint.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    model_path = Path(args.model).resolve()

    if args.init_model:
        path = ensure_model_file(model_path)
        print(f"Model ready: {path}")
        return

    db_path = str(Path(args.db).resolve())
    analyzer = StorageAiAnalyzer(db_path=db_path, model_path=model_path)
    result = analyzer.analyze_latest_and_store()

    cloud_sync = None
    if args.sync_cloud:
        cloud_sync = sync_latest_snapshot_to_cloud(db_path=db_path, analysis=result)

    if args.json:
        response = result_to_dict(result)
        if cloud_sync is not None:
            response["cloudSync"] = cloud_sync
        print(json.dumps(response, indent=2))
        return

    print(
        f"{result.risk_level}: {result.failure_probability_30d:.1f}% 30-day risk "
        f"({result.model_confidence:.0f}% confidence)"
    )
    print(result.analysis_summary)
    if cloud_sync is not None:
        print(f"Cloud sync: {'sent' if cloud_sync.get('synced') else cloud_sync.get('reason', 'skipped')}")


if __name__ == "__main__":
    main()
