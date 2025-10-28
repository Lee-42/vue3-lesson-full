// 这个文件会帮我们打包package下的模块, 最终打包出js文件
// node dev.js 要打包的名字 -f 打包的格式
import minimist from "minimist";
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import { createRequire } from "module"
import esbuild from 'esbuild'

// node中的命令行参数通过process来获取, 去掉命令和文件
const args = minimist(process.argv.slice(2))
console.log(args)

const target = args._[0] || "reactivity" // 打包目标
const format = args.f || 'iife'  // 打包后的模块化规范

// node中esm模块没有__dirname, 需要自己解析
const __filename = fileURLToPath(import.meta.url) // 获取文件的绝对路径 file: 
const __dirname = dirname(__filename)
const require = createRequire(import.meta.url)
const entry = resolve(__dirname, `../packages/${target}/src/index.ts`)
const pkg = require(`../packages/${target}/package.json`)

esbuild.context({
    entryPoints: [
        entry
    ],
    outfile: resolve(__dirname, `../packages/${target}/dist/${target}.js`),
    bundle: true,  // 比如reactivity依赖了shared会打包到一起
    platform: "browser",
    sourcemap: true,
    format,  // cjs、esm、iife(自执行函数需要全局变量)
    globalName: pkg.buildOptions?.name
}).then((ctx) => {
    console.log('start dev')
    return ctx.watch(); // 监控入口文件持续进行打包
})