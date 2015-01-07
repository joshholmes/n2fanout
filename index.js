var nitrogen = require('nitrogen');
var Store = require('nitrogen-file-store');

var config = {
    host: process.env.HOST_NAME || 'api.nitrogen.io',
    http_port: process.env.PORT || 443,
    protocol: process.env.PROTOCOL || 'https',
    api_key: "0dec2ee8e45d4bc660a749feb8f2e978"
};

config.store = new Store(config);

var simpleFanout = new nitrogen.Device({
    nickname: 'simpleFanout',
    name: 'My Nitrogen Fanout Device',
    tags: ['sends:_isOn', 'executes:_lightOn'],
    api_key: config.api_key
});

function simpleManager() {
    nitrogen.CommandManager.apply(this, arguments);
}

simpleManager.prototype = Object.create(nitrogen.CommandManager.prototype);
simpleManager.prototype.constructor = simpleManager;

simpleManager.prototype.isCommand = function(message) {
    console.log("isCommand");
    return message.is('_lightOn');
};

simpleManager.prototype.obsoletes = function(downstreamMsg, upstreamMsg) {
    if (nitrogen.CommandManager.obsoletes(downstreamMsg, upstreamMsg))
        return true;

    var value = downstreamMsg.is("_isOn") &&
                downstreamMsg.isResponseTo(upstreamMsg) &&
                upstreamMsg.is("_lightOn");

    return value;
};

simpleManager.prototype.isRelevant = function(message) {
    console.log("isRelevant");
    var relevant = ( (message.is('_lightOn') || message.is('_isOn')) &&
                     (!this.device || message.from === this.device.id || message.to == this.device.id));

    return relevant;
};

simpleManager.prototype.executeQueue = function(callback) {
    console.log("executeQueue");
    var self = this;

    if (!this.device) return callback(new Error('no device attached to control manager.'));

    // This looks at the list of active commands and returns if there's no commands to process.
    var activeCommands = this.activeCommands();
    if (activeCommands.length === 0) {
        this.session.log.warn('simpleManager::executeQueue: no active commands to execute.');
        return callback();
    }

    var lightOn;
    var commandIds = [];

      console.log("here");

      //var listOfPrincipals = getPrincipals(sessionHold);

    activeCommands.forEach(function(activeCommand) {
          commandIds.push(activeCommand.id);
    });
    // Here we are going to find the final state and but collect all the active command ids because we'll use them in a moment.
    activeCommands.forEach(function(activeCommand) {
      console.log("activeCommand: " + JSON.stringify(activeCommand));


        for (var i = 0; i < listOfPrincipals.length; i++) {
            var currentId = listOfPrincipals[i].id;

            if (currentId != self.device.id) {
            console.log(listOfPrincipals[i].name + ": " + currentId);

            console.log("activeCommand is " + JSON.stringify(activeCommand));

            var message = new nitrogen.Message({
                type: activeCommand.type,
                tags: nitrogen.CommandManager.commandTag(listOfPrincipals[i].id),
                body: {
                },
                response_to: commandIds
            });
            message.body = activeCommand.body;
            message.to = currentId;

            console.log("Sending to " + currentId);
            console.log(JSON.stringify(message));

            message.send(self.session, function(err, message) {
                if (err) return callback(err);


                // need to callback if there aren't any issues so commandManager can proceed.
                return callback();
            });
        }

        }
    });

    // This is the response to the _lightOn command.
    // Notice the response_to is the array of command ids from above. This is used in the obsoletes method above as well.
    var message = new nitrogen.Message({
        type: '_isOn',
        tags: nitrogen.CommandManager.commandTag(self.device.id),
        body: {
            command: {
                message: "Light (" + simpleFanout.id + ") is " + JSON.stringify(lightOn) + " at " + Date.now()
            }
        },
        response_to: commandIds
    });

    message.send(this.session, function(err, message) {
        if (err) return callback(err);

        // let the command manager know we processed this _lightOn message by passing it the _isOn message.
        self.process(new nitrogen.Message(message));

        // need to callback if there aren't any issues so commandManager can proceed.
        return callback();
    });
}

simpleManager.prototype.start = function(session, callback) {

    var filter = {
        tags: nitrogen.CommandManager.commandTag(this.device.id)
    };

    return nitrogen.CommandManager.prototype.start.call(this, session, filter, callback);
};

var listOfPrincipals;

var service = new nitrogen.Service(config);
service.connect(simpleFanout, function(err, session, simpleFanout) {

//    nitrogen.Principal.impersonate(session, "53fb7533130dcb0f0674df97", function(err, receivedPrincipal, accessToken) {
//        if (err) return console.log(JSON.stringify(err));
//
//        console.log(JSON.stringify(receivedPrincipal));
//    })

      var listOfPrincipals = getPrincipals(session);

    console.log("Connected to Nitrogen");

    new simpleManager(simpleFanout).start(session, function(err, message) {
        if (err) return session.log.error(JSON.stringify(err));
    });

});

var sessionHold;
var listOfPrincipals;

function getPrincipals(session) {
    sessionHold = session;
       var principalsUrl = session.service.config.endpoints.principals;

    session.get({
        url: principalsUrl,
        query: "",
        queryOptions: null,
        json: true
    }, function(err, resp, body) {
        if (err) return console.log(JSON.stringify(err));

        listOfPrincipals = body.principals;

        console.log(JSON.stringify(body));


        console.log("");

        var a = ["a", "b", "c"];
        for (var i = 0; i < listOfPrincipals.length; i++) {
            console.log(listOfPrincipals[i].name + ": " + listOfPrincipals[i].id);
        }

        return listOfPrincipals;

    });

}