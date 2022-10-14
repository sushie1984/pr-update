import * as core from '@actions/core'
import * as github from '@actions/github'

import {Input} from './model/input'
import {PrUtils} from './util/prUtils'
import {PrDiffUtils} from './util/prDiffUtils'
import * as git from './util/gitUtils'

async function run(): Promise<void> {
  try {
    const input = new Input()
    const octokit = github.getOctokit(input.token)
    const pr = new PrUtils(octokit)
    const prDiff = new PrDiffUtils(octokit)
    const tgtBranch = await git.getTargetBranch(input.prTarget, octokit)

    core.startGroup('Checks')
    core.info('🔍 Checking if branches exists')
    const srcBranchExists = await git.branchExists(input.prSource)
    if (!srcBranchExists) {
      core.setFailed(`💥 Source branch '${input.prSource}' does not exist!`)
    }
    const tgtBranchExists = await git.branchExists(tgtBranch)
    if (!tgtBranchExists) {
      core.setFailed(`💥 Target branch '${tgtBranch}' does not exist!`)
    }

    core.info('🔍 Checking if there is a open PR for the source to target branch')
    const pullRequestNr = await pr.getPrNumber(tgtBranch, input.prSource)
    core.endGroup()

    core.startGroup('PR')
    if (pullRequestNr) {
      core.info('♻️ Update existing PR')
      const body =
        input.prBodyAppendPrDiffs == true
          ? await prDiff.enhancedBody(pullRequestNr, input.prBody)
          : input.prBody
      const pull = await pr.updatePr(
        pullRequestNr,
        input.prTitle,
        body,
        input.prLabels,
        input.prAssignees
      )
      core.info(`🎉 Pull Request updated: ${pull.html_url} (#${pull.number})`)
      core.setOutput('pr_nr', pull.number)
    } else {
      core.info('➕ Creating new PR')
      const pull = await pr.createPr(
        tgtBranch,
        input.prSource,
        input.prTitle,
        input.prBody,
        input.prLabels,
        input.prAssignees
      )
      const prNumber = pull.number
      core.info(`🎉 Pull Request created: ${pull.html_url} (#${prNumber})`)
      if (input.prBodyAppendPrDiffs == true) {
        const body = await prDiff.enhancedBody(prNumber, input.prBody)
        await pr.updatePr(prNumber, input.prTitle, body, input.prLabels, input.prAssignees)
        core.info(`🎉 Pull Request updated: ${pull.html_url} (#${prNumber})`)
      }

      core.setOutput('pr_nr', prNumber)
    }
    core.endGroup()
  } catch (error) {
    if (error instanceof Error) core.setFailed(`💥 ${error.message}`)
  }
}

run()
