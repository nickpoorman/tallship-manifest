/**
 * Window for messages
 */
var debug = require('debug')('window');

module.exports = Window;

function Window(opts) {
  if (!(this instanceof Window)) return Window;
  opts = opts || {};

  this.windowSize = opts.windowSize || 7;

  this.owners = {};
  this.id = opts.id;
}

/**
 * add data to the window
 * @param  {String} id  The id of the owner of the window
 * @param  {String} key The message key to be placed in the window
 * @return {Boolean} true if the data was able to be added, false if it already exists
 */

Window.prototype.add = function(id, timestamp) {
  debug('host: %s id: %s timestamp: %s', this.id, id, timestamp);
  if (!this.owners[id]) this.owners[id] = [];
  var buffer = this.owners[id];
  debug('t: %s host: %s entries: %j', Date.now(), this.id, buffer);
  if (~buffer.indexOf(timestamp)) return false;
  if (buffer.length === this.windowSize && timestamp < buffer[0]) return false; // don't add old when full, bc it will get removed anyway
  buffer.push(timestamp); // do this instead of insert, bc chances are it will get added to the end anyway
  if (buffer.length > this.windowSize) buffer.shift();
  buffer.sort();
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
