import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Compass,
  Gamepad2,
  Map as MapIcon,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ZoneId, ZONES } from './engine/houseScene';
import { GameMode, WalkthroughEngine } from './engine/WalkthroughEngine';

const SURFACE_LABELS: Record<string, string> = {
  tile: 'Jubin Berkilat',
  terracotta: 'Terracotta Geometri',
  wood: 'Urat Kayu Kelabu',
  cement: 'Simen Basuhan',
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<WalkthroughEngine | null>(null);

  const [mode, setMode] = useState<GameMode>('title');
  const [zoneLabel, setZoneLabel] = useState<string>(ZONES.dapur.label);
  const [activeZoneId, setActiveZoneId] = useState<ZoneId>('dapur');
  const [surface, setSurface] = useState<string>('tile');
  const [muted, setMuted] = useState<boolean>(false);
  const [dockOpen, setDockOpen] = useState<boolean>(true);
  const [showMinimap, setShowMinimap] = useState<boolean>(true);
  const [fastWalk, setFastWalk] = useState<boolean>(false);
  const [pointerLocked, setPointerLocked] = useState<boolean>(false);
  const [touchMode, setTouchMode] = useState<boolean>(() =>
    typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  );
  const [playerPose, setPlayerPose] = useState<{ x: number; z: number; yaw: number }>({
    x: 0.15,
    z: 4.35,
    yaw: Math.PI,
  });

  // Touch joystick & look state refs
  const joyKnobRef = useRef<HTMLDivElement | null>(null);
  const joyTouchIdRef = useRef<number | null>(null);
  const lookTouchIdRef = useRef<number | null>(null);
  const lastLookPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const engine = new WalkthroughEngine(el, {
      onZoneChange: (label, id, surf) => {
        setZoneLabel(label);
        setActiveZoneId(id);
        setSurface(surf);
      },
      onPlayerMove: (x, z, yaw) => {
        setPlayerPose({ x, z, yaw });
      },
      onPointerLockChange: (locked) => {
        setPointerLocked(locked);
      },
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const startGame = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.setMode('playing');
    eng.teleportToZone('dapur');
    setMode('playing');
    eng.requestPointerLock();
  }, []);

  const resumeGame = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.playClick();
    eng.setMode('playing');
    setMode('playing');
    eng.requestPointerLock();
  }, []);

  const pauseGame = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.playClick();
    eng.setMode('paused');
    setMode('paused');
  }, []);

  const returnToTitle = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.playClick();
    eng.setMode('title');
    setMode('title');
  }, []);

  const handleTeleport = useCallback((id: ZoneId) => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.teleportToZone(id);
    if (mode !== 'playing') {
      eng.setMode('playing');
      setMode('playing');
    }
  }, [mode]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      engineRef.current?.setMuted(next);
      return next;
    });
  }, []);

  const toggleSpeed = useCallback(() => {
    setFastWalk((prev) => {
      const next = !prev;
      engineRef.current?.setMoveSpeed(next ? 4.4 : 3.0);
      engineRef.current?.playClick();
      return next;
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (mode === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        startGame();
        return;
      }
      if (e.code === 'Escape') {
        if (mode === 'playing') {
          pauseGame();
        } else if (mode === 'paused') {
          resumeGame();
        }
        return;
      }
      if (mode === 'playing') {
        if (e.code === 'KeyH') {
          setDockOpen((o) => !o);
        } else if (e.code === 'KeyM') {
          setShowMinimap((m) => !m);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, pauseGame, resumeGame, startGame]);

  // Dual-touch joystick handlers
  const updateJoystick = (clientX: number, clientY: number, rect: DOMRect) => {
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    const maxR = 38;
    const dist = Math.min(Math.hypot(dx, dy), maxR);
    const ang = Math.atan2(dy, dx);
    const kx = Math.cos(ang) * dist;
    const ky = Math.sin(ang) * dist;
    if (joyKnobRef.current) {
      joyKnobRef.current.style.transform = `translate(${kx}px, ${ky}px)`;
    }
    engineRef.current?.setJoystickVector(kx / maxR, ky / maxR);
  };

  const handleJoyStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.changedTouches[0];
    if (!t) return;
    joyTouchIdRef.current = t.identifier;
    updateJoystick(t.clientX, t.clientY, e.currentTarget.getBoundingClientRect());
  };

  const handleJoyMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === joyTouchIdRef.current) {
        updateJoystick(t.clientX, t.clientY, rect);
      }
    }
  };

  const handleJoyEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joyTouchIdRef.current) {
        joyTouchIdRef.current = null;
        if (joyKnobRef.current) {
          joyKnobRef.current.style.transform = 'translate(0px, 0px)';
        }
        engineRef.current?.setJoystickVector(0, 0);
      }
    }
  };

  const handleLookStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.changedTouches[0];
    if (!t) return;
    lookTouchIdRef.current = t.identifier;
    lastLookPosRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleLookMove = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === lookTouchIdRef.current) {
        const dx = t.clientX - lastLookPosRef.current.x;
        const dy = t.clientY - lastLookPosRef.current.y;
        lastLookPosRef.current = { x: t.clientX, y: t.clientY };
        engineRef.current?.addLookDelta(dx, dy);
      }
    }
  };

  const handleLookEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lookTouchIdRef.current) {
        lookTouchIdRef.current = null;
      }
    }
  };

  // Map 3D world coords (-7..3.4, -6.8..7.4) to SVG minimap (120x150)
  const mapX = ((playerPose.x + 7.0) / 10.4) * 116 + 2;
  const mapY = ((playerPose.z + 6.8) / 14.2) * 144 + 3;
  const arrowDeg = (-playerPose.yaw * 180) / Math.PI;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0b0e14] font-sans text-[#f4f1ea]">
      {/* Isolated WebGL Viewport */}
      <div
        ref={mountRef}
        className="fixed inset-0 h-full w-full"
        onClick={() => {
          if (mode === 'playing' && !touchMode) {
            engineRef.current?.requestPointerLock();
          }
        }}
      />

      {/* TITLE SCREEN OVERLAY */}
      {mode === 'title' && (
        <div className="fixed inset-0 z-30 flex flex-col items-center justify-center bg-[#0b0e14]/60 px-6 text-center">
          <div className="max-w-xl rounded-2xl border border-amber-300/25 bg-[#10151f]/92 px-8 py-9 shadow-2xl">
            <div className="mx-auto mb-5 flex justify-center">
              <svg
                width="260"
                height="74"
                viewBox="0 0 260 74"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-label="Rumah 3D Walkthrough"
              >
                <path
                  d="M20 34L44 14L68 34V60H20V34Z"
                  stroke="#F2C14E"
                  strokeWidth="2.5"
                  fill="#1A2232"
                />
                <path d="M36 60V42H52V60" stroke="#F2C14E" strokeWidth="2.2" />
                <text
                  x="84"
                  y="34"
                  fill="#F7F3EA"
                  fontSize="24"
                  fontWeight="800"
                  letterSpacing="1.5"
                >
                  RUMAH 3D
                </text>
                <text
                  x="84"
                  y="54"
                  fill="#F2C14E"
                  fontSize="11.5"
                  fontWeight="600"
                  letterSpacing="2.4"
                >
                  EKSPLORASI SENI BINA
                </text>
              </svg>
            </div>

            <p className="mx-auto mb-6 max-w-md text-sm leading-relaxed text-slate-300">
              Terokai pelan rumah lengkap 4 zon — Dapur, Ruang Tengah &amp; Kerja, Ruang Tamu Utama, serta Koridor &amp; Bilik Air Belakang dengan pencahayaan PBR dan perabot multi-komponen.
            </p>

            <button
              type="button"
              onClick={startGame}
              className="inline-flex cursor-pointer items-center gap-2.5 rounded-xl bg-amber-400 px-7 py-3.5 text-sm font-bold tracking-wide text-slate-950 transition-transform hover:scale-[1.02] hover:bg-amber-300 active:scale-[0.98]"
            >
              <Play className="h-4 w-4 fill-current" />
              Mula Teroka
            </button>

            <p className="mt-6 text-xs tracking-wide text-slate-400">
              WASD Gerak &middot; Tetikus Pandang &middot; H Kawalan &middot; M Pelan &middot; Esc Jeda
            </p>
          </div>
        </div>
      )}

      {/* PLAYING HUD */}
      {mode === 'playing' && (
        <>
          {/* Center Crosshair */}
          <div className="pointer-events-none fixed left-1/2 top-1/2 z-10 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80 shadow-[0_0_6px_rgba(0,0,0,0.9)]" />

          {/* Top-Left Static Zone Badge */}
          <div className="pointer-events-none fixed left-4 top-4 z-20 flex flex-col gap-1.5 rounded-xl border border-white/15 bg-[#0e131d]/88 px-3.5 py-2.5 shadow-lg">
            <div className="flex items-center gap-2 text-xs font-bold tracking-wide text-amber-300">
              <Compass className="h-3.5 w-3.5 shrink-0" />
              <span>{zoneLabel}</span>
            </div>
            <div className="text-[11px] font-medium text-slate-300">
              Lantai: <span className="text-sky-300">{SURFACE_LABELS[surface] ?? surface}</span>
              {!touchMode && !pointerLocked && (
                <span className="ml-2 text-amber-200/80">&middot; Klik skrin untuk kunci tetikus</span>
              )}
            </div>
          </div>

          {/* Top-Right Compact Action Cluster */}
          <div className="fixed right-4 top-4 z-20 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowMinimap((m) => !m)}
              title="Tukar Pelan Lantai (M)"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-white/15 bg-[#0e131d]/88 text-slate-200 hover:border-amber-300/60 hover:text-amber-300"
            >
              <MapIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={pauseGame}
              title="Jeda (Esc)"
              className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 bg-[#0e131d]/88 px-3 text-xs font-semibold text-slate-200 hover:border-amber-300/60 hover:text-amber-300"
            >
              <Pause className="h-3.5 w-3.5" />
              <span>Jeda</span>
            </button>
          </div>

          {/* Corner 2D Architectural Minimap */}
          {showMinimap && (
            <div className="pointer-events-none fixed right-4 top-16 z-20 rounded-xl border border-white/15 bg-[#0e131d]/88 p-2 shadow-xl">
              <svg width="120" height="150" viewBox="0 0 120 150" className="block">
                {/* Zon 3: Ruang Tamu */}
                <rect x="4" y="4" width="56" height="58" rx="3" fill="#1d2838" stroke="#475569" strokeWidth="1" />
                {/* Zon 2: Ruang Tengah */}
                <rect x="60" y="10" width="54" height="76" rx="3" fill="#2d2320" stroke="#7c5240" strokeWidth="1" />
                {/* Zon 1: Dapur */}
                <rect x="44" y="86" width="70" height="60" rx="3" fill="#222a33" stroke="#64748b" strokeWidth="1" />
                {/* Zon 4: Koridor Tepi */}
                <rect x="14" y="86" width="30" height="60" rx="3" fill="#1a1d21" stroke="#52525b" strokeWidth="1" />
                {/* Labels */}
                <text x="32" y="34" textAnchor="middle" fill="#94a3b8" fontSize="7" fontWeight="700">TAMU</text>
                <text x="87" y="48" textAnchor="middle" fill="#e2a88c" fontSize="7" fontWeight="700">TENGAH</text>
                <text x="79" y="118" textAnchor="middle" fill="#cbd5e1" fontSize="7" fontWeight="700">DAPUR</text>
                <text x="29" y="118" textAnchor="middle" fill="#a1a1aa" fontSize="6" fontWeight="700">TEPI</text>
                {/* Player Marker + Facing Cone */}
                <g transform={`translate(${mapX.toFixed(1)}, ${mapY.toFixed(1)}) rotate(${arrowDeg.toFixed(1)})`}>
                  <polygon points="0,-9 -4,3 4,3" fill="#facc15" opacity="0.9" />
                  <circle cx="0" cy="0" r="3" fill="#ffffff" />
                </g>
              </svg>
            </div>
          )}

          {/* Dual-Touch Controls (Mobile / Touch Mode) */}
          {touchMode && (
            <>
              <div
                onTouchStart={handleLookStart}
                onTouchMove={handleLookMove}
                onTouchEnd={handleLookEnd}
                onTouchCancel={handleLookEnd}
                className="fixed right-0 top-0 z-10 h-full w-[55vw]"
              />
              <div
                onTouchStart={handleJoyStart}
                onTouchMove={handleJoyMove}
                onTouchEnd={handleJoyEnd}
                onTouchCancel={handleJoyEnd}
                className="fixed bottom-20 left-6 z-20 h-28 w-28 rounded-full border-2 border-amber-300/60 bg-[#0e131d]/75 shadow-lg"
              >
                <div className="pointer-events-none absolute inset-4 rounded-full border border-white/15" />
                <div
                  ref={joyKnobRef}
                  className="absolute left-8 top-8 h-12 w-12 rounded-full border border-amber-100/60 bg-amber-400/90 shadow-lg"
                />
              </div>
            </>
          )}

          {/* Collapsible Bottom Control Dock (Zero Mid-Screen Occlusion) */}
          <div className="fixed bottom-4 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center">
            <button
              type="button"
              onClick={() => setDockOpen((o) => !o)}
              className="mb-1.5 flex cursor-pointer items-center gap-1 rounded-t-lg border border-b-0 border-white/15 bg-[#0e131d]/92 px-3 py-1 text-[11px] font-semibold text-slate-300 hover:text-amber-300"
            >
              {dockOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
              <span>{dockOpen ? 'Tutup Kawalan (H)' : 'Buka Kawalan (H)'}</span>
            </button>

            {dockOpen && (
              <div className="flex max-w-[94vw] flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/15 bg-[#0e131d]/92 px-3.5 py-2.5 shadow-2xl">
                {(Object.keys(ZONES) as ZoneId[]).map((zId) => {
                  const active = activeZoneId === zId;
                  return (
                    <button
                      key={zId}
                      type="button"
                      onClick={() => handleTeleport(zId)}
                      className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                        active
                          ? 'border-amber-300 bg-amber-400/20 text-amber-200'
                          : 'border-white/15 bg-white/5 text-slate-200 hover:border-amber-300/50'
                      }`}
                    >
                      {ZONES[zId].label.replace(/^Zon \d+ · /, '')}
                    </button>
                  );
                })}

                <div className="mx-1 h-5 w-px bg-white/15" />

                <button
                  type="button"
                  onClick={toggleSpeed}
                  className="cursor-pointer rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:border-amber-300/50"
                >
                  Laju: {fastWalk ? '2x' : '1x'}
                </button>

                <button
                  type="button"
                  onClick={() => setTouchMode((t) => !t)}
                  title="Tukar Joystick Sentuh"
                  className={`flex cursor-pointer items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                    touchMode
                      ? 'border-sky-400/60 bg-sky-400/20 text-sky-200'
                      : 'border-white/15 bg-white/5 text-slate-300'
                  }`}
                >
                  <Gamepad2 className="h-3.5 w-3.5" />
                  <span>Sentuh</span>
                </button>

                <button
                  type="button"
                  onClick={toggleMute}
                  title={muted ? 'Buka Audio' : 'Senyap Audio'}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/15 bg-white/5 text-slate-200 hover:border-amber-300/50"
                >
                  {muted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4 text-emerald-300" />}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* PAUSE MODAL */}
      {mode === 'paused' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#0b0e14]/75 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#111622] p-6 shadow-2xl">
            <h2 className="mb-1 text-lg font-bold text-amber-300">Permainan Dijeda</h2>
            <p className="mb-5 text-xs text-slate-400">Lokasi semasa: {zoneLabel}</p>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={resumeGame}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-amber-400 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-300"
              >
                <Play className="h-4 w-4 fill-current" />
                Sambung Teroka
              </button>

              <button
                type="button"
                onClick={() => {
                  handleTeleport('dapur');
                }}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-semibold text-slate-200 hover:border-amber-300/50"
              >
                <RotateCcw className="h-4 w-4" />
                Mula Semula di Dapur
              </button>

              <button
                type="button"
                onClick={toggleMute}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-semibold text-slate-200 hover:border-amber-300/50"
              >
                {muted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4 text-emerald-300" />}
                {muted ? 'Aktifkan Audio' : 'Senyapkan Audio'}
              </button>

              <button
                type="button"
                onClick={returnToTitle}
                className="cursor-pointer rounded-xl border border-white/10 py-2 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Kembali ke Skrin Utama
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
