import { isObject } from "@vue/shared";
import { trigger } from "./effect";
import { track } from "./reactiveEffect";
import { reactive } from "./reactive";
import { ReactiveFlags } from "./constans";

export const mutableHandlers: ProxyHandler<any> = {
  // receiver就是new Proxy产生的对象
  get(target, key, receiver) {
    if (key === ReactiveFlags.IS_REACTIVE) {
      return true;
    }
    // 拿到全局effect变量, 关联属性
    track(target, key); // 表示收集target上的key, 和effect关联在一起

    let res = Reflect.get(target, key, receiver);
    if (isObject(res)) {
      // 当取的值也是对象的时候, 我需要对这个对象再进行代理, 递归代理
      return reactive(res);
    }
    return res;
  },
  set(target, key, value, receiver) {
    let oldValue = target[key];
    let result = Reflect.set(target, key, value, receiver);
    if (oldValue !== value) {
      // 触发页面更新
      trigger(target, key, value, oldValue);
    }
    return result;
  },
};
