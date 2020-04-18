#!/usr/bin/env node

const fsp = require("fs").promises;
const argv = require("yargs")
  .usage("Usage: $0 [options]")
  .command("Compare two similar files, FILE A and FILE B, and choose the differences from FILE B you'd want to use to edit FILE A.")
  .example("$0 -f filea.md fileb.md")
  .alias("f", "file")
  .nargs("f", 2)
  .describe("f", "Compare two files")
  //.demandOption(["f"])
  .help("h")
  .alias("h", "help")
  .alias("v", "version")
  .epilog("copyright 2020")
  .argv;
const prompt = require("prompt-sync")()
const diffCraft = require("./index.js");

if (argv.file) {
  Promise.all([
        fsp.readFile(argv.file[0], "utf8"),
        fsp.readFile(argv.file[1], "utf8")
      ])
    .then(function ([filea, fileb]) {
      return diffCraft.producePatchStringFromFilesContent([
        {
          filename: argv.file[0],
          contents: filea
        },
        {
          filename: argv.file[1],
          contents: fileb
        }
      ], prompt, console.log)
    })
    .then(function (data) {
      console.log("Result")
      console.log(data)
    })
    .catch(function (error) {
      console.log(error)
    })
}
