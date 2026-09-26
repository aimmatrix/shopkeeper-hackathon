'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { Minus, Plus, UserRound } from 'lucide-react';
import type { Product } from '@/lib/types';
import type { FitAnimation, FitControls } from './fit-studio';
import styles from './fit-preview.module.css';

export default function FitPreview({product}:{product:Product}) {
  const [open,setOpen]=useState(false),[status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
  const [animation,setAnimation]=useState<FitAnimation>('idle'),[paused,setPaused]=useState(false),[attempt,setAttempt]=useState(0);
  const dialog=useRef<HTMLDialogElement>(null),host=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),controls=useRef<FitControls|null>(null);
  const drag=useRef<{id:number;x:number;y:number}|null>(null),title=useId();
  useEffect(()=>{
    if(!open||!host.current)return;
    const element=host.current,abort=new AbortController();let active:FitControls|null=null;
    setStatus('loading');setAnimation('idle');setPaused(matchMedia('(prefers-reduced-motion: reduce)').matches);
    const lost=(event:Event)=>{event.preventDefault();active?.dispose();controls.current=null;setStatus('error');};
    void import('./fit-studio').then(async({createFitStudio})=>{
      if(abort.signal.aborted)return;
      active=await createFitStudio(element,product.kind,abort.signal);
      if(abort.signal.aborted){active.dispose();return;}
      controls.current=active;element.querySelector('canvas')?.addEventListener('webglcontextlost',lost);setStatus('ready');
    }).catch(()=>{if(!abort.signal.aborted)setStatus('error');});
    return()=>{element.querySelector('canvas')?.removeEventListener('webglcontextlost',lost);abort.abort();active?.dispose();controls.current=null;drag.current=null;};
  },[open,product.kind,attempt]);
  return <>
    <button ref={trigger} type="button" className={styles.trigger} aria-label={`See the fit of ${product.name}`} onClick={()=>{setOpen(true);dialog.current?.showModal();}}><UserRound size={13}/> See the fit</button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={title} onClose={()=>{setOpen(false);trigger.current?.focus();}} onClick={e=>{if(e.target===e.currentTarget)dialog.current?.close();}}>
      {open&&<>
        <header className={styles.header}><div><span>THE FIT STUDIO</span><h2 id={title}>{product.name}</h2></div><button autoFocus onClick={()=>dialog.current?.close()} aria-label="Close fit preview">Close ×</button></header>
        <div className={styles.scene}>
          <span className={styles.badge}>ON THE MANNEQUIN</span>
          <div ref={host} className={styles.canvas} role="group" tabIndex={status==='ready'?0:undefined} aria-label={`Animated fit preview of ${product.name}`} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','='].includes(e.key))e.preventDefault();if(e.key==='ArrowLeft')controls.current?.rotate(-.2);if(e.key==='ArrowRight')controls.current?.rotate(.2);if(e.key==='ArrowUp')controls.current?.rotate(0,-.15);if(e.key==='ArrowDown')controls.current?.rotate(0,.15);if(e.key==='+'||e.key==='=')controls.current?.zoom(1);if(e.key==='-')controls.current?.zoom(-1);}}
            onPointerDown={e=>{if(!controls.current||drag.current||(e.pointerType==='mouse'&&e.button!==0))return;controls.current.touch(e.clientX,e.clientY);drag.current={id:e.pointerId,x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.focus();}}
            onPointerMove={e=>{if(drag.current?.id!==e.pointerId)return;controls.current?.rotate((e.clientX-drag.current.x)*.012,(e.clientY-drag.current.y)*.01);drag.current={id:e.pointerId,x:e.clientX,y:e.clientY};}}
            onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}} />
          {status!=='ready'&&<div className={styles.message} role="status">{status==='loading'?'Dressing the mannequin…':<>Couldn’t load the fit preview.<button onClick={()=>setAttempt(v=>v+1)}>Try again</button></>}</div>}
          <div className={styles.zoom}><button disabled={status!=='ready'} aria-label="Zoom out fit preview" onClick={()=>controls.current?.zoom(-1)}><Minus size={16}/></button><button disabled={status!=='ready'} aria-label="Zoom in fit preview" onClick={()=>controls.current?.zoom(1)}><Plus size={16}/></button></div>
          <p className={styles.hint}>Touch the fabric · Drag to turn</p>
        </div>
        <div className={styles.actions} role="group" aria-label="Mannequin animation">
          {(['idle','walk','run'] as const).map(name=><button key={name} disabled={status!=='ready'} aria-pressed={animation===name} onClick={()=>{setAnimation(name);controls.current?.animation(name);}}>{name==='idle'?'Standing':name==='walk'?'Walking':'Running'}</button>)}
          <button disabled={status!=='ready'} aria-pressed={paused} onClick={()=>{controls.current?.pause(!paused);setPaused(!paused);}}>{paused?'Play':'Pause'}</button>
        </div>
        <p className={styles.note}>Sample mannequin · Illustrative fit, not your measurements.<br/>Mannequin & motion: <a href="https://threejs.org/examples/webgl_animation_skinning_additive_blending.html" target="_blank" rel="noreferrer">Mixamo / Three.js ↗</a></p>
      </>}
    </dialog>
  </>;
}
