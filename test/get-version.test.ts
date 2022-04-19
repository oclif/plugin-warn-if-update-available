const {describe, it, beforeEach, afterEach} = require('mocha')
const {expect} = require('chai')
const sinon = require('sinon')
const proxyquire = require('proxyquire').noCallThru()

import type {SinonStub} from 'sinon'

const pause = (ms: number) => new Promise((resolve => setTimeout(resolve, ms)))

describe('get-version', function () {
  let writeStub: SinonStub
  let httpGetStub: SinonStub

  beforeEach(function () {
    sinon.stub(process, 'exit')
    sinon.stub(console, 'error')
    writeStub = sinon.stub().resolves(true)
    httpGetStub = sinon.stub().resolves({body: {'dist-tags': {canary: '4.5.6-canary.1', latest: '4.5.6'}}})
  })

  afterEach(function () {
    sinon.restore()
  })

  async function runWithArgs(...args: string[]) {
    sinon.stub(process, 'argv').value([undefined, undefined, ...args])
    proxyquire('../src/get-version', {
      'fs-extra': {
        outputJSON: writeStub,
      },
      'http-call': {
        default: {
          get: httpGetStub,
        },
      },
    })

    // pause a bit for async stubs
    await pause(10)
  }

  it('exits clean', async function () {
    await runWithArgs('mock-cli', '/path/to/.cache/version', '1.2.3', 'https://registry.npmjs.org/', '')
    expect(process.exit).calledWith(0)
  })

  it('writes version cache', async function () {
    await runWithArgs('mock-cli', '/path/to/.cache/version', '1.2.3', 'https://registry.npmjs.org/', '')
    expect(writeStub).calledWith('/path/to/.cache/version', {
      current: '1.2.3',
    })
  })

  it('fetches dist-tags from registry', async function () {
    await runWithArgs('mock-cli', '/path/to/.cache/version', '1.2.3', 'https://registry.npmjs.org/', '')
    expect(httpGetStub).calledWith('https://registry.npmjs.org/mock-cli')
  })

  it('updates version cache with dist-tags', async function () {
    await runWithArgs('mock-cli', '/path/to/.cache/version', '1.2.3', 'https://registry.npmjs.org/', '')
    expect(writeStub).calledWith('/path/to/.cache/version', {
      canary: '4.5.6-canary.1',
      latest: '4.5.6',
      current: '1.2.3',
    })
  })

  it('exits clean with write error', async function () {
    const error = new Error('Failed to write')
    writeStub.rejects(error)

    await runWithArgs('mock-cli', '/path/to/.cache/version', '1.2.3', 'https://registry.npmjs.org/', '')
    expect(console.error).calledWith(error)
    expect(process.exit).calledWith(0)
  })

  it('exits clean with http error', async function () {
    const error = new Error('Failed to fetch')
    httpGetStub.rejects(error)

    await runWithArgs('mock-cli', '/path/to/.cache/version', '1.2.3', 'https://registry.npmjs.org/', '')
    expect(console.error).calledWith(error)
    expect(process.exit).calledWith(0)
  })
})
