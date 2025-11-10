import { hadOwn, isFunction, ShapeFlags } from "@vue/shared";
import { reactive } from "@vue/reactivity";

export function createComponentInstance(vnode, parent) {
  const instance = {
    data: null, // 状态
    vnode: vnode, // 组件的虚拟节点
    subTree: null, // 子树
    isMounted: false, // 是否挂载完成
    update: null, // 组件的更新的函数
    props: {},
    attrs: {},
    slots: {},
    propsOptions: vnode.type.props, // 用户声明的哪些属性是组件的属性
    component: null,
    proxy: null, // 用来代理props、attrs、data让用户更方便的访问
    setupState: {},
    expose: {},
    parent,
    ctx: {} as any, // 如果是keepaliev组件, 就将dom api放入到这个属性上
    provides: parent ? parent.provides : Object.create,
  };
  return instance;
}

const publicProperty = {
  $attrs: (instance) => instance.attrs,
  $slots: (instance) => instance.slots,
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

const initSlots = (instance, children) => {
  if (instance.vnode.shapeFlag & ShapeFlags.SLOTS_CHILDREN) {
    instance.slots = children;
  } else {
    instance.slots = {};
  }
};

const handler = {
  get(target, key) {
    const { data, props, setupState } = target;
    if (data && hadOwn(data, key)) {
      return data[key];
    } else if (props && hadOwn(props, key)) {
      return props[key];
    } else if (setupState && hadOwn(setupState, key)) {
      return setupState[key];
    }
    // 对于一些无法修改的属性, $slots $attrs... ——> 需要从 instance.attrs取, 并且没有set
    const getter = publicProperty[key];
    if (getter) return getter(target);
  },
  set(target, key, value) {
    const { data, props, setupState } = target;
    if (data && hadOwn(data, key)) {
      data[key] = value;
    } else if (props && hadOwn(props, key)) {
      props[key] = value;
    } else if (setupState && hadOwn(setupState, key)) {
      setupState[key] = value;
    } else {
      console.log("props are readonly");
      return false;
    }
    return true;
  },
};

export function setupComponent(instance) {
  const { vnode } = instance;
  // 赋值属性
  initProps(instance, vnode.props);
  // 赋值插槽
  initSlots(instance, vnode.children);
  // 赋值代理对象
  instance.proxy = new Proxy(instance, handler);
  const { data = () => {}, render, setup } = vnode.type;
  if (setup) {
    const setupContext = {
      // ...
      slots: instance.slots,
      attrs: instance.attrs,
      expose(value) {
        instance.expose = value || {};
      },
      emit(event, ...payload) {
        // onMyEvent
        const eventName = `on${event[0].toUpperCase()}${event.slice(1)}`;
        const handler = instance.vnode.props[eventName];
        handler && handler(...payload);
      },
    };
    // 这样我们在setup里面就可以拿到instance了
    setCurrentInstance(instance)
    const setupResult = setup(instance.props, setupContext);
    unsetCurrentInstance()
    if (isFunction(setupResult)) {
      instance.render = setupResult;
    } else {
      instance.setupState = setupResult;
    }
  }
  if (!isFunction(data)) {
    console.warn("data option must be a function");
  } else {
    // data 中可以拿到props
    instance.data = reactive(data.call(instance.proxy));
  }
  instance.render = render;
}

export let currentInstance = null;
export const getCurrentInstance = () => {
  return currentInstance;
};

export const setCurrentInstance = (instance) => {
  currentInstance = instance;
};

export const unsetCurrentInstance = () => {
  currentInstance = null;
};
