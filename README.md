# diffcraft

A package for crafting with diffs and creating patches and the like. For now, powered by JavaScript and building on the [`diff` package](https://www.npmjs.com/package/diff) created by [Kevin Decker](https://github.com/kpdecker).

At present, this remains a proof-of-concept.

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

You can pipe contents to compare if preferred, using specific flags to determine which other file to compare with:

    cat testdocv2.md | diffcraft --f1 testdocv1.md

Or perhaps more usefully, pipe in contents from a Git command and compare with current version of the file:

    git show HEAD:testdoc.md | diffcraft --f2 testdoc.md
