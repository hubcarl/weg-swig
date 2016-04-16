var Response = require('./lib/response.js');
var Resource = require('./lib/resource.js');
var Combine = require('./lib/combine.js');
var Utils = require('./lib/util.js');
var Engine = require('./engine/index.js');


exports.init = function(settings, app) {

    if (arguments.length === 1) {
        app = settings;
        settings = {};
    }

    // 让 response.render 的时候，将 response 实例作为 locals 参数携带进来。
    hackResponse(app);

    settings.views = app.get('views');

    //// 加载engine的index.js
    //Engine = Utils.resolveEngine(settings.engine || 'engine');

    return function(filePath, locals, done) {


        var fileAbsUrl = Utils.getFileAbsUrl(filePath, app.get('view engine'));

        //console.log('filePath:' , filePath, fileAbsUrl);

        // 关于 response 来源，请查看 hackResponse 方法,以及 lib/reponse.js
        var response = locals.response;

        // 创建一个新对象。
        var options = Utils.mixin({}, settings);

        // 初始化 resource 层, 提供 addScript, addStyle, resolve, addQuicklingPagelet 各种接口,用来扩展模板层能力
        var resource = Resource(response, settings);

        // swig 模板绑定数据
        var swigData = Utils.mixin(locals, {resource: resource});

        //console.log('>>>engine swigData %o %o, %o',fileAbsUrl, locals,  swigData);

        var sentData = false;

        new Engine(options, resource)

            .makeStream(fileAbsUrl, swigData)

            // 合并 tpl 流 和 bigpipe 流。
            .pipe(Combine(resource))

            .on('data', function() {
                sentData = true;
            })

            .on('error', function(error) {
                // 属于 chunk error
                if (sentData) {
                    if (typeof settings.chunkErrorHandler === 'function') {
                        settings.chunkErrorHandler(error, response);
                    } else {
                        response.write('<script>window.console && console.error("chunk error", "'+ error.message.replace(/"/g, "\\\"") +'")</script>');
                    }
                    response.end();
                } else {
                    // 交给 express 去处理错误吧。
                    done(error);
                }
            })

            // 直接输出到 response.
            .pipe(response);
    };
};

// hack into response class.
var hacked = false;
function hackResponse(app) {
    if (hacked) return;
    hacked = true;

    app.use(function hackResponse(req, res, next) {
        var origin = res.__proto__;
        Response.__proto__ = origin;
        res.__proto__ = Response;
        origin = null;

        next();
    });
}