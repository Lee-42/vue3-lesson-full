#### 一、通过属性更新组件

1、例子

```ts
// import { ref, reactive, toRef, toRefs, proxyRefs, computed, effect, watch } from '/node_modules/@vue/reactivity/dist/reactivity.esm-browser.js'
// import { h, Text, render, Fragment } from '/node_modules/@vue/runtime-dom/dist/runtime-dom.esm-browser.js'
import {
  render,
  h,
  Text,
  Fragment,
} from "/packages/runtime-dom/dist/runtime-dom.js";

const RenderComponent = {
  props: {
    address: String,
  },
  render() {
    return h("div", {}, `地址是:${this.address}`);
  },
};

// 组件更新有三种方式, 状态、属性(props)、插槽(slots)
const VueComponent = {
  data() {
    return {
      flag: true,
    };
  },
  props: {
    name: String,
    age: Number,
  },
  render(proxy) {
    return h(Fragment, null, [
      h(
        "button",
        {
          onClick: () => this.flag,
        },
        "点击"
      ),
      h(RenderComponent, { address: this.flag ? "北京" : "上海" }),
    ]);
  },
};
render(h(VueComponent, { a: 1, b: 2, name: "lee", age: 23 }), app);
```

2、走到 processComponent 的 else

```ts
const hasPropsChanged = (prevProps, nextProps) => {
  const nextKeys = Object.keys(nextProps);
  if (nextKeys.length !== Object.keys(prevProps).length) {
    return true;
  }
  for (let i = 0; i < nextKeys.length; i++) {
    const key = nextKeys[i];
    if (nextProps[key] !== prevProps[key]) {
      return true;
    }
  }
  return false;
};

const updateProps = (instance, prevProps, nextProps) => {
  if (hasPropsChanged(prevProps, nextProps)) {
    // 用新的覆盖掉所有老的
    for (let key in nextProps) {
      instance.props[key] = nextProps[key];
    }
    // 删除老的多余的
    for (let key in instance.props) {
      if (!(key in nextProps)) {
        delete instance.props[key];
      }
    }
  }
};

const updateComponent = (n1, n2) => {
  const instance = (n2.component = n1.component); // 复用组件的实例
  // 更新属性
  const { props: prevProps } = n1;
  const { props: nextProps } = n2;
  updateProps(instance, prevProps, nextProps); // 还可能有children
};

const processComponent = (n1, n2, container, anchor) => {
  if (n1 === null) {
    mountComponent(n2, container, anchor);
  } else {
    // 组件更新逻辑
    // n1.component.props.address = "上海"
    updateComponent(n1, n2);
  }
};
```

#### 二、整合组件更新流程

1、目前状态更新和属性更新 是分开的
早期 Vue3 源代码确实是分开的, 但是后期做了整合

2、修改 updateComponent

```ts
const shouldComponentUpdate = (n1, n2) => {
  const { props: prevProps, children: prevChildren } = n1;
  const { props: nextProps, children: nextChildren } = n2;
  if (prevChildren || nextChildren) return true; /// 有插槽直接走重新渲染即可
  if (prevProps === nextProps) return false;
  // 如果属性不一致则更新
  return hasPropsChanged(prevProps || {}, nextProps || {});
};

const updateComponent = (n1, n2) => {
  const instance = (n2.component = n1.component); // 复用组件的实例
  // 更新属性
  // const { props: prevProps } = n1;
  // const { props: nextProps } = n2;
  // updateProps(instance, prevProps, nextProps); // 还可能有children

  if (shouldComponentUpdate(n1, n2)) {
    instance.next = n2; // 用于更新属性, 如果调用update的时候有next属性, 说明是属性更新, 插槽更新
    instance.update(); // 触发更新, 让更新逻辑统一
  } else {
    n2.el = n1.el;
    instance.vnode = n2;
  }
};
```

3、修改 setupRenderEffect, 增加 updateComponentPreRender

