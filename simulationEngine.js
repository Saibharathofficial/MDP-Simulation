/**
 * Water Leak Detection Simulation Engine
 * Physics-based simulation of pipe flow, pressure, leaks, and blockages.
 */

// Darcy-Weisbach friction factors for different materials
const FRICTION_FACTORS = {
  steel: 0.015,
  pvc: 0.009,
  concrete: 0.025,
  cast_iron: 0.020,
  copper: 0.011,
  hdpe: 0.007,
};

// Material roughness (mm)
const ROUGHNESS = {
  steel: 0.045,
  pvc: 0.0015,
  concrete: 1.0,
  cast_iron: 0.26,
  copper: 0.0015,
  hdpe: 0.007,
};

const WATER_DENSITY = 998.2; // kg/m³
const GRAVITY = 9.81; // m/s²
const WATER_VISCOSITY = 1.004e-6; // m²/s (kinematic viscosity at 20°C)

export function createSimulationEngine() {
  // Default pipe parameters
  let params = {
    pipeLength: 500,         // meters
    pipeDiameter: 0.3,       // meters
    pipeMaterial: 'steel',
    inletPressure: 400,      // kPa
    flowRate: 0.15,          // m³/s
    waterTemperature: 15,    // °C
    depth: 50,               // meters underwater
    
    // Leak parameters
    leakEnabled: false,
    leakPosition: 0.5,      // 0-1 fraction of pipe length
    leakSeverity: 0.1,      // 0-1 severity
    leakType: 'pinhole',    // pinhole, crack, joint, corrosion
    
    // Blockage parameters
    blockageEnabled: false,
    blockagePosition: 0.7,
    blockageSeverity: 0.3,  // 0-1, how much flow is blocked
    
    // Simulation state
    running: true,
    timeScale: 1,
  };

  let time = 0;
  let sensorHistory = {
    pressure: [],
    flow: [],
    acoustic: [],
    temperature: [],
  };

  // Calculate Reynolds number
  function getReynoldsNumber() {
    const velocity = getFlowVelocity();
    return (velocity * params.pipeDiameter) / WATER_VISCOSITY;
  }

  // Get flow velocity from flow rate
  function getFlowVelocity() {
    const area = Math.PI * (params.pipeDiameter / 2) ** 2;
    return params.flowRate / area;
  }

  // Darcy-Weisbach friction loss
  function getFrictionLoss() {
    const f = FRICTION_FACTORS[params.pipeMaterial] || 0.015;
    const v = getFlowVelocity();
    const L = params.pipeLength;
    const D = params.pipeDiameter;
    // h_f = f * (L/D) * (v²/2g)
    return f * (L / D) * (v * v) / (2 * GRAVITY);
  }

  // Hydrostatic pressure at depth
  function getHydrostaticPressure() {
    return WATER_DENSITY * GRAVITY * params.depth / 1000; // kPa
  }

  // Generate sensor readings with noise and simulation effects
  function tick(dt = 0.1) {
    if (!params.running) return null;

    time += dt * params.timeScale;

    const frictionLoss = getFrictionLoss();
    const hydrostaticP = getHydrostaticPressure();
    const velocity = getFlowVelocity();
    const reynolds = getReynoldsNumber();

    // Base pressure along the pipe (linearly decreasing due to friction)
    const numSensors = 8;
    const sensors = [];

    for (let i = 0; i < numSensors; i++) {
      const pos = i / (numSensors - 1); // 0 to 1
      const basePressure = params.inletPressure - (frictionLoss * pos * WATER_DENSITY * GRAVITY / 1000);

      let pressure = basePressure + hydrostaticP;
      let flow = params.flowRate;
      let acoustic = 5 + Math.random() * 2; // baseline acoustic (dB relative)
      let temperature = params.waterTemperature;

      // Apply noise
      const noiseAmp = 0.5 + Math.sin(time * 0.3) * 0.2;
      pressure += (Math.random() - 0.5) * noiseAmp;
      flow += (Math.random() - 0.5) * 0.002;
      temperature += (Math.random() - 0.5) * 0.1;

      // Leak effects
      if (params.leakEnabled && pos >= params.leakPosition) {
        const distFromLeak = pos - params.leakPosition;
        const leakMagnitude = params.leakSeverity;

        // Pressure drop at and after leak
        const leakDropFactor = leakMagnitude * 50 * Math.exp(-distFromLeak * 3);
        pressure -= leakDropFactor + Math.sin(time * 5) * leakMagnitude * 3;

        // Flow reduction after leak
        flow -= flow * leakMagnitude * 0.4;

        // Acoustic signature at leak point (high frequency noise)
        if (Math.abs(pos - params.leakPosition) < 0.15) {
          const proximity = 1 - Math.abs(pos - params.leakPosition) / 0.15;
          acoustic += 30 * leakMagnitude * proximity;
          acoustic += Math.sin(time * 15 + pos * 10) * 5 * leakMagnitude * proximity;
        }

        // Temperature anomaly near leak (colder water ingress from outside)
        if (Math.abs(pos - params.leakPosition) < 0.1) {
          temperature -= 2 * leakMagnitude;
        }
      }

      // Blockage effects
      if (params.blockageEnabled) {
        if (pos < params.blockagePosition) {
          // Pressure buildup before blockage
          const distToBlock = params.blockagePosition - pos;
          if (distToBlock < 0.2) {
            pressure += 30 * params.blockageSeverity * (1 - distToBlock / 0.2);
          }
        } else {
          // Pressure and flow drop after blockage
          const distAfterBlock = pos - params.blockagePosition;
          pressure -= 40 * params.blockageSeverity * Math.exp(-distAfterBlock * 2);
          flow *= (1 - params.blockageSeverity * 0.6);
        }

        // Acoustic at blockage (turbulence)
        if (Math.abs(pos - params.blockagePosition) < 0.1) {
          acoustic += 15 * params.blockageSeverity;
        }
      }

      // Periodic fluctuations (pump cycles)
      pressure += Math.sin(time * 0.5) * 1.5;
      flow += Math.sin(time * 0.3) * 0.001;

      sensors.push({
        id: i,
        position: pos,
        positionMeters: pos * params.pipeLength,
        pressure: Math.max(0, pressure),
        flow: Math.max(0, flow),
        acoustic,
        temperature,
        velocity: flow / (Math.PI * (params.pipeDiameter / 2) ** 2),
      });
    }

    // Detect anomalies
    const alerts = detectAnomalies(sensors);

    // Store history (keep last 60 points) - use fresh arrays to avoid frozen object issues
    const avgPressure = sensors.reduce((s, v) => s + v.pressure, 0) / sensors.length;
    const avgFlow = sensors.reduce((s, v) => s + v.flow, 0) / sensors.length;
    const maxAcoustic = Math.max(...sensors.map(s => s.acoustic));
    const avgTemp = sensors.reduce((s, v) => s + v.temperature, 0) / sensors.length;

    const maxHistory = 60;
    sensorHistory = {
      pressure: [...sensorHistory.pressure, { time: time.toFixed(1), value: avgPressure.toFixed(1), inlet: sensors[0].pressure.toFixed(1), outlet: sensors[sensors.length - 1].pressure.toFixed(1) }].slice(-maxHistory),
      flow: [...sensorHistory.flow, { time: time.toFixed(1), value: avgFlow.toFixed(4), inlet: sensors[0].flow.toFixed(4), outlet: sensors[sensors.length - 1].flow.toFixed(4) }].slice(-maxHistory),
      acoustic: [...sensorHistory.acoustic, { time: time.toFixed(1), value: maxAcoustic.toFixed(1) }].slice(-maxHistory),
      temperature: [...sensorHistory.temperature, { time: time.toFixed(1), value: avgTemp.toFixed(1) }].slice(-maxHistory),
    };

    return {
      time,
      sensors,
      alerts,
      metrics: {
        avgPressure,
        avgFlow,
        maxAcoustic,
        avgTemp,
        reynolds,
        velocity,
        frictionLoss,
        hydrostaticPressure: hydrostaticP,
        flowRegime: reynolds > 4000 ? 'Turbulent' : reynolds > 2300 ? 'Transitional' : 'Laminar',
      },
      history: { ...sensorHistory },
      params: { ...params },
    };
  }

  // Anomaly detection
  function detectAnomalies(sensors) {
    const alerts = [];

    // Pressure differential analysis
    const inletP = sensors[0].pressure;
    const outletP = sensors[sensors.length - 1].pressure;
    const pressureDrop = inletP - outletP;
    const expectedDrop = getFrictionLoss() * WATER_DENSITY * GRAVITY / 1000;

    if (pressureDrop > expectedDrop * 1.5) {
      alerts.push({
        type: 'critical',
        category: 'pressure',
        message: `Abnormal pressure drop detected: ${pressureDrop.toFixed(1)} kPa (expected: ${expectedDrop.toFixed(1)} kPa)`,
        icon: '🔴',
      });
    }

    // Flow balance
    const inletFlow = sensors[0].flow;
    const outletFlow = sensors[sensors.length - 1].flow;
    const flowImbalance = ((inletFlow - outletFlow) / inletFlow) * 100;

    if (flowImbalance > 5) {
      alerts.push({
        type: 'critical',
        category: 'flow',
        message: `Flow imbalance: ${flowImbalance.toFixed(1)}% loss detected between inlet and outlet`,
        icon: '💧',
      });
    }

    // Acoustic anomaly
    sensors.forEach(s => {
      if (s.acoustic > 20) {
        alerts.push({
          type: s.acoustic > 30 ? 'critical' : 'warning',
          category: 'acoustic',
          message: `High acoustic activity at sensor ${s.id + 1} (${s.positionMeters.toFixed(0)}m): ${s.acoustic.toFixed(1)} dB`,
          icon: '🔊',
        });
      }
    });

    // Blockage detection
    for (let i = 1; i < sensors.length; i++) {
      const pDiff = sensors[i - 1].pressure - sensors[i].pressure;
      if (pDiff > 30) {
        alerts.push({
          type: 'warning',
          category: 'blockage',
          message: `Potential blockage between sensors ${i} and ${i + 1}: Δp = ${pDiff.toFixed(1)} kPa`,
          icon: '🚧',
        });
      }
    }

    // Leak detection confidence
    if (params.leakEnabled) {
      const leakSensor = sensors.find(s => Math.abs(s.position - params.leakPosition) < 0.1);
      if (leakSensor && leakSensor.acoustic > 15) {
        alerts.push({
          type: 'critical',
          category: 'leak',
          message: `LEAK CONFIRMED at ${(params.leakPosition * params.pipeLength).toFixed(0)}m — Severity: ${(params.leakSeverity * 100).toFixed(0)}%`,
          icon: '🚨',
        });
      }
    }

    return alerts;
  }

  return {
    tick,
    getParams: () => ({ ...params }),
    setParams: (newParams) => { params = { ...params, ...newParams }; },
    getHistory: () => ({ ...sensorHistory }),
    reset: () => {
      time = 0;
      sensorHistory = { pressure: [], flow: [], acoustic: [], temperature: [] };
    },
  };
}
