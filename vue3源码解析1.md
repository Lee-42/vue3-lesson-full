#### 一、手写 reactive

1、怎么用

```html
<script type="module">
  // 这两个api就可以解决视图和数据80%的问题了
  import {
    reactive,
    effect,
  } from "/node_modules/@vue/reactivity/dist/reactivity.esm-browser.js";

  // reactive让数据变成响应式的
  // effect 响应式数据的副作用, 数据变化后可以让effect重新执行。
  // 组件、watch、computed都是基于effect实现的
  // effect默认会执行一次
  const state = reactive({ name: "lee", age: 23 });
  effect(() => {
    app.innerHTML = `姓名${state.name}, 年龄${state.age}`;
  });
  setTimeout(() => {
    state.age++;
  }, 1000);
</script>
```

reactive: 返回一个对象的响应式代理

2、那就新建 effect.ts、reactive.ts
实现 reactive 同时添加缓存
为什么需要缓存缓存, 下面的情况

```js
const obj = { name: "lee", age: 23 };
const state = reactive(obj);
const state1 = reactive(obj); // 通过缓存
const state2 = reactive(state); // 如果state已经被代理过, 他一定具有get和set方法, 所以这里取值, 一定会走get。 通过创建代理的过程createReactiveObj中, 取某个常量属性来走get方法
// state、state1、state2应该相等
```

```ts
import { isObject } from "@vue/shared";

// 用于记录我们代理后的结果
const reactiveMap = new WeakMap();
enum ReactiveFlags {
  IS_REACTIVE = "__v_isReactive",
}

const mutableHandlers: ProxyHandler<any> = {
  // receiver就是new Proxy产生的对象
  get(target, key, receiver) {
    if (key === ReactiveFlags.IS_REACTIVE) {
      return true;
    }
  },
  set(target, key, value, receiver) {
    return true;
  },
};

export function reactive(target) {
  return createReactiveObj(target);
}

function createReactiveObj(target) {
  if (!isObject(target)) return target;
  if (target[ReactiveFlags.IS_REACTIVE]) return target;
  const existProxy = reactiveMap.get(target);
  if (existProxy) return existProxy;
  let proxy = new Proxy(target, mutableHandlers);
  //  根据对象缓存代理后的结果
  reactiveMap.set(target, proxy);
  return proxy;
}
```

3、拆一下代码结构, 比如 get、set 可以抽到 baseHandler.ts

#### 二、Reflect 的使用

https://www.bilibili.com/video/BV13p42197sv/?spm_id_from=333.337.search-card.all.click&vd_source=09ae3ce68eaa3231cbee232a54781e24

1、Proxy 需要与 Reflect 配合使用, 解决属性访问器的问题

```js
const person = {
  name: "lee",
  get aliasName() {
    return this.name + " handsome";
  },
};

let proxyPerson = new Proxy(person, {
  get(target, key, recevier) {
    // return target[key] // 如果我们直接通过target[key]取值, 不会走get。比如这里person[name]不会触发get
    // return recevier[key] // 会导致死循环
    return Reflect.get(target, key, recevier); // 让this.name的this指向recevier, 触发一次get
  },
});

console.log(proxyPerson.aliasName);
```

所以我们的 baseHandler 也改一下

```ts
export const mutableHandlers: ProxyHandler<any> = {
  // receiver就是new Proxy产生的对象
  get(target, key, receiver) {
    if (key === ReactiveFlags.IS_REACTIVE) {
      return true;
    }
    return Reflect.get(target, key, receiver);
  },
  set(target, key, value, receiver) {
    Reflect.set(target, key, value, receiver);
    return true;
  },
};
```

#### 三、effect 函数基本实现

1、effect 实现 关键思路
effect 函数通过 new 一个 ReactiveEffect 返回

```ts
export function effect(fn, options?) {
  // 创建一个响应式effect, 数据变化之后可以重新执行
  // 创建一个effect, 只要依赖的属性变化了就要重新执行
  const _effect = new ReactiveEffect(fn, () => {
    _effect.run();
  });
  // 默认执行一次
  _effect.run();
  return _effect;
}

class ReactiveEffect {
  /**
   * 构造函数
   * @param fn 用户编写的函数
   * @param scheduler 如果fn中依赖的属性变化了, 需要重新调用scheduler
   */
  constructor(public fn, public scheduler) {}
  run() {
    return this.fn();
  }
}
```

我们可以先不收集 fn 的属性, 通过返回的\_effect 手动调用 run

```js
// 2.effect 副作用, 数据变化后可以让effect重新执行。 组件、watch、computed都是基于effect实现的
// effect默认会执行一次
const _effect = effect(() => {
  app.innerHTML = `姓名${state.name}, 年龄${state.age}`;
});
setTimeout(() => {
  state.age++;
  _effect.run();
}, 1000);
```

2、通过全局变量 activeEffect, run 函数运行的时候, 关联的响应式数据取值, 取值就会走 get, 关联属性和 effect。
考虑下面的情况

