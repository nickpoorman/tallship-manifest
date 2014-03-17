/**
 * Window for messages
 */
var debug = require('debug')('window');

module.exports = Window;

function Window(opts) {
  if (!(this instanceof Window)) return Window;
  opts = opts || {};

  this.windowSize = opts.windowSize || 7;
  this.head = 0;

  this.owners = {};
  this.id = opts.id;
}

/**
 * add data to the window
 * @param  {String} id  The id of the owner of the window
 * @param  {String} key The message key to be placed in the window
 * @return {Boolean} true if the data was able to be added, false if it already exists
 */

Window.prototype.add = function(id, key) {
  debug('host: %s id: %s key: %s', this.id, id, key);
  if (!this.owners[id]) this.owners[id] = [];
  var buffer = this.owners[id];
  debug('t: %s host: %s entries: %j', Date.now(), this.id, buffer);
  if (~buffer.indexOf(key)) return false;
  buffer[this.head++ % this.windowSize] = key;
  return true;
}

/**
 * free an owner by id
 * @return {Boolean} true if the data was able to be removed, false if it was not
 */
Window.prototype.free = function(id) {
  if (!this.owners[id]) return false;
  delete this.owners[id];
  return true;
}
