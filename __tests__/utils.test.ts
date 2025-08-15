import { describe, it, expect } from '@jest/globals'
import { parseReleaseTypeFromCommitMessage, isReleaseBranch, generateReleaseBranchName } from '../src/utils'
import { SemanticVersion } from '../src/semantic-version'

describe('Parse Release Type From Valid Commit Message', () => {
  it('should return MAJOR for BREAKING CHANGE footer', () => {
    const message = 'feat(core): add new feature\n\nBREAKING CHANGE: major update'
    expect(parseReleaseTypeFromCommitMessage(message)).toBe('major')
  })

  it('should return MAJOR for a type with a bang!', () => {
    const message = 'feat(core)!: add new feature'
    expect(parseReleaseTypeFromCommitMessage(message)).toBe('major')
  })

  it('should return MINOR for a type feat', () => {
    const message = 'feat(core): add new feature'
    expect(parseReleaseTypeFromCommitMessage(message)).toBe('minor')
  })

  it('should return PATCH for type fix', () => {
    const message = 'fix(core): resolve issue'
    expect(parseReleaseTypeFromCommitMessage(message)).toBe('patch')
  })

  it('should return NONE for type chore', () => {
    const message = 'chore(deps): update dependencies'
    expect(parseReleaseTypeFromCommitMessage(message)).toBe('none')
  })
})

describe('Parse Release Type From Invalid Commit Message', () => {
  it('should throw an error for invalid format', () => {
    const message = 'invalid commit message format'
    expect(parseReleaseTypeFromCommitMessage(message)).toBe('none')
  })

  it('should throw an error for empty message', () => {
    const message = ''
    expect(parseReleaseTypeFromCommitMessage(message)).toBe('none')
  })

  it('should throw an error for missing type', () => {
    const message = ': add new feature'
    expect(parseReleaseTypeFromCommitMessage(message)).toBe('none')
  })
})

describe('Is Release Branch', () => {
  const regex: RegExp = /^release-(0|[1-9]\d*)\.(0|[1-9]\d*)\.x$/

  it('should return true for valid release branch', () => {
    const branchName = 'release-1.0.x'
    expect(isReleaseBranch(branchName, regex)).toBe(true)
  })

  it('should return false for non-release branch', () => {
    const branchName = 'feature/new-feature'
    expect(isReleaseBranch(branchName, regex)).toBe(false)
  })
})

describe('Generate Release Branch Name', () => {
  it('should generate correct release branch name', () => {
    const template = 'release-${major}.${minor}.x'
    const version = new SemanticVersion('1.0.0-rc.1')

    expect(generateReleaseBranchName(template, version)).toBe('release-1.0.x')
  })

  test('all variables should be replaced', () => {
    const template = 'release-${major}.${minor}.${patch}-${prerelease}'
    const version = new SemanticVersion('2.3.4-rc.5')

    expect(generateReleaseBranchName(template, version)).toBe('release-2.3.4-rc.5')
  })
})
