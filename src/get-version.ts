import makeDebug from 'debug'
import {mkdir, writeFile} from 'node:fs/promises'
import {dirname} from 'node:path'
import {EnvHttpProxyAgent, fetch} from 'undici'

async function run([name, file, version, registry, authorization]: string[]) {
  const debug = makeDebug('get-version')
  debug('name:', name)
  debug('file:', file)
  debug('version:', version)
  debug('registry:', registry)

  const url = [
    registry.replace(/\/+$/, ''), // remove trailing slash
    name.replace('/', '%2f'), // scoped packages need escaped separator
  ].join('/')
  const headers: HeadersInit = authorization ? {authorization} : {}
  await mkdir(dirname(file), {recursive: true})
  await writeFile(file, JSON.stringify({current: version})) // touch file with current version to prevent multiple updates
  const response = await fetch(url, {
    dispatcher: new EnvHttpProxyAgent(),
    headers,
    signal: AbortSignal.timeout(5000),
  })
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)

  const body = (await response.json()) as {'dist-tags': string[]}
  await writeFile(file, JSON.stringify({...body['dist-tags'], current: version}))
  // eslint-disable-next-line unicorn/no-process-exit
  process.exit(0)
}

await run(process.argv.slice(2)).catch(async (error) => {
  const {handle} = await import('@oclif/core')
  await handle(error)
})
