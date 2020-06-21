const chai = require("chai").use(require("chai-things")).should();
const diffcraft = require("../src/index.js");

describe("Checking patch data produced", function () {

  let producePatchDataFromTwoInputs = diffcraft.producePatchDataFromTwoInputs
  let stubUserInput = ((input = "") => {
    let memoInput = input.split("")
    return ((message) => memoInput.shift() || "q")
  })
  let silentDisplay = x => null

  describe("for A and B versions of a single line of content", function () {

    let a = "He worked sixteen hours daily for ten or twelve days at a stretch and then for two hole days was not be be found by anyone. He spent that time in his mother's flat, sleeping and eating steaks and ice-cream, taking the old lady to the movies or spading at his master's thesis which was on the philosophy of non-violence. Once in a while he slipped away to a lecture. He was studying law. too. Grammick wasn't going to be sucked away from all private existence, though at his job that ten day stretch he didn't appear to have any ulterior design of heading for any shore of his own.";
    let b = "He would work sixteen hours daily for ten or twelve days at a stretch and then for two whole days he couldn't be found by anyone. He spent that time in his mother's flat, sleeping and eating steaks and ice-cream, taking the old lady to the movies or reading. Once in a while he slipped away to a lecture. He was studying law, too. Grammick wasn't going to be sucked away from all private existence.";

    describe("with all negative inputs", function () {
      let result
      before(async function () {
        result = await producePatchDataFromTwoInputs(a, b, stubUserInput("nnnnnnn"), silentDisplay)
      })
      describe("using individual negative values via interaction", function () {
        it("should return all diffs marked as not for staging", function () {
          result.hunks[0].hunkBody.filter(x => x.diff)
            .should.all.have.property("stage", false)
        })
      })
      describe("using quit value via interaction", function () {
        it("should return the same result as if individual negative values had been used", async function (){
          let result2 = await producePatchDataFromTwoInputs(a, b, stubUserInput("q"), silentDisplay)
          result2.hunks.should.deep.equal(result.hunks)
        })
      })
      describe("using negative values via predetermined input", function () {
        it("should return the same result as if interactive negative values had been used", async function (){
          let result2 = await producePatchDataFromTwoInputs(a, b, "nnnnnnn", silentDisplay)
          result2.hunks.should.deep.equal(result.hunks)
        })
      })
      describe("using quit value via predetermined input", function () {
        it("should return the same result as if interactive negative values had been used", async function (){
          let result2 = await producePatchDataFromTwoInputs(a, b, "q", silentDisplay)
          result2.hunks.should.deep.equal(result.hunks)
        })
      })
    })

    describe("with all positive inputs", async function () {
      let result
      before(async function () {
        result = await producePatchDataFromTwoInputs(a, b, stubUserInput("yyyyyyy"), silentDisplay)
      })
      describe("using individual positive values via interaction", function () {
        it("should return all diffs as marked for staging", function () {
          result.hunks[0].hunkBody.filter(x => x.diff)
            .should.all.have.property("stage", true)
        })
      })
      describe("using single staging value via interaction", function () {
        it("should return the same result as if individual positive values had been used", async function () {
          let result2 = await producePatchDataFromTwoInputs(a, b, stubUserInput("a"), silentDisplay)
          result2.hunks.should.deep.equal(result.hunks)
        })
      })
      describe("using positive values via predetermined input", function () {
        it("should return the same result as if individual positive values had been used", async function () {
          let result2 = await producePatchDataFromTwoInputs(a, b, "yyyyyyy", silentDisplay)
          result2.hunks.should.deep.equal(result.hunks)
        })
      })
      describe("using single staging value via predetermined input", function () {
        it("should return the same result as if interactive positive values had been used", async function () {
          let result2 = await producePatchDataFromTwoInputs(a, b, "a", silentDisplay)
          result2.hunks.should.deep.equal(result.hunks)
        })
      })
    })

    describe("with input alternating between negative and positive", function () {
      let result
      before(async function () {
        result = await producePatchDataFromTwoInputs(a, b, stubUserInput("nynynyn"), silentDisplay)
      })
      describe("via interaction", function () {
        it("should return all evenly-number diffs marked for staging", function () {
          result.hunks[0].hunkBody
            .filter(x => x.diff)
            .filter((x, i) => i % 2)
            .should.all.have.property("stage", true)
        })
        it("should return every other diff marked for not staging", function () {
          result.hunks[0].hunkBody
            .filter(x => x.diff)
            .filter((x, i) => (i + 1) % 2)
            .should.all.have.property("stage", false)
        })
      })
      describe("via predetermined input", function () {
        it("should return same result as if interaction had been used", async function () {
          let result2 = await producePatchDataFromTwoInputs(a, b, "nynynyn", silentDisplay)
          result2.hunks.should.deep.equal(result.hunks)
        })
      })
    })

    describe("with input positive for first couple of diffs, then quitting altogether", function () {
      let result
      before(async function () {
        result = await producePatchDataFromTwoInputs(a, b, stubUserInput("yyq"), silentDisplay)
      })
      describe("via interaction", function () {
        it("should return first two diffs as marked for staging", function () {
          result.hunks[0].hunkBody
            .filter(x => x.diff)
            .slice(0, 2)
            .should.all.have.property("stage", true)
        })
        it("should return all diffs after first two as not marked for staging", function () {
          result.hunks[0].hunkBody
            .filter(x => x.diff)
            .slice(2)
            .should.all.have.property("stage", false)
        })
      })
      describe("via predetermined input", function () {
        it("should return same result as if interaction had been used", async function () {
          let result2 = await producePatchDataFromTwoInputs(a, b, "yyq", silentDisplay)
          result2.hunks.should.deep.equal(result.hunks)
        })
      })
    })
  })

  describe("for A and B versions of multi-lined content", function () {

    let a = ` - Forgo chartjunk, including moire vibration, the grid, and the duck.\n\nChartjunk is just the first type of non-data-ink, creators of data graphics should look for and remove to improve their data-ink ratio.`
    let b = ` > Forgo [_sic_] chartjunk, including  \n > moiré vibration,  \n > the grid, and the duck.  \n\nYou can read more about the terms "moiré vibration", "the grid", and "the duck" on [Tufte's webpage about chartjunk](https://www.edwardtufte.com/bboard/q-and-a-fetch-msg?msg_id=00040Z).\n\nChartjunk is just the first type of non-data-ink, creators of data graphics should look for and remove to improve their data-ink ratio.`

    describe("with input ignoring diffs containing line breaks", function () {
      let result
      before(async function () {
        result = await producePatchDataFromTwoInputs(a, b, stubUserInput("ynynynynn"), silentDisplay)
      })
      it("should return same lines marked for staging as the original source lines", function () {
        result.hunks[0].hunkBody.forEach(x => {
          x.stagedLine.should.equal(x.sourceLine)
        })
      })
    })

    describe("with input all positive", function () {
      let result
      before(async function () {
        result = await producePatchDataFromTwoInputs(a, b, stubUserInput("a"), silentDisplay)
      })
      it("should return staged lines the same as the edited lines", function () {
        result.hunks[0].hunkBody.forEach(x => {
          x.stagedLine.should.equal(x.editedLine)
        })
      })
    })
  })

  describe("for A and B versions of multi-hunk content", function () {

    let a = `# Example contents\n\nThis is an example of contents in a file.\n\nThere is more content here.\n\nThis is a line that changes.`
    let b = `# Test contents\n\nA new first line added.\n\nThis is an example of contents in a file.\n\nThere is more content here.\n\nThis is a line that has changed.`

    describe("with input ignoring first hunk, which contains line break changes", function () {
      let result
      before(async function () {
        result = await producePatchDataFromTwoInputs(a, b, stubUserInput("nnnny"), silentDisplay)
      })
      it("should return, in the first hunk, staged lines the same as the source lines", function () {
        result.hunks[0].hunkBody.forEach(x => {
          x.stagedLine.should.equal(x.sourceLine)
        })
      })
      it("should return, in the second hunk, staged lines the same as the source lines", function () {
        result.hunks[1].hunkBody.forEach(x => {
          x.stagedLine.should.equal(x.sourceLine)
        })
      })
    })

    describe("with input accepting all changes even the line break changes", function () {
      let result
      before(async function () {
        result = await producePatchDataFromTwoInputs(a, b, stubUserInput("a"), silentDisplay)
      })
      it("should return the first diff with the same line numbers for staged, source, and edited, e.g., 1", function () {
        result.hunks[0].hunkBody[0].stagedLine
          .should.equal(result.hunks[0].hunkBody[0].sourceLine)
          .and.equal(result.hunks[0].hunkBody[0].editedLine)
          .and.equal(1)
      })
      it("should return, in the second hunk, staged lines the same as the edited lines", function () {
        result.hunks[1].hunkFrontContext[0].stagedLine
          .should.equal(result.hunks[1].hunkFrontContext[0].editedLine)
          .and.equal(b.match(/\n/g).length)
      })
    })
  })
})

