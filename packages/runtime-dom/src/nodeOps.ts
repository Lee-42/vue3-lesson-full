// 主要是对节点元素的增删改查

export const nodeOps = {
    insert: (el, parent, anchor) => parent.insertBefore(el, anchor || null),
    remove: (el) => {
        const parent = el.parentNode;
        parent && parent.removeChild(el);
    },
    createElement: (type) => document.createElement(type),
    createText: (text) => document.createTextNode(text),
    setText: (node, text) => (node.nodeValue = text),
    setElementText: (el, text) => (el.textContent = text),
    parentNode: (node) => node.parentNode
}