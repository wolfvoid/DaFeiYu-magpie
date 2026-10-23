export class AnimationDirector {
  constructor(catalog, random = Math.random) {
    this.catalog = catalog;
    this.random = random;
    this.activity = { state: 'idle' };
    this.current = '';
    this.manual = false;
    this.paused = false;
    this.lastCelebration = null;
    this.active = true;
    this.recent = [];
    this.recentPrograms = [];
    this.workClips = 0;
    this.programs = new Set(catalog.categories.flatMap(category => category.actions));
    this.lightActions = ['悠闲哼歌', '超大伸懒腰', '女仆屈膝礼仪', '照镜子',
      '摇扇纳凉', '用鲸鱼尾巴拍打地面', '小幅度原地360度旋转展示', '原地专心玩魔方',
      '三球抛接', '抽陀螺', '吹气球', '踢毽子', '轻快摇摆舞', '轻快记录',
      '原地敲击桌面互动', '鲸鱼吐泡泡特效', '下五子棋', '小提琴演奏',
      '吹笛子', '撸猫'].filter(name => catalog.names.includes(name));
  }
  select(name, manual = false, program = false) {
    if (!this.catalog.names.includes(name)) return null;
    this.current = name;
    this.manual = manual;
    this.recent = [...this.recent.filter(previous => previous !== name), name].slice(-15);
    if ((program || manual) && this.programs.has(name)) this.recentPrograms = [...this.recentPrograms, name].slice(-15);
    return name;
  }
  update(activity) {
    this.activity = activity;
    return this.current ? null : this.next();
  }
  pick(pool) {
    const fresh = pool.filter(name => !this.recent.includes(name));
    if (fresh.length) return fresh[Math.floor(this.random() * fresh.length)];
    return this.recent.find(name => pool.includes(name)) || pool[0];
  }
  program() {
    const categories = this.catalog.categories.map(category => ({ ...category,
      actions: category.actions.filter(name => name !== this.current && !this.recentPrograms.includes(name)),
    })).filter(category => category.actions.length && category.weight > 0);
    if (!categories.length) return this.pick(this.catalog.idle);
    let roll = this.random() * categories.reduce((sum, category) => sum + category.weight, 0);
    for (const category of categories) {
      roll -= category.weight;
      if (roll < 0) return this.pick(category.actions);
    }
    return this.pick(categories[categories.length - 1].actions);
  }
  next() {
    this.manual = false;
    if (this.paused) return this.select(this.catalog.idle[0]);
    const state = this.activity.state;
    if (state === 'success' && this.activity.eventId && this.activity.eventId !== this.lastCelebration) {
      this.lastCelebration = this.activity.eventId;
      return this.select('放烟花');
    }
    const pool = state === 'success' ? null : this.catalog.states[state];
    if (pool?.length) {
      if (this.active && ['thinking', 'working'].includes(state) && this.workClips >= 2 && this.lightActions.length) {
        this.workClips = 0;
        const fresh = this.lightActions.filter(name => !this.recentPrograms.includes(name));
        return this.select(this.pick(fresh.length ? fresh : this.lightActions), false, true);
      }
      this.workClips++;
      return this.select(this.pick(pool));
    }
    this.workClips = 0;
    if (!this.active || (!this.catalog.idle.includes(this.current) && this.random() < 0.15)) {
      return this.select(this.pick(this.catalog.idle));
    }
    return this.select(this.program(), false, true);
  }
}
