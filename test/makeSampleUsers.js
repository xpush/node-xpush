var Faker = require('Faker'),
    http = require("http");

var client = http.createClient(8000, "localhost");

for (var i = 0; i< 1000; i++){

  var params = {
  'A'  : 'messengerx',
  'U'  : Faker.Internet.userName(),
  'PW' : '1234',
  'D'  : 'ionic',
  'N'  : '',
  'DT' : {'NM' : Faker.Name.findName(), 'I':'../img/default_image.jpg', 'MG':Faker.Lorem.sentence() } };

  var paramsString = JSON.stringify(params);

  var headers = {
    'Content-Type': 'application/json',
    'Content-Length': paramsString.length
  };

  var options = {
    host: 'stalk-front-s01.cloudapp.net',
    port: 8000,
    path: '/user/register',
    method: 'POST',
    headers: headers
  };


  var req = http.request(options, function(res) {
    res.setEncoding('utf-8');

    var responseString = '';

    res.on('data', function(data) {
      responseString += data;
    });

    res.on('end', function() {
      var resultObject = JSON.parse(responseString);
      console.log(resultObject);
    });
  });

  req.on('error', function(e) {
    console.error(e);
  });

  req.write(paramsString);
  req.end();


}
