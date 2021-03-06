var path = require('path');
var Utils = require('./util.js');

// 此事件在 pagelet 渲染前触发。
// 主要为了收集 js/css, 后面等 pagelet 渲染完后再把收集到的添加到 pagelet 中。
function beforePageletRender(pagelet, locals) {
    var resource = locals.resource;
    var fork, subpagelets, origin;

    if (!resource)return;

    // resource 在 pagelet 里面收集的 js 不能与原来的合并。
    // 所以需要 fork 一份出来。
    fork = locals.resource = resource.fork();
    
    subpagelets = [];
    origin = fork.addQuicklingPagelet;

    // pagelet 中套 pagelet，在父 pagelet 渲染完后再开始子 pagelet.
    
    // 缓存起来。
    fork.addQuicklingPagelet = function() {
        subpagelets.push(arguments);
    };

    // 等待父 pagelet 渲染完毕。
    pagelet.once('after', function() {
        subpagelets.forEach(function(args) {
            args[0].parentId = pagelet.id;
            origin.apply(fork, args);
        });
        
        fork.addQuicklingPagelet = origin;
        fork = locals = origin = subpagelets = pagelet = null;
    });

};

// 将 resource 收集的 js/css 添加到 pagelet 中。
function afterPageletRender(pagelet, locals) {
    var resource = locals.resource;

    //console.log('----------afterPageletRender1------------');

    if (!resource) return;

    //console.log('----------afterPageletRender2------------', JSON.stringify(resource));

    var scripts = resource.getScripts();
    var styles = resource.getStyles();
    var css = resource.getCss();
    var js = resource.getJs();

    if (resource.getResourceMap()) {
        pagelet.addScript('require.resourceMap(' +
            JSON.stringify(resource.getResourceMap()) + ');');
    }

    pagelet.addStyles(styles);
    pagelet.addScripts(scripts);

    css && pagelet.addCss(css);
    js && pagelet.addJs(js);
}

function hasEventLinstener(emiter, type, fn) {
    list = emiter._events[type];

    if (list && (list === fn || ~list.indexOf(fn))) {
        return true;
    }

    return false;
}

var defaultOptions = {
    tpl: {
        css: '<% if (this.css) { %>' +
                '<% this.css.forEach(function(uri) { %>' +
                    '<link rel="stylesheet" href="<%= uri %>" />' +
                '<% }); %>' +
            '<% } %>'+

            '<% if (this.embedCss) { %>' +
                '<style type="text/css"><%= this.embedCss %></style>' +
            '<% } %>',


        js: '<% if (this.framework) { %>' +
                '<script type="text/javascript" src="<%= this.framework %>"></script>' +
            '<% } %>' +

            '<% if (this.sourceMap) { %>' +
                '<script type="text/javascript">require.resourceMap(<%= this.sourceMap %>);</script>' +
            '<% } %>' +

            '<% if (this.js) { %>' +
                '<% this.js.forEach(function(uri) { %>' +
                    '<script type="text/javascript" src="<%= uri %>"></script>' +
                '<% }); %>' +
            '<% } %>' +

            '<% if (this.embedJs) { %>' +
                '<script type="text/javascript"><%= this.embedJs %></script>' +
            '<% } %>'
    }
};

