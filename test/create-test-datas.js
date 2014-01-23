var Faker     = require('Faker'),
    utils     = require('../lib/server/utils'),
    User      = require('../lib/mongodb-persister/user'),
    database  = require('../lib/mongodb-persister/database');

var createUsers = function(rowCount) {

  for(var i = 1; i <= rowCount; i++) {

    var user = new User({
      app: 'testapp',
      userId: Faker.Internet.userName(),
      deviceType: Faker.Helpers.randomize(['web','android','iphone']),
      datas: { 
        name: Faker.Name.findName(),
        email: Faker.Internet.email(),
        password: utils.encrypto('test')
      }
    });

    user.save(function(err, data){
    console.log('asdfadsf');
    console.log(err);
    });

  }
}

 database.config('', 'xpush', function (err, message) {

  createUsers(1000);

  //process.exit(); 

 });

