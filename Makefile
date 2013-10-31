
test: lint test-only

lint:
	@./node_modules/.bin/jshint *.js *.json lib

test-only:
	@./node_modules/.bin/mocha -R spec
