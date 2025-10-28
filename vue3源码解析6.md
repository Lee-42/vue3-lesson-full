#### 一、vue 组件渲染

1、使用 options api

```ts
// 这就是一个vue组件
const VueComponent = {
  data() {
    return { name: "lee", age: 28 };
  },
  render() {
    return h(Fragment, [h(Text, "my name is " + this.name), h("a", this.age)]);
  },
};
// 模板就是render函数
// 组件由两个虚拟节点组成, h(VueComponent) = vnode 产生的是组件内的虚拟节点
// render函数返回的虚拟节点, 这个虚拟节点才是最终要渲染的内容 = subTree
render(h(VueComponent), app);
```

2、实现, 创建虚拟节点的时候, 增加组件类型判断

```ts
export function createVnode(type, props, children?) {
  const shapeFlag = isString(type)
    ? ShapeFlags.ELEMENT // 元素组件 div、span...
    : isObject(type)
    ? ShapeFlags.COMPONENT // 组件
    : 0;
    .....
}
```

3、patch 的时候, 处理组件节点

```ts
switch (type) {
  case Text:
    processText(n1, n2, container);
    break;
  case Fragment:
    processFragment(n1, n2, container);
    break;
  default:
    if (shapeFlag & ShapeFlags.ELEMENT) {
      processElement(n1, n2, container, anchor);
    } else if (shapeFlag & ShapeFlags.COMPONENT) {
      processComponent(n1, n2, container, anchor);
    }
    break;
}
```

4、实现 processComponent

```ts
const mountComponent = (n2, container, anchor) => {
  // 组件可以基于自己的状态重新渲染, effect
  const { data = () => {}, render } = n2.type; // type、children、props
  const state = reactive(data()); // 组件的状态

  const componentUpdateFn = () => {
    // 我们要在这里面区分, 是第一次还是之后的
    const subTree = render.call(state, state);
    patch(null, subTree, container, anchor);
  };
  const effect = new ReactiveEffect(componentUpdateFn, () => update());
  const update = () => {
    effect.run();
  };
  update();
};

const processComponent = (n1, n2, container, anchor) => {
  if (n1 === null) {
    mountComponent(n2, container, anchor);
  } else {
    // 组件更新逻辑
  }
};
```

5、更新, 看下面的逻辑

```ts
// 这就是一个vue组件
const VueComponent = {
  data() {
    return { name: "lee", age: 28 };
  },
  render() {
    // 虽然不能在渲染函数里修改state, 这里这样写只是为了演示
    setTimeout(() => {
      this.age++;
    }, 1000);
    return h(Fragment, [h(Text, "my name is " + this.name), h("a", this.age)]);
  },
};
// 模板就是render函数
// 组件由两个虚拟节点组成, h(VueComponent) = vnode 产生的是组件内的虚拟节点
// render函数返回的虚拟节点, 这个虚拟节点才是最终要渲染的内容 = subTree
render(h(VueComponent), app);
```

通过创建一个示例 instance 来保存上一次的 subTree 和 isMounted 状态。来判断是首次挂载还是更新

```ts
const mountComponent = (n2, container, anchor) => {
  // 组件可以基于自己的状态重新渲染, effect
  const { data = () => {}, render } = n2.type; // type、children、props
  const state = reactive(data()); // 组件的状态

  const instance = {
    state, // 状态
    vnode: n2, // 组件的虚拟节点
    subTree: null, // 子树
    isMounted: false, // 是否挂载完成
    update: null, // 组件的更新的函数
  };

  const componentUpdateFn = () => {
    // 我们要在这里面区分, 是第一次还是之后的
    if (!instance.isMounted) {
      const subTree = render.call(state, state);
      patch(null, subTree, container, anchor);
      instance.isMounted = true;
      instance.subTree = subTree;
    } else {
      // 基于状态的组件更新
      const subTree = render.call(state, state);
      patch(instance.subTree, subTree, container, anchor);
      instance.subTree = subTree;
    }
  };
  const effect = new ReactiveEffect(componentUpdateFn, () => update());
  const update = (instance.update = () => effect.run());
  update();
};
```

