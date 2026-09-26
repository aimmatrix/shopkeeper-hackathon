import { BufferAttribute, BufferGeometry } from 'three';

/** Identify detached cords by connected geometry, so the chest never moves like a lace. */
export function addHoodieDetailWeights(geometry: BufferGeometry) {
  const p = geometry.getAttribute('position');
  const index = geometry.index;
  const parent = Array.from({ length: p.count }, (_, i) => i);
  const find = (i: number): number => parent[i] === i ? i : (parent[i] = find(parent[i]));
  const join = (a: number, b: number) => { parent[find(a)] = find(b); };
  const welded = new Map<string, number>();
  for (let i = 0; i < p.count; i++) {
    const key = [p.getX(i), p.getY(i), p.getZ(i)].map(v => Math.round(v * 100000)).join(',');
    const previous = welded.get(key);
    if (previous !== undefined) join(i, previous);
    else welded.set(key, i);
  }
  for (let i = 0; i < (index?.count ?? p.count); i += 3) {
    const a = index ? index.getX(i) : i;
    join(a, index ? index.getX(i + 1) : i + 1);
    join(a, index ? index.getX(i + 2) : i + 2);
  }
  const parts = new Map<number, { min: number[]; max: number[] }>();
  for (let i = 0; i < p.count; i++) {
    const id = find(i);
    let part = parts.get(id);
    if (!part) { part = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }; parts.set(id, part); }
    [p.getX(i), p.getY(i), p.getZ(i)].forEach((v, axis) => {
      part.min[axis] = Math.min(part.min[axis], v);
      part.max[axis] = Math.max(part.max[axis], v);
    });
  }
  const weights = new Float32Array(p.count);
  const profiles = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const { min, max } = parts.get(find(i))!;
    const isCord = min[1] > .3 && max[1] - min[1] > .3 && max[0] - min[0] < .25 && min[2] > 0;
    if (isCord) {
      profiles[i * 3] = max[1];
      profiles[i * 3 + 1] = 1 / (max[1] - min[1]);
      profiles[i * 3 + 2] = (min[0] + max[0]) / 2 < 0 ? 0 : 1.7;
    }
    if (isCord) weights[i] = Math.pow(Math.max(0, Math.min(1, (max[1] - p.getY(i)) / (max[1] - min[1]))), 1.5);
  }
  geometry.setAttribute('laceProfile', new BufferAttribute(profiles, 3));
  geometry.setAttribute('laceWeight', new BufferAttribute(weights, 1));
}
