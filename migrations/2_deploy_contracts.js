const Web3 = require('web3')
const rpcURL = "HTTP://127.0.0.1:9545"
const web3 = new Web3(rpcURL)

const BullToken = artifacts.require("BullToken");
const BUSDToken = artifacts.require("BUSDToken");
const TestToken = artifacts.require("TestToken");
const Masterchef = artifacts.require("Masterchef");
const RewardDistribution = artifacts.require("RewardDistribution");
const BullReferral = artifacts.require("BullReferral");
const BullRun = artifacts.require("BullRun");
const BullPrediction = artifacts.require("BullPrediction");
// const OraclePrice = artifacts.require("OraclePrice");
const FalseOracle = artifacts.require("FalseOracle");
const BullNFT = artifacts.require("BullNFT");

module.exports = async function (deployer, network, accounts) {
  const operator = accounts[3];

  await deployer.deploy(BullToken);
  const bullToken = await BullToken.deployed();

  await deployer.deploy(BUSDToken);
  const busdToken = await BUSDToken.deployed();

  await deployer.deploy(TestToken);

  await deployer.deploy(BullNFT);
  const bullNFT = await BullNFT.deployed();

  let blockNumber = await web3.eth.getBlockNumber();
  await deployer.deploy(Masterchef, bullToken.address, bullNFT.address, accounts[1], (20*10**18).toString(), blockNumber);
  const masterchef = await Masterchef.deployed();

  await deployer.deploy(RewardDistribution, busdToken.address, masterchef.address, blockNumber + 10000);
  const rewardDistribution = await RewardDistribution.deployed();

  await deployer.deploy(BullReferral);

  await deployer.deploy(BullRun, accounts[1]);

/*  await deployer.deploy(OraclePrice, lpWallet, bullToken.address, busdToken.address)
  const oraclePrice = await OraclePrice.deployed();*/

  await deployer.deploy(FalseOracle);
  const falseOracle = await FalseOracle.deployed();

  await deployer.deploy(BullPrediction, bullToken.address, falseOracle.address, operator, 300, 60, "1000000000000000");
};