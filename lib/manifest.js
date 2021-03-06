/**
 * Manifest
 */
var debug = require('debug')('manifest');
var version = require('../package.json').version;
var role = require('../package.json').name;
var inherits = require('inherits');
var Hub = require('./hub');
var util = require('util');
var _ = require('underscore');
var EventEmitter = require('events').EventEmitter;
var generateId = require('./id');
var portrange = 10000;

module.exports = Manifest;
inherits(Manifest, EventEmitter);

function Manifest(opts) {
  if (!(this instanceof Manifest)) return new Manifest(opts);
  EventEmitter.call(this);

  if (!opts) opts = {};
  var self = this;

  self.hub = new Hub();
  self.id = self.hub.id;
  self.registrationLifetime = opts.registrationLifetime || 5000;
  self.heartbeatInterval = opts.heartbeatInterval || 5000;

  self._services = {};

  self.hub.on('close', self.emit.bind(self, 'close'));
  self.hub.on('close', self.emit.bind(self, 'close'));

  // network events
  self.hub.bus.on('hello', onHello.bind(self));
  self.hub.bus.on('register', checkAndSetService.bind(self));

  // internal hub events
  self.hub.on('connection', onConnection.bind(self));
  self.hub.on('connect', onConnect.bind(self));

  self.hub.on('listening', function() {
    if (!self._addr) {
      self._addr = self.hub.address();
      // right here is where we need to set our address
      registerSelf.call(self);
    }
  });

  self.connect = self.hub.connect.bind(self.hub);
  self.createServer = self.hub.createServer.bind(self.hub);

  // every so many seconds we need to broadcast over the network
  self._broadcastingInterval = setInterval(function() {
    if (!self.hub.isOnline()) return debug('hub is not online');
    var date = Date.now();
    // need to broadcast over the network every so many seconds
    for (var s in self._services) {
      var service = self._services[s];
      if (!service) {
        debug('ERROR: service has null value!!');
        continue;
      }
      if (service.persistent) {
        debug('broadcasting persistent service: %j', service);
        self.hub.broadcast('register', service);
        continue;
      }
      if (typeof service.owner !== 'undefined' && service.owner === self.id) {
        service.timestamp = date;
        debug('broadcasting service: %j', service);
        self.hub.broadcast('register', service);
      } else if (service.timestamp + self.registrationLifetime < date) {
        // every so many seconds we need to remove the expired registrations
        debug('purge service: %j', service);
        deleteService.call(self, service.id);
      }
    }
    self.emit('heartbeat');
  }.bind(self), self.heartbeatInterval);
}

/**
 * close the connections to the hub and stop any interval loops
 * @param  {Function} fn The callback function to be called once the close event has fired
 * @return {Manfiest}    The manfiest object itself
 */
Manifest.prototype.close = function(fn) {
  var self = this;
  // stop the the heartbeat
  clearInterval(this._broadcastingInterval);
  this.hub.close.call(this.hub);
  if (typeof fn === 'function') this.once('close', fn);
}

/**
 * register a service in the database.
 * -- If you want to use the address of this host, set { address: null }; this will wait until createServer has called to set it.
 * @param  {Mixed} role The role the service will play on the network. Should be in the form name@semver.
 * @param  {int} data   (Optional) Optional data to include in the record. (Warning: Keep it small, this gets broadcast a lot)
 * @return {Object}     The service object itself
 */
Manifest.prototype.register = function(role, data) {
  var service = {};
  if (typeof role === 'object') service = role;
  if (typeof role === 'string') {
    var spl = role.split('@');
    service.role = spl[0];
    if (spl[1]) service.version = spl[1];
  }

  if (!service.role) throw new Error('Must specify a role');

  _.defaults(service, data, {
    id: createUniqueId(),
    owner: this.id
  });

  if (service.address === null) {
    if (!this.hub.listening()) { // if the hub is not a server
      this.hub.once('listening', function() {
        // update the address
        service.address = this._addr.address;

        debug('doing register (late): %j', service);
        setService.call(this, service);
        this.hub.broadcast('register', service); // publish the registered service to the network
      }.bind(this));
      return;
    }
    service.address = this._addr.address;
  }
  debug('doing register: %j', service);
  setService.call(this, service);
  this.hub.broadcast('register', service); // publish the registered service to the network
  return service;
}

/**
 * free (unregister) a service in the database
 */

Manifest.prototype.free = function(service, noBroadcast) {
  debug('doing free: %j', service);
  // check to see if we have the service
  if (service.id && serviceExists.call(this, service) && this._services[service.id] && (service.persistent || this._services[service.id].owner === this.id)) { // lookup by id, make sure we own the service
    return deleteService.call(this, service.id);
  }
  if (service.port) {
    // lookup by port
    var foundService = _.findWhere(_.values(this._services), {
      owner: this.id,
      port: service.port
    });
    if (foundService) return deleteService.call(this, foundService.id);
    // fall below
  }
  return undefined;
}

/**
 * @return {Object}  A copy of the services database
 */
Manifest.prototype.services = function() {
  var services = [];
  for (var service in this._services) {
    services.push(_.clone(this._services[service]));
  }
  return services;
}

/**
 * @return {Object}  Get services from the registry
 */
