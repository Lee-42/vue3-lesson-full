import { ShapeFlags } from "@vue/shared";
import { onMounted, onUpdated } from "../apiLifecycle";
import { getCurrentInstance } from "../component";

export const KeepAlive = {
  __isKeepAlive: true,
  props: {
    max: Number,
  },
  setup(props, { slots }) {
    const { max } = props;
    const keys = new Set(); // 用来记录哪些组件被缓存过
    const cache = new Map(); // 缓存表 <keep-alive> </keep-alive>

    // 在这个组件中需要一些dom方法, 可以将元素移动到一个div中
    // 还可以卸载某个元素
    let pendingCacheKey = null;
    const instance = getCurrentInstance();
    const cacheSubTree = () => {
      cache.set(pendingCacheKey, instance.subTree); // 缓存组件的虚拟节点, 里面有组件的dom元素······················
    };

    // 这里是keepalive特有的初始化方法
    const { move, createElement, unmount:_unmount } = instance.ctx.renderer;

    function reset(vnode){
      let shapeFlag = vnode.shapeFlag;
      if(shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE){
        shapeFlag -= ShapeFlags.COMPONENT_KEPT_ALIVE;
      }
      if(shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE){
        shapeFlag -= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE;
      }
      vnode.shapeFlag = shapeFlag;
    }

    function unmount(vnode){
      reset(vnode); // 将vnode标识去除
      _unmount(vnode); // 真正的做删除
    }

    function purneCacheEntry(key) {
      keys.delete(key);
      const cached = cache.get(key); // 之前缓存的结果
      unmount(cached.component.subTree);
    }

    // 激活时执行
    instance.ctx.activated = function (vnode, container, anchor) {
      move(vnode, container, anchor);
    };
    // 卸载时执行
    const storageContent = createElement("div");
    instance.ctx.deactivated = function (vnode, container) {
      move(vnode, storageContent, null); // 将dom元素临时移动到这个div中, 但是没有被销毁
    };
    onMounted(cacheSubTree());
    onUpdated(cacheSubTree());

    // 缓存的是组件 ——> 组件里有subTree ——> subTree上有el元素 ——> 移动到页面中
    return () => {
      const vnode = slots.default();

      const comp = vnode.type;
      const key = vnode.key == null ? comp : vnode.key;

      const cacheVnode = cache.get(key);
      pendingCacheKey = key;
      if (cacheVnode) {
        vnode.component = cacheVnode.component; // 不要再重新创建组件的实例了, 直接复用即可
        vnode.shapeFlag |= ShapeFlags.COMPONENT_KEPT_ALIVE; // 告诉他不要做初始化操作
        keys.delete(key);
        keys.add(key); // 刷新缓存
      } else {
        keys.add(key);
        if (max && keys.size > max) {
          // 达到了最大的缓存个数
          // set中的第一个元素
          purneCacheEntry(keys.values().next().value);
        }
      }
      vnode.shapeFlag |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE; // 这个组件不需要真的卸载,
      return vnode; // 等待组件加载完毕后去缓存
    };
  },
};

export const isKeepAlive = (value) => value.type.__isKeepAlive;
