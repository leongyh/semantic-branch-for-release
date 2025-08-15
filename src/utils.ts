import * as core from '@actions/core'

import { RELEASE_TYPES, CONVENTIONAL_COMMIT_REGEX } from './constants.ts'
import { SemanticVersion } from './semantic-version.ts'

/**
 * Parses semantic release type from a valid conventional commit message to a semantic version release type.
 *
 * @param message - The commit message to parse.
 *
 * @return {string | Error} - Returns the release type as a string (major, minor, patch, or none) or throws an error if the message is invalid.
 */
export function parseReleaseTypeFromCommitMessage(message: string): string | Error {
  const m: RegExpMatchArray | null = message.match(CONVENTIONAL_COMMIT_REGEX)
  let releaseType: string = RELEASE_TYPES.NONE

  if (!m) {
    core.warning(`Detected commit message that does not conform to Conventional Commits: ${message}`)
    return RELEASE_TYPES.NONE
  }

  // Parse capture group 1: Type
  if (m[1] === 'feat') {
    releaseType = RELEASE_TYPES.MINOR
  } else if (m[1] === 'fix') {
    releaseType = RELEASE_TYPES.PATCH
  }

  // Parse capture group 3: Bang!
  if (m[3]) {
    releaseType = RELEASE_TYPES.MAJOR
  }

  // Parse capture group 4: Body containing \nBREAKING CHANGE:
  if (m[4]) {
    const footer = m[4]

    if (footer.includes('\nBREAKING CHANGE: ')) {
      return RELEASE_TYPES.MAJOR
    }
  }

  return releaseType
}

/**
 * Checks if the given branch name matches the release branch regex.
 *
 * @param branchName - The name of the branch to check.
 * @param releaseBranchRegex - The regex to match against the branch name.
 *
 * @return {boolean} - Returns true if the branch name matches the regex, otherwise false.
 */
export function isReleaseBranch(branchName: string, releaseBranchRegex: RegExp): boolean {
  const match = branchName.match(releaseBranchRegex)

  if (!match) {
    return false
  }

  return true
}

export function generateReleaseBranchName(template: string, version: SemanticVersion): string {
  return template
    .replace('${major}', version.major.toString())
    .replace('${minor}', version.minor.toString())
    .replace('${patch}', version.patch.toString())
    .replace('${prerelease}', version.prerelease || '')
}
