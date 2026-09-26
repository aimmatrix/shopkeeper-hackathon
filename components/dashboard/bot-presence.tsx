'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import s from './bot-presence.module.css';

/** What a bot is doing right now. Each mood has its own body shape, so the avatar morphs as the conversation moves. */
export type Mood = 'idle' | 'thinking' | 'typing' | 'waiting' | 'done' | 'paused' | 'error';

/**
 * A body shape is a circle bent by six harmonics (k = 1..6). Because every mood uses the same recipe,
 * any shape can morph smoothly into any other.
 */
type Pose = {
  a: number[];                       // harmonic amplitudes, k = 1..6
  sx: number; sy: number; dy: number; // stretch and vertical shift of the body
  ex: number; ey: number; eye: number; // where the eyes look, and how open they are (1 = open)
  bob: number; breathe: number; spin: number; sway: number;
};

const POSES: Record<Mood, Pose> = {
  idle:     { a: [0.03, 0.05, 0, 0, 0, 0],     sx: 1.02, sy: 0.97, dy: 0,   ex: 0,    ey: 0,    eye: 1,    bob: 0,   breathe: 1,   spin: 0,   sway: 0 },
  thinking: { a: [-0.03, 0.04, 0, 0, 0, 0.075], sx: 1.1,  sy: 0.9,  dy: 0,   ex: 1.4,  ey: -1.6, eye: 0.9,  bob: 0,   breathe: 0.4, spin: 0.9, sway: 0 },
  typing:   { a: [0, 0.14, 0, 0.05, 0, 0],     sx: 1.06, sy: 0.86, dy: 1,   ex: 0.8,  ey: 0.2,  eye: 1,    bob: 1,   breathe: 0,   spin: 0,   sway: 0 },
  waiting:  { a: [0, -0.04, 0, 0.06, 0, 0],    sx: 0.96, sy: 1.05, dy: -0.5, ex: -1.6, ey: 1.2,  eye: 1,    bob: 0,   breathe: 0.6, spin: 0,   sway: 1 },
  done:     { a: [0, 0, 0, 0, 0.07, 0],        sx: 1.03, sy: 1,    dy: -0.5, ex: 0,    ey: -0.8, eye: 0.35, bob: 0.8, breathe: 0,   spin: 0,   sway: 0 },
  paused:   { a: [-0.02, 0.12, 0, 0, 0, 0],    sx: 1.12, sy: 0.66, dy: 4.5, ex: 0,    ey: 3.2,  eye: 0.12, bob: 0,   breathe: 0.5, spin: 0,   sway: 0 },
  error:    { a: [0, 0, 0.15, 0, 0, 0],        sx: 1,    sy: 1,    dy: 0.5, ex: -0.4, ey: 2.2,  eye: 0.85, bob: 0,   breathe: 0,   spin: 0,   sway: 0 },
};
/** A bot's resting shape, like the different bot faces in GrokBot's sidebar. Any mood other than idle takes over while it lasts. */
export type Shape = 'blob' | 'circle' | 'pill' | 'hexagon' | 'triangle' | 'cloud';
const SHAPES: Record<Shape, Pose> = {
  blob: POSES.idle,
  circle: { ...POSES.idle, a: [0, 0, 0, 0, 0, 0], sx: 1, sy: 1 },
  pill: { ...POSES.idle, a: [0, 0.16, 0, 0.06, 0, 0], sx: 1.14, sy: 0.78 },
  hexagon: { ...POSES.idle, a: [0, 0, 0, 0, 0, 0.055], sx: 1.02, sy: 1 },
  triangle: { ...POSES.idle, a: [0, 0, 0.15, 0, 0, 0], ey: 2.2 },
  cloud: { ...POSES.idle, a: [-0.03, 0.04, 0, 0, 0, 0.075], sx: 1.1, sy: 0.9 },
};
const poseFor = (mood: Mood, shape: Shape) => mood === 'idle' ? SHAPES[shape] : POSES[mood];

// Fixed phase per harmonic: k=1 weights the bottom, k=3 points a corner up, k=4 puts corners on the diagonals, k=5 puts a petal on top.
const PHASE = [Math.PI / 2, 0, Math.PI / 2, Math.PI, -Math.PI / 2, 0];
const R = 13, CX = 20, CY = 21, POINTS = 40;
const EYES = [[1.5, -2], [7.5, -2.6]];
const KEYS = ['sx', 'sy', 'dy', 'ex', 'ey', 'eye', 'bob', 'breathe', 'spin', 'sway'] as const;

