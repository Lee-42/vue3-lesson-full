#### 一、Text 节点渲染

1、Text 节点使用

```ts
import {
  h,
  Text,
  render,
} from "/node_modules/@vue/runtime-dom/dist/runtime-dom.esm-browser.js";

render(h(Text, "lee"), app);
setTimeout(() => {
  render(h(Text, "lee handsome"), app);
}, 2000);
```

实现。

```ts
// 首先 patch 方法需要根据节点类型做不同的处理
const patch = (n1, n2, container, anchor = null) => {
  if (n1 === n2) {
    return; // 两次渲染同一个元素直接跳过
  }
  if (n1 && !isSameVnode(n1, n2)) {
    unmount(n1);
    n1 = null;
  }
  const { type } = n2;
  switch (type) {
    case Text:
      processText(n1, n2, container);
      break;
    default:
      processElement(n1, n2, container, anchor);
      break;
  }
};

// 处理文本节点
const processText = (n1, n2, container) => {
  if (n1 === null) {
    // 1. 虚拟节点要关联真实节点
    // 2. 将节点插入到页面中
    hostInsert((n2.el = hostCreateText(n2.children)), container);
  } else {
    const el = (n2.el = n1.el);
    if (n1.children !== n2.children) {
      hostSetText(el, n2.children);
    }
  }
};
```

#### 二、Fragment 节点

1、Vue3 可以多个根节点, 就是通过 Fragment 包起来的
使用

```ts
render(h(Fragment, [h("div", "hello"), h("a", "world")]), app);
setTimeout(() => {
  render(h(Fragment, [h("div", "hello"), h("a", "hello")]), app);
}, 2000);
```

实现
```ts
const processFragment = (n1, n2, container) => {
  if (n1 === null) {
    mountChildren(n2.children, container);
  } else {
    patchChildren(n1, n2, container);
  }
};
```