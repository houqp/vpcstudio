#!/bin/bash

set -e

REPOSITORY=$GITHUB_REPOSITORY

make build

echo "pushing to gh-pages branch"
git prune
git branch -D gh-pages || true
git checkout --orphan gh-pages
git rm -rf .
cp dist/* ./
git add *.js *.css *.html
git commit -m 'github pages release'

remote_repo="https://${GITHUB_ACTOR}:${GITHUB_TOKEN}@github.com/${REPOSITORY}.git"
git push -f "${remote_repo}" HEAD:gh-pages
