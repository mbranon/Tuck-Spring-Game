/* =========================================================
   DROP-IN “MAKE IT COME TO LIFE” JS (no libraries)
   Adds:
   1) Ambient sound (toggle + volume)
   2) Choice click sound
   3) Typewriter text reveal (optional)
   4) Animated parallax scene header + auto scene images
   5) Floating particles (fireflies) + subtle “spring glow” pulse
   6) Ending confetti (soft) for non-chaotic endings

   HOW TO USE (quick):
   A) Paste this BELOW your existing game JS, or replace the bottom half.
   B) Add these optional elements in your HTML:
      - Put this right under <body> (recommended):
        <div class="fireflies"></div>
      - Put this inside .card above <main>:
        <div class="scene-art" id="sceneArt"><div class="scene-art__veil"></div></div>
   C) In your story data, add an image field to scenes if you want:
      image: "images/woods.jpg"   (local file) OR a URL

   If you don't add images, it will still work and use built-in gradients.
   ========================================================= */

/* ---------- 0) Small helpers ---------- */
const $ = (sel) => document.querySelector(sel);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

/* ---------- 1) Build audio (procedural so no files needed) ---------- */
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function makeAmbientDrone() {
  // A gentle pad-like drone (2 oscillators + lowpass)
  const master = audioCtx.createGain();
  master.gain.value = 0.0;

  const lp = audioCtx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 520;

  const osc1 = audioCtx.createOscillator();
  osc1.type = "sine";
  osc1.frequency.value = 110; // A2

  const osc2 = audioCtx.createOscillator();
  osc2.type = "triangle";
  osc2.frequency.value = 165; // E3-ish

  const lfo = audioCtx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.12;
  const lfoGain = audioCtx.createGain();
  lfoGain.gain.value = 0.12;

  lfo.connect(lfoGain);
  lfoGain.connect(master.gain);

  osc1.connect(lp);
  osc2.connect(lp);
  lp.connect(master);
  master.connect(audioCtx.destination);

  osc1.start();
  osc2.start();
  lfo.start();

  return { master, lp };
}

function playClickTone() {
  // tiny “droplet” click
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const lp = audioCtx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(1800, t);

  osc.type = "sine";
  osc.frequency.setValueAtTime(880, t);
  osc.frequency.exponentialRampToValueAtTime(520, t + 0.08);

  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.08, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);

  osc.connect(lp);
  lp.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(t);
  osc.stop(t + 0.14);
}

function playEndingChord(kind = "soft") {
  // quick 3-note chord: "soft" or "chaos"
  const t = audioCtx.currentTime;
  const gain = audioCtx.createGain();
  gain.gain.value = 0.0001;
  gain.connect(audioCtx.destination);

  const base = kind === "chaos" ? 196 : 220; // G3 vs A3
  const ratios = kind === "chaos" ? [1, 1.189, 1.414] : [1, 1.25, 1.5]; // imperfect vs perfect-ish

  ratios.forEach((r, i) => {
    const osc = audioCtx.createOscillator();
    osc.type = i === 1 ? "triangle" : "sine";
    osc.frequency.value = base * r;
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + 0.65);
  });

  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
}

/* ---------- 2) UI Controls (sound toggle + slider) ---------- */
function mountSoundControls() {
  const footer = $(".footer");
  if (!footer) return;

  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.gap = "10px";
  wrap.style.alignItems = "center";
  wrap.style.flexWrap = "wrap";

  const btn = document.createElement("button");
  btn.className = "small-btn";
  btn.textContent = "🔊 Sound: Off";
  btn.setAttribute("aria-pressed", "false");

  const vol = document.createElement("input");
  vol.type = "range";
  vol.min = "0";
  vol.max = "1";
  vol.step = "0.01";
  vol.value = "0.45";
  vol.title = "Ambient volume";
  vol.style.accentColor = "rgba(148,255,208,.9)";
  vol.style.width = "140px";

  wrap.appendChild(btn);
  wrap.appendChild(vol);

  // insert before existing actions if possible
  const actions = footer.querySelector(".actions");
  if (actions) footer.insertBefore(wrap, actions);
  else footer.appendChild(wrap);

  return { btn, vol };
}

