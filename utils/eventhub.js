var config = require('../config/config');
var utils = require('../utils');

var utf8 = require('utf8');
var crypto = require('crypto');
var request = require('request');
var Agent = require('agentkeepalive');

var eventHubAuth = undefined;

var messages = [];

var keepaliveAgent = new Agent({
  maxSockets: 160,
  maxFreeSockets: 10,
  timeout: 60000,
  freeSocketKeepAliveTimeout: 30000, // free socket keepalive for 30 seconds
});


/**
 * From
 */
function createSharedAccessToken(uri, saName, saKey) {
    if (!uri || !saName || !saKey) {
        throw "AZ EventHub header configuration: Missing required parameter";
    }
    var encoded = encodeURIComponent(uri);
    var now = new Date();
    var week = 60*60*24*7;
    var ttl = Math.round(now.getTime() / 1000) + week;
    var signature = encoded + '\n' + ttl;
    var signatureUTF8 = utf8.encode(signature);
    var hash = crypto.createHmac('sha256', saKey).update(signatureUTF8).digest('base64');
    return 'SharedAccessSignature sr=' + encoded + '&sig=' +
        encodeURIComponent(hash) + '&se=' + ttl + '&skn=' + saName;
}

if (config.azureEventHub.enabled.toString() === 'true') {
    eventHubAuth = createSharedAccessToken(config.azureEventHub.serviceBusUri, config.azureEventHub.saName, config.azureEventHub.saKey);
    utils.log('The AZ EventHub is enabled');
}

/**
 * We make direct HTTP requests to the EventHub because the node EventHub library is still in heavy development (not production ready)
 */
function insertCMXNotification(cmxNotification) {
    if (eventHubAuth) {
        //message = [{Body: '{"Test": 10}'}, {Body: '{"Test": 10}'}];
        //var conten
        //message = [{Body: JSON.stringify(cmxNotification)}];
        //contentLength = JSON.stringify(message).length;
        //message += cmxNotification;

        //message = [ { Body: JSON.stringify(cmxNotification) } ];
        //contentLength = JSON.stringify(message).length;

        var object = { Body: JSON.stringify(cmxNotification) };
        messages.push(object);
        var contentLength = JSON.stringify(messages).length;

        if (contentLength > 128 * 1024) {
            request.post({
                'https-agent': keepaliveAgent,
                'headers': {
                    'Host': config.azureEventHub.serviceBusUri,
                    'Content-Length': contentLength,
                    'Content-Type': 'application/vnd.microsoft.servicebus.json',
                    'Authorization': eventHubAuth,
                    'Origin': '*',
                    'Access-Control-Allow-Credentials': true,
                },
                uri: `https://${config.azureEventHub.serviceBusUri}/${config.azureEventHub.eventHubPath}/messages`,
                method: 'POST',
                body: JSON.stringify(messages)
            },
            function(err, resp, body) {
                if(err){
                    console.log(err);
                }
                else {
                    console.log(resp.statusCode + ': ' + resp.statusMessage + ': ' + resp.body);
                }
            });

            contentLength = 0;
            messages = [];
        }
    }
};
exports.insertCMXNotification = insertCMXNotification;
