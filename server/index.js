var osc = require("osc"),
    WebSocket = require("ws");
    http = require("http"),
    url = require('url'),
    path = require('path'),
    express = require('express'),
    serverPort = 8080;

// helper function to get local IP address
var getIPAddresses = function () {
    var os = require("os"),
    interfaces = os.networkInterfaces(),
    ipAddresses = [];

    for (var deviceName in interfaces){
        var addresses = interfaces[deviceName];

        for (var i = 0; i < addresses.length; i++) {
            var addressInfo = addresses[i];

            if (addressInfo.family === "IPv4" && !addressInfo.internal) {
                ipAddresses.push(addressInfo.address);
            }
        }
    }

    return ipAddresses;
};


/*---- Express server ----*/
var app = express(),
    server = app.listen(serverPort, function () {
      console.log("http server running, listening to port: " + serverPort);
    });

// serve static file
app.use(express.static(path.join(__dirname, '../web')));

// root router
app.get('/', function (req, res) {
  console.log(__dirname);
  res.sendFile(path.join(__dirname+'/index.html'));
});

/*---- Setup WebSocket establish ----*/
var localSocket;
// browser socket queue
var messages = [];
var wsPort = 8090;
var wss = new WebSocket.Server({
      port: wsPort
});

wss.on("connection", function (socket, request) {
    console.log("WebSocketServer:(connection established)");
    var socketPort = new osc.WebSocketPort({
        socket: socket
    });

    socketPort.on("message", function (oscMsg) {
      var address = oscMsg.address.split('/');
      switch (address[1]) {
        // check identity and feed info back to browser
        case "whoami":
          if (oscMsg.args == "browser") {
            console.log("WebSocketServer:(browser connected)");
          } else if (oscMsg.args == "local") {
            console.log("WebSocketServer:(local server connected)");
            localSocket = this;
          }
          break;
        // if queue is empty then send message else queue the message
        case "d3":
          if (messages.length == 0) {
            if (localSocket) {
              console.log("WebSocketServer:(OSC message received): " + oscMsg.address + " " + oscMsg.args);
              localSocket.send(messages[0]);
              console.log("WebSocketServer:(OSC message send): forward to local server");
            } else {
              console.log("WebSocketServer:(no local server connected)");
              this.send({
                address: "/error",
                args: [{
                  type: "s",
                  value: "nolocalserver"
                }]
              });
            }
          } else {
            messages.push(oscMsg);
            // send queue length back to browser
            this.send({
              address: "/queueLength",
              args: [{
                type: "i",
                value: messages.length
              }]
            });
          }
          break;
        // send message and dequeue messages array
        case "finished":
          // send queued message to local server
          if (localSocket) {
            console.log("WebSocketServer:(OSC message received): " + oscMsg.address + " " + oscMsg.args);
            //console.log(oscMsg.args);
            localSocket.send(messages[0]);
            console.log("WebSocketServer:(OSC message send): forward to local server");
          } else {
            console.log("WebSocketServer:(no local server connected)");
            this.send({
              address: "/error",
              args: [{
                type: "s",
                value: "nolocalserver"
              }]
            });
          }
          // dequeue messages array
          messages.unshift();
          break;
        // receive unused address
        default:
          console.log("WebSocketServer:(unused OSC message received): " + oscMsg.address + " " + oscMsg.args);
      }
    });
});
