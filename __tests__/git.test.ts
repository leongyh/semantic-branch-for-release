import { describe, it, expect } from '@jest/globals'
import { SimpleGit, simpleGit } from 'simple-git'
import fs from 'fs'
import('process')
import {
  getTags,
  getLatestTag,
  getLatestStableTag,
  getTagsAtHEAD,
  getCurrentBranch,
  getCommitMessages,
  cutReleaseFromTrunk,
  cutReleaseFromReleaseBranch,
  makeRelease
} from '../src/git'
import { SIMPLE_GIT_CONFIG } from '../src/constants'

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

describe('Get Tags', () => {
  beforeEach(async () => {
    await initGitRepo(dir)
  })

  afterEach(() => {
    cleanupGitRepo(dir)
  })

  it('simple lineage', async () => {
    /*
     * v1.0.0 -> v1.0.1 -> v1.0.2 (main)
     */
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.tag(['v1.0.0'])

    await git.commit('Update to v1.0.1', {
      '--allow-empty': null
    })
    await git.tag(['v1.0.1'])

    await git.commit('Update to v1.0.2', {
      '--allow-empty': null
    })
    await git.tag(['v1.0.2'])

    const tags = await getTags(git, 'main')
    expect(tags).toEqual(['v1.0.0', 'v1.0.1', 'v1.0.2'])
  })

  it('single release branch lineage', async () => {
    /*
     *                               /-> v1.1.0-rc.2, v1.1.0 (release)
     * v1.0.0 -> v1.1.0-alpha.1, v1.1.0-rc.1 -> v1.2.0-alpha.1 (main)
     */
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.tag(['v1.0.0'])

    await git.commit('Update to v1.1.0-alpha.1', {
      '--allow-empty': null
    })
    await git.tag(['v1.1.0-alpha.1'])

    await git.checkoutBranch('release', 'main')
    await git.tag(['v1.1.0-rc.1'])

    await git.commit('Update to v1.1.0-rc.2', {
      '--allow-empty': null
    })
    await git.tag(['v1.1.0-rc.2'])
    await git.tag(['v1.1.0'])

    await git.checkout('main')
    await git.commit('Update to v1.2.0-alpha.1', {
      '--allow-empty': null
    })
    await git.tag(['v1.2.0-alpha.1'])

    const releaseTags = await getTags(git, 'release')
    const mainTags = await getTags(git, 'main')
    expect(releaseTags).toEqual(['v1.0.0', 'v1.1.0-alpha.1', 'v1.1.0-rc.1', 'v1.1.0-rc.2', 'v1.1.0'])
    expect(mainTags).toEqual(['v1.0.0', 'v1.1.0-alpha.1', 'v1.1.0-rc.1', 'v1.2.0-alpha.1'])
  })

  it('multiple release with multiple release branches', async () => {
    /*
     *                                  /-> v1.0.0-rc.2, v1.0.0 -> v1.0.1-rc.1, v1.0.1 (release-1.0.x) |   /-> v1.1.0-rc.2, v1.1.0 (release-1.1.x)
     * v1.0.0-alpha.1 -> v1.0.0-alpha.2, v1.0.0-rc.1 -> v1.1.0-alpha.1 -> v1.1.0-alpha.2 -> v1.1.0-alpha.3, v1.1.0-rc.1 -> v1.2.0-alpha.1 (main)
     */
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.tag(['v1.0.0-alpha.1'])

    await git.commit('Update to v1.0.0-alpha.2', {
      '--allow-empty': null
    })
    await git.tag(['v1.0.0-alpha.2'])

    await git.checkoutBranch('release-1.0.x', 'main')
    await git.tag(['v1.0.0-rc.1'])

    await git.commit('Release v1.0.0-rc.2', { '--allow-empty': null })
    await git.tag(['v1.0.0-rc.2'])
    await git.tag(['v1.0.0'])

    await git.commit('Release v1.0.0', { '--allow-empty': null })
    await git.tag(['v1.0.1-rc.1'])
    await git.tag(['v1.0.1'])

    await git.checkout('main')
    await git.commit('Update to v1.1.0-alpha.1', {
      '--allow-empty': null
    })
    await git.tag(['v1.1.0-alpha.1'])

    await git.commit('Update to v1.1.0-alpha.2', {
      '--allow-empty': null
    })
    await git.tag(['v1.1.0-alpha.2'])

    await git.commit('Update to v1.1.0-alpha.3', {
      '--allow-empty': null
    })
    await git.tag(['v1.1.0-alpha.3'])
    await git.tag(['v1.1.0-rc.1'])

    await git.checkoutBranch('release-1.1.x', 'main')
    await git.commit('Release v1.1.0-rc.2', { '--allow-empty': null })
    await git.tag(['v1.1.0-rc.2'])
    await git.tag(['v1.1.0'])

    await git.checkout('main')
    await git.commit('Update to v1.2.0-alpha.1', {
      '--allow-empty': null
    })
    await git.tag(['v1.2.0-alpha.1'])

    const release10xTags = await getTags(git, 'release-1.0.x')
    const release11xTags = await getTags(git, 'release-1.1.x')
    const mainTags = await getTags(git, 'main')

    expect(release10xTags).toEqual(['v1.0.0-alpha.1', 'v1.0.0-alpha.2', 'v1.0.0-rc.1', 'v1.0.0-rc.2', 'v1.0.0', 'v1.0.1-rc.1', 'v1.0.1'])
    expect(release11xTags).toEqual([
      'v1.0.0-alpha.1',
      'v1.0.0-alpha.2',
      'v1.0.0-rc.1',
      'v1.1.0-alpha.1',
      'v1.1.0-alpha.2',
      'v1.1.0-alpha.3',
      'v1.1.0-rc.1',
      'v1.1.0-rc.2',
      'v1.1.0'
    ])
    expect(mainTags).toEqual([
      'v1.0.0-alpha.1',
      'v1.0.0-alpha.2',
      'v1.0.0-rc.1',
      'v1.1.0-alpha.1',
      'v1.1.0-alpha.2',
      'v1.1.0-alpha.3',
      'v1.1.0-rc.1',
      'v1.2.0-alpha.1'
    ])
  })

  it('get tags by commit hash', async () => {
    /*
     * v1.0.0 -> v1.0.1 (target-commit) -> v1.0.2 (main)
     */
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.tag(['v1.0.0'])

    await git.commit('Update to v1.0.1', {
      '--allow-empty': null
    })
    await git.tag(['v1.0.1'])
    const targetCommit = (await git.revparse(['HEAD'])).trim()

    await git.commit('Update to v1.0.2', {
      '--allow-empty': null
    })
    await git.tag(['v1.0.2'])

    const tags = await getTags(git, targetCommit)
    expect(tags).toEqual(['v1.0.0', 'v1.0.1'])
  })
})

