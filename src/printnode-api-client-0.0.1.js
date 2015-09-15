// Zero dependency - standalone PrintNode api client

// Browser support should be pretty good but testing on IE is limited at this point.
// JSON.parse and JSON.stringify are used which limits things it IE8+. You could
// use eval and uneval which should do it (or just import a backward shim).

// This is the very first release of the javascript client and this will soon undergo a lot of work
// Do not hotlink against this file, function signatures and the like are liable to change
// in future versions.

// Api coverage is currently limited to browsers,

var PrintNodeApi = (function() {
    "use strict";
    var JS_CLIENT_VERSION = '0.0.1';

    var hasOwnProperty = Object.prototype.hasOwnProperty,
        nativeForEach = Array.prototype.forEach;
    var _each = function (o, fn, ctx) {
        if (o === null) {
            return;
        }
        if (nativeForEach && o.forEach === nativeForEach) {
            o.forEach(fn, ctx);
        } else if (o.length === +o.length) {
            for (var i = 0, l = o.length; i < l; i++)
                if (i in o && fn.call(ctx, o[i], i, o) === undefined) {
                    return;
                }
        } else {
            for (var key in o) {
                if (hasOwnProperty.call(o, key)) {
                    if (fn.call(ctx, o[key], key, o) === undefined) {
                        return;
                    }
                }
            }
        }
    };
    var _extend = function (o) {
        _each(Array.prototype.slice.call(arguments, 1), function (a) {
            for (var p in a) if (a[p] !== void 0) {
                o[p] = a[p];
            }
        });
        return o;
    };

    // cross browser compatible XMLHttpRequest object generator
    var genXHR = (function(){
        var xhrs = [
           function () { return new XMLHttpRequest(); },
           function () { return new ActiveXObject("Microsoft.XMLHTTP"); },
           function () { return new ActiveXObject("MSXML2.XMLHTTP.3.0"); },
           function () { return new ActiveXObject("MSXML2.XMLHTTP"); }
        ];
        var _xhrf = null;
        return function () {
            if (_xhrf !== null) {
              return _xhrf();
            }
            for (var i = 0, l = xhrs.length; i < l; i++) {
                try {
                    var f = xhrs[i], req = f();
                    if (req !== null) {
                        _xhrf = f;
                        return req;
                    }
                } catch (e) {
                    continue;
                }
            }
            return function () { };
        };
    })();

    function parseResponseBody (xhr) {
        var contentTypeHeader = xhr.getResponseHeader("Content-Type");
        if (contentTypeHeader && "application/json" !== contentTypeHeader.split(";")[0]) {
            console.error("PrintNode Api shouldn't be returning anything but JSON", xhr);
        } else {
            return JSON.parse(xhr.responseText);
        }
    }

    function parseResponseHeaders (xhr) {
        var headerStr = xhr.getAllResponseHeaders();
        var headers = {};
        if (!headerStr) {
            return headers;
        }
        var headerPairs = headerStr.split('\u000d\u000a');
        for (var i = 0, ilen = headerPairs.length; i < ilen; i++) {
            var headerPair = headerPairs[i];
            var index = headerPair.indexOf('\u003a\u0020');
            if (index > 0) {
                var key = headerPair.substring(0, index);
                var val = headerPair.substring(index + 2);
                headers[key] = val;
            }
        }
        return headers;
    }

    function ajax (o, reqType, endpoint, postData, apiKey, that) {
        var xhr = genXHR(), timer, n = 0;
        var url = ['https://', o.server, '/', endpoint].join('');
        o = _extend({
            timeoutDuration: 3000
        }, o);
        if (o.timeoutDuration && o.timeout) {
            timer = setTimeout(
                function () {
                    xhr.onreadystatechange = function () {};
                    xhr.abort();
                    if (o.timeout) {
                        o.timeout.call(that, url, o.timeoutDuration);
                    }
                },
                o.timeoutDuration
            );
        }
        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4) {
                // clear the timeout
                if (timer) {
                    clearTimeout(timer);
                }
                var response = parseResponseBody(xhr);
                var headers = parseResponseHeaders(xhr);
                // console.log( "REV %s %s ", xhr.status, url, response, headers);
                // there shouldn't be any redirects from the printnode api so classify
                // 3xx as errors
                if (xhr.status < 300) {
                    if (o.success) {
                        o.success.call(that, response, headers, xhr);
                    }
                } else if (o.error) {
                    o.error.call(that, response, headers, xhr);
                }
                if (o.complete) {
                    o.complete.apply(that, xhr);
                }
            } else if (o.progress) {
                o.progress(++n);
            }
        };

        // build and make the request
        xhr.open(reqType, url);
        xhr.setRequestHeader("Authorization", "Basic " + btoa(apiKey));
        // xhr.setRequestHeader("X-Client", "printnode-javascript-client version; "+JS_CLIENT_VERSION)
        if (-1 !== ["POST", "PUT", "PATCH"].indexOf(reqType)) {
            xhr.setRequestHeader("Content-Type", "application/json");
            postData = JSON.stringify(postData);
        }
        xhr.send(postData);
        // console.log("REQ %s %s", o.type, url, postData);
    }

    /**
     * Takes options array {apiKey, version}
     */
    function ApiClient (options) {
        if (!options || !options.apiKey) {
            throw "options argument expected to be a object with property 'apiKey'";
        }
        this.options = _extend({
            version: null, // which defaults to latest - currently this isn't used
            server: 'api.printnode.com'
        }, options);
    }
    ApiClient.prototype.whoami = function getWhoami (options) {
        var merged = _extend(options, this.options);
        ajax(merged, 'GET', 'whoami', null, this.options.apiKey, options.context||this);
    };
    ApiClient.prototype.computers = function getComputers (options, params) {
        var merged = _extend(options, this.options);
        var url = 'computers';
        if (params && params.computerSet) {
            url += '/'+params.computerSet.toString();
        }
        ajax(merged, 'GET', url, null, this.options.apiKey, options.context||this);
    };
    ApiClient.prototype.printers = function getPrinters (options, params) {
        var merged = _extend(options, this.options);
        var url = 'printers';
        if (params) {
            if (params.computerSet) {
                url = 'computers/'+params.computerSet.toString()+'/printers';
            }
            if (params.printerSet) {
                url += '/'+params.printerSet.toString();
            }
        }
        ajax(merged, 'GET', url, null, this.options.apiKey, options.context||this);
    };
    ApiClient.prototype.printjob = function getPrinters (options, payload) {
        var merged = _extend(options, this.options);
        ajax(merged, 'POST', 'printjobs', payload, this.options.apiKey, options.context||this);
    };
    ApiClient.prototype.scales = function getScales (options, params) {
      var defaults = this.options;
      var url = 'computer/'+params.computerId.toString()+'/scales';
      if (params.deviceName) {
          url = 'computer/'+params.computerId.toString()+'/scales/'+params.deviceName.toString();
          if (params.deviceId) {
              url = 'computer/'+params.computerId.toString()+'/scale/'+params.deviceName.toString()+'/'+params.deviceId.toString();
              if (params.debug) {
                  // default timeoutDuration is increased as this is a long running request
                  defaults = _extend(defaults, {timeoutDuration: 15000});
                  url = 'debug/'+url;
              }
          }
      }
      var merged = _extend(options, defaults);
      ajax(merged, 'GET', url, null, this.options.apiKey, options.context||this);
    };

    return ApiClient;

})();
