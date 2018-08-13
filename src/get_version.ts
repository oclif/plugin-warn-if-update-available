import * as fs from 'fs-extra'
import {promisify} from 'util'
const exec = promisify(require('child_process').exec)

async function run(name: string, file: string, version: string) {
  await fs.outputJSON(file, {current: version}) // touch file with current version to prevent multiple updates
  const {stdout} = await exec(`npm view ${name} dist-tags --json`)
  const distTags = JSON.parse(stdout)
  await fs.outputJSON(file, {...distTags, current: version})
  process.exit(0)
}

run(process.argv[2], process.argv[3], process.argv[4])
.catch(require('@oclif/errors/handle'))
