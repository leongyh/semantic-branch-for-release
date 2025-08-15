import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.ts'
import { SimpleGit, simpleGit } from 'simple-git'
import fs from 'fs'
import('process')
import { SIMPLE_GIT_CONFIG } from '../src/constants.ts'

jest.unstable_mockModule('@actions/core', () => core)

// Only import the module after setting up the mock
const { run } = await import('../src/main.ts')

const dir = process.cwd() + '/test-repo'

async function initGitRepo(dir: string): Promise<void> {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir)
  } else {
    fs.rmSync(dir, { recursive: true, force: true })
    fs.mkdirSync(dir)
  }
  await simpleGit(dir, SIMPLE_GIT_CONFIG).init({ '--initial-branch': 'main' })
}

function cleanupGitRepo(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

describe('Test release action', () => {
  beforeEach(async () => {
    await initGitRepo(dir)

    core.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'action':
          return 'release'
        case 'trunk-branch-name':
          return 'main'
        case 'release-branch-pattern':
          return '^release-(0|[1-9]\d*)\.(0|[1-9]\d*)\.x$'
        case 'release-branch-template':
          return 'release-${major}.${minor}.x'
        case 'dry-run':
          return 'true'
        default:
          throw new Error(`Unknown input: ${name}`)
      }
    })
  })

  afterEach(() => {
    cleanupGitRepo(dir)

    jest.resetAllMocks()
  })

  test('make a release from a release branch', async () => {
    /*
     *                /-> v1.1.0-rc.2, [make release v1.1.0] (release-1.1.x)
     * v1.0.0 -> v1.1.0-rc.1 (main)
     */
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.tag(['v1.0.0'])

    await git.commit('Update to v1.1.0-rc.1', {
      '--allow-empty': null
    })
    await git.tag(['v1.1.0-rc.1'])

    await git.checkout(['-b', 'release-1.1.x'])
    await git.commit('Update to v1.1.0-rc.2', {
      '--allow-empty': null
    })
    await git.tag(['v1.1.0-rc.2'])

    await run(git)

    const tags = await git.tags({ '--points-at': 'HEAD' })

    expect(tags.all.includes('v1.1.0')).toBe(true)
    expect(core.setOutput).toHaveBeenCalledWith('next-version', 'v1.1.0')
    expect(core.setOutput).toHaveBeenCalledWith('previous-version', 'v1.1.0-rc.2')
    expect(core.setOutput).toHaveBeenCalledWith('previous-stable-version', 'v1.0.0')
  })

  test('make a release from a release branch with multiple valid tags at HEAD', async () => {
    /*
     *                /-> v1.1.0-rc.2, some-tag-1, some-tag-2 [make release v1.1.0] (release-1.1.x)
     * v1.0.0 -> v1.1.0-rc.1 (main)
     */
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.tag(['v1.0.0'])

    await git.commit('Update to v1.1.0-rc.1', {
      '--allow-empty': null
    })
    await git.tag(['v1.1.0-rc.1'])

    await git.checkout(['-b', 'release-1.1.x'])
    await git.commit('Update to v1.1.0-rc.2', {
      '--allow-empty': null
    })
    await git.tag(['v1.1.0-rc.2'])
    await git.tag(['some-tag-1'])
    await git.tag(['some-tag-2'])

    await run(git)

    const tags = await git.tags({ '--points-at': 'HEAD' })

    expect(tags.all.includes('v1.1.0')).toBe(true)
    expect(core.setOutput).toHaveBeenCalledWith('next-version', 'v1.1.0')
    expect(core.setOutput).toHaveBeenCalledWith('previous-version', 'v1.1.0-rc.2')
    expect(core.setOutput).toHaveBeenCalledWith('previous-stable-version', 'v1.0.0')
  })

  test('make release from an older release branch', async () => {
    /*
     *              /-> v1.1.0-rc.2, v1.1.0 -> v1.1.1-rc.1 [make release v1.1.1]  (release-1.1.x)
     * v1.0.0 -> v1.1.0-rc.1 -> v1.2.0-rc.1 -> v1.3.0-rc.1(main)
     *                                \->v1.2.0-rc.2 -> v1.2.0-rc.3, v1.2.0 (release-1.2.x)
     */
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.tag(['v1.0.0'])

    await git.commit('feat: Update to v1.1.0-rc.1', {
      '--allow-empty': null
    })
    await git.tag(['v1.1.0-rc.1'])

    await git.checkout(['-b', 'release-1.1.x'])
    await git.commit('fix: Update to v1.1.0-rc.2', {
      '--allow-empty': null
    })
    await git.tag(['v1.1.0-rc.2'])
    await git.tag(['v1.1.0'])

    await git.commit('fix: Some changes in release branch', {
      '--allow-empty': null
    })
    await git.tag(['v1.1.1-rc.1'])

    await git.checkout('main')
    await git.commit('feat: Update to v1.2.0-rc.1', {
      '--allow-empty': null
    })
    await git.tag(['v1.2.0-rc.1'])

    await git.checkout(['-b', 'release-1.2.x'])
    await git.commit('fix: Update to v1.2.0-rc.2', {
      '--allow-empty': null
    })
    await git.tag(['v1.2.0-rc.2'])

    await git.commit('fix: Update to v1.2.0-rc.3', {
      '--allow-empty': null
    })
    await git.tag(['v1.2.0-rc.3'])
    await git.tag(['v1.2.0'])

    await git.checkout('main')
    await git.commit('feat: Update to v1.3.0-rc.1', {
      '--allow-empty': null
    })
    await git.tag(['v1.3.0-rc.1'])

    await git.checkout('release-1.1.x')

    await run(git)

    const tags = await git.tags({ '--points-at': 'HEAD' })

    expect(tags.all.includes('v1.1.1')).toBe(true)
    expect(core.setOutput).toHaveBeenCalledWith('next-version', 'v1.1.1')
    expect(core.setOutput).toHaveBeenCalledWith('previous-version', 'v1.1.1-rc.1')
    expect(core.setOutput).toHaveBeenCalledWith('previous-stable-version', 'v1.1.0')
  })

  test('no tag at HEAD', async () => {
    /*
     *               /-> v1.1.0-rc.2 -> 1234567 (release-1.1.x)
     * v1.0.0 -> v1.1.0-rc.1 (main)
     */
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.tag(['v1.0.0'])

    await git.commit('Update to v1.1.0-rc.1', {
      '--allow-empty': null
    })
    await git.tag(['v1.1.0-rc.1'])

    await git.checkout(['-b', 'release-1.1.x'])
    await git.commit('Update to v1.1.0-rc.2', {
      '--allow-empty': null
    })
    await git.tag(['v1.1.0-rc.2'])

    await git.commit('Some changes in release branch', {
      '--allow-empty': null
    })

    await expect(async () => await run(git)).rejects.toThrow(
      `No tags found at HEAD of release branch. Cannot make a release without a tag at HEAD. There might be commit(s) on the release branch that have not made it to 'rc'. Try running 'release-cut' action first.`
    )
  })

  test('no release candidate tag at HEAD', async () => {
    /*
     *               /-> some-tag (release-1.1.x)
     * v1.0.0 -> v1.1.0-rc.1 (main)
     */
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.tag(['v1.0.0'])

    await git.commit('Update to v1.1.0-rc.1', {
      '--allow-empty': null
    })
    await git.tag(['v1.1.0-rc.1'])

    await git.checkout(['-b', 'release-1.1.x'])
    await git.commit('Some changes in release branch', {
      '--allow-empty': null
    })
    await git.tag(['some-tag'])

    await expect(async () => await run(git)).rejects.toThrow(
      `No release candidate tags found at HEAD of release branch. Cannot make a release without a release candidate tag.`
    )
  })

  test('multiple release candidate tags at HEAD', async () => {
    /*
     *               /-> v1.1.0-rc.2, v1.1.0-rc.3 (release-1.1.x)
     * v1.0.0 -> v1.1.0-rc.1 (main)
     */
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.tag(['v1.0.0'])

    await git.commit('Update to v1.1.0-rc.1', {
      '--allow-empty': null
    })
    await git.tag(['v1.1.0-rc.1'])

    await git.checkout(['-b', 'release-1.1.x'])
    await git.commit('Update to v1.1.0-rc.2', {
      '--allow-empty': null
    })
    await git.tag(['v1.1.0-rc.2'])
    await git.tag(['v1.1.0-rc.3'])

    await expect(async () => await run(git)).rejects.toThrow(
      `Multiple release candidate tags found at HEAD of release branch: 'v1.1.0-rc.2, v1.1.0-rc.3'. There should be only one release candidate tag at HEAD of a release branch.`
    )
  })

  test('release tag at HEAD', async () => {
    /*
     *               /-> v1.1.0-rc.2, v1.1.0 (release-1.1.x)
     * v1.0.0 -> v1.1.0-rc.1 (main)
     */
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.tag(['v1.0.0'])

    await git.commit('Update to v1.1.0-rc.1', {
      '--allow-empty': null
    })
    await git.tag(['v1.1.0-rc.1'])

    await git.checkout(['-b', 'release-1.1.x'])
    await git.commit('Update to v1.1.0-rc.2', {
      '--allow-empty': null
    })
    await git.tag(['v1.1.0-rc.2'])
    await git.tag(['v1.1.0'])

    await expect(async () => await run(git)).rejects.toThrow(
      `Release tag(s) found at HEAD of release branch: 'v1.1.0, v1.1.0-rc.2'. A release has already been made from this commit.`
    )
  })

  test('not a release branch', async () => {
    /*
     * v1.0.0 -> v1.1.0-rc.1 (main)
     */
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.tag(['v1.0.0'])

    await git.commit('Update to v1.1.0-rc.1', {
      '--allow-empty': null
    })
    await git.tag(['v1.1.0-rc.1'])

    await expect(async () => await run(git)).rejects.toThrow(
      `Current branch 'main' is not a release branch. Releases can only be made from a release branch.`
    )
  })
})