```ts
function updateComponentPreRender(instance, next) {
  instance.next = null;
  instance.vnode = next;
  updateProps(instance, instance.vnode.props, next.props);
  // 这里还可以更新插槽
}
// setupRenderEffect
```

#### 三、setup 入口实现

1、每个组件只会执行一次, 可以放入 composition api
2、例子

```ts
const VueComponent = {
  render(props) {
    return h("div", "abcd");
  },
  // setup优先级更高
  setup(props, { emit, attrs, expose, slots }) {
    // 提供渲染逻辑
    // 情况一: 返回渲染函数
    return () => {
      return h("div", "abcd");
    };
    // 情况二: 返回状态对象, 可以在render的props拿到
    // return {
    //     a: 1
    // }
  },
};
```

3、setupComponent 添加 setup 逻辑

```ts
export function setupComponent(instance) {
  const { vnode } = instance;
  // 赋值属性
  initProps(instance, vnode.props);
  // 赋值代理对象
  instance.proxy = new Proxy(instance, handler);
  const { data = () => {}, render, setup } = vnode.type;
  if (setup) {
    const setupContext = {
      // ...
    };
    const setupResult = setup(instance.props, setupContext);
    if (isFunction(setupResult)) {
      instance.render = setupResult;
    } else {
      instance.setupState = setupResult;
    }
  }
  if (!isFunction(data)) {
    console.warn("data option must be a function");
  } else {
    // data 中可以拿到props
    instance.data = reactive(data.call(instance.proxy));
  }
  instance.render = render;
}
```

#### 四、插槽实现

1、处理 setupContext
2、例子

```ts
const RenderComponent = {
  render(props) {
    console.log(proxy.$slots);
    return h(
      Fragment,
      [proxy.$slots.header("hhhh"), proxy.$slots.footer("ffff")],
      "abcd"
    );
  },
};

const VueComponent = {
  setup(props, { emit, attrs, expose, slots }) {
    return (proxy) => {
      return h(RenderComponent, null, {
        header: (t) => h("hedaer", "header slot" + t),
        footer: (t) => h("footer", "footer slot" + t),
      });
    };
  },
};
```

3、先修改 h 方法, createVnode.ts

```ts
export function createVnode(type, props, children?) {
  ...
  if (children) {
    if (Array.isArray(children)) {
      vnode.shapeFlag |= ShapeFlags.ARRAY_CHILDREN;
    } else if(isObject(children)){
      vnode.shapeFlag |= ShapeFlags.SLOTS_CHILDREN;
    }else {
      children = String(children);
      vnode.shapeFlag |= ShapeFlags.TEXT_CHILDREN;
    }
  }
  ...
}
```

setupComponent 中初始化 slots

```ts
export function setupComponent(instance) {
  ...
  initSlots(instance, vnode.children);
  ...
}

const initSlots = (instance, children) => {
  if (instance.vnode.shapeFlag & ShapeFlags.SLOTS_CHILDREN) {
    instance.slots = children;
  }else{
    instance.slots = {};
  }
};
```

实现 $slots

```ts
const publicProperty = {
  $attrs: (instance) => instance.attrs,
  $slots: (instance) => instance.slots,
};
```

#### 五、组件 emit 及卸载

1、例子

```ts
const VueComponent = {
  setup(props, { emit, attrs, expose, slots }) {
    return (proxy) => {
      return h("button", { onClick: () => emit("myEvent", 100) }, "点击我");
    };
  },
};

// 给组件绑定事件
render(VueComponent, { onMyEvent: (value) => alert(value) }, app);
// 组件卸载
setTimeout(() => {
  render(h(null), { onMyEvent: (value) => alert(value) }, app);
}, 1000);
```

2、修改 setupComponent 函数

```ts
const setupContext = {
  // ...
  slots: instance.slots,
  attrs: instance.attrs,
  expose(value) {
    instance.expose = value || {};
  },
  emit(event, ...payload) {
    // onMyEvent
    const eventName = `on${event[0].toUpperCase()}${event.slice(1)}`;
    const handler = instance.vnode.props[eventName];
    handler && handler(...payload);
  },
};
```

