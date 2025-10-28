import { DirtyLevels } from "./constans";
import { targetMap } from "./reactiveEffect";

export function effect(fn, options?) {
  // 创建一个响应式effect, 数据变化之后可以重新执行
  // 创建一个effect, 只要依赖的属性变化了就要重新执行
  const _effect = new ReactiveEffect(fn, () => {
    _effect.run();
  });
  _effect.run();

  if (options) {
    Object.assign(_effect, options); // 用用户传递的覆盖掉内置的, 这里是scheduler
  }
  const runner = _effect.run.bind(_effect);
  runner.effect = _effect; // 可以在run方法上获取到effect的引用
  return runner;
}

export let activeEffect;
export class ReactiveEffect {
  _trackId = 0; //用于记录当前effect执行了几次
  deps = [];
  _depsLength = 0;
  _running = 0;
  _dirtyLevel = DirtyLevels.Dirty;
  public active = true; // 默认创建的effect是响应式的
  /**
   * @param fn 用户编写的函数
   * @param scheduler 如果fn中依赖的属性变化了, 需要重新调用scheduler
   */
  constructor(public fn, public scheduler) {}

  public get dirty() {
    return this._dirtyLevel === DirtyLevels.Dirty;
  }
  public set dirty(v) {
    this._dirtyLevel = v ? DirtyLevels.Dirty : DirtyLevels.NoDirty;
  }
  run() {
    this._dirtyLevel = DirtyLevels.NoDirty; // 每次运行后, 此值就不脏了
    // 不是激活的, 执行后什么都不用做
    if (!this.active) {
      return this.fn();
    }
    // 依赖收集啦
    // 调用fn的时候, 会取值, 走get。
    // 在baseHandler将属性和effect关联起来, 所以通过一个全局变量保存effect, 这样baseHandler就可以拿到
    let lastActiveEffect = activeEffect;
    try {
      activeEffect = this;
      // effect第一次执行的时候会把_trackId++
      // effect重新执行前, 需要将上一次的依赖清空, effect.deps
      preCleanEffect(this);
      this._running++;
      return this.fn();
    } finally {
      this._running--;
      postCleanEffect(this);
      activeEffect = lastActiveEffect;
    }
  }

  stop() {
    if (this.active) {
      this.active = false;
      preCleanEffect(this);
      postCleanEffect(this);
    }
  }
}

function preCleanEffect(effect) {
  effect._depsLength = 0;
  effect._trackId++;
}

function postCleanEffect(effect) {
  if (effect.deps.langth > effect._depsLength) {
    for (let i = 0; effect._depsLength; i++) {
      cleanDepEffect(effect.deps[i], effect);
    }
    effect.deps.length = effect._depsLength;
  }
}

// 双向记忆
// 1._trackId用于记录执行次数(防止一个属性在当前effect中多次依赖收集)只收集一次
// 2.拿到上一次依赖的最后一个和这次的比较
export function trackEffect(effect, dep) {
  // 值是什么????。
  // dep.set(effect, effect._trackId);
  // effect.deps[effect._depsLength++] = dep;
  // 不能像上面那样直接收集依赖了, 要重新去收集依赖, 把不需要的移除掉
  if (dep.get(effect) !== effect._trackId) {
    dep.set(effect, effect._trackId); // 更新id

    let oldDep = effect.deps[effect._depsLength];
    if (oldDep !== dep) {
      if (oldDep) {
        //删除掉老的
        cleanDepEffect(oldDep, effect);
      }
      // 换成新的
      effect.deps[effect._depsLength++] = dep;
    } else {
      effect._depsLength++;
    }
  }
}

function cleanDepEffect(dep, effect) {
  dep.delete(effect);
  if (dep.size === 0) {
    dep.cleanup();
  }
}

// 找到effect让他执行
export function trigger(target, key, newValye, oldValue) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;
  let dep = depsMap.get(key);
  if (dep) {
    triggerEffect(dep);
  }
}

export function triggerEffect(dep) {
  for (const effect of dep.keys()) {
    if (effect._dirtyLevel < DirtyLevels.Dirty) {
      effect._dirtyLevel = DirtyLevels.Dirty;
    }
    if (!effect._running) {
      // 如果不是正在执行, 才能执行
      if (effect.scheduler) {
        effect.scheduler();
      }
    }
  }
}
