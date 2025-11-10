#### 零、transition 组件

1、例子

```ts
/*
<style>
    .v-enter-active,
    .v-leave-active {
        transition: opacity 3s ease;
    }

    .v-enter-form,
    .v-leave-to {
        opacity: 0;
    }
</style>
*/

const props = {
  onBeforeEnter() {
    console.log(arguments, "onBeforeEnter");
  },
  onEnter() {
    console.log(arguments, "enter");
  },
  onLeave() {
    console.log(arguments, "leave");
  },
};

render(
  h(Transition, props, {
    default: () => {
      return h("div", {
        style: { width: "100px", height: "100px", background: "red" },
      });
    },
  }),
  app
);

setTimeout(() => {
  render(
    h(Transition, props, {
      default: () => {
        return h("p", {
          style: { width: "100px", height: "100px", background: "blue" },
        });
      },
    }),
    app
  );
}, 1000);
```

2、实现。 新建 Transition.ts

```ts
import { getCurrentInstance } from "../component";
import { h } from "../h";

function nextFrame(fn) {
  requestAnimationFrame(() => {
    requestAnimationFrame(fn);
  });
}

export function resolveTransitionProps(props) {
  const {
    name = "v",
    enterFromClass = `${name}-enter-from`,
    enterActiveClass = `${name}-enter-active`,
    enterToClass = `${name}-enter-to`,
    leaveFromClass = `${name}-enter-from`,
    leaveActiveClass = `${name}-enter-active`,
    leaveToClass = `${name}-enter-to`,
    onBeforeEnter,
    onEnter,
    onLeave,
  } = props;

  return {
    onBeforeEnter(el) {
      onBeforeEnter && onBeforeEnter(el);
      el.classList.add(enterFromClass);
      el.classList.add(enterActiveClass);
    },
    onEnter(el, done) {
      const resolve = () => {
        el.classList.remove(enterToClass);
        el.classList.add(enterActiveClass);
        done && done();
      };
      onEnter && onEnter(el, resolve);
      // 添加后, 再移除, 而不是马上移除
      nextFrame(() => {
        // 保证动画的产生
        el.classList.remove(enterFromClass);
        el.classList.add(enterToClass);
        if (!onEnter || onEnter.length <= 1) {
          // 函数参数个数
          el.addEventListener("transitionEnd", resolve);
        }
      });
    },
    onLeave(el, done) {
      el.classList.add(leaveFromClass);
      document.body.offsetHeight;
      el.classList.add(leaveActiveClass);
    },
  };
}

export function Transition(props, { slots }) {
  console.log(props, slots);
  // 函数式组件的功能比较少, 为了方便, 函数式组件处理了属性
  // 处理属性后传递给状态组件 setup
  return h(BaseTransitionImpl, resolveTransitionProps(props), slots);
}

const BaseTransitionImpl = {
  props: {
    onBeforeEnter: Function,
    onEnter: Function,
    onLeave: Function,
  },
  setup(props, { slots }) {
    const vnode = slots.default && slots.default();
    // const instance = getCurrentInstance()
    if (!vnode) {
      return;
    }
    // 渲染前(离开)和渲染后(进入)
    // const oldVnode = instance.subTree // 之前的虚拟节点
    vnode.transition = {
      beforeEnter: props.onBeforeEnter,
      enter: props.onEnter,
      leave: props.onLeave,
    };
    return vnode;
  },
};
```

修改 renderer.transition 在 mountElement 和 unmount 的时候调用 transition

