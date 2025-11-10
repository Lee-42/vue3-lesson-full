import {
  currentInstance,
  setCurrentInstance,
  unsetCurrentInstance,
} from "./component";

export const enum LifeCycles {
  BEFORE_MOUNT = "bm",
  MOUNTED = "m",
  BEFORE_UPDATE = "bu",
  UPDATED = "u",
}

function createHook(type) {
  return (hook, target = currentInstance) => {
    console.log(type, hook);
    if (target) {
      // 当前钩子是在组件中运行的
      // 看当前钩子是否存放, 发布订阅
      const hooks = target[type] || (target[type] = []);
      // 让currentInstance存到这个函数内部
      const wrapHook = () => {
        // 在钩子执行前, 对实例进行校正处理
        setCurrentInstance(currentInstance);
        hook();
        unsetCurrentInstance();
      };

      // 在执行函数内部保证实例是正确的
      hooks.push(hook); // 这里有坑, 因为setup执行完毕后, 就会将instance清空
      hooks.push(wrapHook);
    }
  };
}

export const onBeforeMount = createHook(LifeCycles.BEFORE_MOUNT);
export const onMounted = createHook(LifeCycles.MOUNTED);
export const onBeforeUpdate = createHook(LifeCycles.BEFORE_UPDATE);
export const onUpdated = createHook(LifeCycles.UPDATED);

export function invokeArray(fns) {
  for (let i = 0; i < fns.length; i++) {
    fns[i]();
  }
}
