var Manifest = require('../');

var manifest = new Manifest();

manifest.connect({
  port: 3100
});

manifest.connect({
  port: 4100
});

setInterval(function() {
  console.log('');
  console.log("services:", manifest.services());
  console.log('');
  console.log("::::::::::::::::::::::::::::::");
}, 5000);
