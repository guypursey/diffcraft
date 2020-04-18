const worddiff = require("diff").diffWordsWithSpace
const chalk = require("chalk")

const breakUpLines = (diffArray, splitAt = /\n/g) => {
  let sourceLine = 1
  let editedLine = 1
  return diffArray.reduce((p, c) => {
    // TODO: how to deal with "\r\n" or similar?
    // Need to retain value of split for adding back in...
    // Use lookahead (?=\n)
    // But tricky with double characters
    return p.concat(c.value.split(splitAt)
      .map((x, i) => {
        if (i && (c.removed || !c.added)) sourceLine += 1
        if (i && (c.added || !c.removed)) editedLine += 1
        return {
          value: `${i ? "\n" : ""}${x}`,
          removed: c.removed,
          added: c.added,
          sourceLine,
          editedLine
        }
      }))
  }, [])
}

const pairUpDiffs = diffArray => {
  const tidyStacks = (stacks) => {
    stacks.pairedArray.push({
      "source": stacks.sourceStack || "",
      "edited": stacks.editedStack || "",
      "sourceLine": stacks.sourceLine,
      "editedLine": stacks.editedLine,
      "diff": stacks.isDiff
    })
    return {
      "pairedArray": stacks.pairedArray,
      "sourceStack": null,
      "editedStack": null,
      "sourceLine": null,
      "editedLine": null,
      "isDiff": false
    }
  }
  return diffArray.reduce((p, c) => {
    if (c.removed) {
      if (!(p.sourceStack === null)) {
        p = tidyStacks(p)
      }
      p.sourceStack = c.value
      p.sourceLine = c.sourceLine
      p.editedLine = c.editedLine
      p.isDiff = true
    } else if (c.added) {
      if (!(p.editedStack === null)) {
        p = tidyStacks(p)
      }
      p.sourceStack = p.sourceStack || ""
      p.sourceLine = p.sourceLine || c.sourceLine
      p.editedStack = c.value
      p.editedLine = c.editedLine
      p.isDiff = true
      p = tidyStacks(p)
    } else {
      if (!(p.sourceStack === null)) {
        p = tidyStacks(p)
      }
      p.sourceStack = p.editedStack = c.value
      p.sourceLine = c.sourceLine
      p.editedLine = c.editedLine
      p = tidyStacks(p)
    }
    return p
  }, {
    "pairedArray": [],
    "sourceStack": null,
    "editedStack": null,
    "sourceLine": null,
    "editedLine": null,
    "isDiff": false
  }).pairedArray
}

const agglutinatePairs = (diffArray, agglutinator = /^ +$/) => {
  return diffArray.reduce((p, c) => {
    if (c.diff || c.source.match(agglutinator)) {
      if (p.diffStack.diff && (p.diffStack.sourceLine !== c.sourceLine ||
        p.diffStack.editedLine !== c.editedLine)) {
          p.agglutinatedPairs.push(p.diffStack)
          p.diffStack = {}
        }
      p.diffStack.source = `${p.diffStack.source || ""}${c.source}`
      p.diffStack.edited = `${p.diffStack.edited || ""}${c.edited}`
      p.diffStack.sourceLine = c.sourceLine
      p.diffStack.editedLine = c.editedLine
      p.diffStack.diff = true
    } else {
      if (p.diffStack.diff) {
        p.agglutinatedPairs.push(p.diffStack)
        p.diffStack = {}
      }
      p.agglutinatedPairs.push(c)
    }
    return p
  }, {
    "agglutinatedPairs": [],
    "diffStack": {}
  }).agglutinatedPairs
}

const nestGlutesIntoHunks = flatArray => flatArray.reduce((p, c, i, a) => {
    let lastDiff = i ? a[i - 1] : null
    let overLap = lastDiff
      ? lastDiff.sourceLine=== c.sourceLine
        || lastDiff.editedLine === c.editedLine
      : false
    let currentNest = overLap
      ? p.slice(-1)[0].concat(c)
      : [c]
    return (overLap ? p.slice(0, -1) : p).concat([currentNest])
  }, [])