describe('Get Latest Tag', () => {
  beforeEach(async () => {
    await initGitRepo(dir)
  })

  afterEach(() => {
    cleanupGitRepo(dir)
  })

  it('should return latest tag from main branch', async () => {
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.tag(['v1.0.0'])

    await git.commit('Update to v1.0.1', {
      '--allow-empty': null
    })
    await git.tag(['v1.0.1'])

    const latestTag = await getLatestTag(git, 'main')
    expect(latestTag).toBe('v1.0.1')
  })

  test('includes non-semantic versioned tags', async () => {
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.tag(['v1.0.0'])

    await git.commit('Update to v1.0.1', {
      '--allow-empty': null
    })
    await git.tag(['v1.0.1'])
    await git.tag(['non-semantic-tag'])

    const latestTag = await getLatestTag(git, 'main')
    expect(latestTag).toBe('v1.0.1')
  })

  test('complex branches with multiple tag types', async () => {
    /*
     *      / (release-1.0.x)     /-> v1.1.0-rc.2, some-tag-2 (release-1.1.x)
     * v1.0.0-rc.1, v1.0.0 -> v1.1.0-rc.1, some-tag-1 -> v1.2.0-rc.1 -> some-tag- (main)
     */

    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.tag(['v1.0.0-rc.1'])

    await git.checkoutBranch('release-1.0.x', 'main')
    await git.tag(['v1.0.0'])

    git.checkout('main')
    await git.commit('Update to v1.1.0-rc.1', {
      '--allow-empty': null
    })
    await git.tag(['v1.1.0-rc.1'])
    await git.tag(['some-tag-1'])

    await git.checkoutBranch('release-1.1.x', 'main')
    await git.commit('Update to v1.1.0-rc.2', {
      '--allow-empty': null
    })
    await git.tag(['v1.1.0-rc.2'])
    await git.tag(['some-tag-2'])

    await git.checkout('main')
    await git.commit('Update to v1.2.0-rc.1', {
      '--allow-empty': null
    })
    await git.tag(['v1.2.0-rc.1'])

    await git.commit('Add some non-semantic tags', {
      '--allow-empty': null
    })
    await git.tag(['some-tag-3'])

    const latestTag = await getLatestTag(git, 'main')
    expect(latestTag).toBe('v1.2.0-rc.1')

    const latestTagRelease1_1 = await getLatestTag(git, 'release-1.1.x')
    expect(latestTagRelease1_1).toBe('v1.1.0-rc.2')

    const latestTagRelease1_0 = await getLatestTag(git, 'release-1.0.x')
    expect(latestTagRelease1_0).toBe('v1.0.0')
  })

  it('should return empty string if no tags', async () => {
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })

    const latestTag = await getLatestTag(git, 'main')
    expect(latestTag).toBe('')
  })
})

