#### 一、runtime-dom 实现

1、使用

```js
import {
  createRenderer,
  render,
  h,
} from "/packages/runtime-dom/dist/runtime-dom.js";
// runtime-dom的作用就是提供DOM API(提供一系列dom操作的api方法)
//  平时使用的Vue包其实就是 runtime-dom 包
// 0.runtime-dom ——> runtime-core ——> reactivity
// 1.createRender: 我们可以自己创建渲染器(让我们自己提供渲染的方式, 自己实现一个render)
// 2.render: 用内置的渲染器来进行渲染(渲染dom元素)
// 3.h方法可以创建一个虚拟dom
let ele = h("div", "lee");
render(ele, app);

const renderer = createRenderer({
  createElement(type) {
    // 需要创建一个元素
    // canvas调用对应的api来渲染
    return document.createElement("h1");
  },
  setElementText(el, text) {
    el.textContent = text;
  },
  insert(el, container) {
    container.appendChild(el);
  },
});
renderer.render(ele, app);
```

2、实现 createRenderer
新建 runtime-dom/index.ts

```ts
export * from "@vue/reactivity";

import { nodeOps } from "./nodeOps";
import patchProp from "./patchProp";

// 将节点操作和属性操作合并在一起
const renderOptions = Object.assign({ patchProp }, nodeOps);

function createRenderer() {}
```

nodeOps

```ts
// 主要是对节点元素的增删改查

export const nodeOps = {
  insert: (el, parent, anchor) => parent.insertBefore(el, anchor || null),
  remove: (el) => {
    const parent = el.parentNode;
    parent && parent.removeChild(el);
  },
  createElement: (type) => document.createElement(type),
  createText: (text) => document.createTextNode(text),
  setText: (node, text) => (node.nodeValue = text),
  setElementText: (el, text) => (el.textContent = text),
  parentNode: (node) => node.parentNode,
};
```

patchProp

```ts
// 主要是对节点元素的属性操作 class style event 普通属性
import patchAttr from "./modules/patchAttr";
import patchClass from "./modules/patchClass";
import patchEvent from "./modules/patchEvent";
import { patchStyle } from "./modules/patchStyle";

export default function patchProp(el, key, prevValue, nextValue) {
  if (key === "class") {
    return patchClass(el, nextValue);
  } else if (key === "style") {
    return patchStyle(el, prevValue, nextValue);
  } else if (/^on[^a-z]/.test(key)) {
    return patchEvent(el, key, nextValue);
  } else {
    return patchAttr(el, key, nextValue);
  }
}
```

patchClass.ts

```ts
export default function patchClass(el, value) {
  if (value == null) {
    el.removeAttribute("class");
  } else {
    el.className = value;
  }
}
```

patchStyle.ts

```ts
export function patchStyle(el, prevValue, nextValue) {
  let style = el.style;
  for (let key in nextValue) {
    style[key] = nextValue[key];
  }
  // 新的样式如果减少了一些旧的样式, 需要去掉
  if (prevValue) {
    for (let key in prevValue) {
      if (nextValue[key] == null) {
        style[key] = null;
      }
    }
  }
}
```

patchEvent.ts

```ts
function createInvoker(value) {
  const invoker = (e) => invoker.value(e);
  invoker.value = value; // 稍后可以更改value属性, 也就修改了对应的调用函数
  return invoker;
}

/**
 *
 * @param el 元素
 * @param name 事件名
 * @param nextValue 事件
 * @returns
 */
// 如果先给div的click绑定fn1, 然后再绑定fn2, 那就会涉及绑定——>解绑——再绑定的操作, 比较浪费性能
// 所以这样设计
// 给div的click绑定fn, 然后让fn = fn1。 之后让fn = fn2。 我们只需要让fn执行就可以了
// 抽象为: 给div元素做一个事件的缓存列表
export default function patchEvent(el, name, nextValue) {
  // vei: vue event invoker
  const invokers = el._vei || (el._vei = {});
  const eventName = name.slice(2).toLowerCase(); // click、focus....
  const exisitingInvokers = invokers[name]; // 是否存在同名的事件绑定
  if (nextValue && exisitingInvokers) {
    // 事件绑定
    return (exisitingInvokers.value = nextValue);
  }
  if (nextValue) {
    const invoker = (invokers[name] = createInvoker(nextValue)); // 创建一个调用函数, 并且内部会执行nextValue
    return el.addEventListener(eventName, invoker);
  }
  if (exisitingInvokers) {
    // 现在没有, 以前有
    el.removeEventListener(eventName, exisitingInvokers);
    invokers[name] = undefined;
  }
}
```

