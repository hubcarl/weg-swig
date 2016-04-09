var ignore = 'ignore',
    missing = 'missing',
    only = 'only',
    attrs = ["id", "mode", "group", "container", "for", "model", "tag", "append"];

/**
 * Includes a template partial in place. The template is rendered within the current locals variable context.
 *
 * @alias widget
 *
 * @example
 * // food = 'burritos';
 * // drink = 'lemonade';
 * {% widget "./partial.html" %}
 * // => I like burritos and lemonade.
 *
 * @example
 * // my_obj = { food: 'tacos', drink: 'horchata' };
 * {% widget "./partial.html" id="pagelet_id" mode="async" with my_obj%}
 * // => I like tacos and horchata.
 *
 * @example
 * {% widget "/this/file/does/not/exist" ignore missing %}
 * // => (Nothing! empty string)
 *
 * @param {string|var}  file      The path, relative to the template root, to render into the current context.
 * @param {literal}     [with]    Literally, "with".
 * @param {object}      [context] Local variable key-value object context to provide to the included file.
 * @param {literal}     [only]    Restricts to <strong>only</strong> passing the <code>with context</code> as local variables–the included template will not be aware of any other local variables in the parent template. For best performance, usage of this option is recommended if possible.
 * @param {literal}     [ignore missing] Will output empty string if not found instead of throwing an error.
 */

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