const packageHunk = (front, body, trail) => {
  let firstDiff = front[0] || body[0]
  let finalDiff = trail.length ? trail.slice(-1)[0] : body.slice(-1)[0]
  let sourceStart = firstDiff.sourceLine
  let sourceLength = finalDiff.sourceLine - sourceStart + 1
  let editedStart = firstDiff.stagedLine || firstDiff.editedLine
  let editedLength = (finalDiff.stagedLine || finalDiff.editedLine) - editedStart + 1
  return {
    "hunkFrontContext": front,
    "hunkBody": body,
    "hunkTrailContext": trail,
    "sourceStart": sourceStart,
    "sourceLength": sourceLength,
    "editedStart": editedStart,
    "editedLength": editedLength,
    "hunkHeader": `@@ -${sourceStart}${sourceLength > 1 ? `,${sourceLength}` : ""
      } +${editedStart}${editedLength > 1 ? `,${editedLength}` : ""} @@`
  }
}
  
const contextualiseHunks = (nestedArray, context, wrap) => {
  let currentFront = []
  let currentTrail = []
  let currentHunk = []
  let hunkArray = nestedArray.reduce((p, c) => {
    if (c.length > 1 || c.added || c.removed) {
      if (currentTrail.length) {
        currentHunk.push(...currentTrail)
        currentTrail = []
      }
      currentHunk.push(...c)
    } else if (currentHunk.length) {
      if (currentTrail.length >= context) {
        p = p.concat(wrap(currentFront, currentHunk, currentTrail))
        currentFront = []
        currentTrail = []
        currentHunk = []
        currentFront.push(...c)
      } else {
        currentTrail.push(...c)
      }
    } else {
      currentFront.push(...c)
      if (currentFront.length > context) {
        currentFront.shift()
      }
    }
    return p
  }, [])
  if (currentHunk.length) {
    hunkArray = hunkArray.concat(wrap(currentFront, currentHunk, currentTrail))
  }
  return hunkArray
}

const recreateWordDiffFromPairedHunk = hunk => Object.assign({}, hunk, {
    "hunkDisplay": hunk.hunkBody.reduce((p, c, i) => {
      return c.diff ?
        `${p}${
          c.source ? `[-${c.source}-]` : ""
        }${
          c.edited ? `{+${c.edited}+}` : ""
        }` :
        `${p}${c.source}`
    }, `${hunk.hunkHeader}`)
  })

const createPatchStringsFromPairedHunk = hunk => {
    let { hunkHeader, hunkFrontContext, hunkBody, hunkTrailContext } = hunk
    let frontContext = hunkFrontContext
      .reduce((p, c) => `${p}${c.source.replace(/^\n/, `\n `)}`, "")
    let trailContext = hunkTrailContext
      .reduce((p, c) => `${p}${c.source.replace(/^\n/, `\n `)}`, "")
    let sourceHunk = hunkBody
      .reduce((p, c, j) => `${p}${
        c.sourceLine < 2 && !j ? "\n-" : ""
      }${
        c.source.replace(/^\n/, `\n-`)
      }`, "")
    let editedHunk = hunkBody
      .reduce((p, c, j) => `${p}${
        c[`${c.stage ? "edited" : "source"}Line`] < 2 && !j ? "\n+" : ""
      }${
        c[`${c.stage ? "edited" : "source"}`].replace(/^\n/, `\n+`)
      }`, "")
    return Object.assign({}, hunk,
      {
        "hunkPatch": `${hunkHeader}${frontContext}${sourceHunk}${editedHunk}${trailContext}`
      })
  }

const createWordDiffString = h => h.reduce((p, c, i) => `${p}\n${c.hunkDisplay}`, ``)

const createCombinedPatchString = (a, b, hunks) => {
  return hunks.reduce((p, c, i) => `${p}${
      c.hunkPatch
    }\n`, `diff --git a/${
      a
    } b/${
      b
    }\n\n--- a/${
      a
    }\n+++ b/${
      b
    }\n`)
}

const getUserInput = function (displayInfo) {
  return prompt(displayInfo)
}

