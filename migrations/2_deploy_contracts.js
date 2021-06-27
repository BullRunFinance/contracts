const BullToken = artifacts.require("BullToken");
const BUSDToken = artifacts.require("BUSDToken");
const Masterchef = artifacts.require("Masterchef");
const RewardDistribution = artifacts.require("RewardDistribution");
const BullReferral = artifacts.require("BullReferral");
const BullNFT = artifacts.require("BullNFT");
const BullBridge = artifacts.require("BullBridge");
const BullMarketplace = artifacts.require("BullMarketplace");
const BullLocker = artifacts.require("BullLocker");

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
  fs.writeFileSync("../deploys/" + name + ".txt", content)
}

module.exports = async function (deployer, network, accounts) {
  const INT_MAX = "115792089237316195423570985008687907853269984665640564039457584007913129639935"
  let { rpcURL } = networkSettings[network]
  web3 = new Web3(rpcURL)

  let { bridge_allowed_chains, masterchef_start_block, rewards_start_block, rewards_end_block, reward_token_address } = deploySettings[network]

  let owner = accounts[0]
  let operator, testerA, testerN, testerN2, testerE, testerR, router
  if(network == "develop"){
    [operator, testerA, testerN, testerN2, testerE, testerR, router] = accounts
  }else{
    ({ operator, testerA, testerN, testerN2, testerE, testerR, router } = deploySettings["accounts"])
  }
  
  let testingDeploy = !network.includes("mainnet") ? true : false

  let busdToken
  if(testingDeploy){
    await deployer.deploy(BUSDToken);
    busdToken = await BUSDToken.deployed();
    pushData(busdToken)

    reward_token_address = busdToken.address

    masterchef_start_block = await web3.eth.getBlockNumber();
    rewards_start_block = masterchef_start_block
    rewards_end_block = await web3.eth.getBlockNumber() + 10000;
  }

  /* Deploy contracts */

  await deployer.deploy(BullToken);
  const bullToken = await BullToken.deployed();
  pushData(bullToken)

  await deployer.deploy(BullLocker);
  const bullLocker = await BullLocker.deployed();
  pushData(bullLocker)

  await deployer.deploy(BullNFT);
  const bullNFT = await BullNFT.deployed();
  pushData(bullNFT)
  
  await deployer.deploy(BullReferral);
  const bullReferral = await BullReferral.deployed();
  pushData(bullReferral)

  await deployer.deploy(Masterchef, bullToken.address, bullNFT.address, bullReferral.address, owner, (20*10**18).toString(), masterchef_start_block);
  const masterchef = await Masterchef.deployed();
  pushData(masterchef)

  await deployer.deploy(RewardDistribution, reward_token_address, masterchef.address, rewards_start_block, rewards_end_block);
  const rewardDistribution = await RewardDistribution.deployed();
  pushData(rewardDistribution)

  await deployer.deploy(BullBridge, bullNFT.address);
  const bullBridge = await BullBridge.deployed();
  pushData(bullBridge)

  await deployer.deploy(BullMarketplace, bullToken.address, owner);
  const bullMarketplace = await BullMarketplace.deployed();
  pushData(bullMarketplace)

  /* Create NFTs */

  await bullNFT.createBoost(owner, 10, 5000); // 1 - goldeBull
  await bullNFT.createBoost(owner, 10, 2500); // 2 - silverBull
  await bullNFT.createBoost(owner, 10, 1000); // 3 - bronzeBull
  await bullNFT.createBoost(owner, 10, 14400); // 4 - thePersistentBull
  await bullNFT.createBoost(owner, 10, 4000); // 5 - bullseye
  await bullNFT.createBoost(owner, 10, 2000); // 6 - bullTrader
  await bullNFT.createBoost(owner, 10, 0); // 7 - goldebBullLotteryTicket
  await bullNFT.createBoost(masterchef.address, 10, 3000); // 8 -  bullFarmer
  await bullNFT.createBoost(bullBridge.address, 10, 10000); // 9 - theBigBull

  /* Config contracts */

  await bullToken.updateLpLocker(bullLocker.address)

  await bullToken.updateBullNFTContract(bullNFT.address)

  await bullToken.setExcludedFromAntiWhale(owner, true)

  await bullToken.setExcludedFromTax(owner, true)

  await bullToken.setExcludedFromAntiWhale(masterchef.address, true)

  await masterchef.setRewardDistribution(rewardDistribution.address)

  await bullReferral.updateOperator(masterchef.address, true)

  await bullToken.setExcludedFromAntiWhale(bullBridge.address, true)

  await bullToken.setExcludedFromTax(bullBridge.address, true)

  await bullToken.setExcludedFromAntiWhale(router, true)

  if(testingDeploy){
    // Mint NFTs
    let bullseye = 5;
    let bullTrader = 6;
    let bullFarmer = 8;

    await bullNFT.updateMiner(bullseye, owner);
    await bullNFT.updateMiner(bullTrader, owner);
    await bullNFT.updateMiner(bullFarmer, owner);

    await bullNFT.mint(bullFarmer, owner);
    await bullNFT.mint(bullseye, testerA);
    await bullNFT.mint(bullTrader, testerA);
    await bullNFT.mint(bullFarmer, testerA);
    
    await bullNFT.mint(bullseye, testerN);
    await bullNFT.mint(bullTrader, testerN);
    await bullNFT.mint(bullFarmer, testerN);
    
    await bullNFT.mint(bullseye, testerN2);
    await bullNFT.mint(bullTrader, testerN2);
    await bullNFT.mint(bullFarmer, testerN2);
    
    await bullNFT.mint(bullseye, testerE);
    await bullNFT.mint(bullTrader, testerE);
    await bullNFT.mint(bullFarmer, testerE);

    await bullNFT.mint(bullseye, testerR);
    await bullNFT.mint(bullTrader, testerR);
    await bullNFT.mint(bullFarmer, testerR);
    
    await bullNFT.updateMiner(bullFarmer, masterchef.address);

    // Mint bull
    await bullToken.mint(owner, toWei('5000000'))
    await bullToken.mint(testerA, toWei('10000'))
    await bullToken.mint(testerN, toWei('10000'))
    await bullToken.mint(testerN2, toWei('10000'))
    await bullToken.mint(testerE, toWei('10000'))
    await bullToken.mint(testerR, toWei('10000'))
    await busdToken.mint(owner, toWei('1000000'))

    // Deposit rewards
    await busdToken.approve(rewardDistribution.address, INT_MAX)
    await rewardDistribution.depositRewards(toWei('500000'))

    // Add pools
    await masterchef.add(1000, bullToken.address, 0, 3600, 1)
    await masterchef.add(1000, reward_token_address, 0, 0, 0)
  }

  await bullToken.transferOwnership(masterchef.address)

  /* Config bridge */

  await bullBridge.addToken(0, bullToken.address, (10**18).toString(), bridge_allowed_chains)
  await bullBridge.updateOperator(operator)
  await bullToken.transfer(bullBridge.address, toWei(100000))
  await bullBridge.updateBullNFTContract(bullNFT.address)

  saveAs(data.toString(), network + " main contracts")
};