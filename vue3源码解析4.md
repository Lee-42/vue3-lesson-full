#### 零、新节点变成 null 的情况

1、h 函数支持传入 null, 表示将之前创建的 dom 移除

```ts
import {
  renderOptions,
  render,
  h,
} from "/packages/runtime-dom/dist/runtime-dom.js";
let ele1 = h("div", "hello");
render(ele1, app);
setTimeout(() => {
  render(null, app); // 支持传入null, 表示移除当前dom
}, 2000);
```

实现. renderer.ts

```ts
const unmount = (vnode) => {
  hostRemove(vnode.el);
  // 这里vnode.el属性是通过初次渲染的时候, 将el往vnode挂载了
};
const render = (vnode, container) => {
  console.log(vnode, container);
  if (vnode == null) {
    // 我要移除当前容器中的dom元素
    if (container._vnode) {
      unmount(container._vnode);
    }
  }
  patch(container._vnode || null, vnode, container);
  // 下一次patch就有上一次的vnode了。
  container._vnode = vnode;
};
```

#### 一、两个元素之间的比较

1、

```ts
import {
  renderOptions,
  render,
  h,
} from "/packages/runtime-dom/dist/runtime-dom.js";
let ele1 = h("h1", "hello");
let ele2 = h("div", { style: { color: "red" } }, "world");
// 两个节点之间的diff算法, 看两个元素是不是同一个元素, 如果是则可以复用
// 如果不是同一个元素,则需要删除老的, 换上新的
render(ele1, app);
setTimeout(() => {
  render(null, app); // 支持传入null, 表示移除当前dom
}, 2000);
```

2、逻辑就会走到 patch

```ts
// 判断是不是同一个虚拟节点的逻辑, type和key是不是相同
export function isSameVnode(n1, n2) {
  return n1.type === n2.type && n1.key === n2.key;
}
const patch = (n1, n2, container) => {
  if (n1 === n2) {
    return; // 两次渲染同一个元素直接跳过
  }
  if (n1 && !isSameVnode(n1, n2)) {
    unmount(n1);
    // 直接等于null, 下面就会去渲染n2
    n1 = null;
  }
  if (n1 === null) mountElement(n2, container); // 初次渲染
};
```

3、元素相同, 但是属性不同。 这个时候 n1 不是 null, 走 else。 patchElement
如下面的情况

```ts
let ele1 = h("h1", "hello");
let ele2 = h("h1", { style: { color: "red" } }, "hello");
// 两个节点之间的diff算法, 看两个元素是不是同一个元素, 如果是则可以复用
// 如果不是同一个元素,则需要删除老的, 换上新的
render(ele1, app);
setTimeout(() => {
  render(ele2, app); // 支持传入null, 表示移除当前dom
}, 2000);
```

patchElement 实现。 我们把 mounteElement 和 patchElement 合并为 processElement

```ts
const processElement = (n1, n2, container) => {
  if (n1 === null) {
    mountElement(n2, container); // 初次渲染
  } else {
    patchElement(n1, n2, container);
  }
};

const patchElement = (n1, n2, container) => {
  // 1.比较元素的差异, 肯定需要复用dom元素
  // 2.比较属性和元素的子节点
  let el = (n2.el = n1.el); // 对dom元素的复用
  let oldProps = n1.props || {};
  let newProps = n2.props || {};

  patchProps(oldProps, newProps, el);
};

const patchProps = (oldProps, newProps, el) => {
  // 新的要全部生效
  for (let key in newProps) {
    hostPatchProp(el, key, oldProps[key], newProps[key]);
  }
  for (let key in oldProps) {
    if (!(key in newProps)) {
      // 以前多的现在没有了, 需要删掉
      hostPatchProp(el, key, oldProps[key], null);
    }
  }
};
```

4、接下来就是要比较儿子了
patchChildren

#### 二、子节点比较策略

1、有下面这几张情况

```ts
const patchChildren = (n1, n2, el) => {
  const c1 = n1.children;
  const c2 = n2.children;

  const prevShapeFlag = n1.shapeFlag;
  const shapeFlag = n2.shapeFlag;
  // 文本，数组，空组合， 9种情况

  // 1.新的是文本, 老的是数组, 移除老的
  // 2.新的是文本, 老的也是文本, 内容不相同替换
  // 3.老的是数组, 新的是数组, 全量diff算法
  // 4.老的是数组, 新的不是数组, 移除老的子节点
  // 5.老的是文本, 新的是空
  // 6.老的是文本, 新的是数组
};
```