/* ---------- 3) Typewriter effect for scene text ---------- */
let typingAbort = { abort: false };

async function typeText(el, text, speedMs = 10) {
  typingAbort.abort = true;         // stop any previous run
  await new Promise(r => setTimeout(r, 0));
  typingAbort = { abort: false };

  el.textContent = "";
  for (let i = 0; i < text.length; i++) {
    if (typingAbort.abort) return;
    el.textContent += text[i];
    if (text[i] === "\n") {
      await new Promise(r => setTimeout(r, speedMs * 6));
    } else {
      await new Promise(r => setTimeout(r, speedMs));
    }
  }
}

/* ---------- 4) Parallax scene header + auto images ---------- */
const fallbackImages = {
  start: "linear-gradient(180deg, rgba(0,0,0,.25), rgba(0,0,0,.75)), radial-gradient(700px 220px at 30% 20%, rgba(148,255,208,.18), transparent 70%)",
  sip: "linear-gradient(180deg, rgba(0,0,0,.15), rgba(0,0,0,.82)), radial-gradient(800px 260px at 20% 10%, rgba(160,210,255,.14), transparent 70%)",
  bottle: "linear-gradient(180deg, rgba(0,0,0,.15), rgba(0,0,0,.84)), radial-gradient(800px 260px at 70% 20%, rgba(148,255,208,.12), transparent 70%)",
  investigate: "linear-gradient(180deg, rgba(0,0,0,.12), rgba(0,0,0,.86)), radial-gradient(900px 280px at 50% 30%, rgba(160,210,255,.12), transparent 72%)",
  ending_guardian: "linear-gradient(180deg, rgba(0,0,0,.08), rgba(0,0,0,.78)), radial-gradient(900px 280px at 50% 20%, rgba(148,255,208,.18), transparent 70%)",
  ending_spread: "linear-gradient(180deg, rgba(0,0,0,.12), rgba(0,0,0,.88)), radial-gradient(900px 280px at 50% 20%, rgba(255,120,120,.14), transparent 70%)"
};

function setSceneArt(sceneId) {
  const art = $("#sceneArt");
  if (!art || !window.scenes) return;

  const scene = window.scenes[sceneId];
  const img = scene?.image;

  if (img) {
    art.style.backgroundImage = `linear-gradient(180deg, rgba(0,0,0,.10), rgba(0,0,0,.80)), url("${img}")`;
  } else {
    // Use a themed gradient if no image provided
    art.style.backgroundImage = fallbackImages[sceneId] || fallbackImages.start;
  }
  art.style.backgroundSize = "cover";
  art.style.backgroundPosition = "center";
}

function mountParallax() {
  const art = $("#sceneArt");
  if (!art) return;

  window.addEventListener("mousemove", (e) => {
    const rect = art.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / rect.width;
    const dy = (e.clientY - cy) / rect.height;

    const px = clamp(50 + dx * 6, 40, 60);
    const py = clamp(50 + dy * 6, 40, 60);
    art.style.backgroundPosition = `${px}% ${py}%`;
  });
}

/* ---------- 5) Particle fireflies canvas (more alive than CSS) ---------- */
let flyCanvas, flyCtx, flies = [], flyAnimId;