6、批量更新, 看下面的情况

```ts
const VueComponent = {
  data() {
    return { name: "lee", age: 28 };
  },
  render() {
    setTimeout(() => {
      this.age++; // 这里修改两次属性状态, 会导致组件更新太频繁, 其实修改两次状态, 只需要更新一次就可以了
      this.age++;
    }, 1000);
    return h(Fragment, [h(Text, "my name is " + this.name), h("a", this.age)]);
  },
};
render(h(VueComponent), app);
```

把当前的更新 放到一个更新队列里去

#### 二、组件的异步更新

1、实现

```ts
// 把当前的更新 放到一个更新队列里去
const effect = new ReactiveEffect(componentUpdateFn, () => queueJob(update));
```

新建 scheduler.ts

```ts
const queue = [];
let isFlushing = false;
const resolvePromise = Promise.resolve();

// 如果同时在一个组件中更新多个状态, job肯定是同一个
// 同时开启一个异步任务
export function queueJob(job) {
  if (!queue.includes(job)) {
    // 去重同名的
    queue.push(job); // 让任务入队列
  }
  if (!isFlushing) {
    isFlushing = true;
    resolvePromise.then(() => {
      isFlushing = false;
      const copy = queue.slice(0); // 先拷贝再执行
      queue.length = 0;
      copy.forEach((job) => job());
      copy.length = 0;
    });
  }
}
```

#### 三、组件 props 及 attrs 实现

1、使用

```ts
// 这就是一个vue组件
// 属性attrs(非响应式的), props(响应式的)
// 所有属性 减去 propsOptions = attrs
const VueComponent = {
  props: {
    name: String,
    age: Number,
  },
  render(proxy) {
    console.log(proxy);
    return h(Fragment, [
      h(Text, "my name is " + proxy.$attrs.a),
      h("a", proxy.$attrs.b),
    ]);
  },
};
// 模板就是render函数
// 组件由两个虚拟节点组成, h(VueComponent) = vnode 产生的是组件内的虚拟节点
// render函数返回的虚拟节点, 这个虚拟节点才是最终要渲染的内容 = subTree
render(h(VueComponent, { a: 1, b: 2, name: "lee", age: 23 }), app);
```

2、实现。 instance 添加 props、attrs 属性

```ts
const instance = {
  state, // 状态
  vnode: vnode, // 组件的虚拟节点
  subTree: null, // 子树
  isMounted: false, // 是否挂载完成
  update: null, // 组件的更新的函数
  props: {},
  attrs: {},
  propsOptions,
  component: null,
};
// 根据propsOptions来区分props, attrs
vnode.component = instance;
// 元素更新 n2.el = n1.el
// 组件更新 n2.component.subTree.el = n1.components.subTree.el
initProps(instance, vnode.props);
```

实现 initProps

```ts
// 初始化属性
const initProps = (instance, rawProps) => {
  const props = {};
  const attrs = {};
  const propsOptions = instance.propsOptions || {}; // 组件中定义的
  if (rawProps) {
    for (let key in rawProps) {
      // 用所有的来分裂
      const value = rawProps[key]; // todo 属性值校验
      if (key in propsOptions) {
        props[key] = value;
      } else {
        attrs[key] = value;
      }
    }
  }
  instance.attrs = attrs;
  instance.props = reactive(props);
};
```

到这里还差一步,我们访问的是 proxy.$attrs.xxx。 还差一个代理对象

#### 四、组件中的代理对象

1、

