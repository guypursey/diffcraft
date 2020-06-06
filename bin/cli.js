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
  .alias("o", "output").nargs("o", 1)
  .describe("o", "Load the patch contents into the specified file")
  .alias("i", "input").nargs("o", 1)
  .describe("i", [
      "Predetermine diffs to select for patch; skip interactive and use string instead:",
      "- `y`: Mark a diff for staging.",
      "- `n`: Mark a diff to not be staged.",
      "- `a`: Mark this and all diffs hereafter for staging.",
      "- `q`: Mark this and all diffs hereafter to not be staged."
    ].join("\n"))
  .help("h")
  .alias("h", "help")
  .alias("v", "version")
  .epilog("copyright 2020")
  .argv;
const prompts = require("prompts");
const ttys = require("ttys");
const diffcraft = require("../src/index.js");

const promptFn = argv.i
  ? (() => {
      let character = 0
      return (async (message) => {
        let checkprompt = argv.i[character]
        character += 1
        return checkprompt
      })
    })()
  : (async (message) => {
      const response = await prompts({
        type: "text",
        name: "checkprompt",
        message: message,
        stdin: ttys.stdin
      })
      return response.checkprompt
    })

const loggerFn = console.log;

const outputFn = argv.o
  ? (async (output) => {
      fsp.writeFile(argv.o, output, "utf8")
        .then(function (result) {
          console.log(`Wrote patch successfully to ${argv.o}`)
          return output
        })
    })
  : output => {
    loggerFn(output)
    return output
  };

Promise.all([
      argv.f
        ? fsp.readFile(argv.f[0], "utf8")
        : argv.f1
          ? fsp.readFile(argv.f1, "utf8")
          : `${argv._[0]}${argv._[0].endsWith("\n") ? "" : "\n"}`,
      argv.f
        ? fsp.readFile(argv.f[1], "utf8")
        : argv.f2
          ? fsp.readFile(argv.f2, "utf8")
          : `${argv._[0]}${argv._[0].endsWith("\n") ? "" : "\n"}`
    ])
  .then(function ([source, edited]) {
    return diffcraft.producePatchStringFromFilesContent([
      {
        "filename": argv.f ? argv.f[0] : argv.f1 || argv.f2,
        "contents": source.replace(/\r/g, "")
      },
      {
        "filename": argv.f ? argv.f[0] : argv.f2 || argv.f1,
        "contents": edited.replace(/\r/g, "")
      }
    ], promptFn, loggerFn, outputFn)
  })
  .then(function (data) {
    ttys.stdin.destroy()
  })
  .catch(function (error) {
    console.log(error)
  })
