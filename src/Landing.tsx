// Landing page publique Sapurai (refonte v3 — design terminal/dashboard anime)
// Affichee par main.tsx quand un utilisateur non-authentifie arrive sur /
//
// Animations :
// - Status bar ticker continu
// - Terminal hero typewriter au load
// - Compteurs animes de 0 a la valeur
// - Pulse rouge sur urgences, glow vert sur "active"
// - Fade-in / slide-up scroll-triggered (Intersection Observer)
// - Hover lift sur cards
// - Curseurs ▋ clignotants

import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import SapuraiLogo from './components/ui/SapuraiLogo.tsx';

const Login = lazy(() => import('./Login.tsx'));

// Palette specifique landing (volontairement hors var() pour le ton terminal)
var BG_CREAM = '#f5f1e8';
var BG_DARK = '#0a0a09';
var FG_DARK = '#0a0a09';
var FG_ON_DARK = '#fafaf9';
var ACCENT_GREEN = '#16a34a';
var ACCENT_GREEN_DARK = '#15803d';
var ACCENT_RED = '#e74c3c';
var ACCENT_AMBER = '#a86a17';
var TERMINAL_BG = '#1a1816';
var TERMINAL_FG = '#e7e3d4';
var TEXT_MUTED = '#737067';
var BORDER = '#d6d0c0';
var CARD_BG = '#ffffff';

var FONT_MONO = "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace";
var FONT_SANS = "'Inter', system-ui, -apple-system, sans-serif";

// Hook : compteur anime de 0 a value sur duration ms, declenche quand visible
function useAnimatedCounter(value: number, duration: number, trigger: boolean): number {
  var [n, setN] = useState(0);
  useEffect(function () {
    if (!trigger) return;
    var start: number | null = null;
    var raf = 0;
    function step(ts: number) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      // Ease out cubic pour finir doucement
      var eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return function () { cancelAnimationFrame(raf); };
  }, [value, duration, trigger]);
  return n;
}

// Hook : detecte quand un element entre dans le viewport (1 seule fois)
function useInView<T extends Element>(rootMargin: string = '0px') {
  var ref = useRef<T | null>(null);
  var [inView, setInView] = useState(false);
  useEffect(function () {
    var el = ref.current;
    if (!el || inView) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      });
    }, { rootMargin: rootMargin, threshold: 0.15 });
    io.observe(el);
    return function () { io.disconnect(); };
  }, [rootMargin, inView]);
  return { ref: ref, inView: inView };
}

// Hook : effet typewriter, affiche progressivement les lignes
function useTypewriter(lines: string[], delayMs: number, trigger: boolean): number {
  var [shown, setShown] = useState(0);
  useEffect(function () {
    if (!trigger) { setShown(0); return; }
    var t = 0;
    var timers: number[] = [];
    lines.forEach(function (_, i) {
      t += delayMs;
      var id = window.setTimeout(function () { setShown(i + 1); }, t);
      timers.push(id);
    });
    return function () { timers.forEach(function (id) { clearTimeout(id); }); };
  }, [lines.length, delayMs, trigger]);
  return shown;
}

