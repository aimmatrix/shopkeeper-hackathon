import { useId } from 'react';
import type { Product } from '@/lib/types';

export default function ProductArt({ kind = 'hoodie', className = '' }: { kind?: Product['kind']; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const fill = kind === 'hoodie' ? '#353735' : kind === 'tee' ? '#e9e4d7' : kind === 'bag' ? '#78816a' : '#bd795d';
  return <svg className={className} viewBox="0 0 400 440" role="img" aria-label={`${kind} product illustration`}>
    <defs>
      <linearGradient id={`${uid}-fabric`} x1="0" y1="0" x2="1" y2="1"><stop stopColor={fill} /><stop offset=".5" stopColor={fill} /><stop offset="1" stopColor={kind === 'hoodie' ? '#171b19' : kind === 'tee' ? '#c7c1b5' : kind === 'bag' ? '#4a5840' : '#895440'} /></linearGradient>
      <filter id={`${uid}-shadow`} x="-50%" y="-50%" width="200%" height="220%"><feDropShadow dx="1" dy="18" stdDeviation="14" floodColor="#282d21" floodOpacity=".18" /></filter>
      <pattern id={`${uid}-texture`} width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 0L4 4 M-1 3L1 5 M3 -1L5 1" stroke="#fff" strokeOpacity=".035" strokeWidth=".6" /></pattern>
    </defs>
    <g filter={`url(#${uid}-shadow)`}>
      {kind === 'hoodie' && <>
        <path d="M133 102Q127 56 151 35Q174 15 200 18Q239 18 259 47Q273 71 264 104L302 123Q315 128 324 148L365 289L325 305L282 212L280 368Q200 391 119 368L118 212L75 305L34 288L77 146Q84 130 100 122Z" fill={`url(#${uid}-fabric)`} />
        <path d="M137 100Q160 138 199 137Q239 135 262 102Q239 85 200 78Q166 83 137 100Z" fill="#161b19" />
        <path d="M146 58Q164 32 197 35Q234 33 251 69L262 102Q239 86 200 79Q166 83 137 100Z" fill="#454843" />
        <path d="M198 79L200 131 M134 107Q154 142 181 153 M266 108Q248 141 220 152" fill="none" stroke="#73766c" strokeOpacity=".42" strokeWidth="2" />
        <path d="M178 147L174 221M219 147L225 217" fill="none" stroke="#a5a69a" strokeWidth="2.5" /><path d="M174 214L174 228M225 210L225 225" stroke="#72756b" strokeWidth="4" />
        <path d="M150 280L139 327Q199 341 261 327L250 280Q199 288 150 280Z" fill="#303630" stroke="#52584d" strokeWidth="1" />
        <path d="M119 345Q200 365 280 345L280 367Q199 391 119 367Z" fill="#2b312b" />
        <path d="M37 280L75 296L71 314L31 297Z M325 296L363 280L369 298L331 314Z" fill="#2c322c" />
        <path d="M121 168L119 335M282 167L280 335M86 146L61 269M313 145L343 274" stroke="#74786b" strokeOpacity=".2" fill="none" />
        <path d="M134 174Q158 207 151 256M266 181Q247 228 251 268" fill="none" stroke="#191f19" strokeOpacity=".5" strokeWidth="4" />
        <rect x="207" y="192" width="27" height="8" rx="1" fill="#c8c8b5" /><text x="210" y="198" fontSize="4.5" fill="#252b21" letterSpacing=".7">N & F</text>
      </>}
      {kind === 'tee' && <>
        <path d="M150 72L104 92L38 177L93 218L127 180L117 365Q200 382 282 365L273 180L307 218L363 177L298 93L248 72Q200 103 150 72Z" fill={`url(#${uid}-fabric)`} />
        <path d="M150 72Q199 120 248 72L239 66Q200 89 159 66Z" fill="#b9b4a9" /><path d="M124 351Q200 367 278 351M48 175L92 207M308 207L353 175" stroke="#b3ac9e" fill="none" /><text x="210" y="173" fontSize="10" fill="#686e59" letterSpacing="2">N&F</text>
      </>}
      {kind === 'bag' && <>
        <path d="M151 162V105Q151 41 199 41Q247 41 247 105V162" fill="none" stroke="#4b593f" strokeWidth="17" /><path d="M109 144L291 144L312 369Q200 397 88 369Z" fill={`url(#${uid}-fabric)`} /><path d="M145 163V106Q145 48 196 48Q250 48 250 107V163" fill="none" stroke="#899477" strokeWidth="12" /><path d="M102 348Q200 372 298 348" stroke="#424f37" fill="none" /><text x="150" y="271" fontSize="25" fill="#e0dfc9" letterSpacing="5">N & F</text><text x="157" y="290" fontSize="7" fill="#e0dfc9" letterSpacing="2">EVERYDAY GOODS</text>
      </>}
      {kind === 'cap' && <>
        <path d="M98 253Q83 120 194 108Q292 111 304 247Q219 278 98 253Z" fill={`url(#${uid}-fabric)`} /><path d="M102 250Q202 268 300 244Q303 300 358 303Q317 353 239 337Q163 319 102 250Z" fill="#a8664e" /><path d="M195 111Q231 160 227 261M128 139Q160 180 157 260" stroke="#d3987e" fill="none" strokeWidth="2" /><ellipse cx="195" cy="108" rx="9" ry="5" fill="#985b46" /><text x="157" y="209" fontSize="21" fill="#f2dfc2" letterSpacing="2">N&F</text>
      </>}
    </g>
  </svg>;
}
