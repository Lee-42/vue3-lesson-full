import { isObject } from "@vue/shared";
import { isReactive, isRef, ReactiveEffect } from "vue";

export function watch(source, cb, options = {} as any) {
  // watchEffect也是基于doWatch来实现的
  return doWatch(source, cb, options);
}

export function watchEffect(source, options = {}) {
  return doWatch(source, null, options as any);
}

// 控制depth已经当前遍历到了那一层
function traverse(source, depth, currentDepth = 0, seen = new Set()) {
  if (!isObject(source)) {
    return source;
  }
  if (depth) {
    if (currentDepth >= depth) {
      return source;
    }
    currentDepth++; // 根据deep属性来看是否是深度
  }
  if (seen.has(source)) {
    return source;
  }
  for (let key in source) {
    traverse(source[key], depth, currentDepth, seen);
  }
}

function doWatch(source, cb, { deep, immediate }) {
  const reactiveGetter = (source) => {
    traverse(source, deep === false ? 1 : undefined);
  };

  // 产生一个可以给ReactiveEffect来使用的getter, 需要对这个对象进行取值操作, 会关联当前的reactiveEffect
  let getter;
  if (isReactive(source)) {
    getter = () => reactiveGetter(source);
  } else if (isRef(source)) {
    getter = () => source.value;
  }
  let oldValue;

  let clean;
  const onCleanup = (fn) => {
    clean = () => {
      fn();
      clean = undefined;
    };
  };

  const job = () => {
    if (cb) {
      const newValue = effect.run();
      cb(oldValue, newValue, onCleanup);
      oldValue = newValue;
    }
  };
  const effect = new ReactiveEffect(getter, job);

  if (cb) {
    if (immediate) {
      // 立即先执行一次用户的回调, 传递新值和老值
      job();
    } else {
      oldValue = effect.run();
    }
  } else {
    effect.run(); // watchEffect直接执行即可
  }

  const unwatch = () => {
    effect.stop();
  };
  return unwatch;
}