export default function Landing() {
  var [showLogin, setShowLogin] = useState(false);
  var heroInView = useInView<HTMLDivElement>();
  var problemInView = useInView<HTMLDivElement>();
  var solutionInView = useInView<HTMLDivElement>();

  // Compteurs dashboard (declenches au mount immediatement vu que le hero est visible d'office)
  var dosCount = useAnimatedCounter(38, 1200, true);
  var tcCount = useAnimatedCounter(76, 1300, true);
  var impayesCount = useAnimatedCounter(865, 1500, true);

  // Compteurs section probleme (declenches au scroll dans la view)
  var num200k = useAnimatedCounter(200, 1000, problemInView.inView);
  var num30 = useAnimatedCounter(30, 1000, problemInView.inView);

  // Typewriter terminal hero (5 lignes : commande + 4 lignes status)
  var heroLines = ['$ sapurai --status', '► sync_dpworld', '► alertes_surestaries', '► tracking_whatsapp', '► dispatch'];
  var heroShown = useTypewriter(heroLines, 320, heroInView.inView);

  // Progress bar FN_02 (0 -> 80% quand la section solution est visible)
  var [progress, setProgress] = useState(0);
  useEffect(function () {
    if (!solutionInView.inView) return;
    var raf = 0;
    var start: number | null = null;
    function step(ts: number) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / 1500, 1);
      setProgress(80 * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return function () { cancelAnimationFrame(raf); };
  }, [solutionInView.inView]);

  if (showLogin) {
    return (
      <Suspense fallback={<div style={{ minHeight: '100vh', background: BG_CREAM }} />}>
        <Login />
      </Suspense>
    );
  }

  function goLogin() { setShowLogin(true); }
  function goRegister() { window.location.hash = '#/register'; setShowLogin(true); }
  function comingSoon() { /* noop : bouton voir-demo desactive */ }

  var WA_URL = 'https://wa.me/221771234567';
  var EMAIL = 'sapurailogistics@gmail.com';

  return (
    <div style={{ minHeight: '100vh', background: BG_CREAM, color: FG_DARK, fontFamily: FONT_SANS, overflowX: 'hidden' }}>
      <style>{`
        /* ============ KEYFRAMES ============ */
        @keyframes lt-l-blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        @keyframes lt-l-pulse-red {
          0%, 100% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.6); }
          50% { box-shadow: 0 0 0 10px rgba(231, 76, 60, 0); }
        }
        @keyframes lt-l-pulse-green {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.92); }
        }
        @keyframes lt-l-pulse-amber {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes lt-l-ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes lt-l-fadeup {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes lt-l-glow-red {
          0%, 100% { text-shadow: 0 0 20px rgba(231, 76, 60, 0.3), 0 0 40px rgba(231, 76, 60, 0.15); }
          50% { text-shadow: 0 0 30px rgba(231, 76, 60, 0.5), 0 0 60px rgba(231, 76, 60, 0.25); }
        }
        @keyframes lt-l-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes lt-l-spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* ============ BASE ============ */
        .lt-l-mono { font-family: ${FONT_MONO}; font-variant-ligatures: none; }
        .lt-l-cursor::after { content: '▋'; color: ${ACCENT_GREEN}; animation: lt-l-blink 1.05s infinite; margin-left: 2px; }
        .lt-l-blink-dot { animation: lt-l-pulse-green 1.6s ease-in-out infinite; display: inline-block; }
        .lt-l-blink-red { animation: lt-l-pulse-amber 1.4s ease-in-out infinite; display: inline-block; color: ${ACCENT_RED}; }
        .lt-l-blink-amber { animation: lt-l-pulse-amber 1.8s ease-in-out infinite; display: inline-block; }
        .lt-l-fadeup { animation: lt-l-fadeup 0.7s cubic-bezier(0.2, 0.7, 0.3, 1) both; }
        .lt-l-fadeup-d1 { animation: lt-l-fadeup 0.7s cubic-bezier(0.2, 0.7, 0.3, 1) 0.1s both; }
        .lt-l-fadeup-d2 { animation: lt-l-fadeup 0.7s cubic-bezier(0.2, 0.7, 0.3, 1) 0.2s both; }
        .lt-l-fadeup-d3 { animation: lt-l-fadeup 0.7s cubic-bezier(0.2, 0.7, 0.3, 1) 0.3s both; }
        .lt-l-fadeup-d4 { animation: lt-l-fadeup 0.7s cubic-bezier(0.2, 0.7, 0.3, 1) 0.4s both; }

        .lt-l-eyebrow { display: inline-flex; align-items: center; gap: 6px; font-family: ${FONT_MONO}; font-size: 11px; letter-spacing: 0.18em; color: ${ACCENT_GREEN}; margin-bottom: 18px; text-transform: lowercase; }
        .lt-l-eyebrow::before { content: '●'; font-size: 10px; line-height: 1; animation: lt-l-pulse-green 2s ease-in-out infinite; }
        .lt-l-eyebrow.amber { color: ${ACCENT_AMBER}; }
        .lt-l-eyebrow.amber::before { animation: lt-l-pulse-amber 2s ease-in-out infinite; }
        .lt-l-eyebrow.red { color: ${ACCENT_RED}; }
        .lt-l-eyebrow.red::before { animation: lt-l-pulse-amber 1.4s ease-in-out infinite; }

        .lt-l-h1 { font-size: clamp(40px, 6vw, 72px); line-height: 1.05; font-weight: 800; letter-spacing: -0.025em; margin: 0 0 28px 0; color: ${FG_DARK}; }
        .lt-l-h2 { font-size: clamp(32px, 4.5vw, 52px); line-height: 1.1; font-weight: 800; letter-spacing: -0.022em; margin: 0 0 16px 0; color: ${FG_DARK}; }
        .lt-l-h2.on-dark { color: ${FG_ON_DARK}; }
        .lt-l-sub { font-size: 14px; line-height: 1.55; color: ${TEXT_MUTED}; margin: 0 0 28px 0; max-width: 640px; }
        .lt-l-sub.on-dark { color: #d6d3c8; }

        /* ============ CTAs ============ */
        .lt-l-cta-primary { display: inline-flex; align-items: center; justify-content: center; background: ${BG_DARK}; color: ${FG_ON_DARK}; border: none; border-radius: 8px; padding: 14px 22px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: ${FONT_MONO}; letter-spacing: 0.02em; min-height: 48px; transition: transform .15s ease, box-shadow .15s ease; }
        .lt-l-cta-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 24px -8px rgba(10,10,9,0.4); }
        .lt-l-cta-secondary { display: inline-flex; align-items: center; justify-content: center; background: transparent; color: ${FG_DARK}; border: 1px solid ${FG_DARK}; border-radius: 8px; padding: 14px 22px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: ${FONT_MONO}; letter-spacing: 0.02em; min-height: 48px; transition: background .15s; }
        .lt-l-cta-secondary[disabled] { opacity: 0.4; cursor: not-allowed; }
        .lt-l-cta-success { display: inline-flex; align-items: center; justify-content: center; background: ${ACCENT_GREEN}; color: ${FG_ON_DARK}; border: none; border-radius: 8px; padding: 14px 22px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: ${FONT_MONO}; letter-spacing: 0.02em; min-height: 48px; transition: background .15s, transform .15s, box-shadow .15s; box-shadow: 0 0 0 0 rgba(22,163,74,0.5); }
        .lt-l-cta-success:hover { background: ${ACCENT_GREEN_DARK}; transform: translateY(-2px); box-shadow: 0 12px 24px -8px rgba(22,163,74,0.5); }

        /* ============ CARDS ============ */
        .lt-l-card { background: ${CARD_BG}; border: 1px solid ${BORDER}; border-radius: 10px; padding: 28px; transition: transform .25s ease, box-shadow .25s ease; }
        .lt-l-card-hoverable:hover { transform: translateY(-3px); box-shadow: 0 14px 30px -12px rgba(10,10,9,0.18); }

        /* ============ TERMINAL ============ */
        .lt-l-terminal { background: ${TERMINAL_BG}; color: ${TERMINAL_FG}; border-radius: 8px; padding: 14px 16px; font-family: ${FONT_MONO}; font-size: 12px; line-height: 1.7; }
        .lt-l-terminal .ok { color: ${ACCENT_GREEN}; }
        .lt-l-terminal .warn { color: ${ACCENT_AMBER}; }
        .lt-l-terminal .red { color: ${ACCENT_RED}; }
        .lt-l-terminal .muted { color: #888578; }
        .lt-l-terminal .arrow { color: ${ACCENT_GREEN}; }
        .lt-l-terminal-line { animation: lt-l-fadeup 0.35s cubic-bezier(0.2, 0.7, 0.3, 1) both; }

        /* ============ STATUS BAR (ticker) ============ */
        .lt-l-statusbar { background: ${BG_DARK}; color: ${FG_ON_DARK}; font-family: ${FONT_MONO}; font-size: 11px; padding: 8px 0; overflow: hidden; letter-spacing: 0.02em; position: relative; }
        .lt-l-statusbar-track { display: inline-flex; align-items: center; white-space: nowrap; animation: lt-l-ticker 50s linear infinite; }
        .lt-l-statusbar-track > span { padding: 0 18px; border-right: 1px solid #2c2a25; flex-shrink: 0; }
        .lt-l-statusbar .ok { color: ${ACCENT_GREEN}; }
        .lt-l-statusbar .warn { color: ${ACCENT_AMBER}; }
        .lt-l-statusbar .red { color: ${ACCENT_RED}; }

        /* ============ NAV ============ */
        .lt-l-nav { display: flex; align-items: center; justify-content: space-between; padding: 18px 24px; max-width: 1280px; margin: 0 auto; }
        .lt-l-nav-links { display: flex; align-items: center; gap: 26px; font-family: ${FONT_MONO}; font-size: 13px; }
        .lt-l-nav-links a, .lt-l-nav-links button { color: ${FG_DARK}; text-decoration: none; background: none; border: none; cursor: pointer; font-family: ${FONT_MONO}; font-size: 13px; padding: 0; transition: color .15s; }
        .lt-l-nav-links a:hover, .lt-l-nav-links button:hover { color: ${ACCENT_GREEN}; }

        /* ============ SECTIONS ============ */
        .lt-l-section { padding: 80px 24px; }
        .lt-l-section-inner { max-width: 1280px; margin: 0 auto; }
        .lt-l-hero { padding: 60px 24px 100px 24px; }
        .lt-l-hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: center; max-width: 1280px; margin: 0 auto; }

        /* ============ MOCK DASHBOARD ============ */
        .lt-l-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 14px 0; }
        .lt-l-stat-card { background: ${CARD_BG}; border: 1px solid ${BORDER}; border-radius: 8px; padding: 12px 14px; transition: transform .2s; }
        .lt-l-stat-card:hover { transform: translateY(-2px); }
        .lt-l-stat-label { font-family: ${FONT_MONO}; font-size: 9px; letter-spacing: 0.18em; color: ${TEXT_MUTED}; text-transform: uppercase; }
        .lt-l-stat-value { font-family: ${FONT_MONO}; font-size: 24px; font-weight: 700; line-height: 1.1; margin-top: 4px; font-variant-numeric: tabular-nums; }
        .lt-l-stat-value.green { color: ${ACCENT_GREEN}; }
        .lt-l-stat-value.red { color: ${ACCENT_RED}; }

        .lt-l-urgence-banner { background: linear-gradient(90deg, #fde7e3 0%, #fce8e3 100%); border: 1px solid ${ACCENT_RED}; border-radius: 6px; padding: 10px 14px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; animation: lt-l-pulse-red 2.4s ease-in-out infinite; }
        .lt-l-urgence-arrow { color: ${ACCENT_RED}; font-size: 18px; transition: transform .25s; }
        .lt-l-urgence-banner:hover .lt-l-urgence-arrow { transform: translateX(4px); }

        /* ============ PROBLEM CARDS ============ */
        .lt-l-problem-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .lt-l-problem-card { background: ${CARD_BG}; border: 1px solid ${BORDER}; border-radius: 10px; padding: 26px; position: relative; transition: transform .25s, box-shadow .25s; }
        .lt-l-problem-card:hover { transform: translateY(-3px); box-shadow: 0 14px 30px -12px rgba(231,76,60,0.18); }
        .lt-l-problem-num { font-size: 56px; font-weight: 800; line-height: 1; letter-spacing: -0.03em; margin-bottom: 14px; font-variant-numeric: tabular-nums; }
        .lt-l-problem-num.red { color: ${ACCENT_RED}; }
        .lt-l-problem-num.amber { color: ${ACCENT_AMBER}; }
        .lt-l-problem-num.green { color: ${ACCENT_GREEN}; }
        .lt-l-problem-tag { font-family: ${FONT_MONO}; font-size: 11px; color: ${TEXT_MUTED}; letter-spacing: 0.05em; margin-bottom: 12px; }
        .lt-l-problem-text { font-size: 13px; color: ${FG_DARK}; line-height: 1.55; }
        .lt-l-problem-bang { position: absolute; top: 18px; right: 18px; font-family: ${FONT_MONO}; font-size: 10px; color: ${TEXT_MUTED}; animation: lt-l-pulse-amber 2s ease-in-out infinite; }

        /* ============ SOLUTION CARDS ============ */
        .lt-l-solution-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .lt-l-fn-card { background: ${CARD_BG}; border: 1px solid ${BORDER}; border-radius: 10px; padding: 26px; transition: transform .25s, box-shadow .25s; }
        .lt-l-fn-card:hover { transform: translateY(-3px); box-shadow: 0 14px 30px -12px rgba(22,163,74,0.18); }
        .lt-l-fn-head { display: flex; justify-content: space-between; align-items: center; font-family: ${FONT_MONO}; font-size: 11px; color: ${TEXT_MUTED}; letter-spacing: 0.1em; margin-bottom: 14px; }
        .lt-l-fn-head .active { color: ${ACCENT_GREEN}; position: relative; padding-left: 12px; }
        .lt-l-fn-head .active::before { content: ''; position: absolute; left: 0; top: 50%; width: 6px; height: 6px; border-radius: 50%; background: ${ACCENT_GREEN}; transform: translateY(-50%); animation: lt-l-pulse-green 1.6s ease-in-out infinite; box-shadow: 0 0 6px ${ACCENT_GREEN}; }
        .lt-l-fn-title { font-size: 22px; font-weight: 700; letter-spacing: -0.015em; margin: 0 0 10px 0; }
        .lt-l-fn-desc { font-size: 13px; line-height: 1.55; color: ${TEXT_MUTED}; margin-bottom: 18px; }

        /* ============ TABLE ============ */
        .lt-l-table { width: 100%; border-collapse: separate; border-spacing: 0; background: ${CARD_BG}; border: 1px solid ${BORDER}; border-radius: 10px; overflow: hidden; }
        .lt-l-table th { background: ${BG_DARK}; color: ${FG_ON_DARK}; font-family: ${FONT_MONO}; font-size: 11px; letter-spacing: 0.15em; text-transform: lowercase; text-align: left; padding: 14px 18px; font-weight: 600; }
        .lt-l-table td { padding: 16px 18px; font-size: 13px; line-height: 1.5; border-top: 1px solid ${BORDER}; vertical-align: top; transition: background .15s; }
        .lt-l-table tr:hover td { background: #fafaf6; }
        .lt-l-table tr:hover td:nth-child(3) { background: #d8efd8; }
        .lt-l-table td:first-child { font-weight: 600; color: ${FG_DARK}; width: 28%; }
        .lt-l-table td:nth-child(2) { color: ${TEXT_MUTED}; font-family: ${FONT_MONO}; font-size: 12px; }
        .lt-l-table td:nth-child(3) { color: ${ACCENT_GREEN_DARK}; font-family: ${FONT_MONO}; font-size: 12px; background: #ecf7ee; }

        /* ============ FAQ ============ */
        .lt-l-faq-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .lt-l-faq-card { background: ${CARD_BG}; border: 1px solid ${BORDER}; border-radius: 10px; padding: 22px; transition: transform .2s, box-shadow .2s; }
        .lt-l-faq-card:hover { transform: translateY(-2px); box-shadow: 0 10px 22px -10px rgba(10,10,9,0.18); border-color: ${ACCENT_GREEN}; }
        .lt-l-faq-q { font-family: ${FONT_MONO}; font-size: 11px; letter-spacing: 0.1em; color: ${ACCENT_GREEN}; margin-bottom: 10px; }
        .lt-l-faq-title { font-size: 16px; font-weight: 700; margin: 0 0 8px 0; line-height: 1.35; }
        .lt-l-faq-text { font-size: 13px; line-height: 1.55; color: ${TEXT_MUTED}; }

        /* ============ FINAL CTA (dark) ============ */
        .lt-l-final { background: radial-gradient(ellipse at top, #1a1816 0%, ${BG_DARK} 60%); padding: 80px 24px; position: relative; }
        .lt-l-final-h2 { color: ${FG_ON_DARK}; font-size: clamp(34px, 5vw, 56px); line-height: 1.1; font-weight: 800; letter-spacing: -0.025em; margin: 0; }
        .lt-l-final-h2 .muted { color: #5a574d; }
        .lt-l-final-h2 .red { color: ${ACCENT_RED}; animation: lt-l-glow-red 3s ease-in-out infinite; display: inline-block; }

        /* ============ FOOTER ============ */
        .lt-l-footer-meta { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; max-width: 1280px; margin: 0 auto; font-family: ${FONT_MONO}; font-size: 11px; color: ${TEXT_MUTED}; letter-spacing: 0.05em; }
        .lt-l-footer { padding: 24px; max-width: 1280px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; font-family: ${FONT_MONO}; font-size: 12px; color: ${TEXT_MUTED}; }
        .lt-l-footer a, .lt-l-footer button { color: ${TEXT_MUTED}; text-decoration: none; background: none; border: none; cursor: pointer; font-family: ${FONT_MONO}; font-size: 12px; padding: 0; transition: color .15s; }
        .lt-l-footer a:hover, .lt-l-footer button:hover { color: ${FG_DARK}; }

        /* ============ RESPONSIVE ============ */
        @media (max-width: 900px) {
          .lt-l-hero-grid { grid-template-columns: 1fr; gap: 36px; }
          .lt-l-problem-grid { grid-template-columns: 1fr; }
          .lt-l-solution-grid { grid-template-columns: 1fr; }
          .lt-l-faq-grid { grid-template-columns: 1fr; }
          .lt-l-section { padding: 60px 20px; }
          .lt-l-hero { padding: 40px 20px 70px 20px; }
          .lt-l-final { padding: 60px 20px; }
          .lt-l-nav-links a:nth-child(-n+4) { display: none; }
          .lt-l-table { font-size: 12px; }
          .lt-l-table td { padding: 12px 10px; font-size: 12px; }
          .lt-l-statusbar-track { animation-duration: 35s; }
        }
        @media (max-width: 480px) {
          .lt-l-statusbar { font-size: 10px; padding: 6px 0; }
          .lt-l-nav { padding: 14px 16px; }
          .lt-l-problem-num { font-size: 44px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .lt-l-statusbar-track, .lt-l-cursor::after, .lt-l-blink-dot, .lt-l-blink-red, .lt-l-blink-amber,
          .lt-l-fadeup, .lt-l-fadeup-d1, .lt-l-fadeup-d2, .lt-l-fadeup-d3, .lt-l-fadeup-d4,
          .lt-l-eyebrow::before, .lt-l-fn-head .active::before, .lt-l-urgence-banner,
          .lt-l-final-h2 .red, .lt-l-problem-bang, .lt-l-terminal-line {
            animation: none !important;
          }
        }
      `}</style>

      {/* === STATUS BAR (ticker continu) === */}
      <div className="lt-l-statusbar">
        <div className="lt-l-statusbar-track">
          {/* Duplique 2x pour boucler sans coupure */}
          {[0, 1].map(function (k) { return (
            <span key={k} style={{ display: 'inline-flex', alignItems: 'center' }}>
              <span style={{ padding: '0 18px', borderRight: '1px solid #2c2a25' }}><span className="ok lt-l-blink-dot">●</span> PORT DKR · OPERATIONNEL</span>
              <span style={{ padding: '0 18px', borderRight: '1px solid #2c2a25' }}><span className="warn lt-l-blink-amber">⚠</span> 3 SURESTARIES J-2</span>
              <span style={{ padding: '0 18px', borderRight: '1px solid #2c2a25' }}>SYNC DPWORLD · <span className="ok">OK</span></span>
              <span style={{ padding: '0 18px', borderRight: '1px solid #2c2a25' }}>47 TRANSITAIRES CONNECTES</span>
              <span style={{ padding: '0 18px', borderRight: '1px solid #2c2a25' }}><span className="lt-l-blink-red">●</span> MAEU3718506 RETOUR VIDE J-2</span>
              <span style={{ padding: '0 18px', borderRight: '1px solid #2c2a25' }}>FCFA · MAIN</span>
            </span>
          ); })}
        </div>
      </div>

      {/* === NAV === */}
      <nav className="lt-l-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SapuraiLogo size={32} />
          <span style={{ fontFamily: FONT_MONO, fontSize: 16, fontWeight: 700 }}>sapurai</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: TEXT_MUTED, background: '#ebe5d3', padding: '3px 7px', borderRadius: 4, letterSpacing: '0.05em' }}>v3.0 · prod</span>
        </div>
        <div className="lt-l-nav-links">
          <a href="#produit">produit</a>
          <a href="#architecture">architecture</a>
          <a href="#faq">docs</a>
          <a href="#tracking">tracking</a>
          <button onClick={goLogin}>$ login</button>
          <button onClick={goRegister} className="lt-l-cta-primary" style={{ padding: '10px 16px', minHeight: 40 }}>essayer 30j →</button>
        </div>
      </nav>

      {/* === HERO === */}
      <section className="lt-l-hero" ref={heroInView.ref}>
        <div className="lt-l-hero-grid">
          <div>
            <div className="lt-l-eyebrow lt-l-fadeup">specialise transitaires dakar · v3.0</div>
            <h1 className="lt-l-h1 lt-l-fadeup-d1">
              Gerez vos transits sans jamais oublier <span style={{ color: ACCENT_RED, position: 'relative', display: 'inline-block' }}>une surestarie.</span>
            </h1>
            <div className="lt-l-terminal lt-l-fadeup-d2" style={{ marginBottom: 28, maxWidth: 460 }}>
              {heroShown >= 1 && <div className="lt-l-terminal-line"><span className="muted">$</span> sapurai --status</div>}
              {heroShown >= 2 && <div className="lt-l-terminal-line"><span className="arrow">►</span> sync_dpworld <span className="muted">.....</span> <span className="ok">OK</span></div>}
              {heroShown >= 3 && <div className="lt-l-terminal-line"><span className="arrow">►</span> alertes_surestaries <span className="muted">.</span> <span className="ok">OK</span> <span className="muted">·</span> J-3 actif</div>}
              {heroShown >= 4 && <div className="lt-l-terminal-line"><span className="arrow">►</span> tracking_whatsapp <span className="muted">...</span> <span className="ok">OK</span> <span className="muted">·</span> 12 liens actifs</div>}
              {heroShown >= 5 && <div className="lt-l-terminal-line"><span className="arrow">►</span> dispatch <span className="muted">.............</span> 3 conteneurs en transit<span className="lt-l-cursor"></span></div>}
              {heroShown < 5 && <div style={{ visibility: 'hidden' }}>placeholder</div>}
            </div>
            <div className="lt-l-fadeup-d3" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button className="lt-l-cta-primary" onClick={goRegister}>essayer 30j gratuit →</button>
              <button className="lt-l-cta-secondary" disabled onClick={comingSoon} title="Bientot disponible">voir-demo</button>
            </div>
            <div className="lt-l-fadeup-d4" style={{ marginTop: 14, fontFamily: FONT_MONO, fontSize: 11, color: TEXT_MUTED }}>pas de cb · deployable en 10 minutes</div>
          </div>

          {/* Mock dashboard a droite */}
          <div className="lt-l-card lt-l-fadeup-d2" style={{ padding: 0, overflow: 'hidden', boxShadow: '0 24px 60px -20px rgba(0,0,0,0.3)' }}>
            <div style={{ background: TERMINAL_BG, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f56', display: 'inline-block' }} />
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e', display: 'inline-block' }} />
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#27c93f', display: 'inline-block' }} />
              </div>
              <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: TERMINAL_FG, flex: 1, textAlign: 'center' }}>demo-transit-sarl@sapurai:~$</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: TEXT_MUTED }}>2026-04-29 14:32</span>
            </div>
            <div style={{ padding: 18 }}>
              <div className="lt-l-urgence-banner">
                <div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: ACCENT_RED, letterSpacing: '0.1em', marginBottom: 2 }}>3 URGENCES_CRITIQUES</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT_RED }}>Surestaries depassees</div>
                </div>
                <span className="lt-l-urgence-arrow">→</span>
              </div>
              <div className="lt-l-stats">
                <div className="lt-l-stat-card">
                  <div className="lt-l-stat-label">DOSSIERS</div>
                  <div className="lt-l-stat-value green">{dosCount}</div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: TEXT_MUTED }}>actifs</div>
                </div>
                <div className="lt-l-stat-card">
                  <div className="lt-l-stat-label">TC</div>
                  <div className="lt-l-stat-value">{tcCount}</div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: TEXT_MUTED }}>en_cours</div>
                </div>
                <div className="lt-l-stat-card">
                  <div className="lt-l-stat-label">IMPAYES</div>
                  <div className="lt-l-stat-value red">{impayesCount}k</div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: TEXT_MUTED }}>FCFA</div>
                </div>
              </div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: TEXT_MUTED, letterSpacing: '0.1em', marginTop: 14, marginBottom: 8 }}>URGENCES</div>
              <UrgenceRow code="MSCU4821739" client="client_a" tag="Surestaries +3j" delay={0} />
              <UrgenceRow code="CMAU6094287" client="client_b" tag="BAE manquant" delay={120} />
              <UrgenceRow code="MAEU3718506" client="client_c" tag="Retour vide J-2" delay={240} last />
            </div>
          </div>
        </div>
      </section>

      {/* === LE PROBLEME === */}
      <section className="lt-l-section" id="produit" ref={problemInView.ref} style={{ background: '#efe9d6' }}>
        <div className="lt-l-section-inner">
          <div className={'lt-l-eyebrow' + (problemInView.inView ? ' lt-l-fadeup' : '')} style={{ opacity: problemInView.inView ? undefined : 0 }}>le_probleme</div>
          <h2 className={'lt-l-h2' + (problemInView.inView ? ' lt-l-fadeup-d1' : '')} style={{ maxWidth: 900, opacity: problemInView.inView ? undefined : 0 }}>
            Vous perdez de l'argent a chaque dossier <span style={{ color: ACCENT_RED }}>que vous ne suivez pas assez pres.</span>
          </h2>
          <div className="lt-l-problem-grid" style={{ marginTop: 36 }}>
            {problemInView.inView && <ProblemCard delay="d2" color="red" big={num200k + 'k'} tag="FCFA / TC perdu" text="Une surestarie oubliee = 75 a 200k FCFA de pertes par conteneur. Multiplie par 2-3 TC/mois = salaire d'un agent." />}
            {problemInView.inView && <ProblemCard delay="d3" color="amber" big="3-5×" tag="appels_client / dossier" text="« Ou est mon conteneur ? » L'agent passe son temps au telephone au lieu de gerer." />}
            {problemInView.inView && <ProblemCard delay="d4" color="green" big={num30 + '+'} tag="dossiers = debordement" text="Au-dela, impossible de savoir quel dossier est urgent. Le cahier deborde, l'Excel se perd, WhatsApp se noie." />}
          </div>
        </div>
      </section>

      {/* === LA SOLUTION === */}
      <section className="lt-l-section" id="architecture" ref={solutionInView.ref}>
        <div className="lt-l-section-inner">
          <div className={'lt-l-eyebrow' + (solutionInView.inView ? ' lt-l-fadeup' : '')} style={{ opacity: solutionInView.inView ? undefined : 0 }}>la_solution</div>
          <h2 className={'lt-l-h2' + (solutionInView.inView ? ' lt-l-fadeup-d1' : '')} style={{ maxWidth: 900, opacity: solutionInView.inView ? undefined : 0 }}>
            4 fonctionnalites. <span style={{ color: ACCENT_GREEN }}>1 changement de metier.</span>
          </h2>
          <p className={'lt-l-sub' + (solutionInView.inView ? ' lt-l-fadeup-d2' : '')} style={{ opacity: solutionInView.inView ? undefined : 0 }}>pas une plateforme de plus qui enregistre — un systeme qui alerte, coordonne, et rend l'action inevitable</p>
          <div className="lt-l-solution-grid" style={{ marginTop: 28 }}>
            <FnCard delay="d2" tag="FN_01" title="Sync DPWorld 1 clic" desc="Statut BAD, BAE, Pregate recupere automatiquement. Plus besoin d'ouvrir 3 onglets." inView={solutionInView.inView}>
              <div><span className="muted">$</span> sapurai sync --bl DKR-2026-5028</div>
              <div><span className="ok">✓</span> BAD <span className="muted">........</span> OK</div>
              <div><span className="ok">✓</span> BAE <span className="muted">........</span> OK</div>
              <div><span className="ok">✓</span> Pregate <span className="muted">....</span> 4521-DK<span className="lt-l-cursor"></span></div>
            </FnCard>
            <FnCard delay="d3" tag="FN_02" title="Alertes franchises auto" desc="Magasinage, surestaries, detention : calcul en temps reel. Alerte J-3 avant l'expiration." inView={solutionInView.inView}>
              <div>[CMAU5729014] port: {Math.round(progress / 10)}j / 10</div>
              <div>
                {'['}
                <span style={{ color: ACCENT_AMBER, display: 'inline-block', width: Math.round(progress * 0.12) + 'ch', overflow: 'hidden', verticalAlign: 'bottom' }}>
                  ██████████
                </span>
                <span className="muted" style={{ display: 'inline-block', width: (10 - Math.round(progress * 0.1)) + 'ch', overflow: 'hidden', verticalAlign: 'bottom' }}>░░░░░░░░░░</span>
                {'] ' + Math.round(progress) + '%'}
              </div>
              <div><span className="warn lt-l-blink-amber">⚠</span> alert J-2 <span className="arrow">→</span> notify_user()</div>
            </FnCard>
            <FnCard delay="d4" tag="FN_03" title="Tracking WhatsApp" desc="Un lien partageable par conteneur. Vos clients voient l'etat en temps reel sans vous appeler." inView={solutionInView.inView}>
              <div><span className="muted">GET</span> sapurai.app/t/a7f9 <span className="muted">.</span></div>
              <div><span className="arrow">→</span> status: <span className="ok">en_transit</span></div>
              <div><span className="arrow">→</span> ETA: kati 14h32</div>
              <div><span className="arrow">→</span> share via whatsapp <span className="ok">✓</span></div>
            </FnCard>
            <FnCard delay="d4" tag="FN_04" title="Dispatch + parcours" desc="Chauffeur, camion, avance, suivi par etapes du port a la destination finale. Tracabilite totale." inView={solutionInView.inView}>
              <div>[Port]<span className="ok">✓</span> <span className="arrow">→</span> [Transit]<span className="ok">✓</span> <span className="arrow">→</span> [Kati]<span className="ok">✓</span> <span className="arrow">→</span> [Dest]<span className="muted">·</span></div>
              <div>driver: M.Diop <span className="muted">·</span> DK-4528-A</div>
              <div>avance: 250k <span className="muted">·</span> solde: 75k</div>
            </FnCard>
          </div>
        </div>
      </section>

      {/* === CE QUI CHANGE (tableau) === */}
      <CompareSection />

      {/* === FAQ === */}
      <FaqSection />

      {/* === CTA FINAL (fond noir) === */}
      <div className="lt-l-footer-meta" style={{ background: BG_DARK, color: TEXT_MUTED, maxWidth: '100%' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', width: '100%', display: 'flex', justifyContent: 'space-between', padding: '0 0' }}>
          <span>in_logistics</span>
          <span>EOF · 2026-04-29</span>
        </div>
      </div>
      <section className="lt-l-final">
        <div className="lt-l-section-inner" style={{ textAlign: 'center', maxWidth: 900 }}>
          <div className="lt-l-eyebrow red" style={{ justifyContent: 'center', display: 'inline-flex' }}>en logistique</div>
          <h2 className="lt-l-final-h2" style={{ marginTop: 14 }}>
            Le probleme n'est pas <span className="muted">ce qu'on ne sait pas.</span>
            <br />
            <span className="red">C'est ce qu'on sait... mais trop tard.</span>
          </h2>
          <p className="lt-l-sub on-dark" style={{ margin: '24px auto 32px auto', textAlign: 'center', maxWidth: 600 }}>
            Pret a recuperer vos surestaries ? Essayez 30 jours gratuitement. Si Sapurai ne vous fait pas economiser plus que son prix, on arrete la.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="lt-l-cta-success" onClick={goRegister}>demarrer-gratuit →</button>
            <a href={WA_URL} target="_blank" rel="noopener noreferrer" className="lt-l-cta-primary" style={{ textDecoration: 'none', background: '#1c1917' }}>whatsapp</a>
          </div>
        </div>
      </section>

      {/* === FOOTER === */}
      <footer style={{ background: BG_CREAM, borderTop: '1px solid ' + BORDER }}>
        <div className="lt-l-footer">
          <div>sapurai/transit · gestion de transit international · dakar, senegal</div>
          <div style={{ display: 'flex', gap: 22 }}>
            <a href={'mailto:' + EMAIL}>email</a>
            <a href={WA_URL} target="_blank" rel="noopener noreferrer">whatsapp</a>
            <button onClick={goLogin}>$ login</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

// === Sous-composants ===

function UrgenceRow(p: { code: string; client: string; tag: string; last?: boolean; delay?: number }) {
  return (
    <div className="lt-l-fadeup" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: p.last ? 'none' : '1px solid ' + BORDER, fontFamily: FONT_MONO, fontSize: 12, animationDelay: (p.delay || 0) + 'ms' }}>
      <div>
        <div style={{ color: ACCENT_RED, fontWeight: 700 }}>{p.code}</div>
        <div style={{ color: TEXT_MUTED, fontSize: 10 }}>{p.client}</div>
      </div>
      <span style={{ background: '#fde7e3', color: ACCENT_RED, padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600 }}>{p.tag}</span>
    </div>
  );
}

