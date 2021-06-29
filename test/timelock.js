const { assert } = require('chai');
const helper = require("./helpers/truffleTestHelper");
const { expectRevert, time } = require('@openzeppelin/test-helpers');

const BullToken = artifacts.require("BullToken");
const BUSDToken = artifacts.require("BUSDToken");
const Masterchef = artifacts.require("Masterchef");
const RewardDistribution = artifacts.require("RewardDistribution");
const BullReferral = artifacts.require("BullReferral");
const BullNFT = artifacts.require("BullNFT");
const Timelock = artifacts. require("Timelock");

require('chai')
  .use(require('chai-as-promised'))
  .should()

function toWei(n){
  n = n.toString()
  return web3.utils.toWei(n, 'ether')
}

function toEth(n){
  n = n.toString()
  return parseFloat(web3.utils.fromWei(n, 'ether'))
}

contract("Masterchef", async([owner, investor, referrer]) => {
  let blockNumber
  let bullNFT, bullToken, busdToken, masterchef, rewardDistribution, bullReferral, timelock
  
  before(async() =>{
    bullToken = await BullToken.new()
    busdToken = await BUSDToken.new()
    bullNFT = await BullNFT.new()
    blockNumber = await web3.eth.getBlockNumber()
    bullReferral = await BullReferral.new()
    masterchef = await Masterchef.new(bullToken.address, bullNFT.address, bullReferral.address, investor, (20*10**18).toString(), blockNumber)
    rewardDistribution = await RewardDistribution.new(busdToken.address, masterchef.address, blockNumber, blockNumber + 10000)
    await expectRevert(
      Timelock.new(owner, 21599),
      "Timelock::constructor: Delay must exceed minimum delay."
    )
    timelock = await Timelock.new(owner, 21600)
  })

  describe("Config contracts", async() =>{
    it("set referral contract", async() =>{
      await bullReferral.updateOperator(masterchef.address, true)
      assert.equal(await bullReferral.operators(masterchef.address), true)
    })

    it("set distribution contract", async() =>{
      await masterchef.setRewardDistribution(rewardDistribution.address)
      assert.equal(await masterchef.rewardDistribution(), rewardDistribution.address)
    })
  })

  describe("Assign ownerships", async() => {
    it("assign masterchef to bullToken", async() => {
      await bullToken.transferOwnership(masterchef.address)
      assert.equal(await bullToken.getOwner(), masterchef.address)
    })

    it("assign timelock to masterchef", async() => {
      await masterchef.transferOwnership(timelock.address)
      assert.equal(await masterchef.owner(), timelock.address)
    })
  })

  let packedArgs, eta, allocPoint, depositFee, harvestInterval, signature, txHash, delay

  async function processTransaction(type, contractAddress){
    if(type == 'queue'){
      await timelock.queueTransaction(
        contractAddress, 
        '0', 
        signature, 
        packedArgs, 
        eta
      )
    }else{
      await timelock.executeTransaction(
        contractAddress, 
        '0', 
        signature, 
        packedArgs, 
        eta
      )
    }
  }

  describe("Config masterchef cross timelock", async () => {
    it("queue add pool bullToken", async() => {
      allocPoint = '1000'
      depositFee = '0'
      harvestInterval = '3600'
      blockNumber = await web3.eth.getBlockNumber()
      eta = (await web3.eth.getBlock(blockNumber)).timestamp + 21650
      signature = 'add(uint32,address,uint16,uint32,bool)'

      packedArgs = web3.eth.abi.encodeParameters(
        ['uint32', 'address', 'uint16', 'uint32', 'bool'], 
        [
          allocPoint, 
          bullToken.address, 
          depositFee,
          harvestInterval, 
          'true'
        ]
      )
      txHash = await web3.utils.soliditySha3(packedArgs)

      assert(!(await timelock.queuedTransactions(txHash)), "Queue transaction error.")

      await processTransaction('queue', masterchef.address)

      assert((await timelock.queuedTransactions(txHash)).toString(), "Transaction hasn't been queued.")
    })

    it("execute add pool bullToken", async() => {
      assert.equal((await masterchef.poolLength()).toString(), 0)

      await expectRevert(
        processTransaction('execute', masterchef.address),
        "Timelock::executeTransaction: Transaction hasn't surpassed time lock."
      )

      await helper.advanceTimeAndBlock(21650)

      await processTransaction('execute', masterchef.address)

      assert.equal((await masterchef.poolLength()).toString(), 1)
      assert.equal((await masterchef.poolInfo(0)).lpToken, bullToken.address)
      assert.equal((await masterchef.poolInfo(0)).harvestInterval, harvestInterval)
    })

    it("queue add pool busdToken", async() => {
      allocPoint = '1000'
      depositFee = '400'
      harvestInterval = '7200'
      blockNumber = await web3.eth.getBlockNumber()
      eta = (await web3.eth.getBlock(blockNumber)).timestamp + 21650
      signature = 'add(uint32,address,uint16,uint32,bool)'

      packedArgs = web3.eth.abi.encodeParameters(
        ['uint32', 'address', 'uint16', 'uint32', 'bool'], 
        [
          allocPoint, 
          busdToken.address, 
          depositFee,
          harvestInterval, 
          'true'
        ]
      )
      txHash = await web3.utils.soliditySha3(packedArgs)

      assert(!(await timelock.queuedTransactions(txHash)), "Queue transaction error.")

      await processTransaction('queue', masterchef.address)

      assert((await timelock.queuedTransactions(txHash)).toString(), "Transaction hasn't been queued.")
    })

    it("execute add pool busdToken", async() => {
      assert.equal((await masterchef.poolLength()).toString(), 1)

      await expectRevert(
        processTransaction('execute', masterchef.address),
        "Timelock::executeTransaction: Transaction hasn't surpassed time lock."
      )

      await helper.advanceTimeAndBlock(21650)

      await processTransaction('execute', masterchef.address)

      assert.equal((await masterchef.poolLength()).toString(), 2)
      assert.equal((await masterchef.poolInfo(1)).lpToken, busdToken.address)
      assert.equal(parseInt((await masterchef.poolInfo(1)).depositFeeBP), depositFee)
      assert.equal(parseInt((await masterchef.poolInfo(1)).harvestInterval), harvestInterval)
    })
  })

  describe("Modify timelock delay", async () => {
    it("queue setDelay transaction", async() => {
      delay = '28800'
      blockNumber = await web3.eth.getBlockNumber()
      eta = (await web3.eth.getBlock(blockNumber)).timestamp + 21650
      signature = 'setDelay(uint256)'

      packedArgs = web3.eth.abi.encodeParameters(['uint256'], [delay])
      txHash = await web3.utils.soliditySha3(packedArgs)

      assert(!(await timelock.queuedTransactions(txHash)), "Queue transaction error.")

      await timelock.queueTransaction(
        timelock.address, 
        '0', 
        signature, 
        packedArgs, 
        eta
      )

      assert((await timelock.queuedTransactions(txHash)).toString(), "Transaction hasn't been queued.")
    })

    it("execute setDelay transaction", async() => {
      assert.equal((await timelock.delay()).toString(), 21600)

      await expectRevert(
        timelock.executeTransaction(
          timelock.address, 
          '0', 
          signature, 
          packedArgs, 
          eta
        ),
        "Timelock::executeTransaction: Transaction hasn't surpassed time lock."
      )

      await helper.advanceTimeAndBlock(21650)

      await timelock.executeTransaction(
        timelock.address, 
        '0', 
        signature, 
        packedArgs, 
        eta
      )

      assert.equal((await timelock.delay()).toString(), delay)
    })
  })
})