const displayDiff = function (hunks, diffWrappers, diffFormat, displayFn, deciderFn, hunkWrap, createPatch) {
  const [ openingSource, closingSource, openingEdited, closingEdited ] = diffWrappers
  const [ formatSource, formatEdited ] = diffFormat
  let stopAsking = false
  let autoAnswer = false
  let stagedLine = 1
  let diffNumber = 0
  let chunks = hunks.map(function (hunk, hunkNum) {
    if (!stopAsking) {
      displayFn(`Hunk ${hunkNum + 1}/${hunks.length}`)
      displayFn(hunk.hunkDisplay
        .replace(/(\[\-[\s\S]*?\-\])/g, `${formatSource("$1")}`)
        .replace(/(\{\+[\s\S]*?\+\})/g, `${formatEdited("$1")}`)
      )
    }
    if (hunkNum) {
      stagedLine += hunk.sourceStart - (
          hunks[hunkNum - 1].sourceStart +
          hunks[hunkNum - 1].sourceLength
        )
    }
    // overly stateful
    hunk.hunkFrontContext.forEach(x => {
      stagedLine += 1
      x.stagedLine = stagedLine
    })
    hunk.hunkBody
      .map(function (crumb, i) {
        let decision = (!crumb.diff || autoAnswer) ? "y" : "n"
        if (crumb.diff && !stopAsking) {
          diffNumber = diffNumber + 1
          displayFn(`Word diff ${diffNumber}`)
          displayFn(`${crumb.source ? formatSource(`${openingSource}${crumb.source}${closingSource}`) : ""}${
            crumb.edited ? formatEdited(`${openingEdited}${crumb.edited}${closingEdited}`) : ""}`)
          decision = deciderFn("Stage diff? (y/n/a/q) ")
          stopAsking = (decision === "a" || decision === "q")
          autoAnswer = (decision === "a")
        }
        let stage = (decision === "y" || decision === "a")
        if (crumb[stage ? "edited" : "source"].match(/^\n/)) stagedLine += 1
        // overly reliant on stateful changes...
        crumb.stage = stage
        crumb.stagedLine = stagedLine
        if (crumb.diff && !stopAsking) {
          displayFn(crumb.stage ? "Staged" : "Not staged" )
        }
        // is this even needed: should it just be forEach instead of map?
        return crumb
      })
    // overly stateful
    hunk.hunkTrailContext.forEach(x => {
      stagedLine += 1
      x.stagedLine = stagedLine
    })
    let packagedHunk = packageHunk(
      hunk.hunkFrontContext,
      hunk.hunkBody,
      hunk.hunkTrailContext
    )
    return createPatch(packagedHunk)
  })
  return chunks
}

const producePatchString = (a, b, diffs, input, output) =>
  createCombinedPatchString(a, b,
    displayDiff(
      contextualiseHunks(
        nestGlutesIntoHunks(
          agglutinatePairs(
            pairUpDiffs(
              breakUpLines(
                diffs
              )
            )
          )
        ), 1, packageHunk
      ).map(x => createPatchStringsFromPairedHunk(
        recreateWordDiffFromPairedHunk(x)
      )), [
        "[-", "-]", "{+", "+}"
      ], [
        chalk.red, chalk.green
      ],
      output,
      input,
      packageHunk,
      createPatchStringsFromPairedHunk)
  )
  
const producePatchStringFromFilesContent = ([a, b], input, output) =>
  producePatchString(a.filename, b.filename, worddiff(a.contents, b.contents), input, output)
  

const producePatchFromFileObjs = (files) =>
  files.map(x => producePatchString(x.filename, x.diffs))
    .join("\n")

module.exports = {
  breakUpLines: breakUpLines,
  pairUpDiffs: pairUpDiffs,
  agglutinatePairs: agglutinatePairs,
  nestGlutesIntoHunks: nestGlutesIntoHunks,
  packageHunk: packageHunk,
  contextualiseHunks: contextualiseHunks,
  recreateWordDiffFromPairedHunk: recreateWordDiffFromPairedHunk,
  createPatchStringsFromPairedHunk: createPatchStringsFromPairedHunk,
  createWordDiffString: createCombinedPatchString,
  getUserInput: getUserInput,
  displayDiff: displayDiff,
  producePatchString: producePatchString,
  producePatchStringFromFilesContent: producePatchStringFromFilesContent,
  producePatchFromFileObjs: producePatchFromFileObjs
}
