import { parseReleaseTypeFromCommitMessage } from './utils'
import { RELEASE_TYPES, SEMANTIC_VERSION_REGEX } from './constants'

export class SemanticVersion {
  major: number
  minor: number
  patch: number
  prerelease?: string

  constructor(version: string) {
    const match = version.match(SEMANTIC_VERSION_REGEX)
    if (!match) {
      throw new Error(`Invalid semantic version format: ${version}`)
    }

    this.major = parseInt(match[1])
    this.minor = parseInt(match[2])
    this.patch = parseInt(match[3])

    if (match[4]) {
      this.prerelease = match[4]
    }
  }

  bumpMajor(): void {
    this.major += 1
    this.minor = 0
    this.patch = 0
    this.prerelease = 'rc.1'
  }

  bumpMinor(): void {
    this.minor += 1
    this.patch = 0
    this.prerelease = 'rc.1'
  }

  bumpPatch(): void {
    if (!this.prerelease) {
      this.patch += 1
      this.prerelease = 'rc.1'
    } else {
      const parts = this.prerelease.split('.')
      const lastPart = parts[parts.length - 1]
      const rcNumber = parseInt(lastPart)

      if (!isNaN(rcNumber)) {
        parts[parts.length - 1] = (rcNumber + 1).toString()
        this.prerelease = parts.join('.')
      } else {
        this.prerelease = `${this.prerelease}.1`
      }
    }
  }

  makeRelease(): void {
    // Reset prerelease to undefined for a final release
    this.prerelease = undefined
  }

  isPrerelease(): boolean {
    return this.prerelease !== undefined
  }

  toString(): string {
    return `v${this.major}.${this.minor}.${this.patch}${this.prerelease !== undefined ? '-' + this.prerelease : ''}`
  }
}

export function releaseTypeFromCommitMessages(commitMessages: string[]): RELEASE_TYPES {
  let bumpType = RELEASE_TYPES.NONE

  for (const message of commitMessages) {
    const releaseType = parseReleaseTypeFromCommitMessage(message)

    if (releaseType === RELEASE_TYPES.MAJOR) {
      bumpType = RELEASE_TYPES.MAJOR
      break // Major release takes precedence
    } else if (releaseType === RELEASE_TYPES.MINOR && bumpType !== RELEASE_TYPES.MAJOR) {
      bumpType = RELEASE_TYPES.MINOR
    } else if (
      releaseType === RELEASE_TYPES.PATCH &&
      bumpType !== RELEASE_TYPES.MAJOR &&
      bumpType !== RELEASE_TYPES.MINOR
    ) {
      bumpType = RELEASE_TYPES.PATCH
    }
  }

  return bumpType
}

export function versionReleaseCut(latestVersion: string, commitMessages: string[]): string {
  const bumpType = releaseTypeFromCommitMessages(commitMessages)
  const semanticVersion: SemanticVersion = new SemanticVersion(latestVersion)

  if (bumpType === RELEASE_TYPES.MAJOR) {
    semanticVersion.bumpMajor()
  } else if (bumpType === RELEASE_TYPES.MINOR) {
    semanticVersion.bumpMinor()
  } else if (bumpType === RELEASE_TYPES.PATCH) {
    semanticVersion.bumpPatch()
  }

  return semanticVersion.toString()
}

export function versionRelease(latestVersion: string): string {
  const semanticVersion: SemanticVersion = new SemanticVersion(latestVersion)
  semanticVersion.makeRelease()

  return semanticVersion.toString()
}