var createHanlder = module.exports = function(res, options) {

    options = Utils.mixin(Utils.mixin({}, defaultOptions), options);

    //console.log('--resource  options:' + JSON.stringify(options));
    // 静态资源 api
    var resourceMap = res.resourceMap;

    // bigpipe api
    var bigpipe = res.bigpipe;

    // tpl模板目录
    var views = options.views;

    //console.log('--resource  views:' + JSON.stringify(views));

    var loaded = [];

    // include all async files
    var asyncs = [];

    // include all sync files
    var syncs = [];

    var framework;

    // collect all inner script
    var scripts = [];

    // collect all inner style
    var styles = [];

    var asyncToSync = {};

    var handledPkg = {};

    var loadDeps = function(res, async) {
        if (res['deps']) {
            res['deps'].forEach(function (id) {
                load(id, async);
            });
        }

        if (res['extras'] && res['extras']['async']) {
            res['extras']['async'].forEach(function (id) {
                load(id, true);
            });
        }
    };

    var load = function(id, async) {
        //console.log('>>>resource load id:' + id);
        var uri = '';
        var info, pkgInfo, url, type;
        //异步资源即使因为pkg.has引入过，也需要重新处理，向asyncs中添加
        if (loaded[id] && !async) {
            if (!async && asyncs[id] && !asyncToSync[id]) {
                info = asyncs[id];
                loadDeps(info, async);
                syncs[info['type']] = syncs[info['type']] || [];
                syncs[info['type']].push(info['uri']);
                asyncToSync[id] = info['uri'];
            }
            return loaded[id];
        } else {
            info = resourceMap.getInfo(id, true);
            //console.log('>>>resource load id:' + id + ' info:' + JSON.stringify(info));

            if (info) {
                type = info['type'];
                //不重复对同一个pkg处理，避免死循环
                if (info['pkg'] && !handledPkg[info.pkg]) {
                    handledPkg[info.pkg] = true;
                    pkgInfo = resourceMap.getPkgInfo(info['pkg']);
                    uri = pkgInfo['uri'];

                    if (pkgInfo['has']) {
                        pkgInfo['has'].forEach(function (id) {
                            loaded[id] = uri;
                        });

                        pkgInfo['has'].forEach(function (id) {
                            loadDeps(resourceMap.getInfo(id, true), async);
                        });
                    }
                } else {
                    uri = info['uri'];
                    loaded[id] = uri;
                    loadDeps(info, async);
                }

                //only the javascript file maybe is a async file.
                if (!async || type == 'css') {
                    //skip framework load
                    if (uri === framework){
                        return uri;
                    }
                    syncs[type] = syncs[type] || [];
                    syncs[type].push(uri);
                } else {
                    asyncs[id] = info;
                }

                return uri;
            } else {
                console.log('not found resource, resource `id` = ' + id);
            }
        }
    };

    if (bigpipe && !hasEventLinstener(bigpipe, 'pagelet:render:before',
            beforePageletRender) ) {
        
        bigpipe
            .on('pagelet:render:before', beforePageletRender)
            .on('pagelet:render:after', afterPageletRender);
    }

    return {

        CSS_HOOK: '<!--FIS_CSS_HOOK-->',
        JS_HOOK: '<!--FIS_JS_HOOK-->',
        BIGPIPE_HOOK: bigpipe ? '<!--FIS_BIGPIPE_HOOK-->' : '',
        
        /**
         * 添加内嵌 js
         * @param script  the code between <script> and </script>.
         */
        addScript: function (script) {
            //console.log('>>>resource addscript:' + script);
            scripts.push(script);
        },

        getScripts: function() {
            return scripts;
        },

        /**
         * 添加 js
         * @param {[type]} url [description]
         */
        addJs: function(url) {
            var info = resourceMap && resourceMap.getInfo(url, true);

            if (info) {
                this.load(url);
            } else {
                syncs.js = syncs.js || [];
                ~syncs.js.indexOf(url) || syncs.js.push(url);
            }
        },

        /**
         * 获取 js
         * @return {[type]} [description]
         */
        getJs: function() {
            return syncs.js;
        },

        /**
         * 添加内联样式
         * @param style  the code between <style> and </style>
         */
        addStyle: function (style) {
            styles.push(style);
        },

        getStyles: function() {
            return styles;
        },

        /**
         * 添加样式
         * @param {[type]} url [description]
         */
        addCss: function(url) {
            var info = resourceMap && resourceMap.getInfo(url, true);

            if (info) {
                this.load(url);
            } else {
                syncs.css = syncs.css || [];
                ~syncs.css.indexOf(url) || syncs.css.push(url);
            }
        },

        /**
         * 获取 css
         * @return {[type]} [description]
         */
        getCss: function() {
            return syncs.css;
        },

        /**
         * 设置 framework js.
         * @param {[type]} js [description]
         */
        setFramework: function(js) {
            framework = resourceMap ? resourceMap.resolve(js) : js;
        },

        getFramework: function() {
            return framework;
        },

        load: function() {
            resourceMap && load.apply(this, arguments);
        },

        resolve: function(id) {
            var resolved = resourceMap && resourceMap.resolve(id);
            
            if (resolved) {
                return path.join(views, resolved);
            }

            return id;
        },

        getUrl: function(id) {
            var resolved = resourceMap && resourceMap.resolve(id);
            return resolved || id;
        },

        supportBigPipe: function() {
            return !!bigpipe;
        },

        addQuicklingPagelet: function() {

            return bigpipe && bigpipe.addQuicklingPagelet.apply(bigpipe, arguments);
        },

        addPagelet: function(swig, locals, attrs, output) {

            //console.log('>>>>>>addPagelet', typeof attrs, attrs, output);
            var obj = Utils.mixin(attrs, {
                output:output,
                locals:locals,
                compiled: function(locals){
                    return output;
                }
            });

            return bigpipe && bigpipe.addPagelet(obj);
        },

        getPageletId: function(id) {
            return id;
        },

        fork: function() {
            var forked = createHanlder(res, options);
            return forked;
        },

        getResourceMap: function() {
            var id, rMap, res, pkg;
            //console.log('>>>>getResourceMap:' + JSON.stringify(asyncs));
            for (id in asyncs) {
                res = asyncs[id];

                if (res['type'] != 'js') {
                    continue;
                }

                rMap = rMap || {};
                rMap['res'] = rMap['res'] || {};
                rMap['pkg'] = rMap['pkg'] || {};

                rMap['res'][id] = {
                    'url': res['uri']
                };

                if (res['deps']){
                    // 异步资源的deps中剔除非JS资源
                    var deps = res['deps'].filter(function(dep){
                        var info = resourceMap.getInfo(dep, true);
                        if (info.type === 'js'){
                            return true;
                        }
                    }) || [];

                    if (deps.length !== 0){
                        rMap['res'][id].deps = deps;
                    }
                }


                if (res['pkg']) {
                    rMap['res'][id]['pkg'] = res['pkg'];
                }

                if (asyncs[id]['pkg'] && this.resourceMap) {
                    pkg = resourceMap.getPkgInfo(asyncs[id]['pkg']);
                    rMap['pkg'][asyncs[id]['pkg']] = {
                        'url': pkg['uri']
                    }
                }
            }
            return rMap;
        },

        filter: function(content) {
            if(~content.indexOf(this.JS_HOOK)) {
                content = this.filterJs(content);
            }

            if(~content.indexOf(this.CSS_HOOK)) {
                content = this.filterCss(content);
            }

            return content;
        },

        filterJs: function(content) {
            var resourceMap = this.getResourceMap();
            var scripts = this.getScripts();
            var jses = this.getJs();
            var data = {};

            var loadModjs = !!framework;

            if (loadModjs) {
                data.framework = framework;
            }

            //console.log('>>>>filterjs:'+ JSON.stringify(resourceMap||{}) );
            if(resourceMap){
                data.sourceMap = JSON.stringify(resourceMap||{});
            }

            data.resolve = this.getUrl;

            jses && (data.js = jses);
            scripts.length && (data.embedJs = '!function() {' +
                    scripts.join('}();\n!function() {') + '}();');


            return content.replace(this.JS_HOOK, Utils.tpl(options.tpl.js, data));
        },

        filterCss: function(content) {
            var styles = this.getStyles();
            var csses = this.getCss();
            var data = {};

            csses && (data.css = csses);
            styles.length && (data.embedCss = styles.join('\n'));

            data.resolve = this.getUrl;

            return content.replace(this.CSS_HOOK, Utils.tpl(options.tpl.css, data));
        },

        destroy: function() {
            loaded = asyncs = syncs = scripts = styles = asyncToSync = null;
            this.resourceMap = this.bigpipe = this.views = null;
            resourceMap = bigpipe = views = null;
        },

        // references
        resourceMap: resourceMap,
        bigpipe: bigpipe,
        views: views,
        config: {
            www: resourceMap.www,
            client: resourceMap.client,
            views: views
        }
    }
};