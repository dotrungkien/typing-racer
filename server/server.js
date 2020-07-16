const express = require('express');
const socket = require('socket.io');
const app = express();
const GameEngine = require('./GameEngine');
const rpcWrapperEngine = require('./engine.js');
const EthQuery = require('ethjs-query');
const ethUtil = require('ethereumjs-util');
const gameEngine = new GameEngine();
const config = require('./get-config');
const server = app.listen(4000);
const path = require('path');

console.log('Server running on http://localhost:4000');

const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));

const io = socket(server);

setInterval(updateGame, 16);

io.sockets.on('connection', socket => {
  console.log(`New connection ${socket.id}`);
  gameEngine.createNewPlayer(socket.id);

  socket.on('disconnect', () => {
    io.sockets.emit('disconnect', socket.id);
    gameEngine.removePlayer(socket.id);
  });

  socket.on('keyPressed', key => {
    if (!gameEngine.correctKeyPressed(key, socket.id)) {
      if (!isModifierKey(key)) {
        socket.emit('wrongLetter');
      }
    }
  });

  socket.on('claimReward', ({ address }) => {
    console.log('received claim reward', address);
    claimToWallet(address).then(tx => {
      console.log('claim reward succesuflly, tx hash: ', tx);
      socket.emit('claimSuccess', { address, tx });
    });
  });

  function isModifierKey(key) {
    return key === 'Shift' || key === 'Control' || key === 'Alt';
  }
});

const claimToWallet = async address => {
  const ether = 1e18;
  const amountWei = 0.01 * ether;
  const engine = rpcWrapperEngine({
    rpcUrl: config.rpcOrigin,
    addressHex: config.address,
    privateKey: ethUtil.toBuffer(config.privateKey),
  });
  const ethQuery = new EthQuery(engine);
  try {
    const txHash = await ethQuery.sendTransaction({
      to: address,
      from: config.address,
      value: amountWei,
      data: '',
    });

    return txHash;
  } catch (e) {
    console.log(e);
    return null;
  }
};

function updateGame() {
  gameEngine.updatePlayers();
  io.sockets.emit('heartbeat', gameEngine.players);
  io.sockets.emit('sentence', gameEngine.sentence);
  if (gameEngine.winner && !gameEngine.endGameCountdown) {
    // emit event to show everyone that the game is finished
    io.sockets.emit('winner', gameEngine.winner.id);
    gameEngine.endGameCountdown = setTimeout(() => restartGame(), 5000);
  }
}

function restartGame() {
  // emit event to reset players
  io.sockets.emit('restart');
  gameEngine.restart();
}
