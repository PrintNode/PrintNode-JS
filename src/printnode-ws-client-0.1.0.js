var PrintNode = (function () {
    "use strict";

    var VERSION = '0.1.0';

    function noop () {}

    // util fn's
    var console = window.console || {log: noop, error: noop};
    var hasOwnProperty = Object.prototype.hasOwnProperty,
        nativeForEach = Array.prototype.forEach;

    var _each = function (o, fn, ctx) {
        if (o === null) {
            return;
        }
        if (nativeForEach && o.forEach === nativeForEach) {
            o.forEach(fn, ctx);
        } else if (o.length === +o.length) {
            for (var i = 0, l = o.length; i < l; i++) {
                if (i in o && undefined === fn.call(ctx, o[i], i, o)) {
                    return;
                }
            }
        } else {
            for (var key in o) {
                if (hasOwnProperty.call(o, key)) {
                    if (undefined === fn.call(ctx, o[key], key, o)) {
                        return;
                    }
                }
            }
        }
    };

    // shallow extend a object
    var _extend = function (o) {
        _each(Array.prototype.slice.call(arguments, 1), function (a) {
            for (var p in a) {
                if (undefined !== a[p]) {
                    o[p] = a[p];
                }
            }
        });
        return o;
    };

    var _isArray = Array.isArray || function (obj) {
        return '[object Array]' === Object.prototype.toString.call(obj);
    };

    var _isFunction = function (obj) {
        return 'function' === typeof obj || false;
    };

    var _isString = function (obj) {
        return 'string' === typeof obj || false;
    };

    var _isBool = function (obj) {
        // intentionally not counting new Boolean() as a 'bool', it's suicidal to use
        return true === obj || false === obj;
    };

    var _isInt = function (obj) {
        return parseInt(obj, 10) === obj;
    };

    var _isObject = function (obj) {
        return 'object' === typeof obj;
    };

    // return true if fn(obj) returns true for every element in obj
    var _all = function (obj, fn) {
        for (var i=0, l=obj.length; i<l; i++) {
            if (!fn(obj[i])) {
                return false;
            }
        }
        return true;
    };

    // object-has-keys check, keys must be a array
    // A heads up; {something: undefined} == {}. This is intentional
    var _hasKeys = function (obj, keys) {
        for (var i=0, l=keys.length; i<l; i++) {
            if (undefined === obj[keys[i]]) {
                return false;
            }
        }
        return true;
    };

    // a ok-ish v4 uuid generator
    // clearly not cryptographically secure
    // function uuid_v4 () {
    //     var dte = new Date().getTime();
    //     var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    //         var r = (dte + Math.random()*16)%16 | 0;
    //         dte = Math.floor(dte/16);
    //         return (c=='x' ? r : (r&0x3|0x8)).toString(16);
    //     });
    //     return uuid;
    // }

    var removeElementFromArray = function (arr, element) {
        // IE8+ supported only (but this doesn't matter because... WebSocket)
        if (-1 === arr.indexOf(element)) {
            return arr;
        }
        // don't use Array.slice here, element could appear multiple times
        // remove all occurances
        var output = [], i = 0, l = arr.length;
        for ( ; i<l; i++) {
            if (element !== arr[i]) {
                output.push(arr[i]);
            }
        }
        return output;
    };

    // a micro hierarchical pubsub implementation
    function publify (obj, errorCallback) {
        if (obj.publish || obj.subscribe) {
            throw "publify can't operate on this object there's a collision with existing obj properties";
        }
        // subscriber list
        var subscribers = {};
        // publish
        obj.publish = function publish (topic, payload, publishErrorCallback) {
            publishErrorCallback = publishErrorCallback || errorCallback;
            var hierarchy = publify.topicExplodeHierarchy(topic);
            var subscriptions = publify.getSubscribersFromTopicHierarchy(hierarchy, subscribers);
            // call each subscription
            _each(subscriptions, function(sub) {
                var detail = {
                    "subscription": topic,
                    "originalSubscription": sub[0],
                    "payload": payload,
                    "data": sub[1].data
                };

                try {
                    sub[1].fn.call(sub[1].context, payload, detail);
                } catch (e) {
                    // add in the detail of the error
                    detail.exception = e;
                    detail.fn = sub[1].fn;
                    detail.context = sub[1].context;
                    // trip error callback
                    publishErrorCallback(
                        new PN_Error("RunTime", "Exception thrown in subscription callback - "+e.toString()),
                        detail
                    );
                }
            });
        };
        // subscribe
        obj.subscribe = function subscribe (topic, fn, options) {
            // allowed to subscribe on a array of strings
            if (_isArray(topic)) {
                if (!_all(topic, _isString)) {
                    throw "subscription topic is a array but not a array of strings";
                }
                // IE9+ only
                topic = topic.map(publify.escapeTopicFragment).join('.');
            // string check
            } else if (!_isString(topic)) {
                throw "subscription topic must either be a string or a array of strings";
            }

            if (!_isFunction(fn)) {
                throw "subscription call backs must be functions";
            }
            options = options || {};
            var sub = {
                fn: fn,
                data: options.data || null,
                context: options.context || obj
            };
            if (undefined === subscribers[topic]) {
                subscribers[topic] = [sub];
            } else {
                subscribers[topic].push(sub);
            }
            return this;
        };
        // unsubscribe
        obj.unsubscribe = function unsubscribe (fnOrTopic) {
            var ret = 0;
            if (_isString(fnOrTopic)) {
                if (undefined !== subscribers[fnOrTopic]) {
                    ret = subscribers[fnOrTopic].length;
                    delete subscribers[fnOrTopic];
                }
            } else if (_isFunction(fnOrTopic)) {
                // Iterate subscriptions and compare subscription funcs. This is
                // a bit of a mess as removing from arrays being iterated is fiddly.
                var topic, current, topicsToRemove = [], numRemoved;
                for (topic in subscribers) {
                    current = removeElementFromArray(subscribers[topic]);
                    numRemoved = subscribers[topic].length - current.length;
                    ret += numRemoved;
                    if (0 === current.length) {
                        topicsToRemove.push(topic);
                    } else if (numRemoved) {
                        subscribers[topic] = current;
                    }
                }
                // remove empty subscription
                _each(topicsToRemove, function (topic) {
                    delete subscribers[topic];
                });
            } else {
                throw "you can only unsubscribe strings or functions";
            }
            return ret;
        };
        return obj.publish;
    }
    // expode a topic into all it's hierarchical components
    publify.topicExplodeHierarchy = function (topic) {
        var output, topicComponents;
        if (_isArray(topic)) {
            if (!_all(topic, _isString)) {
                throw "subscription topic is a array but not a array of strings";
            }
            topicComponents = topic;

        } else if (_isString(topic)) {
            topicComponents = publify.topicExplodeFragments(topic);
        } else {
            throw "you can only publish string or array topics";
        }
        output = [
            publify.escapeTopicFragment(topicComponents[0])
        ];
        for (var i=1, l=topicComponents.length; i<l; i++) {
            output[i] = output[i-1]+'.'+publify.escapeTopicFragment(topicComponents[i]);
        }
        return output;
    };
    // get all subscribers from a topic list
    publify.getSubscribersFromTopicHierarchy = function (hierarchy, subscribers) {
        var output = [];
        _each(hierarchy, function (topic) {
            var subscriptions = subscribers[topic];
            if (!subscriptions) {
                return;
            }
            for (var i=0, l=subscriptions.length; i<l; i++) {
                output.push([topic, subscriptions[i]]);
            }
        });
        return output;
    };
    // escape a topic fragment
    publify.escapeTopicFragment = function (input) {
        return input.replace(/\\/g, '\\\\').replace(/\./g, '\\.');
    };
    // split a topic into fragments (escaping aware)
    publify.topicExplodeFragments = function (input) {
        var output = [''], outputIndex = 0, i=0, l = input.length, escaped = false, current;
        // iterate string and parse
        for (; i<l; i++) {
            current = input.charAt(i);
            // previous char was escaped
            if (escaped) {
                output[outputIndex] += current;
                escaped = false;
            // hit escaped char
            } else if ('\\' === current) {
                escaped = true;
            // separator
            } else if ('.' === current) {
                output[++outputIndex] = '';
            // vanilla char
            } else {
                output[outputIndex] += current;
            }
        }
        // drop trailing escape chars
        return output;
    };

    // PrintNode WS API fn's
    function PN_WebSocketMessage (data) {
        try {
            data = JSON.parse(data);
        } catch (e) {
            throw new PN_Error("Server", "server->client message not valid javascript");
        }
        // is array, length 3
        if (!_isArray(data) || 3 !== data.length) {
            throw new PN_Error("Server", "server->client message framing error");
        }
        this.typ = data[0];
        this.message = data[1];
        this.payload = data[2];
    }

    function PN_Error (code, message) {
        if (!PN_Error.CODES[code]) {
            throw "unknown error code '"+code+"'";
        }
        this.code = code;
        this.message = message || PN_Error.CODES[code];
    }
    PN_Error.prototype.toString = function () {
        return "PrintNode " + this.code + ' exception: ' + this.message;
    };
    PN_Error.CODES = {
        // quote keys to prevent the minifiers rewriting objects
        "NotSupported": "This feature isn't supported",
        "BadArguments": "Bad arguments passed",
        "Server": "Server error",
        "Socket": "Socket error",
        "RateLimit": "Rate limit error",
        "Internal": "Internal error",
        "RunTime": "RunTime"
    };

    // Generate send function which (optionally) can handle reciept
    // acknowledgements and timeouts. Any errors trip errCallback.
    // This won't trigger exceptions unless thrown by errCallback
    function getWSSendFn (soc, defaultAck, ackTimeout, errCallback, logSend) {

        // ack implementation
        var ackHistory = {};
        var msgCount = 0;

        // cleanup all the remaining ack timers
        send.shutdown = function () {
            for (var key in ackHistory) {
                clearTimeout(ackHistory[key][0]);
            }
            ackHistory = {};
        };

        function send (message, payload, ack) {
            var ackKey, ackSource = (undefined === ack ? defaultAck : ack);
            var when = Date.now();
            msgCount++;
            // handle message timeouts, specifically detect slow servers
            // so app layer can choose what to do
            if (ackSource) {
                ack = msgCount;
                ackKey = msgCount.toString();
                ackHistory[ackKey] = [
                    setTimeout(
                        function () {
                            var timeoutDuration = Date.now() - when;
                            errCallback(
                                new PN_Error("Server", "No ack recieved"),
                                {
                                    timeout: true,
                                    timeoutDuration: timeoutDuration,
                                    message: message,
                                    payload: payload
                                }
                            );
                        },
                        ackTimeout
                    ),
                    when
                ];
            } else {
                ack = null;
            }

            var data;
            // you'd be doing something pretty exotic to trip this
            try {
                data = JSON.stringify([ack, message, payload]);
            } catch (err) {
                errCallback(
                    new PN_Error("BadArguments", "Not possible to JSON encode all message arguments"),
                    {
                        timeout: false,
                        message: message,
                        payload: payload
                    }
                );
                return false;
            }
            // try the send, likely failure mode for this is the socket isn't open
            // https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
            try {
                soc.send(data);
            } catch (err) {
                errCallback(
                    new PN_Error("Socket", "Send failed. It is likely the socket isn't open"),
                    {
                        timeout: false,
                        message: message,
                        payload: payload
                    }
                );
                return false;
            }
            logSend(data);
            return true;
        }

        // benchmark info, because...
        var ackDurations = []; // rotating buffer of the last n timings
        var ackDurationsMaxSize = 50;

        // clear the timeout for a message
        send.ack = function (ackKey) {
            ackKey = ackKey.toString();
            var ack = ackHistory[ackKey];
            delete ackHistory[ackKey];

            if (undefined === ack) {
                errCallback(
                    new PN_Error("Server", "Unexpected ack recieved; either this message didn't request a ack or we've already recieved it."),
                    {timeout: false}
                );
                return;
            }
            clearTimeout(ack[0]);

            // benchmarking
            ackDurations.push(Date.now() - ack[1]);
            if (ackDurations.length > ackDurationsMaxSize) {
                ackDurations.shift();
            }
        };

        send.getNumMessages = function () {
            return msgCount;
        };

        send.getDebugInfo = function () {
            var totalDuration = 0, i = 0, l = ackDurations.length;
            for (; i<l; i++) {
                totalDuration += ackDurations[i];
            }
            return {
                numMessages: msgCount,
                meanAck: totalDuration > 0 ? parseInt(totalDuration / l, 10) : 0,
                accDurations: ackDurations
            };
        };

        return send;
    }

    // safe socket closure
    function getWSClose (soc, shutdown) {
        return function () {
            shutdown();
            try {
                soc.close();
            } catch (err) {
                // Apparently this should never happen; docs say websockets are
                // safe for multiple disconnections. They're wrong.
                console.log("failed to close socket", err);
                return false;
            }
            return true;
        };
    }

    function webSocketGetUrl (options) {
        return [
            options.scheme,
            '://',
            options.server,
            '/ws/',
            options.version
        ].join('');
    }

    // Subscription management
    function SocketSubscriptions (maxSubscriptions) {
        // Attempting to increase this here won't have any effect.
        // Authorative check is done on the server.
        // In the event this is bypassed the server will respond with
        // disconnection and will tag this account/client IP address as abusive.
        this.maxSubscriptions = maxSubscriptions;

        this.subscriptions = {};
        // perhaps swap out with Object.keys(this.subscriptions).length if don't
        // care about IE
        this.subscriptionCount = 0;

        // get a new subscriptionId
        this.getSubscriptionId = (function () {
            var id = 0;
            return function () {
                return id++;
            };
        })();
    }
    SocketSubscriptions.prototype.add = function (path, callback, ctx, handler, additionalTopics) {
        if (!_isFunction(callback)) {
            throw new PN_Error("BadArguments", "Subscription callback must be a function if is defined.");
        }
        if (!_isFunction(handler)) {
            throw new PN_Error("Internal", "Subscription handler must be a function.");
        }
        if (!_isArray(additionalTopics)) {
            throw new PN_Error("Internal", "Additional topics must be a array.");
        }
        if (this.subscriptionCount === this.maxSubscriptions) {
            throw new PN_Error("RunTime", "Max number of subscriptions reached; unable to add more.");
        }
        // check we've not already got one of these subscriptions
        _each(this.subscriptions, function (existingSub) {
            if (path === existingSub) {
                throw new PN_Error("BadArguments", "Subscription '"+path+"' already added.");
            }
        });
        // lets add it
        var newSubId = this.getSubscriptionId();
        this.subscriptionCount++;
        this.subscriptions[newSubId] = [newSubId, path, callback, ctx, handler, additionalTopics];
        return newSubId;
    };
    // remove a subcription by string, id or callback
    SocketSubscriptions.prototype.remove = function (arg) {
        var toDelete = [], check, key;
        // how are we looking up the delete
        if (_isInt(arg)) {
            check = function (sub) { return sub[0] === arg; };
        } else if (_isString(arg)) {
            check = function (sub) { return sub[1] === arg; };
        } else if (_isFunction(arg)) {
            check = function (sub) { return sub[2] === arg; };
        } else if (undefined === arg) {
            check = function () { return true; };
        } else {
            throw new PN_Error("BadArguments", "Can only remove subscription by id, path or callback.");
        }
        // what are we going to delete
        for (key in this.subscriptions) {
            if (check(this.subscriptions[key])) {
                toDelete.push(this.subscriptions[key][0]);
            }
        }
        // do the delete
        _each(toDelete, function (sub) {
            delete this.subscriptions[sub];
        }, this);
        // return what we've deleted
        return toDelete;
    };
    // trigger a subscription
    SocketSubscriptions.prototype.trigger = function (id, payload, errorCallback) {
        var sub = this.subscriptions[id];
        if (undefined === sub) {
            // You might consider this a error but there's a nasty race condition
            // where you unsubscribe (which is asyncronous) but before this is processed
            // another event comes in from the server.
            //
            // I don't feel this is fixed by prosponing deletes until server has
            // confirmed deletion because
            //     1. Volates 'principle of least surprise'. Callbacks will still fire after unsubscribing.
            //     2. This is only a problem if the PN server is bugged; which it isn't :)
            return false;
        }
        var path = sub[1], fn = sub[2], ctx = (sub[3] || path), handler = sub[4], additionalTopics = sub[5];
        var detail = {id: id, path: path};

        var handledPayload;
        try {
            handledPayload = handler(payload);
        } catch (e) {
            handledPayload = payload;
        }

        try {
            fn.call(ctx, handledPayload, detail);
        } catch (e) {
            // add in the detail of the error
            detail.exception = e;
            detail.fn = fn;
            detail.context = ctx;
            // trip error callback
            errorCallback(
                new PN_Error("RunTime", "Exception thrown in subscription callback - "+e.toString()),
                detail
            );
        }
        // return
        return {
            payload: handledPayload,
            additionalTopics: additionalTopics
        };
    };

    // A wrapper for the returned scale measurement object
    // Allows calling code to do instanceof tests and add additional methods to prototype
    function ScalesMeasurement (data) {
        for (var key in data) {
            this[key] = data[key];
        }
    }
    ScalesMeasurement.prototype.getLatency = function () {
        var client = new Date(this.clientReportedCreateTimestamp), now = new Date();
        return now.getTime() - client.getTime();
    };
    ScalesMeasurement.factory = function (data) {
        return new ScalesMeasurement(data);
    };

    // used by both the sca
    function generateScalesUrlFromOptions (options, allowNoOptions) {
        // shallow copy original object and escape values
        var encodedOptions = {}, keys = [], key, path;
        for (key in options) {
            encodedOptions[key] = encodeURIComponent(options[key]);
            keys.push(key);
        }
        // build up the path obj
        if (0 === keys.length && allowNoOptions) {
            path = ['scales'];
        } else if (_hasKeys(encodedOptions, ['computerId', 'deviceName', 'deviceNum'])) {
            path = ['computer', encodedOptions.computerId, 'scale', encodedOptions.deviceName, encodedOptions.deviceNum];
        } else if (_hasKeys(encodedOptions, ['computerId', 'deviceName'])) {
            path = ['computer', encodedOptions.computerId, 'scales', encodedOptions.deviceName];
        } else if (_hasKeys(encodedOptions, ['computerId'])) {
            path = ['computer', encodedOptions.computerId, 'scales'];
        // unknown options combination
        } else {
            // determine the options combination
            throw new PN_Error("RunTime", "Options key combination (" + keys.join(', ') + ") for getting scales data; please refer to documentation.");
        }
        return path.join('/');
    }

    // have decided to go with a pubsub implementation
    function PN_WebSocket (options, authCallback, errorCallback) {

        if (!PN_WebSocket.isSupported()) {
            throw new PN_Error("NotSupported", "Native WebSocker support is missing");
        }
        if (authCallback && !_isFunction(authCallback)) {
            throw new PN_Error("BadArguments", "If set the authCallback argument should be a function");
        }
        if (errorCallback && !_isFunction(errorCallback)) {
            throw new PN_Error("BadArguments", "If set the errorCallback argument should be a function");
        }
        if (!options || !options.apiKey) {
            throw new PN_Error("BadArguments", "Options argument expected to be a object with property 'apiKey'");
        }
        if (undefined !== options.ack && !_isBool(options.ack)) {
            throw new PN_Error("BadArguments", "options.ack should be literal boolean");
        }
        if (undefined !== options.ackTimeout && !_isInt(options.ackTimeout)) {
            throw new PN_Error("BadArguments", "options.ackTimeout should be a int");
        }
        if (undefined !== options.authTimeout && !_isInt(options.authTimeout)) {
            throw new PN_Error("BadArguments", "options.authTimeout should be a int");
        }

        options = _extend(
            {
                version: VERSION, // default to latest
                server: 'api.printnode.com',
                scheme: 'wss',
                ack: false,
                ackTimeout: 10000,
                authTimeout: 5000
            },
            options
        );

        // scope accessor - terser than Function.prototype.bind and it's
        // only used in a couple of place if we decide to replace...
        var that = this;
        // variable declarations
        var subscriptions, soc, send, close;
        // make this object pub/sub capable
        var publish = publify(this, failHandler);
        // oother declarations
        var state = 'NOT_STARTED';
        var isConnected = false;

        function setState (newState) {
            state = newState;
            publish('system.state.'+state, state);
        }
        this.getState = function () {
            return state;
        };
        this.isConnected = function () {
            return isConnected;
        };

        // finalHandler
        function failHandler () {
            // try cleanup the socket, we're outa here
            close();
            // authenticationTimout is no longer needed
            if (authenticateTimeout.timeout) {
                clearTimeout(authenticateTimeout.timeout);
            }
            // call the error handler
            var args = Array.prototype.slice.call(arguments);
            if (errorCallback) {
                errorCallback.apply(that, args);
            }
            // unpack args
            if (1 === args.length) {
                args = args[0];
            }
            publish(["error"], args, function () {
                console.error("error in error callback", args);
            });
        }

        // Decision/Decree. A failed authenticate shouldn't trip the error handler.
        // This fires in the event of network, server or logic errors
        function authenticateResponse (payload) {
            clearTimeout(authenticateTimeout.timeout);
            // not authed
            if (!!payload.error) {
                setState('UNAUTHENTICATED');
                publish('authenticate.error', payload);
                close();
            // authed
            } else {
                setState('AUTHENTICATED');
                subscriptions = new SocketSubscriptions(payload.maxSubscriptions);
                publish('authenticate.ok', payload);
            }
            // callback?
            if (authCallback) {
                try {
                    authCallback.call(that, payload);
                } catch (e) {
                    failHandler("Exception thrown in authentication callback:", e);
                }
            }
        }

        function authenticateTimeout () {
            setState('UNAUTHENTICATED');
            var payload = {timeout: true, error: "Server timed out"};
            publish('authenticate.error', payload);
            if (authCallback) {
                try {
                    authCallback.call(that, payload);
                } catch (e) {
                    failHandler("Exception thrown in authentication callback:", e);
                }
            }
            // wrap this up
            failHandler(
                new PN_Error('Server', 'Server failed to authenticate in time'),
                payload
            );
        }

        // internal protocol level messages
        function onopen (evt) {
            isConnected = true;
            authenticateTimeout.timeout = setTimeout(
                authenticateTimeout,
                options.authTimeout
            );
            setState('AUTHENTICATING');
            publish('system.socket.open', evt);
            send('authenticate', {apiKey: options.apiKey}, true);
        }

        function onclose (evt) {
            isConnected = false;
            publish('system.socket.close', evt);
            setState('DISCONNECTED');
        }

        function onerror(evt) {
            publish('system.socket.error', evt);
            failHandler(
                new PN_Error('Socket'),
                {socket: true, socketError: evt}
            );
        }

        function onmessage(evt) {
            var message;
            publish('system.socket.message', evt);
            // validate server message
            try {
                message = new PN_WebSocketMessage(evt.data);
            } catch (err) {
                failHandler(err, {timeout: false, data: evt.data});
                return;
            }
            // handle all the different message
            switch (message.typ) {
                case 'system':
                    switch (message.message) {
                        case 'authenticateResponse':
                            authenticateResponse(message.payload);
                            break;
                        case 'hi':
                            isConnected = message.payload;
                            break;
                        case 'rateLimit':
                            failHandler(
                                new PN_Error("RateLimit", "PrintNode is applying rate limits"),
                                message.payload
                            );
                            break;
                        default:
                            console.log("unhandled system message", message, message.payload);
                            break;
                    }
                    break;
                case 'protocol':
                    switch (message.message) {
                        case 'ack':
                            send.ack(message.payload);
                            break;
                        default:
                            console.log("unhandled protocol message", message, message.payload);
                            break;
                    }
                    break;
                case 'publish':
                    var topics = message.message, subId = message.payload[0], payload;
                    // trip subscription callback
                    payload = subscriptions.trigger(subId, message.payload[1], failHandler);
                    // check to see if the subscription has been removed before publishing it
                    if (false !== payload) {
                        // publisg this topic
                        var pub = function (topic) {
                            publish(topic, payload.payload);
                        };
                        // publish on additionalTopics
                        _each(payload.additionalTopics, pub); // subscription topic list
                        _each(topics, pub); // server produced topic list
                    }
                    break;
                default:
                    console.log("unhandled message type", message, message.payload);
                    break;
            }
        }

        // startup the websocket and wire it up
        soc = new WebSocket(webSocketGetUrl(options));
        soc.onopen = onopen;
        soc.onclose = onclose;
        soc.onerror = onerror;
        soc.onmessage = onmessage;

        function logSend (data) {
            publish('system.socket.sent', data);
        }

        // socket wrapper methods
        send = getWSSendFn(soc, options.ack, options.ackTimeout, failHandler, logSend);
        close = getWSClose(soc, send.shutdown);

        // subscription management fns
        function makeServerSubscription (path, callback, ctx, handler, additionalTopics) {
            if (!_isString(path)) {
                throw new PN_Error("BadArguments", "Subscription path should be a string");
            }
            if (!subscriptions) {
                throw new PN_Error("RunTime", "Cannot create subscriptions until authenticated");
            }
            callback = callback || noop;
            additionalTopics = additionalTopics || [];
            var id = subscriptions.add(path, callback, ctx, handler, additionalTopics);
            send('subscribe', [id, path], true);
            return id;
        }

        this.removeServerSubscription = function (arg) {
            var deleted = subscriptions.remove(arg);
            if (deleted.length) {
                send('unsubscribe', deleted, true);
            }
            return deleted;
        };

        this.getScales = function (options, callback, ctx) {

            var path = generateScalesUrlFromOptions(options, true);

            return makeServerSubscription(
                "/"+path+"/",
                callback,
                ctx,
                ScalesMeasurement.factory,
                ["scales"]
            );
        };

    }
    PN_WebSocket.isSupported = function () {
        return !!window.WebSocket;
    };

    return {
        WebSocket: PN_WebSocket,
        ScalesMeasurement: ScalesMeasurement,
        Error: PN_Error
    };

})();