describe('Test release-cut action', () => {
  beforeEach(async () => {
    await initGitRepo(dir)
    core.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'action':
          return 'release-cut'
        case 'trunk-branch-name':
          return 'main'
        case 'release-branch-pattern':
          return '^release-(0|[1-9]\d*)\.(0|[1-9]\d*)\.x$'
        case 'release-branch-template':
          return 'release-${major}.${minor}.x'
        case 'dry-run':
          return 'true'
        default:
          throw new Error(`Unknown input: ${name}`)
      }
    })
  })

  afterEach(() => {
    cleanupGitRepo(dir)

    jest.resetAllMocks()
  })

  test('make major cut on new repository', async () => {
    /*
     * . (feat) -> . (feat!) -> [make cut, v1.0.0-rc.1] (main)
     */
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.commit('feat(my-scope): hello', {
      '--allow-empty': null
    })
    await git.commit('feat(my-scope)!: world', {
      '--allow-empty': null
    })

    await run(git)

    const tags = await git.tags({ '--points-at': 'HEAD' })
    const currentBranch = await git.branch()

    expect(tags.all.includes('v1.0.0-rc.1')).toBe(true)
    expect(currentBranch.current).toBe('release-1.0.x')
    expect(core.setOutput).toHaveBeenCalledWith('next-version', 'v1.0.0-rc.1')
    expect(core.setOutput).toHaveBeenCalledWith('previous-version', '')
    expect(core.setOutput).toHaveBeenCalledWith('previous-stable-version', '')
  })

  test('make minor cut on new repository', async () => {
    /*
     * . (feat) -> . (feat) -> [make cut, v0.1.0-rc.1] (main)
     */
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.commit('feat(my-scope): hello', {
      '--allow-empty': null
    })
    await git.commit('feat(my-scope): world', {
      '--allow-empty': null
    })

    await run(git)

    const tags = await git.tags({ '--points-at': 'HEAD' })
    const currentBranch = await git.branch()

    expect(tags.all.includes('v0.1.0-rc.1')).toBe(true)
    expect(currentBranch.current).toBe('release-0.1.x')
    expect(core.setOutput).toHaveBeenCalledWith('next-version', 'v0.1.0-rc.1')
    expect(core.setOutput).toHaveBeenCalledWith('previous-version', '')
    expect(core.setOutput).toHaveBeenCalledWith('previous-stable-version', '')
  })

  test('make major cut on trunk', async () => {
    /*
     *
     * v1.0.0-rc.1, v1.0.0 -> [make cut, v2.0.0-rc.1] (main)
     */
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.tag(['v1.0.0-rc.1'])
    await git.tag(['v1.0.0'])

    await git.commit('feat(my-scope)!: Update to v2.0.0-rc.1', {
      '--allow-empty': null
    })

    await run(git)

    const tags = await git.tags({ '--points-at': 'HEAD' })
    const currentBranch = await git.branch()

    expect(tags.all.includes('v2.0.0-rc.1')).toBe(true)
    expect(currentBranch.current).toBe('release-2.0.x')
    expect(core.setOutput).toHaveBeenCalledWith('next-version', 'v2.0.0-rc.1')
    expect(core.setOutput).toHaveBeenCalledWith('previous-version', 'v1.0.0')
    expect(core.setOutput).toHaveBeenCalledWith('previous-stable-version', 'v1.0.0')
  })

  test('make minor cut on trunk', async () => {
    /*
     * v1.0.0-rc.1, v1.0.0 -> [make cut, v1.1.0-rc.1] (main)
     */
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.tag(['v1.0.0-rc.1'])
    await git.tag(['v1.0.0'])

    await git.commit('feat(my-scope): Update to v1.1.0-rc.1', {
      '--allow-empty': null
    })

    await run(git)

    const tags = await git.tags({ '--points-at': 'HEAD' })
    const currentBranch = await git.branch()

    expect(tags.all.includes('v1.1.0-rc.1')).toBe(true)
    expect(currentBranch.current).toBe('release-1.1.x')
    expect(core.setOutput).toHaveBeenCalledWith('next-version', 'v1.1.0-rc.1')
    expect(core.setOutput).toHaveBeenCalledWith('previous-version', 'v1.0.0')
    expect(core.setOutput).toHaveBeenCalledWith('previous-stable-version', 'v1.0.0')
  })

  test('make patch cut on trunk', async () => {
    /*
     * v1.0.0-rc.1, v1.0.0 -> [make cut, v1.0.1-rc.1] (main)
     */
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.tag(['v1.0.0-rc.1'])
    await git.tag(['v1.0.0'])

    await git.commit('fix(my-scope): Update to v1.0.1-rc.1', {
      '--allow-empty': null
    })

    await expect(async () => await run(git)).rejects.toThrow(
      `Cannot make a patch release from the trunk branch 'main'. Use a release branch for patch releases.`
    )
  })

  test('make major release cut from a release branch', async () => {
    /*
     * v1.0.0-rc.1, -> . [major change, make cut] (release-1.0.x)
     */
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.tag(['v1.0.0-rc.1'])

    await git.checkout(['-b', 'release-1.0.x'])
    await git.commit('fix(my-scope)!: hey', {
      '--allow-empty': null
    })

    await expect(async () => await run(git)).rejects.toThrow(
      `Major releases can only be made from the trunk branch 'main'. Use the trunk branch for major releases.`
    )
  })

  test('make minor release cut from a release branch', async () => {
    /*
     * v1.0.0-rc.1, -> . [minor change, make cut] (release-1.0.x)
     */
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.tag(['v1.0.0-rc.1'])

    await git.checkout(['-b', 'release-1.0.x'])
    await git.commit('feat(my-scope): hey', {
      '--allow-empty': null
    })

    await expect(async () => await run(git)).rejects.toThrow(
      `Minor releases can only be made from the trunk branch 'main'. Use the trunk branch for minor releases.`
    )
  })

  test('make patch release cut from a release branch', async () => {
    /*
     * v1.0.0-rc.1, -> . [patch change, make cut] (release-1.0.x)
     */
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.tag(['v1.0.0-rc.1'])

    await git.checkout(['-b', 'release-1.0.x'])
    await git.commit('fix(my-scope): hey', {
      '--allow-empty': null
    })

    await run(git)

    const tags = await git.tags({ '--points-at': 'HEAD' })
    const currentBranch = await git.branch()

    expect(tags.all.includes('v1.0.0-rc.2')).toBe(true)
    expect(currentBranch.current).toBe('release-1.0.x')
    expect(core.setOutput).toHaveBeenCalledWith('next-version', 'v1.0.0-rc.2')
    expect(core.setOutput).toHaveBeenCalledWith('previous-version', 'v1.0.0-rc.1')
    expect(core.setOutput).toHaveBeenCalledWith('previous-stable-version', '')
  })

  test('make valid trunk release cut complex repo 1', async () => {
    /*
     * v1.0.0-rc.1, v1.0.0 -> . (fix) -> . some-tag-1 (fix) -> some-tag-2 (feat) [make cut, v1.1.0-rc.1] (main)
     */
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.tag(['v1.0.0-rc.1'])
    await git.tag(['v1.0.0'])

    await git.commit('fix(my-scope): hello', {
      '--allow-empty': null
    })
    await git.commit('fix(my-scope): world', {
      '--allow-empty': null
    })
    await git.tag(['some-tag-1'])
    await git.commit('feat(my-scope): hey', {
      '--allow-empty': null
    })
    await git.tag(['some-tag-2'])

    await run(git)

    const tags = await git.tags({ '--points-at': 'HEAD' })
    const currentBranch = await git.branch()

    expect(tags.all.includes('v1.1.0-rc.1')).toBe(true)
    expect(currentBranch.current).toBe('release-1.1.x')
    expect(core.setOutput).toHaveBeenCalledWith('next-version', 'v1.1.0-rc.1')
    expect(core.setOutput).toHaveBeenCalledWith('previous-version', 'v1.0.0')
    expect(core.setOutput).toHaveBeenCalledWith('previous-stable-version', 'v1.0.0')
  })

  test('make release cut with some non-conventional commits', async () => {
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.tag(['v1.0.0-rc.1'])

    await git.commit('not a conventional commit message: hello', {
      '--allow-empty': null
    })
    await git.commit('feat(my-scope): world', {
      '--allow-empty': null
    })

    await run(git)

    const tags = await git.tags({ '--points-at': 'HEAD' })
    const currentBranch = await git.branch()

    expect(tags.all.includes('v1.1.0-rc.1')).toBe(true)
    expect(currentBranch.current).toBe('release-1.1.x')
    expect(core.setOutput).toHaveBeenCalledWith('next-version', 'v1.1.0-rc.1')
    expect(core.setOutput).toHaveBeenCalledWith('previous-version', 'v1.0.0-rc.1')
    expect(core.setOutput).toHaveBeenCalledWith('previous-stable-version', '')
  })

  test('make release cut twice on same branch', async () => {
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.commit('feat(my-scope): hello', { '--allow-empty': null })

    await run(git)

    await git.commit('feat(my-scope): world', { '--allow-empty': null })
    await git.checkout('release-0.1.x')

    await expect(async () => run(git)).rejects.toThrow(
      `Minor releases can only be made from the trunk branch 'main'. Use the trunk branch for minor releases.`
    )
  })
})
