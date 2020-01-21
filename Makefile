run:
	parcel index.html

build:
	parcel build --public-url . index.html

publish: build
	@echo "pushing to gh-pages branch"
	git prune
	git checkout master
	-@git branch -D gh-pages
	git checkout --orphan gh-pages
	git rm -rf .
	cp dist/* ./
	git add *.js *.css *.html
	git commit -m 'update dist'
	git push -f origin gh-pages
	git clean -f
	git checkout master
