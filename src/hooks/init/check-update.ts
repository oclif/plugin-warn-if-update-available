import {Hook} from '@oclif/core'
import chalk from 'chalk'
import makeDebug from 'debug'
import {spawn} from 'node:child_process'
import {readFile, stat} from 'node:fs/promises'
import {dirname, join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {gt} from 'semver'

const hook: Hook<'init'> = async function ({config}) {
  const debug = makeDebug('update-check')
  const file = join(config.cacheDir, 'version')

  // Destructure package.json configuration with defaults
  const {
    authorization = '',
    message = '<%= config.name %> update available from <%= chalk.greenBright(config.version) %> to <%= chalk.greenBright(latest) %>.',
    registry = 'https://registry.npmjs.org',
    timeoutInDays = 60,
  } = config.pjson.oclif['warn-if-update-available'] || {}

  const checkVersion = async () => {
    try {
      // do not show warning if updating
      if (process.argv[2] === 'update') return
      const distTags = JSON.parse(await readFile(file, 'utf8'))
      if (config.version.includes('-')) {
        // to-do: handle prerelease channels
        return
      }

      if (distTags && distTags.latest && gt(distTags.latest.split('-')[0], config.version.split('-')[0])) {
        // Default message if the user doesn't provide one
        const {default: template} = await import('lodash.template')
        this.warn(
          template(message)({
            chalk,
            config,
            ...distTags,
          }),
        )
      }
    } catch (error: unknown) {
      const {code} = error as {code: string}
      if (code !== 'ENOENT') throw error
    }
  }

  const refreshNeeded = async () => {
    if (this.config.scopedEnvVarTrue('FORCE_VERSION_CACHE_UPDATE')) return true
    try {
      const {mtime} = await stat(file)
      const staleAt = new Date(mtime.valueOf() + 1000 * 60 * 60 * 24 * timeoutInDays)
      return staleAt < new Date()
    } catch (error) {
      debug(error)
      return true
    }
  }

  const spawnRefresh = async () => {
    const versionScript = resolve(dirname(fileURLToPath(import.meta.url)), '../../../lib/get-version')
    debug('spawning version refresh')
    debug(process.execPath, versionScript, config.name, file, config.version, registry, authorization)
    spawn(process.execPath, [versionScript, config.name, file, config.version, registry, authorization], {
      detached: !config.windows,
      stdio: 'ignore',
    }).unref()
  }

  await checkVersion()
  if (await refreshNeeded()) await spawnRefresh()
}

export default hook
