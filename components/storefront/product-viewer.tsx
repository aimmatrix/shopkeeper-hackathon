'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Maximize2, Minus, Plus, RotateCcw, Waves } from 'lucide-react';
import type { Product } from '@/lib/types';
import ProductArt from '@/components/product-art';
import FitPreview from './fit-preview';
import styles from './product-viewer.module.css';

import type { StudioControls } from './product-studio';
type ViewerControls = StudioControls;

export default function ProductViewer({ product, showFitPreview = true }: { product: Product; showFitPreview?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const controls = useRef<ViewerControls | null>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [expanded, setExpanded] = useState(false);
  const [imported, setImported] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const expandButton = useRef<HTMLButtonElement>(null);
  const hint = useId();
  const title = useId();
  const keyboardHint = useId();

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const controller = new AbortController();
    let active: StudioControls | null = null;
    setStatus('loading');
    const lost = (event: Event) => { event.preventDefault(); controls.current = null; setStatus('fallback'); active?.dispose(); };
    async function setup() {
      try {
        const { createProductStudio } = await import('./product-studio');
        if (controller.signal.aborted) return;
        active = await createProductStudio(element!, product.kind, controller.signal);
        if (controller.signal.aborted) { active.dispose(); return; }
        controls.current = active;
        setImported(active.imported);
        element?.querySelector('canvas')?.addEventListener('webglcontextlost', lost);
        setStatus('ready');
      } catch { if (!controller.signal.aborted) setStatus('fallback'); }
    }
    void setup();
    return () => {
      element.querySelector('canvas')?.removeEventListener('webglcontextlost', lost);
      controller.abort(); active?.dispose(); controls.current = null;
    };
  }, [product.kind, expanded]);

  const viewer = <div className={styles.viewer} data-expanded={expanded || undefined}>
    <span className={styles.badge}>3D studio · {product.kind === 'bag' ? 'tote' : product.kind}</span>
    <div className={styles.stage} ref={host} tabIndex={status === 'ready' ? 0 : undefined} role="group"
      aria-label={`Interactive 3D view of ${product.name}`} aria-describedby={`${hint} ${keyboardHint}`} data-model-source={imported ? 'downloaded' : 'procedural'}
      onKeyDown={event => {
        const c = controls.current; if (!c) return;
        if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(event.key)) event.preventDefault();
        if (event.key === 'ArrowLeft') c.rotate(-.2,0);
        if (event.key === 'ArrowRight') c.rotate(.2,0);
        if (event.key === 'ArrowUp') c.rotate(0,-.15);
        if (event.key === 'ArrowDown') c.rotate(0,.15);
        if (event.key === '+' || event.key === '=') c.zoom(1);
        if (event.key === '-') c.zoom(-1);
        if (event.key === 'Home') c.reset();
      }}
      onPointerDown={event => { if (!controls.current || (event.pointerType === 'mouse' && event.button !== 0) || drag.current) return; controls.current.touch(event.clientX,event.clientY); drag.current = {id:event.pointerId,x:event.clientX,y:event.clientY}; event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.focus(); }}
      onPointerMove={event => { const previous = drag.current; if (!previous || previous.id !== event.pointerId) return; controls.current?.rotate((event.clientX-previous.x)*.012,(event.clientY-previous.y)*.01,true); drag.current = {id:event.pointerId,x:event.clientX,y:event.clientY}; }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
      {status !== 'ready' && <div className={styles.fallback}><ProductArt kind={product.kind} /><span role="status">{status === 'loading' ? 'Preparing 3D view…' : '3D unavailable — showing illustration'}</span></div>}
    </div>
    <span id={keyboardHint} className={styles.srOnly}>Use arrow keys to rotate, plus and minus to zoom, or Home to reset.</span>
    <div className={styles.bottom}>
      <p id={hint}>{status === 'ready' ? 'Touch the fabric · Drag to turn' : 'Fleek 0.5 · The collection'}</p>
      <div className={styles.tools} role="group" aria-label={`${product.name} view controls`}>
        <button type="button" disabled={status !== 'ready'} onClick={() => controls.current?.zoom(-1)} aria-label={`Zoom out ${product.name}`} title="Zoom out (−)"><Minus size={15} /></button>
        <button type="button" disabled={status !== 'ready'} onClick={() => controls.current?.zoom(1)} aria-label={`Zoom in ${product.name}`} title="Zoom in (+)"><Plus size={15} /></button>
        <button type="button" disabled={status !== 'ready'} onClick={() => controls.current?.ripple()} aria-label={`Ripple ${product.name} fabric`} title="Ripple fabric"><Waves size={15} /></button>
        <button type="button" disabled={status !== 'ready'} onClick={() => controls.current?.reset()} aria-label={`Reset ${product.name} view`} title="Reset view (Home)"><RotateCcw size={14} /></button>
        {!expanded && <button ref={expandButton} type="button" aria-label={`Enlarge ${product.name}`} title="Enlarge" onClick={() => { setExpanded(true); dialog.current?.showModal(); }}><Maximize2 size={14} /></button>}
      </div>
      {showFitPreview && <FitPreview product={product} />}
    </div>
  </div>;

  return <>
    {!expanded && viewer}
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={title} onClose={() => { setExpanded(false); requestAnimationFrame(() => expandButton.current?.focus()); }} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      {expanded && <><header><div><span>THE OBJECT STUDIO</span><h2 id={title}>{product.name}</h2></div><button type="button" onClick={() => dialog.current?.close()} autoFocus>Close <span aria-hidden>×</span></button></header>{viewer}<p className={styles.note}>{product.variant}{imported && <> · Model from <a href={product.kind === 'hoodie' ? 'https://3dfree.org/hoodie' : 'https://3dfree.org/t-shirt'} target="_blank" rel="noreferrer">3D Free ↗</a></>}</p></>}
    </dialog>
  </>;
}
