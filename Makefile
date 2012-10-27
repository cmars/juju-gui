FILES=$(shell bzr ls -RV -k file | grep -v assets/ | grep -v app/templates.js | grep -v server.js)
# This list can be regenerated by this command:
# find node_modules -maxdepth 1 -mindepth 1 -type d -printf 'node_modules/%f '
NODE_TARGETS=node_modules/minimatch node_modules/cryptojs \
	node_modules/yuidocjs node_modules/chai node_modules/less \
	node_modules/.bin node_modules/node-markdown node_modules/rimraf \
	node_modules/mocha node_modules/d3 node_modules/graceful-fs \
	node_modules/should node_modules/jshint node_modules/expect.js \
	node_modules/express node_modules/yui
TEMPLATE_TARGETS=$(shell bzr ls -k file app/templates)

all: install

app/templates.js: $(TEMPLATE_TARGETS) bin/generateTemplates
	@./bin/generateTemplates

yuidoc: $(FILES)
	@node_modules/.bin/yuidoc -o yuidoc -x assets app

$(NODE_TARGETS): package.json
	@npm install
	@#link depends
	@ln -sf `pwd`/node_modules/yui ./app/assets/javascripts/
	@ln -sf `pwd`/node_modules/d3/d3.v2* ./app/assets/javascripts/

install: $(NODE_TARGETS) app/templates.js yuidoc

gjslint: virtualenv/bin/gjslint
	@virtualenv/bin/gjslint --strict --nojsdoc --jslint_error=all \
	    --custom_jsdoc_tags module,main,class,method,event,property,attribute,submodule,namespace,extends,config,constructor,static,final,readOnly,writeOnce,optional,required,param,return,for,type,private,protected,requires,default,uses,example,chainable,deprecated,since,async,beta,bubbles,extension,extensionfor,extension_for \
	    $(FILES)

jshint: node_modules/jshint
	@node_modules/jshint/bin/hint $(FILES)

yuidoc-lint: $(FILES)
	@bin/lint-yuidoc

lint: gjslint jshint yuidoc-lint

virtualenv/bin/gjslint virtualenv/bin/fixjsstyle:
	@virtualenv virtualenv
	@virtualenv/bin/easy_install archives/closure_linter-latest.tar.gz

beautify: virtualenv/bin/fixjsstyle
	@virtualenv/bin/fixjsstyle --strict --nojsdoc --jslint_error=all $(FILES)

prep: beautify lint

test: install
	@./test-server.sh

server: install
	@echo "Customize config.js to modify server settings"
	@node server.js

clean:
	@rm -rf node_modules virtualenv
	@make -C docs clean

.PHONY: test lint beautify server install clean prep jshint gjslint
