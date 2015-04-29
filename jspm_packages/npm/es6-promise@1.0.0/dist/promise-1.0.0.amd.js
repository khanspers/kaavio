/* */ 
"format cjs";
(function(process) {
  define("promise/all", ["./utils", "exports"], function(__dependency1__, __exports__) {
    "use strict";
    var isArray = __dependency1__.isArray;
    var isFunction = __dependency1__.isFunction;
    function all(promises) {
      var Promise = this;
      if (!isArray(promises)) {
        throw new TypeError('You must pass an array to all.');
      }
      return new Promise(function(resolve, reject) {
        var results = [],
            remaining = promises.length,
            promise;
        if (remaining === 0) {
          resolve([]);
        }
        function resolver(index) {
          return function(value) {
            resolveAll(index, value);
          };
        }
        function resolveAll(index, value) {
          results[index] = value;
          if (--remaining === 0) {
            resolve(results);
          }
        }
        for (var i = 0; i < promises.length; i++) {
          promise = promises[i];
          if (promise && isFunction(promise.then)) {
            promise.then(resolver(i), reject);
          } else {
            resolveAll(i, promise);
          }
        }
      });
    }
    __exports__.all = all;
  });
  define("promise/asap", ["exports"], function(__exports__) {
    "use strict";
    var browserGlobal = (typeof window !== 'undefined') ? window : {};
    var BrowserMutationObserver = browserGlobal.MutationObserver || browserGlobal.WebKitMutationObserver;
    var local = (typeof global !== 'undefined') ? global : (this === undefined ? window : this);
    function useNextTick() {
      return function() {
        process.nextTick(flush);
      };
    }
    function useMutationObserver() {
      var iterations = 0;
      var observer = new BrowserMutationObserver(flush);
      var node = document.createTextNode('');
      observer.observe(node, {characterData: true});
      return function() {
        node.data = (iterations = ++iterations % 2);
      };
    }
    function useSetTimeout() {
      return function() {
        local.setTimeout(flush, 1);
      };
    }
    var queue = [];
    function flush() {
      for (var i = 0; i < queue.length; i++) {
        var tuple = queue[i];
        var callback = tuple[0],
            arg = tuple[1];
        callback(arg);
      }
      queue = [];
    }
    var scheduleFlush;
    if (typeof process !== 'undefined' && {}.toString.call(process) === '[object process]') {
      scheduleFlush = useNextTick();
    } else if (BrowserMutationObserver) {
      scheduleFlush = useMutationObserver();
    } else {
      scheduleFlush = useSetTimeout();
    }
    function asap(callback, arg) {
      var length = queue.push([callback, arg]);
      if (length === 1) {
        scheduleFlush();
      }
    }
    __exports__.asap = asap;
  });
  define("promise/config", ["exports"], function(__exports__) {
    "use strict";
    var config = {instrument: false};
    function configure(name, value) {
      if (arguments.length === 2) {
        config[name] = value;
      } else {
        return config[name];
      }
    }
    __exports__.config = config;
    __exports__.configure = configure;
  });
  define("promise/polyfill", ["./promise", "./utils", "exports"], function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var RSVPPromise = __dependency1__.Promise;
    var isFunction = __dependency2__.isFunction;
    function polyfill() {
      var local;
      if (typeof global !== 'undefined') {
        local = global;
      } else if (typeof window !== 'undefined' && window.document) {
        local = window;
      } else {
        local = self;
      }
      var es6PromiseSupport = "Promise" in local && "resolve" in local.Promise && "reject" in local.Promise && "all" in local.Promise && "race" in local.Promise && (function() {
        var resolve;
        new local.Promise(function(r) {
          resolve = r;
        });
        return isFunction(resolve);
      }());
      if (!es6PromiseSupport) {
        local.Promise = RSVPPromise;
      }
    }
    __exports__.polyfill = polyfill;
  });
  define("promise/promise", ["./config", "./utils", "./all", "./race", "./resolve", "./reject", "./asap", "exports"], function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __dependency5__, __dependency6__, __dependency7__, __exports__) {
    "use strict";
    var config = __dependency1__.config;
    var configure = __dependency1__.configure;
    var objectOrFunction = __dependency2__.objectOrFunction;
    var isFunction = __dependency2__.isFunction;
    var now = __dependency2__.now;
    var all = __dependency3__.all;
    var race = __dependency4__.race;
    var staticResolve = __dependency5__.resolve;
    var staticReject = __dependency6__.reject;
    var asap = __dependency7__.asap;
    var counter = 0;
    config.async = asap;
    function Promise(resolver) {
      if (!isFunction(resolver)) {
        throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
      }
      if (!(this instanceof Promise)) {
        throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
      }
      this._subscribers = [];
      invokeResolver(resolver, this);
    }
    function invokeResolver(resolver, promise) {
      function resolvePromise(value) {
        resolve(promise, value);
      }
      function rejectPromise(reason) {
        reject(promise, reason);
      }
      try {
        resolver(resolvePromise, rejectPromise);
      } catch (e) {
        rejectPromise(e);
      }
    }
    function invokeCallback(settled, promise, callback, detail) {
      var hasCallback = isFunction(callback),
          value,
          error,
          succeeded,
          failed;
      if (hasCallback) {
        try {
          value = callback(detail);
          succeeded = true;
        } catch (e) {
          failed = true;
          error = e;
        }
      } else {
        value = detail;
        succeeded = true;
      }
      if (handleThenable(promise, value)) {
        return ;
      } else if (hasCallback && succeeded) {
        resolve(promise, value);
      } else if (failed) {
        reject(promise, error);
      } else if (settled === FULFILLED) {
        resolve(promise, value);
      } else if (settled === REJECTED) {
        reject(promise, value);
      }
    }
    var PENDING = void 0;
    var SEALED = 0;
    var FULFILLED = 1;
    var REJECTED = 2;
    function subscribe(parent, child, onFulfillment, onRejection) {
      var subscribers = parent._subscribers;
      var length = subscribers.length;
      subscribers[length] = child;
      subscribers[length + FULFILLED] = onFulfillment;
      subscribers[length + REJECTED] = onRejection;
    }
    function publish(promise, settled) {
      var child,
          callback,
          subscribers = promise._subscribers,
          detail = promise._detail;
      for (var i = 0; i < subscribers.length; i += 3) {
        child = subscribers[i];
        callback = subscribers[i + settled];
        invokeCallback(settled, child, callback, detail);
      }
      promise._subscribers = null;
    }
    Promise.prototype = {
      constructor: Promise,
      _state: undefined,
      _detail: undefined,
      _subscribers: undefined,
      then: function(onFulfillment, onRejection) {
        var promise = this;
        var thenPromise = new this.constructor(function() {});
        if (this._state) {
          var callbacks = arguments;
          config.async(function invokePromiseCallback() {
            invokeCallback(promise._state, thenPromise, callbacks[promise._state - 1], promise._detail);
          });
        } else {
          subscribe(this, thenPromise, onFulfillment, onRejection);
        }
        return thenPromise;
      },
      'catch': function(onRejection) {
        return this.then(null, onRejection);
      }
    };
    Promise.all = all;
    Promise.race = race;
    Promise.resolve = staticResolve;
    Promise.reject = staticReject;
    function handleThenable(promise, value) {
      var then = null,
          resolved;
      try {
        if (promise === value) {
          throw new TypeError("A promises callback cannot return that same promise.");
        }
        if (objectOrFunction(value)) {
          then = value.then;
          if (isFunction(then)) {
            then.call(value, function(val) {
              if (resolved) {
                return true;
              }
              resolved = true;
              if (value !== val) {
                resolve(promise, val);
              } else {
                fulfill(promise, val);
              }
            }, function(val) {
              if (resolved) {
                return true;
              }
              resolved = true;
              reject(promise, val);
            });
            return true;
          }
        }
      } catch (error) {
        if (resolved) {
          return true;
        }
        reject(promise, error);
        return true;
      }
      return false;
    }
    function resolve(promise, value) {
      if (promise === value) {
        fulfill(promise, value);
      } else if (!handleThenable(promise, value)) {
        fulfill(promise, value);
      }
    }
    function fulfill(promise, value) {
      if (promise._state !== PENDING) {
        return ;
      }
      promise._state = SEALED;
      promise._detail = value;
      config.async(publishFulfillment, promise);
    }
    function reject(promise, reason) {
      if (promise._state !== PENDING) {
        return ;
      }
      promise._state = SEALED;
      promise._detail = reason;
      config.async(publishRejection, promise);
    }
    function publishFulfillment(promise) {
      publish(promise, promise._state = FULFILLED);
    }
    function publishRejection(promise) {
      publish(promise, promise._state = REJECTED);
    }
    __exports__.Promise = Promise;
  });
  define("promise/race", ["./utils", "exports"], function(__dependency1__, __exports__) {
    "use strict";
    var isArray = __dependency1__.isArray;
    function race(promises) {
      var Promise = this;
      if (!isArray(promises)) {
        throw new TypeError('You must pass an array to race.');
      }
      return new Promise(function(resolve, reject) {
        var results = [],
            promise;
        for (var i = 0; i < promises.length; i++) {
          promise = promises[i];
          if (promise && typeof promise.then === 'function') {
            promise.then(resolve, reject);
          } else {
            resolve(promise);
          }
        }
      });
    }
    __exports__.race = race;
  });
  define("promise/reject", ["exports"], function(__exports__) {
    "use strict";
    function reject(reason) {
      var Promise = this;
      return new Promise(function(resolve, reject) {
        reject(reason);
      });
    }
    __exports__.reject = reject;
  });
  define("promise/resolve", ["exports"], function(__exports__) {
    "use strict";
    function resolve(value) {
      if (value && typeof value === 'object' && value.constructor === this) {
        return value;
      }
      var Promise = this;
      return new Promise(function(resolve) {
        resolve(value);
      });
    }
    __exports__.resolve = resolve;
  });
  define("promise/utils", ["exports"], function(__exports__) {
    "use strict";
    function objectOrFunction(x) {
      return isFunction(x) || (typeof x === "object" && x !== null);
    }
    function isFunction(x) {
      return typeof x === "function";
    }
    function isArray(x) {
      return Object.prototype.toString.call(x) === "[object Array]";
    }
    var now = Date.now || function() {
      return new Date().getTime();
    };
    __exports__.objectOrFunction = objectOrFunction;
    __exports__.isFunction = isFunction;
    __exports__.isArray = isArray;
    __exports__.now = now;
  });
})(require("process"));