```ts
const mountElement = (vnode, container, anchor, parentComponent) => {
  const { type, children, props, shapeFlag, transition } = vnode;
  // 第一次渲染的时候我们让虚拟节点和真实节点的dom创建关联 vnode.el = 真实dom
  // 第二次渲染的新的vnode, 可以和上一次的vnode做比对, 之后更新对应的el元素, 可以后续再复用这个dom元素
  let el = (vnode.el = hostCreateElement(type));
  if (props) {
    for (let key in props) {
      hostPatchProp(el, key, null, props[key]);
    }
  }
  if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
    hostSetElementText(el, children);
  } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    mountChildren(children, el, parentComponent);
  }
  if (transition) {
    transition.beforeEnter(el);
  }
  hostInsert(el, container, anchor);
  if (transition) {
    transition.enter(el);
  }
};

const unmount = (vnode) => {
  const { shapeFlag, transition, el } = vnode;
  const performRemove = () => hostRemove(vnode.el);
  if (vnode.type === Fragment) {
    unmountChildren(vnode.children);
  } else if (shapeFlag && ShapeFlags.COMPONENT) {
    // 组件的卸载逻辑
    unmount(vnode.component.subTree);
  } else if (shapeFlag && ShapeFlags.TELEPORT) {
    vnode.type.remove(vnode, unmountChildren);
  } else {
    if (transition) {
      transition.leave(el, performRemove);
    } else {
      performRemove();
    }
  }
};
```

#### 一、keep-alive 组件

1、例子

```ts
// 缓存的是dom, keepalive缓存后不会重新渲染, 而是复用原来的dom元素
// 1、组件不会被重新创建, 会将上一次的结果重新拿出来返回
// 2、组件不会被卸载, 而是将dom移除掉
// 3、内部需要缓存dom

const A1 = {
  setup() {
    onMounted(() => {
      console.log("A1 mounted");
    });
    return () => {
      return h("h1", "a1");
    };
  },
};
const A2 = {
  setup() {
    onMounted(() => {
      console.log("A2 mounted");
    });
    return () => {
      return h("h1", "a2");
    };
  },
};
const A3 = {
  setup() {
    onMounted(() => {
      console.log("A3 mounted");
    });
    return () => {
      return h("h1", "a3");
    };
  },
};

render(
  h(KeepAlive, null, {
    default: () => h(A1),
  }),
  app
);

setTimeout(() => {
  render(
    h(KeepAlive, null, {
      default: () => h(A2),
    }),
    app
  );
}, 1000);

setTimeout(() => {
  render(
    h(KeepAlive, null, {
      default: () => h(A1),
    }),
    app
  );
}, 2000);
```

2、实现、新建 KeepAlive.ts

```ts
export const KeepAlive = {
  __isKeepAlive: true,
  setup(props, { slots }) {
    return () => {
      const vnode = slots.default();
      // 在这个组件中需要一些dom方法, 可以将元素移动到一个div中
      // 还可以卸载某个元素

      return vnode;
    };
  },
};

export const isKeepAlive = (value) => value.__isKeepAlive;
```

修改 component.ts, 增加

```ts
ctx: {} as any, // 如果是keepaliev组件, 就将dom api放入到这个属性上
```

修改 renderer.ts, 如果是 KeepAlive 组件, 往 ctx 里面添加 dom 操作相关方法

```ts
const mountComponent = (vnode, container, anchor, parentComponent) => {
  // 1. 先创建组件实例
  const instance = (vnode.component = createComponentInstance(
    vnode,
    parentComponent
  ));
  if (isKeepAlive(vnode)) {
    instance.ctx.renderer = {
      createElement: hostCreateElement, // 内部需要创建一个div来缓存dom
      move(vnode, container) {
        // 需要把之前渲染的dom放入到容器中
        hostInsert(vnode.component.subTree.el, container);
      },
      unmount, // 如果组件切换需要将现在容器中的元素移除
    };
  }
  // 2. 给实例的属性赋值
  setupComponent(instance);
  // 3. 创建一个effect
  setupRenderEffect(instance, container, anchor);
};
```

完整实现

