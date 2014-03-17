var debug = require('debug')('hub');
var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var axon = require('axon');
var _ = require('underscore');
var HubSocket = require('./hub-socket');
var generateId = require('./id');
var ip = require("ip");
var Win = require('./window');

module.exports = Hub;
inherits(Hub, EventEmitter);

function Hub(opts) {
  if (!(this instanceof Hub)) return new Hub(opts);
  var self = this;

  opts = opts || {};

  self.id = generateId();
  debug('set id: %s', self.id);

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

  // self.client.on('connect', self.emit.bind(self, 'connect'));
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
  this.client.connect(opts.port, opts.host, function() {
    debug('connected %j', self.opts.client);
    // emit the clients details...
    self.emit('connect', self.opts.client);
  });
  return this.client;
}

/**
 * broadcast a message
 * the first argument must be a string because it's an event
 * if it's not then it must be a new broadcast, tag it with our id
 */

Hub.prototype.broadcast = function() {
  debug('broadcasting message');
  var args = [].slice.call(arguments);
  if (typeof args[0] === 'string') { // && args[0] !== 'direct'
    debug('NEW message');
    args.unshift([]);
  }
  args[0].push(this.id);
  debug('broadcasting: %j', args);
  this.client.broadcast.apply(this.client, args);
  this.server.broadcast.apply(this.server, args);
}

/**
 * Send `msg` to single established peer.
 *
 * @param {Mixed} msg
 * @api public
 */

Hub.prototype.send = function(sock, msg) {
  var args = [].slice.call(arguments, 1);
  args.unshift('direct');
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

function onMessage(history, evt, data) {
  debug('called onMessage: %j', arguments);
  var self = this;

  // special case is direct messages, ie. hello
  if (history === 'direct') {
    emitBus.apply(self, arguments);
    return;
  }

  if (!evt) {
    debug('no event name: %j', evt);
    return;
  }

  if (!history) {
    debug('no history: %j', history);
    return;
  }

  // if the event came from us don't do anything, this means we just got back our own event
  if (~history.indexOf(self.id)) { // test if our id is in there
    // found us, don't do event again
    debug('got event that originated here %j', history);
    return;
  }

  if (!data) {
    debug('no data for event: %j', evt);
    return;
  }

  if (!data.owner) {
    debug('no data for event: %j', evt);
    return;
  }

  var added = this._window.add(data.owner, data.id + ':' + data.timestamp);
  if (!added) {
    debug('got duplicate event %j', arguments);
    return;
  }
  // history.push(self.id);
  self.broadcast.apply(self, arguments);
  // strip out the history
  emitBus.apply(self, arguments);
}

/**
 * remove the history before emitting on the bus
 */

function emitBus(evt) {
  var args = [].slice.call(arguments, 1);
  // args.unshift(evt);
  debug('emit: %j', args);
  this.bus.emit.apply(this.bus, args);
}
