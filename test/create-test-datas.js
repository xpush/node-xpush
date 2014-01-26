var Faker     = require('Faker'),
    utils     = require('../lib/server/utils'),
    User      = require('../lib/mongodb-persister/user'),
    database  = require('../lib/mongodb-persister/database');

var createUsers = function(rowCount) {

  for(var i = 1; i <= rowCount; i++) {

    var user = new User({
      app: 'testapp',
      userId: Faker.Internet.userName(),
      password: utils.encrypto('test'),
      deviceType: Faker.Helpers.randomize(['','android-23ASDFVEASDF435kgr09q3htgfewffeeefwqe','iphone-129774893029834']),
      datas: { 
        name: Faker.Name.findName(),
        email: Faker.Internet.email(),
        password: utils.encrypto('test')
      }
    });

    user.save(function(err, data){
    console.log(err);
    });

  }
}

 database.config('', 'xpush', function (err, message) {

  createUsers(1000);

  //process.exit(); 

 });

