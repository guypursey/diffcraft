const chai = require("chai").use(require("chai-things")).should();
const diff = require("diff");
const diffcraft = require("../index.js");

describe("Splitting diffs at line breaks and adding line numbering", function () {
  let breakUpLines = diffcraft.breakUpLines
  describe("when given an empty array", function () {
    it("should return an empty array", function () {
      breakUpLines([]).should.be.an("array").that.is.empty;
    })
  })
  
  describe("when given a relatively short array of diffs", function () {
    let diffs = [
    	{
    		"added": true,
    		"value": "\n"
    	},
    	{
    		"value": "He "
    	},
    	{
    		"removed": true,
    		"value": "worked"
    	},
    	{
    		"added": true,
    		"value": "would"
    	},
    	{
    		"value": " "
    	},
    	{
    		"added": true,
    		"value": "work "
    	},
    	{
    		"value": "sixteen hours daily for ten or twelve days at a stretch and then for two "
    	},
    	{
    		"removed": true,
    		"value": "hole"
    	},
    	{
    		"added": true,
    		"value": "whole"
    	},
    	{
    		"value": " days "
    	},
    	{
    		"removed": true,
    		"value": "was"
    	},
    	{
    		"added": true,
    		"value": "he"
    	},
    	{
    		"value": " "
    	},
    	{
    		"removed": true,
    		"value": "not"
    	},
    	{
    		"added": true,
    		"value": "couldn't"
    	},
    	{
    		"value": " be "
    	},
    	{
    		"removed": true,
    		"value": "be "
    	},
    	{
    		"value": "found by anyone. He spent that time in his mother's flat, sleeping and eating steaks and ice-cream, taking the old lady to the movies or "
    	},
    	{
    		"removed": true,
    		"value": "spading at his master's thesis which was on the philosophy of non-violence"
    	},
    	{
    		"added": true,
    		"value": "reading"
    	},
    	{
    		"value": ". Once in a while he slipped away to a lecture. He was studying law"
    	},
    	{
    		"removed": true,
    		"value": "."
    	},
    	{
    		"added": true,
    		"value": ","
    	},
    	{
    		"value": " too. Grammick wasn't going to be sucked away from all private existence"
    	},
    	{
    		"removed": true,
    		"value": ", though at his job that ten day stretch he didn't appear to have any ulterior design of heading for any shore of his own"
    	},
    	{
    		"value": ".\n"
    	}
    ]
    let result = breakUpLines(diffs)
    it("should return an array", function () {
      result.should.be.an("array")
    })
  })
})

describe("Checking patch data produced", function () {
  let stubUserInput = ((input = "") => {
    let memoInput = input.split("")
    return (async (message) => memoInput.shift() || "q")
  })
  let silentDisplay = x => null
  
  describe("for A and B versions of a single line of content", function () {

    let a = "He worked sixteen hours daily for ten or twelve days at a stretch and then for two hole days was not be be found by anyone. He spent that time in his mother's flat, sleeping and eating steaks and ice-cream, taking the old lady to the movies or spading at his master's thesis which was on the philosophy of non-violence. Once in a while he slipped away to a lecture. He was studying law. too. Grammick wasn't going to be sucked away from all private existence, though at his job that ten day stretch he didn't appear to have any ulterior design of heading for any shore of his own.";
    let b = "He would work sixteen hours daily for ten or twelve days at a stretch and then for two whole days he couldn't be found by anyone. He spent that time in his mother's flat, sleeping and eating steaks and ice-cream, taking the old lady to the movies or reading. Once in a while he slipped away to a lecture. He was studying law, too. Grammick wasn't going to be sucked away from all private existence.";
    let diffs = diff.diffWordsWithSpace(a, b)
    let producePatchData = diffcraft.producePatchData

    describe("with all negative inputs", function () {
      
      let result
      
      before(async function () {
        result = await producePatchData(diffs, stubUserInput("nnnnnnn"), silentDisplay)
      })
      
      describe("using individual negative values", function () {
        
        it("should return all diffs unstaged", function () {
          result.hunks[0].hunkBody.filter(x => x.diff)
            .should.all.have.property("stage", false)
        })
        
      })
      
      describe("using quit value", function () {
        
        it("should return the same result as if individual negative values had been used", async function (){
          let result2 = await producePatchData(diffs, stubUserInput("q"), silentDisplay)
          result2.hunks.should.deep.equal(result.hunks)
        })
        
      })
      
    })

    describe("with all positive inputs", async function () {
      
      let result
      
      before(async function () {
        result = await producePatchData(diffs, stubUserInput("yyyyyyy"), silentDisplay)
      })

      describe("using individual positive values", function () {
        
        it("should return all diffs as staged", function () {
          result.hunks[0].hunkBody.filter(x => x.diff)
            .should.all.have.property("stage", true)
        })
        
      })
      
      describe("using single staging value", function () {
        
        it("should return the same result as if individual positive values had been used", async function () {
          let result2 = await producePatchData(diffs, stubUserInput("a"), silentDisplay)
          result2.hunks.should.deep.equal(result.hunks)
        })
        
      })
      
    })

    describe("with input alternating between negative and positive", function () {

      let result

      before(async function () {
        result = await producePatchData(diffs, stubUserInput("nynynyn"), silentDisplay)
      })

      it("should return all evenly-number diffs as staged", function() {
        result.hunks[0].hunkBody
          .filter(x => x.diff)
          .filter((x, i) => i % 2)
          .should.all.have.property("stage", true)
      })

      it("should return every other diff as unstaged", function() {
        result.hunks[0].hunkBody
          .filter(x => x.diff)
          .filter((x, i) => (i + 1) % 2)
          .should.all.have.property("stage", false)
      })

    })
    
  })
  
  describe("with A and B versions of multi-lined content", function () {
    
  })
  
})