const copy = (p: Pose): Pose => ({ ...p, a: [...p.a] });
const fixed = (n: number) => n.toFixed(2);

type Frame = { d: string; eyes: { cx: string; cy: string; ry: string }[]; rotate: string };

/** Draw one frame. `t` is seconds since mount, `spun` the accumulated cloud rotation, `burst` 1→0 just after a mood change. */
function draw(p: Pose, t: number, spun: number, burst: number, blink: number, mood: Mood): Frame {
  const hop = p.bob * (mood === 'done' ? burst : 1) * Math.abs(Math.sin(t * Math.PI * 2.6));
  const breath = p.breathe * Math.sin(t * 1.7);
  const sx = p.sx * (1 - 0.03 * hop - 0.012 * breath);
  const sy = p.sy * (1 + 0.04 * hop + 0.018 * breath);
  const x0 = CX + (mood === 'error' ? 1.6 * Math.sin(t * 42) * burst : 0);
  const y0 = CY + p.dy - 1.6 * hop;
  const pts: [number, number][] = [];
  for (let i = 0; i < POINTS; i++) {
    const th = (i / POINTS) * Math.PI * 2;
    let r = 1;
    for (let k = 1; k <= 6; k++) r += p.a[k - 1] * Math.cos(k * th - PHASE[k - 1] - (k === 6 ? spun : 0));
    pts.push([x0 + R * r * Math.cos(th) * sx, y0 + R * r * Math.sin(th) * sy]);
  }
  // Closed Catmull-Rom spline through the points, written as cubic Béziers.
  const at = (i: number) => pts[(i + POINTS) % POINTS];
  let d = `M${fixed(pts[0][0])} ${fixed(pts[0][1])}`;
  for (let i = 0; i < POINTS; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    d += `C${fixed(p1[0] + (p2[0] - p0[0]) / 6)} ${fixed(p1[1] + (p2[1] - p0[1]) / 6)} ${fixed(p2[0] - (p3[0] - p1[0]) / 6)} ${fixed(p2[1] - (p3[1] - p1[1]) / 6)} ${fixed(p2[0])} ${fixed(p2[1])}`;
  }
  const eyes = EYES.map(([ox, oy]) => ({ cx: fixed(x0 + ox * sx + p.ex), cy: fixed(y0 + oy * sy + p.ey), ry: fixed(Math.max(0.25, 2.6 * p.eye * blink)) }));
  return { d: d + 'Z', eyes, rotate: `rotate(${fixed(p.sway * 4 * Math.sin(t * 1.3))} ${CX} ${CY})` };
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * GrokBot-style bot avatar: a coloured blob with two eyes that changes shape with its mood
 * (round when idle, a churning cloud when thinking, a bouncing pill when typing, a triangle on errors…).
 * `still` draws the shape without motion; reduced-motion users always get the still version.
 */
export function BotAvatar({ mood = 'idle', shape = 'blob', size = 28, color = '#F8C642', still = false, inline = false, className }: {
  mood?: Mood; shape?: Shape; size?: number; color?: string; still?: boolean; inline?: boolean; className?: string;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const moodRef = useRef(mood);
  const shapeRef = useRef(shape);
  const changedAt = useRef(0);
  const initial = useMemo(() => draw(poseFor(mood, shape), 0, 0, 0, 1, mood), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { moodRef.current = mood; changedAt.current = performance.now(); }, [mood]);
  useEffect(() => { shapeRef.current = shape; }, [shape]);

  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const body = el.querySelector('path')!, group = el.querySelector('g')!, eyes = [...el.querySelectorAll('ellipse')];
    const paint = (f: Frame) => {
      body.setAttribute('d', f.d);
      group.setAttribute('transform', f.rotate);
      f.eyes.forEach((e, i) => { eyes[i].setAttribute('cx', e.cx); eyes[i].setAttribute('cy', e.cy); eyes[i].setAttribute('ry', e.ry); });
    };
    if (still || reducedMotion()) {
      paint(draw(poseFor(mood, shape), 0, 0, 0, 1, mood));
      return;
    }
    const cur = copy(poseFor(moodRef.current, shapeRef.current));
    const offset = Math.random() * 10; // desynchronise avatars that share a mood
    let frame = 0, last = performance.now(), spun = 0, nextBlink = last + 1500 + Math.random() * 3000, visible = true;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const target = poseFor(moodRef.current, shapeRef.current);
      const ease = 1 - Math.exp(-dt * 9);
      cur.a = cur.a.map((v, i) => v + (target.a[i] - v) * ease);
      for (const k of KEYS) cur[k] += (target[k] - cur[k]) * ease;
      spun += cur.spin * dt;
      // A blink closes and reopens the eyes over 140ms, every few seconds, whenever they're fully open.
      if (now > nextBlink + 140) nextBlink = now + 2500 + Math.random() * 3500;
      const into = now - nextBlink;
      const blink = target.eye > 0.8 && into >= 0 ? Math.abs(into - 70) / 70 : 1;
      const burst = Math.max(0, 1 - (now - changedAt.current) / (moodRef.current === 'done' ? 1400 : 600));
      paint(draw(cur, now / 1000 + offset, spun, burst, blink, moodRef.current));
      frame = visible ? requestAnimationFrame(tick) : 0;
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !frame) { last = performance.now(); frame = requestAnimationFrame(tick); }
    });
    io.observe(el);
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); io.disconnect(); };
  }, [still]); // eslint-disable-line react-hooks/exhaustive-deps

  // Still avatars redraw only when their mood changes.
  useEffect(() => {
    if (!(still || reducedMotion())) return;
    const el = svg.current;
    if (!el) return;
    const f = draw(poseFor(mood, shape), 0, 0, 0, 1, mood);
    el.querySelector('path')!.setAttribute('d', f.d);
    el.querySelectorAll('ellipse').forEach((e, i) => { e.setAttribute('cx', f.eyes[i].cx); e.setAttribute('cy', f.eyes[i].cy); e.setAttribute('ry', f.eyes[i].ry); });
  }, [mood, shape, still]);

  return <svg ref={svg} className={[s.avatar, inline && s.inline, className].filter(Boolean).join(' ')} width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
    <g transform={initial.rotate}>
      <path d={initial.d} fill={color} />
      {initial.eyes.map((e, i) => <ellipse key={i} cx={e.cx} cy={e.cy} rx="1.5" ry={e.ry} fill="#141414" />)}
    </g>
  </svg>;
}

