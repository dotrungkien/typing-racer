import Terminal from './Terminal.js';
import MasterBranch from './MasterBranch.js';
import PlayersHandler from './PlayersHandler.js';
import CountDown from './CountDown.js';

const Web3Modal = window.Web3Modal.default;
const EvmChains = window.EvmChains;

let web3Modal;
let provider;
let selectedAccount;
let terminal;
let masterBranch;
let countDown = new CountDown();

const socket = io.connect('http://localhost:4000');
const playersHandler = new PlayersHandler();

window.setup = function () {
  createCanvas(innerWidth, innerHeight);
  masterBranch = new MasterBranch();
  terminal = new Terminal();

  registerSocketHandlers();
};

window.onresize = function () {
  resizeCanvas(innerWidth, innerHeight);
  terminal.resize();
};

window.draw = function () {
  background(14, 16, 18);
  if (playersHandler.getPlayer(socket.id)) {
    terminal.updatePlayerCurrentLetter(
      playersHandler.getPlayer(socket.id).currentIndex
    );
  }

  terminal.draw();
  playersHandler.draw();
  masterBranch.draw();
  countDown.draw();
};

window.keyPressed = function (e) {
  e.preventDefault();
  terminal.wrongLetter = false;
  socket.emit('keyPressed', key);
};

function registerSocketHandlers() {
  socket.on('sentence', sentence => terminal.updateSentence(sentence));
  socket.on('heartbeat', players => playersHandler.updatePlayers(players));
  socket.on('disconnect', playerId => playersHandler.removePlayer(playerId));
  socket.on('wrongLetter', () => {
    terminal.wrongLetter = true;
  });
  socket.on('winner', winner => {
    if (winner == socket.id) {
      console.log('You are the winner, claim 0.01ETH');
      socket.emit('claimReward', { address: selectedAccount });
    }
  });
  socket.on('claimSuccess', ({ address, tx }) => {
    if (address === selectedAccount) {
      console.log(`claim reward successfully. tx = ${tx}`);
    }
  });
  socket.on('restart', () => {
    playersHandler.resetPlayers();
    countDown.beginGameStarting();
  });
}

function init() {
  web3Modal = new Web3Modal({
    cacheProvider: false, // optional
    providerOptions: {}, // required
  });
}

async function fetchAccountData() {
  const web3 = new Web3(provider);

  console.log('Web3 instance is', web3);

  const chainId = await web3.eth.getChainId();
  const chainData = await EvmChains.getChain(chainId);
  document.querySelector('#network-name').textContent = chainData.name;

  const accounts = await web3.eth.getAccounts();

  console.log('Got accounts', accounts);
  selectedAccount = accounts[0];

  const balance = web3.utils.fromWei(
    await web3.eth.getBalance(selectedAccount)
  );

  document.querySelector('#selected-account').textContent = selectedAccount;
  document.querySelector('#account-balance').textContent = balance;

  document.querySelector('#prepare').style.display = 'none';
  document.querySelector('#connected').style.display = 'block';
}

async function refreshAccountData() {
  document.querySelector('#connected').style.display = 'none';
  document.querySelector('#prepare').style.display = 'block';
  await fetchAccountData(provider);
}

async function onConnect() {
  console.log('Opening a dialog', web3Modal);
  try {
    provider = await web3Modal.connect();
  } catch (e) {
    console.log('Could not get a wallet connection', e);
    return;
  }

  // Subscribe to accounts change
  provider.on('accountsChanged', accounts => {
    fetchAccountData();
  });

  // Subscribe to chainId change
  provider.on('chainChanged', chainId => {
    fetchAccountData();
  });

  // Subscribe to networkId change
  provider.on('networkChanged', networkId => {
    fetchAccountData();
  });

  await refreshAccountData();
}

async function onDisconnect() {
  console.log('Killing the wallet connection', provider);

  if (provider.close) {
    await provider.close();
    await web3Modal.clearCachedProvider();
    provider = null;
  }

  selectedAccount = null;

  document.querySelector('#prepare').style.display = 'block';
  document.querySelector('#connected').style.display = 'none';
}

window.addEventListener('load', async () => {
  init();
  onConnect();
});
