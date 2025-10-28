import { ShapeFlags, hadOwn } from "@vue/shared";
import { Fragment, isSameVnode, Text } from "./createVnode";
import getSequence from "./seq";
import { queueJob } from "./scheduler";
import { reactive, ReactiveEffect } from "@vue/reactivity";
import { createComponentInstance, setupComponent } from "./component";

export function createRenderer(renderOptions) {
  // 这里的renderOptions不一定是dom相关的方法, vue这里给加上了host前缀
  // core中完全不关系如何渲染的
  const {
    insert: hostInsert,
    remove: hostRemove,
    createElement: hostCreateElement,
    createText: hostCreateText,
    setText: hostSetText,
    setElementText: hostSetElementText,
    patchProp: hostPatchProp,
  } = renderOptions;

  const mountChildren = (children, container) => {
    for (let i = 0; i < children.length; i++) {
      patch(null, children[i], container);
    }
  };

  const processElement = (n1, n2, container, anchor) => {
    if (n1 === null) {
      mountElement(n2, container, anchor); // 初次渲染
    } else {
      patchElement(n1, n2, container);
    }
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

  function setupRenderEffect(instance, container, anchor) {
    const { render } = instance
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
    const effect = new ReactiveEffect(componentUpdateFn, () =>
      queueJob(update)
    );
    const update = (instance.update = () => effect.run());
    update();
  }

  const mountComponent = (vnode, container, anchor) => {
    // 1. 先创建组件实例
    const instance = (vnode.component = createComponentInstance(vnode));
    // 2. 给实例的属性赋值
    setupComponent(instance)
    // 3. 创建一个effect
    setupRenderEffect(instance, container, anchor)
  };

  const processComponent = (n1, n2, container, anchor) => {
    if (n1 === null) {
      mountComponent(n2, container, anchor);
    } else {
      // 组件更新逻辑
    }
  };

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

  const processFragment = (n1, n2, container) => {
    if (n1 === null) {
      mountChildren(n2.children, container);
    } else {
      patchChildren(n1, n2, container);
    }
  };

  const unmountChildren = (children) => {
    for (let i = 0; i < children.length; i++) {
      let child = children[i];
      unmount(child);
    }
  };

  const patchKeyedChildren = (c1, c2, el) => {
    let i = 0;
    let e1 = c1.length - 1;
    let e2 = c2.length - 1;

    /******从前往后比*****/
    // [a,b,c]
    // [a,b,d,e]
    while (i <= e1 && i <= e2) {
      // 有任何一方循环结束了, 就要终止比较
      const n1 = c1[i];
      const n2 = c2[i];
      if (isSameVnode(n1, n2)) {
        patch(n1, n2, el); // 更新当前节点的属性和儿子(递归比较子节点)
      } else {
        break;
      }
      i++;
    }

    // 到c的位置终止了
    // 到d的位置终止了
    console.log(i, e1, e2); //  i = 2, e1 = 2, e1 = 3  也就是说 i > e1 && i <= e2
    /******从后往前比*****/
    //   [a,b]
    // [c,a,b]
    while (i <= e1 && i <= e2) {
      const n1 = c1[e1];
      const n2 = c2[e2];
      if (isSameVnode(n1, n2)) {
        patch(n1, n2, el);
      } else {
        break;
      }
      e1--;
      e2--;
    }
    console.log(i, e1, e2); // i = 0, e1 = -1, e2 = 0  也就是说 i > e1 && i <= e2
    // 当i > e1 && i <= e2 新的多 要增加
    if (i > e1) {
      if (i <= e2) {
        // 有插入的部分
        // insert。 到底是向后插入还是向前插入, 通过 i+1 的元素是否存在来判断
        let nextPos = e2 + 1; // 看一下当前下一个元素是否存在
        let anchor = c2[nextPos]?.el;
        while (i <= e2) {
          patch(null, c2[i], el, anchor);
          i++;
        }
      }
    } else if (i > e2) {
      // 当i > e2 && i <= e1 旧的多 要减少
      if (i <= e1) {
        while (i <= e1) {
          unmount(c1[i]);
          i++;
        }
      }
    } else {
      /******以上确认了不变化的节点, 并且对插入和移除做了处理*****/
      let s1 = i;
      let s2 = i;
      const keyToNewIndexMap = new Map(); // 做一个映射表用于快速查找, 看老的是否在新的里面还有, 没有就删除, 有的话就更新
      let toBePatched = e2 - s2 + 1; // 要倒序插入的个数

      let newIndexToOldMapIndex = new Array(toBePatched).fill(0);

      for (let i = s2; i <= e2; i++) {
        const vnode = c2[i];
        keyToNewIndexMap.set(vnode.key, i);
      }
      console.log(keyToNewIndexMap);

      for (let i = s1; i <= e2; i++) {
        const vnode = c1[i];
        const newIndex = keyToNewIndexMap.get(vnode.key); // 通过key找到对应的索引
        if (newIndex == undefined) {
          // 如果新的里面找不到则说明老的有的要删除掉
          unmount(vnode);
        } else {
          // 比较前后节点的差异, 更新属性和儿子
          newIndexToOldMapIndex[newIndex - s2] = i + 1; // [5,3,4,0]
          patch(vnode, c2[newIndex], el); // 注意到这里都只是复用节点的属性和子节点。 还没有开始排序呢
        }
      }

      // 调整顺序。 明确应该以最新的为准
      // 我们可以按照新的队列, 倒序插入insertBefore 通过参照物往前面插入
      // 插入的过程中, 可能新的元素的多, 需要创建
      // 先从索引为3的位置倒序插入
      let increasingSeq = getSequence(newIndexToOldMapIndex);
      let j = increasingSeq.length - 1; // 索引
      for (let i = toBePatched; i >= 0; i--) {
        let newIndex = s2 + i; // h对应的索引, 找他的下一个元素作为参照物, 来进行插入
        let anchor = c2[newIndex + 1]?.el;
        let vnode = c2[newIndex];
        if (!vnode.el) {
          // 新列表中新增的元素
          patch(null, vnode, el, anchor); // 创建h插入
        } else {
          if (i == increasingSeq[j]) {
            j--; // 做了diff算法有的优化
          } else {
            hostInsert(vnode.el, el, anchor); // 接着倒序插入
          }
        }
      }
      // 倒序比对每一个元素，做插入操作
    }
  };

  const patchChildren = (n1, n2, el) => {
    const c1 = n1.children;
    const c2 = n2.children;

    const prevShapeFlag = n1.shapeFlag;
    const shapeFlag = n2.shapeFlag;
    // 文本，数组，空组合， 9种情况

    // 1.新的是文本, 老的是数组, 移除老的
    // 2.新的是文本, 老的也是文本, 内容不相同替换
    // 3.老的是数组, 新的是数组, 全量diff算法
    // 4.老的是数组, 新的不是数组, 移除老的子节点
    // 5.老的是文本, 新的是空
    // 6.老的是文本, 新的是数组
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        // 1.新的是文本, 老的是数组, 移除老的
        unmountChildren(c1);
      }
      // 1和2替换文本
      if (c1 !== c2) {
        hostSetElementText(el, c2);
      }
    } else {
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // 情况三: 全量diff
          patchKeyedChildren(c1, c2, el);
        } else {
          // 情况四:
          unmountChildren(c1);
        }
      } else {
        if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
          // 情况五
          hostSetElementText(el, "");
        }
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // 情况六
          mountChildren(c2, el);
        }
      }
    }
  };

  const patchElement = (n1, n2, container) => {
    // 1.比较元素的差异, 肯定需要复用dom元素
    // 2.比较属性和元素的子节点
    let el = (n2.el = n1.el); // 对dom元素的复用
    let oldProps = n1.props || {};
    let newProps = n2.props || {};

    patchProps(oldProps, newProps, el);

    patchChildren(n1, n2, el);
  };

  const patchProps = (oldProps, newProps, el) => {
    // 新的要全部生效
    for (let key in newProps) {
      hostPatchProp(el, key, oldProps[key], newProps[key]);
    }
    for (let key in oldProps) {
      if (!(key in newProps)) {
        // 以前多的现在没有了, 需要删掉
        hostPatchProp(el, key, oldProps[key], null);
      }
    }
  };

  const mountElement = (vnode, container, anchor) => {
    const { type, children, props, shapeFlag } = vnode;
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
      mountChildren(children, el);
    }
    hostInsert(el, container, anchor);
  };

  const unmount = (vnode) => {
    if (vnode.type === Fragment) {
      unmountChildren(vnode.children);
    } else {
      hostRemove(vnode.el);
    }
  };

  const patch = (n1, n2, container, anchor = null) => {
    if (n1 === n2) {
      return; // 两次渲染同一个元素直接跳过
    }
    if (n1 && !isSameVnode(n1, n2)) {
      unmount(n1);
      n1 = null;
    }
    const { type, shapeFlag } = n2;
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
  };

  const render = (vnode, container) => {
    if (vnode == null) {
      // 我要移除当前容器中的dom元素
      if (container._vnode) {
        unmount(container._vnode);
      }
    } else {
      patch(container._vnode || null, vnode, container);
      // 下一次patch就有上一次的vnode了。
      container._vnode = vnode;
    }
  };
  return {
    render,
  };
}