```ts
import { ShapeFlags } from "@vue/shared";
import { onMounted, onUpdated } from "../apiLifecycle";
import { getCurrentInstance } from "../component";

export const KeepAlive = {
  __isKeepAlive: true,
  props: {
    max: Number,
  },
  setup(props, { slots }) {
    const { max } = props;
    const keys = new Set(); // 用来记录哪些组件被缓存过
    const cache = new Map(); // 缓存表 <keep-alive> </keep-alive>

    // 在这个组件中需要一些dom方法, 可以将元素移动到一个div中
    // 还可以卸载某个元素
    let pendingCacheKey = null;
    const instance = getCurrentInstance();
    const cacheSubTree = () => {
      cache.set(pendingCacheKey, instance.subTree); // 缓存组件的虚拟节点, 里面有组件的dom元素······················
    };

    // 这里是keepalive特有的初始化方法
    const { move, createElement, unmount: _unmount } = instance.ctx.renderer;

    function reset(vnode) {
      let shapeFlag = vnode.shapeFlag;
      if (shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE) {
        shapeFlag -= ShapeFlags.COMPONENT_KEPT_ALIVE;
      }
      if (shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE) {
        shapeFlag -= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE;
      }
      vnode.shapeFlag = shapeFlag;
    }

    function unmount(vnode) {
      reset(vnode); // 将vnode标识去除
      _unmount(vnode); // 真正的做删除
    }

    function purneCacheEntry(key) {
      keys.delete(key);
      const cached = cache.get(key); // 之前缓存的结果
      unmount(cached.component.subTree);
    }

    // 激活时执行
    instance.ctx.activated = function (vnode, container, anchor) {
      move(vnode, container, anchor);
    };
    // 卸载时执行
    const storageContent = createElement("div");
    instance.ctx.deactivated = function (vnode, container) {
      move(vnode, storageContent, null); // 将dom元素临时移动到这个div中, 但是没有被销毁
    };
    onMounted(cacheSubTree());
    onUpdated(cacheSubTree());

    // 缓存的是组件 ——> 组件里有subTree ——> subTree上有el元素 ——> 移动到页面中
    return () => {
      const vnode = slots.default();

      const comp = vnode.type;
      const key = vnode.key == null ? comp : vnode.key;

      const cacheVnode = cache.get(key);
      pendingCacheKey = key;
      if (cacheVnode) {
        vnode.component = cacheVnode.component; // 不要再重新创建组件的实例了, 直接复用即可
        vnode.shapeFlag |= ShapeFlags.COMPONENT_KEPT_ALIVE; // 告诉他不要做初始化操作
        keys.delete(key);
        keys.add(key); // 刷新缓存
      } else {
        keys.add(key);
        if (max && keys.size > max) {
          // 达到了最大的缓存个数
          // set中的第一个元素
          purneCacheEntry(keys.values().next().value);
        }
      }
      vnode.shapeFlag |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE; // 这个组件不需要真的卸载,
      return vnode; // 等待组件加载完毕后去缓存
    };
  },
};

export const isKeepAlive = (value) => value.type.__isKeepAlive;
```

#### 二、异步组件

1、defineAsyncComponent
例子

```ts
import {
  render,
  h,
  Text,
  Fragment,
} from "/packages/runtime-dom/dist/runtime-dom.js";
const AsyncComponent = import("./asyncComponent.js");

// const MyComponent = defineAsyncComponent(() => {
//     return AsyncComponent
// })
const MyComponent = defineAsyncComponent({
  loader: () => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        reject({
          render: () => {
            return h("div", "hello");
          },
        });
      }, 3000);
    });
  },
  timeout: 1000,
  delay: 500,
  errorComponent: {
    render: () => {
      return h("div", "error~~~~~");
    },
  },
});

render(h(MyComponent), app);
```

asyncComponent.js

```js
import { ref } from "@vue/reactivity";
import { h } from "./h";
import { isFunction } from "@vue/shared";

export function defineAsyncComponent(options) {
  if (isFunction(options)) {
    options = {
      loader: options,
    };
  }
  const { loader, timeout, errorComponent, delay } = options;
  return {
    setup() {
      const loaded = ref(false);
      const loading = ref(false);
      let Comp = null;
      let error = null;
      loader()
        .then((comp) => {
          Comp = comp;
          loaded.value = true;
        })
        .catch((err) => {
          error.value = err;
        })
        .finally(() => {
          loading.value = false;
        });

      if (delay) {
        setTimeout(() => {
          loading.value = true;
        }, delay);
      }

      if (timeout) {
        setTimeout(() => {
          error.value = true;
          throw new Error("组件加载失败");
        }, timeout);
      }

      const placeholder = h("div");

      return () => {
        if (loaded.value) {
          return h(Comp);
        } else if (error.value && errorComponent) {
          return h(errorComponent);
        } else if (loading.value) {
          return h("div", "loading~~~~~");
        } else {
          return placeholder;
        }
      };
    },
  };
}
```