function ProblemCard(p: { color: 'red' | 'amber' | 'green'; big: string; tag: string; text: string; delay?: string }) {
  return (
    <div className={'lt-l-problem-card lt-l-fadeup-' + (p.delay || 'd1')}>
      <span className="lt-l-problem-bang">[!]</span>
      <div className={'lt-l-problem-num ' + p.color}>{p.big}</div>
      <div className="lt-l-problem-tag">{p.tag}</div>
      <div className="lt-l-problem-text">{p.text}</div>
    </div>
  );
}

function FnCard(p: { tag: string; title: string; desc: string; children?: React.ReactNode; delay?: string; inView?: boolean }) {
  return (
    <div className={'lt-l-fn-card' + (p.inView ? ' lt-l-fadeup-' + (p.delay || 'd1') : '')} style={{ opacity: p.inView === false ? 0 : undefined }}>
      <div className="lt-l-fn-head">
        <span>{p.tag}</span>
        <span className="active">active</span>
      </div>
      <h3 className="lt-l-fn-title">{p.title}</h3>
      <div className="lt-l-fn-desc">{p.desc}</div>
      <div className="lt-l-terminal">{p.children}</div>
    </div>
  );
}

function CompareSection() {
  var view = useInView<HTMLDivElement>();
  return (
    <section className="lt-l-section" ref={view.ref} style={{ background: '#efe9d6' }}>
      <div className="lt-l-section-inner">
        <div className={'lt-l-eyebrow amber' + (view.inView ? ' lt-l-fadeup' : '')} style={{ opacity: view.inView ? undefined : 0 }}>ce_qui_change</div>
        <h2 className={'lt-l-h2' + (view.inView ? ' lt-l-fadeup-d1' : '')} style={{ maxWidth: 1000, opacity: view.inView ? undefined : 0 }}>
          Ce que Sapurai fait — et que <span style={{ color: ACCENT_AMBER }}>cahier / Excel / WhatsApp</span> ne peuvent pas faire.
        </h2>
        <p className={'lt-l-sub' + (view.inView ? ' lt-l-fadeup-d2' : '')} style={{ maxWidth: 800, opacity: view.inView ? undefined : 0 }}>
          Le cahier et Excel marchent. Jusqu'a un certain volume. WhatsApp est pratique mais les infos s'y perdent. Sapurai reprend ces outils que vous connaissez deja, et fait ce qu'ils ne savent pas faire.
        </p>
        <div className={view.inView ? 'lt-l-fadeup-d3' : ''} style={{ overflowX: 'auto', marginTop: 28, opacity: view.inView ? undefined : 0 }}>
          <table className="lt-l-table">
            <thead>
              <tr><th>task</th><th>legacy</th><th>sapurai</th></tr>
            </thead>
            <tbody>
              <CompareRow t="Calculer les jours de surestaries restants par TC" l="A la main, sur chaque ligne" s="→ Calcul automatique + alerte J-3 / J-0" />
              <CompareRow t="Savoir ou en est mon dossier sur DPWorld (BAD, BAE, Pregate)" l="Ouvrir le portail, noter a la main" s="→ Sync 1 clic, remonte dans l'app" />
              <CompareRow t="Repondre au client qui demande ou est son conteneur" l="Message WhatsApp a chaque appel" s="→ Lien partageable, il voit lui-meme en temps reel" />
              <CompareRow t="Retrouver un dossier d'il y a 3 mois" l="Feuilleter le cahier ou chercher dans Excel" s="→ Recherche instantanee multi-critere" />
              <CompareRow t="Travailler a 2 agents sur les memes dossiers" l="Conflits, fichier verrouille, duplications" s="→ Temps reel, chacun voit les modifs de l'autre" />
              <CompareRow t="Suivre les chauffeurs entre port et destination" l="WhatsApp individuel par chauffeur" s="→ Parcours par etapes, budget, versements" />
              <CompareRow t="Savoir quelles cautions sont bloquees, a recuperer" l="Memoriser ou noter quelque part" s="→ Tableau cautions + alertes fin de contrat" />
              <CompareRow t="Travailler meme sans reseau" l="Cahier = oui, Excel = oui, WhatsApp = queue" s="→ Mode hors ligne, sync au retour" />
            </tbody>
          </table>
        </div>
        <p style={{ fontFamily: FONT_MONO, fontSize: 12, color: TEXT_MUTED, marginTop: 18, fontStyle: 'italic' }}>
          pas besoin de tout abandonner — beaucoup gardent whatsapp pour discuter chauffeurs et clients · sapurai s'occupe du reste
        </p>
      </div>
    </section>
  );
}

