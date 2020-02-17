run:
	parcel index.html

test:
	mocha -r ts-node/register src/**/*.spec.ts

build:
	parcel build --public-url . index.html

ghpage: build
	@echo "creating gh-pages branch"
	git prune
	git checkout master
	-@git branch -D gh-pages
	git checkout --orphan gh-pages
	git rm -rf .
	cp dist/* ./
	git add *.js *.css *.html
	git commit -m 'update dist'

publish: ghpage
	@echo "pushing to gh-pages branch"
	git push -f origin gh-pages
	git clean -f
	git checkout master
