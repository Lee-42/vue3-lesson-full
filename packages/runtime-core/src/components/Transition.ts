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
        leave: props.onLeave
    };
    return vnode;
  },
};
