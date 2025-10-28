import { isObject } from "@vue/shared";
import { mutableHandlers } from "./baseHandler";
import { ReactiveFlags } from './constans'

// 用于记录我们代理后的结果
// https://www.zhangxinxu.com/wordpress/2021/08/js-weakmap-es6/
const reactiveMap = new WeakMap();

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

export function toReactive(value) {
  return isObject(value) ? reactive(value) : value;
}

/**
 * 判断value是不是响应式对象, 如果是响应式对象, value[ReactiveFlags.IS_REACTIVE]。在value上取ReactiveFlags.IS_REACTIVE的时候会返回true
 * @param value 
 * @returns 
 */
export function isReactive(value){
    return !!(value && value[ReactiveFlags.IS_REACTIVE])
}