describe('Get Latest Stable Tag', () => {
  beforeEach(async () => {
    await initGitRepo(dir)
  })

  afterEach(() => {
    cleanupGitRepo(dir)
  })

  it('should return latest stable tag from main branch', async () => {
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.tag(['v1.0.0'])

    await git.commit('Update to v1.0.1-rc.1', {
      '--allow-empty': null
    })
    await git.tag(['v1.0.1-rc.1'])

    const latestStableTag = await getLatestStableTag(git, 'main')
    expect(latestStableTag).toBe('v1.0.0')
  })

  it('should return latest stable tag with multiple stable tags ignoring non-semantic tags', async () => {
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.tag(['v1.0.0'])

    await git.commit('Update to v1.0.1-rc.1', {
      '--allow-empty': null
    })
    await git.tag(['v1.0.1-rc.1'])
    await git.tag(['non-semantic-tag'])

    await git.commit('Update to v1.0.1', {
      '--allow-empty': null
    })
    await git.tag(['v1.0.1'])

    const latestStableTag = await getLatestStableTag(git, 'main')
    expect(latestStableTag).toBe('v1.0.1')
  })

  it('should return latest stable tag reachable from older branch', async () => {
    /*
     *      / v1.0.0-rc.2, v1.0.0 -> v1.0.1-rc.1 (release-1.0.x)
     * v1.0.0-rc.1 -> v1.1.0-rc.1 (main)
     *                    \-> v1.1.0-rc.2, v1.1.0 (release-1.1.x)
     */
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.tag(['v1.0.0-rc.1'])

    await git.checkoutBranch('release-1.0.x', 'main')
    await git.commit('Release v1.0.0-rc.2', { '--allow-empty': null })
    await git.tag(['v1.0.0-rc.2'])
    await git.tag(['v1.0.0'])

    await git.commit('v1.0.1-rc.1', { '--allow-empty': null })
    await git.tag(['v1.0.1-rc.1'])

    await git.checkout('main')
    await git.commit('Update to v1.1.0-rc.1', {
      '--allow-empty': null
    })

    await git.checkoutBranch('release-1.1.x', 'main')
    await git.commit('Release v1.1.0-rc.2', { '--allow-empty': null })
    await git.tag(['v1.1.0-rc.2'])
    await git.tag(['v1.1.0'])

    const latestStableTag = await getLatestStableTag(git, 'release-1.0.x')
    expect(latestStableTag).toBe('v1.0.0')
  })

  it('should return empty string if no stable tags', async () => {
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.tag(['v1.0.0-rc.1'])

    const latestStableTag = await getLatestStableTag(git, 'main')
    expect(latestStableTag).toBe('')
  })

  it('should return empty string if no tags', async () => {
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })

    const latestStableTag = await getLatestStableTag(git, 'main')
    expect(latestStableTag).toBe('')
  })
})

describe('Get Tag at HEAD', () => {
  beforeEach(async () => {
    await initGitRepo(dir)
  })

  afterEach(() => {
    cleanupGitRepo(dir)
  })

  it('should return 1 tags at HEAD', async () => {
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.tag(['v1.0.0'])

    const tagsAtHEAD = await getTagsAtHEAD(git)
    expect(tagsAtHEAD).toEqual(['v1.0.0'])
  })

  it('should return empty array if no tags at HEAD', async () => {
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })

    const tagsAtHEAD = await getTagsAtHEAD(git)
    expect(tagsAtHEAD.length).toBe(0)
  })

  it('should return multiple tags at HEAD', async () => {
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.tag(['v1.0.0'])
    await git.tag(['v1.0.1'])

    const tagsAtHEAD = await getTagsAtHEAD(git)
    expect(tagsAtHEAD).toEqual(['v1.0.0', 'v1.0.1'])
  })
})

describe('Get Current Branch', () => {
  beforeEach(async () => {
    await initGitRepo(dir)
  })

  afterEach(() => {
    cleanupGitRepo(dir)
  })

  it('should return the current branch name', async () => {
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.checkoutBranch('feature-branch', 'main')

    const currentBranch = await getCurrentBranch(git)
    expect(currentBranch).toBe('feature-branch')
  })

  it('should return "main" if no branch is checked out', async () => {
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.checkout('main')

    const currentBranch = await getCurrentBranch(git)
    expect(currentBranch).toBe('main')
  })
})

