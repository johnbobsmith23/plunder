const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);
const port = process.env.PORT ?? 3000;

app.use(express.static(__dirname + '/'));

app.get('/', (req, res) => {
   res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
   console.log('a user connected');
   socket.on('disconnect', () => {
      console.log('user disconnected');
   });
   socket.emit('hello', (0));
   socket.on('count', (count) => {
      socket.emit('hello', (count));
   });

   socket.on('updateModel', (mesh) => {
      socket.broadcast.emit('updatePosition', (mesh));
   })
});

server.listen(3000, () => {
   console.log('listening on *:3000');
});