Manifest.prototype.get = function(role) {
  if (typeof role === 'object') return _.where(this.services(), role);
  if (typeof role === 'string') {
    var lookup = {};
    var spl = role.split('@');
    lookup.role = spl[0];
    if (spl[1]) lookup.version = spl[1];
    return _.where(this.services(), lookup);
  }
  return null;
}

function deleteService(id) {
  if (typeof id === 'undefined') return undefined;
  var service = this._services[id];
  if (!service) return undefined;
  delete this._services[id];
  this.hub._window.free(id);
  this.emit('free', service);
  return service;
}

/**
 * set the service in the database of services
 * will only set the service if we are not the owner
 * this really only gets called from remote events
 */

function checkAndSetService(service) {
  if (service.owner && service.owner === this.id) return;
  setService.apply(this, arguments);
}

/**
 * set the service in the database of services
 * will only replace service if it has a newer or equal timestamp
 */

function setService(service) {
  // debug('setting service: %j', service);
  checkIdForCollision.call(service);
  if (serviceExists.call(this, service) && isOldService.call(this, service)) return debug('old service try to be set: %j : %j', service, this._services);
  if (!service.timestamp) service.timestamp = Date.now();
  var found = !! this._services[service.id];
  this._services[service.id] = service;
  // debug('service set: %j', this._services);
  if (!found) this.emit('register', service);
}

/**
 * received when connection recognized on the remote end
 * @param  {String} host     your address on the network
 * @param  {Array} services the services that are currently registered on the network
 */

function onHello(address, services) {
  debug('got hello');
  debug('address: %j', address);
  debug('hello services: %j', services);
  var self = this;

  function reg() {
    self._addr = self._addr || self.hub.address();
    self._addr.address = address;
    registerSelf.call(self, address); // register/update self
  }

  if (this.hub.listening()) { // if the hub is a server
    reg.call(this);
  } else {
    this.hub.once('listening', reg.bind(this));
  }

  for (var service in services) {
    checkAndSetService.call(this, services[service]);
  };

  debug('services after sync: %j', this._services);
  this.emit('sync', self._services);
}

/**
 * called after connect to another hub
 * @param  {Object} data The data used to connect to them
 */

function onConnect() {
  debug('connect');
  this.emit('connect');
}

/**
 * called when a connection to the hub is made
 *
 * send a hello message back to them
 * @param  {net.socket} sock The direct line to send the message back through
 */

function onConnection(sock) {
  debug('connection: %s', sock.remoteAddress);
  debug('connection address: %j', sock.address());

  this.hub.send(sock, 'hello', sock.remoteAddress, this._services);

  var old = {
    address: this._addr.address,
    owner: this.id
  };
  this._addr = sock.address();

  var newAddress = this._addr.address;
  if (newAddress !== old.address) {
    // update all the registrations that have the old addr
    var services = _.where(_.values(this._services), old);
    services.forEach(function(service) {
      service.address = newAddress;
    });
  }

  // right here is where we need to set our address
  registerSelf.call(this);
  this.emit('connection', sock);
}

function registerSelf(address) {
  // need to create local data if not set
  var lookup = {
    owner: this.id,
    role: role,
    version: version
  };
  var service = _.findWhere(this._services, lookup);
  var meta = _.defaults({}, service, {
    role: role,
    version: version,
    id: createUniqueId.call(this)
  });
  // update the address
  _.extend(meta, {
    address: address || this._addr.address,
    port: this._addr.port, //this.hub.opts.server.address().port
    timestamp: Date.now() // don't forget the timestamp or it wont update
  });
  // stick ourself in the network
  this.register(meta);
}

function createUniqueId() {
  var self = this;

  var keys = _.keys(self._services);
  var id;
  var times = 0;
  do {
    if (++times > 100000) {
      console.error('Could not create a unique id...');
      return undefined;
    }
    id = generateId();

  } while (keys.indexOf(id) !== -1);
  return id;
}

function isRemoteHostRegistered(port, address) {
  var services = this._services;

  // go through each of the services and find the one matching an address and port
  for (var s in services) {
    var service = services[s];
    if (service.role === role && service.pub.port === port && service.pub.host === address) {
      return true;
    }
  };
  return false;
}

/**
 * check if a service exists by id or port
 * @param  {Object} service Service with id or port property
 * @return {boolean}         If the service exists
 */

function serviceExists(service) {
  if (!service || typeof this._services === 'undefined') return false;
  var byId = typeof service.id !== 'undefined' && typeof this._services[service.id] !== 'undefined' && this._services[service.id];
  if (byId) return true;
  return typeof service.port !== 'undefined' &&
    _.findWhere(_.values(this._services), {
      port: service.port
    });
}

function isOldService(service) {
  if (typeof service.timestamp === 'undefined') return false;
  if (typeof this._services[service.id] === 'undefined' || typeof this._services[service.id].timestamp === 'undefined') return false;
  return service.timestamp < this._services[service.id].timestamp;
}

/**
 * this is really only for sanity, in case our id generator creates a duplicate id
 */

function checkIdForCollision(service) {
  // throw an error if one of the services has an id thats the same as ours
  if (service && service.id === this.id && isOwnServer.call(this)) throw new Error('Duplicate id detected on network');
}

function isOwnServer(service) {
  var own = this._services[this.id];
  return service && service.role === role && service.version === version && service.host === own.host && service.port === own.port;
}
