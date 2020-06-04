# diffcraft

A package for choosing diffs to craft your own custom patchfiles.

At present, this remains a proof-of-concept.

## What is this?

 - Ever wish there was something like Microsoft Word's "tracked changes" accept-and-reject for Git?
 - Ever wish `git add -p` was more granular? (But not wanted to futz with editing patches yourself?)
 - Ever wish you could interact with `git diff --word-diff` to make your own patch?

This is that.

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

_Or_, perhaps more usefully, pipe in contents from a Git command and compare with current version of the file:

    git show HEAD:testdoc.md | diffcraft --f2 testdoc.md -o test.patch

You can then apply the resulting patch with git...

    git apply --cached test.patch

The patch then should be ready to commit but can check it, of course, with:

    git diff --cached

Because the algorithm works on a file-by-file basis, you might want to create and stage several patches before then committing with the usual `git commit`.

## Module options

These are the methods you can using if including/requiring diffcraft in your own package/code:

### .producePatchDataFromTwoInputs(a, b, userInput, userDisplay)

Takes two strings `a` and `b`, and returns data on their differences, using specified `userInput` and `userDisplay` functions to determine how to flag those differences.

`userInput` needs to be a function that returns a Promise, which resolves to one of the following single-character strings:

 - `y`: Mark a diff for staging.
 - `n`: Mark a diff to not be staged.
 - `a`: Mark this and all diffs hereafter for these inputs for staging.
 - `q`: Mark this and all diffs hereafter for these inputs to not be staged.

`userDisplay` needs to be a function but does not need to return anything (can be pure side-effect, like `console.log()`, for now).

The method itself returns a Promise which resolves to ready-to-apply patch string, based on user input

### .producePatchStringFromFilesContent([a, b], userInput, userDisplay, fnOutput)

Takes an array containing objects about existing files for comparison and returns data on the differences between those files.

Only the first two objects in the array will be used as `a` and `b`. The structure of each array member should include two properties:

 - `filename`: The name of the file to be compared.
 - `contents`: The files contents.

Also takes three function arguments.

`userInput` needs to be a function that returns a Promise, which resolves to one of the following single-character strings:

 - `y`: Mark a diff for staging.
 - `n`: Mark a diff to not be staged.
 - `a`: Mark this and all diffs hereafter for these inputs for staging.
 - `q`: Mark this and all diffs hereafter for these inputs to not be staged.

`userDisplay` needs to be a function but does not need to return anything (can be pure side-effect, like `console.log()`, for now).

`fnOutput` should return/resolve to its own input, but along the way can be used to inject a side effect that does something with that input (for example, `console.log` or writing to a file).

Returns a Promise which will resolve to whatever is returned from `fnOutput`.

## CLI options

You can run the `diffcraft` command in a terminal with the following options/flags:

 - `-f` or `--file`: Expects names of two files it can open and compare contents of.
 - `--f1`: Expects argument of file A (to be compared with whatever is given as content B). If B isn't also specified, it will look to piped input to compare with as content.
 - `--f2`: Expects argument of file B (to be compared with whatever is given as content A). If A isn't also specified, it will look to piped input to compare with as content.
 - `-o`: Expects name of file to put patch string into. (Would normally have file extension `.patch`.)
 - `-h`: Show help.
 - `-v`: Show version number.

## How does it work internally?

For now, the algorithm is powered by JavaScript and building on the [`diff` package](https://www.npmjs.com/package/diff) created by [Kevin Decker](https://github.com/kpdecker). But it's not  particularly performant just yet and needs more work. With any luck, it at least illustrates a concept and attempts to solve a problem I've been bothered about for a while.
