const { assert } = require('chai');
const helper = require("./helpers/truffleTestHelper");

const BullToken = artifacts.require("BullToken");
const BUSDToken = artifacts.require("BUSDToken");
const TestToken = artifacts.require("TestToken"); 
const Masterchef = artifacts.require("Masterchef");
const RewardDistribution = artifacts.require("RewardDistribution");
const BullReferral = artifacts.require("BullReferral");
const BullNFT = artifacts.require("BullNFT");

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

contract("RewardDistribution", ([owner, investor, referrer]) => {
  let blockNumber
  let INT_MAX = "115792089237316195423570985008687907853269984665640564039457584007913129639935"
  let bullNFT, bullToken, busdToken, masterchef, rewardDistribution, bullReferral, testToken
  
  before(async() =>{
    bullToken = await BullToken.new()
    busdToken = await BUSDToken.new()
    testToken = await TestToken.new()
    bullNFT = await BullNFT.new()
    blockNumber = await web3.eth.getBlockNumber();
    bullReferral = await BullReferral.new()
    masterchef = await Masterchef.new(bullToken.address, bullNFT.address, bullReferral.address,investor, (20*10**18).toString(), blockNumber)
//    console.log("Actual block: ", blockNumber)
    rewardDistribution = await RewardDistribution.new(busdToken.address, masterchef.address, blockNumber, blockNumber + 10000)
  })

  describe("Mint tokens", async() =>{
    it("check mints", async() => {
      await bullToken.mint(owner, toWei('500000'), {from: owner})
      await bullToken.mint(investor, toWei('20000'), {from: owner})
      await busdToken.mint(owner, toWei('510000'), {from: owner})
      await busdToken.mint(investor, toWei('10000'), {from: owner})
      await testToken.mint(owner, toWei('10000'), {from: owner})
      await testToken.mint(investor, toWei('10000'), {from: owner})

      assert.equal(toEth(await bullToken.totalSupply()), 520000)
      assert.equal(toEth(await busdToken.totalSupply()), 520000)
      assert.equal(toEth(await testToken.totalSupply()), 20000)
    })

    it("check balances", async() => {
      assert.equal(toEth(await bullToken.balanceOf(owner)), 500000)
      assert.equal(toEth(await bullToken.balanceOf(investor)), 20000)
      assert.equal(toEth(await busdToken.balanceOf(owner)), 510000)
      assert.equal(toEth(await busdToken.balanceOf(investor)), 10000)
      assert.equal(toEth(await testToken.balanceOf(owner)), 10000)
      assert.equal(toEth(await testToken.balanceOf(investor)), 10000)
    })
  })

  describe("Config bullToken", async() =>{
    it("exclude masterchef of antiwhale", async() =>{
      await bullToken.setExcludedFromAntiWhale(masterchef.address, true)
      assert.equal(await bullToken.isExcludedFromAntiWhale(masterchef.address), true)
    })
  })

  describe("Config distribution contract", async() => {
    it("approve reward token", async() => {
      await busdToken.approve(rewardDistribution.address, INT_MAX, {from: owner})
      assert.equal(await busdToken.allowance(owner, rewardDistribution.address), INT_MAX)
    })
  })

  describe("Config masterchef", async () => {
    it("set contracts", async() => {
      await masterchef.setRewardDistribution(rewardDistribution.address, {from: owner})
      assert.equal(await masterchef.rewardDistribution(), rewardDistribution.address)
    })

    it("assign bullToken ownership", async() => {
      await bullToken.transferOwnership(masterchef.address, {from: owner})
      assert.equal(await bullToken.getOwner(), masterchef.address)
    })

    it("add pools", async() =>{
      await masterchef.add(1000, bullToken.address, 0, 120, 0, {from: owner})
      assert.equal(await masterchef.poolExistence(bullToken.address), true)

      await masterchef.add(1000, busdToken.address, 0, 120, 0, {from: owner})
      assert.equal(await masterchef.poolExistence(busdToken.address), true)

      await masterchef.add(1000, testToken.address, 0, 120, 1, {from: owner})
      assert.equal(await masterchef.poolExistence(testToken.address), true)
      assert.equal((await rewardDistribution.poolInfo(2))[0], (await masterchef.poolInfo(2))[0])

      assert.equal(await masterchef.poolLength(), 3)
    })
  })

  describe("Config bullReferral contract", async() =>{
    it("assing masterchef as operator", async() =>{
      await bullReferral.updateOperator(masterchef.address, true, {from: owner})
      assert.equal(await bullReferral.operators(masterchef.address), true)
    })
  })

  describe("Masterchef transactions", async () => {
    it("approve tokens", async () => {
      await bullToken.approve(masterchef.address, INT_MAX, {from: owner})
      assert.equal(await bullToken.allowance(owner, masterchef.address), INT_MAX)

      await bullToken.approve(masterchef.address, INT_MAX, {from: investor})
      assert.equal(await bullToken.allowance(investor, masterchef.address), INT_MAX)
      
      await busdToken.approve(masterchef.address, INT_MAX, {from: owner})
      assert.equal(await busdToken.allowance(owner, masterchef.address), INT_MAX)

      await busdToken.approve(masterchef.address, INT_MAX, {from: investor})
      assert.equal(await busdToken.allowance(investor, masterchef.address), INT_MAX)

      await testToken.approve(masterchef.address, INT_MAX, {from: owner})
      assert.equal(await testToken.allowance(owner, masterchef.address), INT_MAX)

      await testToken.approve(masterchef.address, INT_MAX, {from: investor})
      assert.equal(await testToken.allowance(investor, masterchef.address), INT_MAX)
    })

    it("deposit", async() =>{
      
      await masterchef.deposit(0, toWei(500), referrer, {from: owner})
      assert.equal(toEth((await masterchef.userInfo(0,owner))[0]), (500*0.95))
      assert.equal(toEth(await bullToken.balanceOf(owner)), (500000-500))
      depositBlock = await web3.eth.getBlockNumber()

      await masterchef.deposit(0, toWei(500), referrer, {from: investor})
      assert.equal(toEth((await masterchef.userInfo(0, investor))[0]), (500*0.95))
      assert.equal(toEth(await bullToken.balanceOf(investor)), (20000-500))

      await masterchef.deposit(1, toWei(1000), referrer, {from: owner})
      assert.equal(toEth((await masterchef.userInfo(1,owner))[0]), (1000))
      assert.equal(toEth(await busdToken.balanceOf(owner)), (510000-1000))

      await masterchef.deposit(1, toWei(1000), referrer, {from: investor})
      assert.equal(toEth((await masterchef.userInfo(1,investor))[0]), (1000))
      assert.equal(toEth(await busdToken.balanceOf(investor)), (10000-1000))

      await masterchef.deposit(2, toWei(1000), referrer, {from: owner})
      assert.equal(toEth((await masterchef.userInfo(2,owner))[0]), (1000))
      assert.equal(toEth(await testToken.balanceOf(owner)), (10000-1000))

      await masterchef.deposit(2, toWei(1000), referrer, {from: investor})
      assert.equal(toEth((await masterchef.userInfo(2,investor))[0]), (1000))
      assert.equal(toEth(await testToken.balanceOf(investor)), (10000-1000))
    })
  })

  describe("rewardDistribution test 4%", async() =>{

    async function depositRewards(){
      let previousBalance = toEth(await busdToken.balanceOf(rewardDistribution.address))
      let depositAmount =  toEth(await busdToken.balanceOf(owner)) * 4 / 100
      let previousOwnerBalance = toEth(await busdToken.balanceOf(owner))

      await rewardDistribution.depositRewards(toWei(depositAmount), {from: owner})
      assert.equal(toEth(await busdToken.balanceOf(rewardDistribution.address)).toFixed(5), (previousBalance + depositAmount).toFixed(5), "Deposit error")
      assert.equal(toEth(await busdToken.balanceOf(owner)).toFixed(5), (previousOwnerBalance - depositAmount).toFixed(5), "Owner dont't deposit all the balance")

      let blockNumber = await web3.eth.getBlockNumber();
      await rewardDistribution.updateEndBlockRewards(blockNumber + 150, {from: owner})
      assert.equal(parseInt(await rewardDistribution.endBlockRewards()), blockNumber + 150, "Error setting endBlockRewards")
    }

    it("1st deposit rewards", async() =>{
      await depositRewards()
    })

    it("harvest", async() =>{
    
      await helper.advanceTimeAndBlock(120)
      let previousBullBalance
      let previousBUSDBalance

//      console.log("Reward per block")
//      console.log(toEth(await rewardDistribution.rewardPerBlock()))
//      console.log("Reward debt owner")
//      console.log(toEth((await rewardDistribution.userInfo(2, owner))[1]))
//      console.log("Reward debt investor")
//      console.log(toEth((await rewardDistribution.userInfo(2, investor))[1]))
//      console.log("Balance assigned")
//      console.log(toEth(await rewardDistribution.assignedRewards()))
//      console.log("Total balance")
//      console.log(toEth(await busdToken.balanceOf(rewardDistribution.address)))
//      console.log("Balance / Rate")
/*      console.log(
        ((toEth(await busdToken.balanceOf(rewardDistribution.address)) - toEth(await rewardDistribution.assignedRewards())) / 
        toEth(await rewardDistribution.rewardPerBlock()))
        )
        */
//      console.log("Balance to give")
//      console.log(toEth(await busdToken.balanceOf(rewardDistribution.address)) - toEth(await rewardDistribution.assignedRewards()))

//      console.log("Actual pending reward")
//      console.log(toEth(await rewardDistribution.pendingReward(2, owner)))
      previousBullBalance = toEth(await bullToken.balanceOf(owner))
      previousBUSDBalance = toEth(await busdToken.balanceOf(owner))
      await masterchef.deposit(2, 0, referrer, {from: owner})
      assert(toEth(await bullToken.balanceOf(owner)) > previousBullBalance, "Harvest didn't work")
//      console.log("Owner BUSD obtained:")
//      console.log(toEth(await busdToken.balanceOf(owner)) - previousBUSDBalance)


//      console.log("Actual pending reward")
//      console.log(toEth(await rewardDistribution.pendingReward(2, investor)))
      previousBullBalance = toEth(await bullToken.balanceOf(investor))
      previousBUSDBalance = toEth(await busdToken.balanceOf(investor))
      await masterchef.deposit(2, 0, referrer, {from: investor})
      assert(toEth(await bullToken.balanceOf(investor)) > previousBullBalance, "Harvest didn't work")
//      console.log("Investor BUSD obtained:")
//      console.log(toEth(await busdToken.balanceOf(investor)) - previousBUSDBalance)
    })

    it("2nd deposit rewards", async() =>{
      await depositRewards()
    })

    it("harvest", async() =>{
    
      await helper.advanceTimeAndBlock(120)
      let previousBullBalance
      let previousBUSDBalance

//      console.log("Reward per block")
//      console.log(toEth(await rewardDistribution.rewardPerBlock()))
//      console.log("Reward debt owner")
//      console.log(toEth((await rewardDistribution.userInfo(2, owner))[1]))
//      console.log("Reward debt investor")
//      console.log(toEth((await rewardDistribution.userInfo(2, investor))[1]))
//      console.log("Balance assigned")
//      console.log(toEth(await rewardDistribution.assignedRewards()))
//      console.log("Total balance")
//      console.log(toEth(await busdToken.balanceOf(rewardDistribution.address)))
//      console.log("Balance / Rate")
/*      console.log(
        ((toEth(await busdToken.balanceOf(rewardDistribution.address)) - toEth(await rewardDistribution.assignedRewards())) / 
        toEth(await rewardDistribution.rewardPerBlock()))
        )
        */
//      console.log("Balance to give")
//      console.log(toEth(await busdToken.balanceOf(rewardDistribution.address)) - toEth(await rewardDistribution.assignedRewards()))

//      console.log("Actual pending reward")
//      console.log(toEth(await rewardDistribution.pendingReward(2, owner)))
      previousBullBalance = toEth(await bullToken.balanceOf(owner))
      previousBUSDBalance = toEth(await busdToken.balanceOf(owner))
      await masterchef.deposit(2, 0, referrer, {from: owner})
      assert(toEth(await bullToken.balanceOf(owner)) > previousBullBalance, "Harvest didn't work")
//      console.log("Owner BUSD obtained:")
//      console.log(toEth(await busdToken.balanceOf(owner)) - previousBUSDBalance)


//      console.log("Actual pending reward")
//      console.log(toEth(await rewardDistribution.pendingReward(2, investor)))
      previousBullBalance = toEth(await bullToken.balanceOf(investor))
      previousBUSDBalance = toEth(await busdToken.balanceOf(investor))
      await masterchef.deposit(2, 0, referrer, {from: investor})
      assert(toEth(await bullToken.balanceOf(investor)) > previousBullBalance, "Harvest didn't work")
//      console.log("Investor BUSD obtained:")
//      console.log(toEth(await busdToken.balanceOf(investor)) - previousBUSDBalance)
    })

    it("3rd deposit rewards", async() =>{
      await depositRewards()
    })

    it("harvest", async() =>{
    
      await helper.advanceTimeAndBlock(120)
      let previousBullBalance
      let previousBUSDBalance

//      console.log("Reward per block")
//      console.log(toEth(await rewardDistribution.rewardPerBlock()))
//      console.log("Reward debt owner")
//      console.log(toEth((await rewardDistribution.userInfo(2, owner))[1]))
//      console.log("Reward debt investor")
//      console.log(toEth((await rewardDistribution.userInfo(2, investor))[1]))
//      console.log("Balance assigned")
//      console.log(toEth(await rewardDistribution.assignedRewards()))
//      console.log("Total balance")
//      console.log(toEth(await busdToken.balanceOf(rewardDistribution.address)))
//      console.log("Balance / Rate")
/*      console.log(
        ((toEth(await busdToken.balanceOf(rewardDistribution.address)) - toEth(await rewardDistribution.assignedRewards())) / 
        toEth(await rewardDistribution.rewardPerBlock()))
        )
        */
//      console.log("Balance to give")
//      console.log(toEth(await busdToken.balanceOf(rewardDistribution.address)) - toEth(await rewardDistribution.assignedRewards()))

//      console.log("Actual pending reward")
//      console.log(toEth(await rewardDistribution.pendingReward(2, owner)))
      previousBullBalance = toEth(await bullToken.balanceOf(owner))
      previousBUSDBalance = toEth(await busdToken.balanceOf(owner))
      await masterchef.deposit(2, 0, referrer, {from: owner})
      assert(toEth(await bullToken.balanceOf(owner)) > previousBullBalance, "Harvest didn't work")
//      console.log("Owner BUSD obtained:")
//      console.log(toEth(await busdToken.balanceOf(owner)) - previousBUSDBalance)


//      console.log("Actual pending reward")
//      console.log(toEth(await rewardDistribution.pendingReward(2, investor)))
      previousBullBalance = toEth(await bullToken.balanceOf(investor))
      previousBUSDBalance = toEth(await busdToken.balanceOf(investor))
      await masterchef.deposit(2, 0, referrer, {from: investor})
      assert(toEth(await bullToken.balanceOf(investor)) > previousBullBalance, "Harvest didn't work")
//      console.log("Investor BUSD obtained:")
//      console.log(toEth(await busdToken.balanceOf(investor)) - previousBUSDBalance)
    })

    it("4th deposit rewards", async() =>{
      await depositRewards()
    })
  })

  describe("Hard test", async() =>{
    it("withdraw all the funds", async() =>{
      for(let x = 0; x < 200; x++){
        helper.advanceBlock()
      }

      await helper.advanceTimeAndBlock(120)
      
      let previousBalanceHolded
      let previousBullBalance

//      console.log("Reward per block")
//      console.log(toEth(await rewardDistribution.rewardPerBlock()))
//      console.log("Reward debt owner")
//      console.log(toEth((await rewardDistribution.userInfo(2, owner))[1]))
//      console.log("Reward debt investor")
//      console.log(toEth((await rewardDistribution.userInfo(2, investor))[1]))
//      console.log("Balance assigned")
//      console.log(toEth(await rewardDistribution.assignedRewards()))
//      console.log("Total balance")
//      console.log(toEth(await busdToken.balanceOf(rewardDistribution.address)))
//      console.log("Balance / Rate")
/*      console.log(
        ((toEth(await busdToken.balanceOf(rewardDistribution.address)) - toEth(await rewardDistribution.assignedRewards())) / 
        toEth(await rewardDistribution.rewardPerBlock()))
        )
        */
//      console.log("Balance to give")
//      console.log(toEth(await busdToken.balanceOf(rewardDistribution.address)) - toEth(await rewardDistribution.assignedRewards()))

      let prevoiusBalance
      let stakedBalance

      prevoiusBalance = toEth(await bullToken.balanceOf(owner))
      stakedBalance = toEth((await masterchef.userInfo(0, owner))[0])
      await masterchef.withdraw(0, (await masterchef.userInfo(0, owner))[0], {from: owner})
      assert.equal(toEth((await masterchef.userInfo(0, owner))[0]), 0, "Staked tokens remained")
      assert(toEth(await bullToken.balanceOf(owner)) > prevoiusBalance, "Nothing unstaked")

      prevoiusBalance = toEth(await bullToken.balanceOf(investor))
      stakedBalance = toEth((await masterchef.userInfo(0, investor))[0])
      await masterchef.withdraw(0, (await masterchef.userInfo(0, investor))[0], {from: investor})
      assert.equal(toEth((await masterchef.userInfo(0, investor))[0]), 0, "Staked tokens remained")
      assert(toEth(await bullToken.balanceOf(investor)) > prevoiusBalance, "Nothing unstaked")

      prevoiusBalance = toEth(await busdToken.balanceOf(owner))
      stakedBalance = toEth((await masterchef.userInfo(1, owner))[0])
      await masterchef.withdraw(1, (await masterchef.userInfo(1, owner))[0], {from: owner})
      assert.equal(toEth((await masterchef.userInfo(1, owner))[0]), 0, "Staked tokens remained")
      assert(toEth(await busdToken.balanceOf(owner)) > prevoiusBalance, "Nothing unstaked")

      prevoiusBalance = toEth(await busdToken.balanceOf(investor))
      stakedBalance = toEth((await masterchef.userInfo(1, investor))[0])
      await masterchef.withdraw(1, (await masterchef.userInfo(1, investor))[0], {from: investor})
      assert.equal(toEth((await masterchef.userInfo(1, investor))[0]), 0, "Staked tokens remained")
      assert(toEth(await busdToken.balanceOf(investor)) > prevoiusBalance, "Nothing unstaked")

//      console.log("Actual pending reward")
//      console.log(toEth(await rewardDistribution.pendingReward(2, owner)))
      previousBullBalance = toEth(await bullToken.balanceOf(owner))
      previousBUSDBalance = toEth(await busdToken.balanceOf(owner))
      prevoiusBalance = toEth(await busdToken.balanceOf(owner))
      stakedBalance = toEth((await masterchef.userInfo(2, owner))[0])
      await masterchef.withdraw(2, (await masterchef.userInfo(2, owner))[0], {from: owner})
      assert.equal(toEth((await masterchef.userInfo(2, owner))[0]), 0, "Staked tokens remained")
      assert(toEth(await busdToken.balanceOf(owner)) > prevoiusBalance, "Nothing unstaked")
      assert(toEth(await bullToken.balanceOf(owner)) > previousBullBalance, "Harvest didn't work")
//      console.log("Owner BUSD obtained:")
//      console.log(toEth(await busdToken.balanceOf(owner)) - previousBUSDBalance)

//      console.log("Actual pending reward")
//      console.log(toEth(await rewardDistribution.pendingReward(2, investor)))
      previousBullBalance = toEth(await bullToken.balanceOf(investor))
      previousBUSDBalance = toEth(await busdToken.balanceOf(investor))
      prevoiusBalance = toEth(await busdToken.balanceOf(investor))
      stakedBalance = toEth((await masterchef.userInfo(2, investor))[0])
      await masterchef.withdraw(2, (await masterchef.userInfo(2, investor))[0], {from: investor})
      assert.equal(toEth((await masterchef.userInfo(2, investor))[0]), 0, "Staked tokens remained")
      assert(toEth(await busdToken.balanceOf(investor)) > prevoiusBalance, "Nothing unstaked")
      assert(toEth(await bullToken.balanceOf(investor)) > previousBullBalance, "Harvest didn't work")
//      console.log("Investor BUSD obtained:")
//      console.log(toEth(await busdToken.balanceOf(investor)) - previousBUSDBalance)

//      console.log("---------All this values should be zero---------")
//      console.log("Reward debt owner")
//      console.log(toEth((await rewardDistribution.userInfo(2, owner))[1]))
//      console.log("Reward debt investor")
//      console.log(toEth((await rewardDistribution.userInfo(2, investor))[1]))
//      console.log("Balance assigned")
//      console.log(toEth(await rewardDistribution.assignedRewards()))
//      console.log("Total balance")
//      console.log(toEth(await busdToken.balanceOf(rewardDistribution.address)))
    })
  })
});