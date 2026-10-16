'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, ReferenceLine,
} from 'recharts';
import PipeVisualization from './components/PipeVisualization';
import { createSimulationEngine } from './lib/simulationEngine';

// Custom dark tooltip
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(17, 24, 39, 0.95)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '8px',
      padding: '10px 14px',
      fontSize: '12px',
      fontFamily: '"JetBrains Mono", monospace',
      backdropFilter: 'blur(10px)',
    }}>
      <div style={{ color: '#94a3b8', marginBottom: 4 }}>t = {label}s</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const engineRef = useRef(null);
  const intervalRef = useRef(null);
  const [simData, setSimData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [isRunning, setIsRunning] = useState(true);
  const [currentTime, setCurrentTime] = useState('');

  // Parameters state
  const [pipeLength, setPipeLength] = useState(500);
  const [pipeDiameter, setPipeDiameter] = useState(30); // cm for UI
  const [pipeMaterial, setPipeMaterial] = useState('steel');
  const [inletPressure, setInletPressure] = useState(400);
  const [flowRate, setFlowRate] = useState(150); // L/s for UI
  const [waterTemp, setWaterTemp] = useState(15);
  const [depth, setDepth] = useState(50);

  const [leakEnabled, setLeakEnabled] = useState(false);
  const [leakPosition, setLeakPosition] = useState(50); // percent
  const [leakSeverity, setLeakSeverity] = useState(20); // percent
  const [leakType, setLeakType] = useState('pinhole');

  const [blockageEnabled, setBlockageEnabled] = useState(false);
  const [blockagePosition, setBlockagePosition] = useState(70);
  const [blockageSeverity, setBlockageSeverity] = useState(30);

  // Initialize engine
  useEffect(() => {
    engineRef.current = createSimulationEngine();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Sync params to engine
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setParams({
      pipeLength,
      pipeDiameter: pipeDiameter / 100,
      pipeMaterial,
      inletPressure,
      flowRate: flowRate / 1000,
      waterTemperature: waterTemp,
      depth,
      leakEnabled,
      leakPosition: leakPosition / 100,
      leakSeverity: leakSeverity / 100,
      leakType,
      blockageEnabled,
      blockagePosition: blockagePosition / 100,
      blockageSeverity: blockageSeverity / 100,
      running: isRunning,
    });
  }, [pipeLength, pipeDiameter, pipeMaterial, inletPressure, flowRate, waterTemp,
      depth, leakEnabled, leakPosition, leakSeverity, leakType,
      blockageEnabled, blockagePosition, blockageSeverity, isRunning]);

  // Simulation loop
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (isRunning && engineRef.current) {
      intervalRef.current = setInterval(() => {
        const data = engineRef.current.tick(0.1);
        if (data) {
          setSimData(data);
          if (data.alerts.length > 0) {
            setAlerts(prev => {
              const newAlerts = data.alerts
                .filter(a => a.type === 'critical' || a.type === 'warning')
                .map(a => ({ ...a, timestamp: new Date().toLocaleTimeString() }));
              return [...newAlerts, ...prev].slice(0, 20);
            });
          }
        }
      }, 100);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  // Clock
  useEffect(() => {
    const updateClock = () => setCurrentTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleReset = () => {
    engineRef.current?.reset();
    setAlerts([]);
    setLeakEnabled(false);
    setBlockageEnabled(false);
    setSimData(null);
  };

  const metrics = simData?.metrics || {};
  const sensors = simData?.sensors || [];
  const history = simData?.history || { pressure: [], flow: [], acoustic: [], temperature: [] };

  const hasLeak = leakEnabled && alerts.some(a => a.category === 'leak');
  const hasBlockage = blockageEnabled && alerts.some(a => a.category === 'blockage');

  return (
    <div className="dashboard">
      {/* ═══ HEADER ═══ */}
      <header className="header">
        <div className="header-brand">
          <div className="header-logo">🌊</div>
          <div>
            <div className="header-title">AquaGuard</div>
            <div className="header-subtitle">Underwater Pipeline Leak Detection System</div>
          </div>
        </div>
        <div className="header-status">
          <div className={`status-badge ${hasLeak ? 'alert' : 'online'}`}>
            <span className="status-dot"></span>
            {hasLeak ? 'LEAK DETECTED' : hasBlockage ? 'BLOCKAGE WARNING' : 'System Normal'}
          </div>
          <div className="header-time">{currentTime}</div>
        </div>
      </header>

      {/* ═══ SIDEBAR — CONTROLS ═══ */}
      <aside className="sidebar">
        {/* Simulation Control */}
        <div className="sidebar-section">
          <div className="sidebar-section-title">Simulation</div>
          <div className="sim-buttons">
            <button className={`btn ${isRunning ? 'btn-danger' : 'btn-success'} btn-sm`} onClick={() => setIsRunning(!isRunning)}>
              {isRunning ? '⏸ Pause' : '▶ Resume'}
            </button>
            <button className="btn btn-outline btn-sm" onClick={handleReset}>↺ Reset Simulation</button>
          </div>
        </div>

        {/* Pipe Configuration */}
        <div className="sidebar-section">
          <div className="sidebar-section-title">Pipe Configuration</div>

          <div className="control-group">
            <div className="control-label">
              Pipe Length
              <span className="control-value">{pipeLength} m</span>
            </div>
            <input type="range" min="50" max="2000" step="10" value={pipeLength} onChange={e => setPipeLength(Number(e.target.value))} />
          </div>

          <div className="control-group">
            <div className="control-label">
              Pipe Diameter
              <span className="control-value">{pipeDiameter} cm</span>
            </div>
            <input type="range" min="5" max="100" step="1" value={pipeDiameter} onChange={e => setPipeDiameter(Number(e.target.value))} />
          </div>

          <div className="control-group">
            <div className="control-label">Pipe Material</div>
            <select value={pipeMaterial} onChange={e => setPipeMaterial(e.target.value)}>
              <option value="steel">Steel</option>
              <option value="pvc">PVC</option>
              <option value="concrete">Concrete</option>
              <option value="cast_iron">Cast Iron</option>
              <option value="copper">Copper</option>
              <option value="hdpe">HDPE</option>
            </select>
          </div>

          <div className="control-group">
            <div className="control-label">
              Installation Depth
              <span className="control-value">{depth} m</span>
            </div>
            <input type="range" min="5" max="200" step="5" value={depth} onChange={e => setDepth(Number(e.target.value))} />
          </div>
        </div>

        {/* Flow Parameters */}
        <div className="sidebar-section">
          <div className="sidebar-section-title">Flow Parameters</div>

          <div className="control-group">
            <div className="control-label">
              Inlet Pressure
              <span className="control-value">{inletPressure} kPa</span>
            </div>
            <input type="range" min="100" max="1000" step="10" value={inletPressure} onChange={e => setInletPressure(Number(e.target.value))} />
          </div>

          <div className="control-group">
            <div className="control-label">
              Flow Rate
              <span className="control-value">{flowRate} L/s</span>
            </div>
            <input type="range" min="10" max="500" step="5" value={flowRate} onChange={e => setFlowRate(Number(e.target.value))} />
          </div>

          <div className="control-group">
            <div className="control-label">
              Water Temperature
              <span className="control-value">{waterTemp} °C</span>
            </div>
            <input type="range" min="2" max="35" step="1" value={waterTemp} onChange={e => setWaterTemp(Number(e.target.value))} />
          </div>
        </div>

        {/* Leak Simulation */}
        <div className="sidebar-section">
          <div className="sidebar-section-title">💧 Leak Simulation</div>

          <div className="control-group">
            <div className="control-label">Enable Leak</div>
            <div className="toggle-group">
              <button className={`toggle-btn ${!leakEnabled ? 'active' : ''}`} onClick={() => setLeakEnabled(false)}>OFF</button>
              <button className={`toggle-btn ${leakEnabled ? 'active' : ''}`} onClick={() => setLeakEnabled(true)} style={leakEnabled ? { background: '#ef4444' } : {}}>ON</button>
            </div>
          </div>

          {leakEnabled && (
            <>
              <div className="control-group">
                <div className="control-label">
                  Leak Position
                  <span className="control-value">{((leakPosition / 100) * pipeLength).toFixed(0)} m</span>
                </div>
                <input type="range" min="5" max="95" step="1" value={leakPosition} onChange={e => setLeakPosition(Number(e.target.value))} />
              </div>

              <div className="control-group">
                <div className="control-label">
                  Severity
                  <span className="control-value">{leakSeverity}%</span>
                </div>
                <input type="range" min="1" max="80" step="1" value={leakSeverity} onChange={e => setLeakSeverity(Number(e.target.value))} />
              </div>

              <div className="control-group">
                <div className="control-label">Leak Type</div>
                <select value={leakType} onChange={e => setLeakType(e.target.value)}>
                  <option value="pinhole">Pinhole</option>
                  <option value="crack">Crack</option>
                  <option value="joint">Joint Failure</option>
                  <option value="corrosion">Corrosion</option>
                </select>
              </div>
            </>
          )}
        </div>

        {/* Blockage Simulation */}
        <div className="sidebar-section">
          <div className="sidebar-section-title">🚧 Blockage Simulation</div>

          <div className="control-group">
            <div className="control-label">Enable Blockage</div>
            <div className="toggle-group">
              <button className={`toggle-btn ${!blockageEnabled ? 'active' : ''}`} onClick={() => setBlockageEnabled(false)}>OFF</button>
              <button className={`toggle-btn ${blockageEnabled ? 'active' : ''}`} onClick={() => setBlockageEnabled(true)} style={blockageEnabled ? { background: '#f59e0b' } : {}}>ON</button>
            </div>
          </div>

          {blockageEnabled && (
            <>
              <div className="control-group">
                <div className="control-label">
                  Position
                  <span className="control-value">{((blockagePosition / 100) * pipeLength).toFixed(0)} m</span>
                </div>
                <input type="range" min="5" max="95" step="1" value={blockagePosition} onChange={e => setBlockagePosition(Number(e.target.value))} />
              </div>

              <div className="control-group">
                <div className="control-label">
                  Obstruction Level
                  <span className="control-value">{blockageSeverity}%</span>
                </div>
                <input type="range" min="5" max="90" step="1" value={blockageSeverity} onChange={e => setBlockageSeverity(Number(e.target.value))} />
              </div>
            </>
          )}
        </div>
      </aside>

      {/* ═══ MAIN CONTENT ═══ */}
      <main className="main-content">
        {/* Metrics Row */}
        <div className="metrics-row">
          <div className="metric-card blue">
            <div className="metric-header">
              <div className="metric-icon">💧</div>
              <span className={`metric-trend ${leakEnabled ? 'up' : 'stable'}`}>
                {leakEnabled ? '▼ Drop' : '— Stable'}
              </span>
            </div>
            <div className="metric-value" style={{ color: '#3b82f6' }}>
              {(metrics.avgPressure || 0).toFixed(1)}
            </div>
            <div className="metric-label">Avg Pressure (kPa)</div>
            <div className="metric-bar">
              <div className="metric-bar-fill" style={{ width: `${Math.min(100, ((metrics.avgPressure || 0) / 1200) * 100)}%` }}></div>
            </div>
          </div>

          <div className="metric-card emerald">
            <div className="metric-header">
              <div className="metric-icon">🌊</div>
              <span className={`metric-trend ${leakEnabled ? 'up' : 'stable'}`}>
                {leakEnabled ? '▼ Loss' : '— Normal'}
              </span>
            </div>
            <div className="metric-value" style={{ color: '#10b981' }}>
              {((metrics.avgFlow || 0) * 1000).toFixed(1)}
            </div>
            <div className="metric-label">Avg Flow Rate (L/s)</div>
            <div className="metric-bar">
              <div className="metric-bar-fill" style={{ width: `${Math.min(100, ((metrics.avgFlow || 0) / 0.5) * 100)}%` }}></div>
            </div>
          </div>

          <div className="metric-card amber">
            <div className="metric-header">
              <div className="metric-icon">🔊</div>
              <span className={`metric-trend ${(metrics.maxAcoustic || 0) > 20 ? 'up' : 'stable'}`}>
                {(metrics.maxAcoustic || 0) > 20 ? '▲ Alert' : '— Quiet'}
              </span>
            </div>
            <div className="metric-value" style={{ color: (metrics.maxAcoustic || 0) > 20 ? '#ef4444' : '#f59e0b' }}>
              {(metrics.maxAcoustic || 0).toFixed(1)}
            </div>
            <div className="metric-label">Max Acoustic (dB)</div>
            <div className="metric-bar">
              <div className="metric-bar-fill" style={{ width: `${Math.min(100, ((metrics.maxAcoustic || 0) / 50) * 100)}%` }}></div>
            </div>
          </div>

          <div className="metric-card purple">
            <div className="metric-header">
              <div className="metric-icon">🌡</div>
              <span className="metric-trend stable">— Stable</span>
            </div>
            <div className="metric-value" style={{ color: '#8b5cf6' }}>
              {(metrics.avgTemp || 0).toFixed(1)}
            </div>
            <div className="metric-label">Avg Temperature (°C)</div>
            <div className="metric-bar">
              <div className="metric-bar-fill" style={{ width: `${Math.min(100, ((metrics.avgTemp || 0) / 35) * 100)}%` }}></div>
            </div>
          </div>
        </div>

        {/* Pipe Visualization */}
        <div className="visualization-panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">🔬 Pipeline Cross-Section Visualization</div>
              <div className="panel-subtitle">Real-time animated view — Pressure gradient color mapping | Water flow particles | Sensor positions</div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span className="pipe-label pressure" style={{ position: 'relative' }}>
                Re: {(metrics.reynolds || 0).toFixed(0)}
              </span>
              <span className="pipe-label flow" style={{ position: 'relative' }}>
                {metrics.flowRegime || 'N/A'}
              </span>
              <span className="pipe-label pressure" style={{ position: 'relative' }}>
                v = {(metrics.velocity || 0).toFixed(2)} m/s
              </span>
            </div>
          </div>
          <PipeVisualization simData={simData} />
        </div>

        {/* Charts Grid */}
        <div className="charts-grid">
          {/* Pressure Chart */}
          <div className="chart-panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">📊 Pressure Profile</div>
                <div className="panel-subtitle">Inlet vs Outlet over time</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={history.pressure}>
                <defs>
                  <linearGradient id="pressureGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="pressureGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} domain={['auto', 'auto']} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="inlet" stroke="#3b82f6" fill="url(#pressureGrad)" name="Inlet (kPa)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="outlet" stroke="#06b6d4" fill="url(#pressureGrad2)" name="Outlet (kPa)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Flow Chart */}
          <div className="chart-panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">🌊 Flow Rate</div>
                <div className="panel-subtitle">Inlet vs Outlet flow comparison</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={history.flow}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} domain={['auto', 'auto']} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="inlet" stroke="#10b981" name="Inlet (m³/s)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="outlet" stroke="#f59e0b" name="Outlet (m³/s)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Acoustic Chart */}
          <div className="chart-panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">🔊 Acoustic Emission</div>
                <div className="panel-subtitle">Max acoustic reading over time</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={history.acoustic}>
                <defs>
                  <linearGradient id="acousticGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={20} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'Alert', fill: '#ef4444', fontSize: 10 }} />
                <Area type="monotone" dataKey="value" stroke="#f59e0b" fill="url(#acousticGrad)" name="Acoustic (dB)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Temperature Chart */}
          <div className="chart-panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">🌡 Temperature Profile</div>
                <div className="panel-subtitle">Average temperature across sensors</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={history.temperature}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} domain={['auto', 'auto']} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="value" stroke="#8b5cf6" name="Temp (°C)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sensor Grid + Alert Log */}
        <div className="charts-grid">
          {/* Sensor Grid */}
          <div className="visualization-panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">📡 Sensor Array</div>
                <div className="panel-subtitle">Individual sensor readings along pipeline</div>
              </div>
            </div>
            <div className="sensor-grid">
              {sensors.map((s, i) => {
                const isAlert = s.acoustic > 20;
                const status = isAlert ? 'critical' : s.acoustic > 12 ? 'warning' : 'normal';
                return (
                  <div key={i} className={`sensor-card ${isAlert ? 'alert-state' : ''}`}>
                    <div className="sensor-name">Sensor {i + 1} — {s.positionMeters.toFixed(0)}m</div>
                    <div className="sensor-value">
                      {s.pressure.toFixed(1)} <span className="sensor-unit">kPa</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, fontFamily: '"JetBrains Mono", monospace' }}>
                      Flow: {(s.flow * 1000).toFixed(1)} L/s
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: '"JetBrains Mono", monospace' }}>
                      Acoustic: {s.acoustic.toFixed(1)} dB
                    </div>
                    <div className={`sensor-status ${status}`}>
                      <span className="sensor-status-dot"></span>
                      {status === 'critical' ? 'ANOMALY' : status === 'warning' ? 'Elevated' : 'Normal'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Alert Log */}
          <div className="alert-log">
            <div className="panel-header">
              <div>
                <div className="panel-title">🚨 Detection Alerts</div>
                <div className="panel-subtitle">{alerts.length} alerts recorded</div>
              </div>
              {alerts.length > 0 && (
                <button className="btn btn-outline btn-sm" style={{ width: 'auto', padding: '6px 14px' }} onClick={() => setAlerts([])}>
                  Clear
                </button>
              )}
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {alerts.length === 0 && (
                <div style={{ textAlign: 'center', color: '#64748b', padding: '40px 20px', fontSize: 14 }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
                  No anomalies detected. System operating normally.
                </div>
              )}
              {alerts.map((alert, i) => (
                <div key={i} className={`alert-item ${alert.type}`}>
                  <span className="alert-icon">{alert.icon}</span>
                  <div className="alert-content">
                    <div className="alert-message">{alert.message}</div>
                    <div className="alert-time">{alert.timestamp}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pressure Along Pipe Bar Chart */}
        <div className="visualization-panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">📈 Pressure Distribution Along Pipeline</div>
              <div className="panel-subtitle">Pressure reading at each sensor position — anomalies shown in red</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={sensors.map((s, i) => ({
              name: `S${i + 1} (${s.positionMeters.toFixed(0)}m)`,
              pressure: Number(s.pressure.toFixed(1)),
              fill: s.acoustic > 20 ? '#ef4444' : '#3b82f6',
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="pressure" name="Pressure (kPa)" radius={[4, 4, 0, 0]}>
                {sensors.map((s, i) => (
                  <rect key={i} fill={s.acoustic > 20 ? '#ef4444' : '#3b82f6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </main>
    </div>
  );
}