function mountFireflyCanvas() {
  // If you already used the CSS .fireflies overlay, you can skip this.
  // This canvas version is richer and still subtle.
  flyCanvas = document.createElement("canvas");
  flyCanvas.style.position = "fixed";
  flyCanvas.style.inset = "0";
  flyCanvas.style.pointerEvents = "none";
  flyCanvas.style.zIndex = "1";
  flyCanvas.style.opacity = "0.75";
  document.body.appendChild(flyCanvas);

  flyCtx = flyCanvas.getContext("2d");

  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    flyCanvas.width = Math.floor(window.innerWidth * dpr);
    flyCanvas.height = Math.floor(window.innerHeight * dpr);
    flyCanvas.style.width = window.innerWidth + "px";
    flyCanvas.style.height = window.innerHeight + "px";
    flyCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  window.addEventListener("resize", resize);
  resize();

  flies = Array.from({ length: 32 }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    r: 1 + Math.random() * 2.2,
    vx: (-0.2 + Math.random() * 0.4),
    vy: (-0.15 + Math.random() * 0.3),
    phase: Math.random() * Math.PI * 2,
    hue: Math.random() < 0.55 ? 52 : 155 // warm yellow vs green
  }));

  const tick = () => {
    flyCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (const f of flies) {
      f.x += f.vx;
      f.y += f.vy;
      f.phase += 0.03;

      // wrap
      if (f.x < -20) f.x = window.innerWidth + 20;
      if (f.x > window.innerWidth + 20) f.x = -20;
      if (f.y < -20) f.y = window.innerHeight + 20;
      if (f.y > window.innerHeight + 20) f.y = -20;

      const a = 0.15 + 0.35 * (0.5 + 0.5 * Math.sin(f.phase));
      flyCtx.beginPath();
      flyCtx.fillStyle = `hsla(${f.hue}, 90%, 70%, ${a})`;
      flyCtx.shadowBlur = 12;
      flyCtx.shadowColor = `hsla(${f.hue}, 90%, 70%, ${a})`;
      flyCtx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      flyCtx.fill();
      flyCtx.shadowBlur = 0;
    }

    flyAnimId = requestAnimationFrame(tick);
  };
  tick();
}

/* ---------- 6) “Spring glow” pulse near the title ---------- */
function pulseGlow() {
  const title = $("#sceneTitle");
  if (!title) return;
  title.animate(
    [
      { textShadow: "0 8px 24px rgba(0,0,0,.35), 0 0 0 rgba(148,255,208,0)" },
      { textShadow: "0 8px 24px rgba(0,0,0,.35), 0 0 18px rgba(148,255,208,.18)" },
      { textShadow: "0 8px 24px rgba(0,0,0,.35), 0 0 0 rgba(148,255,208,0)" }
    ],
    { duration: 2200, iterations: 1, easing: "ease-in-out" }
  );
}

/* ---------- 7) Soft confetti for “good/reflective” endings ---------- */
function softConfetti() {
  const card = $(".card");
  if (!card) return;

  const layer = document.createElement("div");
  layer.style.position = "absolute";
  layer.style.inset = "0";
  layer.style.pointerEvents = "none";
  layer.style.zIndex = "3";
  card.appendChild(layer);

  const bits = 40;
  for (let i = 0; i < bits; i++) {
    const s = document.createElement("span");
    s.style.position = "absolute";
    s.style.left = Math.random() * 100 + "%";
    s.style.top = "-10px";
    s.style.width = (6 + Math.random() * 10) + "px";
    s.style.height = (6 + Math.random() * 10) + "px";
    s.style.borderRadius = "999px";
    s.style.background = Math.random() < 0.5
      ? "rgba(148,255,208,.55)"
      : "rgba(160,210,255,.55)";
    s.style.filter = "blur(0.2px)";
    s.style.opacity = "0.85";
    layer.appendChild(s);

    const drift = (-20 + Math.random() * 40);
    const dur = 1200 + Math.random() * 900;

    s.animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 0.0 },
        { transform: `translate(${drift}px, 80px) scale(1)`, opacity: 0.9, offset: 0.25 },
        { transform: `translate(${drift * 1.6}px, 320px) scale(0.95)`, opacity: 0.0 }
      ],
      { duration: dur, easing: "cubic-bezier(.2,.7,.2,1)", fill: "forwards" }
    );
  }

  setTimeout(() => layer.remove(), 2400);
}

