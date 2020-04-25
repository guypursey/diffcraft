#!/usr/bin/env node

const fsp = require("fs").promises;
const pipe = require("pipe-args").load();
const argv = require("yargs")
  .usage("Usage: $0 [options]")
  .command("Craft a patch output based on the differences between two strings/files.")
  .example("$0 -f filea.md fileb.md")
  .alias("f", "file").nargs("f", 2)
  .describe("f", "Craft patch from diff of two files")
  .nargs("f1", 1)
  .conflicts("f1", "f")
  .describe("f1", "Use contents of specified file for first input to diff")
  .nargs("f2", 1)
  .conflicts("f2", "f")
  .describe("f2", "Use contents of specified file for second input to diff")
  .alias("r", "reverse").nargs("r", 0)
  .count("r")
  .describe("r", "Reverse first and second input")
  .help("h")
  .alias("h", "help")
  .alias("v", "version")
  .epilog("copyright 2020")
  .argv;
const prompt = require("prompt-sync")()
const diffCraft = require("./index.js");

let r = (argv.r || 0) % 2

Promise.all([
      argv.f
        ? fsp.readFile(argv.f[r], "utf8")
        : argv[`f${r + 1}`]
          ? fsp.readFile(argv[`f${r + 1}`], "utf8")
          : `${argv._[r]}${argv._[r].endsWith("\n") ? "" : "\n"}`,
      argv.f
        ? fsp.readFile(argv.f[r + 1], "utf8")
        : argv[`f${r + 2}`]
          ? fsp.readFile(argv[`f${r + 2}`], "utf8")
          : `${argv._[r + 1]}${argv._[r + 1].endsWith("\n") ? "" : "\n"}`
    ])
  .then(function ([source, edited]) {
    return diffCraft.producePatchStringFromFilesContent([
      {
        "filename": argv.f ? argv.f[r] : argv.f1,
        "contents": source
      },
      {
        "filename": argv.f ? argv.f[r] : argv.f2,
        "contents": edited
      }
    ]
    , prompt, console.log)
  })
  .then(function (data) {
    console.log("Result")
    console.log(data)
  })
  .catch(function (error) {
    console.log(error)
  })
