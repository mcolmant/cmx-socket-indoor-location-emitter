var config = require('../config/config');
var utils = require('../utils');

var utf8 = require('utf8');
var crypto = require('crypto');
var request = require('request');

var eventHubAuth = undefined;

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
        var content = JSON.stringify(cmxNotification);

        request.post({
            headers: {
              'Content-Length': content.length,
              'Content-Type': 'application/json;charset=utf-8',
              'Authorization': eventHubAuth,
              'Origin': '*',
              'Access-Control-Allow-Credentials': true
            },
            uri: `https://${config.azureEventHub.serviceBusUri}/${config.azureEventHub.eventHubPath}/messages`,
            method: 'POST',
            body: content
        },
        function(err, resp, body) {
            if(err){
              console.log(err);
            } else {
              console.log(resp.statusCode + ': ' + resp.statusMessage);
            }
        });
    }
};
exports.insertCMXNotification = insertCMXNotification;