/** Three dots that hop while a bot is working. Inherits the surrounding text colour. */
export function TypingDots() {
  return <span className={s.dots} aria-hidden="true"><i /><i /><i /></span>;
}

/**
 * Reveals a bot's message a word at a time, finishing within about a second and a half.
 * Screen readers get the whole message at once. Keeps a chat log pinned to the bottom while it grows.
 */
export function TypeOut({ text, onDone }: { text: string; onDone?: () => void }) {
  const words = useMemo(() => text.match(/\S+\s*|\s+/g) ?? [], [text]);
  const [shown, setShown] = useState(0);
  const done = useRef(onDone);
  const span = useRef<HTMLSpanElement>(null);
  done.current = onDone;

  useEffect(() => {
    if (reducedMotion()) { setShown(words.length); done.current?.(); return; }
    const pace = Math.min(40, 1300 / Math.max(1, words.length));
    let i = 0, timer = 0;
    const tick = () => {
      setShown(++i);
      if (i >= words.length) { done.current?.(); return; }
      timer = window.setTimeout(tick, pace * (0.6 + Math.random() * 0.8));
    };
    timer = window.setTimeout(tick, 60);
    return () => clearTimeout(timer);
  }, [words]);

  useLayoutEffect(() => {
    const log = span.current?.closest('[role="log"]');
    if (log && log.scrollHeight - log.scrollTop - log.clientHeight < 90) log.scrollTop = log.scrollHeight;
  }, [shown]);

  return <><span className="sr-only">{text}</span><span ref={span} aria-hidden="true">{words.slice(0, shown).join('')}</span></>;
}

/** GrokBot gives each bot its own colour. Shopkeeper's agents keep a stable one per role. */
const ROLE_COLORS: [RegExp, string][] = [
  [/sales/i, '#F8C642'], [/stock/i, '#8E8E8E'], [/sourcing/i, '#7B4FE0'], [/outreach/i, '#FF6B00'],
  [/purchas/i, '#2F9BFF'], [/care|recovery/i, '#E0368C'],
];
export const colorFor = (label: string) => ROLE_COLORS.find(([re]) => re.test(label))?.[1] ?? '#F8C642';
