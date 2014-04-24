/**
 * Window for messages
 */
var debug = require('debug')('window');

module.exports = Window;

function Window(opts) {
  if (!(this instanceof Window)) return Window;
  opts = opts || {};

  var self = this;

  this.windowSize = opts.windowSize || 7;

  this.owners = {};
  this.ownerTimestamp = {};

  this.id = opts.id;

  // reap outdated owners
  this._reaper = setInterval(function() {
    debug('doing reap');
    var date = Date.now();
    for (var owner in self.ownerTimestamp) {
      if (self.ownerTimestamp[owner] + 60000 < date) {
        self.free(owner);
      }
    }
  }, 30000);
}

/**
 * add data to the window
 * @param  {String} id  The id of the owner of the window
 * @param  {String} key The message key to be placed in the window
 * @return {Boolean} true if the data was able to be added, false if it already exists
 */

Window.prototype.add = function(id, timestamp) {
  // debug('host: %s id: %s timestamp: %s', this.id, id, timestamp);
  if (!this.owners[id]) this.owners[id] = [];
  var buffer = this.owners[id];
  debug('host: %s | owner: %j | entries: %j', this.id, id, buffer);
  if (~buffer.indexOf(timestamp)) return false;
  if (buffer.length === this.windowSize && timestamp < buffer[0]) return false; // don't add old when full, bc it will get removed anyway
  buffer.push(timestamp); // do this instead of insert, bc chances are it will get added to the end anyway
  this.ownerTimestamp[id] = Date.now();
  if (buffer.length > this.windowSize) buffer.shift();
  insertSort(buffer);
  return true;
}

/**
 * free an owner by id
 * @return {Boolean} true if the data was able to be removed, false if it was not
 */
Window.prototype.free = function(id) {
  if (!this.owners[id]) return false;
  debug('free id from window: %s', id);
  delete this.owners[id];
  delete this.ownerTimestamp[id];
  return true;
}

/**
 * close the window
 * @param {Function} fn The callback to be called once the window is closed
 */
Window.prototype.close = function(fn) {
  clearInterval(this._reaper);
  if (typeof fn === 'function') fn();
  return this;
}

function insertSort(arr) {
  for (var i = 1; i < arr.length; i++) {
    var tmp = arr[i],
      j = i;
    while (arr[j - 1] > tmp) {
      arr[j] = arr[j - 1];
      --j;
    }
    arr[j] = tmp;
  }

  return arr;
}
