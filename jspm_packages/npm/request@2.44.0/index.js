/* */ 
(function(process) {
  var extend = require("util")._extend,
      cookies = require("./lib/cookies"),
      copy = require("./lib/copy"),
      helpers = require("./lib/helpers"),
      isFunction = helpers.isFunction,
      constructObject = helpers.constructObject,
      filterForCallback = helpers.filterForCallback,
      constructOptionsFrom = helpers.constructOptionsFrom,
      paramsHaveRequestBody = helpers.paramsHaveRequestBody;
  ;
  function initParams(uri, options, callback) {
    callback = filterForCallback([options, callback]);
    options = constructOptionsFrom(uri, options);
    return constructObject().extend({callback: callback}).extend({options: options}).extend({uri: options.uri}).done();
  }
  function request(uri, options, callback) {
    if (typeof uri === 'undefined')
      throw new Error('undefined is not a valid uri or options object.');
    var params = initParams(uri, options, callback);
    options = params.options;
    options.callback = params.callback;
    options.uri = params.uri;
    return new request.Request(options);
  }
  function requester(params) {
    if (typeof params.options._requester === 'function')
      return params.options._requester;
    return request;
  }
  request.get = function(uri, options, callback) {
    var params = initParams(uri, options, callback);
    params.options.method = 'GET';
    return requester(params)(params.uri || null, params.options, params.callback);
  };
  request.head = function(uri, options, callback) {
    var params = initParams(uri, options, callback);
    params.options.method = 'HEAD';
    if (paramsHaveRequestBody(params))
      throw new Error("HTTP HEAD requests MUST NOT include a request body.");
    return requester(params)(params.uri || null, params.options, params.callback);
  };
  request.post = function(uri, options, callback) {
    var params = initParams(uri, options, callback);
    params.options.method = 'POST';
    return requester(params)(params.uri || null, params.options, params.callback);
  };
  request.put = function(uri, options, callback) {
    var params = initParams(uri, options, callback);
    params.options.method = 'PUT';
    return requester(params)(params.uri || null, params.options, params.callback);
  };
  request.patch = function(uri, options, callback) {
    var params = initParams(uri, options, callback);
    params.options.method = 'PATCH';
    return requester(params)(params.uri || null, params.options, params.callback);
  };
  request.del = function(uri, options, callback) {
    var params = initParams(uri, options, callback);
    params.options.method = 'DELETE';
    return requester(params)(params.uri || null, params.options, params.callback);
  };
  request.jar = function() {
    return cookies.jar();
  };
  request.cookie = function(str) {
    return cookies.parse(str);
  };
  request.defaults = function(options, requester) {
    var wrap = function(method) {
      var headerlessOptions = function(options) {
        options = extend({}, options);
        delete options.headers;
        return options;
      };
      var getHeaders = function(params, options) {
        return constructObject().extend(options.headers).extend(params.options.headers).done();
      };
      return function(uri, opts, callback) {
        var params = initParams(uri, opts, callback);
        params.options = extend(headerlessOptions(options), params.options);
        if (options.headers)
          params.options.headers = getHeaders(params, options);
        if (isFunction(requester)) {
          if (method === request) {
            method = requester;
          } else {
            params.options._requester = requester;
          }
        }
        return method(params.options, params.callback);
      };
    };
    defaults = wrap(this);
    defaults.get = wrap(this.get);
    defaults.patch = wrap(this.patch);
    defaults.post = wrap(this.post);
    defaults.put = wrap(this.put);
    defaults.head = wrap(this.head);
    defaults.del = wrap(this.del);
    defaults.cookie = wrap(this.cookie);
    defaults.jar = this.jar;
    defaults.defaults = this.defaults;
    return defaults;
  };
  request.forever = function(agentOptions, optionsArg) {
    var options = constructObject();
    if (optionsArg)
      options.extend(optionsArg);
    if (agentOptions)
      options.agentOptions = agentOptions;
    options.extend({forever: true});
    return request.defaults(options.done());
  };
  module.exports = request;
  request.Request = require("./request");
  request.debug = process.env.NODE_DEBUG && /\brequest\b/.test(process.env.NODE_DEBUG);
  request.initParams = initParams;
})(require("process"));