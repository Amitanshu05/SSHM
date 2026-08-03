import { useCallback, useMemo, useState } from "react";

const ANALYTICS_TABS = ["Performance", "Health insights", "Anomalies", "Capacity", "Comparisons"];
const THEME_OPTIONS = ["Light", "Dark", "Autumn", "Starry night"];
const THEME_PREVIEW_META = {
  Light: { icon: "bi-sun", detail: "Clean daylight workspace" },
  Dark: { icon: "bi-moon", detail: "Low-glare operations" },
  Autumn: { icon: "bi-flower1", detail: "Warm leaves and soft sky" },
  "Starry night": { icon: "bi-stars", detail: "Meteor shower command room" },
};
const RANGE_OPTIONS = ["6H", "24H", "7D", "30D", "90D"];
const PAGE_SIZE = 6;
const DEFAULT_SETTINGS = {
  themeMode: "Light",
  autoRefreshFrequency: "60 seconds",
  timeZone: "(UTC+05:30) India Standard",
  healthScanInterval: "Every 6 hours",
  diagnosticScan: "Weekly",
  scanWindow: "02:00 AM - 06:00 AM",
  temperatureWarning: 40,
  temperatureCritical: 48,
  reallocatedWarn: 10,
  reallocatedCritical: 50,
  emailAlerts: true,
  webhooks: false,
  inApp: true,
  digestFrequency: "Daily",
  reportFormat: "Text file (recommended)",
  includeSmartDetails: true,
  autoExportReports: false,
  exportRetention: "30 days",
  language: "English (US)",
  dateFormat: "MM/DD/YYYY",
  numberFormat: "1,234.56",
  temperatureUnit: "Celsius (C)",
  rawRetention: 90,
  aggregatedRetention: "2 years",
  logRetention: 180,
  autoPurge: true,
};

function RemainingPages({
  page,
  summary,
  history,
  chartData,
  alerts,
  healthScore,
  riskProfile,
  loading,
  lastChecked,
  autoRefresh,
  darkMode,
  themeMode = "light",
  selectedRange = "24H",
  onRefresh,
  onToggleDarkMode,
  onThemeChange,
  onSetAutoRefresh,
  onRangeSelect,
}) {
  const latestSmart = summary?.latestSmartMetric;
  const latestDiskIo = summary?.latestDiskIo;
  const latestAnalysis = summary?.latestAnalysis;
  const partitions = useMemo(() => summary?.partitions ?? [], [summary?.partitions]);
  const [modal, setModal] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [alertStates, setAlertStates] = usePersistentState("sshm-alert-actions", {});
  const devices = useMemo(
    () => buildDeviceInventory(latestSmart, latestDiskIo, partitions, healthScore, latestAnalysis),
    [latestSmart, latestDiskIo, partitions, healthScore, latestAnalysis]
  );

  const notify = useCallback((title, message, tone = "success") => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setToasts((current) => [...current, { id, title, message, tone }].slice(-4));
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);

  const updateAlertState = useCallback(
    (id, nextState) => {
      const nextStateClass = stateClassFor(nextState);

      setAlertStates((current) => ({
        ...current,
        [id]: {
          state: nextState,
          stateClass: nextStateClass,
          updatedAt: Date.now(),
        },
      }));
      notify("Alert updated", `Marked as ${nextState.toLowerCase()}.`, nextState === "Resolved" ? "success" : "info");
    },
    [notify, setAlertStates]
  );

  const pageContext = {
    summary,
    history,
    chartData,
    alerts,
    healthScore,
    riskProfile,
    loading,
    lastChecked,
    autoRefresh,
    darkMode,
    themeMode,
    selectedRange,
    onRefresh,
    onToggleDarkMode,
    onThemeChange,
    onSetAutoRefresh,
    onRangeSelect,
    latestSmart,
    latestDiskIo,
    latestAnalysis,
    partitions,
    devices,
    alertStates,
    updateAlertState,
    notify,
    openModal: setModal,
  };

  return (
    <>
      {page === "devices" && <DevicesPage {...pageContext} />}
      {page === "analytics" && <AnalyticsPage {...pageContext} />}
      {page === "alerts" && <AlertsPage {...pageContext} />}
      {page === "predictions" && <PredictionsPage {...pageContext} />}
      {page === "settings" && <SettingsPage {...pageContext} />}
      <ModalDialog modal={modal} onClose={() => setModal(null)} />
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />
    </>
  );
}