2、情况一: 新的是文本, 老的是数组, 移除老的

```ts
// 情况一
let vnode1 = h("h1", { a: 1 }, "hello");
let vnode2 = h("h1", { style: { color: "red" } }, [h("a", "1"), h("a", "2")]);

render(vnode2, app);
setTimeout(() => {
  render(vnode1, app);
}, 2000);
```

实现

```ts
if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
  if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    // 1.新的是文本, 老的是数组, 移除老的
    unmountChildren(c1);
  }
  // 1和2替换文本, 随便吧情况2也解决了
  if (c1 !== c2) {
    hostSetElementText(el, c2);
  }
}
```

3、情况三: 老的新的都是数组, 走全量 diff, 这个比较复杂, 先留着

4、其他情况比较简单, 如下

```ts
else {
  if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      // 情况三: 全量diff
    } else {
      // 情况四:
      unmountChildren(c1);
    }
  } else {
    if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // 情况五
      hostSetElementText(el, "");
    }
    if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      // 情况六
      mountChildren(c2, el);
    }
  }
}
```

#### 三、diff 算法

1、diff 算法不涉及跨层比对, 因为很少有之前是儿子, 现在变成父亲的情况

```ts
let vnode1 = h("h1", [
  h("div", { key: "a" }, "a"),
  h("div", { key: "b" }, "b"),
  h("div", { key: "c" }, "c"),
]);
let vnode2 = h("h1", [
  h("div", { key: "a" }, "a"),
  h("div", { key: "b", style: { color: "red" } }, "b"),
  h("div", { key: "d" }, "d"),
  h("div", { key: "e" }, "e"),
]);
```

从前往后比

```ts
let i = 0;
let e1 = c1.length - 1;
let e2 = c2.length - 1;

/******从前往后比*****/
// [a,b,c]
// [a,b,d,e]
while (i <= e1 && i <= e2) {
  // 有任何一方循环结束了, 就要终止比较
  const n1 = c1[i];
  const n2 = c2[i];
  if (isSameVnode(n1, n2)) {
    patch(n1, n2, el); // 更新当前节点的属性和儿子(递归比较子节点)
  } else {
    break;
  }
  i++;
}

// 到c的位置终止了
// 到d的位置终止了
console.log(i, e1, e2); //  i = 2, e1 = 2, e1 = 3  也就是说 i > e1 && i <= e2
```

2、从后往前比
比如

```ts
let vnode1 = h("h1", [
  h("div", { key: "a" }, "a"),
  h("div", { key: "b" }, "b"),
]);
let vnode2 = h("h1", [
  h("div", { key: "c" }, "c"),
  h("div", { key: "a" }, "a"),
  h("div", { key: "b", style: { color: "red" } }, "b"),
]);
```

```ts
/******从后往前比*****/
//   [a,b]
// [c,a,b]
while (i <= e1 && i <= e2) {
  const n1 = c1[e1];
  const n2 = c2[e2];
  if (isSameVnode(n1, n2)) {
    patch(n1, n2, el);
  } else {
    break;
  }
  e1--;
  e2--;
}
console.log(i, e1, e2); // i = 0, e1 = -1, e2 = 0  也就是说 i > e1 && i <= e2
```

3、处理增加和删除的特殊情况

- 增加。通过 i > e1 && i <= e2 这个条件判断
- 减少。通过 i > e2 && i <= e1 这个条件判断

```ts
// 当i > e1 && i <= e2 新的多 要增加
if (i > e1) {
  if (i <= e2) {
    // 有插入的部分
    // insert。 到底是向后插入还是向前插入, 通过 i+1 的元素是否存在来判断
    let nextPos = e2 + 1; // 看一下当前下一个元素是否存在
    let anchor = c2[nextPos]?.el;
    while (i <= e2) {
      patch(null, c2[i], el, anchor);
      i++;
    }
  }
} else if (i > e2) {
  // 当i > e2 && i <= e1 旧的多 要减少
  if (i <= e1) {
    while (i <= e1) {
      unmount(c1[i]);
      i++;
    }
  }
}
```

4、以上确认了不变化的节点, 并且对插入和移除做了处理。 现在处理特殊对比