describe("Check patch output for", function (){

  let producePatchOutput = diffcraft.producePatchStringFromFilesContent
  let stubUserInput = ((input = "") => {
    let memoInput = input.split("")
    return ((message) => memoInput.shift() || "q")
  })
  let silentDisplay = x => null

  describe("for A and B versions of multi-hunk content", function () {

    let hunk1a = `# Example contents\n\nThis is an example of contents in a file.\n`
    let hunk1b = `# Test contents\n\nA new first line added.\n\nThis is an example of contents in a file.\n`
    let filler = `\nThere is more content here.\n\n`
    let hunk2a = `This is a line that changes.`
    let hunk2b = `This is a line that has changed.`
    let a = {
      "filename": "sample-file.md",
      "contents": `${hunk1a}${filler}${hunk2a}`
    }
    let b = {
      "filename": "sample-file.md",
      "contents": `${hunk1b}${filler}${hunk2b}`
    }

    describe("with input ignoring first hunk, which contains line break changes", function () {
      let result
      before(async function () {
        result = await producePatchOutput([a, b], "nnnny", silentDisplay, x => x)
      })
      it("should return a patch of nine lines", function () {
        let phl = patchHeaderLength = 4
        let hcl = hunkContextLength = 1
        let hal = hunkALength = (hunk2a.match(/\n/g) || []).length + 1
        let hbl = hunkBLength = (hunk2b.match(/\n/g) || []).length + 1
        let hpd = hunkPadding = 2
        result.split("\n").length.should.equal(phl + hcl + hal + hbl + hpd)
      })
      it("should return a patch where the first line shows both filenames", function () {
        result.split("\n")[0].should.equal(`diff --git a/${a.filename} b/${b.filename}`)
      })
      it("should return a patch where the A header matches the A filename", function () {
        result.split("\n")[2].should.equal(`--- a/${a.filename}`)
      })
      it("should return a patch where the B header matches the B filename", function () {
        result.split("\n")[3].should.equal(`+++ b/${b.filename}`)
      })
      it("should return a patch where the hunk context line gives correct line numbers", function () {
        let ehsl = expectedHunk2StartLine = `${hunk1a}${filler}`.match(/\n/g).length
        let hall = hunk2aLineLength = (hunk2a.match(/\n/g) || []).length + 2
        let hbll = hunk2bLineLength = (hunk2b.match(/\n/g) || []).length + 2
        result.split("\n")[4].should.equal(`@@ -${ehsl},${hall} +${ehsl},${hbll} @@`)
      })
      it("should return a patch where hunk starting context line is given", function () {
        result.split("\n")[5].should.equal(" ")
      })
      it("should return a patch where the patch source line matches content in version A", function () {
        result.split("\n")[6].should.equal(`-${hunk2a}`)
      })
      it("should return a patch where the patch source line matches content in version B", function () {
        result.split("\n")[7].should.equal(`+${hunk2b}`)
      })
      it("should return a patch where hunk closing context line is given", function () {
        result.split("\n")[8].should.equal("")
      })
    })
  })

})
