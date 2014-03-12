var Manifest = require('../');

var manifest = new Manifest();

manifest.createServer({
  port: 4100
});

manifest.connect({
  port: 3100
});

// wait a few seconds and set a service
setTimeout(function() {
  var service = manifest.register('test-service@0.0.1', {
    address: null
  });

  // wait a few more seconds and remove the service
  setTimeout(function() {
    manifest.free(service);
  }, 7000);

}, 7000);