```ts
let vnode1 = h("h1", [
  h("div", { key: "a" }, "a"),
  h("div", { key: "b" }, "b"),
  h("div", { key: "c" }, "c"),
  h("div", { key: "d" }, "d"),
  h("div", { key: "e" }, "e"),
  h("div", { key: "f" }, "f"),
  h("div", { key: "g" }, "g"),
]);
let vnode2 = h("h1", [
  h("div", { key: "a" }, "a"),
  h("div", { key: "b" }, "b"),
  h("div", { key: "e" }, "e"),
  h("div", { key: "c" }, "c"),
  h("div", { key: "d" }, "d"),
  h("div", { key: "h" }, "h"),
  h("div", { key: "f" }, "f"),
  h("div", { key: "g" }, "g"),
]);
```

找到可以复用的节点

```ts
else {
  /******以上确认了不变化的节点, 并且对插入和移除做了处理*****/
  let s1 = i;
  let s2 = i;
  const keyToNewIndexMap = new Map(); // 做一个映射表用于快速查找, 看老的是否在新的里面还有, 没有就删除, 有的话就更新
  for (let i = s2; i <= e2; i++) {
    const vnode = c2[i];
    keyToNewIndexMap.set(vnode.key, i);
  }
  console.log(keyToNewIndexMap);

  for (let i = s1; i <= e2; i++) {
    const vnode = c1[i];
    const newIndex = keyToNewIndexMap.get(vnode.key); // 通过key找到对应的索引
    if (newIndex == undefined) {
      // 如果新的里面找不到则说明老的有的要删除掉
      unmount(vnode);
    } else {
      // 比较前后节点的差异, 更新属性和儿子
      patch(vnode, c2[newIndex], el); // !!!!!!!!!!注意到这里都只是复用节点的属性和子节点。 还没有开始排序呢
    }
  }
}
```

5、排序

```ts
// 调整顺序。 明确应该以最新的为准
// 我们可以按照新的队列, 倒序插入insertBefore 通过参照物往前面插入
// 插入的过程中, 可能新的元素的多, 需要创建
let toBePatched = e2 - s2 + 1; // 要倒序插入的个数
// 先从索引为3的位置倒序插入
for (let i = toBePatched; i >= 0; i--) {
  let newIndex = s2 + i; // h对应的索引, 找他的下一个元素作为参照物, 来进行插入
  let anchor = c2[newIndex + 1]?.el;
  let vnode = c2[newIndex];
  if (!vnode.el) {
    // 新列表中新增的元素
    patch(null, vnode, el, anchor); // 创建h插入
  } else {
    hostInsert(vnode.el, el, anchor); // 接着倒序插入
  }
}
```

#### 四、最长递增子序列的概念

1、按照上面的最后一个步骤。

```ts
// [c,d,e]
// [e,c,d,h]
// 如果按照上面的最后一个步骤。 我们需要插入4次
// 这样有点浪费性能, 因为c、d是连着的, 我们只需要创建h、插入e就可以了
// 又或者
// [c,d,e,q,m,n]
// [e,c,d,q,n,f]
// 我们可以确定哪些连续性最强
```

2、需求: 查找连续性最强的子序列

```ts
// 贪心算法 + 二分查找
// 看潜力值
// 2 3 7 6 8 4 9 11 ——> 求最长子序列个数

// 2            先放2
// 2 3          再放3
// 2 3 7        暂且认为这个序列够长
// 2 3 6        用6替换7, 因为2 3 6 比2 3 7 潜力更大, 因为6后面可以放更大的值
// 2 3 6 8      放8
// 2 3 4 8      找到比4大的值, 替换掉他, 这里替换掉6 (但是要记录一下, 这里4把6替换掉了, 8要记录他之前是6)
// 2 3 4 8 9    放9
// 2 3 4 8 9 11

// 那么最长子序列个数就是6

// 再来一个
// 2 3 1 5 6 8 7 9 4

// 2
// 2 3
// 1 3
// 1 3 5
// 1 3 5 6
// 1 3 5 6 8
// 1 3 5 6 7
// 1 3 5 6 7 9
// 1 3 4 6 7 9

// 最长就是 6
// 但是这个顺序是不对的。 我们可以通过追溯的方式拿到正确的序列
// 2             (2的前一个是null)
// 2 3           (3的前一个是2)
// 1 3           (1的前一个是null)
// 1 3 5         (5的前一个是3)
// 1 3 5 6       (6的前一个是5)
// 1 3 5 6 8     (8的前一个是6)
// 1 3 5 6 7     (7的前一个是6)
// 1 3 5 6 7 9   (9的前一个是7)
// 1 3 4 6 7 9   (4的前一个是3)

// 最终的子序列就是
// 9 7 6 5 3 2
```

