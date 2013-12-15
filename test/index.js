var should = require('should');

var npush  = require('../index.js'),
    npush2 = npush.spawnInstance();

should.exist(npush);
npush.should.have.property('init');
npush.init.should.be.an.instanceof(Function);

npush.init({k1: 'v1'});
npush2.init({k2: 'v2'});



