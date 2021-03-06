var ignore = 'ignore',
    missing = 'missing',
    only = 'only',
    attrs = ["id", "mode", "group","container", "for", "model"];

/**
 * Includes a template partial in place. The template is rendered within the current locals variable context.
 *
 * @alias widget
 *
 * @param {string|var}  file      The path, relative to the template root, to render into the current context.
 * @param {literal}     [with]    Literally, "with".
 * @param {object}      [context] Local variable key-value object context to provide to the included file.
 * @param {literal}     [only]    Restricts to <strong>only</strong> passing the <code>with context</code> as local variables–the included template will not be aware of any other local variables in the parent template. For best performance, usage of this option is recommended if possible.
 * @param {literal}     [ignore missing] Will output empty string if not found instead of throwing an error.
 */
exports.compile = function(compiler, args, content, parents, options, blockName) {
    var file = args.shift(),
        onlyIdx = args.indexOf(only),
        onlyCtx = onlyIdx !== -1 ? args.splice(onlyIdx, 1) : false,
        parentFile = (args.pop() || '').replace(/\\/g, '\\\\'),
        ignore = args[args.length - 1] === missing ? (args.pop()) : false,
        w = args.filter(function(o) {
            return !o.k;
        }).join(' '),
        w_args = {};

    //console.log('file:' + file  +  ' parentFile:' + parentFile);
    args.map(function(w) {
        if (w.k) w_args[w.k] = w.v;
    });

    //console.log('widget:args',w_args);

    var result =
        '_output += _swig._w(_ctx.resource, ' + file + ',' + JSON.stringify(w_args)
        + ', {' + 'resolveFrom: "' + parentFile + '"' + ',config: _ctx.resource.config' + '})(_ctx);'
    //console.log('---order---tags-widget:', result);
    return result;
};

exports.parse = function(str, line, parser, types, stack, opts) {
    var file, w, k;

    parser.on(types.STRING, function(token) {

        if (!file) {
            file = token.match;
            this.out.push(file);
            return;
        }

        var out = {
            v: '',
            k: ''
        };

        //if (~attrs.indexOf(k)) {
            out.v = token.match.replace(/^("|')?(.*)\1$/g, '$2');
            out.k = k;
            this.out.push(out);
            v = ''; //reset
        //}

    });

    parser.on(types.VAR, function(token) {
        if (!file) {
            k = '';
            file = token.match;
            return true;
        }

        //if (~attrs.indexOf(token.match)) {
            k = token.match;
            return false;
        //}

        if (!w && token.match === 'with') {
            w = true;
            return;
        }

        if (w && token.match === only && this.prevToken.match !== 'with') {
            this.out.push(token.match);
            return;
        }

        if (token.match === ignore) {
            return false;
        }

        if (token.match === missing) {
            if (this.prevToken.match !== ignore) {
                throw new Error('Unexpected token "' + missing + '" on line ' + line + '.');
            }
            this.out.push(token.match);
            return false;
        }

        if (this.prevToken.match === ignore) {
            throw new Error('Expected "' + missing + '" on line ' + line + ' but found "' + token.match + '".');
        }

        return true;
    });

    parser.on('end', function() {
        this.out.push(opts.filename || null);
    });

    return true;
};

exports.ends = false;