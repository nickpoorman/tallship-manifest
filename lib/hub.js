var debug = require('debug')('hub');
var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var axon = require('axon');
var _ = require('underscore');
var HubSocket = require('./hub-socket');
var generateId = require('./id');
var Win = require('./window');

module.exports = Hub;
inherits(Hub, EventEmitter);

function Hub(opts) {
  if (!(this instanceof Hub)) return new Hub(opts);
  var self = this;

  opts = opts || {};

  self.id = generateId();
  debug('set id: %s', self.id);

  self._windowMax = 100000 || opts.maxWindow;
  self._windowHead = 0;

  this._window = new Win({
    id: self.id
  });

  self.opts = {
    server: _.extend({
      port: 3100,
      host: '0.0.0.0'
    }, opts.server),
    client: _.extend({
      port: 3100,
      host: '0.0.0.0'
    }, opts.client)
  };

  self.client = new HubSocket();
  self.server = new HubSocket();
  self.bus = new EventEmitter();

  self.client.on('close', self.emit.bind(self, 'close'));
  self.server.on('close', self.emit.bind(self, 'close'));

  self.client.on('message', onMessage.bind(self));
  self.server.on('message', onMessage.bind(self));

  self.client.on('connect', self.emit.bind(self, 'connect'));
  self.server.on('connect', self.emit.bind(self, 'connection'));

}

/**
 * create the server for other hubs to connect to
 */
Hub.prototype.createServer = function(opts) {
  debug('creating server: %j', opts);
  var self = this;
  _.extend(this.opts.server, opts || {});
  var s = self.server.bind(self.opts.server.port, self.opts.server.host, function() {
    debug('listening');
    self._listening = true;
    self.emit('listening');
    self.server.once('close', function() {
      self._listening = false;
    });
  });
  return s.server; // the net.Socket
}

/**
 * connect to another hub
 */
Hub.prototype.connect = function(opts) {
  var self = this;
  debug('doing connect');
  _.extend(this.opts.client, opts || {});
  this.client.connect(this.opts.client.port, this.opts.client.host, function() {
    debug('connected %j', self.opts.client);
    // emit the clients details...
    self.emit('connect', self.opts.client);
  });
  return this.client;
}

/**
 * broadcast a new message
 */

Hub.prototype.broadcast = function() {
  var args = [].slice.call(arguments);
  this._windowHead = ++this._windowHead % this._windowMax;
  args.unshift(this.id, this._windowHead);
  debug('broadcasting NEW message %j', args);
  _broadcast.apply(this, args);
  return this;
}

/**
 * Send `msg` to single established peer.
 *
 * @param {Mixed} msg
 * @api public
 */

Hub.prototype.send = function(sock, msg) {
  var args = [].slice.call(arguments, 1);
  args.unshift(this.id, 'direct');
  var buf = this.client.pack(args);
  if (sock.writable) sock.write(buf);
  return this;
};

/**
 * Close the hub.
 *
 * @api public
 */

Hub.prototype.close = function() {
  this.server.close();
  this.client.close();
  return this;
};

/**
 * get the server address
 */
Hub.prototype.address = function() {
  return this.server.address();
}

/**
 * Returns true/false if the hub is listening.
 */
Hub.prototype.listening = function() {
  return !!this._listening;
}

/**
 * Returns true/false if the hub is connected or has connections.
 */
Hub.prototype.isOnline = function() {
  return this.client.hasSocks() || this.server.hasSocks();
}

/**
 * when a message comes in strip out the history
 *  and unless direct broadcast it out
 */

function onMessage(from, timestamp, evt, data) {
  debug('called onMessage: %j', arguments);

  if (!evt) {
    debug('no event name: %j', evt);
    return;
  }

  if (!timestamp) {
    debug('no timestamp: %j', timestamp);
    return;
  }

  if (!from) {
    debug('no from for event: %j', evt);
    return;
  }

  // special case is direct messages, ie. hello
  if (timestamp === 'direct') {
    emitBus.apply(this, arguments);
    return;
  }

  if (from === this.id) {
    debug('got event that came from us %j', evt);
    return;
  }

  var added = this._window.add(from, timestamp);
  if (!added) {
    debug('got duplicate event %j', arguments);
    return;
  }

  _broadcast.apply(this, arguments);
  emitBus.apply(this, arguments);
}

/**
 * remove the from & timestamp before emitting on the bus
 */

function emitBus(evt) {
  var args = [].slice.call(arguments, 2);
  // args.unshift(evt);
  debug('emit: %j', args);
  this.bus.emit.apply(this.bus, args);
}

/**
 * broadcast the message over the network
 */

function _broadcast() {
  debug('broadcasting: %j', arguments);
  this.client.broadcast.apply(this.client, arguments);
  this.server.broadcast.apply(this.server, arguments);
}
