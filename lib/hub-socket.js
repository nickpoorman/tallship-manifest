/**
 * Module dependencies.
 */
var debug = require('debug')('hubsocket');
var escape = require('escape-regexp');
var Message = require('amp-message');
var Socket = require('axon').Socket;

/**
 * Expose `HubSocket`.
 */

module.exports = HubSocket;

/**
 * Initialize a new `HubSocket`.
 *
 * @api private
 */

function HubSocket() {
  Socket.call(this);
  this.subscriptions = [];
}

/**
 * Inherits from `Socket.prototype`.
 */

HubSocket.prototype.__proto__ = Socket.prototype;

/**
 * Send `msg` to all established peers.
 *
 * @param {Mixed} msg
 * @api public
 */

HubSocket.prototype.broadcast = function(msg) {
  if (!this.hasSocks()) return this;
  var socks = this.socks;
  var len = socks.length;
  var sock;

  var buf = this.pack(arguments);

  for (var i = 0; i < len; i++) {
    sock = socks[i];
    if (sock.writable) sock.write(buf);
  }

  return this;
};

/**
 * Check if this socket is connected.
 *
 * @return {Boolean}
 * @api public
 */

HubSocket.prototype.hasSocks = function() {
  return this.socks.length > 0;
};

/**
 * Check if this socket has subscriptions.
 *
 * @return {Boolean}
 * @api public
 */

HubSocket.prototype.hasSubscriptions = function() {
  return !!this.subscriptions.length;
};

/**
 * Check if any subscriptions match `topic`.
 *
 * @param {String} topic
 * @return {Boolean}
 * @api public
 */

HubSocket.prototype.matches = function(topic) {
  for (var i = 0; i < this.subscriptions.length; ++i) {
    if (this.subscriptions[i].test(topic)) {
      return true;
    }
  }
  return false;
};

/**
 * Message handler.
 *
 * @param {net.Socket} sock
 * @return {Function} closure(msg, mulitpart)
 * @api private
 */

HubSocket.prototype.onmessage = function(sock) {
  var subs = this.hasSubscriptions();
  var self = this;

  return function(buf) {
    var msg = new Message(buf);

    if (subs) {
      var topic = msg.args[0];
      if (!self.matches(topic)) return debug('not subscribed to "%s"', topic);
    }

    self.emit.apply(self, ['message'].concat(msg.args));
  };
};

/**
 * Subscribe with the given `re`.
 *
 * @param {RegExp|String} re
 * @return {RegExp}
 * @api public
 */

HubSocket.prototype.subscribe = function(re) {
  debug('subscribe to "%s"', re);
  this.subscriptions.push(re = toRegExp(re));
  return re;
};

/**
 * Unsubscribe with the given `re`.
 *
 * @param {RegExp|String} re
 * @api public
 */

HubSocket.prototype.unsubscribe = function(re) {
  debug('unsubscribe from "%s"', re);
  re = toRegExp(re);
  for (var i = 0; i < this.subscriptions.length; ++i) {
    if (this.subscriptions[i].toString() === re.toString()) {
      this.subscriptions.splice(i--, 1);
    }
  }
};

/**
 * Clear current subscriptions.
 *
 * @api public
 */

HubSocket.prototype.clearSubscriptions = function() {
  this.subscriptions = [];
};

/**
 * Convert `str` to a `RegExp`.
 *
 * @param {String} str
 * @return {RegExp}
 * @api private
 */

function toRegExp(str) {
  if (str instanceof RegExp) return str;
  str = escape(str);
  str = str.replace(/\\\*/g, '(.+)');
  return new RegExp('^' + str + '$');
}
