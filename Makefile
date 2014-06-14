
test: lint test-only

lint:
	@./node_modules/.bin/jshint *.js *.json lib test

test-only:
	@./node_modules/.bin/mocha -R spec

tdd:
	@./node_modules/.bin/mocha -R spec -w
