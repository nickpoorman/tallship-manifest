var should = require('should');
var _ = require('underscore');

var net = require('net');

var Manifest = require('../');
var HubSocket = require('../lib/hub-socket');


describe('manifest', function() {

  describe('server', function() {

    var manifest;
    var m;

    after(function(done) {
      this.timeout(10000);
      var manifestClosed = false;
      var mClosed = false;

      manifest.close();
      m.close();

      manifest.once('close', function() {
        manifestClosed = true;
        if (manifestClosed && mClosed) done();
      });
      m.once('close', function() {
        mClosed = true;
        if (manifestClosed && mClosed) done();
      });
    });

    it('should be an instance of Manifest', function(done) {
      manifest = new Manifest();
      manifest.should.be.an.instanceOf(Manifest);
      done();
    });

    it('should begin listening for connections', function(done) {
      var socket = manifest.createServer();
      should.exist(socket);
      socket.once('listening', done);
    });

    it('should be able to connect to another Manifest server and register itself', function(done) {
      this.timeout(10000);
      m = new Manifest();
      m.createServer({
        port: 4100
      });
      var hlSocket = manifest.connect({
        port: 4100
      });
      hlSocket.should.be.an.instanceOf(HubSocket);
      m.on('register', function(service) {
        if (service.owner === manifest.id) done();
      });
    });
  });

  describe('client', function() {


    var manifest;
    var m;

    after(function(done) {
      this.timeout(10000);
      var manifestClosed = false;
      var mClosed = false;

      manifest.close();
      m.close();

      manifest.once('close', function() {
        manifestClosed = true;
        if (manifestClosed && mClosed) done();
      });
      m.once('close', function() {
        mClosed = true;
        if (manifestClosed && mClosed) done();
      });
    });

    it('should be an instance of Manifest', function(done) {
      manifest = new Manifest();
      manifest.should.be.an.instanceOf(Manifest);
      done();
    });

    it('should be able to connect to another Manifest server', function(done) {
      this.timeout(10000);
      m = new Manifest();
      m.createServer({
        port: 4100
      });
      var hlSocket = manifest.connect({
        port: 4100
      });
      hlSocket.should.be.an.instanceOf(HubSocket);
      manifest.on('register', function(service) {
        if (service.owner === m.id) done();
      });
    });

  });

  describe('hub', function(done) {

    var m1;
    var m2;
    var m3;

    after(function(done) {
      this.timeout(10000);
      var m1Closed = false;
      var m2Closed = false;
      var m3Closed = false;

      m1.close();
      m2.close();
      m3.close();

      m1.once('close', function() {
        m1Closed = true;
        if (m1Closed && m2Closed && m3Closed) done();
      });
      m2.once('close', function() {
        m2Closed = true;
        if (m1Closed && m2Closed && m3Closed) done();
      });
      m3.once('close', function() {
        m3Closed = true;
        if (m1Closed && m2Closed && m3Closed) done();
      });
    });

    it('should not get the same event twice', function(done) {
      this.timeout(5000);

      var events = {};

      m1 = new Manifest();
      m1.createServer({
        port: 3100
      });

      var register = 2;
      m1.hub.bus.on('register', function(service) {
        if (!events[service.owner]) events[service.owner] = [];
        var key = service.owner + ':' + service.id + ':' + service.timestamp;
        events[service.owner].should.not.containEql(key);
        events[service.owner].push(key);
        if (!--register) done();
      });

      m2 = new Manifest();
      m2.createServer({
        port: 4100
      });

      m3 = new Manifest();
      m3.createServer({
        port: 5100
      });

      var hls1 = m1.connect({
        port: 4100
      });

      var hls2 = m2.connect({
        port: 5100
      });

      var hls3 = m3.connect({
        port: 3100
      });
    });
  });
});
