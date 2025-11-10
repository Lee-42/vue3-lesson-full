import { currentInstance } from "./component";

export function provide(key, value) {
  // 子用的是父, 子提供了顺序, 子提供的给了父
  // {a: 1}    {a: 1, b: 2}
  // {a: 1}   {a: 1, b:2, c:3}
  if (!currentInstance) return; // 建立在组件基础上的
  const parentProvide = currentInstance.parent?.provides; // 获取父组件的provides
  let provides = currentInstance.provide;
  if (parentProvide === provides) {
    //  如果在子组件上新增了provides需要拷贝一份全新的
    provides = currentInstance.provides = Object.create(provides);
  }
  provides[key] = value;
}

export function inject(key, defaultValue) {
  if (!currentInstance) return; // 建立在组件基础上的
  const provides = currentInstance.parent?.provides;
  if (provides && key in provides) {
    return provides[key]; // 直接从provides中取出来使用
  } else {
    return defaultValue; // 默认的inject
  }
}
