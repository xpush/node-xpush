var assert = require("assert");

describe('Array', function() {
    describe('#indexOf()', function() {
        it('should return -1 when the value is not present', function() {
            assert.equal(-1, [1, 2, 3].indexOf(5));
            assert.equal(-1, [1, 2, 3].indexOf(0));
        })
    })
    describe('#indexOf()', function() {
        it('should return value when the value is present', function() {
            assert.equal(0, [1, 2, 3].indexOf(1));
            assert.equal(2, [1, 2, 3].indexOf(3));
        })
    })
    describe('#indexOf()', function() {
        it('should return location(index) of string when the string is present give String', function() {
            var str = "Hello world, welcome to the universe.";
            var n = str.indexOf("welcome");
            var expectingValue =13
            assert.equal(expectingValue, n);
        })
    })
})
