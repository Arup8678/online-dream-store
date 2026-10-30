import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react';
import { ArrowRight, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { Magnetic, useIsLowPower } from './ui.jsx';
import { useStore } from '../store.js';
import * as music from '../lib/romanticMusic.js';

const Hero3D = lazy(() => import('./Hero3D.jsx'));

const GREETINGS = [
  ['💌', 'With Love'], ['🎂', 'Happy Birthday'], ['💖', 'Be Mine'], ['🎁', 'Made for You'],
  ['🌹', 'Forever Yours'], ['✨', 'Make a Wish'], ['🧸', 'Hugs & Kisses'], ['💜', 'Dream Big'],
  ['🥰', 'Thinking of You'], ['🎉', 'Congratulations'],
];
// deterministic horizontal slots (% of width) so layout is stable between renders
const GREET_X = [8, 62, 30, 78, 44, 14, 70, 24, 54, 84];

function Greetings({ animate, count }) {
  return (
    <div className="greet-layer pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden="true">
      {GREETINGS.slice(0, count).map(([emoji, text], i) => (
        <span key={text} className="greet-pill"
          style={{
            left: `min(${GREET_X[i]}%, calc(100% - 10.5rem))`,
            animation: animate ? `greet-rise ${11 + (i % 4) * 1.6}s linear ${(i * 1.7).toFixed(1)}s infinite backwards` : 'none',
            top: animate ? undefined : `${18 + (i * 9) % 52}%`,
            bottom: animate ? undefined : 'auto',
            opacity: animate ? undefined : 0.9,
          }}>
          <span className="text-base md:text-lg">{emoji}</span>{text}
        </span>
      ))}
    </div>
  );
}

/** Purple CSS-only scene: low-power / reduced-motion devices, or while the 3D chunk loads. */
function HeroFallback({ animate = true }) {
  return (
    <div className="absolute inset-0 z-10" aria-hidden="true">
      <span className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 select-none text-[11rem] drop-shadow-[0_30px_40px_rgba(60,0,110,.7)] md:text-[17rem]"
        style={{ animation: animate ? 'floaty 6s ease-in-out infinite' : 'none' }}>🧸</span>
      <span className="absolute left-1/2 top-[62%] -translate-x-1/2 select-none text-6xl drop-shadow-[0_0_30px_rgba(236,72,153,.9)] md:text-8xl"
        style={{ animation: animate ? 'heartbeat 1.6s ease-in-out infinite' : 'none' }}>❤️</span>
    </div>
  );
}

function BackgroundTitle({ name, animate, y }) {
  const words = name.trim().split(/\s+/);
  let n = 0;
  return (
    <motion.div style={{ y }} className="absolute inset-x-0 top-[11%] z-0 flex justify-center md:top-[4%]">
      <h1 aria-label={name} className="bg-title select-none text-center font-display font-extrabold uppercase leading-[0.9]">
        {words.map((w, wi) => (
          <span key={wi} aria-hidden="true" className="block whitespace-nowrap md:inline md:[&:not(:last-child)]:mr-[0.25em]">
            {[...w].map((ch) => {
              const i = n++;
              return <span key={i} className="bg-letter inline-block" style={{ animation: animate ? `letter-float ${4 + (i % 4) * 0.4}s ease-in-out ${(i * 0.2).toFixed(2)}s infinite` : 'none' }}>{ch}</span>;
            })}
          </span>
        ))}
      </h1>
    </motion.div>
  );
}

export default function Hero() {
  const settings = useStore((s) => s.settings);
  const low = useIsLowPower();
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const [visible, setVisible] = useState(true);
  const [ready3d, setReady3d] = useState(false);
  const [playing, setPlaying] = useState(false);
  const mobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
  const animate = !low && !reduce;

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const yTitle = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 140]);
  const yCta = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 60]);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.01 });
    io.observe(ref.current);
    const vis = () => { if (document.hidden) { music.stop(); setPlaying(false); } };
    document.addEventListener('visibilitychange', vis);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', vis); };
  }, []);
  useEffect(() => {
    if (low) return;
    const go = () => setReady3d(true);
    const id = 'requestIdleCallback' in window ? window.requestIdleCallback(go, { timeout: 1500 }) : setTimeout(go, 600);
    return () => ('cancelIdleCallback' in window ? window.cancelIdleCallback(id) : clearTimeout(id));
  }, [low]);

  // Browsers block audio until a user gesture: start on the first tap/key unless the visitor muted it before.
  const startMusic = useCallback(async () => {
    try { await music.start(); setPlaying(music.isPlaying()); localStorage.setItem('dp-music', 'on'); } catch { /* audio unavailable */ }
  }, []);
  const stopMusic = useCallback(() => {
    music.stop(); setPlaying(false);
    try { localStorage.setItem('dp-music', 'off'); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    let muted = false;
    try { muted = localStorage.getItem('dp-music') === 'off'; } catch { /* ignore */ }
    const first = (e) => {
      if (e.target?.closest?.('[data-music-toggle]')) return;
      startMusic();
    };
    if (!muted) {
      window.addEventListener('pointerdown', first, { once: true });
      window.addEventListener('keydown', first, { once: true });
    }
    return () => {
      window.removeEventListener('pointerdown', first);
      window.removeEventListener('keydown', first);
      music.stop();
    };
  }, [startMusic]);

  const name = settings?.brand_name || 'Dream Palace';

  return (
    <section ref={ref} className="hero-purple relative isolate min-h-[calc(100dvh-4rem)] overflow-hidden md:min-h-[calc(100dvh-7rem)]">
      {/* atmosphere */}
      <div className="hero-rays pointer-events-none absolute left-1/2 top-[40%] z-0 h-[170vmax] w-[170vmax] -translate-x-1/2 -translate-y-1/2" aria-hidden="true" style={{ animation: animate ? 'sweep 90s linear infinite' : 'none' }} />
      <div className="hero-grid pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[45%]" aria-hidden="true" />
      {animate && (
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
          {Array.from({ length: mobile ? 8 : 16 }).map((_, i) => (
            <span key={i} className="bokeh" style={{ left: `${(i * 37 + 7) % 100}%`, width: 8 + (i % 5) * 7, height: 8 + (i % 5) * 7, animationDuration: `${12 + (i % 6) * 3}s`, animationDelay: `-${(i * 1.9).toFixed(1)}s` }} />
          ))}
        </div>
      )}

      <BackgroundTitle name={name} animate={animate} y={yTitle} />

      {/* 3D teddy + love heart */}
      <div className="hero-stage absolute inset-x-0 bottom-[36%] top-[18%] z-10 md:bottom-[12%] md:top-[12%]">
        {!(ready3d && !low) && <HeroFallback animate={animate} />}
        {ready3d && !low && (
          <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2 }}>
            <Suspense fallback={null}><Hero3D lite={mobile} active={visible} /></Suspense>
          </motion.div>
        )}
      </div>

      {/* greetings float bottom -> top in front */}
      <Greetings animate={animate} count={mobile ? 6 : 10} />

      <div className="vignette pointer-events-none absolute inset-0 z-[25]" aria-hidden="true" />

      {/* foreground content */}
      <div className="container-x relative z-30 flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-between pb-24 pt-5 text-center md:min-h-[calc(100dvh-7rem)] md:pb-8">
        <motion.span initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="chip !border-fuchsia-300/40 !bg-fuchsia-400/10 text-fuchsia-100 backdrop-blur">
          <Sparkles size={14} /> Free delivery within {settings?.free_radius_km || 5} km
        </motion.span>

        <motion.div style={{ y: yCta }} className="mt-auto">
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.7 }} className="mx-auto max-w-xl text-base text-violet-100/90 [text-shadow:0_2px_18px_rgba(30,0,60,.9)] md:text-lg">
            Discover stationery, toys, school essentials and gifts — delivered to your doorstep.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.7 }} className="mt-4 flex flex-wrap justify-center gap-3">
            <Magnetic><Link to="/shop" className="btn btn-primary !px-7 !py-3.5 text-base">Shop Now <ArrowRight size={18} /></Link></Magnetic>
            <Magnetic><a href="#categories" className="btn btn-ghost !px-7 !py-3.5 text-base">Explore Categories</a></Magnetic>
          </motion.div>
          <div className="mt-4 hidden flex-wrap justify-center gap-x-6 gap-y-1 text-sm text-violet-200/80 sm:flex">
            <span>✓ Cash on Delivery</span><span>✓ Secure online payment</span><span>✓ Same-day local delivery</span>
          </div>
        </motion.div>
      </div>

      {/* music control */}
      <button type="button" data-music-toggle onClick={playing ? stopMusic : startMusic}
        aria-label={playing ? 'Mute romantic music' : 'Play romantic music'} aria-pressed={playing}
        className="music-btn absolute bottom-20 right-3 z-40 md:bottom-6 md:right-6 flex items-center gap-2 rounded-full border border-white/20 bg-violet-950/60 px-3.5 py-2 text-xs text-violet-100 backdrop-blur transition hover:bg-violet-900/70 md:bottom-6 md:right-6">
        {playing ? <Volume2 size={16} /> : <VolumeX size={16} />}
        {playing ? (
          <span className="eq" aria-hidden="true"><i /><i /><i /><i /></span>
        ) : (
          <span className="hidden sm:inline">Tap for romantic music</span>
        )}
      </button>
    </section>
  );
}
