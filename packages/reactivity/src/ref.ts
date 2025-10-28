import { activeEffect, trackEffect, triggerEffect } from "./effect";
import { toReactive } from "./reactive";
import { createDep } from "./reactiveEffect";

export function ref(value) {
  return createRef(value);
}

function createRef(value) {
  return new RefImpl(value);
}

// 属性访问器
class RefImpl {
  public __v_isRef = true; // 增加ref标识
  public _value; // 用来保存ref的值的
  public dep; // 用来收集对应的effect
  constructor(public rawValue) {
    this._value = toReactive(rawValue);
  }
  get value() {
    trackRefValue(this);
    return this._value;
  }
  set value(newValue) {
    if (newValue !== this.rawValue) {
      this.rawValue = newValue; // 更新值
      this._value = newValue;
      triggerRefValue(this);
    }
  }
}

export function trackRefValue(ref) {
  if (activeEffect) {
    trackEffect(
      activeEffect,
      (ref.dep = ref.dep || createDep(() => (ref.dep = undefined), "undefined"))
    );
  }
}
export function triggerRefValue(ref) {
  let dep = ref.dep;
  if (dep) {
    triggerEffect(dep); // 触发依赖更新
  }
}

class ObjectRefImpl {
  public __v_isRef = true;
  constructor(public _object, public _key) {}
  get value() {
    return this._object[this._key];
  }
  set value(newValue) {
    this._object[this._key] = newValue;
  }
}

// toRef: 可以基于响应式对象上的一个属性，创建一个对应的 ref。
export function toRef(object, key) {
  return new ObjectRefImpl(object, key);
}

// roRefs: 将一个响应式对象转换为一个普通对象，这个普通对象的每个属性都是指向源对象相应属性的 ref
export function toRefs(object) {
  let res = [];
  for (let key in object) {
    res[key] = toRef(object, key);
  }
  return res;
}

export function proxyRefs(objectWithRef) {
  return new Proxy(objectWithRef, {
    get(target, key, receiver) {
      let r = Reflect.get(target, key, receiver);
      return r.__v_isRef ? r.value : r; // 自动脱掉ref
    },
    set(target, key, value, receiver) {
      const oldValue = target[key];
      if (oldValue.__v_isRef) {
        oldValue.value = value;
        return true;
      } else {
        return Reflect.set(target, key, value, receiver);
      }
    },
  });
}

export function isRef(value) {
  return value && value.__v_isRef;
}
