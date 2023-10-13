import {Hook} from '@oclif/core'
import chalk from 'chalk'
import makeDebug from 'debug'
import {spawn} from 'node:child_process'
import {Stats} from 'node:fs'
import {readFile, stat, utimes} from 'node:fs/promises'
import {dirname, join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const readJSON = async <T>(file: string): Promise<{contents: T; stat: Stats}> => ({
  contents: JSON.parse(await readFile(file, 'utf8')),
  stat: await stat(file),
})

function hasNotBeenMsSinceDate(ms: number, date: Date): boolean {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  return diff < ms
}

function convertToMs(frequency: number, unit: 'days' | 'hours' | 'milliseconds' | 'minutes' | 'seconds'): number {
  switch (unit) {
    case 'days': {
      return frequency * 24 * 60 * 60 * 1000
    }

    case 'hours': {
      return frequency * 60 * 60 * 1000
    }

    case 'milliseconds': {
      return frequency
    }

    case 'minutes': {
      return frequency * 60 * 1000
    }

    case 'seconds': {
      return frequency * 1000
    }

    default: {
      // default to minutes
      return frequency * 60 * 1000
    }
  }
}

const hook: Hook<'init'> = async function ({config}) {
  const debug = makeDebug('update-check')
  const file = join(config.cacheDir, 'version')

  // Destructure package.json configuration with defaults
  const {
    authorization = '',
    frequency,
    frequencyUnit,
    message = '<%= config.name %> update available from <%= chalk.greenBright(config.version) %> to <%= chalk.greenBright(latest) %>.',
    registry = 'https://registry.npmjs.org',
    timeoutInDays = 60,
  } = config.pjson.oclif['warn-if-update-available'] || {}

  const warningFrequency = (config.scopedEnvVar('NEW_VERSION_CHECK_FREQ') as number | undefined) ?? frequency
  const warningFrequencyUnit =
    (config.scopedEnvVar('NEW_VERSION_CHECK_FREQ_UNIT') as typeof frequencyUnit) ?? frequencyUnit ?? 'minutes'

  const tag = (config.scopedEnvVar('NEW_VERSION_CHECK_TAG') as string | undefined) ?? 'latest'

  const checkVersion = async () => {
    try {
      // do not show warning if updating
      if (process.argv[2] === 'update' || this.config.scopedEnvVarTrue('SKIP_NEW_VERSION_CHECK')) return

      const {contents: distTags, stat} = await readJSON<{[tag: string]: string}>(file)

      // If the file was modified before the timeout, don't show the warning
      if (
        warningFrequency &&
        warningFrequencyUnit &&
        hasNotBeenMsSinceDate(convertToMs(warningFrequency, warningFrequencyUnit), stat.mtime)
      )
        return

      if (config.version.includes('-')) {
        // to-do: handle prerelease channels
        return
      }

      const {gt} = await import('semver')
      if (distTags[tag] && gt(distTags[tag].split('-')[0], config.version.split('-')[0])) {
        // Default message if the user doesn't provide one
        const {default: template} = await import('lodash.template')
        this.warn(
          template(message)({
            chalk,
            config,
            ...distTags,
          }),
        )

        // Update the modified time (mtime) of the version file so that we can track the last time we
        // showed the warning. This makes it possible to respect the frequency and frequencyUnit options.
        await utimes(file, new Date(), new Date())
      }
    } catch (error: unknown) {
      const {code} = error as {code: string}
      if (code !== 'ENOENT') throw error
    }
  }

  const refreshNeeded = async () => {
    if (this.config.scopedEnvVarTrue('FORCE_VERSION_CACHE_UPDATE')) return true
    if (this.config.scopedEnvVarTrue('SKIP_NEW_VERSION_CHECK')) return false
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
