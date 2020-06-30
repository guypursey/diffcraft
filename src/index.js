const worddiff = require("diff").diffWordsWithSpace
const kleur = require("kleur")

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
      ? lastDiff.sourceLine === c.sourceLine
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

const createCombinedPatchString = (a, b, hunks) => hunks.reduce((p, c, i) => `${p}${
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

const processCrumbs = function (crumbs, diffFormatting, sideEffects, carriedState) {
  const { openingSource, closingSource, openingEdited, closingEdited, formatSource, formatEdited } = diffFormatting
  const { decidingInput, displayFn } = sideEffects
  let { diffNumber, stagedLine, stopAsking, autoAdding } = carriedState
  const deciderFn = (typeof decidingInput === "function")
    ? (async (message, char) => decidingInput(message, char))
    : (async (message, char) => decidingInput[char])
  const crumb = crumbs[0]
  diffNumber = diffNumber + (crumb.diff ? 1 : 0)
  if (crumb.diff && !stopAsking) {
    displayFn(`Word diff ${diffNumber}`)
    displayFn(`${crumb.source ? formatSource(`${openingSource}${crumb.source}${closingSource}`) : ""}${
      crumb.edited ? formatEdited(`${openingEdited}${crumb.edited}${closingEdited}`) : ""}`)
    decision = deciderFn("Stage diff? (y/n/a/q) ", diffNumber - 1)
  } else {
    decision = (async () => (!crumb.diff || autoAdding) ? "y" : "n")()
  }
  return decision.then(function (result) {
        let stage = (result === "y" || result === "a")
        if (crumb[stage ? "edited" : "source"].match(/^\n/)) stagedLine += 1
        crumb.stage = stage
        crumb.stagedLine = stagedLine
        if (crumb.diff && !stopAsking) {
          displayFn(`${crumb.stage ? "Marked for staging" : "Not marked for staging"} ${
              result === "a" ? "and marking all diffs hereafter" : "" }${
              result === "q" ? "and quitting interaction now" : ""
            }`)
        }
        stopAsking = stopAsking || (result === "a" || result === "q")
        autoAdding = autoAdding || (result === "a")
        let remainingCrumbs = crumbs.slice(1)
        let completedCrumbs = remainingCrumbs.length
          ? processCrumbs(remainingCrumbs, diffFormatting, { decidingInput, displayFn }, { diffNumber, stagedLine, stopAsking, autoAdding })
          : {
            "crumbs": [],
            "stopAsking": stopAsking,
            "autoAdding": autoAdding,
            "diffNumber": diffNumber,
            "stagedLine": stagedLine
          }
        return Promise.all([crumb, completedCrumbs])
          .then(([crumb, completedCrumbs]) => ({
            "crumbs": [].concat(crumb, completedCrumbs.crumbs),
            "stopAsking": stopAsking || completedCrumbs.stopAsking,
            "autoAdding": autoAdding || completedCrumbs.autoAdding,
            "diffNumber": completedCrumbs.diffNumber,
            "stagedLine": completedCrumbs.stagedLine
          }))
      })
  }


const processHunks = function (hunks, diffFormatting, sideEffects, helpers, carriedState = {}) {
  const hunk = hunks[0]
  const { formatSource, formatEdited } = diffFormatting
  const { displayFn } = sideEffects
  const { processCrumbs, packageHunk, createPatch } = helpers
  let {
    hunkNum = 0,
    hunkLength = hunks.length,
    diffNumber = 0,
    stagedLine = hunks[0].sourceStart,
    stopAsking,
    autoAdding
  } = carriedState
  if (!stopAsking) {
    displayFn(`Hunk ${hunkNum + 1}/${hunkLength}`)
    displayFn(hunk.hunkDisplay
      .replace(/(\[\-[\s\S]*?\-\])/g, `${formatSource("$1")}`)
      .replace(/(\{\+[\s\S]*?\+\})/g, `${formatEdited("$1")}`)
    )
  }
  hunk.hunkFrontContext.forEach((x, i) => {
    stagedLine += (!hunkNum && !i) ? 0 : 1
    x.stagedLine = stagedLine
  })
  return processCrumbs(hunk.hunkBody, diffFormatting, sideEffects, { diffNumber, stagedLine, stopAsking, autoAdding })
    .then(function (result) {
      ({ crumbs, stopAsking, autoAdding, diffNumber, stagedLine } = result);
      hunk.hunkTrailContext.forEach(x => {
        stagedLine += 1
        x.stagedLine = stagedLine
      })
      let newHunk = createPatch(packageHunk(hunk.hunkFrontContext, crumbs, hunk.hunkTrailContext))
      let remainingHunks = hunks.slice(1)
      stagedLine += remainingHunks.length ? remainingHunks[0].sourceStart - (hunk.sourceStart + hunk.sourceLength) : 0
      let stateToCarry = { "hunkNum": hunkNum + 1, hunkLength, diffNumber, stagedLine, stopAsking, autoAdding }
      let completedHunks = remainingHunks.length
        ? processHunks(remainingHunks, diffFormatting, sideEffects, helpers, stateToCarry)
        : {
          "hunks": [],
          "stopAsking": stopAsking,
          "autoAdding": autoAdding,
          "stagedLine": stagedLine,
          "diffNumber": diffNumber
        }
      return Promise.all([newHunk, completedHunks])
        .then(([newHunk, completedHunks]) => ({
          "hunks": [].concat(newHunk, completedHunks.hunks),
          "stopAsking": stopAsking || completedHunks.stopAsking,
          "autoAdding": autoAdding || completedHunks.autoAdding,
          "diffNumber": completedHunks.diffNumber,
          "stagedLine": completedHunks.stagedLine
        }))
    })
}

const producePatchDataFromTwoInputs = (a, b, userInput, userDisplay) =>
    processHunks(
        contextualiseHunks(
          nestGlutesIntoHunks(
            agglutinatePairs(
              pairUpDiffs(
                breakUpLines(
                  worddiff(a, b)
                )
              )
            )
          ), 1, packageHunk
        ).map(x => createPatchStringsFromPairedHunk(
          recreateWordDiffFromPairedHunk(x)
        )), {
          "openingSource": "[-",
          "closingSource": "-]",
          "openingEdited": "{+",
          "closingEdited": "+}",
          "formatSource": kleur.red,
          "formatEdited": kleur.green
        },
        {
          "displayFn": userDisplay,
          "decidingInput": userInput
        },
        {
          "processCrumbs": processCrumbs,
          "packageHunk": packageHunk,
          "createPatch": createPatchStringsFromPairedHunk
        })
  
const producePatchStringFromFilesContent = ([a, b], decider, displayer, outputter) =>
  producePatchDataFromTwoInputs(a.contents, b.contents, decider, displayer)
    .then(result => result.hunks.filter(hunk => hunk.hunkBody
      .reduce((p, c) => p || (c.diff && c.stage), false)))
    .then(hunks => createCombinedPatchString(a.filename, b.filename, hunks))
    .then(result => outputter(result))

const producePatchFromFileObjs = (files) =>
  files.map(x => producePatchString(x.filename, x.diffs))
    .join("\n")

module.exports = {
  producePatchDataFromTwoInputs: producePatchDataFromTwoInputs,
  producePatchStringFromFilesContent: producePatchStringFromFilesContent
}
