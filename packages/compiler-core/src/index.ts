// 编译主要分为三步
// 1. 需要将模板转化成ast语法树
// 2. 转化, 生成codegenNode
// 3. 转成render字符串, 生成render函数

import { NodeTypes } from "./ast";

function createParseContext(content) {
  return {
    originalSource: content,
    source: content, // 字符串会不停地减少
    line: 1,
    column: 1,
    offset: 0,
  };
}

function getSelection(context, start, e?) {
    let end = e || getCursor(context);
    // eslint 可以根据 start，end找到要报错的位置
    return {
      start,
      end,
      source: context.originalSource.slice(start.offset, end.offset),
    };
  }

function isEnd(context) {
  return !context.source;
}

// 前进多少个
function advanceBy(context, endIndex) {
  let c = context.source.slice(0, endIndex);
  context.source = c.slice(endIndex);
}

function advanceSpaces(context) {
  const match = /^[ \t\r\n]+/.exec(context.source);

  if (match) {
    // 删除空格
    advanceBy(context, match[0].length);
  }
}

function parseTextData(context, endIndex) {
  const content = context.source.slice(0, endIndex);
  advanceBy(content, endIndex);
  return content;
}

function parseText(context) {
  let tokens = ["<", "{{"]; // 找当前离得最近的词法
  let endIndex = context.source.length; // 先假设找不到, 再进行查找
  for (let i = 0; i < tokens.length; i++) {
    const index = context.source.indexOf(tokens[i]);
    if (index !== -1 && endIndex > index) {
      endIndex = index;
    }
  }

  // 0 - endIndex 为文字内容
  let content = parseTextData(context, endIndex);
  return {
    type: NodeTypes.TEXT,
    content,
  };
}

function getCursor() {}

function parseTag(context) {
  const start = getCursor(context);
  const match = /^<\/?([a-z][^ \t\r\n/>]*)/.exec(context.source);
  const tag = match[1];
  advanceBy(context, match[0].length); // 删除匹配到的内容
  const isSelfClosing = context.source.startsWith("/>");
  advanceBy(context, isSelfClosing ? 2 : 1);

  advanceSpaces(context);

  return {
    type: NodeTypes.ELEMENT,
    tag,
    isSelfClosing,
    loc: getSelection(context, start), // 开头标签解析后的信息
  };
}

function parseElement(context) {
  // <div></div>
  const ele = parseTag(context);
  if (context.source.startsWith("</")) {
    // 解析结束标签
    parseTag(context);
  }
  (ele as any).children = [](ele as any).loc = {};

  return ele;
}

function parseChilren(context) {
  const nodes = [];
  let node;
  while (!isEnd(context)) {
    const c = context.source; // 现在解析的内容
    if (c.startsWith("{{")) {
      // {{}}
      node = "表达式";
    } else if (c[0] === "<") {
      // <div></div>
      node = parseElement(context);
    } else if (
      // 文本
      (node = parseText(context))
    )
      // 有限状态机
      nodes.push(node);
  }
  return nodes;
}

function createRoot(children) {
  return {
    type: NodeTypes.ROOT,
    children,
  };
}

// 将模板转化成ast语法树
function parse(template) {
  // 根据template产生一颗树
  const context = createParseContext(template);
  // <p><div></div><div></div></p>
  // {type: 1, tag: "p", children: [{type: 1, tag: "div", children: []}, {type: 1, tag: "div", children: []}]}
  return createRoot(parseChilren(context));
}

export { parse };
