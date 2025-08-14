import('process')
import { SimpleGit } from 'simple-git'
import { SemanticVersion } from './semantic-version.ts'

/**
 * Get all tags reachable from a given branch. Tags are sorted by the semantic versioning spec.
 *
 * @param {SimpleGit} git - An instance of SimpleGit to interact with the Git repository.
 * @param {string} ref - The ref to get tags from.
 *
 * @return {Promise<string[]>} - A promise that resolves to an array of tag names.
 */
export async function getTags(git: SimpleGit, ref: string): Promise<string[]> {
  return (await git.tags({ '--merged': ref, '--sort': 'v:refname' })).all
}

/**
 * Get the latest semantic versioned tag reachable from a given branch. The latest tag is the one with the highest semantic version.
 *
 * @param {SimpleGit} git - An instance of SimpleGit to interact with the Git repository.
 * @param {string} ref - The ref to get the latest tag from.
 *
 * @return {Promise<string>} - A promise that resolves to the latest tag name, or an empty string if no tags are found.
 */
export async function getLatestTag(git: SimpleGit, ref: string): Promise<string> {
  const tags = (await git.tags({ '--merged': ref, '--sort': 'v:refname' })).all

  return tags.length > 0 ? tags[tags.length - 1] : ''
}

/**
 * Get the latest stable (non-prerelease) semantic versioned tag reachable from a given branch. The latest tag is the one with the highest semantic version.
 *
 * @param {SimpleGit} git - An instance of SimpleGit to interact with the Git repository.
 *
 * @return {Promise<string>} - A promise that resolves to the latest stable tag name, or an empty string if no stable tags are found.
 */
export async function getLatestStableTag(git: SimpleGit): Promise<string> {
  const tags = (await git.tags({ '--sort': 'v:refname' })).all.filter((tag: string) => {
    try {
      return !new SemanticVersion(tag).isPrerelease()
    } catch {
      return false
    }
  })

  return tags.length > 0 ? tags[tags.length - 1] : ''
}

/**
 * Get all tags at HEAD.
 *
 * @param {SimpleGit} git - An instance of SimpleGit to interact with the Git repository.
 *
 * @return {Promise<string[]>} - A promise that resolves to an array of tag names at HEAD.
 * */
export async function getTagsAtHEAD(git: SimpleGit): Promise<string[]> {
  const tags = await git.tags({ '--points-at': 'HEAD' })

  return tags.all
}

/**
 * Get the current branch name.
 *
 * @param {SimpleGit} git - An instance of SimpleGit to interact with the Git repository.
 *
 * @return {Promise<string>} - A promise that resolves to the name of the current branch.
 */
export async function getCurrentBranch(git: SimpleGit): Promise<string> {
  const branch = await git.branch()

  return branch.current
}

/**
 * Get commits mesaages between two references.
 *
 * @param {SimpleGit} git - An instance of SimpleGit to interact with the Git repository.
 * @param {string} from - The starting reference (e.g., a tag or commit hash).
 * @param {string} to - The ending reference (e.g., a tag or commit hash).
 *
 * @return {Promise<string[]>} - A promise that resolves to an array of commit messages.
 */
export async function getCommitMessages(git: SimpleGit, from: string, to: string): Promise<string[]> {
  const messages = (
    await git.log({
      from: from,
      to: to,
      multiLine: true
    })
  ).all

  return messages.map((commit) => commit.body.trimEnd()) // Trim trailing whitespace because the body always somehow ends with a \n
}
/**
 * Create a new release branch from a given reference and tag it.
 *
 * @param {SimpleGit} git - An instance of SimpleGit to interact with the Git repository.
 * @param {string} ref - The reference (e.g., commit hash or branch name) to create the release branch from.
 * @param {string} releaseBranchName - The name of the new release branch to create.
 * @param {string} tag - The tag to apply to the new release branch.
 *
 * @return {Promise<void>} - A promise that resolves when the branch is created and tagged.
 */
export async function cutReleaseBranch(git: SimpleGit, ref: string = 'HEAD', releaseBranchName: string, tag: string): Promise<void> {
  const branches = (await git.branch()).all

  if (branches.includes(releaseBranchName)) {
    throw new Error(`Branch ${releaseBranchName} already exists.`)
  }

  await git.checkoutBranch(releaseBranchName, ref)
  await git.tag([tag])
}

/**
 * Make a release by checking out an existing release branch and tagging it.
 *
 * @param {SimpleGit} git - An instance of SimpleGit to interact with the Git repository.
 * @param {string} targetTag - The tag of the release branch to check out.
 * @param {string} releaseTag - The tag to apply to the release branch.
 *
 * @return {Promise<void>} - A promise that resolves when the branch is checked out and tagged.
 */
export async function makeRelease(git: SimpleGit, targetTag: string, releaseTag: string): Promise<void> {
  await git.checkout(targetTag)
  await git.tag([releaseTag])
}

export async function gitSync(git: SimpleGit): Promise<void> {
  const repo: string = process.env.GITHUB_SERVER_URL.replace(/^https?\:\/\//i, '') + '/' + process.env.GITHUB_REPOSITORY
  const remote: string = `https://x-access-token:${process.env.GH_TOKEN}@${repo}`

  await git.push([remote, '--all'])
  await git.pushTags(remote)
}