describe('Get Commit Messages', () => {
  beforeEach(async () => {
    await initGitRepo(dir)
  })

  afterEach(() => {
    cleanupGitRepo(dir)
  })

  it('should return commit messages between two tags', async () => {
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.tag(['v1.0.0'])

    await git.commit('Add feature A', { '--allow-empty': null })
    await git.tag(['v1.0.1'])

    await git.commit('Fix bug B', { '--allow-empty': null })
    await git.tag(['v1.0.2'])

    const messages = await getCommitMessages(git, 'v1.0.0', 'v1.0.2')
    expect(messages).toEqual(expect.arrayContaining(['Add feature A', 'Fix bug B']))
  })

  it('should return empty array if no commits between tags', async () => {
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.tag(['v1.0.0'])

    const messages = await getCommitMessages(git, 'v1.0.0', 'v1.0.0')
    expect(messages.length).toBe(0)
  })
})

describe('Cut Release From Trunk', () => {
  beforeEach(async () => {
    await initGitRepo(dir)
  })

  afterEach(() => {
    cleanupGitRepo(dir)
  })

  it('should cut a release branch from main', async () => {
    /*
     * v1.0.0-rc.1 -> . (main)
     *                    \-> (cut release here) (release-1.1.x)
     */
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.tag(['v1.0.0-rc.1'])

    await git.commit('Update to v1.1.0-rc.1', {
      '--allow-empty': null
    })

    await cutReleaseFromTrunk(git, 'main', 'release-1.1.x', 'v1.1.0-rc.1')

    const tags = await git.tags({ '--points-at': 'HEAD' })
    const branches = await git.branch()

    expect(tags.all.includes('v1.1.0-rc.1')).toBe(true)
    expect(branches.current).toBe('release-1.1.x')
  })

  it('should fail to cut a release branch if it already exists', async () => {
    /*
     * v1.0.0-rc.1 -> . (main)
     *                    \-> (release-1.1.x already exists)
     */
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.tag(['v1.0.0-rc.1'])

    await git.commit('Update to v1.1.0-rc.1', {
      '--allow-empty': null
    })

    await git.checkoutBranch('release-1.1.x', 'main')

    await expect(cutReleaseFromTrunk(git, 'main', 'release-1.1.x', 'v1.1.0-rc.1')).rejects.toThrow(`Branch 'release-1.1.x' already exists.`)
  })
})

describe('Cut Release From Release Branch', () => {
  beforeEach(async () => {
    await initGitRepo(dir)
  })

  afterEach(() => {
    cleanupGitRepo(dir)
  })

  it('should cut a release branch from another release branch', async () => {
    /*
     * v1.0.0-rc.1 -> v1.1.0-rc.1 (main)
     *                    \-> . (cut release here) (release-1.1.x)
     */
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.tag(['v1.0.0-rc.1'])

    await git.commit('Update to v1.1.0-rc.1', {
      '--allow-empty': null
    })
    await git.checkoutBranch('release-1.1.x', 'main')
    await git.tag(['v1.1.0-rc.1'])

    await git.commit('Update to v1.1.0-rc.2', {
      '--allow-empty': null
    })

    await cutReleaseFromReleaseBranch(git, 'release-1.1.x', 'v1.1.0-rc.2')

    const tags = await git.tags({ '--points-at': 'HEAD' })
    const branches = await git.branch()

    expect(tags.all.includes('v1.1.0-rc.2')).toBe(true)
    expect(branches.current).toBe('release-1.1.x')
  })
})

describe('Make Release', () => {
  beforeEach(async () => {
    await initGitRepo(dir)
  })

  afterEach(() => {
    cleanupGitRepo(dir)
  })

  it('should make release tag', async () => {
    /*
     *                  /-> v1.1.0-rc.2, [make release here] (release-1.1.x)
     * v1.0.0-rc.1 -> v1.1.0-rc.1 (main)
     */
    const git: SimpleGit = simpleGit(dir, SIMPLE_GIT_CONFIG)

    await git.commit('Initial commit', { '--allow-empty': null })
    await git.tag(['v1.0.0-rc.1'])

    await git.commit('Update to v1.1.0-rc.1', {
      '--allow-empty': null
    })
    await git.tag(['v1.1.0-rc.1'])

    await git.checkout(['-b', 'release-1.1.x'])
    await git.commit('Update to v1.1.0-rc.2', {
      '--allow-empty': null
    })
    await git.tag(['v1.1.0-rc.2'])

    await makeRelease(git, 'v1.1.0-rc.2', 'v1.1.0')

    const tags = await git.tags({ '--points-at': 'HEAD' })

    expect(tags.all.includes('v1.1.0')).toBe(true)
  })
})
