var async = require('async');

function genericScan(redis, cmd, key, pattern, each_callback, done_callback) {
    var iter = '0';
    async.doWhilst(
        function (acb) {
            //scan with the current iterator, matching the given pattern
			var args = [iter];
            if (cmd === 'SCAN') {
                if (pattern) {
                    args = args.concat(['MATCH', pattern]);
                }
            } else if ( cmd === 'HSCAN'){
                args = [key].concat(args);
                if (pattern) {
                    args = args.concat(['MATCH', pattern]);
                }
      }
      else {
                args = [key].concat(args);
            }
      console.log(cmd,args);
            redis.send_command(cmd, args, function (err, result) {
                var idx = 0;
                var keys;
                if (err) {
                    acb(err);
                } else {
                    //update the iterator
                    iter = result[0];
                    //each key, limit to 5 pending callbacks at a time
                    if (['SCAN', 'SSCAN'].indexOf(cmd) !== -1) {
                        async.eachSeries(result[1], function (subkey, ecb) {
                            if (cmd === 'SCAN') {
                                redis.type(subkey, function (err, sresult) {
                                    var value;
                                    if (err) {
                                        ecb(err);
                                    } else {
                                        if (sresult === 'string') {
                                            redis.get(subkey, function (err, value) {
                                                if (err) {
                                                    ecb(err);
                                                } else {
                                                    each_callback('string', subkey, null, null, value, ecb);
                                                }
                                            });
                                        } else if (sresult === 'hash') {
                                            genericScan(redis, 'HSCAN', subkey, null, each_callback, ecb);
                                        } else if (sresult === 'set') {
                                            genericScan(redis, 'SSCAN', subkey, null, each_callback, ecb);
                                        } else if (sresult === 'zset') {
                                            genericScan(redis, 'ZSCAN', subkey, null, each_callback, ecb);
                                        } else if (sresult === 'list') {
                                            //each_callback('list', subkey, null, null, ecb);
                                            redis.llen(subkey, function (err, length) {
                                                var idx = 0;
                                                length = parseInt(length);
                                                if (err) {
                                                    ecb(err);
                                                } else {
                                                    async.doWhilst(
                                                        function (wcb) {
                                                            redis.lindex(subkey, idx, function (err, value) {
                                                                each_callback('list', subkey, idx, length, value, wcb);
                                                            });
                                                        },
                                                        function () { idx++; return idx < length; },
                                                        function (err) {
                                                            ecb(err)
                                                        }
                                                    );
                                                }
                                            });
                                    }
                                    }
                                });
                            } else if (cmd === 'SSCAN') {
                                each_callback('set', key, idx, null, subkey, ecb);
                            }
                            idx++;
                        },
                        function (err) {
                            //done with this scan iterator; on to the next
                            acb(err);
                        });
                    } else {
                        var idx = 0;
                        async.doWhilst(
                            function (ecb) {
                                var subkey = result[1][idx];
                                var value = result[1][idx+1];
                                if (cmd === 'HSCAN') {
                                    each_callback('hash', key, subkey, null, value, ecb);
                                } else if (cmd === 'ZSCAN') {
                                    each_callback('zset', key, value, null, subkey, ecb);
                                }
                            },
                            function () {idx += 2; return idx < result[1].length;},
                            function (err) {
                                acb(err);
                            }
                        );
                    }
                }
            });
        },
        //test to see if iterator is done
        function () { return iter != '0'; },
        //done
        function (err) {
            done_callback(err);
        }
    );
}

module.exports = function (args) {
    genericScan(args.redis, args.cmd || 'SCAN', args.key || null, args.pattern, args.each_callback, args.done_callback);
};
