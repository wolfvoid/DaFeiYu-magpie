import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'jsonc-parser';

const source = parse(readFileSync(new URL('../assets/upstream-config.jsonc', import.meta.url), 'utf8'));
const manifest = JSON.parse(readFileSync(new URL('../assets/upstream.json', import.meta.url), 'utf8'));
const names = manifest.files.map(entry => entry.name.replace(/\.webm$/, ''));
const config = {
  names,
  idle: source.animations.idle,
  clicks: source.animations.clicks,
  categories: source.animations.categories,
  states: {
    thinking: ['工作状态-思考冒泡', '深度思考碎碎念'],
    working: ['写代码', '工作状态-忙碌点按'],
    result: ['工作状态-清点归档', '轻快记录'],
    waiting: ['工作状态-原地踱步张望'],
    success: ['放烟花', '工作状态-雀跃庆祝'],
    error: ['工作状态-垂头叹气冒汗'],
  },
};
for (const name of [...config.idle, ...config.clicks, ...Object.values(config.states).flat(), ...config.categories.flatMap(category => category.actions)]) {
  if (!names.includes(name)) throw new Error(`Missing animation: ${name}`);
}
writeFileSync(new URL('../assets/catalog.json', import.meta.url), JSON.stringify(config, null, 2));
console.log(`Prepared ${names.length} animation entries.`);
