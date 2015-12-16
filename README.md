# PrintNode-JS

A tiny, zero dependency javascript client for the PrintNode WebSocket and HTTP APIs.

Learn more about the PrintNode api from here https://www.printnode.com/docs/api/curl and PrintNode from here http://www.printnode.com.

## Browser Support

HTTP. All good browsers and IE8+ (it relies on `JSON.parse()` and `JSON.stringify`). If you need support for IE6+ any JSON shim e.g. http://bestiejs.github.io/json3/ will get it done.

WebSocket. All good browsers and IE10+ (it relies on the native `window.WebSocket`).

## What's It Got

* A tiny footprint. 15.8KB for WebSocket+HTTP and 10.5KB for WebSocket - before gzip!
* No dependencies at all!
* Good support for old browsers!

## Anything Missing?

Yes. This is pretty much the first version.

* Tests
* It doesn't provide 100% coverage of the PrintNode HTTP API
* Comprehensive documentation.
* Bower integration
* AMD module loader compliance
* Travis-ci
* A automatic build system

## Getting Started

Include one of the files in `src/*`. Everything will be imported into a global object named `PrintNode`.

## WebSocket Client

#### Checking Browser Support?

Check with a call to `PrintNode.Websocket.isSupported()`. If not you can fallback to HTTP and/or not use IE. We hope you chose not to use IE.

#### Making a Connection

`PrintNode.WebSocket` is a constructor. Takes 3 arguments.

 - `options` object, required. Structure. `{apiKey: 'your_api_key_here'}`
 - `authenticatedCallback` function, optional. Callback executed when socket is connected and the account authenticated.
 - `errorCallback` function, optional. Callback executed when a error occours.

Errors come in a number of types.

  - Network errors like server timeouts, unexpected disconnects.
  - Errors thrown by callbacks executed by the `WebSocket` object.
  - Internal errors. Protocol violations, unexpected data. If you see any of these you've found a bug. Please contact support@printnode.com.

The authentication callback will be called once the WebSocket has been established and authentication has occurred. If `apiKey` is valid the first argument authentication callback will be as follows

`{accountId: 123, permissions: 1, maxSubscriptions: 5}`

In the event the `apiKey` is invalid the first argument will be

`{error: "Unauthorized"}`

To detect a error look for a `error` property (`undefined !== authData.error`). If something goes wrong this will contain a meaningful message.

```javascript

function authenticate (authData) {
  console.log(authData);
}

function error (err) {
  console.error(err);
}

var ws = new PrintNode.WebSocket({apiKey: 'insert apikey here'}, authenticate, error);
```

### The General Error Handler

Should anything go wrong the error callback will be called. The data in the arguments will vary but there'll always be a explicit error message. If this throws a error it'll output to `console.error`.

### PrintNode.WebSocket Implements Pub/Sub

It is possible to use a instance of `PrintNode.WebSocket` with callbacks passed as arguments to various methods. E.g. The constructor arguments `errorCallback` and `authenticateCallback`. In addition to supporting callbacks, each instance of `PrintNode.WebSocket` also exposes a powerful hierarchical pub/sub implementation. It publishes events and payloads in response to pretty much everything. You may prefer to use this depending on the problem and your preferred programming style. It works like this.

```javascript
function error() {
    console.error(arguments);
}

var ws = new PrintNode.WebSocket({apiKey: 'insert apikey here'})
ws.subscribe("authenticate", function (authData) {
    console.log(authData);
});
ws.subscribe("error", error)
;
```

Named events can be published by a instance of `PrintNode.WebSocket` at any time. You can have as many subscribers as you like and they can be added and removed as required.

To remove a subscription call `.unsubscribe()` with either the the named event or the function which has been subscribed as the only argument. This returns a integer - the number of subscriptions removed.

The following example will unsubscribe all callbacks [declared above] using both strategies.

```javascript
ws.unsubscribe("authenticate");
ws.unsubscribe(error);
```

#### Subscription options

By default `this` in your subscribe callbacks will resolve to the instance of the `PrintNode.WebSocket` object which triggered the event. If you wish your callbacks to execute and have `this` resolve to something else set the property `context` on the options object.

If you wish to pass additional data to your callback set the property `data` on the options object.

```javascript
ws.subscribe(
  "authenticate",
  function (payload, sub) {
    // this === objectThatWillResolveToThis
    // sub.data === myCustomData
  },
  {context: objectThatWillResolveToThis, data: myCustomData}
);
```

#### Hierarchical, What?

