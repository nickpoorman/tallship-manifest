var should = require('should');

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
});