3、算法实现

```ts
function getSequence(arr) {
  const result = [0];
  const p = result.slice(0); // 用于存放索引的
  let start;
  let end;
  let middle;
  const len = arr.length; // 数组长度
  for (let i = 0; i < len; i++) {
    const arrI = arr[i];
    if (arrI !== 0) {
      // 为了vue3 而处理掉数组中 0 的情况  [5,3,4,0]
      // 拿出结果集对应的的最后一项，和我当前的这一项来作比对
      let resultLastIndex = result[result.length - 1];
      if (arr[resultLastIndex] < arrI) {
        p[i] = result[result.length - 1]; // 正常放入的时候，前一个节点索引就是result中的最后一个
        result.push(i); // 直接将当前的索引放入到结果集即可

        continue;
      }
    }
    start = 0;
    end = result.length - 1;

    while (start < end) {
      middle = ((start + end) / 2) | 0;
      if (arr[result[middle]] < arrI) {
        start = middle + 1;
      } else {
        end = middle;
      }
    }
    if (arrI < arr[result[start]]) {
      p[i] = result[start - 1]; // 找到的那个节点的前一个
      result[start] = i;
    }
  }

  // p 为前驱节点的列表，需要根据最后一个节点做追溯
  let l = result.length;
  let last = result[l - 1]; // 取出最后一项
  while (l-- > 0) {
    // 倒序向前找，因为p的列表是前驱节点
    result[l] = last;
    last = p[last]; // 在数组中找到最后一个
  }
  // 需要创建一个 前驱节点，进行倒序追溯 （因为最后一项，可到是不会错的）
  return result;
}
console.log(getSequence([1, 2, 3, 4, 5, 8, 9, 10, 6]));
```

4、优化 diff 算法

```ts
else {
      /******以上确认了不变化的节点, 并且对插入和移除做了处理*****/
      let s1 = i;
      let s2 = i;
      const keyToNewIndexMap = new Map(); // 做一个映射表用于快速查找, 看老的是否在新的里面还有, 没有就删除, 有的话就更新
      let toBePatched = e2 - s2 + 1; // 要倒序插入的个数

      let newIndexToOldMapIndex = new Array(toBePatched).fill(0);

      for (let i = s2; i <= e2; i++) {
        const vnode = c2[i];
        keyToNewIndexMap.set(vnode.key, i);
      }
      console.log(keyToNewIndexMap);

      for (let i = s1; i <= e2; i++) {
        const vnode = c1[i];
        const newIndex = keyToNewIndexMap.get(vnode.key); // 通过key找到对应的索引
        if (newIndex == undefined) {
          // 如果新的里面找不到则说明老的有的要删除掉
          unmount(vnode);
        } else {
          // 比较前后节点的差异, 更新属性和儿子
          newIndexToOldMapIndex[newIndex - s2] = i + 1; // [5,3,4,0]
          patch(vnode, c2[newIndex], el); // 注意到这里都只是复用节点的属性和子节点。 还没有开始排序呢
        }
      }

      // 调整顺序。 明确应该以最新的为准
      // 我们可以按照新的队列, 倒序插入insertBefore 通过参照物往前面插入
      // 插入的过程中, 可能新的元素的多, 需要创建
      // 先从索引为3的位置倒序插入
      let increasingSeq = getSequence(newIndexToOldMapIndex);
      let j = increasingSeq.length - 1; // 索引
      for (let i = toBePatched; i >= 0; i--) {
        let newIndex = s2 + i; // h对应的索引, 找他的下一个元素作为参照物, 来进行插入
        let anchor = c2[newIndex + 1]?.el;
        let vnode = c2[newIndex];
        if (!vnode.el) {
          // 新列表中新增的元素
          patch(null, vnode, el, anchor); // 创建h插入
        } else {
          if (i == increasingSeq[j]) {
            j--; // 做了diff算法有的优化
          } else {
            hostInsert(vnode.el, el, anchor); // 接着倒序插入
          }
        }
      }
      // 倒序比对每一个元素，做插入操作
    }
```


#### 五、靶向更新
1、Vue3中分为两种更新
* 全量diff
* 快速diff: 靶向更新。 标记哪些节点是动态的, 只修改动态的节点