/* ---------- 8) Hook into your existing render() ---------- */
/*
  Your original code has a render(sceneId, pushHistory) function.
  We’ll wrap it so every scene change triggers:
  - ambient mood change
  - typewriter text
  - art update
  - glow pulse
  - ending effects
*/
function enhanceGame() {
  // Ensure we can access your existing variables/functions
  if (typeof render !== "function" || !window.scenes) {
    console.warn("Enhancer: couldn't find render() or scenes. Paste this after your game JS.");
    return;
  }

  // Mount extras
  const controls = mountSoundControls();
  mountParallax();
  mountFireflyCanvas();

  const ambient = makeAmbientDrone();
  let soundOn = false;

  function setAmbient(on) {
    // resume AudioContext on first user gesture
    if (audioCtx.state === "suspended") audioCtx.resume();

    soundOn = on;
    if (controls?.btn) {
      controls.btn.textContent = on ? "🔊 Sound: On" : "🔇 Sound: Off";
      controls.btn.setAttribute("aria-pressed", String(on));
    }

    const target = on ? parseFloat(controls?.vol?.value ?? "0.45") : 0.0;
    const t = audioCtx.currentTime;
    ambient.master.gain.cancelScheduledValues(t);
    ambient.master.gain.setValueAtTime(ambient.master.gain.value, t);
    ambient.master.gain.linearRampToValueAtTime(target, t + 0.25);
  }

  if (controls?.btn) {
    controls.btn.addEventListener("click", () => setAmbient(!soundOn));
  }
  if (controls?.vol) {
    controls.vol.addEventListener("input", () => {
      if (!soundOn) return;
      const target = parseFloat(controls.vol.value);
      const t = audioCtx.currentTime;
      ambient.master.gain.cancelScheduledValues(t);
      ambient.master.gain.linearRampToValueAtTime(target, t + 0.08);
    });
  }

  // Wrap render
  const originalRender = render;
  render = function(sceneId, pushHistory = true) {
    originalRender(sceneId, pushHistory);

    // Art + glow
    setSceneArt(sceneId);
    pulseGlow();

    // Typewriter (optional): comment this out if you prefer instant text
    const textEl = $("#sceneText");
    if (textEl && window.scenes?.[sceneId]?.text) {
      typeText(textEl, window.scenes[sceneId].text, 9);
    }

    // Ending sounds + effects
    const isEnding = String(sceneId).startsWith("ending_");
    if (isEnding) {
      const endingName = window.scenes[sceneId].ending || "";
      const chaotic = /spread|chaos/i.test(endingName) || /ending_spread/i.test(sceneId);
      playEndingChord(chaotic ? "chaos" : "soft");
      if (!chaotic) softConfetti();
    }

    // Subtle mood filter changes
    const card = $(".card");
    const mood = window.scenes?.[sceneId]?.mood || "";
    if (card) {
      // Slight tint shift by mood keyword
      const tint = /chaotic|danger/i.test(mood) ? "rgba(255,120,120,.05)"
                : /hope|relieved|peace/i.test(mood) ? "rgba(148,255,208,.06)"
                : /tense|tempt/i.test(mood) ? "rgba(255,220,160,.05)"
                : "rgba(160,210,255,.04)";
      card.style.boxShadow = `0 18px 60px rgba(0,0,0,.55), 0 0 0 1px rgba(148,255,208,.08) inset, 0 0 40px ${tint}`;
    }
  };

  // Choice sound: capture clicks on choice buttons
  document.addEventListener("click", (e) => {
    const btn = e.target?.closest?.("button.choice");
    if (!btn) return;
    if (audioCtx.state === "suspended") audioCtx.resume();
    playClickTone();
  }, true);

  // Also add a tiny “whoosh” on back/restart
  ["backBtn", "restartBtn"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("click", () => {
      if (audioCtx.state === "suspended") audioCtx.resume();
      playClickTone();
    });
  });

  // Initialize art on current scene
  setSceneArt(typeof current === "string" ? current : "start");
}

/* ---------- 9) Run after page load ---------- */
window.addEventListener("load", () => {
  // Expose scenes if your original code used const scenes = {...}
  // If it's already global (window.scenes), great.
  if (typeof window.scenes === "undefined" && typeof scenes !== "undefined") {
    window.scenes = scenes;
  }
  enhanceGame();
});
