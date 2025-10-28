export function patchStyle(el, prevValue, nextValue) {
  let style = el.style;
  for (let key in nextValue) {
    style[key] = nextValue[key];
  }
  // 新的样式如果减少了一些旧的样式, 需要去掉
  if (prevValue) {
    for (let key in prevValue) {
      if (nextValue) {
        if (nextValue[key] == null) {
          style[key] = null;
        }
      }
    }
  }
}
