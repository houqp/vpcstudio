#!/bin/bash

set -e

REPOSITORY=$GITHUB_REPOSITORY

remote_repo="https://${GITHUB_ACTOR}:${GITHUB_TOKEN}@github.com/${REPOSITORY}.git"
git push "${remote_repo}" HEAD:gh-pages
