import * as core from '@actions/core'
import { SimpleGit, simpleGit } from 'simple-git'

import {
  getLatestTag,
  getLatestStableTag,
  getTagsAtHEAD,
  getCurrentBranch,
  getCommitMessages,
  cutReleaseBranch,
  makeRelease,
  gitSync
} from './git.ts'
import { SemanticVersion, releaseTypeFromCommitMessages } from './semantic-version.ts'
import { generateReleaseBranchName, isReleaseBranch } from './utils.ts'
import { RELEASE_TYPES, SIMPLE_GIT_CONFIG } from './constants.ts'

export async function run(gitObj: SimpleGit | undefined = undefined): Promise<void> {
  const action: string = core.getInput('action')
  const trunkBranchName: string = core.getInput('trunk-branch-name')
  const releaseBranchRegex: RegExp = new RegExp(core.getInput('release-branch-pattern'))
  const releaseBranchStringTemplate: string = core.getInput('release-branch-template')
  const dryRun: boolean = Boolean(core.getInput('dry-run'))

  // Validate supported action input
  if (!['release', 'release-cut'].includes(action)) {
    throw new Error(`Not supported action: ${action}`)
  }

  let git: SimpleGit

  if (gitObj) {
    git = gitObj
  } else {
    git = await simpleGit(SIMPLE_GIT_CONFIG)
  }

  const currentBranch: string = await getCurrentBranch(git)

  // Outputs
  let nextVersion: string
  let previousVersion: string
  let previousStableVersion: string

  // Do 'release' action
  if (action === 'release') {
    // Validate that the current branch is a release branch
    if (!isReleaseBranch(currentBranch, releaseBranchRegex)) {
      throw new Error(`Current branch '${currentBranch}' is not a release branch. Releases can only be made from a release branch.`)
    }

    const tagsAtHEAD: string[] = await getTagsAtHEAD(git)

    // Validate that there is at least one tag at HEAD of the release branch
    if (tagsAtHEAD.length === 0) {
      throw new Error(
        `No tags found at HEAD of release branch. Cannot make a release without a tag at HEAD. There might be commit(s) on the release branch that have not made it to 'rc'. Try running 'release-cut' action first.`
      )
    }

    const numReleaseCandidatesAtHEAD: number = tagsAtHEAD
      .map((tag: string) => {
        try {
          return new SemanticVersion(tag).isPrerelease()
        } catch {
          return false
        }
      })
      .filter(Boolean).length

    // Validate that there is exactly one release candidate tag at HEAD of the release branch
    if (numReleaseCandidatesAtHEAD === 0) {
      throw new Error(`No release candidate tags found at HEAD of release branch. Cannot make a release without a release candidate tag.`)
    } else if (numReleaseCandidatesAtHEAD > 1) {
      throw new Error(
        `Multiple release candidate tags found at HEAD of release branch: ${tagsAtHEAD.join(', ')}. There should be only one release candidate tag at HEAD of a release branch.`
      )
    }

    const numReleasesAtHEAD: number = tagsAtHEAD
      .map((tag: string) => {
        try {
          return !new SemanticVersion(tag).isPrerelease()
        } catch {
          return false
        }
      })
      .filter(Boolean).length

    // Validate that there are no existing release tags at HEAD of the release branch
    if (numReleasesAtHEAD > 0) {
      throw new Error(`Release tag(s) found at HEAD of release branch: ${tagsAtHEAD.join(', ')}. A release has already been made from this commit.`)
    }

    const targetTag: string[] = tagsAtHEAD.filter((tag: string) => {
      try {
        return new SemanticVersion(tag).isPrerelease()
      } catch {
        return false
      }
    })

    const version: SemanticVersion = new SemanticVersion(targetTag[0])
    previousVersion = version.toString()
    previousStableVersion = await getLatestStableTag(git, currentBranch)

    version.makeRelease()

    await makeRelease(git, targetTag[0], version.toString())

    nextVersion = version.toString()
  }

  // Do 'release-cut' action
  else if (action === 'release-cut') {
    // Validate that the current branch is the trunk branch or a release branch.
    // If NOT a trunk branch and NOT a release branch, throw an error.
    if (currentBranch !== trunkBranchName && !isReleaseBranch(currentBranch, releaseBranchRegex)) {
      console.log(currentBranch !== trunkBranchName)
      throw new Error(
        `Current branch '${currentBranch}' is not the trunk branch '${trunkBranchName}' or a release branch. Release cuts can only be made from the trunk branch or a release branch.`
      )
    }

    const latestTag: string = await getLatestTag(git, trunkBranchName)
    let version: SemanticVersion
    let commitMessages: string[]

    if (latestTag) {
      version = new SemanticVersion(latestTag)
      commitMessages = await getCommitMessages(git, latestTag, 'HEAD')
      previousVersion = version.toString()

      // Validate that there are commit messages since the latest tag
      if (commitMessages.length === 0) {
        throw new Error(`No commits found since latest tag ${latestTag}. Cannot determine next version bump.`)
      }
    } else {
      // If no tags exist, start from v0.0.0
      version = new SemanticVersion('0.0.0')
      commitMessages = await getCommitMessages(git, await git.firstCommit(), 'HEAD')
      previousVersion = ''

      // Validate that there are commit messages in the repository
      if (commitMessages.length === 0) {
        throw new Error('No commits found in the repository. Cannot determine next version bump.')
      }
    }

    previousStableVersion = await getLatestStableTag(git, currentBranch)

    // Determine the release type based on commit messages
    const releaseType: RELEASE_TYPES = releaseTypeFromCommitMessages(commitMessages)

    if (releaseType === RELEASE_TYPES.NONE) {
      throw new Error(
        `No valid changes found found since latest tag ${latestTag} that warrants a version bump. Changes must warrant at least a patch.`
      )
    } else if (releaseType === RELEASE_TYPES.PATCH) {
      // Validate that the current branch is not the trunk branch for patch releases
      if (currentBranch === trunkBranchName) {
        throw new Error(`Cannot make a patch release from the trunk branch '${trunkBranchName}'. Use a release branch for patch releases.`)
      }

      version.bumpPatch()
      await git.tag([version.toString()])
    } else if (releaseType === RELEASE_TYPES.MINOR) {
      // Validate that the current branch is the trunk branch for minor releases
      if (currentBranch !== trunkBranchName) {
        throw new Error(`Minor releases can only be made from the trunk branch '${trunkBranchName}'. Use the trunk branch for minor releases.`)
      }

      version.bumpMinor()
      const branchCutName = generateReleaseBranchName(releaseBranchStringTemplate, version)

      await cutReleaseBranch(git, trunkBranchName, branchCutName, version.toString())
    } else if (releaseType === RELEASE_TYPES.MAJOR) {
      // Validate that the current branch is the trunk branch for major releases
      if (currentBranch !== trunkBranchName) {
        throw new Error(`Major releases can only be made from the trunk branch '${trunkBranchName}'. Use the trunk branch for major releases.`)
      }

      version.bumpMajor()
      const branchCutName = generateReleaseBranchName(releaseBranchStringTemplate, version)

      await cutReleaseBranch(git, trunkBranchName, branchCutName, version.toString())
    }

    nextVersion = version.toString()
  }

  if (!dryRun) {
    await gitSync(git)
  }

  core.setOutput('next-version', nextVersion)
  core.setOutput('previous-version', previousVersion)
  core.setOutput('previous-stable-version', previousStableVersion)
}
