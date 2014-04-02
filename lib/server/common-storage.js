
var singleton = function singleton(){
    var content = {};

    this.set = function(key, data, expire){
        expire = expire || 600000;

        this.remove(key);

        content[key] = {
            data : data,
            timer : setTimeout(function(){
                this.remove(key)
            }.bind(this), expire)
        };
    };

    this.get = function(key){
        if(typeof(content[key]) !== "undefined" && content[key] !== null &&
            typeof(content[key].data) !== "undefined" && content[key].data !== null
        ){
            return content[key].data;
        }
        return null;
    };

    this.remove = function(key){
        if(typeof(content[key]) !== "undefined" && content[key] !== null &&
            typeof(content[key].timer) !== "undefined" && content[key].timer !== null
        ){
            clearTimeout(content[key].timer);
            delete content[key];
        }
    };

    this.getStoreContent = function(){
        return content;
    };

    if(singleton.caller != singleton.getInstance){
        throw new Error("This object cannot be instanciated");
    }
}

singleton.instance = null;

singleton.getInstance = function(){
    if(this.instance === null){
        this.instance = new singleton();
    }
    return this.instance;
}

module.exports = singleton.getInstance();
