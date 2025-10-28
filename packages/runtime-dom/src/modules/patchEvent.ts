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
  const eventName = name.slice(2).toLowerCase();// click、focus....
  const exisitingInvokers = invokers[name]; // 是否存在同名的事件绑定
  if (nextValue && exisitingInvokers) {
    // 事件换绑
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