Events may be namespaced. The namespace separator is `.`. E.g. `authenticate.ok` and `authenticate.error` are both events in the `authenticate` event namespace. When you subscribe to a event you will receive events published to your event namespace __and all__ events contained within that namespace. Authentication is a example of this; `authenticate.ok` is published when authentication has been a success and `authenticate.error` when not. You can subscribe to both with just one subscription - `authenticate`. Should you only be interested in failures, subscribe to `authenticate.error` and you shall only receive those.

A more complex example of this is scales events. Scales events are published on; `computer.<computerId>.scales.<deviceName>.<deviceNum>`. You can make many subscriptions for a variety of different circumstances or actions depending on use case.

E.g. Imagine you had a DOM element which showed the most current value of a particular scale and would like to updated only for this scale. Make a subscription for a the full computer, deviceName, deviceNum and have this execute with a context of the DOM element.

E.g. Imagine you want to show all scales information for a individual computer; `computer.<computerId>.scales.` would be more meaningful.

Subscriptions are fast, lightweight. You can make a lot.

You can include literal `.`'s in a event name by escaping them. The escape character for `.` is `\`. `\` is its own escape char.

E.g `\.\\` is a subscription to a literal `.\`.

If that sounds all a bit confusing, don't worry, there is a alternative syntax. You may subscribe to events using a arrays of strings to represent the event hierarchy. No escaping needed.

```javascript
// the following two lines are equivalent.
ws.subscribe(['a','b','c'], callback);
ws.subscribe('a.b.c', callback)
```

### Getting Data From PrintNode

By default a instance of `PrintNode.WebSocket` won't do anything until you tell the server what you want.

Lets get some scales data.

```javascript
function authenticate (authData) {
  if (authData.error) {
    // handle the error
    return;
  }
  // ok we're authenticated - now get some scales data
  var scalesSub = this.getScales({computerId: 0}, function subCallback (scalesMeasurement) {
      console.log(scalesMeasurement);
  });
}
function error () {
  console.error.apply(console, arguments);
}
var ws = new PrintNode.WebSocket({apiKey: 'insert apikey here'}, authenticate, error);
ws.subscribe("authenticate", authenticate);
ws.subscribe("error", error);
```

The first argument to `.getScales()` must be a object with one of the following key structures.

- `{}` -> returns all scales information for the currently connected account.
- `{computerId: 0}` -> returns all scales information for the computer with id `0`.
- `{computerId: 0, deviceName: 'PrintNode Test Scale'}` -> returns all scales information for the computer with id `0` and scales named `PrintNode Test Scale`.
- `{computerId: 0, deviceName: 'PrintNode Test Scale', deviceNum: 0}` -> returns all scales information for the computer with id `0`, device named `PrintNode Test Scale` with device number `0`.

This makes a request to PrintNode for all scales which match the options criteria. Two things will happen.

 - All scales information currently held at PrintNode will immediately be sent to the WebSocket client.
 - New scales information will be sent to this WebSocket client as soon as it is available at PrintNode.

If the optional callback argument is passed this will be called when a scales measurements is received by the WebSocket client. The third argument is a optional `context` argument and will effect how `this` is resolved within the callback.

In addition to the following pub/sub events are also published.

- `scales`
- `computer.<computerId>.scales.<deviceName>.<deviceNum>`

Callbacks or pub/sub subscribers will receive scales events as a javascript object of type `PrintNode.ScalesMeasurement`. I.e. `arguments[0] instanceof PrintNode.ScalesMeasurement === true`. `PrintNode.ScalesMeasurement` has properties identical to a scales data object described by the HTTP Rest api documentation here https://www.printnode.com/docs/api/curl/#scales-http.

If you want to get more sophisticated you can alter the `ScalesMeasurement` prototype at `PrintNode.ScalesMeasurement.prototype`. The factory method (which instantiates each `PrintNode.ScalesMeasurement` object) is `PrintNode.ScalesMeasurement.factory`. You can replace this if you wanted to do something else entirely.

### No Longer Interested In Server Data? Unsubscribe!

If you've made a call to the server to fetch data of some kind of e.g. via `getScales()` it will return a unique integer id which corresponds to this server subscription.

Calling `.removeServerSubscription(id)` will have the server stop sending data for this subscription and free up the rate limiting resource consumed by the websocket. The return value is a array of subscription ids removed.

For example.

```
var pN_WebSocket = new PrintNode.WebSocket(
    options,
    function (auth) {

        // fetch test scale data
        var scalesSub = this.getScales({computerId: 0});

        // stop fetching after 5 seconds
        setTimeout(
            function stopSendingMeStuff() {
                pN_WebSocket.removeServerSubscription(scalesSub);
            },
            5000
        );
    }
);

