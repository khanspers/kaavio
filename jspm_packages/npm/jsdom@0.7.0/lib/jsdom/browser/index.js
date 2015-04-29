/* */ 
(function(process) {
  var http = require("http"),
      URL = require("url"),
      HtmlToDom = require("./htmltodom").HtmlToDom,
      domToHtml = require("./domtohtml").domToHtml,
      htmlencoding = require("./htmlencoding"),
      HTMLEncode = htmlencoding.HTMLEncode,
      HTMLDecode = htmlencoding.HTMLDecode,
      jsdom = require("../../jsdom"),
      CSSStyleDeclaration = require("cssstyle").CSSStyleDeclaration,
      toFileUrl = require("../utils").toFileUrl,
      Contextify = null;
  try {
    Contextify = require("contextify");
  } catch (e) {
    Contextify = function(sandbox) {
      var vm = require("vm");
      var context = vm.createContext(sandbox);
      var global = null;
      sandbox.run = function(code, filename) {
        return vm.runInContext(code, context, filename);
      };
      sandbox.getGlobal = function() {
        if (!global) {
          global = vm.runInContext('this', context);
        }
        return global;
      };
      sandbox.dispose = function() {
        global = null;
        sandbox.run = function() {
          throw new Error("Called run() after dispose().");
        };
        sandbox.getGlobal = function() {
          throw new Error("Called getGlobal() after dispose().");
        };
        sandbox.dispose = function() {
          throw new Error("Called dispose() after dispose().");
        };
      };
      return sandbox;
    };
  }
  function NOT_IMPLEMENTED(target, nameForErrorMessage) {
    return function() {
      if (!jsdom.debugMode) {
        var raise = target ? target.raise : this.raise;
        raise.call(this, 'error', 'NOT IMPLEMENTED' + (nameForErrorMessage ? ': ' + nameForErrorMessage : ''));
      }
    };
  }
  function matchesDontThrow(el, selector) {
    try {
      return el.matchesSelector(selector);
    } catch (e) {
      return false;
    }
  }
  exports.windowAugmentation = function(dom, options) {
    options = options || {};
    var window = exports.createWindow(dom, options);
    if (!options.document) {
      var browser = browserAugmentation(dom, options);
      options.document = (browser.HTMLDocument) ? new browser.HTMLDocument(options) : new browser.Document(options);
      options.document.write('<html><head></head><body></body></html>');
    }
    var doc = window.document = options.document;
    if (doc.addEventListener) {
      if (doc.readyState == 'complete') {
        var ev = doc.createEvent('HTMLEvents');
        ev.initEvent('load', false, false);
        process.nextTick(function() {
          window.dispatchEvent(ev);
        });
      } else {
        doc.addEventListener('load', function(ev) {
          window.dispatchEvent(ev);
        });
      }
    }
    return window;
  };
  exports.createWindow = function(dom, options) {
    var timers = [];
    var cssSelectorSplitRE = /((?:[^,"']|"[^"]*"|'[^']*')+)/;
    function startTimer(startFn, stopFn, callback, ms) {
      var res = startFn(callback, ms);
      timers.push([res, stopFn]);
      return res;
    }
    function stopTimer(id) {
      if (typeof id === 'undefined') {
        return ;
      }
      for (var i in timers) {
        if (timers[i][0] === id) {
          timers[i][1].call(this, id);
          timers.splice(i, 1);
          break;
        }
      }
    }
    function stopAllTimers() {
      timers.forEach(function(t) {
        t[1].call(this, t[0]);
      });
      timers = [];
    }
    function DOMWindow(options) {
      var _href = (options || {}).url || toFileUrl(__filename);
      var _location = URL.parse(_href);
      this.location = {};
      this.location.reload = NOT_IMPLEMENTED(this, 'location.reload');
      var window = this.console._window = this;
      this.location.__defineGetter__("protocol", function() {
        return _location.protocol;
      });
      this.location.__defineGetter__("host", function() {
        return _location.host;
      });
      this.location.__defineGetter__("auth", function() {
        return _location.auth;
      });
      this.location.__defineGetter__("hostname", function() {
        return _location.hostname;
      });
      this.location.__defineGetter__("port", function() {
        return _location.port;
      });
      this.location.__defineGetter__("pathname", function() {
        return _location.pathname;
      });
      this.location.__defineGetter__("href", function() {
        return _location.href;
      });
      this.location.__defineSetter__("href", function(val) {
        var oldUrl = _location.href;
        var oldProtocol = _location.protocol;
        var oldHost = _location.host;
        var oldPathname = _location.pathname;
        var oldHash = _location.hash || "";
        _location = URL.parse(URL.resolve(oldUrl, val));
        var newUrl = _location.href;
        var newProtocol = _location.protocol;
        var newHost = _location.host;
        var newPathname = _location.pathname;
        var newHash = _location.hash || "";
        if (oldProtocol === newProtocol && oldHost === newHost && oldPathname === newPathname) {
          if (oldHash !== newHash && options && options.document) {
            var ev = options.document.createEvent('HTMLEvents');
            ev.initEvent('hashchange', false, false);
            ev.oldUrl = oldUrl;
            ev.newUrl = newUrl;
            process.nextTick(function() {
              window.dispatchEvent(ev);
            });
          }
        } else {
          NOT_IMPLEMENTED(this, 'location.href (no reload)')();
        }
      });
      this.location.__defineGetter__("hash", function() {
        return _location.hash || "";
      });
      this.location.__defineSetter__("hash", function(val) {
        var oldUrl = _location.href;
        var oldHash = _location.hash || "";
        if (val.lastIndexOf('#', 0) !== 0) {
          val = '#' + val;
        }
        _location = URL.parse(URL.resolve(oldUrl, val));
        var newUrl = _location.href;
        var newHash = _location.hash || "";
        if (oldHash !== newHash && options && options.document) {
          var ev = options.document.createEvent('HTMLEvents');
          ev.initEvent('hashchange', false, false);
          ev.oldUrl = oldUrl;
          ev.newUrl = newUrl;
          process.nextTick(function() {
            window.dispatchEvent(ev);
          });
        }
      });
      this.location.__defineGetter__("search", function() {
        return _location.search || "";
      });
      this.location.__defineSetter__("search", function(val) {
        var oldUrl = _location.href;
        var oldHash = _location.hash || "";
        if (val.length) {
          if (val.lastIndexOf('?', 0) !== 0) {
            val = '?' + val;
          }
          _location = URL.parse(URL.resolve(oldUrl, val + oldHash));
        } else {
          _location = URL.parse(oldUrl.replace(/\?([^#]+)/, ''));
        }
      });
      this.location.replace = function(val) {
        window.location.href = val;
      };
      this.location.toString = function() {
        return _location.href;
      };
      if (options && options.document) {
        options.document.location = this.location;
      }
      this.addEventListener = function() {
        dom.Node.prototype.addEventListener.apply(window, arguments);
      };
      this.removeEventListener = function() {
        dom.Node.prototype.removeEventListener.apply(window, arguments);
      };
      this.dispatchEvent = function() {
        dom.Node.prototype.dispatchEvent.apply(window, arguments);
      };
      this.raise = function() {
        dom.Node.prototype.raise.apply(window.document, arguments);
      };
      this.setTimeout = function(fn, ms) {
        return startTimer(setTimeout, clearTimeout, fn, ms);
      };
      this.setInterval = function(fn, ms) {
        return startTimer(setInterval, clearInterval, fn, ms);
      };
      this.clearInterval = stopTimer;
      this.clearTimeout = stopTimer;
      this.__stopAllTimers = stopAllTimers;
    }
    DOMWindow.prototype = {
      __proto__: dom,
      _length: 0,
      get length() {
        return this._length;
      },
      close: function() {
        var currentWindow = this;
        (function windowCleaner(window) {
          var i;
          if (window.length > 0) {
            for (i = 0; i < window.length; i++) {
              windowCleaner(window[i]);
            }
          }
          if (window !== currentWindow) {
            window.close();
          }
        })(this);
        if (this.document) {
          if (this.document.body) {
            this.document.body.innerHTML = "";
          }
          if (this.document.close) {
            this.document._listeners = [];
            this.document.close();
          }
          delete this.document;
        }
        stopAllTimers();
        this.dispose();
      },
      getComputedStyle: function(node) {
        var s = node.style,
            cs = new CSSStyleDeclaration(),
            forEach = Array.prototype.forEach;
        function setPropertiesFromRule(rule) {
          if (!rule.selectorText) {
            return ;
          }
          var selectors = rule.selectorText.split(cssSelectorSplitRE);
          var matched = false;
          selectors.forEach(function(selectorText) {
            if (selectorText !== '' && selectorText !== ',' && !matched && matchesDontThrow(node, selectorText)) {
              matched = true;
              forEach.call(rule.style, function(property) {
                cs.setProperty(property, rule.style.getPropertyValue(property), rule.style.getPropertyPriority(property));
              });
            }
          });
        }
        forEach.call(node.ownerDocument.styleSheets, function(sheet) {
          forEach.call(sheet.cssRules, function(rule) {
            if (rule.media) {
              if (Array.prototype.indexOf.call(rule.media, 'screen') !== -1) {
                forEach.call(rule.cssRules, setPropertiesFromRule);
              }
            } else {
              setPropertiesFromRule(rule);
            }
          });
        });
        forEach.call(s, function(property) {
          cs.setProperty(property, s.getPropertyValue(property), s.getPropertyPriority(property));
        });
        return cs;
      },
      console: {
        log: function(message) {
          this._window.raise('log', message);
        },
        info: function(message) {
          this._window.raise('info', message);
        },
        warn: function(message) {
          this._window.raise('warn', message);
        },
        error: function(message) {
          this._window.raise('error', message);
        }
      },
      navigator: {
        userAgent: 'Node.js (' + process.platform + '; U; rv:' + process.version + ')',
        appName: 'Node.js jsDom',
        platform: process.platform,
        appVersion: process.version
      },
      XMLHttpRequest: function XMLHttpRequest() {},
      name: 'nodejs',
      innerWidth: 1024,
      innerHeight: 768,
      outerWidth: 1024,
      outerHeight: 768,
      pageXOffset: 0,
      pageYOffset: 0,
      screenX: 0,
      screenY: 0,
      screenLeft: 0,
      screenTop: 0,
      scrollX: 0,
      scrollY: 0,
      scrollTop: 0,
      scrollLeft: 0,
      alert: NOT_IMPLEMENTED(null, 'window.alert'),
      blur: NOT_IMPLEMENTED(null, 'window.blur'),
      confirm: NOT_IMPLEMENTED(null, 'window.confirm'),
      createPopup: NOT_IMPLEMENTED(null, 'window.createPopup'),
      focus: NOT_IMPLEMENTED(null, 'window.focus'),
      moveBy: NOT_IMPLEMENTED(null, 'window.moveBy'),
      moveTo: NOT_IMPLEMENTED(null, 'window.moveTo'),
      open: NOT_IMPLEMENTED(null, 'window.open'),
      print: NOT_IMPLEMENTED(null, 'window.print'),
      prompt: NOT_IMPLEMENTED(null, 'window.prompt'),
      resizeBy: NOT_IMPLEMENTED(null, 'window.resizeBy'),
      resizeTo: NOT_IMPLEMENTED(null, 'window.resizeTo'),
      scroll: NOT_IMPLEMENTED(null, 'window.scroll'),
      scrollBy: NOT_IMPLEMENTED(null, 'window.scrollBy'),
      scrollTo: NOT_IMPLEMENTED(null, 'window.scrollTo'),
      screen: {
        width: 0,
        height: 0
      },
      Image: NOT_IMPLEMENTED(null, 'window.Image')
    };
    var window = new DOMWindow(options);
    Contextify(window);
    var global = window.getGlobal();
    window.window = window.frames = window.self = window.parent = window.top = global;
    return window;
  };
  var defaultParser = null;
  var getDefaultParser = exports.getDefaultParser = function() {
    if (defaultParser === null) {
      defaultParser = require("htmlparser2");
    }
    return defaultParser;
  };
  exports.setDefaultParser = function(parser) {
    if (typeof parser == 'object') {
      defaultParser = parser;
    } else if (typeof parser == 'string')
      defaultParser = require(parser);
  };
  var browserAugmentation = exports.browserAugmentation = function(dom, options) {
    if (!options) {
      options = {};
    }
    var parser = options.parser || getDefaultParser();
    if (dom._augmented && dom._parser === parser) {
      return dom;
    }
    dom._parser = parser;
    var htmltodom = new HtmlToDom(parser);
    if (!dom.HTMLDocument) {
      dom.HTMLDocument = dom.Document;
    }
    if (!dom.HTMLDocument.prototype.write) {
      dom.HTMLDocument.prototype.write = function(html) {
        this.innerHTML = html;
      };
    }
    dom.Element.prototype.getElementsByClassName = function(className) {
      function filterByClassName(child) {
        if (!child) {
          return false;
        }
        if (child.nodeType && child.nodeType === dom.Node.ENTITY_REFERENCE_NODE) {
          child = child._entity;
        }
        var classString = child.className;
        if (classString) {
          var s = classString.split(" ");
          for (var i = 0; i < s.length; i++) {
            if (s[i] === className) {
              return true;
            }
          }
        }
        return false;
      }
      return new dom.NodeList(this.ownerDocument || this, dom.mapper(this, filterByClassName));
    };
    dom.Element.prototype.__defineGetter__('sourceIndex', function() {
      var items = this.ownerDocument.getElementsByTagName('*'),
          len = items.length;
      for (var i = 0; i < len; i++) {
        if (items[i] === this) {
          return i;
        }
      }
    });
    dom.Document.prototype.__defineGetter__('outerHTML', function() {
      return domToHtml(this, true);
    });
    dom.Element.prototype.__defineGetter__('outerHTML', function() {
      return domToHtml(this, true);
    });
    dom.Element.prototype.__defineGetter__('innerHTML', function() {
      if (/^(?:script|style)$/.test(this._tagName)) {
        var type = this.getAttribute('type');
        if (!type || /^text\//i.test(type) || /\/javascript$/i.test(type)) {
          return domToHtml(this._childNodes, true, true);
        }
      }
      return domToHtml(this._childNodes, true);
    });
    dom.Element.prototype.__defineSetter__('doctype', function() {
      throw new dom.DOMException(dom.NO_MODIFICATION_ALLOWED_ERR);
    });
    dom.Element.prototype.__defineGetter__('doctype', function() {
      var r = null;
      if (this.nodeName == '#document') {
        if (this._doctype) {
          r = this._doctype;
        }
      }
      return r;
    });
    dom.Element.prototype.__defineSetter__('innerHTML', function(html) {
      var child;
      while ((child = this._childNodes[0])) {
        this.removeChild(child);
      }
      if (this.nodeName === '#document') {
        parseDocType(this, html);
      }
      if (html !== "" && html != null) {
        htmltodom.appendHtmlToElement(html, this);
      }
      return html;
    });
    dom.Document.prototype.__defineGetter__('innerHTML', function() {
      return domToHtml(this._childNodes, true);
    });
    dom.Document.prototype.__defineSetter__('innerHTML', function(html) {
      var child;
      while ((child = this._childNodes[0])) {
        this.removeChild(child);
      }
      if (this.nodeName === '#document') {
        parseDocType(this, html);
      }
      if (html !== "" && html != null) {
        htmltodom.appendHtmlToElement(html, this);
      }
      return html;
    });
    var DOC_HTML5 = /<!doctype html>/i,
        DOC_TYPE = /<!DOCTYPE (\w(.|\n)*)">/i,
        DOC_TYPE_START = '<!DOCTYPE ',
        DOC_TYPE_END = '">';
    function parseDocType(doc, html) {
      var publicID = '',
          systemID = '',
          fullDT = '',
          name = 'HTML',
          set = true,
          doctype = html.match(DOC_HTML5);
      doc._doctype = null;
      if (doctype && doctype[0]) {
        fullDT = doctype[0];
      } else {
        var start = html.indexOf(DOC_TYPE_START),
            end = html.indexOf(DOC_TYPE_END),
            docString;
        if (start < 0 || end < 0) {
          return ;
        }
        docString = html.substr(start, (end - start) + DOC_TYPE_END.length);
        doctype = docString.replace(/[\n\r]/g, '').match(DOC_TYPE);
        if (!doctype) {
          return ;
        }
        fullDT = doctype[0];
        doctype = doctype[1].split(' "');
        var _id1 = doctype.length ? doctype.pop().replace(/"/g, '') : '',
            _id2 = doctype.length ? doctype.pop().replace(/"/g, '') : '';
        if (_id1.indexOf('-//') !== -1) {
          publicID = _id1;
        }
        if (_id2.indexOf('-//') !== -1) {
          publicID = _id2;
        }
        if (_id1.indexOf('://') !== -1) {
          systemID = _id1;
        }
        if (_id2.indexOf('://') !== -1) {
          systemID = _id2;
        }
        if (doctype.length) {
          doctype = doctype[0].split(' ');
          name = doctype[0].toUpperCase();
        }
      }
      doc._doctype = new dom.DOMImplementation().createDocumentType(name, publicID, systemID);
      doc._doctype._ownerDocument = doc;
      doc._doctype._fullDT = fullDT;
      doc._doctype.toString = function() {
        return this._fullDT;
      };
    }
    dom.Document.prototype.getElementsByClassName = function(className) {
      function filterByClassName(child) {
        if (!child) {
          return false;
        }
        if (child.nodeType && child.nodeType === dom.Node.ENTITY_REFERENCE_NODE) {
          child = child._entity;
        }
        var classString = child.className;
        if (classString) {
          var s = classString.split(" ");
          for (var i = 0; i < s.length; i++) {
            if (s[i] === className) {
              return true;
            }
          }
        }
        return false;
      }
      return new dom.NodeList(this.ownerDocument || this, dom.mapper(this, filterByClassName));
    };
    dom.Element.prototype.__defineGetter__('nodeName', function(val) {
      return this._nodeName.toUpperCase();
    });
    dom.Element.prototype.__defineGetter__('tagName', function(val) {
      var t = this._tagName.toUpperCase();
      if (this.nodeName === '#document') {
        t = null;
      }
      return t;
    });
    dom.Element.prototype.scrollTop = 0;
    dom.Element.prototype.scrollLeft = 0;
    dom.Document.prototype.__defineGetter__('parentWindow', function() {
      if (!this._parentWindow) {
        this.parentWindow = exports.windowAugmentation(dom, {
          document: this,
          url: this.URL
        });
      }
      return this._parentWindow;
    });
    dom.Document.prototype.__defineSetter__('parentWindow', function(window) {
      window._frame = function(name, frame) {
        if (typeof frame === 'undefined') {
          delete window[name];
        } else {
          window.__defineGetter__(name, function() {
            return frame.contentWindow;
          });
        }
      };
      this._parentWindow = window.getGlobal();
    });
    dom.Document.prototype.__defineGetter__('defaultView', function() {
      return this.parentWindow;
    });
    dom._augmented = true;
    return dom;
  };
})(require("process"));