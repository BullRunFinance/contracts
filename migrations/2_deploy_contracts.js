const BullToken = artifacts.require("BullToken");
const BUSDToken = artifacts.require("BUSDToken");
const Masterchef = artifacts.require("Masterchef");
const RewardDistribution = artifacts.require("RewardDistribution");
const BullReferral = artifacts.require("BullReferral");
const BullNFT = artifacts.require("BullNFT");
const BullBridge = artifacts.require("BullBridge");

const networkSettings = require('./networkSettings.json')
const Web3 = require('web3')
let web3

const deploySettings = require('./deploySettings.json')

fs = require('fs');

function toWei(n){
  n = n.toString()
  return web3.utils.toWei(n, 'ether')
}

function toEth(n){
  n = n.toString()
  return parseFloat(web3.utils.fromWei(n, 'ether'))
}

let data = []

function pushData(contract){
  data.push(contract.constructor._json.contractName + " " + contract.address)
}

function saveAs(content, name) {
  content = content.replace(/,/g, '\n');
  fs.writeFileSync("addresses deployed/" + name + ".txt", content)
}

module.exports = async function (deployer, network, accounts) {
  const INT_MAX = "115792089237316195423570985008687907853269984665640564039457584007913129639935"
  let { rpcURL } = networkSettings[network]
  web3 = new Web3(rpcURL)

  let { bridge_allowed_chains, masterchef_start_block, rewards_start_block, reward_token_address } = deploySettings[network]

  let owner, operator, tester
  if(network == "develop"){
    [owner, operator, tester] = accounts
  }else{
    ({ owner, operator, tester } = deploySettings["accounts"])
  }
  
  let testingDeploy = !network.includes("mainnet") ? true : false

  let busdToken
  if(testingDeploy){
    await deployer.deploy(BUSDToken, {from: owner});
    busdToken = await BUSDToken.deployed();
    pushData(busdToken)

    reward_token_address = busdToken.address

    masterchef_start_block = await web3.eth.getBlockNumber();
    rewards_start_block = await web3.eth.getBlockNumber() + 10000;
  }

  /* Deploy contracts */

  await deployer.deploy(BullToken, {from: owner});
  const bullToken = await BullToken.deployed();
  pushData(bullToken)

  await deployer.deploy(BullNFT, {from: owner});
  const bullNFT = await BullNFT.deployed();
  pushData(bullNFT)
  
  await deployer.deploy(Masterchef, bullToken.address, bullNFT.address, owner, (20*10**18).toString(), masterchef_start_block, {from: owner});
  const masterchef = await Masterchef.deployed();
  pushData(masterchef)

  await deployer.deploy(RewardDistribution, reward_token_address, masterchef.address, rewards_start_block, {from: owner});
  const rewardDistribution = await RewardDistribution.deployed();
  pushData(rewardDistribution)

  await deployer.deploy(BullReferral, {from: owner});
  const bullReferral = await BullReferral.deployed();
  pushData(bullReferral)

  await deployer.deploy(BullBridge, {from: owner});
  const bullBridge = await BullBridge.deployed();
  pushData(bullBridge)

  /* Create NFTs */

  await bullNFT.createBoost(owner, 10, 5000, {from: owner}); // goldeBull
  await bullNFT.createBoost(owner, 10, 2500, {from: owner}); // silverBull
  await bullNFT.createBoost(owner, 10, 1000, {from: owner}); // bronzeBull
  await bullNFT.createBoost(owner, 10, 14400, {from: owner}); // thePersistentBull
  await bullNFT.createBoost(owner, 10, 1000, {from: owner}); // bullseye
  await bullNFT.createBoost(owner, 10, 1000, {from: owner}); // missedBull
  await bullNFT.createBoost(owner, 10, 0, {from: owner}); // goldebBullLotteryTicket
  await bullNFT.createBoost(masterchef.address, 10, 2000, {from: owner}); // bullFarmer
  await bullNFT.createBoost(bullBridge.address, 10, 10000, {from: owner}); // theBigBull

  /* Config contracts */

  await bullToken.setExcludedFromAntiWhale(owner, true, {from: owner})

  await bullToken.setExcludedFromTax(owner, true, {from: owner})

  await bullToken.setExcludedFromAntiWhale(masterchef.address, true, {from: owner})

  await masterchef.setRewardDistribution(rewardDistribution.address, {from: owner})

  await masterchef.setBullReferral(bullReferral.address, {from: owner})

  await bullReferral.updateOperator(masterchef.address, true, {from: owner})

  await bullToken.setExcludedFromAntiWhale(bullBridge.address, true, {from: owner})

  await bullToken.setExcludedFromTax(bullBridge.address, true, {from: owner})

  if(testingDeploy){
    // Mint NFTs
    let bullFarmer = 8;

    await bullNFT.updateMiner(bullFarmer, owner, {from: owner});
    await bullNFT.mint(bullFarmer, owner, {from: owner});
    await bullNFT.mint(bullFarmer, tester, {from: owner});

    await bullNFT.updateMiner(bullFarmer, masterchef.address, {from: owner});

    // Mint bull
    await bullToken.mint(owner, toWei('5000000'), {from: owner})
    await bullToken.mint(tester, toWei('10000'), {from: owner})
    await busdToken.mint(owner, toWei('1000000'), {from: owner})

    // Deposit rewards
    await busdToken.approve(rewardDistribution.address, INT_MAX, {from: owner})
    await rewardDistribution.depositRewards(toWei('500000'), {from: owner})

    // Add pools
    await masterchef.add(1000, bullToken.address, 0, 3600, 1, {from: owner})
    await masterchef.add(1000, reward_token_address, 0, 0, 0, {from: owner})
  }

  await bullToken.transferOwnership(masterchef.address, {from: owner})

  /* Config bridge */

  await bullBridge.addToken(0, bullToken.address, (10**18).toString(), bridge_allowed_chains, {from: owner})
  await bullBridge.updateOperator(operator, {from: owner})
  await bullToken.transfer(bullBridge.address, toWei(100000), {from: owner})

  saveAs(data.toString(), network + " main contracts")
};