var messageCnt = 0;
pN_WebSocket.subscribe('scales', function (measurement) {
    console.log(++messageCnt, measurement);
});

```

It's also possible to close all server subscriptions with `.removeServerSubscription()` with no arguments.

When there are no server subscriptions active the socket the socket won't be closed and will remain authenticated. If you are writing a single page web application with long page lifetimes it may be useful to leave a socket in this state as you will save your users the time it would take to re establish the socket and authenticate.

#### Testing

We found it to be a bit of a drag developing all this with a physical scales device so we made a magic, always-there scale called `PrintNode Test Scale` attached to a computer id `0`. You can connect to this and it will publish a scales event once every second. All day, every day.

#### Anything Else?

You can only have a limited number of `get()` requests to the server active at any one time. At the time of writing this limit is 5 and it is enforced by the PrintNode API server. This may be subject to change. Wherever possible favour making requests which are as narrow in scope as possible (lower bandwidth, faster) but not at the expense of making multiple requests.

E.g. You have two computers attached to your account with id `1` and `2`.

1. If you are interested in scales data for computer with id `1` make a call `.getScales({computerId: 1})`.
2. If you are interested in scales data for computer with id `1` and `2` make a call to `.getScales({})`.

You could accomplish 2. with two calls like so; `.getScales({computerId: 1})` and `.getScales({computerId: 2})`. This is allowed. The downsides are this is less efficient. Also two requests will consume twice as much of the rate limiting resource allocated to your account.

#### What Next?

PrintNode is going to continue adding more capabilities to the Websocket API. Very soon it will also be possible to fetch computer, printer and printjob states. The WebSocket API will not duplicate all of the functionality of the HTTP API.

## HTTP Client

You need to include one of the files in  `src/*`. Everything will be imported into a global object named `PrintNode`.

#### Conventions

It's all modelled on jQuery's `$.ajax()` so hopefully it'll all make sense. Build up a `options` object which contains the callbacks you want to execute for each request. You can set defaults in the constructor and override later for specific methods.

All requests for things return a Promise/A+ compliant then-able.

```javascript
var options = {
    // changes the value of 'this' in the success, error, timeout and complete
    // handlers. The default value of 'this' is the instance of the PrintNodeApi
    // object used to make the api call
    context: null,
    // called if the api call was a 2xx success
    success: function (response, headers, xhrObject) {
        console.log(this);
        console.log("success", response, headers);
    },
    // called if the api call failed in any way
    error: function (response, headers, xhrObject) {
        console.log("error", response, headers);
    },
    // called afer the api call has completed after success or error callback
    complete: function (xhrObject) {
      console.log(
          "%d %s %s returned %db in %dms",
          response.xhr.status,
          response.reqMethod,
          response.reqUrl,
          response.xhr.responseText.length,
          response.getDuration()
      );
    },
    // called if the api call timed out
    timeout: function (url, duration) {
        console.log("timeout", url, duration)
    },
    // the timeout duration in ms
    timeoutDuration: 3000
};

var api = new PrintNode.HTTP(
    new PrintNode.HTTP.ApiKey('your_api_key_here'),
    options
);

// whoami - https://www.printnode.com/docs/api/curl/#whoami
api.whoami(options);

// computers - https://www.printnode.com/docs/api/curl/#computers
api.computers(options);
// with filtering
api.computers(options, {computerSet: '-400'});

// printers - https://www.printnode.com/docs/api/curl/#printers
api.printers(options);
// with filtering by computer
api.printers(options, {computerSet: '-400'});
// with filtering by computer and printer
api.printers(options, {computerSet: '-400', printerSet: '100-'});

// creating a printjob - http://website2.printnode.com/docs/api/curl/#printjob-creating
var printJobPayload = {
    "printerId": 8075,
    "title": "test printjob",
    "contentType": "pdf_uri",
    "content": "https://app.printnode.com/testpdfs/a4_portrait.pdf",
    "source": "javascript api client"
}
api.printjob(options, printJobPayload);

// scales HTTP REST - https://www.printnode.com/docs/api/curl/#scales-http
api.scales(options, {computerId: 12});
// with device name
api.scales(options, {computerId: 12, deviceName: 'foo_scales'});
// with device name and device id
api.scales(options, {computerId: 12, deviceName: 'foo_scales', deviceId: 34});
// generate fake output from the scales for debug - https://www.printnode.com/docs/test-scales-api/
// (default timeout is extended to 15,000ms)
api.scales(options, {computerId: 12, deviceName: 'foo_scales', deviceId: 34});


// example using a promise

api.whoami(options).then(
  function success (response, info) {
    console.log(response, info);
  },
  function error (err) {
    console.error(err);
  }
);

```
