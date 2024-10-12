var db = require('localstorage-down');
var logs = require('level-logs')(db) // where db is a levelup

logs.append('8', 'hello', function (err) {
  logs.append('107', 'world', function (err) {
    logs.createReadStream('so')
      .on('data', function (data) {
        console.log(data)
      })
  })
})