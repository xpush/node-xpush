var fs = require('fs');

function Pid(path) {
  this.path_ = path;
}

Pid.prototype.remove = function () {
  return module.exports.remove(this.path_);
};

Pid.prototype.removeOnExit = function () {
  process.on('exit', this.remove.bind(this));
};

function create(path, force) {

  try {

    var pid = new Buffer(process.pid + '\n');

    var fd = fs.openSync(path, force ? 'w' : 'wx');
    var offset = 0;

    while (offset < pid.length) {
      offset += fs.writeSync(fd, pid, offset, pid.length - offset);
    }

    fs.closeSync(fd);

  } catch (e) {
    console.error('\n  ** Error on startup ** \n', e, '\n');
    process.exit(0); //throw new Error(e);
  }

  return new Pid(path);
}

function remove(path) {
  try {
    fs.unlinkSync(path);
    return true;
  } catch (err) {
    return false;
  }
}

module.exports.create = create;
module.exports.remove = remove;