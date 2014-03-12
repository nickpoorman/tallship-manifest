module.exports = function() {
  return [1, 1, 1].map(function() {
    return Math.random().toString(16).substring(2).toUpperCase();
  }).join('');
};
