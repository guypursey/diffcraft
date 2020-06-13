# diffcraft

A package for choosing diffs to craft your own custom patchfiles.

At present, this remains a proof-of-concept.

## What is this?

 - Ever wish there was something like Microsoft Word's "tracked changes" accept-and-reject for Git?
 - Ever wish `git add -p` was more granular? (But not wanted to futz with editing patches yourself?)
 - Ever wish you could interact with `git diff --word-diff` to make your own patch?

This is that.

## What does it do?

For each little diff in your file (not at the line level), you can decide on what you want to do with that diff.

These decisions are then used to generate a patch output which can popped into a file and, if you like, applied to a Git repository.

### Encoded diff-decision strings

To make each decision, there's a small array of characters or keys to use:

 - `y`: Mark a diff for staging.
 - `n`: Mark a diff to not be staged.
 - `a`: Mark this and all diffs hereafter for staging.
 - `q`: Mark this and all diffs hereafter to not be staged.

The characters can also be used as part of an encoded diff-decision string, which you can use when working with this package.

There are some examples in [the section about the input flag for CLI usage](#input), and [the section about the method for writing patch data within your own package](#producepatchdatafromtwoinputsa-b-userinput-userdisplay).

## Use as package in Node script

Install locally:

    npm i diffcraft

Include in code:

    const diffcraft = require("diffcraft")

## Use package in command line

Install globally:

    npm i -g diffcraft

Go to repo:

    cd test-repo

Run diffcraft against two files:

    diffcraft -f testdocv1.md testdocv2.md

_Or_ you can pipe contents to compare if preferred, using specific flags to determine which other file to compare with:

    cat testdocv2.md | diffcraft --f1 testdocv1.md

### Output

You can also have your crafted patch directed to a file, using the `-o` flag and a filename argument.

    diffcraft -f testdocv1.md testdocv2.md -o testpatch.patch

### Input

Instead of interacting with the files using the command line, you can decide upfront what you want the decision about each diff to be.

For example, you may want the first difference between two files to appear in your patch, but to ignore all the rest. You can do this with the `-i` flag and an encoded diff-decision string.

    diffcraft -f testdocv1.md testdocv2.md -i yyq

See [the section on encoded diff-decision strings](#encoded-diff-decision-strings) for more on how to use this flag.

### Using with Git

Perhaps more usefully, pipe in contents from a Git command and compare with current version of the file:

    git show HEAD:testdoc.md | diffcraft --f2 testdoc.md -o test.patch

You can then apply the resulting patch with git...

    git apply --cached test.patch

The patch then should be ready to commit but can check it, of course, with:

    git diff --cached

Because the algorithm works on a file-by-file basis, you might want to create and stage several patches before then committing with the usual `git commit`.

There are [some useful aliases for using diffcraft with Git](https://guypursey.com/blog/202006091830-my-new-git-editing-workflow).

## Module options

These are the methods you can using if including/requiring diffcraft in your own package/code:

### .producePatchDataFromTwoInputs(a, b, userInput, userDisplay)

Takes two strings `a` and `b`, and returns data on their differences, using specified `userInput` and `userDisplay` functions to determine how to flag those differences.

`userInput` needs to be either a **string** or a **function** that returns a single character value or a Promise that resolves to that.

 - A **string** should have contain a character for each diff, encoding the decision about each one. This is the encoded diff-decision string. An example is the string `"yyq"`, which will mark the first two diffs found for staging but ignore all others.

 - A **function** should return single-character string values based on the same encoding (or a Promise that resolves to that). An example would be a function that returns the value (or a Promise resolves to) `"y"`, then another than returns or resolves to `"y"`, then another that returns or resolves to `"q"`. Like the string example, this will mark the first two diffs for staging but ignore all others. The first argument of any function will be the message about the staging, the second will be the number of the diff in the file overall (corresponding to the character in the implied diff-decision string).

See [the section on encoded diff-decision strings](#encoded-diff-decision-strings) for more on how to use this flag.

`userDisplay` needs to be a function but does not need to return anything (can be pure side-effect, like `console.log()`, for now).

The method itself returns a Promise which resolves to ready-to-apply patch string, based on user input

### .producePatchStringFromFilesContent([a, b], userInput, userDisplay, fnOutput)

Takes an array containing objects about existing files for comparison and returns data on the differences between those files.

Only the first two objects in the array will be used as `a` and `b`. The structure of each array member should include two properties:

 - `filename`: The name of the file to be compared.
 - `contents`: The files contents.

Also takes three function arguments.

`userInput` needs to be either a **string** or a **function** that returns a single character value or a Promise that resolves to that.

 - A **string** should have contain a character for each diff, encoding the decision about each one. This is the encoded diff-decision string. An example is the string `"yyq"`, which will mark the first two diffs found for staging but ignore all others.

 - A **function** should return single-character string values based on the same encoding (or a Promise that resolves to that). An example would be a function that returns the value (or a Promise resolves to) `"y"`, then another than returns or resolves to `"y"`, then another that returns or resolves to `"q"`. Like the string example, this will mark the first two diffs for staging but ignore all others. The first argument of any function will be the message about the staging, the second will be the number of the diff in the file overall (corresponding to the character in the implied diff-decision string).

See [the section on encoded diff-decision strings](#encoding-diff-decision-strings) for more on how to use this flag.

`userDisplay` needs to be a function but does not need to return anything (can be pure side-effect, like `console.log()`, for now).

`fnOutput` should return/resolve to its own input, but along the way can be used to inject a side effect that does something with that input (for example, `console.log` or writing to a file).

Returns a Promise which will resolve to whatever is returned from `fnOutput`.

## CLI options

You can run the `diffcraft` command in a terminal with the following options/flags:

 - `-f` or `--file`: Expects names of two files it can open and compare contents of.
 - `--f1`: Expects argument of file A (to be compared with whatever is given as content B). If B isn't also specified, it will look to piped input to compare with as content.
 - `--f2`: Expects argument of file B (to be compared with whatever is given as content A). If A isn't also specified, it will look to piped input to compare with as content.
 - `-o`: Expects name of file to put patch string into. (Would normally have file extension `.patch`.)
 - `-i`: Expects [encoded diff-decision string](#encoded-diff-decision-string).
 - `-h`: Show help.
 - `-v`: Show version number.

## How does it work internally?

For now, the algorithm is powered by JavaScript and building on the [`diff` package](https://www.npmjs.com/package/diff) created by [Kevin Decker](https://github.com/kpdecker). But it's not  particularly performant just yet and needs more work. With any luck, it at least illustrates a concept and attempts to solve a problem I've been bothered about for a while.
