
test: lint test-only

lint:
	@./node_modules/.bin/jshint *.json lib test config

test-only:
	@./node_modules/.bin/mocha -R spec

tdd:
	@./node_modules/.bin/mocha -R spec -w