```js
// activeEffect的变化。 由f1变成f2, 最后如果变成undefined, 那么state.age就无法和effect关联了。 所以最后effect不能是undefined, 而是最后一个effect
effect(() => {
  // f1
  console.log(state.name);
  effect(() => {
    // f2
    console.log(state.name);
  });
  console.log(state.age);
});
```

effect 就变成下面这样。 之前是通过 effect 栈实现的, [f1、f2] 当 f2 执行完毕之后就抛出去

```ts
export let activeEffect;
class ReactiveEffect {
  active = true; // 默认创建的effect是响应式的
  /**
   * @param fn 用户编写的函数
   * @param scheduler 如果fn中依赖的属性变化了, 需要重新调用scheduler
   */
  constructor(public fn, public scheduler) {}
  run() {
    // 不是激活的, 执行后什么都不用做
    if (!this.active) {
      return this.fn();
    }
    // 依赖收集啦
    // 调用fn的时候, 会取值, 走get。
    // 在baseHandler将属性和effect关联起来, 所以通过一个全局变量保存effect, 这样baseHandler就可以拿到
    let lastActiveEffect = activeEffect; // 1.当前最后一个effect
    try {
      activeEffect = this;
      return this.fn();
    } finally {
      activeEffect = lastActiveEffect; // 2.每次执行完之后再把值赋回去
    }
  }
}
```

3、构建依赖收集的关系用 track 方法
在 baseHandler.ts 里

```ts
// 拿到全局effect变量, 关联属性
track(target, key); // 表示收集target上的key, 和effect关联在一起
```

新建 reactiveEffect.ts

#### 三、依赖收集实现原理

1、构建依赖关系结构

```ts
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

import { activeEffect } from "./effect";

const targetMap = new WeakMap(); // 存放依赖收集的关系

export const createDep = (cleanup, key) => {
  const dep = new Map() as any;
  dep.cleanup = cleanup;
  dep.name = key;
  return dep;
};

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
    trackEffect(activeEffect, dep);
  }
}
```

2、实现 dep 和 effect 管理, 写在 effect.ts
track: 跟踪、追踪

```ts
// 双向记忆
export function trackEffect(effect, dep) {
  // 值是什么????。 注意这里我们直接收集依赖是不对的, 以后会改进
  dep.set(effect, effect._trackId);
  effect.deps[effect._depsLength++] = dep;
}
```

3、触发更新

```ts
set(target, key, value, receiver) {
  let oldValue = target[key];
  let result = Reflect.set(target, key, value, receiver)
  if (oldValue !== value) {
    // 触发页面更新
    trigger(target, key, value, oldValue);
  }
  return result;
},
```

4、实现 trigger, 写在 effect.ts

```ts
// 找到effect让他执行
export function trigger(target, key, newValye, oldValue) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;
  let dep = depsMap.get(key);
  if (dep) {
    triggerEffect(dep);
  }
}

// dep是每一个effect
export function triggerEffect(dep) {
  for (const effect of dep.keys()) {
    if (effect.scheduler) {
      effect.scheduler();
    }
  }
}
```

#### 四、依赖清理

0、如果一个 effect 多次调用一个属性

```js
effect(() => {
  app.innerHTML = state.flag + state.flag + state.flag; // flag不应该多次收集, 只需要收集一次
});
```

1、如果 effect 里面有逻辑

```js
const state = reactive({ flag: true, name: "lee", age: 23 });
// {obj: {flag: {effect}, name:{effect}}}
// {obj: {flag: {effect}, name:{effect}, age: {effect}}}
effect(() => {
  app.innerHTML = state.flag ? state.name : state.age;
});

setTimeout(() => {
  // 当flag为flase的时候, name还保留着effect,
  state.flag = false;
  setTimeout(() => {
    // 导致修改name属性的时候又执行了一次effect
    state.name = "hello lee";
  });
}, 1000);

// 我们需要一个算法来比对不同分支切换的时候的差异, 简易的diff算法(没有children)
// {flag, name}
// {flag, age}
```

2、预清理

```js
// 1. 把长度清零 2. 把id++
function preCleanEffect(effect) {
  effect._depsLength = 0;
  effect._trackId++;
}
```

3、改写 trackEffect

```ts
// 双向记忆
// 1._trackId用于记录执行次数(防止一个属性在当前effect中多次依赖收集)只收集一次
// 2.拿到上一次依赖的最后一个和这次的比较
export function trackEffect(effect, dep) {
  // 值是什么????。
  // dep.set(effect, effect._trackId);
  // effect.deps[effect._depsLength++] = dep;
  // 不能像上面那样直接收集依赖了, 要重新去收集依赖, 把不需要的移除掉
  // 这里preCleanEffect把id++了, 所以不相等
  if (dep.get(effect) !== effect._trackId) {
    dep.set(effect, effect._trackId); // 更新id

    let oldDep = effect.deps[effect._depsLength]; // preCleanEffect那里把_depsLength变成了0
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
```

#### 五、effect 调度实现

1、effect 支持传自己的调度器

