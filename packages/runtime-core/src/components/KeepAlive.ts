export const KeepAlive = {
  __isKeepAlive: true,
  setup(props, { slots }) {
    return () => {
      const vnode = slots.default();
      // 在这个组件中需要一些dom方法, 可以将元素移动到一个div中
      // 还可以卸载某个元素

      return vnode;
    };
  },
};

export const isKeepAlive = (value) => value.__isKeepAlive;
