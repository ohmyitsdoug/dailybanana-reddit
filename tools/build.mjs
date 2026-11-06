// Builds the client (splash + game) and the server with esbuild. Works the same on Windows, Mac and Linux.
//   node tools/build.mjs           one build (minified)
//   node tools/build.mjs --watch   rebuild on every change (used by `npm run playtest`)
//   node tools/build.mjs --clean   remove build output
import {readdirSync, rmSync} from 'node:fs'
import * as esbuild from 'esbuild'

const watch = process.argv.includes('--watch')
if (process.argv.includes('--clean')) {
  rmSync('dist', {recursive: true, force: true})
  for (const f of readdirSync('public')) if (/\.js(\.map)?$|\.meta\.json$/.test(f)) rmSync(`public/${f}`)
  process.exit(0)
}
const common = {bundle: true, logLevel: 'info', sourcemap: 'linked', target: 'es2023', minify: !watch}
const client = {...common, format: 'esm', platform: 'browser', outdir: 'public', entryPoints: ['src/client/splash.ts', 'src/client/game.ts'], conditions: ['browser']}
const server = {...common, format: 'cjs', platform: 'node', outdir: 'dist/server', entryPoints: ['src/server/index.ts']}
if (watch) {
  const [a, b] = await Promise.all([esbuild.context(client), esbuild.context(server)])
  await Promise.all([a.watch(), b.watch()])
} else {
  await Promise.all([esbuild.build(client), esbuild.build(server)])
}
