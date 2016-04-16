/**
 * 此插件为 swig-view 的 swig 版本显现。
 */
var Readable = require('stream').Readable;
var util = require('util');
var fs = require('fs');
var Swig = require('swig').Swig;
var loader = require('./lib/loader.js');
var tags  = [
    "script",
    "style",
    "html",
    "body",
    "require",
    "uri",
    "widget",
    "head",
    "feature",
    "featureelse",
    "spage",
    "pagelet"
];
var swigInstance;

/**
 * Opitions 说明
 * - `views` 模板根目录
 * - `loader` 模板加载器，默认自带，可选。
 *
 * resource 参数，为 swig-view 的中间层，用来扩展模板能力。
 * 比如通过 addScript, addStyle 添加的 js/css 会自动在页面开头结尾处才输出。
 *
 * 更多细节请查看 swig-view
 *
 * @return {Readable Stream}
 */
var SwigWrap = module.exports = function SwigWrap(options, resource) {

    //console.log('>>>options0' + JSON.stringify(options));

    var self = this;

    if (!(self instanceof SwigWrap)) {
        return new SwigWrap(options, resource);
    }

    // 重写 loader, 让模板引擎，可以识别静态资源标示。如：static/lib/jquery.js
    options.loader = options.loader || loader(resource, options.views);

    self.swig = swigInstance = options.cache && swigInstance || new Swig(options);

    tags.forEach(function (tag) {
        var t = require('./tags/' + tag);
        self.swig.setTag(tag, t.parse, t.compile, t.ends, t.blockLevel || false);
    });

    self.buzy = false;
};

util.inherits(SwigWrap, Readable);


SwigWrap.prototype.makeStream = function(view, locals) {
    Readable.call(this, null);
    this.view = view;
    this.locals = locals;
    return this;
};

SwigWrap.prototype.readFile = function(filePath) {

};

//Readable pipe自动调用调用_read方法
SwigWrap.prototype._read = function(n) {
    //console.log('swigwrap read' + this.view);
    if (!this.buzy && this.view) {
        this.renderFile(this.view, this.locals);
    }
};


SwigWrap.prototype.renderFile = function(view, locals) {


    var self = this;

    if (self.buzy) return;
    self.buzy = true;

    var layout = (typeof locals.layout  =='string' && locals.layout) || self.swig.options && self.swig.options.layout;

    // 如果设置不用 layout 或者 layout没有定义, 直接renderFile
    if (locals.layout === false || locals.layout === '' || !layout) {
        self.swig.renderFile(view, locals, function(error, output) {
            if (error) {
                return self.emit('error', error);
            }
            self.push(output);
            self.push(null);
        });
    }else{
        self.swig.options.filename = view;
        //加载资源引用资源
        var content = self.swig.options.loader.load(view);
        var source = `{% extends 'page/${layout}.tpl' %} {% block content %} ${content} {% endblock %}`;
        var fn = self.swig.compile(source, self.swig.options);
        var output = fn(locals);
        self.push(output);
        self.push(null);
    }
};

SwigWrap.prototype.destroy = function() {
    this.swig = null;
    this.removeAllListeners();
};

// 这个方法在 tags/widget.js 中调用。
Swig.prototype._w = Swig.prototype._widget = function(resource, id, attr, options) {
    var self = this;
    var pathname = resource.resolve(id);

    //console.log('----pathName:' +pathname + ' options:' + JSON.stringify(options));
    if (!resource.supportBigPipe() || !attr.mode || attr.mode === 'sync' ) {
        resource.load(id);
        return this.compileFile(pathname, options);
    }

    return function(locals) {
        var container = attr['container'] || attr['for'];

        resource.addQuicklingPagelet({
            container: container,
            model: attr.model,
            id: attr.id,
            mode: attr.mode,
            locals: locals,
            view: pathname,
            viewId: id,

            compiled: function(locals) {
                var fn = self.compileFile(pathname, options);
                var resource = locals.resource;
                resource && resource.load(id);
                return fn.apply(this, arguments);
            }
        });

        return container ? '' : '<div id="' + attr.id + '"></div>';
    };
};