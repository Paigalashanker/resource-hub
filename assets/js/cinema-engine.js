/**
 * ============================================================================
 * CAMPUSVAULT — CINEMATIC INTERACTIVE STORYTELLING ENGINE
 * Lead Engineer & Creative Developer: Paigala Delli Sankar (Dilli)
 * ============================================================================
 */

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. Core State & System Feature Flags
  // --------------------------------------------------------------------------
  const CV_STATE = {
    audioEnabled: false,
    audioCtx: null,
    audioGain: null,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    isMobile: window.innerWidth < 768,
    activeSection: 'home',
    scrollProgress: 0,
    lastScrollY: window.scrollY
  };

  // --------------------------------------------------------------------------
  // 2. Audio Engine (Atmospheric Drone & Haptic Clicks via Web Audio API)
  // --------------------------------------------------------------------------
  const AudioEngine = {
    init() {
      if (CV_STATE.audioCtx) return;
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        CV_STATE.audioCtx = new AudioContext();
        CV_STATE.audioGain = CV_STATE.audioCtx.createGain();
        CV_STATE.audioGain.gain.setValueAtTime(0.001, CV_STATE.audioCtx.currentTime);
        CV_STATE.audioGain.connect(CV_STATE.audioCtx.destination);
      } catch (e) {
        console.warn('Web Audio not supported or blocked:', e);
      }
    },

    toggle() {
      this.init();
      if (!CV_STATE.audioCtx) return false;

      if (CV_STATE.audioCtx.state === 'suspended') {
        CV_STATE.audioCtx.resume();
      }

      CV_STATE.audioEnabled = !CV_STATE.audioEnabled;

      if (CV_STATE.audioEnabled) {
        this.startAtmosphere();
      } else {
        this.stopAtmosphere();
      }

      return CV_STATE.audioEnabled;
    },

    startAtmosphere() {
      if (!CV_STATE.audioCtx || !CV_STATE.audioEnabled) return;
      const ctx = CV_STATE.audioCtx;
      const now = ctx.currentTime;

      // Master gain ramp
      CV_STATE.audioGain.gain.cancelScheduledValues(now);
      CV_STATE.audioGain.gain.linearRampToValueAtTime(0.12, now + 2);

      // Low harmonic drone (Sine 55Hz & 110Hz)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(55, now); // A1 note

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(110, now); // A2 note

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(240, now);

      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.6, now);

      osc1.connect(subGain);
      osc2.connect(subGain);
      subGain.connect(filter);
      filter.connect(CV_STATE.audioGain);

      osc1.start();
      osc2.start();

      this._activeOscs = [osc1, osc2];
    },

    stopAtmosphere() {
      if (!CV_STATE.audioCtx) return;
      const now = CV_STATE.audioCtx.currentTime;
      CV_STATE.audioGain.gain.cancelScheduledValues(now);
      CV_STATE.audioGain.gain.linearRampToValueAtTime(0.0001, now + 1);

      if (this._activeOscs) {
        window.setTimeout(() => {
          this._activeOscs.forEach(osc => {
            try { osc.stop(); osc.disconnect(); } catch (e) { }
          });
          this._activeOscs = null;
        }, 1100);
      }
    },

    playHapticBeep(freq = 880, duration = 0.04) {
      if (!CV_STATE.audioEnabled || !CV_STATE.audioCtx) return;
      try {
        const ctx = CV_STATE.audioCtx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
      } catch (e) { }
    }
  };

  // --------------------------------------------------------------------------
  // 3. Preloader & Opening Sequence
  // --------------------------------------------------------------------------
  function setupPreloader() {
    const preloader = document.getElementById('cv-preloader');
    const fill = document.getElementById('cv-preloader-fill');
    if (!preloader) return;

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 22) + 12;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        if (fill) fill.style.width = '100%';
        setTimeout(() => {
          preloader.classList.add('cv-loaded');
          startOpeningExperience();
        }, 400);
      } else {
        if (fill) fill.style.width = `${progress}%`;
      }
    }, 60);
  }

  function startOpeningExperience() {
    const firstText = document.getElementById('cv-open-first');
    const secondText = document.getElementById('cv-open-second');
    const canvas = document.getElementById('cv-open-canvas');

    if (canvas) initOpeningCanvas(canvas);

    if (firstText) {
      setTimeout(() => {
        firstText.style.transition = 'opacity 1.4s ease, transform 1.4s var(--cv-ease-out)';
        firstText.style.opacity = '1';
        firstText.style.transform = 'translateY(0)';
      }, 500);
    }

    if (secondText) {
      setTimeout(() => {
        secondText.style.transition = 'opacity 1.6s ease, transform 1.6s var(--cv-ease-out)';
        secondText.style.opacity = '1';
        secondText.style.transform = 'translateY(0)';
      }, 2400);
    }
  }

  function initOpeningCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement.offsetWidth);
    let height = (canvas.height = canvas.parentElement.offsetHeight);

    window.addEventListener('resize', () => {
      width = canvas.width = canvas.parentElement.offsetWidth;
      height = canvas.height = canvas.parentElement.offsetHeight;
    }, { passive: true });

    let t = 0;
    let animId;

    function render() {
      ctx.fillStyle = '#030406';
      ctx.fillRect(0, 0, width, height);

      t += 0.02;
      const cx = width / 2;
      const cy = height / 2;

      // 1. Single breathing luminescent point
      const pulse = 1 + Math.sin(t * 1.5) * 0.3;
      const radius = 3.5 * pulse;

      ctx.save();
      ctx.shadowBlur = 24 * pulse;
      ctx.shadowColor = '#60a5fa';
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 2. Horizon vector line expanding from point
      const lineLen = Math.min(width * 0.45, t * 80);
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - lineLen, cy);
      ctx.lineTo(cx + lineLen, cy);
      ctx.stroke();

      // 3. Perspective grid lines into the distance
      const gridCount = 9;
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.08)';
      for (let i = -gridCount; i <= gridCount; i++) {
        const spread = (i / gridCount) * (width * 0.7);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + spread, height);
        ctx.stroke();
      }

      // Horizontal depth rings
      for (let j = 1; j <= 5; j++) {
        const y = cy + Math.pow(j / 5, 2) * (height - cy);
        ctx.strokeStyle = `rgba(59, 130, 246, ${0.03 * j})`;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      animId = requestAnimationFrame(render);
    }

    render();

    window.addEventListener('pagehide', () => cancelAnimationFrame(animId), { once: true });
  }

  // --------------------------------------------------------------------------
  // 4. Section 02 Canvas: Abstract Mind & Thought Lattice
  // --------------------------------------------------------------------------
  function setupThinkingCanvas() {
    const canvas = document.getElementById('cv-thinking-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement.offsetWidth);
    let height = (canvas.height = canvas.parentElement.offsetHeight);

    window.addEventListener('resize', () => {
      width = canvas.width = canvas.parentElement.offsetWidth;
      height = canvas.height = canvas.parentElement.offsetHeight;
    }, { passive: true });

    const nodeCount = CV_STATE.isMobile ? 28 : 55;
    const nodes = [];

    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        radius: Math.random() * 2 + 1.2
      });
    }

    let turbulence = 0;
    const thinkingSection = document.getElementById('sec-thinking');

    function render() {
      ctx.clearRect(0, 0, width, height);

      // Scroll reactive turbulence
      if (thinkingSection) {
        const rect = thinkingSection.getBoundingClientRect();
        const visibility = Math.max(0, Math.min(1, 1 - Math.abs(rect.top) / window.innerHeight));
        turbulence = visibility * 2.2;
      }

      // Connect nodes with filaments
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 140 + turbulence * 40;

          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * (0.18 + turbulence * 0.15);
            ctx.strokeStyle = `rgba(96, 165, 250, ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      // Update and draw nodes
      nodes.forEach(n => {
        n.x += n.vx * (1 + turbulence * 2);
        n.y += n.vy * (1 + turbulence * 2);

        if (n.x < 0 || n.x > width) n.vx *= -1;
        if (n.y < 0 || n.y > height) n.vy *= -1;

        ctx.fillStyle = '#60a5fa';
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      requestAnimationFrame(render);
    }

    render();
  }

  // --------------------------------------------------------------------------
  // 5. Section 04: Physics Failure Crack & Reconstruction Simulation
  // --------------------------------------------------------------------------
  function setupPhysicsSimulation() {
    const canvas = document.getElementById('cv-physics-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement.offsetWidth);
    let height = (canvas.height = 260);

    window.addEventListener('resize', () => {
      width = canvas.width = canvas.parentElement.offsetWidth;
      height = canvas.height = 260;
    }, { passive: true });

    const section = document.getElementById('sec-physics');
    let scrollProgress = 0; // 0 = BACKLOG intact, 0.4 = crack & falling, 0.8+ = CLEARED reconstructed

    // Create discrete particles representing letter shards
    const shardCount = 80;
    const shards = [];
    for (let i = 0; i < shardCount; i++) {
      shards.push({
        origX: (i / shardCount) * (width * 0.7) + width * 0.15,
        origY: height * 0.45 + (Math.random() - 0.5) * 30,
        x: 0,
        y: 0,
        fallDy: Math.random() * 120 + 40,
        fallDx: (Math.random() - 0.5) * 80,
        rot: (Math.random() - 0.5) * Math.PI,
        size: Math.random() * 7 + 4
      });
    }

    function render() {
      ctx.clearRect(0, 0, width, height);

      if (section) {
        const rect = section.getBoundingClientRect();
        const total = window.innerHeight + rect.height;
        const current = window.innerHeight - rect.top;
        scrollProgress = Math.max(0, Math.min(1, current / total));
      }

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const fontSize = Math.min(width * 0.08, 56);
      ctx.font = `800 ${fontSize}px var(--cv-font-display)`;

      if (scrollProgress < 0.28) {
        // Stage 1: PHYSICS BACKLOG in red/orange warning
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = 'rgba(239, 68, 68, 0.5)';
        ctx.shadowBlur = 18;
        ctx.fillText('PHYSICS  BACKLOG', width / 2, height * 0.45);
      } else if (scrollProgress < 0.68) {
        // Stage 2: Fracturing shards falling down
        const fallT = (scrollProgress - 0.28) / 0.4;
        shards.forEach((s, idx) => {
          const currentX = s.origX + s.fallDx * Math.sin(fallT * Math.PI);
          const currentY = s.origY + s.fallDy * fallT;

          ctx.fillStyle = fallT > 0.6 ? '#60a5fa' : '#ef4444';
          ctx.fillRect(currentX, currentY, s.size, s.size);
        });

        // Cracking line through center
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(width * 0.2, height * 0.45);
        ctx.lineTo(width * 0.45, height * 0.4 + 10);
        ctx.lineTo(width * 0.55, height * 0.5 - 10);
        ctx.lineTo(width * 0.8, height * 0.45);
        ctx.stroke();
      } else {
        // Stage 3: Reconstructed CLEARED with radiant blue/emerald glow
        const reconT = Math.min(1, (scrollProgress - 0.68) / 0.25);
        ctx.fillStyle = '#10b981';
        ctx.shadowColor = 'rgba(16, 185, 129, 0.8)';
        ctx.shadowBlur = 28 * reconT;
        ctx.fillText('PHYSICS : CLEARED', width / 2, height * 0.45);

        ctx.font = `600 ${Math.max(14, fontSize * 0.35)}px var(--cv-font-mono)`;
        ctx.fillStyle = '#60a5fa';
        ctx.shadowBlur = 10;
        ctx.fillText('✓ GRADE SECURED · TRANSCRIPTS UPDATED', width / 2, height * 0.72);
      }

      ctx.restore();
      requestAnimationFrame(render);
    }

    render();
  }

  // --------------------------------------------------------------------------
  // 6. Section 05: Silhouettes & Parting Companions Canvas
  // --------------------------------------------------------------------------
  function setupPeopleCanvas() {
    const canvas = document.getElementById('cv-people-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement.offsetWidth);
    let height = (canvas.height = canvas.parentElement.offsetHeight);

    window.addEventListener('resize', () => {
      width = canvas.width = canvas.parentElement.offsetWidth;
      height = canvas.height = canvas.parentElement.offsetHeight;
    }, { passive: true });

    const people = [
      { id: 0, xOffset: 0, isMain: true, label: 'YOU' },
      { id: 1, xOffset: -60, divergeDir: -1, isMain: false },
      { id: 2, xOffset: 70, divergeDir: 1, isMain: false },
      { id: 3, xOffset: -120, divergeDir: -1.4, isMain: false },
      { id: 4, xOffset: 130, divergeDir: 1.3, isMain: false }
    ];

    const secPeople = document.getElementById('sec-people');
    let divergeAmount = 0;

    function render() {
      ctx.clearRect(0, 0, width, height);

      if (secPeople) {
        const rect = secPeople.getBoundingClientRect();
        const factor = Math.max(0, Math.min(1, 1 - rect.top / window.innerHeight));
        divergeAmount = factor * 160;
      }

      const cx = width / 2;
      const cy = height * 0.55;

      // Central forward beam
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, height);
      ctx.lineTo(cx, cy - 80);
      ctx.stroke();

      people.forEach(p => {
        let posX = cx + p.xOffset;
        let alpha = 0.85;

        if (!p.isMain) {
          posX += p.divergeDir * divergeAmount;
          alpha = Math.max(0.1, 0.85 - (divergeAmount / 140));
        }

        // Silhouette / Energy avatar
        ctx.save();
        ctx.fillStyle = p.isMain ? '#60a5fa' : `rgba(156, 163, 175, ${alpha})`;
        if (p.isMain) {
          ctx.shadowColor = '#3b82f6';
          ctx.shadowBlur = 18;
        }

        // Head
        ctx.beginPath();
        ctx.arc(posX, cy, p.isMain ? 8 : 6, 0, Math.PI * 2);
        ctx.fill();

        // Body stem
        ctx.lineWidth = p.isMain ? 3 : 2;
        ctx.strokeStyle = ctx.fillStyle;
        ctx.beginPath();
        ctx.moveTo(posX, cy + (p.isMain ? 8 : 6));
        ctx.lineTo(posX, cy + 32);
        ctx.stroke();

        ctx.restore();
      });

      requestAnimationFrame(render);
    }

    render();
  }

  // --------------------------------------------------------------------------
  // 7. Interactive Linux Terminal Workshop
  // --------------------------------------------------------------------------
  function setupTerminalInteraction() {
    const termBody = document.getElementById('cv-terminal-content');
    const termInput = document.getElementById('cv-term-input');
    if (!termBody || !termInput) return;

    const commandHistory = [
      { cmd: 'whoami', output: 'dilli — engineering student & builder' },
      { cmd: 'uname -a', output: 'Linux srec-node 6.8.0-generic #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux' },
      { cmd: 'git status', output: 'On branch main\nYour branch is up to date with \'origin/main\'.\n\nChanges to be committed:\n  modified: src/vision/kinematics.py\n  modified: models/agent_core.onnx\n  new file: campusvault/platform.js' },
      { cmd: 'python3 -c "import torch; print(torch.__version__)"', output: '2.4.0+cu121 (CUDA available: True, Device: NVIDIA RTX)' },
      { cmd: 'cat ~/mission.txt', output: 'Turn questions into code. Turn backlogs into lessons. Build something that lasts.' }
    ];

    let historyIdx = 0;

    // Simulate auto-typing initial commands if visible
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !termBody.dataset.typed) {
          termBody.dataset.typed = 'true';
          runSimulatedTerminal();
        }
      });
    }, { threshold: 0.3 });

    observer.observe(termBody);

    function runSimulatedTerminal() {
      let step = 0;
      function nextCommand() {
        if (step >= commandHistory.length) return;
        const item = commandHistory[step];
        typeCommand(item.cmd, item.output, () => {
          step++;
          setTimeout(nextCommand, 1200);
        });
      }
      setTimeout(nextCommand, 800);
    }

    function typeCommand(cmdText, outputText, onComplete) {
      const line = document.createElement('div');
      line.className = 'cv-term-line';
      line.innerHTML = `<span class="cv-term-prompt">dilli@campusvault:~$</span> <span class="cv-term-cmd"></span>`;
      termBody.appendChild(line);

      const cmdEl = line.querySelector('.cv-term-cmd');
      let i = 0;

      const charInterval = setInterval(() => {
        if (i < cmdText.length) {
          cmdEl.textContent += cmdText[i];
          i++;
          AudioEngine.playHapticBeep(1200 + i * 20, 0.02);
        } else {
          clearInterval(charInterval);
          setTimeout(() => {
            const outEl = document.createElement('div');
            outEl.className = 'cv-term-output';
            outEl.textContent = outputText;
            termBody.appendChild(outEl);
            termBody.scrollTop = termBody.scrollHeight;
            if (onComplete) onComplete();
          }, 250);
        }
      }, 45);
    }

    // Allow user to type in real time
    termInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = termInput.value.trim();
        if (!val) return;
        termInput.value = '';

        const line = document.createElement('div');
        line.className = 'cv-term-line';
        line.innerHTML = `<span class="cv-term-prompt">dilli@campusvault:~$</span> <span class="cv-term-cmd">${escapeHtml(val)}</span>`;
        termBody.appendChild(line);

        const out = document.createElement('div');
        out.className = 'cv-term-output';

        if (val === 'help') {
          out.textContent = 'Available commands: whoami, status, projects, clear, date, quote, echo [text]';
        } else if (val === 'clear') {
          termBody.innerHTML = '';
          return;
        } else if (val === 'status') {
          out.textContent = 'ALL SYSTEMS OPERATIONAL · 3RD YEAR AI & DS · SREC TIRUPATI';
        } else if (val === 'projects') {
          out.textContent = 'Projects: DSA in Java, QR Generator, IoT Air Quality Dashboard, CampusVault Hub';
        } else if (val.startsWith('echo ')) {
          out.textContent = val.slice(5);
        } else {
          out.textContent = `bash: ${val}: command recognized in future deployment pipelines.`;
        }

        termBody.appendChild(out);
        termBody.scrollTop = termBody.scrollHeight;
        AudioEngine.playHapticBeep(940, 0.05);
      }
    });
  }

  // --------------------------------------------------------------------------
  // 8. 3D Cloud Network & Global Nodes Canvas
  // --------------------------------------------------------------------------
  function setupCloudGlobe() {
    const canvas = document.getElementById('cv-cloud-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement.offsetWidth);
    let height = (canvas.height = canvas.parentElement.offsetHeight);

    window.addEventListener('resize', () => {
      width = canvas.width = canvas.parentElement.offsetWidth;
      height = canvas.height = canvas.parentElement.offsetHeight;
    }, { passive: true });

    const globeRadius = Math.min(width, height) * 0.35;
    const dotCount = 120;
    const dots = [];

    for (let i = 0; i < dotCount; i++) {
      const phi = Math.acos(-1 + (2 * i) / dotCount);
      const theta = Math.sqrt(dotCount * Math.PI) * phi;
      dots.push({
        x: globeRadius * Math.cos(theta) * Math.sin(phi),
        y: globeRadius * Math.sin(theta) * Math.sin(phi),
        z: globeRadius * Math.cos(phi)
      });
    }

    let rotY = 0;
    let rotX = 0.2;

    function render() {
      ctx.clearRect(0, 0, width, height);

      rotY += 0.008;
      const cx = width / 2;
      const cy = height / 2;

      // Sort dots by depth
      const projected = dots.map(d => {
        // Rotate around Y
        const cosY = Math.cos(rotY);
        const sinY = Math.sin(rotY);
        const x1 = d.x * cosY - d.z * sinY;
        const z1 = d.z * cosY + d.x * sinY;

        // Rotate around X
        const cosX = Math.cos(rotX);
        const sinX = Math.sin(rotX);
        const y2 = d.y * cosX - z1 * sinX;
        const z2 = z1 * cosX + d.y * sinX;

        const scale = 380 / (380 + z2);
        return {
          px: cx + x1 * scale,
          py: cy + y2 * scale,
          pz: z2,
          scale: scale
        };
      }).sort((a, b) => a.pz - b.pz);

      // Render connection arcs
      for (let i = 0; i < projected.length; i += 4) {
        const next = projected[(i + 7) % projected.length];
        if (projected[i].pz > -50 && next.pz > -50) {
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.15)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(projected[i].px, projected[i].py);
          ctx.lineTo(next.px, next.py);
          ctx.stroke();
        }
      }

      // Draw projected nodes
      projected.forEach(p => {
        const alpha = Math.max(0.1, (p.pz + globeRadius) / (2 * globeRadius));
        ctx.fillStyle = `rgba(96, 165, 250, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.px, p.py, Math.max(1, 2.5 * p.scale), 0, Math.PI * 2);
        ctx.fill();
      });

      requestAnimationFrame(render);
    }

    render();
  }

  // --------------------------------------------------------------------------
  // 9. Robotics & e-Yantra Kinematics HUD Simulation
  // --------------------------------------------------------------------------
  function setupRoboticsViewport() {
    const canvas = document.getElementById('cv-robotics-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement.offsetWidth);
    let height = (canvas.height = canvas.parentElement.offsetHeight);

    window.addEventListener('resize', () => {
      width = canvas.width = canvas.parentElement.offsetWidth;
      height = canvas.height = canvas.parentElement.offsetHeight;
    }, { passive: true });

    let t = 0;
    const coordEl = document.getElementById('cv-telemetry-coord');
    const anglesEl = document.getElementById('cv-telemetry-angles');

    function render() {
      ctx.fillStyle = '#080a0f';
      ctx.fillRect(0, 0, width, height);

      t += 0.025;

      const baseX = width * 0.35;
      const baseY = height * 0.8;

      // 3-link robotic arm inverse kinematics trajectory
      const l1 = height * 0.32;
      const l2 = height * 0.28;
      const l3 = height * 0.14;

      const a1 = -Math.PI / 3 + Math.sin(t) * 0.35;
      const a2 = Math.PI / 2.5 + Math.cos(t * 1.2) * 0.45;
      const a3 = -Math.PI / 4 + Math.sin(t * 0.8) * 0.3;

      const j1X = baseX;
      const j1Y = baseY;

      const j2X = j1X + Math.cos(a1) * l1;
      const j2Y = j1Y + Math.sin(a1) * l1;

      const j3X = j2X + Math.cos(a1 + a2) * l2;
      const j3Y = j2Y + Math.sin(a1 + a2) * l2;

      const endX = j3X + Math.cos(a1 + a2 + a3) * l3;
      const endY = j3Y + Math.sin(a1 + a2 + a3) * l3;

      // Draw grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Base pedestal
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(baseX - 35, baseY, 70, 18);

      // Arm Links (Cyan wireframe with glowing joints)
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(j1X, j1Y);
      ctx.lineTo(j2X, j2Y);
      ctx.lineTo(j3X, j3Y);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Joints
      [ { x: j1X, y: j1Y }, { x: j2X, y: j2Y }, { x: j3X, y: j3Y } ].forEach(j => {
        ctx.fillStyle = '#60a5fa';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(j.x, j.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // End-effector gripper
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(endX, endY, 8, 0, Math.PI);
      ctx.stroke();

      // OpenCV Vision Bounding Box tracking target
      const targetX = width * 0.75 + Math.sin(t * 0.7) * 40;
      const targetY = height * 0.5 + Math.cos(t * 0.9) * 30;

      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(targetX - 30, targetY - 30, 60, 60);

      // Corner markers
      ctx.fillStyle = '#10b981';
      ctx.fillRect(targetX - 34, targetY - 34, 8, 2);
      ctx.fillRect(targetX - 34, targetY - 34, 2, 8);
      ctx.fillRect(targetX + 26, targetY - 34, 8, 2);
      ctx.fillRect(targetX + 32, targetY - 34, 2, 8);

      ctx.font = '11px var(--cv-font-mono)';
      ctx.fillText('TARGET_ID: OBJECT_01 [0.984]', targetX - 30, targetY - 38);

      // Laser guide line from gripper to target
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(targetX, targetY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Update telemetry readout DOM
      if (coordEl && Math.random() < 0.1) {
        coordEl.textContent = `X: ${(endX * 0.6).toFixed(1)} mm | Y: ${(endY * 0.6).toFixed(1)} mm | Z: ${(120 + Math.sin(t) * 30).toFixed(1)} mm`;
      }
      if (anglesEl && Math.random() < 0.1) {
        anglesEl.textContent = `θ1: ${(a1 * 57.3).toFixed(1)}° | θ2: ${(a2 * 57.3).toFixed(1)}° | θ3: ${(a3 * 57.3).toFixed(1)}°`;
      }

      requestAnimationFrame(render);
    }

    render();
  }

  // --------------------------------------------------------------------------
  // 10. Night Hours Clock Simulation (2 AM)
  // --------------------------------------------------------------------------
  function setupNightClock() {
    const clockEl = document.getElementById('cv-night-clock');
    if (!clockEl) return;

    const times = ['01:42 AM', '01:58 AM', '02:14 AM', '02:37 AM', '02:51 AM', '03:04 AM'];
    let idx = 0;

    setInterval(() => {
      idx = (idx + 1) % times.length;
      clockEl.textContent = times[idx];
    }, 3200);
  }

  // --------------------------------------------------------------------------
  // 11. 3D Project Card Tilt Interaction
  // --------------------------------------------------------------------------
  function setupProjectCardTilt() {
    const cards = document.querySelectorAll('.cv-project-card');
    cards.forEach(card => {
      card.addEventListener('pointermove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotX = -((y - centerY) / centerY) * 7;
        const rotY = ((x - centerX) / centerX) * 7;

        card.style.transform = `perspective(1000px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) translateY(-4px)`;
      });

      card.addEventListener('pointerleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)';
      });
    });
  }

  // --------------------------------------------------------------------------
  // 12. Floating Dock Navigation Controller
  // --------------------------------------------------------------------------
  function setupNavigationDock() {
    const dockWrap = document.querySelector('.cv-dock-wrap');
    const dockLinks = document.querySelectorAll('.cv-dock-link, .cv-drawer-link');
    const mobileToggle = document.getElementById('cv-mobile-toggle');
    const mobileDrawer = document.getElementById('cv-mobile-drawer');
    const drawerClose = document.getElementById('cv-drawer-close');
    const audioBtn = document.getElementById('cv-audio-toggle');
    const soundBars = document.getElementById('cv-sound-bars');
    const progressBar = document.getElementById('cv-progress-bar');

    // Scroll progress & smart dock show/hide
    window.addEventListener('scroll', () => {
      const scrollY = window.scrollY;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const progress = maxScroll > 0 ? (scrollY / maxScroll) * 100 : 0;

      if (progressBar) progressBar.style.width = `${progress}%`;

      if (dockWrap) {
        if (scrollY > CV_STATE.lastScrollY && scrollY > 300) {
          dockWrap.classList.add('cv-dock-hidden');
        } else {
          dockWrap.classList.remove('cv-dock-hidden');
        }
      }

      CV_STATE.lastScrollY = scrollY;
    }, { passive: true });

    // Active link highlighting via IntersectionObserver
    const sections = document.querySelectorAll('section[id], div[id^="sec-"]');
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          dockLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href === `#${id}`) {
              link.classList.add('active');
            } else if (href && href.startsWith('#')) {
              link.classList.remove('active');
            }
          });
        }
      });
    }, { threshold: 0.3 });

    sections.forEach(s => sectionObserver.observe(s));

    // Audio toggle
    if (audioBtn) {
      audioBtn.addEventListener('click', () => {
        const isPlaying = AudioEngine.toggle();
        audioBtn.setAttribute('aria-pressed', String(isPlaying));
        if (soundBars) {
          soundBars.classList.toggle('cv-sound-playing', isPlaying);
        }
      });
    }

    // Mobile drawer toggle
    if (mobileToggle && mobileDrawer) {
      mobileToggle.addEventListener('click', () => {
        mobileDrawer.classList.add('cv-drawer-open');
        document.body.style.overflow = 'hidden';
      });
    }

    if (drawerClose && mobileDrawer) {
      drawerClose.addEventListener('click', () => {
        mobileDrawer.classList.remove('cv-drawer-open');
        document.body.style.overflow = '';
      });
    }

    // Close mobile drawer on link click
    document.querySelectorAll('.cv-drawer-link').forEach(link => {
      link.addEventListener('click', () => {
        if (mobileDrawer) {
          mobileDrawer.classList.remove('cv-drawer-open');
          document.body.style.overflow = '';
        }
      });
    });
  }

  // --------------------------------------------------------------------------
  // 13. Custom Precision Cursor (Ring & Dot)
  // --------------------------------------------------------------------------
  function setupCustomCursor() {
    if (CV_STATE.isMobile || CV_STATE.reducedMotion) return;

    const dot = document.createElement('div');
    dot.className = 'cv-cursor-dot';
    const ring = document.createElement('div');
    ring.className = 'cv-cursor-ring';

    document.body.appendChild(dot);
    document.body.appendChild(ring);
    document.body.classList.add('cv-has-custom-cursor');

    let mouseX = -100;
    let mouseY = -100;
    let ringX = -100;
    let ringY = -100;

    window.addEventListener('pointermove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;
    }, { passive: true });

    function tick() {
      ringX += (mouseX - ringX) * 0.22;
      ringY += (mouseY - ringY) * 0.22;
      ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
      requestAnimationFrame(tick);
    }
    tick();

    // Hover effect over interactive elements
    const interactives = document.querySelectorAll('a, button, input, .cv-project-card, .cv-hub-card');
    interactives.forEach(el => {
      el.addEventListener('pointerenter', () => ring.classList.add('cv-hovering'));
      el.addEventListener('pointerleave', () => ring.classList.remove('cv-hovering'));
      el.addEventListener('click', () => AudioEngine.playHapticBeep(1020, 0.03));
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  }

  // --------------------------------------------------------------------------
  // 14. Master Initialization on DOMContentLoaded
  // --------------------------------------------------------------------------
  window.addEventListener('DOMContentLoaded', () => {
    setupPreloader();
    setupNavigationDock();
    setupThinkingCanvas();
    setupPhysicsSimulation();
    setupPeopleCanvas();
    setupTerminalInteraction();
    setupCloudGlobe();
    setupRoboticsViewport();
    setupNightClock();
    setupProjectCardTilt();
    setupCustomCursor();
  });

})();
