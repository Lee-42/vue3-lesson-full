import { isFunction, isObject, isString, ShapeFlags } from "@vue/shared";
import { isTeleport } from "vue";

export const Text = Symbol("Text");
export const Fragment = Symbol("Fragment");

export function isVnode(value) {
  return value?.__v_isVnode;
}

// 判断是不是同一个虚拟节点的逻辑, type和key是不是相同
export function isSameVnode(n1, n2) {
  return n1.type === n2.type && n1.key === n2.key;
}

export function createVnode(type, props, children?, patchFlag?) {
  const shapeFlag = isString(type)
    ? ShapeFlags.ELEMENT // 元素组件 div、span...
    : isTeleport(type)
    ? ShapeFlags.TELEPORT // teleport 组件
    : isObject(type)
    ? ShapeFlags.STATEFUL_COMPONENT // 组件
    : isFunction(type)
    ? ShapeFlags.FUNCTIONAL_COMPONENT // 函数式组件
    : 0;
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
    } else if (isObject(children)) {
      vnode.shapeFlag |= ShapeFlags.SLOTS_CHILDREN;
    } else {
      children = String(children);
      vnode.shapeFlag |= ShapeFlags.TEXT_CHILDREN;
    }
  }
  return vnode;
}

let currentBlock = null;
export function openBlock() {
  currentBlock = []
}
export function closeBlock() {
  currentBlock = null;
}

export function setupBlock(vnode) {
  vnode.dynamicChildren = currentBlock // 当前elementBlock会收集子节点, 用当前block来收集
}

// block有收集虚拟节点的功能
export function createElementBlock(type, props, children, patchFlag?) {
  return setupBlock(createVnode(type, props, children, patchFlag));
}

export { createVnode as _createElementVNode }