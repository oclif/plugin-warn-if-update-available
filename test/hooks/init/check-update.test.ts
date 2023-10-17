import {Config} from '@oclif/core'
import {expect} from 'chai'
import {join} from 'node:path'
import {SinonSandbox, createSandbox} from 'sinon'

import {
  convertToMs,
  getEnvVarEnum,
  getEnvVarNumber,
  getNewerVersion,
  hasNotBeenMsSinceDate,
  semverGreaterThan,
} from '../../../src/hooks/init/check-update.js'

describe('semverGreaterThan', () => {
  it('should return true if a > b (major version)', () => {
    expect(semverGreaterThan('1.0.0', '0.0.0')).to.be.true
  })

  it('should return true if a > b (minor version)', () => {
    expect(semverGreaterThan('1.1.0', '1.0.0')).to.be.true
  })

  it('should return true if a > b (patch version)', () => {
    expect(semverGreaterThan('1.1.1', '1.1.0')).to.be.true
  })

  it('should return true if a > b (prerelease)', () => {
    expect(semverGreaterThan('1.1.0-beta.0', '1.1.0')).to.be.true
  })

  it('should return true if a > b (both prerelease)', () => {
    expect(semverGreaterThan('1.1.0-beta.1', '1.1.0-beta.0')).to.be.true
  })

  it('should return false if a < b (major version)', () => {
    expect(semverGreaterThan('0.0.0', '1.0.0')).to.be.false
  })

  it('should return false if a < b (minor version)', () => {
    expect(semverGreaterThan('1.0.0', '1.1.0')).to.be.false
  })

  it('should return false if a < b (patch version)', () => {
    expect(semverGreaterThan('1.1.0', '1.1.1')).to.be.false
  })

  it('should return false if a < b (prerelease)', () => {
    expect(semverGreaterThan('1.1.0', '1.1.0-beta.0')).to.be.false
  })

  it('should return false if a < b (both prerelease)', () => {
    expect(semverGreaterThan('1.1.0-beta.0', '1.1.0-beta.1')).to.be.false
  })

  it('should return false if a = b', () => {
    expect(semverGreaterThan('1.1.1', '1.1.1')).to.be.false
  })

  it('should return false if a = b (prerelease)', () => {
    expect(semverGreaterThan('1.1.1-beta.0', '1.1.1-beta.0')).to.be.false
  })
})

describe('getEnvVarNumber', () => {
  afterEach(() => {
    delete process.env.SF_NEW_VERSION_CHECK_FREQ
  })

  it('should return undefined if env var is not set and no default provided', () => {
    expect(getEnvVarNumber('SF_NEW_VERSION_CHECK_FREQ')).to.be.undefined
  })

  it('should return default value if env var is not set and default is provided', () => {
    expect(getEnvVarNumber('SF_NEW_VERSION_CHECK_FREQ', 123)).to.equal(123)
  })

  it('should return undefined if env var is not a number', () => {
    process.env.SF_NEW_VERSION_CHECK_FREQ = 'abc'
    expect(getEnvVarNumber('SF_NEW_VERSION_CHECK_FREQ')).to.be.undefined
  })

  it('should return number if env var is a number', () => {
    process.env.SF_NEW_VERSION_CHECK_FREQ = '123'
    expect(getEnvVarNumber('SF_NEW_VERSION_CHECK_FREQ')).to.equal(123)
  })
})

describe('getEnvVarEnum', () => {
  afterEach(() => {
    delete process.env.SF_NEW_VERSION_CHECK_FREQ_UNIT
  })

  it('should return undefined if env var is not set and no default provided', () => {
    expect(getEnvVarEnum('SF_NEW_VERSION_CHECK_FREQ_UNIT', ['minutes', 'hours'])).to.be.undefined
  })

  it('should return default value if env var is not set and default is provided', () => {
    expect(getEnvVarEnum('SF_NEW_VERSION_CHECK_FREQ_UNIT', ['minutes', 'hours'], 'hours')).to.equal('hours')
  })

  it('should return undefined if env var is not in allowed values', () => {
    process.env.SF_NEW_VERSION_CHECK_FREQ_UNIT = 'abc'
    expect(getEnvVarEnum('SF_NEW_VERSION_CHECK_FREQ_UNIT', ['minutes', 'hours'])).to.be.undefined
  })

  it('should return value if env var is in allowed values', () => {
    process.env.SF_NEW_VERSION_CHECK_FREQ_UNIT = 'hours'
    expect(getEnvVarEnum('SF_NEW_VERSION_CHECK_FREQ_UNIT', ['minutes', 'hours'])).to.equal('hours')
  })
})

describe('getNewerVersion', () => {
  let config: Config
  let sandbox: SinonSandbox
  const versionFile = join('fake', 'cache', 'version')
  const lastWarningFile = join('fake', 'cache', 'last-warning')

  beforeEach(async () => {
    config = await Config.load(process.cwd())
    sandbox = createSandbox()
  })

  afterEach(() => {
    sandbox.restore()
  })

  it('should return undefined if argv[2] is "update"', async () => {
    expect(await getNewerVersion({argv: ['node', 'cli.js', 'update'], config, lastWarningFile, versionFile})).to.be
      .undefined
  })

  it('should return undefined if env var is set to true', async () => {
    sandbox.stub(config, 'scopedEnvVarTrue').returns(true)
    expect(await getNewerVersion({argv: ['node', 'cli.js'], config, lastWarningFile, versionFile})).to.be.undefined
  })

  it('should return undefined if version is a prerelease (contains a "-")', async () => {
    sandbox.stub(config, 'version').value('1.0.0-beta.0')
    expect(await getNewerVersion({argv: ['node', 'cli.js'], config, lastWarningFile, versionFile})).to.be.undefined
  })
})

describe('convertToMs', () => {
  it('should return frequency in milliseconds', () => {
    expect(convertToMs(1, 'milliseconds')).to.equal(1)
  })

  it('should return frequency in seconds', () => {
    expect(convertToMs(1, 'seconds')).to.equal(1000)
  })

  it('should return frequency in minutes', () => {
    expect(convertToMs(1, 'minutes')).to.equal(60_000)
  })

  it('should return frequency in hours', () => {
    expect(convertToMs(1, 'hours')).to.equal(3_600_000)
  })

  it('should return frequency in days', () => {
    expect(convertToMs(1, 'days')).to.equal(86_400_000)
  })
})

describe('hasNotBeenMsSinceDate', () => {
  it('should return true if current date is older than the given date by the given number of milliseconds', () => {
    expect(hasNotBeenMsSinceDate(500, new Date(Date.now() - 501), new Date())).to.be.true
  })

  it('should return false if current date is newer than the given date by the given number of milliseconds', () => {
    expect(hasNotBeenMsSinceDate(500, new Date(), new Date(Date.now() - 501))).to.be.false
  })
})
