import makeDebug from 'debug'
import {HTTP} from 'http-call'
import {mkdir, writeFile} from 'node:fs/promises'
import {dirname} from 'node:path'

async function run([name, file, version, registry, authorization]: string[]) {
  const debug = makeDebug('get-version')
  debug('name:', name)
  debug('file:', file)
  debug('version:', version)
  debug('registry:', registry)
  debug('authorization:', authorization)
  const url = [
    registry.replace(/\/+$/, ''), // remove trailing slash
    name.replace('/', '%2f'), // scoped packages need escaped separator
  ].join('/')
  const headers = authorization ? {authorization} : {}
  await mkdir(dirname(file), {recursive: true})
  await writeFile(file, JSON.stringify({current: version, headers})) // touch file with current version to prevent multiple updates
  const {body} = await HTTP.get<{'dist-tags': string[]}>(url, {headers, timeout: 5000})
  await writeFile(file, JSON.stringify({...body['dist-tags'], authorization, current: version}))
  // eslint-disable-next-line n/no-process-exit, unicorn/no-process-exit
  process.exit(0)
}

await run(process.argv.slice(2)).catch(async (error) => {
  const {handle} = await import('@oclif/core')
  await handle(error)
})
