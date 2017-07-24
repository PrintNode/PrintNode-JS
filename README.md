# PrintNode-JS

A tiny, zero dependency JavaScript client for the PrintNode WebSocket and HTTP APIs.

Learn more about the PrintNode API at https://www.printnode.com/docs/api/curl and PrintNode itself at http://www.printnode.com.

## Browser Support

HTTP: any recent version of Chrome, Firefox and Safari; IE8+ (it relies on `JSON.parse()` and `JSON.stringify`). If you need support for IE6+ any JSON shim (e.g. http://bestiejs.github.io/json3/) will do the job.

WebSocket: any recent version of Chrome, Firefox and Safari; IE10+ (it relies on the native `window.WebSocket`).

## Features

* A tiny footprint. 15.8KB for WebSocket + HTTP and 10.5KB for WebSocket - before gzip!
* No dependencies at all!
* Good support for old browsers!

## Anything Missing?

This is not yet at version 1.0.0 so there are some things missing:

* Tests
* 100% coverage of the PrintNode HTTP API
* Comprehensive documentation
* Bower integration
* AMD module loader compliance
* Travis-CI
* Automatic build system

## Getting Started

Include the .js file in `src/`. Everything will be imported into a global object named `PrintNode`.

## WebSocket Client

### Checking for Browser Support

Call `PrintNode.Websocket.isSupported()`. It returns `true` if your browser supports the WebSocket functionality and `false` otherwise, in which case you can fall back to the HTTP functionality.

### Making a Connection

`PrintNode.WebSocket` is a constructor and takes three arguments:

 - `options` - required. This should be an object that looks like this: `{apiKey: <your api key>}`.
 - `authenticatedCallback` - optional. This is a function which is executed when the socket is connected and the account authenticated.
 - `errorCallback` - optional. This is a function which is executed when an error occurs.

Errors come in a number of types:

  - Network errors like server timeouts and unexpected disconnections.
  - Errors thrown by callbacks executed by the `WebSocket` object.
  - Internal errors such as protocol violations and unexpected data. If you see an internal error you've found a bug. Please contact support@printnode.com.

The `authenticatedCallback` will be called once the WebSocket has been established and authentication has occurred. If `apiKey` is valid the first argument to the authentication callback will be

`{accountId: <your account id>, permissions: 1, maxSubscriptions: 5}`.

To detect an error (including an authorization failure) look for an `error` property in the first argument to `authenticatedCallback`. Its value will be a meaningful error message.

A basic example:

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

If anything goes wrong, `errorCallback` will be called. The data in the arguments will vary but there will always be an explicit error message. If this throws a error it will output using `console.error`.

### PrintNode.WebSocket Implements Pub/Sub

In addition to supporting callbacks, each instance of `PrintNode.WebSocket` publishes data in response to certain events, which you can subscribe to so that your application takes action when those events occur. Depending on your preferred style and the way your application is designed, you may find this approach more convenient to use. It works like this:

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

Events can be published by an instance of `PrintNode.WebSocket` at any time. You can have as many subscribers as you like and they can be added and removed as required.

To remove a subscription call `.unsubscribe()` with either the the event or the function which has been subscribed as the only argument. This returns the number of subscriptions removed.

The following example undo the subscriptions made in the previous example:

```javascript
ws.unsubscribe("authenticate"); //by name
ws.unsubscribe(error);          //by function
```

#### Subscription options

By default, subscription callbacks have `this` set to the instance of the `PrintNode.WebSocket` object which triggered the event. You can change this by setting the `context` property in the `options` object.

If you wish to pass additional data to your callback, set the `data` property of the `options` object.

Both of these options are demonstrated below:

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

#### Events are Hierarchical

Events are namespaced. The namespace separator is `.`. For example, `authenticate.ok` and `authenticate.error` are both events in the `authenticate` namespace. When you subscribe to an event you will receive notifications for that event as well as all events contained within its namespace.

For example, `authenticate.ok` is published when authentication has been a success and `authenticate.error` is published otherwise. You can listen for both events simply by subscribing to `authenticate`. If you are only interested in authentication failures, just subscribe to `authenticate.error`.

A more complex example of this is scales events. Scales events are published on `computer.<computerId>.scales.<deviceName>.<deviceNum>`. You can make many subscriptions for a variety of different circumstances or actions depending on use case:

 - Suppose you have a DOM element which shows the most recent reading from a particular scale and would like to update this element when the readng on the scale changes. You would subscribe to the specific event `computer.<computerId>.scales.<deviceName>.<deviceNum>` and pass the DOM element as the context for the callback.

 - Suppose you want to show all scales information for an individual computer which has several scales connected to it. Subscribe to `computer.<computerId>.scales` to receive events for all scales connected to that computer.

Subscriptions are fast and lightweight. You can have a large number of subscriptions without harming performance.

You can include a literal `.` in an event name by escaping it. The escape character for `.` is `\`. `\` is its own escape character.

E.g `\.\\` is a subscription to `.\`.

If that sounds all a bit confusing, don't worry, there is an alternative syntax. You can subscribe to events using arrays of strings to represent the event hierarchy, in which case no escaping is needed:

```javascript
// the following two lines are equivalent.
ws.subscribe(['a','b','c'], callback);
ws.subscribe('a.b.c', callback)
```

### Getting Data From PrintNode

By default an instance of `PrintNode.WebSocket` won't do anything until you tell the server what you want.

TO get some scales data:

```javascript
function authenticate (authData) {
  if (authData.error) {
    // handle the error
    return;
  }
  // ok, we're authenticated - now let's get some scales data
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

The first argument to `.getScales()` must be an object with one of the following structures:

- `{}` returns all scales information for the currently connected account.
- `{computerId: 123}` returns all scales information for the computer with id `123`.
- `{computerId: 123, deviceName: 'MyScale'}` returns all scales information for the computer with id `123` and scales named `MyScale`.
- `{computerId: 123, deviceName: 'MyScale', deviceNum: 456}` returns all scales information for the computer with id `123`, scales named `MyScale` with device number `456`.

This makes a subscription to all scales which match the options criteria. All matching scales information currently held at PrintNode will immediately be sent to the WebSocket client and new matching scales information will be sent to this WebSocket client as soon as it is received at PrintNode.

The second argument is an optional function which will be called when a scales measurement is received by the WebSocket client.

The third argument is an optional context; if supplied, its value is what `this` resolves to within the callback.

The following events are also published:

- `scales`
- `computer.<computerId>.scales.<deviceName>.<deviceNum>`

Callbacks or pub/sub subscribers will receive scales events as a JavaScript object of type `PrintNode.ScalesMeasurement` (i.e. `arguments[0] instanceof PrintNode.ScalesMeasurement === true`). `PrintNode.ScalesMeasurement` has properties identical to a scales data object described by the HTTP REST API documentation here https://www.printnode.com/docs/api/curl/#scales-http.

If you want to get more sophisticated you can alter the `ScalesMeasurement` prototype at `PrintNode.ScalesMeasurement.prototype`. The factory method (which instantiates each `PrintNode.ScalesMeasurement` object) is `PrintNode.ScalesMeasurement.factory`. You can replace this if you want to do something else entirely.

### No Longer Interested In Server Data? Unsubscribe!

When you make a subscription, e.g. via `getScales()`, it will return a unique integer id which identifies the subscription.

Calling `.removeServerSubscription(id)` will stop the server sending data for the subscription identified by `id` and free up the resource consumed by the websocket. The return value is an array of subscription ids removed.

For example:

```javascript
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

You can close all server subscriptions by calling `.removeServerSubscription()` with no arguments.

A WebSocket connection will remain open and authenticated even with no subscriptions. If you are writing a single page web application with long page lifetimes it may be useful to leave a socket in this state as you will save your users the time it would take to re-establish the socket and authenticate.

#### Testing

WHile developing your application it is very useful to have a source of scales data to subscribe to, but it is inconvenient to have to actually plug in a scales device and occasionally put things on it to generate fresh data, so the PrintNode server provides a virtual scales device called `PrintNode Test Scale` attached to a computer id `0`. You can connect to this and it will continually publish a scales event every second.

#### Anything Else?

You can only have a limited number of `get()` requests to the server active at any one time. At the time of writing this limit is 5 and it is enforced by the PrintNode API server. This may be subject to change. Wherever possible you should make requests which are as narrow in scope as possible (lower bandwidth, faster) but not at the expense of making multiple requests.

For example, suppose you have two computers connected to your account with ids `1` and `2`.

1. If you are interested in scales data for the computer with id `1`, call `.getScales({computerId: 1})`.
2. If you are interested in scales data for both computers, call `.getScales({})`.

You could accomplish (2) with the two calls `.getScales({computerId: 1})` and `.getScales({computerId: 2})`, although this is less efficient and will count as two subscriptions out of the permitted number of subscriptions per WebSocket.

### Tracking Client Connections

PrintNode can publish events when a client connects or disconnects to one of our servers. You may find this useful if you wish to display information about the connectedness state of a computer.

You can request connection and disconnection events as follows:

```javascript
function authenticate (authData) {
  if (authData.error) {
    // handle the error
    return;
  }
  // ok, we're authenticated - now get some computer connection data
  var subscriptionId = this.getComputerConnections(
    {},
    function subCallback (computerConnections) {
      // this === context, if we specify it below
      // do work here
      console.log(computerConnections);
    }//, context
  );
}
function error () {
  console.error.apply(console, arguments);
}
var ws = new PrintNode.WebSocket(
  {apiKey: 'insert apikey here'},
  authenticate,
  error
);
```

The first argument to `.getComputerConnections` must be an object with one of the following structures:

- `{}` returns all connection/disconnection information for your account.
- `{computerId: 123}` returns all connection/disconnection information for the computer with id `123`.

This makes a subscription to all scales which match the options criteria. All matching scales information currently held at PrintNode will immediately be sent to the WebSocket client and new matching scales information will be sent to this WebSocket client as soon as it is received at PrintNode.

The second argument is an optional function which will be called when a scales measurement is received by the WebSocket client.

The third argument is an optional context; if supplied, its value is what `this` resolves to within the callback.

The following events are also published:

- `computers.connections`
- `computer.<id>.connections`

Callbacks will receive connection data as a Javascript object of type `PrintNode.ComputerConnections` (i.e. `arguments[0] instanceof PrintNode.ComputerConnections === true`).

The `PrintNode.ComputerConnections` object's prototype is `new Array()`, i.e. it's 'array-like'; it has all the usual properties and methods of a JavaScript array. It will contain zero or more objects of type `PrintNode.Connection`. It will always have the properties `accountId` and `computerId` set. `PrintNode.Connection` objects in `PrintNode.ComputerConnections` are all for the same computer. `PrintNode.ComputerConnections` arrays contain all connection information for the computerId referenced. A `PrintNode.ComputerConnections` object with length zero indicates there are no current connections.

#### Why is `PrintNode.ComputerConnections` array-like?

In most cases there are zero or one client connections for any given computer but there are some circumstances when there can be more than one connection open for a specific computer:

- If a computer running the PrintNode Client has had it's config files copied, two different physical computers would present as the same computer to PrintNode.
- If two or more different computers share a hostname they will share the same PrintNode `computerId`.
- In unreliable network situations it's possible for the connection between a PrintNode Client and the PrintNode Server to be terminated ungracefully. In some circumstances this may mean that the client is aware of the loss of connection before the server. It may make a new connection before the server is able to determine that the first connection is terminated. In this situation there is a short period during which a single computer is registered as having two connections.

#### Would you like to extend `PrintNode.ComputerConnections` or do something else?

You can alter the `ComputerConnections` prototype at `PrintNode.ComputerConnections.prototype`. The factory method (which instantiates each `PrintNode.ComputerConnections` object) is `PrintNode.ComputerConnections.factory`. If you replace this you can do something else entirely.

#### What Next?

PrintNode is going to continue adding more capabilities to the Websocket API. Very soon it will also be possible to fetch Printer and PrintJob states. Note that the WebSocket API will not duplicate all of the functionality of the HTTP API.

## HTTP Client

#### Conventions

The library's HTTP functionality is all modelled on jQuery's `$.ajax()`, so hopefully it makes sense and feels somewhat familiar. Build up an `options` object which contains the callbacks you want to execute for each request. You can set defaults in the constructor and override later for specific methods.

All requests return a "thenable", in Promises/A+ parlance.

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
