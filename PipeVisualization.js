'use client';

import { useRef, useEffect, useCallback } from 'react';

/**
 * PipeVisualization — Canvas-based animated pipe rendering
 * Shows water flow, pressure gradients, leaks, blockages, and sensors.
 */
export default function PipeVisualization({ simData, width = 900, height = 220 }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const particlesRef = useRef([]);
  const leakParticlesRef = useRef([]);
  const timeRef = useRef(0);

  // Factory: create a single pressurized jet particle
  function createJetParticle(originX, originY, severity, pressure, profile, t) {
    // Spray angle: mostly downward, spread controlled by coneHalf
    const baseAngle = Math.PI / 2; // straight down
    const angle = baseAngle + (Math.random() - 0.5) * profile.coneHalf * Math.PI;

    // Speed proportional to pressure and severity
    const pressureFactor = Math.sqrt(pressure / 400); // normalized to 400 kPa
    const speed = (0.6 + Math.random() * 1.2) * severity * pressureFactor * profile.speedMul * 2.5;

    return {
      x: originX + (Math.random() - 0.5) * (2 + severity * 6),
      y: originY + 2 + Math.random() * 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: (1.2 + Math.random() * 2.0) * profile.sizeMul,
      age: 0,
    };
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const dpr = window.devicePixelRatio || 1;

    ctx.clearRect(0, 0, W, H);

    timeRef.current += 0.016;
    const t = timeRef.current;

    const params = simData?.params || {};
    const sensors = simData?.sensors || [];

    // === UNDERWATER BACKGROUND ===
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#0a1628');
    bgGrad.addColorStop(0.5, '#0d1f3c');
    bgGrad.addColorStop(1, '#081420');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Floating particles (ambient underwater debris)
    for (let i = 0; i < 25; i++) {
      const px = ((i * 137.5 + t * 8 * (0.5 + i * 0.02)) % (W + 20)) - 10;
      const py = H * 0.2 + Math.sin(t * 0.5 + i) * H * 0.3 + (i * 31) % H * 0.4;
      const size = 1 + (i % 3);
      const alpha = 0.1 + Math.sin(t + i) * 0.05;
      ctx.fillStyle = `rgba(100, 180, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // === PIPE GEOMETRY ===
    const pipeX = 60;
    const pipeEndX = W - 60;
    const pipeW = pipeEndX - pipeX;
    const pipeY = H / 2 - 28;
    const pipeH = 56;
    const pipeMidY = pipeY + pipeH / 2;

    // Pipe depth label
    ctx.fillStyle = 'rgba(100, 180, 255, 0.3)';
    ctx.font = `${10 * dpr / 2}px "JetBrains Mono", monospace`;
    ctx.fillText(`Depth: ${params.depth || 50}m`, 10, 16);

    // === PIPE BODY ===
    // Outer pipe (3D effect with gradient)
    const pipeGrad = ctx.createLinearGradient(0, pipeY - 6, 0, pipeY + pipeH + 6);
    pipeGrad.addColorStop(0, '#2a3a5c');
    pipeGrad.addColorStop(0.2, '#3d5178');
    pipeGrad.addColorStop(0.5, '#4a6190');
    pipeGrad.addColorStop(0.8, '#3d5178');
    pipeGrad.addColorStop(1, '#1e2d4a');
    ctx.fillStyle = pipeGrad;
    ctx.beginPath();
    ctx.roundRect(pipeX - 4, pipeY - 6, pipeW + 8, pipeH + 12, 8);
    ctx.fill();

    // Pipe highlight (specular)
    const specGrad = ctx.createLinearGradient(0, pipeY - 4, 0, pipeY + 8);
    specGrad.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
    specGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = specGrad;
    ctx.fillRect(pipeX, pipeY - 4, pipeW, 12);

    // Inner pipe (water area)
    const waterGrad = ctx.createLinearGradient(pipeX, 0, pipeEndX, 0);

    if (sensors.length > 0) {
      // Color based on pressure: blue (high) → cyan (normal) → red (low/leak)
      const maxP = Math.max(...sensors.map(s => s.pressure));
      const minP = Math.min(...sensors.map(s => s.pressure));

      sensors.forEach((s, i) => {
        const pNorm = maxP > minP ? (s.pressure - minP) / (maxP - minP) : 0.5;
        const r = Math.round(30 + (1 - pNorm) * 180);
        const g = Math.round(100 + pNorm * 80);
        const b = Math.round(180 + pNorm * 75);
        waterGrad.addColorStop(s.position, `rgba(${r}, ${g}, ${b}, 0.85)`);
      });
    } else {
      waterGrad.addColorStop(0, 'rgba(30, 120, 220, 0.85)');
      waterGrad.addColorStop(1, 'rgba(20, 100, 200, 0.85)');
    }

    ctx.fillStyle = waterGrad;
    ctx.beginPath();
    ctx.roundRect(pipeX, pipeY, pipeW, pipeH, 4);
    ctx.fill();

    // === WATER FLOW PARTICLES ===
    const flowSpeed = (params.flowRate || 0.15) * 200;

    // Update or create flow particles
    if (particlesRef.current.length < 40) {
      for (let i = particlesRef.current.length; i < 40; i++) {
        particlesRef.current.push({
          x: pipeX + Math.random() * pipeW,
          y: pipeY + 6 + Math.random() * (pipeH - 12),
          speed: 0.5 + Math.random() * 1.0,
          size: 2 + Math.random() * 4,
          alpha: 0.15 + Math.random() * 0.2,
        });
      }
    }

    particlesRef.current.forEach(p => {
      p.x += p.speed * flowSpeed * 0.016;
      if (p.x > pipeEndX) {
        p.x = pipeX;
        p.y = pipeY + 6 + Math.random() * (pipeH - 12);
      }

      // Check if particle hit blockage
      if (params.blockageEnabled) {
        const bx = pipeX + params.blockagePosition * pipeW;
        if (Math.abs(p.x - bx) < 8) {
          p.y += (Math.random() - 0.5) * 4; // turbulence
          p.y = Math.max(pipeY + 4, Math.min(pipeY + pipeH - 4, p.y));
        }
      }

      // Slow down after leak
      let effectiveAlpha = p.alpha;
      if (params.leakEnabled && p.x > pipeX + params.leakPosition * pipeW) {
        effectiveAlpha *= 0.5;
      }

      ctx.fillStyle = `rgba(140, 210, 255, ${effectiveAlpha})`;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.size, p.size * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // === FLOW DIRECTION ARROWS ===
    for (let i = 0; i < 5; i++) {
      const ax = pipeX + 40 + ((i * pipeW / 5 + t * flowSpeed * 0.5) % (pipeW - 60));
      const alpha = 0.15 + Math.sin(t * 2 + i) * 0.05;
      ctx.strokeStyle = `rgba(180, 220, 255, ${alpha})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ax - 8, pipeMidY - 4);
      ctx.lineTo(ax, pipeMidY);
      ctx.lineTo(ax - 8, pipeMidY + 4);
      ctx.stroke();
    }

    // === LEAK VISUALIZATION — Pressurized Water Jet ===
    if (params.leakEnabled) {
      const leakX = pipeX + params.leakPosition * pipeW;
      const severity = params.leakSeverity || 0.1;
      const pressure = params.inletPressure || 400;

      // Leak-type geometry: angle spread and jet characteristics
      //   pinhole  → tight narrow jet, high velocity
      //   crack    → wider fan spray
      //   joint    → broad low-pressure seep
      //   corrosion→ diffuse ooze, many small particles
      const leakProfiles = {
        pinhole:   { coneHalf: 0.15, speedMul: 1.4, sizeMul: 0.7, countMul: 0.8  },
        crack:     { coneHalf: 0.45, speedMul: 1.0, sizeMul: 1.0, countMul: 1.2  },
        joint:     { coneHalf: 0.7,  speedMul: 0.6, sizeMul: 1.3, countMul: 1.5  },
        corrosion: { coneHalf: 0.9,  speedMul: 0.4, sizeMul: 0.6, countMul: 2.0  },
      };
      const profile = leakProfiles[params.leakType] || leakProfiles.crack;

      // ── Crack / opening on the pipe surface ──
      const crackW = 4 + severity * 16;
      ctx.save();
      ctx.strokeStyle = `rgba(180, 200, 230, ${0.5 + Math.sin(t * 6) * 0.15})`;
      ctx.lineWidth = 1.5 + severity * 1.5;
      ctx.beginPath();
      const crackSegs = params.leakType === 'corrosion' ? 8 : 5;
      for (let j = 0; j < crackSegs; j++) {
        const frac = j / (crackSegs - 1);
        const cx = leakX - crackW / 2 + frac * crackW;
        const cy = pipeY + pipeH + (j % 2 === 0 ? 1 : -1) * (1.5 + Math.sin(j * 2.1) * 2);
        j === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy);
      }
      ctx.stroke();
      ctx.restore();

      // ── Mist halo at the exit point ──
      const mistRadius = 12 + severity * 25;
      const mistGrad = ctx.createRadialGradient(
        leakX, pipeY + pipeH + 4, 0,
        leakX, pipeY + pipeH + 4, mistRadius
      );
      mistGrad.addColorStop(0, `rgba(120, 190, 255, ${0.12 * severity})`);
      mistGrad.addColorStop(0.6, `rgba(100, 170, 240, ${0.05 * severity})`);
      mistGrad.addColorStop(1, 'rgba(80, 150, 220, 0)');
      ctx.fillStyle = mistGrad;
      ctx.beginPath();
      ctx.arc(leakX, pipeY + pipeH + 4, mistRadius, 0, Math.PI * 2);
      ctx.fill();

      // ── Pressurized water jet particles ──
      // Particle count scales with severity and leak profile
      const baseCount = Math.floor(8 + severity * 35 * profile.countMul);
      // Adjust pool size
      while (leakParticlesRef.current.length < baseCount) {
        leakParticlesRef.current.push(createJetParticle(leakX, pipeY + pipeH, severity, pressure, profile, t));
      }
      while (leakParticlesRef.current.length > baseCount) {
        leakParticlesRef.current.pop();
      }

      leakParticlesRef.current.forEach(p => {
        // Update position
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.025; // mild gravity (underwater — buoyancy partially cancels)
        p.vx *= 0.995;  // slight drag
        p.age += 0.016;

        // Lifetime based on distance from origin
        const dist = Math.hypot(p.x - leakX, p.y - (pipeY + pipeH));
        const maxDist = 20 + severity * 60 * profile.speedMul;
        const life = 1 - Math.min(1, dist / maxDist);

        // Reset when faded or off-screen
        if (life <= 0.02 || p.y > H + 5 || p.age > 2.5) {
          Object.assign(p, createJetParticle(leakX, pipeY + pipeH, severity, pressure, profile, t));
        }

        // Draw — color fades from bright cyan-white core to translucent blue
        const alpha = life * (0.35 + severity * 0.4);
        const r = Math.round(120 + life * 80);
        const g = Math.round(190 + life * 50);
        const b = Math.round(240 + life * 15);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + life * 0.5), 0, Math.PI * 2);
        ctx.fill();
      });

      // ── Jet core streak (bright center line for pinhole/crack) ──
      if (params.leakType !== 'corrosion' && severity > 0.05) {
        const jetLen = 8 + severity * 30 * profile.speedMul;
        const streakAlpha = 0.15 + severity * 0.2;
        const grad = ctx.createLinearGradient(leakX, pipeY + pipeH, leakX, pipeY + pipeH + jetLen);
        grad.addColorStop(0, `rgba(200, 230, 255, ${streakAlpha})`);
        grad.addColorStop(1, 'rgba(200, 230, 255, 0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1 + severity * 2 * (1 - profile.coneHalf);
        ctx.beginPath();
        ctx.moveTo(leakX, pipeY + pipeH + 2);
        ctx.lineTo(leakX + Math.sin(t * 4) * severity * 3, pipeY + pipeH + jetLen);
        ctx.stroke();
      }

      // ── Engineering label ──
      const flowLoss = (severity * (params.flowRate || 0.15) * 0.4 * 1000).toFixed(1);
      ctx.fillStyle = 'rgba(220, 230, 245, 0.85)';
      ctx.font = `bold 10px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(`⚠ LEAK · ${(severity * 100).toFixed(0)}%`, leakX, pipeY - 22);
      ctx.fillStyle = 'rgba(180, 200, 220, 0.6)';
      ctx.font = `9px "JetBrains Mono", monospace`;
      ctx.fillText(
        `${(params.leakPosition * (params.pipeLength || 500)).toFixed(0)}m  ·  −${flowLoss} L/s  ·  ${(params.leakType || 'crack').toUpperCase()}`,
        leakX, pipeY - 11
      );
      ctx.textAlign = 'left';
    } else {
      leakParticlesRef.current = [];
    }


    // === BLOCKAGE VISUALIZATION ===
    if (params.blockageEnabled) {
      const bx = pipeX + params.blockagePosition * pipeW;
      const bSev = params.blockageSeverity || 0.3;
      const blockH = pipeH * bSev * 0.8;

      // Blockage body (top and bottom)
      const blockGrad = ctx.createLinearGradient(bx - 10, pipeY, bx + 10, pipeY + pipeH);
      blockGrad.addColorStop(0, `rgba(180, 130, 60, 0.8)`);
      blockGrad.addColorStop(0.5, `rgba(140, 100, 40, 0.6)`);
      blockGrad.addColorStop(1, `rgba(180, 130, 60, 0.8)`);
      ctx.fillStyle = blockGrad;

      // Top blockage
      ctx.beginPath();
      ctx.roundRect(bx - 8, pipeY, 16, blockH / 2, 3);
      ctx.fill();

      // Bottom blockage
      ctx.beginPath();
      ctx.roundRect(bx - 8, pipeY + pipeH - blockH / 2, 16, blockH / 2, 3);
      ctx.fill();

      // Turbulence lines after blockage
      for (let j = 0; j < 6; j++) {
        const tx = bx + 15 + j * 8;
        const ty = pipeMidY + Math.sin(t * 6 + j * 2) * (8 + bSev * 10);
        ctx.strokeStyle = `rgba(255, 200, 80, ${0.15 - j * 0.02})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tx, ty - 3);
        ctx.bezierCurveTo(tx + 3, ty - 6, tx + 6, ty + 6, tx + 10, ty + 3);
        ctx.stroke();
      }

      // Blockage label
      ctx.fillStyle = 'rgba(245, 158, 11, 0.9)';
      ctx.font = `bold ${10}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(`🚧 BLOCKAGE — ${(bSev * 100).toFixed(0)}%`, bx, pipeY - 18);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.6)';
      ctx.font = `${9}px "JetBrains Mono", monospace`;
      ctx.fillText(`${(params.blockagePosition * (params.pipeLength || 500)).toFixed(0)}m`, bx, pipeY - 8);
      ctx.textAlign = 'left';
    }

    // === SENSORS ===
    sensors.forEach((s, i) => {
      const sx = pipeX + s.position * pipeW;
      const sy = pipeY - 2;

      // Sensor antenna line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx, sy - 14);
      ctx.stroke();

      // Sensor body
      const isAlert = s.acoustic > 20 || (params.leakEnabled && Math.abs(s.position - params.leakPosition) < 0.12);
      const sColor = isAlert ? 'rgba(255, 80, 80, 0.8)' : 'rgba(59, 130, 246, 0.6)';
      ctx.fillStyle = sColor;
      ctx.beginPath();
      ctx.arc(sx, sy - 16, 4, 0, Math.PI * 2);
      ctx.fill();

      if (isAlert) {
        // Pulse ring
        const pulseR = 6 + Math.sin(t * 4) * 3;
        ctx.strokeStyle = `rgba(255, 80, 80, ${0.3 + Math.sin(t * 4) * 0.2})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sx, sy - 16, pulseR, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Sensor label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = `${8}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(`S${i + 1}`, sx, pipeY + pipeH + 18);
      ctx.textAlign = 'left';
    });

    // === PIPE ENDPOINTS ===
    // Inlet
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.roundRect(pipeX - 18, pipeY - 10, 22, pipeH + 20, [6, 0, 0, 6]);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${10}px "Inter", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('IN', pipeX - 7, pipeMidY + 4);

    // Outlet
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.roundRect(pipeEndX - 4, pipeY - 10, 22, pipeH + 20, [0, 6, 6, 0]);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText('OUT', pipeEndX + 7, pipeMidY + 4);

    ctx.textAlign = 'left';

    // === BOTTOM INFO BAR ===
    const metrics = simData?.metrics || {};
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = `${9}px "JetBrains Mono", monospace`;
    const info = [
      `Length: ${params.pipeLength || 500}m`,
      `Ø ${((params.pipeDiameter || 0.3) * 100).toFixed(0)}cm`,
      `Material: ${(params.pipeMaterial || 'steel').toUpperCase()}`,
      `Flow: ${metrics.flowRegime || 'N/A'}`,
      `Re: ${(metrics.reynolds || 0).toFixed(0)}`,
    ];
    info.forEach((txt, i) => {
      ctx.fillText(txt, pipeX + i * (pipeW / info.length), H - 8);
    });

    animRef.current = requestAnimationFrame(draw);
  }, [simData]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 220 * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = '220px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Store actual drawing width in ref for draw function
    canvas._drawWidth = rect.width;
    canvas._drawHeight = 220;

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{ borderRadius: '12px', display: 'block', width: '100%', height: '220px' }}
    />
  );
}
