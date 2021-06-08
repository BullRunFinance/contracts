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
  let owner
  let operator
  let tester
  
  if(network == "develop"){
    owner = accounts[0]
    operator = accounts[1]
    tester = accounts[2]
  }else{
    owner = "0x4363d1ECdb8818C698981f65A7053AeDF576B1dC"
    operator = "0x27e74B3c51e68dD4C5E456fedC1ae4A0b90D02ec"
    tester = "0x3a640273A4a62F7C2C9B903916D15D22FE77d356"
  }

  const INT_MAX = "115792089237316195423570985008687907853269984665640564039457584007913129639935"
  const goldenBull = 1;
  const silverBull = 2;
  const bronzeBull = 3;
  const thePersistentBull = 4;
  const bullseye = 5;
  const missedBull = 6;
  const goldebBullLotteryTicket = 7;
  const bullFarmer = 8;
  const theBigBull = 9;

  await deployer.deploy(BullToken, {from: owner});
  const bullToken = await BullToken.deployed();

  await deployer.deploy(BUSDToken, {from: owner});
  const busdToken = await BUSDToken.deployed();
/*
  await deployer.deploy(TestToken);
*/
  await deployer.deploy(BullNFT, {from: owner});
  const bullNFT = await BullNFT.deployed();

  const blockNumber = await web3.eth.getBlockNumber();
  await deployer.deploy(Masterchef, bullToken.address, bullNFT.address, owner, (20*10**18).toString(), blockNumber, {from: owner});
  const masterchef = await Masterchef.deployed();

  await deployer.deploy(RewardDistribution, busdToken.address, masterchef.address, blockNumber + 100000, {from: owner});
  const rewardDistribution = await RewardDistribution.deployed();

  await deployer.deploy(BullReferral, {from: owner});
  const bullReferral = await BullReferral.deployed();

  /* Create NFTs */

  await bullNFT.createBoost(owner, 10, 5000, {from: owner});
  await bullNFT.createBoost(owner, 10, 2500, {from: owner});
  await bullNFT.createBoost(owner, 10, 1000, {from: owner});
  await bullNFT.createBoost(owner, 10, 14400, {from: owner});
  await bullNFT.createBoost(owner, 10, 1000, {from: owner});
  await bullNFT.createBoost(owner, 10, 1000, {from: owner});
  await bullNFT.createBoost(owner, 10, 0, {from: owner});
  await bullNFT.createBoost(owner, 10, 2000, {from: owner});

  /* Testing conditions */

  // Mintear NFTs (testing)
  await bullNFT.mint(bullFarmer, owner, {from: owner});
  await bullNFT.mint(bullFarmer, tester, {from: owner});

  await bullNFT.updateMiner(bullFarmer, masterchef.address, {from: owner});

  // Mintear tokens
  await bullToken.mint(owner, toWei('5000000'), {from: owner})
  await bullToken.mint(tester, toWei('10000'), {from: owner})
  await busdToken.mint(owner, toWei('1000000'), {from: owner})

  // Depositar rewards
  await busdToken.approve(rewardDistribution.address, INT_MAX, {from: owner})
  await rewardDistribution.depositRewards(toWei('500000'), {from: owner})

  /* Config contracts */

  await bullToken.setExcludedFromAntiWhale(masterchef.address, true, {from: owner})

  await busdToken.approve(rewardDistribution.address, INT_MAX, {from: owner})

  await masterchef.setRewardDistribution(rewardDistribution.address, {from: owner})

  await masterchef.setBullReferral(bullReferral.address, {from: owner})

  await bullToken.transferOwnership(masterchef.address, {from: owner})

  await bullReferral.updateOperator(masterchef.address, true, {from: owner})

  /* Add pools */

  await masterchef.add(1000, bullToken.address, 0, 3600, 0, 1, {from: owner})
  await masterchef.add(1000, busdToken.address, 0, 0, 0, 0, {from: owner})

};