var Faker     = require('Faker'),
    User      = require('../lib/mongodb-persister/user')
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
      }
    });

    user.save();

  }
}

 database.config('', 'xpush', function (err, message) {

  createUsers(100);

  process.exit(); 

 });

