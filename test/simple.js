var Backbone    = require('backbone'),
    db          = require('./db'),
    app         = require('../data/app').app;
                  require('../data/model/user');

var users   = new app.Model.Users(),
    u1      = users.create({name:'user1'});

console.log("u1[ %j ], cid[ %s ]", u1, (u1 ? u1.cid : ''));
