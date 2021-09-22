import * as fs from 'fs-extra'
import HTTP from 'http-call'

// eslint-disable-next-line max-params
async function run(name: string, file: string, version: string, registry: string, authorization: string) {
  const url = [
    registry.replace(/\/+$/, ''), // remove trailing slash
    name.replace('/', '%2f'),      // scoped packages need escaped separator
  ].join('/')
  const headers = authorization ? {authorization} : {}

  await fs.outputJSON(file, {current: version, headers}) // touch file with current version to prevent multiple updates
  const {body} = await HTTP.get<any>(url, {headers, timeout: 5000})
  await fs.outputJSON(file, {...body['dist-tags'], current: version, authorization})
  process.exit(0) // eslint-disable-line unicorn/no-process-exit, no-process-exit
}

run(process.argv[2], process.argv[3], process.argv[4], process.argv[5], process.argv[6])
.catch(require('@oclif/errors/handle'))
