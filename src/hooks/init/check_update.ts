import {Hook} from '@oclif/config'
import {spawn} from 'child_process'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as semver from 'semver'

const hook: Hook<'init'> = async function ({config}) {
  const file = path.join(config.cacheDir, 'version')
  try {
    const distTags = await fs.readJSON(file)
    if (semver.gt(distTags.latest, config.version)) {
      this.warn(`Update available to ${distTags.latest} from ${config.version}`)
    }
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }

  spawn(
    process.execPath,
    [path.join(__dirname, '../../../lib/get_version'), config.name, file],
    {
      // detached: !config.windows,
      // stdio: 'ignore',
      stdio: 'inherit',
    }
  ).unref()
}

export default hook