```js
let runner = effect(
  () => {
    app.innerHTML = state.flag ? state.name : state.age;
  },
  {
    scheduler: () => {
      console.log("数据更新了, 不重新渲染, 走自己的逻辑");
      // AOP编程
      runner(); // 当然也可以执行
    },
  }
);
```

通过 options

```ts
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
```

#### 六、深度代理

1、在 effect 里再次取值的情况

```ts
effect(() => {
  app.innerHTML = state.name;
  state.name = Math.random(); // 如果在本次执行effect的时候更新了数据, 不会触发effect更新
});
state.name = "哈哈";
```

2、添加\_running 标记

```ts
class ReactiveEffect {
  _trackId = 0; //用于记录当前effect执行了几次
  deps = [];
  _depsLength = 0;
  _running = 0;
}
///////
try {
  activeEffect = this;
  // effect重新执行前, 需要将上一次的依赖清空, effect.deps
  preCleanEffect(this);
  this._running++;
  return this.fn();
} finally {
  this._running--;
  postCleanEffect(this);
  activeEffect = lastActiveEffect;
}
///////
// 在触发的地方判断一下
export function triggerEffect(dep) {
  for (const effect of dep.keys()) {
    // 一个完整的effect没有执行完, 再次取值是会被阻止运行的
    if (!effect._running) {
      // 如果不是正在执行, 才能执行
      if (effect.scheduler) {
        effect.scheduler();
      }
    }
  }
}
```

3、还有下面的深度对象

```js
effect(() => {
  app.innerHTML = state.address.city;
});

setTimeout(() => {
  state.address.city = "深圳";
}, 1000);
```

如果 proxy 取值返回的是一个对象, 再进行代理

```ts
get(target, key, receiver) {
  if (key === ReactiveFlags.IS_REACTIVE) {
    return true;
  }
  // 拿到全局effect变量, 关联属性
  track(target, key); // 表示收集target上的key, 和effect关联在一起

  let res = Reflect.get(target, key, receiver);
  if (isObject(res)) {
    // 当取的值也是对象的时候, 我需要对这个对象再进行代理, 递归代理
    return reactive(res);
  }
  return;
},
```

#### 七、ref 实现原理

1、reactive 只能对对象进行处理, 但是我们声明变量的时候还有 boolean、string 等

```js
const flag = ref(false); // 其实是包装成对象wrap(false) =>
// let flag1 = {
//     _v: false,
//     get value() {
//         return this._v
//     },
//     set value(newValue) {
//         this._v = newValue
//     }
// }
effect(() => {
  app.innerHTML = flag.value ? "lee" : 30;
});
setTimeout(() => {
  flag.value = true;
}, 1000);
```

2、新建 ref.ts

```ts
import { toReactive } from "./reactive";

export function ref(value) {
  return createRef(value);
}

function createRef(value) {
  return new RefImpl(value);
}

class RefImpl {
  public __v_isRef = true; // 增加ref标识
  public _value; // 用来保存ref的值的
  constructor(public rawValue) {
    this._value = toReactive(rawValue);
  }
  get value() {
    return this._value;
  }
  set value(newValue) {
    if (newValue !== this.rawValue) {
      this.rawValue = newValue; // 更新值
      this._value = newValue;
    }
  }
}
```

但是现在并没有任何的依赖收集。现在要添加 dep 来收集

```ts
import { activeEffect, trackEffect, triggerEffect } from "./effect";
import { toReactive } from "./reactive";
import { createDep } from "./reactiveEffect";

export function ref(value) {
  return createRef(value);
}

function createRef(value) {
  return new RefImpl(value);
}

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

function trackRefValue(ref) {
  if (activeEffect) {
    trackEffect(
      activeEffect,
      (ref.dep = createDep(() => (ref.dep = undefined), "undefined"))
    );
  }
}
function triggerRefValue(ref) {
  let dep = ref.dep;
  if (dep) {
    triggerEffect(dep); // 触发依赖更新
  }
}
```

#### 八、toRefs、proxyRef 实现

1、toRef、toRefs

```ts
import {
  ref,
  reactive,
  toRef,
  toRefs,
} from "/packages/reactivity/dist/reactivity.js";

let state = reactive({ name: "lee", age: 23 });
console.log(state);
// let name = toRef(state, 'name')
// let age = toRef(state, 'age')
let { name, age } = toRefs(state);
console.log(name.value);
console.log(age.value);
```

实现

```ts
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

export function toRef(object, key) {
  return new ObjectRefImpl(object, key);
}

export function toRefs(object) {
  let res = [];
  for (let key in object) {
    res[key] = toRef(object, key);
  }
  return res;
}
```

2、proxyRef

```js
import {
  ref,
  reactive,
  toRef,
  toRefs,
  proxyRefs,
} from "/packages/reactivity/dist/reactivity.js";
let state = reactive({ name: "lee", age: 23 });
let proxy = proxyRefs({ ...toRefs(state) });
console.log(proxy.name, proxy.age);
```

实现原理

```ts
// proxyRefs 主要用来在vue3中 template 的 setup 去转换一下ref类型，省去了 .value 繁琐操作
// 本质就是一个proxy，代理了一个取值，修改的功能
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
```
