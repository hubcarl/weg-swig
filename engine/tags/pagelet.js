function getAttr(value){
    return value ? '"' + value + '"' : '';
}


exports.compile = function(compiler, args, content, parents, options, blockName) {

    var attrs = {};

    var code = '';

    args.forEach(function(arg) {
        if (arg.key === 'id') {
            attrs.id = arg.value;
        } else if (arg.key === 'tag') {
            if (/^none$/i.test(arg.value)) {
                attrs.tag = false;
            } else {
                attrs.tag = arg.value;
            }
        }else {
            attrs[arg.key] = arg.value;
        }
    });


    //console.log('--pagelet attrs:', attrs);


    // 转换字符串
    var id = getAttr(attrs.id);

    var tag = getAttr(attrs.tag);

    if (attrs.tag) {
        code += ';_output+="<"+' + tag +'+" data-pagelet=\\""+_ctx.resource.getPageletId(' + id + ')+"\\">";';
    } else {
        code += ';_output+="<!-- weg-pagelet["+_ctx.resource.getPageletId(' + id + ')+"] start -->";';
    }

    code += '_output+=_ctx.resource.addPagelet(_swig, _ctx, ' + JSON.stringify(attrs) + ', (function(){var _output="";'
        + compiler(content, parents, options, blockName) + ';return _output})());';

    if (attrs.tag) {
        code += '_output+="</"+' + tag + '+">";';
    } else {
        code += '_output+="<!-- weg-pagelet[" + _ctx.resource.getPageletId(' + id + ') + "] end -->";';
    }

    return code;
};

exports.parse = function(str, line, parser, types, stack, opts) {

    var key = '',
        assign;

    parser.on(types.STRING, function(token) {
        if (key && assign) {
            var raw = token.match;
            var val = raw.substring(1, raw.length - 1);

            this.out.push({
                key: key,
                value: val,
                raw: raw
            });

            key = assign = '';
        }
    });

    parser.on(types.ASSIGNMENT, function(token) {
        if (token.match === "=") {
            assign = true;
        }
    });

    parser.on(types.NUMBER, function(token) {
        var val = token.match;

        if (val && /^\-/.test(val) && key) {
            key += val;
        }
    });

    parser.on(types.OPERATOR, function(token) {
        var val = token.match;

        if (val === '-' && key) {
            key += val;
        }
    });

    parser.on(types.VAR, function(token) {
        key += token.match;
        assign = false;
        return false;
    });

    return true;
};

exports.ends = true;