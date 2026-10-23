const pick = (pool, exclude) => {
  const entries = exclude ? pool.filter((n) => n !== exclude) : pool;
  const src = entries.length ? entries : pool;
  return src[Math.floor(Math.random() * src.length)];
};
const pickSlot = (slot, exclude) => {
  if (typeof slot === "string") return slot;
  const entries = exclude === void 0 ? slot : slot.filter((n) => n !== exclude);
  const src = entries.length ? entries : slot;
  return src[Math.floor(Math.random() * src.length)];
};
const slotIncludes = (slot, anim) => typeof slot === "string" ? slot === anim : slot.includes(anim);
const poolIncludes = (pool, anim) => pool.some((slot) => slotIncludes(slot, anim));
const isEventAnim = (events, anim) => events ? Object.values(events).some((pool) => poolIncludes(pool, anim)) : false;
const nextWorkStatusAnim = (pool, current) => {
  const idx = pool.findIndex((slot2) => slotIncludes(slot2, current));
  if (idx === -1) return null;
  const slot = pool[idx];
  if (!Array.isArray(slot) || slot.length <= 1) return null;
  return pickSlot(slot, current);
};
const randomBetween = (min, max) => Math.floor(min + Math.random() * (max - min));
const pickWeightedCategory = (categories, facing) => {
  const cats = categories.filter((c) => c.actions.length > 0);
  if (!cats.length) return null;
  const filtered = cats.filter((c) => !(c.noMirror && facing === "right"));
  const eligible = filtered.length ? filtered : cats;
  const totalW = eligible.reduce((s, c) => s + c.weight, 0) || 1;
  let t = Math.random() * totalW;
  for (const c of eligible) {
    t -= c.weight;
    if (t <= 0) return c;
  }
  return eligible[eligible.length - 1];
};
const rollKind = (roll, w, opts) => {
  const turn = opts?.fixed ? 0 : w.turn;
  const move = opts?.fixed ? 0 : w.move;
  const topEnd = (w.idle + turn + move) / 100;
  if (roll < w.idle / 100) return "idle";
  if (roll < (w.idle + turn) / 100) return "turn";
  if (roll < topEnd) return "move";
  return "action";
};
const pickCategoryAction = (categories, idlePool, facing, current) => {
  const cat = pickWeightedCategory(categories, facing);
  if (!cat) return { id: "FALLBACK", name: pick(idlePool, current) };
  return { id: cat.id, name: pick(cat.actions, current) };
};
export {
  isEventAnim,
  nextWorkStatusAnim,
  pick,
  pickCategoryAction,
  pickSlot,
  pickWeightedCategory,
  poolIncludes,
  randomBetween,
  rollKind,
  slotIncludes
};
