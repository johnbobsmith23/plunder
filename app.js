const express = require('express');
const app = express();
const path = require('path');
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const port = process.env.PORT || 3000;

server.listen(port, () => {
   console.log(`listening on port ${port}`);
});

app.use(express.static(path.join(__dirname, 'public')));

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