function DevicesPage({ summary, history, devices, partitions, latestSmart, loading, autoRefresh, onRefresh, notify, openModal }) {
  const [selectedId, setSelectedId] = useState(devices[0]?.id || "");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = usePersistentState("sshm-device-filter", "All");
  const [pageIndex, setPageIndex] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filteredDevices = useMemo(() => {
    return devices.filter((device) => {
      const matchesQuery = device.model.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = statusFilter === "All" || device.status === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [devices, query, statusFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredDevices.length / PAGE_SIZE));
  const safePageIndex = Math.min(pageIndex, pageCount);
  const visibleDevices = filteredDevices.slice((safePageIndex - 1) * PAGE_SIZE, safePageIndex * PAGE_SIZE);
  const selectedDevice = devices.find((device) => device.id === selectedId) || devices[0];
  const stabilityValues = history.slice(-14).map((item) => Number(item.healthScore) || selectedDevice?.health || 0);

  const exportReport = () => {
    const filename = buildReportFilename(selectedDevice, new Date());
    const reportData = {
      generatedAt: new Date().toISOString(),
      source: "frontend export from live backend telemetry",
      device: selectedDevice || null,
      partitions,
      latestSmart: latestSmart || null,
      historyCount: history.length,
      summary,
    };

    downloadPdf(filename, reportData);
    notify("Report exported", `${filename} is ready.`, "success");
  };

  return (
    <section className="page-surface reveal-phase">
      <PageHeading
        eyebrow="Devices"
        title="Inventory and device health overview"
        description="Monitor connected storage telemetry reported by the backend."
        actions={<PageToolbar loading={loading} autoRefresh={autoRefresh} onRefresh={onRefresh} />}
      />
      <TelemetrySourceStrip
        items={[
          { icon: "bi-hdd-stack", label: "Live devices", value: devices.length ? `${devices.length}` : "None yet", tone: devices.length ? "success" : "warning" },
          { icon: "bi-clock-history", label: "History points", value: `${history.length}`, tone: history.length > 1 ? "success" : "info" },
          { icon: "bi-database-check", label: "Source", value: summary ? "Backend telemetry" : "Awaiting API", tone: summary ? "success" : "warning" },
        ]}
      />

      <div className="devices-layout">
        <div className="panel page-panel device-table-panel">
          <div className="table-toolbar">
            <label className="page-search">
              <i className="bi bi-search"></i>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search live devices..." />
            </label>
            <div className="filter-shell">
              <button type="button" className={`soft-action ${filtersOpen ? "active-action" : ""}`} onClick={() => setFiltersOpen(!filtersOpen)}>
                <i className="bi bi-funnel"></i>
                Filters
              </button>
              {filtersOpen && (
                <div className="filter-popover">
                  {["All", "Healthy", "Warning", "Critical", "Unknown"].map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={statusFilter === status ? "active" : ""}
                      onClick={() => {
                        setStatusFilter(status);
                        setPageIndex(1);
                      }}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {devices.length === 0 ? (
            <EmptyState icon="bi-device-hdd" title="No backend device telemetry yet" text="Start the backend and worker to populate connected storage details." />
          ) : (
            <>
              <div className="device-table-wrap">
                <table className="device-table">
                  <thead>
                    <tr>
                  <th>Device / model</th>
                      <th>Interface</th>
                      <th>Capacity</th>
                      <th>Temp</th>
                      <th>Health</th>
                      <th>Status</th>
                      <th>Last scan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleDevices.map((device) => (
                      <tr
                        key={device.id}
                        className={selectedDevice?.id === device.id ? "selected" : ""}
                        onClick={() => setSelectedId(device.id)}
                      >
                        <td>
                          <span className="device-name">
                            <i className="bi bi-device-ssd-fill"></i>
                            {device.model}
                          </span>
                        </td>
                        <td>{device.type}</td>
                        <td>{device.capacity}</td>
                        <td>{device.temp}</td>
                        <td>
                          <span className={`score-pill ${statusClass(device.status)}`}>{device.healthLabel}</span>
                        </td>
                        <td>
                          <span className={`status-chip ${statusClass(device.status)}`}>{device.status}</span>
                        </td>
                        <td>{device.lastScan}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {visibleDevices.length === 0 && (
                <EmptyState icon="bi-search" title="No devices match these filters" text="Adjust the search or status filter to view live telemetry." compact />
              )}

              <div className="table-footer">
                <span>
                  Showing {visibleDevices.length ? (safePageIndex - 1) * PAGE_SIZE + 1 : 0} to{" "}
                  {Math.min(safePageIndex * PAGE_SIZE, filteredDevices.length)} of {filteredDevices.length} devices
                </span>
                <div className="pager">
                  {Array.from({ length: pageCount }, (_, index) => (
                    <button
                      type="button"
                      key={index + 1}
                      className={safePageIndex === index + 1 ? "active" : ""}
                      onClick={() => setPageIndex(index + 1)}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <aside className="panel page-panel device-detail-panel">
          {selectedDevice ? (
            <>
              <div className="detail-header">
                <div>
                  <span>Selected device</span>
                  <h3>{selectedDevice.model}</h3>
                </div>
                <span className={`status-chip ${statusClass(selectedDevice.status)}`}>{selectedDevice.status}</span>
              </div>

              <dl className="detail-grid">
                <div>
                  <dt>Model</dt>
                  <dd>{selectedDevice.model}</dd>
                </div>
                <div>
                  <dt>Device ID</dt>
                  <dd>{selectedDevice.deviceId}</dd>
                </div>
                <div>
                  <dt>Interface</dt>
                  <dd>{selectedDevice.type}</dd>
                </div>
                <div>
                  <dt>Temperature</dt>
                  <dd>{selectedDevice.temp}</dd>
                </div>
              </dl>

              <div className="detail-meter">
                <div>
                  <span>Remaining life</span>
                  <strong>{selectedDevice.healthLabel}</strong>
                </div>
                <div className="meter-track">
                  <span style={{ width: `${selectedDevice.health ?? 0}%` }}></span>
                </div>
              </div>

              <div className="spark-card">
                <div className="spark-card-title">
                  <span>Recent stability</span>
                  {stabilityValues.length > 1 && <strong>{Math.round(stabilityValues.at(-1))}% latest</strong>}
                </div>
                {history.length > 1 ? (
                  <>
                    <Sparkline values={stabilityValues} color="var(--blue)" />
                    <div className="stability-summary">
                      <span>Min {Math.round(Math.min(...stabilityValues))}%</span>
                      <span>Avg {Math.round(average(stabilityValues))}%</span>
                      <span>Max {Math.round(Math.max(...stabilityValues))}%</span>
                    </div>
                  </>
                ) : (
                  <small className="muted-line">Historical SMART readings are not available yet.</small>
                )}
              </div>

              <div className="smart-summary">
                <h4>SMART summary</h4>
                <span className={`mini-dot ${selectedDevice.status === "Critical" ? "danger" : "healthy"}`}></span>
                <p>{selectedDevice.smartSummary}</p>
              </div>

              <div className="mini-partitions">
                <h4>Partitions</h4>
                {partitions.length > 0 ? (
                  partitions.map((partition) => (
                    <div key={partition.id || partition.mountpoint || partition.device}>
                      <span>{formatPartitionName(partition)}</span>
                      <strong>{formatGb(partition.usedGB)} / {formatGb(partition.totalGB)}</strong>
                    </div>
                  ))
                ) : (
                  <small className="muted-line">Partition telemetry is not available.</small>
                )}
              </div>

              <div className="detail-actions">
                <button
                  type="button"
                  className="primary-action"
                  onClick={() => setDrawerOpen(true)}
                >
                  Open cockpit
                </button>
                <button
                  type="button"
                  className="soft-action"
                  onClick={() => openFrontendOnlyModal(openModal, "Run scan", "The current backend exposes read-only telemetry, so scans must still be started by the worker or existing scripts.")}
                >
                  Run scan
                </button>
                <button type="button" className="soft-action" onClick={exportReport}>
                  Export report
                </button>
                <button
                  type="button"
                  className="soft-action"
                  onClick={() => openFrontendOnlyModal(openModal, "Schedule test", "No scheduling endpoint exists in the current backend. This control is ready for that API when it is added.")}
                >
                  Schedule test
                </button>
              </div>
            </>
          ) : (
            <EmptyState icon="bi-hdd-network" title="No device selected" text="Live backend telemetry will appear here once available." />
          )}
        </aside>
      </div>

      <DeviceCockpitDrawer
        device={selectedDevice}
        partitions={partitions}
        latestSmart={latestSmart}
        history={history}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onExport={exportReport}
        openModal={openModal}
      />
    </section>
  );
}

function AnalyticsPage({ chartData, history, devices, latestSmart, latestDiskIo, partitions, lastChecked, loading, autoRefresh, selectedRange, onRangeSelect, onRefresh }) {
  const [activeTab, setActiveTab] = usePersistentState("sshm-analytics-tab", "Performance");
  const activeAnalyticsTab = ANALYTICS_TABS.includes(activeTab) ? activeTab : "Performance";
  const performanceSeries = useMemo(() => buildPerformanceSeries(chartData), [chartData]);
  const analyticsView = useMemo(
    () => buildAnalyticsView(activeAnalyticsTab, performanceSeries, partitions, latestSmart),
    [activeAnalyticsTab, performanceSeries, partitions, latestSmart]
  );
  const indicators = useMemo(
    () => buildHealthIndicators(latestSmart, latestDiskIo, partitions),
    [latestSmart, latestDiskIo, partitions]
  );

  return (
    <section className="page-surface reveal-phase">
      <PageHeading
        eyebrow="Analytics"
        title="Advanced diagnostics and performance analytics"
        description="Analyze live backend telemetry without sample or fixture data."
        actions={<PageToolbar loading={loading} autoRefresh={autoRefresh} onRefresh={onRefresh} />}
      />
      <TelemetrySourceStrip
        items={[
          { icon: "bi-activity", label: "Selected window", value: selectedRange, tone: "info" },
          { icon: "bi-graph-up", label: "Usable points", value: `${performanceSeries.length}`, tone: performanceSeries.length > 1 ? "success" : "warning" },
          { icon: "bi-cpu", label: "Derived views", value: "Frontend analysis", tone: "info" },
        ]}
      />

      <div className="page-tabs" role="tablist" aria-label="Analytics views">
        {ANALYTICS_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={activeAnalyticsTab === tab ? "active" : ""}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="analytics-grid">
        <div className="panel page-panel analytics-chart-panel">
          <div className="panel-title-row compact">
            <div className="panel-title">
              <h2>{activeAnalyticsTab} over time</h2>
            </div>
            <RangeTabs value={selectedRange} onChange={onRangeSelect} />
          </div>
          {performanceSeries.length > 1 ? (
            <MultiLineSvg
              series={analyticsView.series}
              xLabels={chartData.map((point) => point.time)}
              leftUnit={analyticsView.leftUnit}
              rightUnit={analyticsView.rightUnit}
            />
          ) : (
            <EmptyState icon="bi-graph-up" title="No chart history yet" text="The analytics chart will populate after the backend records multiple readings." />
          )}
        </div>

        <div className="panel page-panel indicator-panel">
          <div className="panel-title">
            <h2>Top health indicators</h2>
          </div>
          {indicators.map((indicator) => (
            <Indicator key={indicator.label} {...indicator} />
          ))}
        </div>

        <div className="panel page-panel heatmap-panel">
          <div className="panel-title">
            <h2>SMART anomaly heatmap</h2>
          </div>
          <EmptyState
            icon="bi-grid-3x3-gap"
            title="Attribute heatmap unavailable"
            text="The current backend does not expose per-attribute anomaly history."
            compact
          />
        </div>

        <div className="panel page-panel comparison-panel">
          <div className="panel-title">
            <h2>Device comparison</h2>
          </div>
          {devices.length > 0 ? (
            <BarComparison devices={devices} />
          ) : (
            <EmptyState icon="bi-bar-chart" title="No devices to compare" text="Live device telemetry is not available yet." compact />
          )}
        </div>

        <div className="panel page-panel insights-panel">
          <div className="panel-title">
            <h2>Insight summary</h2>
          </div>
          <InsightList items={buildInsightItems({ history, chartData, latestSmart, latestDiskIo, partitions, lastChecked })} />
        </div>
      </div>
    </section>
  );
}

function AlertsPage({ alerts, devices, loading, autoRefresh, onRefresh, alertStates, updateAlertState }) {
  const alertRows = useMemo(() => buildAlertCenterRows(alerts, devices, alertStates), [alerts, devices, alertStates]);
  const [selectedId, setSelectedId] = useState(alertRows[0]?.id || "");
  const [filter, setFilter] = usePersistentState("sshm-alert-filter", "All");
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [forcedOpenId, setForcedOpenId] = useState("");
  const [actionClosedAlerts, setActionClosedAlerts] = usePersistentState("sshm-alert-action-closed", {});
  const selectedAlert = alertRows.find((alert) => alert.id === selectedId) || alertRows[0];
  const hiddenByAction =
    Boolean(selectedAlert) &&
    actionClosedAlerts[selectedAlert.signature] &&
    forcedOpenId !== selectedAlert.id &&
    (selectedAlert.severity === "critical" || selectedAlert.severity === "warning");
  const showDetailsPanel = detailsOpen && !hiddenByAction;
  const filteredRows = alertRows.filter((alert) => {
    if (filter === "All") return true;
    if (filter === "Resolved") return alert.state === "Resolved";
    return alert.severity === filter.toLowerCase();
  });
  const criticalAlert = alertRows.find((alert) => alert.severity === "critical" && alert.state !== "Resolved");

  const selectAlert = (id) => {
    setSelectedId(id);
    setDetailsOpen(true);
    setForcedOpenId(id);
  };

  const handleAlertAction = (nextState) => {
    if (!selectedAlert) return;

    updateAlertState(selectedAlert.id, nextState);
    setActionClosedAlerts((current) => ({
      ...current,
      [selectedAlert.signature]: Date.now(),
    }));
    setForcedOpenId("");
    setDetailsOpen(false);
  };

  return (
    <section className="page-surface reveal-phase">
      <PageHeading
        eyebrow="Alerts"
        title="Alert center and event management"
        description="Triage live telemetry events with browser-local workflow state."
        actions={<PageToolbar loading={loading} autoRefresh={autoRefresh} onRefresh={onRefresh} />}
      />
      <TelemetrySourceStrip
        items={[
          { icon: "bi-bell", label: "Live events", value: `${alertRows.length}`, tone: alertRows.length ? "success" : "info" },
          { icon: "bi-exclamation-triangle", label: "Actionable", value: `${alertRows.filter((alert) => alert.severity === "critical" || alert.severity === "warning").length}`, tone: alertRows.some((alert) => alert.severity === "critical" || alert.severity === "warning") ? "warning" : "success" },
          { icon: "bi-browser-chrome", label: "Workflow state", value: "Saved locally", tone: "info" },
        ]}
      />

      <div className={`alerts-layout ${showDetailsPanel ? "" : "details-collapsed"}`}>
        <div className="panel page-panel alert-list-panel">
          <div className="alert-filter-row">
            {["All", "Critical", "Warning", "Info", "Resolved"].map((item) => (
              <button
                key={item}
                type="button"
                className={`${filter === item ? "active" : ""} ${item.toLowerCase()}`}
                onClick={() => setFilter(item)}
              >
                {item} ({countAlerts(alertRows, item)})
              </button>
            ))}
          </div>

          {criticalAlert && (
            <div className="critical-banner">
              <i className="bi bi-exclamation-octagon"></i>
              <div>
                <strong>Critical alert</strong>
                <span>{criticalAlert.device} is at critical risk.</span>
                <small>{criticalAlert.issue}</small>
              </div>
              <button type="button" onClick={() => selectAlert(criticalAlert.id)}>
                View details
              </button>
            </div>
          )}

          {alertRows.length === 0 ? (
            <EmptyState icon="bi-bell" title="No alerts available" text="Live alert rows will appear after telemetry is collected." />
          ) : (
            <>
              <div className="alert-table-wrap">
                <table className="alert-table">
                  <thead>
                    <tr>
                      <th>Severity</th>
                      <th>Time</th>
                      <th>Device</th>
                      <th>Issue</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((alert) => (
                      <tr key={alert.id} className={selectedAlert?.id === alert.id ? "selected" : ""} onClick={() => selectAlert(alert.id)}>
                        <td><span className={`severity ${alert.severity}`}>{alert.severity}</span></td>
                        <td>{alert.time}</td>
                        <td>{alert.device}</td>
                        <td>{alert.issue}</td>
                        <td><span className={`state-dot ${alert.stateClass}`}>{alert.state}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredRows.length === 0 && (
                <EmptyState icon="bi-funnel" title="No alerts in this filter" text="Change the alert filter to see other live events." compact />
              )}
            </>
          )}
        </div>

        {showDetailsPanel && (
          <aside className="panel page-panel alert-detail-panel">
            {selectedAlert ? (
              <>
                <div className="detail-header">
                  <div>
                    <span>Alert details</span>
                    <h3>{selectedAlert.issue}</h3>
                  </div>
                  <button type="button" className="icon-button detail-close" aria-label="Close alert details" onClick={() => setDetailsOpen(false)}>
                    <i className="bi bi-x-lg"></i>
                  </button>
                </div>

                <dl className="detail-grid alert-detail-grid">
                  <div>
                    <dt>Device</dt>
                    <dd>{selectedAlert.device}</dd>
                  </div>
                  <div>
                    <dt>Time</dt>
                    <dd>{selectedAlert.timeFull}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{selectedAlert.state}</dd>
                  </div>
                  <div>
                    <dt>Severity</dt>
                    <dd>{selectedAlert.severity}</dd>
                  </div>
                </dl>

                <div className="root-cause">
                  <h4>Root cause hint</h4>
                  <p>{selectedAlert.rootCause}</p>
                </div>

                <div className="detail-actions split-actions">
                  <button type="button" className="soft-action" onClick={() => handleAlertAction("Acknowledged")}>
                    Acknowledge
                  </button>
                  <button type="button" className="soft-action" onClick={() => handleAlertAction("Assigned")}>
                    Assign
                  </button>
                  <button type="button" className="primary-action" onClick={() => handleAlertAction("Resolved")}>
                    Resolve
                  </button>
                </div>

                <div className="history-line">
                  <h4>History</h4>
                  {selectedAlert.history.map((item) => (
                    <div key={`${selectedAlert.id}-${item.label}`}>
                      <span></span>
                      <strong>{item.time}</strong>
                      <p>{item.label}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState icon="bi-bell" title="No alert selected" text="Select an alert row to inspect details." />
            )}
          </aside>
        )}
      </div>

      {!showDetailsPanel && selectedAlert && !hiddenByAction && (
        <button type="button" className="floating-detail-button" onClick={() => setDetailsOpen(true)}>
          <i className="bi bi-layout-sidebar-inset-reverse"></i>
          Open alert details
        </button>
      )}

    </section>
  );
}

function PredictionsPage({ devices, riskProfile, healthScore, chartData, latestSmart, latestDiskIo, latestAnalysis, partitions, loading, lastChecked, autoRefresh, onRefresh, openModal }) {
  const riskRows = useMemo(() => buildRiskRows(devices), [devices]);
  const currentFailureProbability = Number(latestAnalysis?.failureProbability30d);
  const displayFailureProbability = Number.isFinite(currentFailureProbability)
    ? currentFailureProbability
    : Math.max(0, 100 - (healthScore || 0));
  const probabilityTrend = useMemo(
    () => chartData.map((point) => Math.max(0, 100 - (Number(point.healthScore) || healthScore || 0))),
    [chartData, healthScore]
  );
  const signals = useMemo(
    () => buildSignals({ latestSmart, latestDiskIo, latestAnalysis, partitions, healthScore }),
    [latestSmart, latestDiskIo, latestAnalysis, partitions, healthScore]
  );
  const riskCounts = countRiskGroups(devices);

  return (
    <section className="page-surface reveal-phase">
      <PageHeading
        eyebrow="Predictions"
        title="AI-powered failure predictions and risk assessment"
        description="Risk estimates derived from currently available backend telemetry."
        actions={<PageToolbar loading={loading} autoRefresh={autoRefresh} onRefresh={onRefresh} />}
      />
      <TelemetrySourceStrip
        items={[
          { icon: "bi-shield-check", label: "Risk model", value: latestAnalysis?.modelVersion || "Python Random Forest", tone: "info" },
          { icon: "bi-hdd", label: "Input devices", value: `${devices.length}`, tone: devices.length ? "success" : "warning" },
          { icon: "bi-clock", label: "Last checked", value: lastChecked || "Pending", tone: lastChecked ? "success" : "info" },
        ]}
      />

      <div className="prediction-stats">
        <StatCard tone="danger" label="High Risk Devices" value={riskCounts.high} subtext={`${riskCounts.total ? Math.round((riskCounts.high / riskCounts.total) * 100) : 0}%`} />
        <StatCard tone="warning" label="Medium Risk Devices" value={riskCounts.medium} subtext={`${riskCounts.total ? Math.round((riskCounts.medium / riskCounts.total) * 100) : 0}%`} />
        <StatCard tone="success" label="Low Risk Devices" value={riskCounts.low} subtext={`${riskCounts.total ? Math.round((riskCounts.low / riskCounts.total) * 100) : 0}%`} />
        <StatCard tone="info" label="Avg. failure probability" value={`${displayFailureProbability.toFixed(1)}%`} subtext="30-day window" />
        <StatCard tone="blue" label="Model confidence" value={latestAnalysis?.modelConfidence !== undefined ? `${Number(latestAnalysis.modelConfidence).toFixed(1)}%` : "--"} subtext={latestAnalysis?.geminiUsed ? "Gemini assisted" : "Local AI summary"} />
        <StatCard tone="blue" label="Predictions Updated" value={lastChecked || "pending"} subtext={autoRefresh ? "Auto-check active" : "Manual refresh"} />
      </div>

      <div className="predictions-grid">
        <div className="panel page-panel risk-table-panel">
          <div className="panel-title">
            <h2>Most at-risk devices</h2>
          </div>
          {riskRows.length > 0 ? (
            <div className="risk-table-wrap">
              <table className="risk-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Device</th>
                    <th>Risk Score</th>
                    <th>Failure probability</th>
                    <th>Risk Window</th>
                  </tr>
                </thead>
                <tbody>
                  {riskRows.map((device) => (
                    <tr key={device.id}>
                      <td>{device.rank}</td>
                      <td>{device.model}</td>
                      <td><span className={`score-pill ${scoreTone(device.health)}`}>{device.riskScore}</span></td>
                      <td>
                        <div className="probability-bar">
                          <span style={{ width: `${device.failureProbability}%` }}></span>
                          <strong>{device.failureProbability}%</strong>
                        </div>
                      </td>
                      <td>{device.window}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="bi-cpu" title="No prediction inputs yet" text="Device risk appears after backend telemetry is available." />
          )}
        </div>

        <div className="panel page-panel trend-panel">
          <div className="panel-title">
            <h2>Failure probability trend</h2>
          </div>
          {probabilityTrend.length > 1 ? (
            <MiniAreaChart values={probabilityTrend} labels={chartData.map((point) => point.time)} />
          ) : (
            <EmptyState icon="bi-activity" title="No trend history" text="Multiple health readings are needed for a trend." compact />
          )}
        </div>

        <div className="panel page-panel signals-panel">
          <div className="panel-title">
            <h2>Top contributing signals</h2>
          </div>
          {signals.map((signal) => (
            <Signal key={signal.label} {...signal} />
          ))}
        </div>

        <div className="panel page-panel recommendations-panel">
          <div className="panel-title">
            <h2>AI recommendations</h2>
          </div>
          <Recommendation tone={riskProfile.className === "critical" ? "danger" : riskProfile.className === "warning" ? "warning" : "info"} title={riskProfile.label} priority="Python AI" text={riskProfile.recommendationMessage} />
          <button
            type="button"
            className="link-button page-link"
            onClick={() => openFrontendOnlyModal(openModal, "Prediction inputs", "Predictions are generated by the Python AI pipeline from SMART pass status, sector counts, temperature, partition pressure, disk I/O, telemetry freshness, and missing SMART attributes.")}
          >
            How predictions work <i className="bi bi-arrow-right"></i>
          </button>
        </div>
      </div>
    </section>
  );
}

function SettingsPage({ darkMode, themeMode, onToggleDarkMode, onThemeChange, autoRefresh, onSetAutoRefresh, notify, openModal }) {
  const [savedSettings, setSavedSettings] = usePersistentState("sshm-settings", DEFAULT_SETTINGS);
  const [draft, setDraft] = useState(() => ({
    ...DEFAULT_SETTINGS,
    ...savedSettings,
    themeMode: themeLabel(themeMode) || savedSettings.themeMode || "Light",
    autoRefreshFrequency: autoRefresh ? savedSettings.autoRefreshFrequency || "60 seconds" : "Off",
  }));
  const effectiveDraft = {
    ...draft,
    themeMode: themeLabel(themeMode),
    autoRefreshFrequency: autoRefresh ? draft.autoRefreshFrequency === "Off" ? "60 seconds" : draft.autoRefreshFrequency : "Off",
  };

  const updateDraft = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));

    if (key === "themeMode") {
      onThemeChange?.(themeValue(value));
    }

    if (key === "autoRefreshFrequency") {
      onSetAutoRefresh?.(value !== "Off");
    }
  };

  const saveSettings = () => {
    setSavedSettings(effectiveDraft);
    notify("Settings saved", "Preferences were stored locally in this browser.", "success");
  };

  const resetSettings = () => {
    setDraft(DEFAULT_SETTINGS);
    setSavedSettings(DEFAULT_SETTINGS);
    onThemeChange?.("light");
    onSetAutoRefresh?.(true);
    notify("Settings reset", "Default frontend preferences restored.", "info");
  };

  return (
    <section className="page-surface reveal-phase">
      <PageHeading
        eyebrow="Settings"
        title="System configuration and preferences"
        description="Configure browser-local UI preferences for the frontend."
        actions={
          <div className="settings-actions">
            <button type="button" className="primary-action" onClick={saveSettings}>
              <i className="bi bi-check2-circle"></i>
              Save changes
            </button>
            <button type="button" className="soft-action" onClick={resetSettings}>
              Reset
            </button>
          </div>
        }
      />
      <TelemetrySourceStrip
        items={[
          { icon: "bi-palette", label: "Theme", value: effectiveDraft.themeMode, tone: "info" },
          { icon: "bi-arrow-repeat", label: "Auto-refresh", value: effectiveDraft.autoRefreshFrequency, tone: autoRefresh ? "success" : "warning" },
          { icon: "bi-browser-chrome", label: "Persistence", value: "Browser local", tone: "info" },
        ]}
      />

      <div className="settings-grid">
        <SettingsCard title="General">
          <ThemeChoiceGrid value={effectiveDraft.themeMode} onChange={(value) => updateDraft("themeMode", value)} />
          <SettingRow label="Auto-refresh frequency">
            <SelectControl value={effectiveDraft.autoRefreshFrequency} options={["60 seconds", "Off"]} onChange={(value) => updateDraft("autoRefreshFrequency", value)} />
          </SettingRow>
          <SettingRow label="Time zone">
            <SelectControl value={effectiveDraft.timeZone} options={["(UTC+05:30) India Standard", "(UTC+00:00) UTC", "(UTC-05:00) Eastern Time"]} onChange={(value) => updateDraft("timeZone", value)} />
          </SettingRow>
          <button type="button" className="inline-toggle-row" onClick={onToggleDarkMode}>
            <span>Switch theme</span>
            <ToggleSwitch checked={darkMode} />
          </button>
        </SettingsCard>

        <SettingsCard title="Scan and schedules">
          <SettingRow label="Health scan interval">
            <SelectControl value={effectiveDraft.healthScanInterval} options={["Every 6 hours", "Every 12 hours", "Daily"]} onChange={(value) => updateDraft("healthScanInterval", value)} />
          </SettingRow>
          <SettingRow label="Full diagnostic scan">
            <SelectControl value={effectiveDraft.diagnosticScan} options={["Weekly", "Monthly", "Manual"]} onChange={(value) => updateDraft("diagnosticScan", value)} />
          </SettingRow>
          <SettingRow label="Scan time window">
            <SelectControl value={effectiveDraft.scanWindow} options={["02:00 AM - 06:00 AM", "12:00 AM - 04:00 AM", "Manual only"]} onChange={(value) => updateDraft("scanWindow", value)} />
          </SettingRow>
          <button
            type="button"
            className="soft-action full-width-action"
            onClick={() => openFrontendOnlyModal(openModal, "Scan Scheduling", "Schedule preferences are saved locally. The current backend does not expose a scan scheduler endpoint.")}
          >
            Validate schedule
          </button>
        </SettingsCard>

        <SettingsCard title="Alert thresholds">
          <RangeSetting label="Temperature warning" value={effectiveDraft.temperatureWarning} min={30} max={70} suffix="C" onChange={(value) => updateDraft("temperatureWarning", value)} />
          <RangeSetting label="Temperature critical" value={effectiveDraft.temperatureCritical} min={35} max={80} suffix="C" onChange={(value) => updateDraft("temperatureCritical", value)} />
          <SettingRow label="Reallocated sectors (warn)">
            <NumberControl value={effectiveDraft.reallocatedWarn} min={0} max={200} onChange={(value) => updateDraft("reallocatedWarn", value)} />
          </SettingRow>
          <SettingRow label="Reallocated sectors (crit)">
            <NumberControl value={effectiveDraft.reallocatedCritical} min={0} max={500} onChange={(value) => updateDraft("reallocatedCritical", value)} />
          </SettingRow>
        </SettingsCard>

        <SettingsCard title="Notifications">
          <SwitchRow label="Email alerts" detail="admin@company.com" checked={effectiveDraft.emailAlerts} onChange={() => updateDraft("emailAlerts", !effectiveDraft.emailAlerts)} />
          <SwitchRow label="Webhooks" detail="hooks.company.com/sshm" checked={effectiveDraft.webhooks} onChange={() => updateDraft("webhooks", !effectiveDraft.webhooks)} />
          <SwitchRow label="In-app notifications" checked={effectiveDraft.inApp} onChange={() => updateDraft("inApp", !effectiveDraft.inApp)} />
          <SettingRow label="Digest frequency">
            <SelectControl value={effectiveDraft.digestFrequency} options={["Daily", "Weekly", "Off"]} onChange={(value) => updateDraft("digestFrequency", value)} />
          </SettingRow>
        </SettingsCard>

        <SettingsCard title="Report and export">
          <SwitchRow label="Include SMART details" checked={effectiveDraft.includeSmartDetails} onChange={() => updateDraft("includeSmartDetails", !effectiveDraft.includeSmartDetails)} />
          <SwitchRow label="Auto export reports" checked={effectiveDraft.autoExportReports} onChange={() => updateDraft("autoExportReports", !effectiveDraft.autoExportReports)} />
          <SettingRow label="Export retention">
            <SelectControl value={effectiveDraft.exportRetention} options={["30 days", "90 days", "1 year"]} onChange={(value) => updateDraft("exportRetention", value)} />
          </SettingRow>
        </SettingsCard>

        <SettingsCard title="Localization">
          <SettingRow label="Language">
            <SelectControl value={effectiveDraft.language} options={["English (US)", "English (IN)"]} onChange={(value) => updateDraft("language", value)} />
          </SettingRow>
          <SettingRow label="Date format">
            <SelectControl value={effectiveDraft.dateFormat} options={["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"]} onChange={(value) => updateDraft("dateFormat", value)} />
          </SettingRow>
          <SettingRow label="Number format">
            <SelectControl value={effectiveDraft.numberFormat} options={["1,234.56", "1.234,56"]} onChange={(value) => updateDraft("numberFormat", value)} />
          </SettingRow>
          <SettingRow label="Temperature unit">
            <SelectControl value={effectiveDraft.temperatureUnit} options={["Celsius (C)", "Fahrenheit (F)"]} onChange={(value) => updateDraft("temperatureUnit", value)} />
          </SettingRow>
        </SettingsCard>

        <SettingsCard title="Data retention">
          <RangeSetting label="Raw data retention" value={effectiveDraft.rawRetention} min={7} max={365} suffix="days" onChange={(value) => updateDraft("rawRetention", value)} />
          <SettingRow label="Aggregated data retention">
            <SelectControl value={effectiveDraft.aggregatedRetention} options={["1 year", "2 years", "5 years"]} onChange={(value) => updateDraft("aggregatedRetention", value)} />
          </SettingRow>
          <RangeSetting label="Log retention" value={effectiveDraft.logRetention} min={30} max={365} suffix="days" onChange={(value) => updateDraft("logRetention", value)} />
          <SwitchRow label="Auto purge" checked={effectiveDraft.autoPurge} onChange={() => updateDraft("autoPurge", !effectiveDraft.autoPurge)} />
        </SettingsCard>

        <SettingsCard title="Team and integrations">
          <ActionRow label="User roles" action="Manage roles" onClick={() => openFrontendOnlyModal(openModal, "User roles", "Role management needs a backend identity endpoint. No backend changes were made.")} />
          <ActionRow label="Team members" action="Manage team" onClick={() => openFrontendOnlyModal(openModal, "Team members", "Team management needs a backend users endpoint. No backend changes were made.")} />
          <ActionRow label="Integrations" action="Manage integrations" onClick={() => openFrontendOnlyModal(openModal, "Integrations", "Integration management needs backend connector APIs. No backend changes were made.")} />
          <ActionRow label="API access" action="Manage API keys" onClick={() => openFrontendOnlyModal(openModal, "API access", "API key management needs a secure backend endpoint. No backend changes were made.")} />
        </SettingsCard>
      </div>
    </section>
  );
}

function PageHeading({ eyebrow, title, description, actions }) {
  return (
    <div className="page-heading">
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {actions}
    </div>
  );
}

function PageToolbar({ loading, autoRefresh, onRefresh }) {
  return (
    <div className="page-toolbar">
      <button type="button" className="soft-action" onClick={onRefresh} disabled={loading}>
        <i className={`bi bi-arrow-clockwise ${loading ? "spin-icon" : ""}`}></i>
        {loading ? "Refreshing" : "Refresh"}
      </button>
      <span className="toolbar-chip">
        <i className="bi bi-gear"></i>
        Auto-refresh: {autoRefresh ? "60s" : "Off"}
      </span>
    </div>
  );
}

function RangeTabs({ value, onChange }) {
  return (
    <div className="range-tabs compact-tabs">
      {RANGE_OPTIONS.map((item) => (
        <button key={item} type="button" className={value === item ? "active" : ""} onClick={() => onChange?.(item)}>
          {item}
        </button>
      ))}
    </div>
  );
}

function StatCard({ tone, label, value, subtext }) {
  return (
    <div className={`panel page-panel stat-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{subtext}</small>
    </div>
  );
}

function Indicator({ label, value, tone, hint }) {
  return (
    <div className="indicator-row">
      <span className={`indicator-dot ${tone}`}></span>
      <div>
        <strong>{label}</strong>
        <small>{hint}</small>
      </div>
      <em>{value}</em>
    </div>
  );
}

function InsightList({ items }) {
  return (
    <ul className="insight-list">
      {items.map((item) => (
        <li key={item}>
          <i className="bi bi-check-circle-fill"></i>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function BarComparison({ devices }) {
  const maxRead = Math.max(...devices.map((device) => device.read || 0), 1);

  return (
    <div className="bar-comparison">
      {devices.map((device) => (
        <div key={device.id}>
          <span>{device.model}</span>
          <div><i style={{ width: `${Math.max(((device.read || 0) / maxRead) * 100, 8)}%` }}></i></div>
          <strong>{Number.isFinite(device.read) ? `${device.read} MB/s` : "No I/O"}</strong>
        </div>
      ))}
    </div>
  );
}

function Signal({ label, impact, value, tone }) {
  return (
    <div className="signal-row">
      <span>{label}</span>
      <div><i className={tone} style={{ width: `${Math.max(value, 6)}%` }}></i></div>
      <strong>{impact}</strong>
    </div>
  );
}

function Recommendation({ tone, title, priority, text }) {
  return (
    <div className={`recommendation-card ${tone}`}>
      <i className={`bi ${tone === "danger" ? "bi-exclamation-octagon" : tone === "warning" ? "bi-exclamation-triangle" : "bi-radar"}`}></i>
      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
      <em>{priority}</em>
    </div>
  );
}

function SettingsCard({ title, children }) {
  return (
    <div className="panel page-panel settings-card">
      <h3>{title}</h3>
      <div>{children}</div>
    </div>
  );
}

function SettingRow({ label, children }) {
  return (
    <label className="setting-row">
      <span>{label}</span>
      {children}
    </label>
  );
}

function SwitchRow({ label, detail, checked = false, onChange = () => {} }) {
  return (
    <button type="button" className="setting-row switch-setting" onClick={onChange}>
      <span>
        {label}
        {detail && <small>{detail}</small>}
      </span>
      <ToggleSwitch checked={checked} />
    </button>
  );
}

function ActionRow({ label, action, onClick }) {
  return (
    <div className="setting-row action-setting">
      <span>{label}</span>
      <button type="button" onClick={onClick}>{action}</button>
    </div>
  );
}

function ThemeChoiceGrid({ value, onChange }) {
  return (
    <div className="theme-choice-group" role="radiogroup" aria-label="Theme mode">
      {THEME_OPTIONS.map((option) => {
        const meta = THEME_PREVIEW_META[option];
        const active = value === option;

        return (
          <button key={option} type="button" className={`theme-choice ${themeValue(option)} ${active ? "active" : ""}`} onClick={() => onChange(option)} role="radio" aria-checked={active}>
            <i className={`bi ${meta.icon}`}></i>
            <span>
              <strong>{option}</strong>
              <small>{meta.detail}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SelectControl({ value, options, onChange }) {
  return (
    <select className="select-like native-control" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  );
}

function NumberControl({ value, min, max, onChange }) {
  return (
    <input
      className="select-like native-control number-control"
      type="number"
      min={min}
      max={max}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}

function RangeSetting({ label, value, min, max, suffix, onChange }) {
  return (
    <label className="range-setting">
      <span>
        {label}
        <strong>{value} {suffix}</strong>
      </span>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function ToggleSwitch({ checked }) {
  return (
    <span className={`mini-switch ${checked ? "active" : ""}`}>
      <i></i>
    </span>
  );
}

function Sparkline({ values, color }) {
  const cleanValues = values.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  const path = buildScaledPath(cleanValues, {
    left: 20,
    top: 5,
    width: 122,
    height: 30,
    min: Math.min(...cleanValues, 0),
    max: Math.max(...cleanValues, 100),
  });
  const minValue = cleanValues.length ? Math.min(...cleanValues) : 0;
  const maxValue = cleanValues.length ? Math.max(...cleanValues) : 0;

  return (
    <svg className="sparkline" viewBox="0 0 150 46" role="img" aria-label="Device stability sparkline">
      <line className="spark-axis" x1="20" x2="142" y1="5" y2="5" />
      <line className="spark-axis" x1="20" x2="142" y1="35" y2="35" />
      <text className="spark-tick" x="2" y="8">{Math.round(maxValue)}</text>
      <text className="spark-tick" x="2" y="38">{Math.round(minValue)}</text>
      <text className="spark-x-tick" x="20" y="45">old</text>
      <text className="spark-x-tick" x="122" y="45">new</text>
      <path className="animated-chart-line spark-draw-line" d={path} pathLength="1" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MultiLineSvg({ series, xLabels = [], leftUnit = "MB/s", rightUnit = "Health %" }) {
  const leftSeries = series.filter((line) => line.axis !== "right");
  const rightSeries = series.filter((line) => line.axis === "right");
  const leftValues = leftSeries.flatMap((line) => line.values).map(Number).filter(Number.isFinite);
  const rightValues = rightSeries.flatMap((line) => line.values).map(Number).filter(Number.isFinite);
  const maxLeft = niceCeil(Math.max(...leftValues, 1));
  const maxRight = rightValues.length ? niceCeil(Math.max(...rightValues, 100)) : 100;
  const leftTicks = makeTicks(0, maxLeft, 4);
  const rightTicks = makeTicks(0, maxRight, 4);
  const healthTicks = [0, 25, 50, 75, 100];
  const plot = { left: 58, top: 36, width: 628, height: 220 };
  const xTicks = makeIndexTicks(Math.max(...series.map((line) => line.values.length), xLabels.length));
  const resolvedRightTicks = rightUnit.includes("%") && maxRight === 100 ? healthTicks : rightTicks;

  return (
    <div className="multi-chart">
      <svg viewBox="0 0 760 320" role="img" aria-label="Performance analytics chart">
        <text className="axis-unit left-unit" x="20" y="23">{leftUnit}</text>
        {rightSeries.length > 0 && <text className="axis-unit right-unit" x="704" y="23">{rightUnit}</text>}
        <g className="svg-grid">
          {leftTicks.map((tick) => {
            const y = yForValue(tick, 0, maxLeft, plot);
            return <line key={`h-${tick}`} x1={plot.left} x2={plot.left + plot.width} y1={y} y2={y} />;
          })}
          {xTicks.map((tick) => (
            <line key={`v-${tick}`} y1={plot.top} y2={plot.top + plot.height} x1={xForIndex(tick, xTicks.at(-1) || 1, plot)} x2={xForIndex(tick, xTicks.at(-1) || 1, plot)} />
          ))}
        </g>
        <g className="axis-values">
          {leftTicks.map((tick) => (
            <text key={`left-${tick}`} x="48" y={yForValue(tick, 0, maxLeft, plot) + 4} textAnchor="end">{formatAxisNumber(tick)}</text>
          ))}
          {rightSeries.length > 0 && resolvedRightTicks.map((tick) => (
            <text key={`right-${tick}`} x="700" y={yForValue(tick, 0, maxRight, plot) + 4}>{formatAxisNumber(tick)}{rightUnit.includes("%") ? "%" : ""}</text>
          ))}
          {xTicks.map((tick) => (
            <text key={`x-${tick}`} x={xForIndex(tick, xTicks.at(-1) || 1, plot)} y="286" textAnchor="middle">
              {xLabels[tick] || `P${tick + 1}`}
            </text>
          ))}
        </g>
        {leftSeries.map((line) => (
          <path
            key={line.name}
            d={buildScaledPath(line.values, { ...plot, min: 0, max: maxLeft })}
            className="animated-chart-line"
            pathLength="1"
            fill="none"
            stroke={line.color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {rightSeries.map((line) => (
          <path
            key={line.name}
            d={buildScaledPath(line.values, { ...plot, min: 0, max: maxRight })}
            className="animated-chart-line"
            pathLength="1"
            fill="none"
            stroke={line.color}
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="5 5"
          />
        ))}
        {series.map((line) =>
          line.values.map((value, index) => (
            <circle
              key={`${line.name}-dot-${index}`}
              cx={xForIndex(index, Math.max(line.values.length - 1, 1), plot)}
              cy={yForValue(Number(value) || 0, 0, line.axis === "right" ? maxRight : maxLeft, plot)}
              r={line.axis === "right" ? "3.2" : "2.8"}
              fill={line.color}
              className="chart-point"
              style={{ "--point-index": index }}
            />
          ))
        )}
      </svg>
      <div className="multi-chart-legend">
        {series.map((line) => (
          <span key={line.name}><i style={{ background: line.color }}></i>{line.name}</span>
        ))}
      </div>
    </div>
  );
}

function MiniAreaChart({ values, labels = [] }) {
  const normalizedValues = values.length > 1 ? values : [0, 0];
  const plot = { left: 42, top: 16, width: 288, height: 146, min: 0, max: 100 };
  const line = buildScaledPath(normalizedValues, plot);
  const area = `${line} L ${plot.left + plot.width} ${plot.top + plot.height} L ${plot.left} ${plot.top + plot.height} Z`;
  const yTicks = [0, 25, 50, 75, 100];
  const xTicks = makeIndexTicks(normalizedValues.length);

  return (
    <svg className="mini-area-chart" viewBox="0 0 360 210" role="img" aria-label="Failure probability trend">
      <text className="axis-unit left-unit" x="8" y="11">Risk %</text>
      <g className="svg-grid">
        {yTicks.map((tick) => {
          const y = yForValue(tick, plot.min, plot.max, plot);
          return <line key={`risk-y-${tick}`} x1={plot.left} x2={plot.left + plot.width} y1={y} y2={y} />;
        })}
        {xTicks.map((tick) => {
          const x = xForIndex(tick, Math.max(normalizedValues.length - 1, 1), plot);
          return <line key={`risk-x-${tick}`} x1={x} x2={x} y1={plot.top} y2={plot.top + plot.height} />;
        })}
      </g>
      <g className="axis-values">
        {yTicks.map((tick) => (
          <text key={`risk-label-${tick}`} x="34" y={yForValue(tick, plot.min, plot.max, plot) + 4} textAnchor="end">{tick}%</text>
        ))}
        {xTicks.map((tick) => (
          <text key={`risk-x-label-${tick}`} x={xForIndex(tick, Math.max(normalizedValues.length - 1, 1), plot)} y="186" textAnchor="middle">
            {labels[tick] || `P${tick + 1}`}
          </text>
        ))}
      </g>
      <path className="mini-area-fill" d={area} fill="rgba(227,52,52,0.12)" />
      <path className="animated-chart-line" d={line} pathLength="1" fill="none" stroke="var(--red)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {normalizedValues.map((value, index) => {
        const x = xForIndex(index, Math.max(normalizedValues.length - 1, 1), plot);
        const y = yForValue(Number(value) || 0, plot.min, plot.max, plot);
        return <circle key={`${value}-${index}`} cx={x} cy={y} r="4" fill="var(--red)" className="chart-point" style={{ "--point-index": index }} />;
      })}
    </svg>
  );
}

function TelemetrySourceStrip({ items = [] }) {
  return (
    <div className="source-strip" aria-label="Telemetry source summary">
      {items.map((item) => (
        <div key={`${item.label}-${item.value}`} className={`source-pill ${item.tone || "info"}`}>
          <i className={`bi ${item.icon}`}></i>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

function DeviceCockpitDrawer({ device, partitions, latestSmart, history, open, onClose, onExport, openModal }) {
  const smartFacts = useMemo(() => buildSmartFactRows(latestSmart, device), [latestSmart, device]);
  const timeline = useMemo(() => buildCockpitTimeline(history, device), [history, device]);
  const usedCapacity = partitions.reduce((sum, partition) => sum + (Number(partition.usedGB) || 0), 0);
  const totalCapacity = partitions.reduce((sum, partition) => sum + (Number(partition.totalGB) || 0), 0);
  const usagePercent = totalCapacity > 0 ? Math.min(100, (usedCapacity / totalCapacity) * 100) : 0;

  if (!open) return null;

  return (
    <div className="page-drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside className="device-cockpit-drawer" role="dialog" aria-modal="true" aria-labelledby="device-cockpit-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <span>Device cockpit</span>
            <h3 id="device-cockpit-title">{device?.model || "Storage device"}</h3>
          </div>
          <button type="button" className="icon-button detail-close" aria-label="Close device cockpit" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {device ? (
          <>
            <div className="cockpit-hero">
              <div className="cockpit-health-ring" style={{ "--health": `${device.health ?? 0}%` }}>
                <strong>{device.healthLabel}</strong>
                <span>Health</span>
              </div>
              <div>
                <span className={`status-chip ${statusClass(device.status)}`}>{device.status}</span>
                <p>{device.smartSummary}</p>
              </div>
            </div>

            <div className="cockpit-speed-grid">
              <div>
                <i className="bi bi-arrow-down-circle"></i>
                <span>Read speed</span>
                <strong>{device.read === null ? "No data" : formatSpeed(device.read)}</strong>
              </div>
              <div>
                <i className="bi bi-arrow-up-circle"></i>
                <span>Write speed</span>
                <strong>{device.write === null ? "No data" : formatSpeed(device.write)}</strong>
              </div>
              <div>
                <i className="bi bi-pie-chart"></i>
                <span>Used capacity</span>
                <strong>{totalCapacity > 0 ? `${usagePercent.toFixed(1)}%` : "No data"}</strong>
              </div>
            </div>

            <div className="drawer-section">
              <h4>Live SMART facts</h4>
              <div className="fact-grid">
                {smartFacts.map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="drawer-section">
              <h4>Partition pressure</h4>
              {partitions.length > 0 ? (
                <div className="drawer-partitions">
                  {partitions.map((partition) => (
                    <div key={partition.id || partition.mountpoint || partition.device}>
                      <span>{formatPartitionName(partition)}</span>
                      <strong>{formatGb(partition.usedGB)} / {formatGb(partition.totalGB)}</strong>
                      <i style={{ width: `${Math.min(100, Number(partition.usagePercent) || 0)}%` }}></i>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon="bi-pie-chart" title="No partition telemetry" text="The backend has not returned partition usage for this device yet." compact />
              )}
            </div>

            <div className="drawer-section">
              <h4>Recent telemetry</h4>
              {timeline.length > 0 ? (
                <div className="cockpit-timeline">
                  {timeline.map((item) => (
                    <div key={`${item.time}-${item.value}`}>
                      <span></span>
                      <strong>{item.time}</strong>
                      <p>{item.value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon="bi-clock-history" title="No recent history" text="Multiple backend samples are needed to build a cockpit timeline." compact />
              )}
            </div>

            <div className="drawer-actions">
              <button type="button" className="primary-action" onClick={onExport}>
                Export PDF
              </button>
              <button
                type="button"
                className="soft-action"
                onClick={() => openFrontendOnlyModal(openModal, "Run scan", "The existing backend is read-only for this UI. Start scans from the worker or scripts until a scan endpoint exists.")}
              >
                Run scan
              </button>
              <button
                type="button"
                className="soft-action"
                onClick={() => openFrontendOnlyModal(openModal, "Schedule test", "Scheduling is ready in the frontend, but the current backend has no scheduler endpoint.")}
              >
                Schedule test
              </button>
            </div>
          </>
        ) : (
          <EmptyState icon="bi-hdd-network" title="No device selected" text="Live backend telemetry will appear here once available." />
        )}
      </aside>
    </div>
  );
}

function EmptyState({ icon, title, text, compact = false }) {
  return (
    <div className={`empty-state ${compact ? "compact" : ""}`}>
      <i className={`bi ${icon}`}></i>
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function ModalDialog({ modal, onClose }) {
  if (!modal) return null;

  return (
    <div className="page-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="page-modal" role="dialog" aria-modal="true" aria-labelledby="page-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="icon-button detail-close" aria-label="Close modal" onClick={onClose}>
          <i className="bi bi-x-lg"></i>
        </button>
        <i className={`bi ${modal.icon || "bi-info-circle"} modal-icon`}></i>
        <h3 id="page-modal-title">{modal.title}</h3>
        <p>{modal.message}</p>
        <button type="button" className="primary-action" onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}

function ToastStack({ toasts, onDismiss }) {
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <button type="button" key={toast.id} className={`toast-card ${toast.tone}`} onClick={() => onDismiss(toast.id)}>
          <i className={`bi ${toast.tone === "success" ? "bi-check-circle-fill" : toast.tone === "warning" ? "bi-exclamation-triangle-fill" : "bi-info-circle-fill"}`}></i>
          <span>
            <strong>{toast.title}</strong>
            <small>{toast.message}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

function buildSmartFactRows(latestSmart, device) {
  return [
    ["Device ID", device?.deviceId || "Not reported"],
    ["Interface", device?.type || "Not reported"],
    ["Temperature", device?.temp || "Not reported"],
    ["SMART available", latestSmart ? stringifyUiValue(latestSmart.smartAvailable) : "No reading"],
    ["SMART passed", latestSmart ? stringifyUiValue(latestSmart.smartPassed) : "No reading"],
    ["Last scan", device?.lastScan || "Pending"],
  ];
}

function buildCockpitTimeline(history, device) {
  if (!Array.isArray(history) || history.length < 2) return [];

  return history
    .slice(-5)
    .reverse()
    .map((point) => {
      const health = Number(point.healthScore);
      const read = Number(point.readSpeed);
      const write = Number(point.writeSpeed);
      const healthText = Number.isFinite(health) ? `${Math.round(health)}% health` : device?.healthLabel || "health unavailable";
      const speedText = Number.isFinite(read) || Number.isFinite(write)
        ? `${formatSpeed(read)} read, ${formatSpeed(write)} write`
        : "throughput unavailable";

      return {
        time: point.time || formatRelativeTimestamp(point.timestamp),
        value: `${healthText}; ${speedText}`,
      };
    });
}

function stringifyUiValue(value) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  if (value === null || value === undefined || value === "") return "Not reported";
  return String(value);
}

function buildDeviceInventory(latestSmart, latestDiskIo, partitions, healthScore, latestAnalysis) {
  const totalCapacity = partitions.reduce((sum, partition) => sum + (Number(partition.totalGB) || 0), 0);
  const hasTelemetry = latestSmart || latestDiskIo || partitions.length > 0;

  if (!hasTelemetry) return [];

  const hasSmart = Boolean(latestSmart);
  const health = hasSmart ? Math.max(Math.min(Number(healthScore) || 0, 100), 0) : null;
  const modelProbability = Number(latestAnalysis?.failureProbability30d);
  const failureProbability = Number.isFinite(modelProbability)
    ? Math.max(0, Math.min(100, modelProbability))
    : health === null
      ? null
      : Math.max(0, Math.min(100, 100 - health));
  const status = hasSmart ? healthStatus(latestSmart, health, partitions) : "Unknown";
  const timestamp = Math.max(Number(latestSmart?.timestampEpochMs) || 0, Number(latestDiskIo?.timestampEpochMs) || 0);

  return [
    {
      id: latestSmart?.deviceId || latestSmart?.modelName || "backend-storage-device",
      deviceId: latestSmart?.deviceId || "Not reported by backend",
      model: latestSmart?.modelName || "Detected storage device",
      type: latestSmart?.protocol || "Not reported",
      capacity: totalCapacity > 0 ? formatGb(totalCapacity) : "Not reported",
      temp: latestSmart?.temperatureCelsius !== null && latestSmart?.temperatureCelsius !== undefined ? `${latestSmart.temperatureCelsius}C` : "Not reported",
      health,
      healthLabel: health === null ? "Unknown" : `${health}%`,
      failureProbability,
      status,
      lastScan: timestamp ? formatRelativeTimestamp(timestamp) : "pending",
      read: Number.isFinite(Number(latestDiskIo?.readMBPerSec)) ? Math.round(Number(latestDiskIo.readMBPerSec)) : null,
      write: Number.isFinite(Number(latestDiskIo?.writeMBPerSec)) ? Math.round(Number(latestDiskIo.writeMBPerSec)) : null,
      smartSummary: buildSmartSummary(latestSmart, partitions),
    },
  ];
}

function healthStatus(latestSmart, health, partitions) {
  const maxUsage = partitions.reduce((highest, partition) => Math.max(highest, Number(partition.usagePercent) || 0), 0);

  if (latestSmart?.smartPassed === false || health < 55 || maxUsage >= 95) return "Critical";
  if (latestSmart?.smartAvailable === false || health < 78 || maxUsage >= 85) return "Warning";
  return "Healthy";
}

function buildSmartSummary(latestSmart, partitions) {
  if (!latestSmart) return "SMART telemetry is not reported by the backend yet.";
  if (latestSmart.smartPassed === false) return "SMART status is failing or requires immediate review.";
  if (latestSmart.smartAvailable === false) return "SMART access is limited for this device.";

  const highUsage = partitions.find((partition) => Number(partition.usagePercent) >= 85);
  if (highUsage) return `${formatPartitionName(highUsage)} is above the configured usage warning band.`;
  return "SMART status is passing for the latest backend reading.";
}

function buildPerformanceSeries(currentChartData) {
  if (!Array.isArray(currentChartData) || currentChartData.length < 2) return [];

  return currentChartData
    .filter((point) => Number.isFinite(Number(point.readSpeed)) || Number.isFinite(Number(point.writeSpeed)) || Number.isFinite(Number(point.healthScore)))
    .map((point) => ({
      read: Number(point.readSpeed) || 0,
      write: Number(point.writeSpeed) || 0,
      health: Number(point.healthScore) || 0,
    }));
}

function buildAnalyticsView(activeTab, performanceSeries, partitions, latestSmart) {
  const maxUsage = partitions.reduce((highest, partition) => Math.max(highest, Number(partition.usagePercent) || 0), 0);
  const temperature = Number(latestSmart?.temperatureCelsius) || 0;
  const usageLine = performanceSeries.map((point, index) => Math.min(100, maxUsage || point.health * 0.68 + index * 0.3));
  const riskLine = performanceSeries.map((point) => Math.max(0, 100 - point.health));
  const temperatureLine = performanceSeries.map((point, index) => Math.max(0, temperature || 28 + Math.sin(index * 0.7) * 2 + (point.health < 78 ? 4 : 0)));
  const anomalyLine = performanceSeries.map((point, index) => Math.max(0, riskLine[index] * 0.7 + (usageLine[index] > 85 ? 18 : 0) + (temperatureLine[index] > 40 ? 12 : 0)));
  const freeLine = usageLine.map((value) => Math.max(0, 100 - value));

  if (activeTab === "Health insights") {
    return {
      leftUnit: "Risk score",
      rightUnit: "Health %",
      series: [
        { name: "Risk score", values: riskLine, color: "var(--red)" },
        { name: "Usage pressure", values: usageLine, color: "var(--amber)" },
        { name: "Health", values: performanceSeries.map((point) => point.health), color: "var(--green)", axis: "right" },
      ],
    };
  }

  if (activeTab === "Anomalies") {
    return {
      leftUnit: "Signal",
      rightUnit: "Temperature C",
      series: [
        { name: "Anomaly signal", values: anomalyLine, color: "var(--red)" },
        { name: "Usage pressure", values: usageLine, color: "var(--purple)" },
        { name: "Temperature", values: temperatureLine, color: "var(--amber)", axis: "right" },
      ],
    };
  }

  if (activeTab === "Capacity") {
    return {
      leftUnit: "Used %",
      rightUnit: "Free %",
      series: [
        { name: "Used capacity", values: usageLine, color: "var(--blue)" },
        { name: "Pressure trend", values: usageLine.map((value, index) => Math.min(100, value + Math.sin(index * 0.6) * 2)), color: "var(--amber)" },
        { name: "Free capacity", values: freeLine, color: "var(--green)", axis: "right" },
      ],
    };
  }

  if (activeTab === "Comparisons") {
    return {
      leftUnit: "MB/s",
      rightUnit: "Health %",
      series: [
        { name: "Read", values: performanceSeries.map((point) => point.read), color: "var(--blue)" },
        { name: "Write", values: performanceSeries.map((point) => point.write), color: "var(--amber)" },
        { name: "Health", values: performanceSeries.map((point) => point.health), color: "var(--purple)", axis: "right" },
      ],
    };
  }

  return {
    leftUnit: "MB/s",
    rightUnit: "Health %",
    series: [
      { name: "Read", values: performanceSeries.map((point) => point.read), color: "var(--blue)" },
      { name: "Write", values: performanceSeries.map((point) => point.write), color: "var(--purple)" },
      { name: "Health", values: performanceSeries.map((point) => point.health), color: "var(--green)", axis: "right" },
    ],
  };
}

function buildHealthIndicators(latestSmart, latestDiskIo, partitions) {
  const maxPartition = partitions.reduce(
    (highest, partition) => Number(partition.usagePercent) > Number(highest?.usagePercent || 0) ? partition : highest,
    null
  );

  return [
    {
      label: "SMART Status",
      value: latestSmart ? latestSmart.smartPassed === false ? "Failing" : "Passing" : "No data",
      tone: latestSmart?.smartPassed === false ? "danger" : latestSmart ? "success" : "info",
      hint: latestSmart ? formatRelativeTimestamp(latestSmart.timestampEpochMs) : "Awaiting backend reading",
    },
    {
      label: "Temperature",
      value: latestSmart?.temperatureCelsius !== null && latestSmart?.temperatureCelsius !== undefined ? `${latestSmart.temperatureCelsius}C` : "No data",
      tone: Number(latestSmart?.temperatureCelsius) >= 48 ? "danger" : Number(latestSmart?.temperatureCelsius) >= 40 ? "warning" : "success",
      hint: "Latest SMART reading",
    },
    {
      label: "Highest Partition Usage",
      value: maxPartition ? `${Number(maxPartition.usagePercent || 0).toFixed(1)}%` : "No data",
      tone: Number(maxPartition?.usagePercent) >= 95 ? "danger" : Number(maxPartition?.usagePercent) >= 85 ? "warning" : "success",
      hint: maxPartition ? formatPartitionName(maxPartition) : "No partition telemetry",
    },
    {
      label: "Read Throughput",
      value: formatSpeed(latestDiskIo?.readMBPerSec),
      tone: latestDiskIo ? "info" : "warning",
      hint: latestDiskIo ? formatRelativeTimestamp(latestDiskIo.timestampEpochMs) : "No disk I/O reading",
    },
    {
      label: "Write Throughput",
      value: formatSpeed(latestDiskIo?.writeMBPerSec),
      tone: latestDiskIo ? "info" : "warning",
      hint: latestDiskIo ? formatRelativeTimestamp(latestDiskIo.timestampEpochMs) : "No disk I/O reading",
    },
  ];
}

function buildInsightItems({ history, chartData, latestSmart, latestDiskIo, partitions, lastChecked }) {
  const items = [];

  if (latestSmart) {
    items.push(latestSmart.smartPassed === false ? "The latest SMART reading requires attention." : "The latest SMART reading is passing.");
  } else {
    items.push("SMART telemetry has not been reported by the backend yet.");
  }

  if (latestDiskIo) {
    items.push(`Current throughput is ${formatSpeed(latestDiskIo.readMBPerSec)} read and ${formatSpeed(latestDiskIo.writeMBPerSec)} write.`);
  } else {
    items.push("Disk I/O telemetry is not available in the latest summary.");
  }

  const highUsage = partitions.filter((partition) => Number(partition.usagePercent) >= 85);
  items.push(highUsage.length ? `${highUsage.length} partition(s) are above the warning usage band.` : "Partition usage is below the warning band.");
  items.push(`${history.length || chartData.length} historical reading(s) are available for analysis.`);
  items.push(`Last checked: ${lastChecked || "pending"}.`);

  return items;
}

function buildAlertCenterRows(alerts, devices, alertStates) {
  return (alerts || []).map((alert) => {
    const saved = alertStates[alert.id];
    const severity = alert.type === "danger" ? "critical" : alert.type === "warning" ? "warning" : "info";
    const state = saved?.state || (alert.type === "danger" || alert.type === "warning" ? "New" : "Resolved");
    const stateClass = saved?.stateClass || stateClassFor(state);
    const actionHistory = saved
      ? [{ time: formatClock(saved.updatedAt), label: `Marked as ${saved.state.toLowerCase()}` }]
      : [];

    return {
      id: alert.id,
      signature: `${alert.id}:${alert.time || "live"}:${alert.title}:${alert.message}`,
      severity,
      time: alert.time || "Live",
      timeFull: alert.time ? `${alert.time} from live telemetry` : "Live telemetry",
      device: devices[0]?.model || "Storage system",
      issue: alert.title,
      state,
      stateClass,
      rootCause: alert.message,
      history: [
        { time: alert.time || "Live", label: "Telemetry event received" },
        ...actionHistory,
      ],
    };
  });
}

function buildRiskRows(devices) {
  return devices
    .map((device) => {
      const health = device.health ?? 0;
      const modelProbability = Number(device.failureProbability);
      const failureProbability = Number.isFinite(modelProbability)
        ? Math.max(0, Math.min(100, modelProbability))
        : Math.max(0, Math.min(100, 100 - health));

      return {
        ...device,
        riskScore: failureProbability,
        failureProbability,
        window: failureProbability >= 45 ? "Near term" : failureProbability >= 22 ? "Watchlist" : "Low risk",
      };
    })
    .sort((a, b) => b.failureProbability - a.failureProbability)
    .map((device, index) => ({ ...device, rank: index + 1 }));
}

function buildSignals({ latestSmart, latestDiskIo, latestAnalysis, partitions, healthScore }) {
  if (Array.isArray(latestAnalysis?.topSignals) && latestAnalysis.topSignals.length > 0) {
    return latestAnalysis.topSignals.map((signal) => ({
      label: signal.label,
      impact: signal.severity || "Info",
      value: Math.max(0, Math.min(100, Number(signal.impactScore) || 0)),
      tone: signalTone(signal.severity),
    }));
  }

  const maxUsage = partitions.reduce((highest, partition) => Math.max(highest, Number(partition.usagePercent) || 0), 0);
  const temperature = Number(latestSmart?.temperatureCelsius);

  return [
    {
      label: "SMART Status",
      impact: latestSmart?.smartPassed === false ? "High" : latestSmart ? "Low" : "Unknown",
      value: latestSmart?.smartPassed === false ? 92 : latestSmart ? 22 : 12,
      tone: latestSmart?.smartPassed === false ? "danger" : "success",
    },
    {
      label: "Partition Pressure",
      impact: maxUsage >= 95 ? "High" : maxUsage >= 85 ? "Medium" : "Low",
      value: Math.max(maxUsage, 8),
      tone: maxUsage >= 95 ? "danger" : maxUsage >= 85 ? "warning" : "success",
    },
    {
      label: "Thermal Reading",
      impact: temperature >= 48 ? "High" : temperature >= 40 ? "Medium" : temperature ? "Low" : "Unknown",
      value: temperature ? Math.min(100, temperature * 1.5) : 8,
      tone: temperature >= 48 ? "danger" : temperature >= 40 ? "warning" : "success",
    },
    {
      label: "I/O Availability",
      impact: latestDiskIo ? "Live" : "Missing",
      value: latestDiskIo ? 68 : 12,
      tone: latestDiskIo ? "success" : "warning",
    },
    {
      label: "Health Score",
      impact: healthScore < 55 ? "High" : healthScore < 78 ? "Medium" : "Low",
      value: Math.max(100 - (healthScore || 0), 8),
      tone: healthScore < 55 ? "danger" : healthScore < 78 ? "warning" : "success",
    },
  ];
}

function signalTone(severity = "") {
  const normalized = severity.toLowerCase();

  if (normalized.includes("critical") || normalized.includes("high")) return "danger";
  if (normalized.includes("warning") || normalized.includes("moderate")) return "warning";
  if (normalized.includes("healthy") || normalized.includes("low")) return "success";
  return "info";
}

function countRiskGroups(devices) {
  return devices.reduce(
    (counts, device) => {
      const probability = 100 - (device.health || 0);

      if (probability >= 45) counts.high += 1;
      else if (probability >= 22) counts.medium += 1;
      else counts.low += 1;
      counts.total += 1;
      return counts;
    },
    { high: 0, medium: 0, low: 0, total: 0 }
  );
}

function countAlerts(alertRows, filter) {
  if (filter === "All") return alertRows.length;
  if (filter === "Resolved") return alertRows.filter((alert) => alert.state === "Resolved").length;
  return alertRows.filter((alert) => alert.severity === filter.toLowerCase()).length;
}

function openFrontendOnlyModal(openModal, title, message) {
  openModal({
    title,
    message,
    icon: "bi-plug",
  });
}

function average(values) {
  const cleanValues = values.map(Number).filter(Number.isFinite);
  if (!cleanValues.length) return 0;
  return cleanValues.reduce((sum, value) => sum + value, 0) / cleanValues.length;
}

function themeLabel(value) {
  const labels = {
    light: "Light",
    dark: "Dark",
    sunrise: "Autumn",
    autumn: "Autumn",
    starry: "Starry night",
  };

  return labels[value] || "Light";
}

function themeValue(label) {
  const values = {
    Light: "light",
    Dark: "dark",
    Sunrise: "autumn",
    Autumn: "autumn",
    "Starry night": "starry",
  };

  return values[label] || "light";
}

function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => {
    if (typeof window === "undefined") return initialValue;

    try {
      const stored = window.localStorage.getItem(key);
      if (!stored) return initialValue;

      const parsed = JSON.parse(stored);
      const canMerge =
        initialValue &&
        parsed &&
        typeof initialValue === "object" &&
        typeof parsed === "object" &&
        !Array.isArray(initialValue) &&
        !Array.isArray(parsed);

      return canMerge ? { ...initialValue, ...parsed } : parsed;
    } catch {
      return initialValue;
    }
  });

  const setPersistentValue = useCallback(
    (nextValue) => {
      setValue((current) => {
        const resolved = typeof nextValue === "function" ? nextValue(current) : nextValue;

        if (typeof window !== "undefined") {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        }

        return resolved;
      });
    },
    [key]
  );

  return [value, setPersistentValue];
}

function buildScaledPath(values, plot) {
  const cleanValues = values.map((value) => Number(value)).filter((value) => Number.isFinite(value));

  if (!cleanValues.length) return "";

  return cleanValues
    .map((value, index) => {
      const x = xForIndex(index, Math.max(cleanValues.length - 1, 1), plot);
      const y = yForValue(value, plot.min, plot.max, plot);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function xForIndex(index, maxIndex, plot) {
  return plot.left + (index / Math.max(maxIndex, 1)) * plot.width;
}

function yForValue(value, min, max, plot) {
  const range = max - min || 1;
  const clamped = Math.max(min, Math.min(max, value));

  return plot.top + plot.height - ((clamped - min) / range) * plot.height;
}

function makeTicks(min, max, steps) {
  const interval = (max - min) / Math.max(steps, 1);

  return Array.from({ length: steps + 1 }, (_, index) => Math.round(min + interval * index));
}

function makeIndexTicks(length) {
  const maxIndex = Math.max(length - 1, 0);

  if (maxIndex <= 0) return [0];
  if (maxIndex <= 2) return Array.from({ length: maxIndex + 1 }, (_, index) => index);

  return [0, Math.round(maxIndex * 0.25), Math.round(maxIndex * 0.5), Math.round(maxIndex * 0.75), maxIndex]
    .filter((value, index, values) => values.indexOf(value) === index);
}

function niceCeil(value) {
  if (value <= 10) return 10;

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const rounded = normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;

  return rounded * magnitude;
}

function formatAxisNumber(value) {
  if (value >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return `${value}`;
}

function downloadPdf(filename, data) {
  const blob = createDeviceReportPdf(data);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function createDeviceReportPdf(data) {
  const page = { width: 612, height: 792, margin: 42 };
  const colors = {
    navy: "#08142f",
    blue: "#0b5bd3",
    blueSoft: "#e8f1ff",
    panel: "#ffffff",
    panelSoft: "#f5f8ff",
    border: "#dce4f1",
    text: "#08142f",
    muted: "#5d6984",
    green: "#18a957",
    amber: "#f28c28",
    red: "#e33434",
  };
  const pdf = createPdfCanvas(page, colors);
  const device = data.device || {};
  const smart = data.latestSmart || {};

  pdf.addHeader("Smart Storage Health Monitor", "Device health report");
  pdf.addSection("Report summary");
  pdf.addKeyValues([
    ["Generated at", new Date(data.generatedAt).toLocaleString()],
    ["Report source", data.source],
    ["History readings", String(data.historyCount ?? 0)],
    ["Device status", device.status || "Not available"],
  ]);

  pdf.addSection("Selected device");
  pdf.addKeyValues([
    ["Model", device.model || "Not reported"],
    ["Device ID", device.deviceId || "Not reported"],
    ["Interface", device.type || "Not reported"],
    ["Capacity", device.capacity || "Not reported"],
    ["Temperature", device.temp || "Not reported"],
    ["Health", device.healthLabel || "Unknown"],
    ["Read speed", Number.isFinite(device.read) ? `${device.read} MB/s` : "No I/O reading"],
    ["Write speed", Number.isFinite(device.write) ? `${device.write} MB/s` : "No I/O reading"],
    ["Last scan", device.lastScan || "Pending"],
  ]);

  pdf.addSection("Latest SMART metric");
  pdf.addKeyValues([
    ["SMART available", stringifyPdfValue(smart.smartAvailable)],
    ["SMART passed", stringifyPdfValue(smart.smartPassed)],
    ["Model name", smart.modelName || "Not reported"],
    ["Protocol", smart.protocol || "Not reported"],
    ["Temperature", smart.temperatureCelsius !== undefined && smart.temperatureCelsius !== null ? `${smart.temperatureCelsius} C` : "Not reported"],
    ["Timestamp", smart.timestampEpochMs ? new Date(smart.timestampEpochMs).toLocaleString() : "Not reported"],
  ]);

  pdf.addSection("Partition usage");
  if (data.partitions?.length) {
    pdf.addTable(
      ["Partition", "File system", "Used", "Total", "Usage"],
      data.partitions.map((partition) => [
        formatPartitionName(partition),
        partition.filesystem || "N/A",
        formatGb(partition.usedGB),
        formatGb(partition.totalGB),
        `${Number(partition.usagePercent || 0).toFixed(1)}%`,
      ])
    );
  } else {
    pdf.addParagraph("No partition telemetry was available for this report.");
  }

  pdf.addSection("Organized backend payload");
  pdf.addParagraph("The following section lists the live summary payload in a readable key-value structure.");
  pdf.addCodeLines(formatObjectLines(data.summary || {}, "summary").slice(0, 120));

  return pdf.toBlob();
}

function formatObjectLines(value, fallbackLabel, indent = "") {
  if (!value || typeof value !== "object") return [`${fallbackLabel}: Not available`];

  const entries = Object.entries(value);
  if (!entries.length) return [`${fallbackLabel}: Not available`];

  return entries.flatMap(([key, entryValue]) => {
    const label = toReadableLabel(key);

    if (Array.isArray(entryValue)) {
      if (!entryValue.length) return [`${indent}${label}: []`];
      return [
        `${indent}${label}:`,
        ...entryValue.flatMap((item, index) => [
          `${indent}  ${index + 1}.`,
          ...formatObjectLines(item, `${label} item`, `${indent}    `),
        ]),
      ];
    }

    if (entryValue && typeof entryValue === "object") {
      return [`${indent}${label}:`, ...formatObjectLines(entryValue, label, `${indent}  `)];
    }

    return [`${indent}${label}: ${entryValue ?? "Not available"}`];
  });
}

function createPdfCanvas(page, colors) {
  const pages = [];
  let commands = [];
  let y = page.height - page.margin;

  const rgb = (hex) => {
    const clean = hex.replace("#", "");
    const red = parseInt(clean.slice(0, 2), 16) / 255;
    const green = parseInt(clean.slice(2, 4), 16) / 255;
    const blue = parseInt(clean.slice(4, 6), 16) / 255;
    return `${red.toFixed(3)} ${green.toFixed(3)} ${blue.toFixed(3)}`;
  };
  const add = (command) => commands.push(command);
  const rect = (x, yPos, width, height, fill, stroke = null) => {
    add(`${rgb(fill)} rg ${stroke ? `${rgb(stroke)} RG` : ""} ${x} ${yPos} ${width} ${height} re ${stroke ? "B" : "f"}`);
  };
  const text = (value, x, yPos, size = 10, fill = colors.text, font = "F1") => {
    add(`${rgb(fill)} rg BT /${font} ${size} Tf ${x} ${yPos} Td (${pdfEscape(value)}) Tj ET`);
  };
  const line = (x1, y1, x2, y2, stroke = colors.border, width = 1) => {
    add(`${rgb(stroke)} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S`);
  };
  const drawBrandIcon = (x, yPos, size) => {
    rect(x, yPos, size, size, colors.blue);

    const inset = size * 0.15;
    const scale = (size - inset * 2) / 16;
    const sx = (value) => (x + inset + value * scale).toFixed(2);
    const sy = (value) => (yPos + inset + (16 - value) * scale).toFixed(2);
    const move = (xValue, yValue) => `${sx(xValue)} ${sy(yValue)} m`;
    const lineTo = (xValue, yValue) => `${sx(xValue)} ${sy(yValue)} l`;
    const curveTo = (x1, y1, x2, y2, x3, y3) => `${sx(x1)} ${sy(y1)} ${sx(x2)} ${sy(y2)} ${sx(x3)} ${sy(y3)} c`;
    const fillSvgPath = (segments) => add(`${rgb("#ffffff")} rg ${segments.join(" ")} f`);
    const databaseLayer = (top, middle, ridge) => [
      move(2, top),
      lineTo(2, middle),
      curveTo(2, middle + 1.007, 2.875, middle + 1.755, 3.904, middle + 2.223),
      curveTo(4.978, middle + 2.71, 6.427, middle + 3, 8, middle + 3),
      curveTo(9.573, middle + 3, 11.022, middle + 2.71, 12.096, middle + 2.223),
      curveTo(13.125, middle + 1.755, 14, middle + 1.007, 14, middle),
      lineTo(14, top),
      curveTo(13.543, top + 0.432, 12.996, top + 0.751, 12.51, top + 0.972),
      curveTo(11.278, ridge, 9.682, ridge + 0.867, 8, ridge + 0.867),
      curveTo(6.318, ridge + 0.867, 4.722, ridge, 3.49, top + 0.972),
      curveTo(3.004, top + 0.752, 2.457, top + 0.432, 2, top),
      "h",
    ];

    fillSvgPath([
      move(3.904, 1.777),
      curveTo(4.978, 1.289, 6.427, 1, 8, 1),
      curveTo(9.573, 1, 11.022, 1.289, 12.096, 1.777),
      curveTo(13.125, 2.245, 14, 2.993, 14, 4),
      curveTo(14, 5.007, 13.125, 5.755, 12.096, 6.223),
      curveTo(11.022, 6.711, 9.573, 7, 8, 7),
      curveTo(6.427, 7, 4.978, 6.711, 3.904, 6.223),
      curveTo(2.875, 5.755, 2, 5.007, 2, 4),
      curveTo(2, 2.993, 2.875, 2.245, 3.904, 1.777),
      "h",
    ]);
    fillSvgPath(databaseLayer(6.161, 7, 7.133));
    fillSvgPath(databaseLayer(9.161, 10, 10.133));
    fillSvgPath(databaseLayer(12.161, 13, 13.133));
  };
  const newPage = () => {
    if (commands.length) pages.push(commands.join("\n"));
    commands = [];
    y = page.height - page.margin;
  };
  const ensure = (height) => {
    if (y - height < page.margin) {
      addFooter();
      newPage();
      addHeader("Smart Storage Health Monitor", "Device health report");
    }
  };
  const wrap = (value, maxChars) => {
    const words = sanitizePdfText(value).split(/\s+/);
    const lines = [];
    let current = "";

    words.forEach((word) => {
      if (`${current} ${word}`.trim().length > maxChars && current) {
        lines.push(current);
        current = word;
      } else {
        current = `${current} ${word}`.trim();
      }
    });

    if (current) lines.push(current);
    return lines.length ? lines : [""];
  };
  const addFooter = () => {
    line(page.margin, 32, page.width - page.margin, 32, colors.border);
    text("Generated locally from live backend telemetry", page.margin, 18, 8, colors.muted);
  };
  const addHeader = (title, subtitle) => {
    rect(0, page.height - 92, page.width, 92, colors.navy);
    drawBrandIcon(page.margin, page.height - 74, 34);
    text(title, page.margin + 46, page.height - 54, 21, "#ffffff", "F2");
    text(subtitle, page.margin + 47, page.height - 74, 10, "#bfd0e8");
    y = page.height - 122;
  };
  const addSection = (title) => {
    ensure(44);
    text(title, page.margin, y, 14, colors.blue, "F2");
    line(page.margin, y - 8, page.width - page.margin, y - 8, colors.border);
    y -= 28;
  };
  const addParagraph = (value) => {
    const lines = wrap(value, 92);
    ensure(lines.length * 14 + 12);
    lines.forEach((item) => {
      text(item, page.margin, y, 9.5, colors.muted);
      y -= 14;
    });
    y -= 4;
  };
  const addKeyValues = (rows) => {
    const rowHeight = 22;
    ensure(rows.length * rowHeight + 18);
    rect(page.margin, y - rows.length * rowHeight - 8, page.width - page.margin * 2, rows.length * rowHeight + 18, colors.panelSoft, colors.border);
    rows.forEach(([label, value], index) => {
      const rowY = y - index * rowHeight;
      text(label, page.margin + 14, rowY - 7, 9, colors.muted, "F2");
      text(value, page.margin + 188, rowY - 7, 9, colors.text);
    });
    y -= rows.length * rowHeight + 24;
  };
  const addTable = (headers, rows) => {
    const tableWidth = page.width - page.margin * 2;
    const columns = [0.28, 0.18, 0.18, 0.18, 0.18];
    const rowHeight = 24;
    ensure((rows.length + 1) * rowHeight + 16);
    rect(page.margin, y - rowHeight, tableWidth, rowHeight, colors.blue, colors.blue);
    let x = page.margin + 10;
    headers.forEach((header, index) => {
      text(header, x, y - 16, 8.4, "#ffffff", "F2");
      x += tableWidth * columns[index];
    });
    y -= rowHeight;

    rows.forEach((row, rowIndex) => {
      ensure(rowHeight + 12);
      rect(page.margin, y - rowHeight, tableWidth, rowHeight, rowIndex % 2 ? colors.panel : colors.panelSoft, colors.border);
      let cellX = page.margin + 10;
      row.forEach((cell, index) => {
        text(cell, cellX, y - 16, 8.3, colors.text);
        cellX += tableWidth * columns[index];
      });
      y -= rowHeight;
    });
    y -= 12;
  };
  const addCodeLines = (lines) => {
    lines.forEach((item) => {
      const wrapped = wrap(item, 104);
      ensure(wrapped.length * 12 + 10);
      wrapped.forEach((lineText) => {
        rect(page.margin, y - 12, page.width - page.margin * 2, 14, colors.panelSoft);
        text(lineText, page.margin + 10, y - 8, 7.6, colors.muted);
        y -= 13;
      });
    });
  };
  const toBlob = () => {
    addFooter();
    pages.push(commands.join("\n"));
    return buildPdfBlob(pages, page);
  };

  return { addHeader, addSection, addParagraph, addKeyValues, addTable, addCodeLines, toBlob };
}

function buildPdfBlob(pageStreams, page) {
  const objects = [];
  const pageObjectNumbers = [];

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  pageStreams.forEach((stream, index) => {
    const pageObjectNumber = 3 + index * 2;
    const contentObjectNumber = pageObjectNumber + 1;
    pageObjectNumbers.push(pageObjectNumber);
    objects[pageObjectNumber] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >> /Contents ${contentObjectNumber} 0 R >>`;
    objects[contentObjectNumber] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  objects[2] = `<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(" ")}] /Count ${pageStreams.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = pdf.length;
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

function stringifyPdfValue(value) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  if (value === null || value === undefined) return "Not reported";
  return String(value);
}

function sanitizePdfText(value) {
  return String(value ?? "")
    .replace(/[^\x20-\x7E]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function pdfEscape(value) {
  return sanitizePdfText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function toReadableLabel(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatGb(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "-- GB";
  if (numericValue >= 1024) return `${(numericValue / 1024).toFixed(1)} TB`;
  return `${numericValue.toFixed(1)} GB`;
}

function formatSpeed(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "No data";
  if (numericValue >= 100) return `${Math.round(numericValue)} MB/s`;
  if (numericValue >= 10) return `${numericValue.toFixed(1)} MB/s`;
  return `${numericValue.toFixed(2)} MB/s`;
}

function formatPartitionName(partition) {
  const mountpoint = String(partition.mountpoint || partition.device || "Partition").replace(/[\\/]+$/, "");
  const filesystem = partition.filesystem ? ` (${partition.filesystem})` : "";
  return `${mountpoint}${filesystem}`;
}

function formatRelativeTimestamp(timestampEpochMs) {
  if (!timestampEpochMs) return "pending";

  const elapsedMs = Date.now() - Number(timestampEpochMs);
  const elapsedMinutes = Math.max(Math.round(elapsedMs / 60000), 0);

  if (elapsedMinutes < 1) return "just now";
  if (elapsedMinutes === 1) return "1 min ago";
  if (elapsedMinutes < 60) return `${elapsedMinutes} min ago`;

  const hours = Math.round(elapsedMinutes / 60);
  return `${hours}h ago`;
}

function formatClock(timestamp) {
  if (!timestamp) return "Live";
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function buildReportFilename(device, date) {
  const deviceName = sanitizeFilenamePart(device?.model || "Storage device");
  return `Smart-Storage-Health-Report-${deviceName}-${formatFileDate(date)}.pdf`;
}

function sanitizeFilenamePart(value) {
  const cleaned = String(value)
    .split("")
    .filter((character) => character.charCodeAt(0) >= 32)
    .join("")
    .replace(/[<>:"/\\|?*]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return (cleaned || "Storage-device").slice(0, 48);
}

function formatFileDate(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}`;
}

function stateClassFor(state) {
  if (state === "Resolved") return "resolved";
  if (state === "Assigned" || state === "Acknowledged") return "progress";
  return "new";
}

function statusClass(status = "") {
  if (status.toLowerCase() === "critical") return "danger";
  if (status.toLowerCase() === "warning") return "warning";
  if (status.toLowerCase() === "unknown") return "info";
  return "success";
}

function scoreTone(health) {
  if (health < 55) return "danger";
  if (health < 78) return "warning";
  return "success";
}

export default RemainingPages;
