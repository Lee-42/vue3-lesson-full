#### 一、编译优化

1、PatchFlags 优化
之前的 dom-diff 是逐层比较, 遍历树形结构, 浪费性能
有些节点我不需要比较, 能不能只比较变化的节点

2、

#### 二、靶向更新

1、例子

```ts
import {
  render,
  h,
  Text,
  Fragment,
} from "/packages/runtime-dom/dist/runtime-dom.js";

// 如果在编写vue3的时候, 你直接采用jsx或者h的写法, 得不到优化
const MyComponent = {
  setup() {
    const state = reactive({ name: "jw" });
    return {
      ...toRefs(state),
    };
  },
  render(_ctx) {
    const vnode =
      (_openBlock(),
      _createELemeneBlock("div", null, [
        _createElementVNode("h1", null, "Hello Lee42"),
        _createElementVNode(
          "span",
          null,
          _toDisplayString(_ctx.name),
          1 /* TEXT */
        ),
      ]));
    return vnode;
  },
};

render(h(MyComponent), app);
```

2、实现，修改 createVnode.ts

```ts
let currentBlock = null;
export function openBlock() {
  currentBlock = [];
}
export function closeBlock() {
  currentBlock = null;
}

export function setupBlock(vnode) {
  vnode.dynamicChildren = currentBlock; // 当前elementBlock会收集子节点, 用当前block来收集
}

// block有收集虚拟节点的功能
export function createElementBlock(type, props, children, patchFlag?) {
  return setupBlock(createVnode(type, props, children, patchFlag));
}

export { createVnode as _createElementVNode };
```

```ts
const patchElement = (n1, n2, container, anchor, parentComponent) => {
  // 1.比较元素的差异, 肯定需要复用dom元素
  // 2.比较属性和元素的子节点
  let el = (n2.el = n1.el); // 对dom元素的复用
  let oldProps = n1.props || {};
  let newProps = n2.props || {};

  // 在比较元素的时候, 针对某个熟悉来去比较
  const { patchFlag, dynamicProps } = n2;
  if (patchFlag) {
    if (patchFlag & patchFlag.TEXT) {
      // 只要儿子是动态的只比较文本
      if (n1.children !== n2.children) {
        hostSetElementText(el, n2.children);
      }
    }
    if (patchFlag & patchFlag.STYLE) {
      //
    }
    if (patchFlag & patchFlag.CLASS) {
    }
  } else {
    patchProps(oldProps, newProps, el);
  }

  if (dynamicProps) {
    // 线性比对
    patchBlockChildren(n1, n2, el, anchor, parentComponent);
  } else {
    // 全量diff
    patchChildren(n1, n2, el);
  }
};

function patchBlockChildren(n1, n2, el, anchor, parentComponent) {
  for (let i = 0; i < n2.dynamicChildren.length; i++) {
    const child = n2.dynamicChildren[i];
    patch(n1, child, el, anchor, parentComponent);
  }
}
```
