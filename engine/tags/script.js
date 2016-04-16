var exports = module.exports;

exports.compile = function(compiler, args, content, parents, options, blockName) {

    var config = options.config||{};
    //console.log('script parents %o', parents);
    //console.log('script options %o', options);

    //console.log('[script] www:' + config.www  + ' client:'+config.client + ' views:' + config.views);

    var code = '_ctx.resource.addScript((function () { var _output = "";' +
        compiler(content, parents, options, blockName) +
        ' return _output; })());';
    //console.log('>>>script:' + code);
    return code;
};

exports.parse = function(str, line, parser, types) {
    return true;
};

exports.ends = true;