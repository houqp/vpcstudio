#!/bin/bash

set -e

REPOSITORY=$GITHUB_REPOSITORY

[ -z "${GITHUB_TOKEN}" ] && {
    echo 'Missing environment variable GITHUB_TOKEN.';
    exit 1;
};

make build
cp -R ./assets/* ./dist

echo "pushing to gh-pages branch"
git prune
git branch -D gh-pages || true
git checkout --orphan gh-pages
git rm -rf .
cp dist/* ./
git add *.js *.css *.html *.xml

git config --local user.email "action@github.com"
git config --local user.name "GitHub Action"
git commit -m 'github pages release'
remote_repo="https://${GITHUB_ACTOR}:${GITHUB_TOKEN}@github.com/${REPOSITORY}.git"
git push -f "${remote_repo}" HEAD:gh-pages