patchAttr.ts

```ts
export default function patchAttr(el, key, value) {
  if (value) {
    el.removeAttribute(key);
  } else {
    el.setAttribute(key, value);
  }
}
```

暴露我们的 renderOptions。 使用

```ts
// import { ref, reactive, toRef, toRefs, proxyRefs, computed, effect, watch } from '/node_modules/@vue/reactivity/dist/reactivity.esm-browser.js'
import {
  createRenderer,
  render,
  h,
} from "/node_modules/@vue/runtime-dom/dist/runtime-dom.esm-browser.js";
import { renderOptions } from "/packages/runtime-dom/dist/runtime-dom.js";
// runtime-dom的作用就是提供DOM API(提供一系列dom操作的api方法)
//  平时使用的Vue包其实就是 runtime-dom 包
// 0.runtime-dom ——> runtime-core ——> reactivity
// 1.createRender 我们可以自己创建渲染器(让我们自己提供渲染的方式)
// 2.render用内置的渲染器来进行渲染(渲染dom元素)
// 3.h方法可以创建一个虚拟dom
let ele = h(
  "div",
  { style: { color: "red" }, onClick: () => alert("click") },
  "lee"
);
render(ele, app);

const renderer = createRenderer(renderOptions);
renderer.render(ele, app);
```

#### 二、虚拟 DOM 渲染实现

新建 runtime-core 包
实现 createRenderer
1、runtim-dom 依赖 runtime-core 包, 通过 createRenderer 方法返回 renderer

```ts
import { nodeOps } from "./nodeOps";
import patchProp from "./patchProp";
import { createRenderer } from "@vue/runtime-core";

// 将节点操作和属性操作合并在一起
const renderOptions = Object.assign({ patchProp }, nodeOps);

export const render = (vnode, container) => {
  return createRenderer(renderOptions).render(vnode, container);
};

export { renderOptions };
export * from "@vue/runtime-core";
```

2、解构 renderOptions

```ts
export function createRenderer(renderOptions) {
  // 这里的renderOptions不一定是dom相关的方法, vue这里给加上了host前缀
  const {
    insert: hostInsert,
    remove: hostRemove,
    createElement: hostCreateElement,
    createText: hostCreateText,
    setText: hostSetText,
    setElementText: hostSetElementText,
    patchProp: hostPatchProp,
  } = renderOptions;
  const render = (vnode, container) => {
    console.log(vnode, container); // 打印看看长什么样
  };
  return {
    render,
  };
}

export * from "@vue/reactivity";
export * from "@vue/shared";
```

3、如何区分是第一次 patch、还是第二次 patch

```js
let ele1 = h(
  "div",
  { style: { color: "red" }, onClick: () => alert("click") },
  "lee"
);
let ele2 = h(
  "div",
  { style: { color: "green" }, onClick: () => alert("click") },
  "lee"
);
render(ele1, app);
setTimeout(() => {
  render(ele2, app);
}, 2000);
```

通过往 container 保存 \_vnode 属性

```ts
const patch = (n1, n2, container) => {};

const render = (vnode, container) => {
  patch(container._vnode || null, vnode, container);
  // 下一次patch就有上一次的vnode了。
  container._vnode = vnode;
};
```

4、第一次渲染

```ts
const mountElement = (vnode, container) => {
  console.log(vnode);
  const { type, children, props } = vnode;
  let el = hostCreateElement(type);
  if (props) {
    for (let key in props) {
      hostPatchProp(el, key, null, props[key]);
    }
  }
  hostSetElementText(el, children);
  hostInsert(el, container);
};

const patch = (n1, n2, container) => {
  if (n1 === n2) return; // 两次渲染同一个元素直接跳过
  if (n1 === null) mountElement(n2, container); // 初次渲染
};
```

