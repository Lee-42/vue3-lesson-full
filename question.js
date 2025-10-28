const person = {
    name: "lee",
    get aliasName() {
        return this.name + " handsome"
    }
}

let proxyPerson = new Proxy(person, {
    get(target, key, recevier) {
        // return target[key] // 如果我们直接通过target[key]取值, 不会走get。比如这里person[name]不会触发get
        // return recevier[key] // 会导致死循环
        return Reflect.get(target, key, recevier) // 让this.name的this指向recevier, 触发一次get
    }
})

console.log(proxyPerson.aliasName)


function getSequence(arr) {
    const result = [0]
    const p = result.slice(0) // 用来存放索引的
    let start;
    let end;
    let middle;
    const len = arr.length
    for (let i = 0; i < len; i++) {
        const arrI = arr[i]
        if (arrI !== 0) { // 为了vue3而处理掉数组中0 的情况 [5,3,4,0]
            // 拿出结果集对应的最后一项, 和我当前的这一项来做对比
            let resultLastIndex = result[result.length - 1]
            if (arr[resultLastIndex] < arrI) {
                p[i] = result[result.length - 1]; // 正常放入的时候, 前一个节点索引就是result中的最后一个
                result.push(i) // 直接将当前的索引放入到结果集即可
                continue
            }
        }

        start = 0;
        end = result.length - 1
        while (start < end) {
            middle = ((start + end) / 2) | 0
            if (arr[result[middle]] < arrI) {
                start = middle + 1
            } else {
                end = middle
            }
        }
        if(arrI < arr[result[start]]){
            p[i] = result[start - 1] // 找到的那个节点的前一个
            result[start] = i
        }
    }

    // p为前驱节点的列表, 需要根据最后一个节点追溯
    let l = result.length  
    let last = result[l - 1] // 取出最后一项
    while(l-- > 0){
        result[l] = last;
        last = p[last]  // 在数组中找到最后一个
    }
    return result
}

console.log(getSequence([2, 6, 7, 9, 11]))
