require("../handler");

Jack.Handler.Simple = function() {}

Jack.Handler.Simple.run = function(app, options) {
    var options = options || {};
    
    var handle = Jack.Handler.Simple.process;
    
    var handler = new Packages.org.simpleframework.http.core.Container({
        handle : function(request, response) {
            try {
                handle(request, response);
            } catch (e) {
                print("ERROR: " + e);
                throw e;
            }
        }
    });
    
    var connection = new Packages.org.simpleframework.http.connect.SocketConnection(handler),
        address = new Packages.java.net.InetSocketAddress(options["port"] || 8080);
    
    connection.connect(address);
}

Jack.Handler.Simple.process = function(request, response) {
    var env = {};
    
    // copy HTTP headers over, converting where appropriate
    for (var e = request.getNames().iterator(); e.hasNext();)
    {
        var name = String(e.next()),
            value = String(request.getValue(name)), // FIXME: only gets the first of multiple
            key = name.replace("-", "_").toUpperCase();
        
        if (key != "CONTENT_LENGTH" && key != "CONTENT_TYPE")
            key = "HTTP_" + key;

        print(key + " => " + value);

        env[key] = value;
    }
    
    var address = request.getAddress();

    if (env["HTTP_HOST"])
    {
        var parts = env["HTTP_HOST"].split(":");
        if (parts.length === 2)
        {
            env["SERVER_NAME"] = parts[0];
            env["SERVER_PORT"] = parts[1];
        }
    }
    //else
    //{
    //    env["SERVER_NAME"] = String(address.getDomain() || "");
    //    env["SERVER_PORT"] = String(address.getPort() || "");
    //}
    
    env["SCRIPT_NAME"]        = "";
    env["PATH_INFO"]          = String(request.getTarget() || "");
    
    env["REQUEST_METHOD"]       = String(request.getMethod() || "");
    env["QUERY_STRING"]         = String(request.getQuery().toString());
    env["HTTP_VERSION"]         = "HTTP/"+request.getMajor()+"."+request.getMinor();
    
    env["jack.version"]         = [0,1];
    env["jack.input"]           = null; // FIXME
    env["jack.errors"]          = STDERR;
    env["jack.multithread"]     = true;
    env["jack.multiprocess"]    = true;
    env["jack.run_once"]        = false;
    env["jack.url_scheme"]      = String(address.getScheme());
    
    // call the app
    var result = this.app.invoke(env),
        status = result[0], headers = result[1], body = result[2];
    
    // set the status
    response.setCode(status);
    
    // set the headers
    for (var key in headers) {
        var value = headers[key];
        
        if (value.each) {
            var items = [];
            value.each(function(v) { items.push(v); });
            value = items.join(", ");
        }
        
        response.set(key, String(value));
    }
    
    // output the body, flushing after each write if it's chunked
    var output = response.getPrintStream(),
        chunked_response = HashP.includes(headers, "Transfer-Encoding") && HashP.get(headers, "Transfer-Encoding") !== 'identity';
    
    body.each(function(string) {
        output.print(string);
        
        if (chunked_response)
            response.flushBuffer();
    });
    
    output.close();
}