但是这里的 children 不一定是文本, 有可能是子节点, vue 这里用位运算来判断 children 类型, 虚拟节点 vnode 上面有一个属性叫做 shapeFlags
shared/src/shapeFlags.ts

```ts
export enum ShapeFlags { // 对元素形状的判断
  ELEMENT = 1, // 1
  FUNCTIONAL_COMPONENT = 1 << 1, // 2
  STATEFUL_COMPONENT = 1 << 2, //  4
  TEXT_CHILDREN = 1 << 3, // 8
  ARRAY_CHILDREN = 1 << 4, // 16
  SLOTS_CHILDREN = 1 << 5,
  TELEPORT = 1 << 6,
  SUSPENSE = 1 << 7,
  COMPONENT_SHOULD_KEEP_ALIVE = 1 << 8,
  COMPONENT_KEPT_ALIVE = 1 << 9,
  COMPONENT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTIONAL_COMPONENT,
}
```

所以改一下上面的 childre 判断

```ts
const mountChildren = (children, container) => {
  for (let i = 0; i < children.length; i++) {
    patch(null, children[i], container);
  }
};

const mountElement = (vnode, container) => {
  const { type, children, props, shapeFlag } = vnode;
  let el = hostCreateElement(type);
  if (props) {
    for (let key in props) {
      hostPatchProp(el, key, null, props[key]);
    }
  }
  if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
    hostSetElementText(el, children);
  } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    mountChildren(children, el);
  }
  hostInsert(el, container);
};

const patch = (n1, n2, container) => {
  if (n1 === n2) return; // 两次渲染同一个元素直接跳过
  if (n1 === null) mountElement(n2, container); // 初次渲染
};
```

#### 三、手写 h 方法实现

1、前面我们用的都是人家的 h 方法, 现在我们自己实现

```ts
// h函数的参数特点
// 1.两个参数, 第二个参数可能是属性, 或者虚拟节点(__v_isVnode)
// 2.第二个参数就是一个数组 ——> 儿子
// 3.其他情况就是属性
// 4.直接传递非对象的, 文本
// 5.不能出现第三个参数的时候第二个只能是属性
// 6.如果超过三个参数, 后面的都是儿子
```

2、新建 createVnode.ts。 这个是创建虚拟节点的最底层方法

```ts
import { isString, ShapeFlags } from "@vue/shared";

export function isVnode(value) {
  return value?.__v_isVnode;
}

export function createVnode(type, props, children?) {
  const shapeFlag = isString(type) ? ShapeFlags.ELEMENT : 0;
  const vnode = {
    __v_isVnode: true,
    type,
    props,
    children,
    key: props?.key, // diff 算法后面需要的key
    el: null, // 虚拟节点需要对应的真实节点是谁
    shapeFlag,
  };
  if (children) {
    if (Array.isArray(children)) {
      vnode.shapeFlag |= ShapeFlags.ARRAY_CHILDREN;
    } else {
      children = String(children);
      vnode.shapeFlag |= ShapeFlags.TEXT_CHILDREN;
    }
  }
  return vnode;
}
```

新建 h.ts, 根据传入参数的形式, 调用 createVnode

```ts
import { isObject } from "vue";
import { createVnode, isVnode } from "./createVnode";

export function h(type, propsOrChildren?, children?) {
  let l = arguments.length;
  if (l === 2) {
    // h(h1,虚拟节点|属性)
    if (isObject(propsOrChildren) && !Array.isArray(propsOrChildren)) {
      // 虚拟节点
      if (isVnode(propsOrChildren)) {
        // h('div',h('a'))
        return createVnode(type, null, [propsOrChildren]);
      } else {
        // 属性
        return createVnode(type, propsOrChildren);
      }
    }
    // 儿子 是数组 | 文本
    return createVnode(type, null, propsOrChildren);
  } else {
    if (l > 3) {
      children = Array.from(arguments).slice(2);
    }
    if (l == 3 && isVnode(children)) {
      children = [children];
    }
    // == 3  | == 1
    return createVnode(type, propsOrChildren, children);
  }
}
```


注意哦: 为了处理后面的优化, 源码中编译后的结果全部采用了createVnode, h全部变成了createVnode。 