3、组件的卸载

```ts
const unmount = (vnode) => {
  const { shapeFlag } = vnode;
  if (vnode.type === Fragment) {
    unmountChildren(vnode.children);
  } else if (shapeFlag && ShapeFlags.COMPONENT) {
    // 组件的卸载逻辑
    unmount(vnode.component.subTree);
  } else {
    hostRemove(vnode.el);
  }
};
```

#### 六、teleport 实现

1、例子

```ts
render(h(Teleport, { to: "#root" }, [123, "abc"]), app);
```

2、实现
新建 Teleport.ts

```ts
import { ShapeFlags } from "@vue/shared";

export const TEleport = {
  __isTeleport: true,
  remove(vnode, unmountChildren) {
    const { shapeFlag, children } = vnode;
    if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      unmountChildren(children);
    }
  },
  process(n1, n2, container, anchor, parentComponent, internals) {
    let { mountChildren, patchChildren, move } = internals;
    // 看n1、n2的关系
    if (!n1) {
      const target = (n2.target = document.querySelector(n2.props.to));
      if (target) {
        mountChildren(n2.children, target, parentComponent);
      }
    } else {
      patchChildren(n1, n2, n2.target, parentComponent);
      if (n2.props.to !== n1.props.to) {
        const nextTarget = (n2.target = document.querySelector(n2.props.to));
        n2.children.forEach((childVnode) => {
          move(childVnode, nextTarget, anchor);
        });
      }
    }
  },
};

export const isTeleport = (value) => value && value.__isTeleport;
```

修改 createVnode

```ts
const shapeFlag = isString(type)
  ? ShapeFlags.ELEMENT // 元素组件 div、span...
  : isTeleport(type)
  ? ShapeFlags.TELEPORT // teleport 组件
  : isObject(type)
  ? ShapeFlags.STATEFUL_COMPONENT // 组件
  : isFunction(type)
  ? ShapeFlags.FUNCTIONAL_COMPONENT // 函数式组件
  : 0;
```

修改 renderer -> patch()

```ts
if (shapeFlag & ShapeFlags.ELEMENT) {
  processElement(n1, n2, container, anchor, parentComponent);
} else if (shapeFlag & ShapeFlags.TELEPORT) {
  // teleport 组件的处理逻辑
  type.process(n1, n2, container, anchor, parentComponent, {
    mountChildren,
    patchChildren,
    move(vnode, container, anchor) {
      // 此方法可以将组件或者dom元素移动到指定位置
      hostInsert(
        vnode.component ? vnode.component.subTree.el : vnode.el,
        container,
        anchor
      );
    },
  });
} else if (shapeFlag & ShapeFlags.COMPONENT) {
  processComponent(n1, n2, container, anchor);
}
```

#### 七、provide、inject 实现

1、例子

```ts

```

2、

```ts
export function createComponentInstance(vnode, parent) {
  const instance = {
    data: null, // 状态
    vnode: vnode, // 组件的虚拟节点
    subTree: null, // 子树
    isMounted: false, // 是否挂载完成
    update: null, // 组件的更新的函数
    props: {},
    attrs: {},
    slots: {},
    propsOptions: vnode.type.props, // 用户声明的哪些属性是组件的属性
    component: null,
    proxy: null, // 用来代理props、attrs、data让用户更方便的访问
    setupState: {},
    expose: {},
    parent,
    provides: parent ? parent.provides : Object.create,
  };
  return instance;
}
```

2、patch() 增加 parentComponent 参数

