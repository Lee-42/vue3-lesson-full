#### 一、vue3 核心设计思想

1、https://juejin.cn/post/7353197221741379624?from=search-suggest
2、模板编译成 js 语法的过程是在工程化(vite 调用 compilper 模块)实现的
运行时, 有了 js 语法, 转成虚拟 dom 进行渲染
打包后就不涉及把模板变成 js 语法的过程了, 而是把直接变好的 js 语法运行

3、每个组合式 api 都是基于函数实现的
4、函数式编程: 特点就是可组合、每一个函数都是纯函数

#### 二、monorepo 开发环境搭建

1、

```shell
npm install pnpm
pnpm init -y
```

2、pnpm 安装的模块默认不会拍平到 node_modules 下
.npmrc

```js
shamefully-hoist=true
```

验证

```shell
pnpm install vue
# 结果在node_modules下, vue依赖的包都放到了node_modules下了
# 如果设置为false, 则vue的依赖不会抽出来放到node_modules下面
# 我们需要拍平, 因为不拍平, 无法import { xxx } from "xxx"。 这个xxx是vue依赖的模块
```

3、新建 pnpm-workspace.yaml

```yaml
packages:
  - "packages/*"
```

4、ts 初始化

```shell
pnpm install typescript esbuild minimist -D -w
tsc --init
```

tsconfig.json

```json
{
  "compilerOptions": {
    "outDir": "dist", // 输出的目录
    "sourceMap": true, // 采用sourcemap
    "target": "es2016", // 目标语法
    "module": "esnext", // 模块格式
    "moduleResolution": "node", // 模块解析方式
    "strict": false, // 严格模式
    "resolveJsonModule": true, // 解析json模块
    "esModuleInterop": true, // 允许通过es6语法引入commonjs模块
    "jsx": "preserve", // jsx 不转义
    "lib": ["esnext", "dom"], // 支持的类库 esnext及dom
    "baseUrl": ".",
    "paths": {
      "@vue/*": ["packages/*/src"]
    }
  }
}
```

5、搭建脚本, package.json

```json
"dev": "node scripts/dev.js reactivity -f",
```

新建 scripts/dev.js

```js
// 这个文件会帮我们打包package下的模块, 最终打包出js文件
// node dev.js 要打包的名字 -f 打包的格式
import minimist from "minimist";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

// node中的命令行参数通过process来获取, 去掉命令和文件
const args = minimist(process.argv.slice(2));
console.log(args);

const target = args._[0] || "reactivity"; // 打包目标
const format = args.f || "iife"; // 打包后的模块化规范

// node中esm模块没有__dirname, 需要自己解析
const __filename = fileURLToPath(import.meta.url); // 获取文件的绝对路径 file:
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
const entry = resolve(__dirname, `../packages/${target}/src/index.ts`);
```

新建 reactivity、shared 子包结构

```json
{
  "name": "@vue/shared",
  "version": "1.0.0",
  "module": "dist/shared.esm-bundler.js",
  "buildOptions": {
    "formats": ["esm-bundler", "cjs"]
  }
}
```

```json
{
  "name": "@vue/reactivity",
  "version": "1.0.0",
  "module": "dist/reactivity.esm-bundler.js",
  "unpkg": "dist/reactivity.global.js",
  "buildOptions": {
    // 为了打包的时候拿到信息
    "name": "VueReactivity",
    "formats": ["esm-bundler", "esm-browser", "cjs", "global"]
  },
  "dependencies": {
    "@vue/shared": "workspace:*"
  }
}
```

```shell
pnpm install @vue/shared --workspace --filter @vue/reactivity
```

#### 三、使用 esbuild 打包

1、

```js
// 这个文件会帮我们打包package下的模块, 最终打包出js文件
// node dev.js 要打包的名字 -f 打包的格式
import minimist from "minimist";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import esbuild from "esbuild";

// node中的命令行参数通过process来获取, 去掉命令和文件
const args = minimist(process.argv.slice(2));
console.log(args);

const target = args._[0] || "reactivity"; // 打包目标
const format = args.f || "iife"; // 打包后的模块化规范

// node中esm模块没有__dirname, 需要自己解析
const __filename = fileURLToPath(import.meta.url); // 获取文件的绝对路径 file:
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
const entry = resolve(__dirname, `../packages/${target}/src/index.ts`);
const pkg = require(`../packages/${target}/package.json`);

esbuild
  .context({
    entryPoints: [entry],
    outfile: resolve(__dirname, `../packages/${target}/dist/${target}.js`),
    bundle: true, // 比如reactivity依赖了shared会打包到一起
    platform: "browser",
    sourcemap: true,
    format, // cjs、esm、iife(自执行函数需要全局变量)
    globalName: pkg.buildOptions?.name,
  })
  .then((ctx) => {
    console.log("start dev");
    return ctx.watch(); // 监控入口文件持续进行打包
  });
```
