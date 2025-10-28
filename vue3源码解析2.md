#### 一、计算属性实现

1、使用

```ts
// computed 计算属性
// computed执行后的结果是一个ref, 不可变的
// 通过dirty变量缓存
// ### 描述实现原理
// 1. 计算属性维护了一个dirty属性,默认就是true, 稍后运行过一次会将dirty变为false, 并且稍后依赖的值变化后会再次让dirty变成true
// 2. 计算属性也是一个effect, 依赖的属性会收集这个计算属性, 当前值变化后, 会让computedEffect里面dirty变成true
// 3. 计算属性具备收集能力, 可以收集对应的effect, 依赖的值变化后会触发effect重新执行
const state = reactive({ name: "lee" });
const aliasName = computed({
  get(oldValue) {
    console.log("runner", oldValue);
    return "**" + state.name;
  },
  set(v) {
    console.log(v);
  },
});
// 多次访问此属性, 只会执行一次
effect(() => {
  console.log(aliasName.value);
  console.log(aliasName.value);
  console.log(aliasName.value);
});
```

2、往 effect 类添加 dirty 属性

```ts
class ReactiveEffect {
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

  public get dirty(){
    return this._dirtyLevel === DirtyLevels.Dirty
  }
  public set dirty(v){
    this._dirtyLevel = v ? DirtyLevels.Dirty : DirtyLevels.NoDirty
  }
  run() {
    this._dirtyLevel = DirtyLevels.NoDirty  // 每次运行后, 此值就不脏了
    // 不是激活的, 执行后什么都不用做
  }
  ...........
}
```

3、新建 computed.ts

```ts
import { isFunction } from "@vue/shared";
import { ReactiveEffect } from "vue";
import { trackRefValue, triggerRefValue } from "./ref";

class ComputedRefImpl {
  public _value;
  public effect;
  constructor(getter, public setter) {
    // 我们需要创建一个effect来关联当前计算属性的dirty属性
    this.effect = new ReactiveEffect(
      () => getter(this._value),
      () => {
        // 计算属性依赖的值变化了, 我们应该触发effect渲染
        triggerRefValue(this);
        // 依赖的属性变化后需要重新触发渲染, 需要把dirty变为true
      }
    );
  }
  get value() {
    // 这里我们需要做额外处理(缓存)
    if (this.effect.dirty) {
      // 默认取值一定是脏的, 但是执行一次之后就不脏了
      this._value = this.effect.run();
      // 并且记录effect。 如果当前在effect中访问了计算属性, 计算属性是可以收集这个effect的
      trackRefValue(this);
    }
    return this._value;
  }
  set value(v) {
    // 这个就是ref的setter
    this.setter(v);
  }
}

export function computed(getterOrOptions) {
  let onlyGetter = isFunction(getterOrOptions);
  let getter;
  let setter;
  if (onlyGetter) {
    getter = getterOrOptions;
    setter = () => {};
  } else {
    getter = getterOrOptions.get;
    setter = getterOrOptions.set;
  }
  return new ComputedRefImpl(getter, setter);
}
```

#### 二、watch 原理实现

1、使用

```ts
const state = reactive({ name: "lee", age: 30, address: { n: 1 } });
watch(
  state,
  function (oldVal, newVal) {
    console.log(oldVal, newVal);
  },
  {
    deep: false,
  }
);

setTimeout(() => {
  state.name = "cool lee";
}, 3000);
```

2、实现

```ts
import { isObject } from "@vue/shared";
import { ReactiveEffect } from "vue";

export function watch(source, cb, options = {} as any) {
  // watchEffect也是基于doWatch来实现的
  return doWatch(source, cb, options);
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

function doWatch(source, cb, { deep }) {
  const reactiveGetter = (source) => {
    traverse(source, deep === false ? 1 : undefined);
  };

  // 产生一个可以给ReactiveEffect来使用的getter, 需要对这个对象进行取值操作, 会关联当前的reactiveEffect
  let getter = () => reactiveGetter(source);
  let oldValue;

  const job = () => {
    const newValue = effect.run();
    cb(oldValue, newValue);
    oldValue = newValue;
  };
  const effect = new ReactiveEffect(getter, job);
  oldValue = effect.run();
}
```

#### 三、watchEffect 实现

1、使用

```ts
const state = reactive({ name: "lee", age: 30, address: { n: 1 } });
watchEffect(() => {
  console.log(state.name + state.age);
});
```

2、实现

```ts
export function watchEffect(source, options = {}) {
  return doWatch(source, null, options as any);
}
```

#### 四、清理函数

1、watch 会返回 unwatch

```ts
const state = reactive({ name: "lee", age: 30, address: { n: 1 } });
const unwatch = watch(
  state,
  () => state.name,
  function (oldVal, newVal) {
    console.log(oldVal, newVal);
  },
  {
    deep: false,
  }
);

unwatch(); // 停止watch

setTimeout(() => {
  state.name = "cool lee";
}, 3000);
```

实现

```ts
function doWatch(source, cb, { deep, immediate }) {
  .....
  const unwatch = () => {
    effect.stop()
  }
  return unwatch
}
```

effect.ts 实现 stop 方法

```ts
export class ReactiveEffect {
  ....
  stop() {
    if (this.active) {
      this.active = false;
      preCleanEffect(this);
      postCleanEffect(this);
    }
  }
}
```


2、cleanup