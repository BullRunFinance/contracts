const Web3 = require('web3')
const rpcURL = "https://data-seed-prebsc-1-s1.binance.org:8545"
const web3 = new Web3(rpcURL)

const BullToken = artifacts.require("BullToken");
const BUSDToken = artifacts.require("BUSDToken");
const TestToken = artifacts.require("TestToken");
const Masterchef = artifacts.require("Masterchef");
const RewardDistribution = artifacts.require("RewardDistribution");
const BullReferral = artifacts.require("BullReferral");
const BullNFT = artifacts.require("BullNFT");

function toWei(n){
  n = n.toString()
  return web3.utils.toWei(n, 'ether')
}

function toEth(n){
  n = n.toString()
  return parseFloat(web3.utils.fromWei(n, 'ether'))
}

module.exports = async function (deployer, network, accounts) {
  const INT_MAX = "115792089237316195423570985008687907853269984665640564039457584007913129639935"
  const owner = "0x4363d1ECdb8818C698981f65A7053AeDF576B1dC"
  const operator = "0x27e74B3c51e68dD4C5E456fedC1ae4A0b90D02ec"
  const nacho = "0x3a640273A4a62F7C2C9B903916D15D22FE77d356"
  const goldenBull = 1;
  const silverBull = 2;
  const bronzeBull = 3;
  const thePatientBull = 4;
  const thePersistentBull = 5;
  const bullseye = 6;
  const missedBull = 7;
  const goldebBullLotteryTicket = 8;
  const bullFarmer = 9;

  await deployer.deploy(BullToken);
  const bullToken = await BullToken.deployed();

  await deployer.deploy(BUSDToken);
  const busdToken = await BUSDToken.deployed();
/*
  await deployer.deploy(TestToken);
*/
  await deployer.deploy(BullNFT);
  const bullNFT = await BullNFT.deployed();

  const blockNumber = await web3.eth.getBlockNumber();
  await deployer.deploy(Masterchef, bullToken.address, bullNFT.address, owner, (20*10**18).toString(), blockNumber);
  const masterchef = await Masterchef.deployed();

  await deployer.deploy(RewardDistribution, busdToken.address, masterchef.address, blockNumber + 100000);
  const rewardDistribution = await RewardDistribution.deployed();

  await deployer.deploy(BullReferral);
  const bullReferral = await BullReferral.deployed();

  /* Create NFTs */

  await bullNFT.createBoost(owner, 10, 5000);
  await bullNFT.createBoost(owner, 10, 2500);
  await bullNFT.createBoost(owner, 10, 1000);
  await bullNFT.createBoost(owner, 10, 3600);
  await bullNFT.createBoost(owner, 10, 3600);
  await bullNFT.createBoost(owner, 10, 1000);
  await bullNFT.createBoost(owner, 10, 1000);
  await bullNFT.createBoost(owner, 10, 0);
  await bullNFT.createBoost(owner, 10, 2000);

  /* Testing conditions */

  // Mintear NFTs (testing)
  await bullNFT.mint(bullFarmer, owner);
  await bullNFT.mint(bullFarmer, nacho);

  await bullNFT.updateMiner(bullFarmer, masterchef.address);

  // Mintear tokens
  await bullToken.mint(owner, toWei('5000000'))
  await bullToken.mint(nacho, toWei('10000'))
  await busdToken.mint(owner, toWei('1000000'))

  // Depositar rewards
  await busdToken.approve(rewardDistribution.address, INT_MAX)
  await rewardDistribution.depositRewards(toWei('500000'))

  /* Config contracts */

  await bullToken.setExcludedFromAntiWhale(masterchef.address, true)

  await busdToken.approve(rewardDistribution.address, INT_MAX)

  await masterchef.setRewardDistribution(rewardDistribution.address)

  await masterchef.setBullReferral(bullReferral.address)

  await bullToken.transferOwnership(masterchef.address)

  await bullReferral.updateOperator(masterchef.address, true)

  /* Add pools */

  await masterchef.add(1000, bullToken.address, 0, 3600, 0, 1)
  await masterchef.add(1000, busdToken.address, 0, 0, 0, 0)

};