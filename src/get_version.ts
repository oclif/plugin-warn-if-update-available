import * as fs from 'fs-extra'
import HTTP from 'http-call'

async function run(name: string, file: string) {
  const {body} = await HTTP.get(`https://registry.npmjs.org/${name.replace('/', '%2f')}`, {timeout: 5000})
  await fs.outputJSON(file, body['dist-tags'])
  process.exit(0)
}

run(process.argv[2], process.argv[3])
.catch(require('@oclif/errors/handle'))
