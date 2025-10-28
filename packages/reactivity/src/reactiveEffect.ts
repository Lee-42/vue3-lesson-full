// 要处理成什么结构?
// {
//     {name: "lee", age: 23}: {
//         name: {
//             effect
//         },
//         age: {
//             effect, effect
//         }
//     }
// }
// {name: "lee", age: 23} 这个称为 target
// {name:{}, age: {}} 这个称为depsMap
// { effect } 这个称为dep
import { activeEffect, trackEffect } from "./effect";

export const targetMap = new WeakMap(); // 存放依赖收集的关系

export const createDep = (cleanup, key) => {
  const dep = new Map() as any;
  dep.cleanup = cleanup;
  dep.name = key;
  return dep;
};

/**
 * 
 * @param target 响应式数据对象
 * @param key 属性值
 */
export function track(target, key) {
  // 有这个activeEffect, 说明key是在effect中访问的, 没有则是在effect外面访问的, 不用进行收集
  if (activeEffect) {
    let depsMap = targetMap.get(target);
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()));
    }
    let dep = depsMap.get(key);
    if (!dep) {
      //   depsMap.set(key, new Map());
      depsMap.set(
        key,
        (dep = createDep(() => depsMap.delete(key), key)) // cleanup后面用于清理不需要的属性, key为了方便调试
      );
    }
    // 将当前的effect放入到dep中, 后续根据值的变化, 触发次dep中存放的effect
    trackEffect(activeEffect, dep)
  }
}
