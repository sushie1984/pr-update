import * as core from '@actions/core'
import * as github from '@actions/github'

import {Octokit, Commit} from '../model/types'

export class PrDiffUtils {
  private octokit: Octokit

  constructor(octokit: Octokit) {
    this.octokit = octokit
  }

  async enhancedBody(prNumber: number, body?: string): Promise<string> {
    core.info(`Start retrieving links of PRs associated to PR: ${prNumber.toString()}`)
    let enhancedBody: string = body ?? ''
    const commitShas = await this.fetchCommitShas(prNumber)
    const titleLinkHash = await this.fetchTitleAndLinks(commitShas)

    for (const [title, link] of titleLinkHash) {
      enhancedBody += `\n\r- [${title}](${link})`
    }

    return enhancedBody
  }

  private async fetchCommitShas(prNumber: number): Promise<string[]> {
    core.debug(`Fetching all associated commits of: ${prNumber.toString()}`)

    const resp = await this.octokit.rest.pulls.listCommits({
      ...github.context.repo,
      pull_number: prNumber
    })

    return resp.data.map((entry: Commit) => entry.sha)
  }

  private async fetchTitleAndLinks(commitShas: string[]): Promise<Map<string, string>> {
    core.debug(
      `Fetching associated pull request's title and links of commit shas: ${commitShas.toString()}`
    )

    const titleWithLinks = new Map<string, string>()

    for (const commitSha of commitShas) {
      const resp = await this.octokit.rest.repos.listPullRequestsAssociatedWithCommit({
        ...github.context.repo,
        commit_sha: commitSha
      })

      for (const entry of resp.data) {
        titleWithLinks.set(entry.title, entry.html_url)
      }
    }

    return titleWithLinks
  }
}
