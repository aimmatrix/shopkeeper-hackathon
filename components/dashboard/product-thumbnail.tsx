'use client';

import { useEffect, useRef, useState } from 'react';
import type { Product } from '@/lib/types';
import type { StudioControls } from '../storefront/product-studio';
import ProductArt from '../product-art';
import s from './product-thumbnail.module.css';

/** A compact render of the same model and lighting used in the storefront. */
export function ProductThumbnail({ product }: { product: Product }) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const controller = new AbortController();
    let studio: StudioControls | undefined;
    setReady(false);
    const lost = (event: Event) => { event.preventDefault(); setReady(false); studio?.dispose(); };
    async function load() {
      try {
        const { createProductStudio } = await import('../storefront/product-studio');
        if (controller.signal.aborted) return;
        studio = await createProductStudio(element!, product.kind, controller.signal);
        if (controller.signal.aborted) { studio.dispose(); return; }
        element!.querySelector('canvas')?.addEventListener('webglcontextlost', lost);
        setReady(true);
      } catch { /* Keep the illustration when WebGL or the model is unavailable. */ }
    }
    void load();
    return () => {
      element.querySelector('canvas')?.removeEventListener('webglcontextlost', lost);
      controller.abort();
      studio?.dispose();
    };
  }, [product.kind]);

  return <span className={s.thumbnail} role="img" aria-label={`${product.name} · ${ready ? '3D model' : 'product illustration'}`}>
    <div ref={host} className={s.scene} aria-hidden="true" />
    {!ready && <span className={s.fallback} aria-hidden="true"><ProductArt kind={product.kind} /></span>}
  </span>;
}
