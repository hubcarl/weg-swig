var _ = module.exports = {};

_.extend = function (a, b) {
    if (a && b) {
        for (var key in b) {
            a[key] = b[key];
        }
    }
    return a;
};
