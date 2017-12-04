/*can-stache@3.14.3#helpers/core*/
define([
    'require',
    'exports',
    'module',
    'can-view-live',
    'can-view-nodelist',
    'can-compute',
    '../src/utils',
    'can-util/js/is-function',
    'can-util/js/base-url',
    'can-util/js/join-uris',
    'can-util/js/each',
    'can-util/js/assign',
    'can-util/js/is-iterable',
    'can-log/dev',
    'can-symbol',
    'can-reflect',
    'can-util/js/is-empty-object',
    '../expressions/hashes',
    './-debugger',
    'can-observation',
    'can-util/dom/data'
], function (require, exports, module) {
    var live = require('can-view-live');
    var nodeLists = require('can-view-nodelist');
    var compute = require('can-compute');
    var utils = require('../src/utils');
    var isFunction = require('can-util/js/is-function');
    var getBaseURL = require('can-util/js/base-url');
    var joinURIs = require('can-util/js/join-uris');
    var each = require('can-util/js/each');
    var assign = require('can-util/js/assign');
    var isIterable = require('can-util/js/is-iterable');
    var dev = require('can-log/dev');
    var canSymbol = require('can-symbol');
    var canReflect = require('can-reflect');
    var isEmptyObject = require('can-util/js/is-empty-object');
    var Hashes = require('../expressions/hashes');
    var debuggerHelper = require('./-debugger').helper;
    var Observation = require('can-observation');
    var domData = require('can-util/dom/data');
    var looksLikeOptions = function (options) {
        return options && typeof options.fn === 'function' && typeof options.inverse === 'function';
    };
    var resolve = function (value) {
        if (value && canReflect.isValueLike(value)) {
            return canReflect.getValue(value);
        } else {
            return value;
        }
    };
    var resolveHash = function (hash) {
        var params = {};
        for (var prop in hash) {
            params[prop] = resolve(hash[prop]);
        }
        return params;
    };
    var peek = Observation.ignore(resolve);
    var helpers = {
        'each': {
            metadata: { isLiveBound: true },
            fn: function (items) {
                var args = [].slice.call(arguments), options = args.pop(), argsLen = args.length, argExprs = options.exprData.argExprs, hashExprs = options.exprData.hashExprs, resolved = peek(items), asVariable, hashOptions, aliases, key;
                if (argsLen === 2 && !(argExprs[1].expr instanceof Hashes) || argsLen === 3 && argExprs[1].key === 'as') {
                    asVariable = args[argsLen - 1];
                    if (typeof asVariable !== 'string') {
                        asVariable = argExprs[argsLen - 1].key;
                    }
                }
                if (!isEmptyObject(hashExprs)) {
                    hashOptions = {};
                    each(hashExprs, function (exprs, key) {
                        hashOptions[exprs.key] = key;
                    });
                }
                if ((canReflect.isObservableLike(resolved) && canReflect.isListLike(resolved) || utils.isArrayLike(resolved) && canReflect.isValueLike(items)) && !options.stringOnly) {
                    return function (el) {
                        var nodeList = [el];
                        nodeList.expression = 'live.list';
                        nodeLists.register(nodeList, null, options.nodeList, true);
                        nodeLists.update(options.nodeList, [el]);
                        var cb = function (item, index, parentNodeList) {
                            var aliases = {
                                '%index': index,
                                '@index': index
                            };
                            if (asVariable) {
                                aliases[asVariable] = item;
                            }
                            if (!isEmptyObject(hashOptions)) {
                                if (hashOptions.value) {
                                    aliases[hashOptions.value] = item;
                                }
                                if (hashOptions.index) {
                                    aliases[hashOptions.index] = index;
                                }
                            }
                            return options.fn(options.scope.add(aliases, { notContext: true }).add({ index: index }, { special: true }).add(item), options.options, parentNodeList);
                        };
                        live.list(el, items, cb, options.context, el.parentNode, nodeList, function (list, parentNodeList) {
                            return options.inverse(options.scope.add(list), options.options, parentNodeList);
                        });
                    };
                }
                var expr = resolve(items), result;
                if (!!expr && utils.isArrayLike(expr)) {
                    result = utils.getItemsFragContent(expr, options, options.scope, asVariable);
                    return options.stringOnly ? result.join('') : result;
                } else if (canReflect.isObservableLike(expr) && canReflect.isMapLike(expr) || expr instanceof Object) {
                    result = [];
                    canReflect.each(expr, function (val, key) {
                        var value = compute(expr, key);
                        aliases = {
                            '%key': key,
                            '@key': key
                        };
                        if (asVariable) {
                            aliases[asVariable] = value;
                        }
                        if (!isEmptyObject(hashOptions)) {
                            if (hashOptions.value) {
                                aliases[hashOptions.value] = value;
                            }
                            if (hashOptions.key) {
                                aliases[hashOptions.key] = key;
                            }
                        }
                        result.push(options.fn(options.scope.add(aliases, { notContext: true }).add({ key: key }, { special: true }).add(value)));
                    });
                    return options.stringOnly ? result.join('') : result;
                }
            }
        },
        '@index': {
            fn: function (offset, options) {
                if (!options) {
                    options = offset;
                    offset = 0;
                }
                var index = options.scope.peek('@index');
                return '' + ((isFunction(index) ? index() : index) + offset);
            }
        },
        'if': {
            fn: function (expr, options) {
                var value;
                if (expr && expr.isComputed) {
                    value = compute.truthy(expr)();
                } else {
                    value = !!resolve(expr);
                }
                if (value) {
                    return options.fn(options.scope || this);
                } else {
                    return options.inverse(options.scope || this);
                }
            }
        },
        'is': {
            fn: function () {
                var lastValue, curValue, options = arguments[arguments.length - 1];
                if (arguments.length - 2 <= 0) {
                    return options.inverse();
                }
                var args = arguments;
                var callFn = compute(function () {
                    for (var i = 0; i < args.length - 1; i++) {
                        curValue = resolve(args[i]);
                        curValue = isFunction(curValue) ? curValue() : curValue;
                        if (i > 0) {
                            if (curValue !== lastValue) {
                                return false;
                            }
                        }
                        lastValue = curValue;
                    }
                    return true;
                });
                return callFn() ? options.fn() : options.inverse();
            }
        },
        'eq': {
            fn: function () {
                return helpers.is.fn.apply(this, arguments);
            }
        },
        'unless': {
            fn: function (expr, options) {
                return helpers['if'].fn.apply(this, [
                    expr,
                    assign(assign({}, options), {
                        fn: options.inverse,
                        inverse: options.fn
                    })
                ]);
            }
        },
        'with': {
            fn: function (expr, options) {
                var ctx = expr;
                if (!options) {
                    options = expr;
                    expr = true;
                    ctx = options.hash;
                } else {
                    expr = resolve(expr);
                    if (options.hash && !isEmptyObject(options.hash)) {
                        ctx = options.scope.add(options.hash).add(ctx);
                    }
                }
                return options.fn(ctx || {});
            }
        },
        'log': {
            fn: function (options) {
                var logs = [];
                each(arguments, function (val) {
                    if (!looksLikeOptions(val)) {
                        logs.push(val);
                    }
                });
                if (typeof console !== 'undefined' && console.log) {
                    if (!logs.length) {
                        console.log(options.context);
                    } else {
                        console.log.apply(console, logs);
                    }
                }
            }
        },
        'data': {
            fn: function (attr) {
                var data = arguments.length === 2 ? this : arguments[1];
                return function (el) {
                    domData.set.call(el, attr, data || this.context);
                };
            }
        },
        'switch': {
            fn: function (expression, options) {
                resolve(expression);
                var found = false;
                var newOptions = options.helpers.add({
                    'case': function (value, options) {
                        if (!found && resolve(expression) === resolve(value)) {
                            found = true;
                            return options.fn(options.scope || this);
                        }
                    },
                    'default': function (options) {
                        if (!found) {
                            return options.fn(options.scope || this);
                        }
                    }
                });
                return options.fn(options.scope, newOptions);
            }
        },
        'joinBase': {
            fn: function (firstExpr) {
                var args = [].slice.call(arguments);
                var options = args.pop();
                var moduleReference = args.map(function (expr) {
                    var value = resolve(expr);
                    return isFunction(value) ? value() : value;
                }).join('');
                var templateModule = options.helpers.peek('helpers.module');
                var parentAddress = templateModule ? templateModule.uri : undefined;
                var isRelative = moduleReference[0] === '.';
                if (isRelative && parentAddress) {
                    return joinURIs(parentAddress, moduleReference);
                } else {
                    var baseURL = typeof System !== 'undefined' && (System.renderingBaseURL || System.baseURL) || getBaseURL();
                    if (moduleReference[0] !== '/' && baseURL[baseURL.length - 1] !== '/') {
                        baseURL += '/';
                    }
                    return joinURIs(baseURL, moduleReference);
                }
            }
        }
    };
    helpers.eachOf = helpers.each;
    helpers.debugger = { fn: debuggerHelper };
    var registerHelper = function (name, callback, metadata) {
        helpers[name] = {
            metadata: assign({ isHelper: true }, metadata),
            fn: callback
        };
    };
    var makeSimpleHelper = function (fn) {
        return function () {
            var realArgs = [];
            each(arguments, function (val) {
                while (val && val.isComputed) {
                    val = val();
                }
                realArgs.push(val);
            });
            return fn.apply(this, realArgs);
        };
    };
    var registerSimpleHelper = function (name, callback) {
        registerHelper(name, makeSimpleHelper(callback));
    };
    module.exports = {
        registerHelper: registerHelper,
        registerSimpleHelper: function () {
            registerSimpleHelper.apply(this, arguments);
        },
        addHelper: registerSimpleHelper,
        addLiveHelper: function (name, callback) {
            return registerHelper(name, callback, { isLiveBound: true });
        },
        getHelper: function (name, options) {
            var helper = options && options.get && options.get('helpers.' + name, { proxyMethods: false });
            if (helper) {
                helper = { fn: helper };
            } else {
                helper = helpers[name];
            }
            if (helper) {
                helper.metadata = assign(helper.metadata || {}, { isHelper: true });
                return helper;
            }
        },
        resolve: resolve,
        resolveHash: resolveHash,
        looksLikeOptions: looksLikeOptions,
        helpers: assign({}, helpers)
    };
});