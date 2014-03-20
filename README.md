# tallship-manifest

High availability service management

[![build status](https://secure.travis-ci.org/nickpoorman/tallship-manifest.png)](http://travis-ci.org/nickpoorman/tallship-manifest)

*RAND: Ship's manifests, sir. I think they're in order now.*
*KIRK: Thank you, Yeoman.*

-- A list of the cargo carried by a ship, made for the use of various agents and officials at the ports of destination.

Each `manifest` on the network will maintain (eventually consistent) information on the services available.

# methods

```
var Manifest = require('tallship-manifest');
```

A manifest may exist in client mode or server mode or both. Cyclic connections have no effect on the network (other than the increase in data being transmitted around the network).

## var m = Manifest(opts)

Create a new manifest instance.

`opts` can be used to set the following properties:

* `registrationLifetime` - amount of time a registration is valid before it expires in milliseconds [5000];
* `heartbeatInterval` - how often to send (renew) registrations [5000];

### var socket = manifest.connect(opts)

Connect to a manifest server. 

**Note:** Connections to more than one server are permitted and are encouraged for **high availability**.

`opts` should include a `host` and `port`.

Default:
```
{port: 3100, host: '0.0.0.0'}
```

Returns: `socket` - the high level socket (wrapper around net.Socket)

### var socket = manifest.createServer(opts)

Create a server for other manifest clients to connect to.

`opts` should include a `host` and `port`.

Default:
```
{port: 3100, host: '0.0.0.0'}
```

Returns: `socket` - a net.Socket

### var service = m.register(role, data)

Register a service on the network.

`role` - the role the service will play on the network. Should be in the form name@semver.

`data` - optional data to include in the record. (Warning: Keep it small, this gets broadcast a lot)  

Note: *If you want to use the address of this host, set `{ address: null }`, this will wait until the manifest instance is actively listening for connections before setting the address and registering the service.*

*Optionally* - `role` may instead be an Object that contains the necessary service information.


### var service = m.free(service)

Free (unregister) a service on the network. You must be the owner of the service to free it.

`service` - object must include either an `id` or a `port` or both

ie:
```
{id: 'ASDNX93WX9XX', port: '3001'}
```

Returns the `service` object removed from the network, or `undefined` if it does not exist.


### var services = m.services()

Returns a copy of the underlying service database for the services on the network.

example: 
```
 {
   BDE40A1384EA8E955D3DFC: {
     role: 'manifest@0.0.1',
     id: 'BDE40A1384EA8E955D3DFC',
     address: '127.0.0.1',
     port: 4100,
     owner: '7190E29DE507F838D0F28ECD',
     timestamp: 1394636407332
   },
   '521FA1549183337802DE531F': {
     role: 'manifest@0.0.1',
     id: '521FA1549183337802DE531F',
     address: '127.0.0.1',
     port: 3100,
     owner: '54FA7DD59B31D4971FF4311F',
     timestamp: 1394636405385
   },
   '0EAB299D4C21E21F5887CE65': {
     role: 'test-service@0.0.1',
     address: '127.0.0.1',
     id: '0EAB299D4C21E21F5887CE65',
     owner: '7190E29DE507F838D0F28ECD',
     timestamp: 1394636407332
   }
 }
 ```

### var services = m.get(role)

Returns a copy of the underlying services that match `role`.

`role` can be a formatted as `example@0.1.2`, `example`, or a (partial) service object '{ role: "example" }'.

example => m.get('manifest'): 
```
 {
   BDE40A1384EA8E955D3DFC: {
     role: 'manifest@0.0.1',
     id: 'BDE40A1384EA8E955D3DFC',
     address: '127.0.0.1',
     port: 4100,
     owner: '7190E29DE507F838D0F28ECD',
     timestamp: 1394636407332
   },
   '521FA1549183337802DE531F': {
     role: 'manifest@0.0.2',
     id: '521FA1549183337802DE531F',
     address: '127.0.0.1',
     port: 3100,
     owner: '54FA7DD59B31D4971FF4311F',
     timestamp: 1394636405385
   }
 }
 ```

### m.close()

Closes all the upstream and downstream sockets.

Emits `close` event when finished.


# events

## m.on('register', function (service) {})

Emitted whenever a new service is registered.

## m.on('free', function (service) {})

Emitted whenever a service is freed (unregistered).

## m.on('close', function (service) {})

Emitted when the sockets have all been closed after calling `m.close()`.

## m.on('connect', function () {})

Emitted after a `connect()` to a manifest.

## m.on('connection', function (net.Socket) {})

Emitted after another manifest connects to this manifest, --when an incoming connection has been made.

## m.on('sync', function (net.Socket) {})

Emitted after the initial handshake. At this point, the registry will contain any services that were in the remote registry when the connection was established. --The remote registry sends a copy of their registry during the handshake.

## m.on('heartbeat', function () {})

Emitted after each heartbeat. This becomes useful when you want to know when / ensure any new registrations have been broadcast.



# Thanks

* Heavily inspired by https://github.com/substack/seaport
* Built on top of https://github.com/visionmedia/axon
* and https://github.com/visionmedia/node-amp-message


# License

(The MIT License)

Copyright (c) 2014 Nick Poorman <mail@nickpoorman.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