function CompareRow(p: { t: string; l: string; s: string }) {
  return (
    <tr>
      <td>{p.t}</td>
      <td>{p.l}</td>
      <td>{p.s}</td>
    </tr>
  );
}

function FaqSection() {
  var view = useInView<HTMLDivElement>();
  return (
    <section className="lt-l-section" id="faq" ref={view.ref}>
      <div className="lt-l-section-inner">
        <div className={'lt-l-eyebrow' + (view.inView ? ' lt-l-fadeup' : '')} style={{ opacity: view.inView ? undefined : 0 }}>faq</div>
        <h2 className={'lt-l-h2' + (view.inView ? ' lt-l-fadeup-d1' : '')} style={{ opacity: view.inView ? undefined : 0 }}>Questions frequentes</h2>
        <div className="lt-l-faq-grid" style={{ marginTop: 28 }}>
          {view.inView && <FaqCard delay="d2" q="Q.01" title="Combien de temps pour installer Sapurai ?" text="10 minutes. Vous creez un compte, vous importez votre Excel (optionnel), vous etes operationnel. Pas d'integrateur, pas de formation obligatoire." />}
          {view.inView && <FaqCard delay="d2" q="Q.02" title="Est-ce que ca fonctionne hors ligne ?" text="Oui. Sapurai est une PWA avec cache local Firestore. Vos agents peuvent travailler dans les zones 3G instables et tout se synchronise au retour." />}
          {view.inView && <FaqCard delay="d3" q="Q.03" title="Mes donnees restent-elles confidentielles ?" text="Oui. Hebergement Firebase Google Cloud. Chaque entreprise a son espace isole. Nous ne sommes PAS transitaires — vos donnees ne sont accessibles a personne d'autre que vous." />}
          {view.inView && <FaqCard delay="d3" q="Q.04" title="Je peux essayer avant de m'engager ?" text="30 jours d'essai gratuit sur toutes les fonctionnalites. Pas de carte bancaire demandee. Resiliable a tout moment par la suite." />}
          {view.inView && <FaqCard delay="d4" q="Q.05" title="Combien ca coute ?" text="Nos tarifs sont personnalises selon votre volume de dossiers. Contactez-nous pour un devis en moins de 24h (WhatsApp ou email)." />}
          {view.inView && <FaqCard delay="d4" q="Q.06" title="Support disponible si on a un probleme ?" text="Support WhatsApp et email directement avec l'equipe Sapurai. Reponse sous 4h en journee ouvrable." />}
        </div>
      </div>
    </section>
  );
}

function FaqCard(p: { q: string; title: string; text: string; delay?: string }) {
  return (
    <div className={'lt-l-faq-card lt-l-fadeup-' + (p.delay || 'd1')}>
      <div className="lt-l-faq-q">{p.q}</div>
      <h3 className="lt-l-faq-title">{p.title}</h3>
      <div className="lt-l-faq-text">{p.text}</div>
    </div>
  );
}
