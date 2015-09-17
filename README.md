# PrintNode-JS

A tiny, zero dependency javascript client for the PrintNode API.

Learn more about the PrintNode api from here https://www.printnode.com/docs/api/curl and PrintNode from here http://www.printnode.com.

## Support

All good browsers and IE8+ (it relies on JSON.parse and JSON.stringify). If you need support for IE6+ any JSON shim e.g. http://bestiejs.github.io/json3/ will get it done.

## What's It Got

* Tiny footprint. 2.7KB minified!
* No dependencies at all!
* Good support for old browsers!

## Anything Missing?

Yes. This is the very first version. It's missing lots of things...

* Tests
* It doesn't provide 100% coverage of the PrintNode API
* Stability! Expect this to change.
* Comprehensive documentation.
* Bower integration
* AMD module loader compliance
* Proper documentation
* Travis-ci
* A automatic build system

## Usage

You need to include one of the files in  `src/*`.

This declares a global PrintNodeApi object. Which you can instantiate and use as detailed in the example below.


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
        console.log("complete");
    },
    // called if the api call timed out
    timeout: function (url, duration) {
        console.log("timeout", url, duration)
    },
    // the timeout duration in ms
    timeoutDuration: 3000
};

var api = new PrintNodeApi({
    apiKey: '__your_apikey_here__'
});

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
api.scales(options, {computerId: 12, deviceName: 'foo_scales', deviceId: 34, debug: true});
```