```ts
const publicProperty = {
  $attrs: (instance) => instance.attrs,
};
// render.call(state, state);这里要改一下, 要实现可以拿到props.name、attrs.a、data.xxx 等。 通过代理的方式
instance.proxy = new Proxy(instance, {
  get(target, key) {
    const { state, props } = target;
    if (state && hadOwn(state, key)) {
      return state[key];
    } else if (props && hadOwn(props, key)) {
      return props[key];
    }
    // 对于一些无法修改的属性, $slots $attrs... ——> 需要从 instance.attrs取, 并且没有set
    const getter = publicProperty[key];
    if (getter) return getter(target);
  },
  set(target, key, value) {
    const { state, props } = target;
    if (state && hadOwn(state, key)) {
      state[key] = value;
    } else if (props && hadOwn(props, key)) {
      props[key] = value;
    }

    return true;
  },
});

const componentUpdateFn = () => {
  // 我们要在这里面区分, 是第一次还是之后的
  if (!instance.isMounted) {
    const subTree = render.call(instance.proxy, instance.proxy);
    patch(null, subTree, container, anchor);
    instance.isMounted = true;
    instance.subTree = subTree;
  } else {
    // 基于状态的组件更新
    const subTree = render.call(instance.proxy, instance.proxy);
    patch(instance.subTree, subTree, container, anchor);
    instance.subTree = subTree;
  }
};
```

#### 五、组件渲染流程整理

1、抽离代码。 挂载组件的逻辑可以分为下面几步

```ts
const mountComponent = (vnode, container, anchor) => {
  // 1. 先创建组件实例
  const instance = (vnode.component = createComponentInstance(vnode));
  // 2. 给实例的属性赋值
  setupComponent(instance);
  // 3. 创建一个effect
  setupRenderEffect(instance, container, anchor);
};
```

新建 component.ts

```ts
import { hadOwn, isFunction } from "@vue/shared";
import { reactive } from "@vue/reactivity";

export function createComponentInstance(vnode) {
  const instance = {
    data: null, // 状态
    vnode: vnode, // 组件的虚拟节点
    subTree: null, // 子树
    isMounted: false, // 是否挂载完成
    update: null, // 组件的更新的函数
    props: {},
    attrs: {},
    propsOptions: vnode.type.props, // 用户声明的哪些属性是组件的属性
    component: null,
    proxy: null, // 用来代理props、attrs、data让用户更方便的访问
  };
  return instance;
}

const publicProperty = {
  $attrs: (instance) => instance.attrs,
};

// 初始化属性
const initProps = (instance, rawProps) => {
  const props = {};
  const attrs = {};
  const propsOptions = instance.propsOptions || {}; // 组件中定义的
  if (rawProps) {
    for (let key in rawProps) {
      // 用所有的来分裂
      const value = rawProps[key]; // todo 属性值校验
      if (key in propsOptions) {
        props[key] = value;
      } else {
        attrs[key] = value;
      }
    }
  }
  instance.attrs = attrs;
  instance.props = reactive(props);
};

const handler = {
  get(target, key) {
    const { data, props } = target;
    if (data && hadOwn(data, key)) {
      return data[key];
    } else if (props && hadOwn(props, key)) {
      return props[key];
    }
    // 对于一些无法修改的属性, $slots $attrs... ——> 需要从 instance.attrs取, 并且没有set
    const getter = publicProperty[key];
    if (getter) return getter(target);
  },
  set(target, key, value) {
    const { data, props } = target;
    if (data && hadOwn(data, key)) {
      data[key] = value;
    } else if (props && hadOwn(props, key)) {
      props[key] = value;
    } else {
      console.log("props are readonly");
      return false;
    }
    return true;
  },
};

export function setupComponent(instance) {
  const { vnode } = instance;
  // 赋值属性
  initProps(instance, vnode.props);
  // 赋值代理对象
  instance.proxy = new Proxy(instance, handler);
  const { data = () => {}, render } = vnode.type;
  if (!isFunction(data)) return console.warn("data option must be a function");
  // data 中可以拿到props
  instance.data = reactive(data.call(instance.proxy));
  instance.render = render;
}
```