3、新建apiProvide.ts
```ts
import { currentInstance } from "./component";

export function provide(key, value) {
  // 子用的是父, 子提供了顺序, 子提供的给了父
  // {a: 1}    {a: 1, b: 2}
  // {a: 1}   {a: 1, b:2, c:3}
  if (!currentInstance) return; // 建立在组件基础上的
  const parentProvide = currentInstance.parent?.provides; // 获取父组件的provides
  let provides = currentInstance.provide;
  if (parentProvide === provides) {
    //  如果在子组件上新增了provides需要拷贝一份全新的
    provides = currentInstance.provides = Object.create(provides);
  }
  provides[key] = value;
}

export function inject(key, defaultValue) {
  if (!currentInstance) return; // 建立在组件基础上的
  const provides = currentInstance.parent?.provides;
  if (provides && key in provides) {
    return provides[key]; // 直接从provides中取出来使用
  } else {
    return defaultValue; // 默认的inject
  }
}
```

4、
```ts
const normalize = (children) => {
    for (let i = 0; i < children.length; i++) {
      if (typeof children[i] === "string" || typeof children[i] === "number") {
        children[i] = createVnode(Text, null, String(children[i]));
      }
    }
  };

  const mountChildren = (children, container, parentComponent) => {
    normalize(children);
    for (let i = 0; i < children.length; i++) {
      patch(null, children[i], container, parentComponent);
    }
  };
```

#### 八、函数式组件原理
1、例子
```ts
 function functionComponent(props){
    return h("div", props.a + props.b)
}

render(h(functionComponent, {a: 1, b:2}), app)
```
已经基本不用了，vue3中没有任何性能优化
```ts
function renderComponent(instance){
    const { render, vnode, proxy, props, attrs }  = instance
    if(vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT){
      render.call(proxy, proxy)
    }else{
      vnode.type(attrs)
    }
  }
```

#### 九、ref实现原理
1、


#### 十、生命周期实现原理
1、例子
```ts
// 父初始化 ——> 子初始化 ——> 父完成 
        const VueComponent = {
            setup(props, { emit, expose, slots, attrs }) {
                console.log('setup')
                // instance -> 钩子关联在一起, 在特定的时机调用
                onBeforeMount(() => {
                    console.log('beforemount')
                });
                onMounted(() => {
                    console.log('mounted')
                });
                onBeforeUpdate(() => {
                    console.log('onBeforeUpdate')
                })
                onUpdated(() => {
                    console.log('updated')
                })

                const val = ref('a')

                setTimeout(() => {
                    val.value = 'b'
                })

                return () => {
                    return h('div', val.value)
                }
            },
        }

        render(h(VueComponent), app)
```

2、新建apiLifecycle.ts
```ts
import {
  currentInstance,
  setCurrentInstance,
  unsetCurrentInstance,
} from "./component";

export const enum LifeCycles {
  BEFORE_MOUNT = "bm",
  MOUNTED = "m",
  BEFORE_UPDATE = "bu",
  UPDATED = "u",
}

function createHook(type) {
  return (hook, target = currentInstance) => {
    console.log(type, hook);
    if (target) {
      // 当前钩子是在组件中运行的
      // 看当前钩子是否存放, 发布订阅
      const hooks = target[type] || (target[type] = []);
      // 让currentInstance存到这个函数内部
      const wrapHook = () => {
        // 在钩子执行前, 对实例进行校正处理
        setCurrentInstance(currentInstance);
        hook();
        unsetCurrentInstance();
      };

      // 在执行函数内部保证实例是正确的
      hooks.push(hook); // 这里有坑, 因为setup执行完毕后, 就会将instance清空
      hooks.push(wrapHook);
    }
  };
}

export const onBeforeMount = createHook(LifeCycles.BEFORE_MOUNT);
export const onMounted = createHook(LifeCycles.MOUNTED);
export const onBeforeUpdate = createHook(LifeCycles.BEFORE_UPDATE);
export const onUpdated = createHook(LifeCycles.UPDATED);

export function invokeArray(fns) {
  for (let i = 0; i < fns.length; i++) {
    fns[i]();
  }
}
```

4、修改component.ts
```ts
export let currentInstance = null;
export const getCurrentInstance = () => {
  return currentInstance;
};

export const setCurrentInstance = (instance) => {
  currentInstance = instance;
};

export const unsetCurrentInstance = () => {
  currentInstance = null;
};
```










































































