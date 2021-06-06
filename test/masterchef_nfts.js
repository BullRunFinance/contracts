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

contract("Masterchef with NFTs", ([owner, investor, referrer]) => {
  let blockNumber
  let INT_MAX = "115792089237316195423570985008687907853269984665640564039457584007913129639935"
  let bullNFT, bullToken, busdToken, masterchef, rewardDistribution, bullReferral, testToken
  let bullseye = 6;
  let missedBull = 7;
  let bullFarmer = 9;

  before(async() =>{
    bullToken = await BullToken.new()
    busdToken = await BUSDToken.new()
    testToken = await TestToken.new()
    bullNFT = await BullNFT.new()
    blockNumber = await web3.eth.getBlockNumber();
    masterchef = await Masterchef.new(bullToken.address, bullNFT.address, investor, (20*10**18).toString(), blockNumber)
    rewardDistribution = await RewardDistribution.new(busdToken.address, masterchef.address, blockNumber + 150)
    bullReferral = await BullReferral.new()
  })

  describe("Create NFTs", async() => {
    it("create boosts", async() =>{
      for(let i = 0; i <5; i++){
        await bullNFT.createBoost(masterchef.address, 10, 0);
      }
      await bullNFT.createBoost(owner, 10, 1000);
      await bullNFT.createBoost(owner, 10, 1000);
      await bullNFT.createBoost(masterchef.address, 10, 0);
      await bullNFT.createBoost(owner, 10, 2000);

      assert.equal((await bullNFT.nextBoostId()).toString(), "10", "Boosts creation error")
    })

    it("mint first nfts", async() =>{
      await bullNFT.mint(bullseye, owner)
      await bullNFT.mint(bullseye, referrer)
      await bullNFT.mint(missedBull, owner)
      await bullNFT.mint(bullFarmer, investor)
      await bullNFT.mint(bullFarmer, referrer)

      assert.equal((await bullNFT.getBonus(1)).toString(), 1000)
      assert.equal((await bullNFT.getBonus(2)).toString(), 1000)
      assert.equal((await bullNFT.getBonus(3)).toString(), 1000)
      assert.equal((await bullNFT.getBonus(4)).toString(), 2000)
      assert.equal((await bullNFT.getBonus(5)).toString(), 2000)
      
      assert(await bullNFT.hasBoost(owner, bullseye), "owner don`t has boost bullseye");
      assert(await bullNFT.hasBoost(referrer, bullseye), "referrer don`t has boost bullseye");
      assert(await bullNFT.hasBoost(owner, missedBull), "owner don`t has boost missedBull");
      assert(await bullNFT.hasBoost(investor, bullFarmer), "investor don`t has boost bullFarmer");
      assert(await bullNFT.hasBoost(referrer, bullFarmer), "referrer don`t has boost bullFarmer");
    })

    it("update nfts miner to masterchef", async() => {
      await bullNFT.updateMiner(bullFarmer, masterchef.address)

      assert.equal(await bullNFT.getAuthorizedMiner(bullseye), masterchef.address, "Masterchef isn't the bullseye boost miner")
      assert.equal(await bullNFT.getAuthorizedMiner(missedBull), masterchef.address, "Masterchef isn't the missedBull boost miner")
      assert.equal(await bullNFT.getAuthorizedMiner(bullFarmer), masterchef.address, "Masterchef isn't the bullFarmer boost miner")
    })
  })

  describe("Mint tokens", async() =>{
    it("check mints", async() => {
      await bullToken.mint(owner, toWei('500000'), {from: owner})
      await bullToken.mint(investor, toWei('500000'), {from: owner})
      await busdToken.mint(owner, toWei('510000'), {from: owner})
      await busdToken.mint(investor, toWei('10000'), {from: owner})
      await testToken.mint(owner, toWei('10000'), {from: owner})
      await testToken.mint(investor, toWei('10000'), {from: owner})

      assert.equal(toEth(await bullToken.totalSupply()), 1000000)
      assert.equal(toEth(await busdToken.totalSupply()), 520000)
      assert.equal(toEth(await testToken.totalSupply()), 20000)
    })

    it("check balances", async() => {
      assert.equal(toEth(await bullToken.balanceOf(owner)), 500000)
      assert.equal(toEth(await bullToken.balanceOf(investor)), 500000)
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

      await masterchef.setBullReferral(bullReferral.address, {from: owner})
      assert.equal(await masterchef.bullReferral(), bullReferral.address)
    })

    it("assign bullToken ownership", async() => {
      await bullToken.transferOwnership(masterchef.address, {from: owner})
      assert.equal(await bullToken.getOwner(), masterchef.address)
    })

    it("add pools", async() =>{
      await masterchef.add(1000, bullToken.address, 0, 120, 0, 0, {from: owner})
      assert.equal(await masterchef.poolExistence(bullToken.address), true)

      await masterchef.add(1000, busdToken.address, 0, 120, 0, 0, {from: owner})
      assert.equal(await masterchef.poolExistence(busdToken.address), true)

      await masterchef.add(1000, testToken.address, 0, 120, 0, 1, {from: owner})
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

  let depositBlock

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
      let nftId

      nftId = (await bullNFT.tokenOfOwnerByIndex(owner, 0)).toString()
      await bullNFT.approve(masterchef.address, nftId)
      await masterchef.depositNFT(0, nftId)
      assert.equal(await bullNFT.getBoost((await masterchef.userInfo(0,owner))[5]), bullseye)
      assert.equal(((await masterchef.userInfo(0,owner))[5]).toString(), nftId)
      assert(await bullNFT.ownerOf(nftId), masterchef.address)
      assert.notEqual(await bullNFT.ownerOf(nftId), owner)

      await masterchef.deposit(0, toWei(500), referrer, {from: owner})
      assert.equal(toEth((await masterchef.userInfo(0,owner))[0]), (500*0.95))
      assert.equal(toEth(await bullToken.balanceOf(owner)), (500000-500))
      depositBlock = await web3.eth.getBlockNumber()

      await masterchef.deposit(0, toWei(500), referrer, {from: investor})
      assert.equal(toEth((await masterchef.userInfo(0, investor))[0]), (500*0.95))
      assert.equal(toEth(await bullToken.balanceOf(investor)), (500000-500))

      nftId = (await bullNFT.tokenOfOwnerByIndex(investor, 0)).toString()
      await bullNFT.approve(masterchef.address, nftId, {from: investor})
      await masterchef.depositNFT(1, nftId, {from: investor})
      assert.equal(await bullNFT.getBoost((await masterchef.userInfo(1,investor))[5]), bullFarmer)
      assert.equal(((await masterchef.userInfo(1,investor))[5]).toString(), nftId)
      assert(await bullNFT.ownerOf(nftId), masterchef.address)
      assert.notEqual(await bullNFT.ownerOf(nftId), investor)

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

    it("deposit rewards", async() =>{
      for(let x = 0; x < 5; x++){
        await helper.advanceBlock()
      }
      await helper.advanceTimeAndBlock(5)
      
      let depositBlock = await web3.eth.getBlockNumber();
      await rewardDistribution.depositRewards(toWei(500000), {from: owner})
      assert.equal(toEth(await busdToken.balanceOf(rewardDistribution.address)), 500000)
      assert.equal(toEth(await busdToken.balanceOf(owner)), 9000)
    })

    it("withdraw without harvest", async() =>{
      let previousBalanceStaked
      let withdrawBalance
      let previousBalanceHolded

      previousBalanceStaked = toEth((await masterchef.userInfo(0,owner))[0])
      withdrawBalance = 300
      await masterchef.withdraw(0, toWei(withdrawBalance), {from: owner})
      assert.equal(toEth((await masterchef.userInfo(0,owner))[0]), (previousBalanceStaked - withdrawBalance))

      previousBalanceStaked = toEth((await masterchef.userInfo(0,investor))[0])
      withdrawBalance = 250
      await masterchef.withdraw(0, toWei(withdrawBalance), {from: investor})
      assert.equal(toEth((await masterchef.userInfo(0,investor))[0]), (previousBalanceStaked - withdrawBalance))
/*
      previousBalanceStaked = toEth((await masterchef.userInfo(1,owner))[0])
      withdrawBalance = 200
      previousBalanceHolded = toEth(await busdToken.balanceOf(owner))
      await masterchef.withdraw(1, toWei(withdrawBalance), {from: owner})
      assert.equal(toEth((await masterchef.userInfo(1,owner))[0]), (previousBalanceStaked - withdrawBalance))
      assert.equal(toEth(await busdToken.balanceOf(owner)), previousBalanceHolded + withdrawBalance)

      previousBalanceStaked = toEth((await masterchef.userInfo(1,investor))[0])
      withdrawBalance = 200
      previousBalanceHolded = toEth(await busdToken.balanceOf(investor))
      await masterchef.withdraw(1, toWei(withdrawBalance), {from: investor})
      assert.equal(toEth((await masterchef.userInfo(1,investor))[0]), (previousBalanceStaked - withdrawBalance))
      assert.equal(toEth(await busdToken.balanceOf(investor)), previousBalanceHolded + withdrawBalance)
      */
    })

    it("harvest", async() =>{
//      console.log((await rewardDistribution.poolPids(0)).toString())
//      console.log(toEth(await testToken.balanceOf(masterchef.address)))
//      console.log("Prevoius reward per block")
//      console.log(toEth(await rewardDistribution.rewardPerBlock()))

      await helper.advanceTimeAndBlock(120)
      let previousBullBalance
      let previousTestBalance
      let previousBUSDBalance
      await rewardDistribution.massUpdatePools()
//      console.log("Reward debt owner")
//      console.log(toEth((await rewardDistribution.userInfo(2, owner))[1]))
//      console.log("Reward debt investor")
//      console.log(toEth((await rewardDistribution.userInfo(2, investor))[1]))
//      console.log("Balance assigned")
//      console.log(toEth(await rewardDistribution.assignedRewards()))
//      console.log("Total balance")
//      console.log((await busdToken.balanceOf(rewardDistribution.address)).toString())
//      console.log("Balance / Rate initial")
/*      console.log(
        ((await busdToken.balanceOf(rewardDistribution.address)) / 
        (await rewardDistribution.rewardPerBlock())).toString()
        )
        */
//      console.log("Updated reward per block")
//      console.log(toEth(await rewardDistribution.rewardPerBlock()))
//      console.log("Total balance")
//      console.log(toEth(await busdToken.balanceOf(rewardDistribution.address)))
//      console.log("Balance assigned")
//      console.log((await rewardDistribution.assignedRewards()).toString())
//      console.log("Balance to give")
//      console.log(toEth(await busdToken.balanceOf(rewardDistribution.address)) - toEth(await rewardDistribution.assignedRewards()))
//      console.log("Balance / Rate")
/*      console.log(
        (toEth(await busdToken.balanceOf(rewardDistribution.address)) - toEth(await rewardDistribution.assignedRewards())) / 
        toEth(await rewardDistribution.rewardPerBlock())
        )
        */
      await helper.advanceTimeAndBlock(10)

//      console.log("Actual pending reward")
//      console.log(toEth(await rewardDistribution.pendingReward(2, owner)))
      previousBullBalance = toEth(await bullToken.balanceOf(owner))
      previousBUSDBalance = toEth(await busdToken.balanceOf(owner))
      await masterchef.deposit(2, 0, referrer, {from: owner})
      assert(toEth(await bullToken.balanceOf(owner)) > previousBullBalance, "Harvest didn't work")
//      console.log("Estimated BUSD expected to owner:")
//      console.log((toEth((await rewardDistribution.rewardPerBlock())) * 111) / 2)
//      console.log("Owner BUSD obtained:")
//      console.log(toEth(await busdToken.balanceOf(owner)) - previousBUSDBalance)


//      console.log("Actual pending reward")
//      console.log(toEth(await rewardDistribution.pendingReward(2, investor)))
      previousBullBalance = toEth(await bullToken.balanceOf(investor))
      previousBUSDBalance = toEth(await busdToken.balanceOf(investor))
      await masterchef.deposit(2, 0, referrer, {from: investor})
      assert(toEth(await bullToken.balanceOf(investor)) > previousBullBalance, "Harvest didn't work")
//      console.log("Estimated BUSD expected to investor:")
//      console.log((toEth((await rewardDistribution.rewardPerBlock())) * 111) / 2)
//      console.log("Investor BUSD obtained:")
//      console.log(toEth(await busdToken.balanceOf(investor)) - previousBUSDBalance)

//      console.log("Balance assigned. Should be zero")
//      console.log(toEth(await rewardDistribution.assignedRewards()))
//      console.log("Remain busd balance in rewardDistribution contract. Should be zero")
//      console.log(toEth(await busdToken.balanceOf(rewardDistribution.address)))
    })
  })

  describe("RewardDistribution transactions", async() =>{
    it("harvest rewards", async() =>{

      for(let x = 0; x < 50; x++){
        helper.advanceBlock()
      }

      await helper.advanceTimeAndBlock(120)
      let previousBalanceHolded
      let previousBullBalance

      await rewardDistribution.massUpdatePools()
//      console.log("Actual pending reward")
//      console.log(toEth(await rewardDistribution.pendingReward(2, owner)))
//      console.log("Balance assigned")
//      console.log(toEth(await rewardDistribution.assignedRewards()))

      previousBalanceHolded = toEth(await busdToken.balanceOf(owner))
      await masterchef.deposit(2, 0, referrer, {from: owner})
      assert(toEth(await busdToken.balanceOf(owner)) > previousBalanceHolded, "Distribution contract don't harvest")

      previousBalanceHolded = toEth(await busdToken.balanceOf(investor))
      previousBullBalance = toEth(await bullToken.balanceOf(investor))
      await masterchef.deposit(2, 0, referrer, {from: investor})
      assert(toEth(await bullToken.balanceOf(investor)) > previousBullBalance, "Masterchef contract don't harvest" )
      assert(toEth(await busdToken.balanceOf(investor)) > previousBalanceHolded, "Distribution contract don't harvest")

      console.log("Owner strength: " + toEth((await masterchef.userInfo(1, owner))[4]))
      console.log("Investor strength: " + toEth((await masterchef.userInfo(1, investor))[4]))
      console.log("Pool totalStrength: " + toEth((await masterchef.poolInfo(1))[6]))

      console.log("Actual owner pending reward")
      console.log(toEth(await masterchef.pendingBull(1, owner)))
      console.log("NFT deposited: " + ((await masterchef.userInfo(1, owner))[5]).toString())
      console.log("NFT bonus: " + (await bullNFT.getBonus((await masterchef.userInfo(1, owner))[5])).toString())
      previousBalanceHolded = toEth(await busdToken.balanceOf(owner))
      await masterchef.deposit(1, 0, referrer, {from: owner})
      assert(toEth(await busdToken.balanceOf(owner)) == previousBalanceHolded, "This shouldn't happend")

      console.log("Actual investor pending reward")
      console.log(toEth(await masterchef.pendingBull(1, investor)))
      console.log("NFT deposited: " + ((await masterchef.userInfo(1, investor))[5]).toString())
      console.log("NFT bonus: " + (await bullNFT.getBonus((await masterchef.userInfo(1, investor))[5])).toString())
      previousBalanceHolded = toEth(await busdToken.balanceOf(investor))
      previousBullBalance = toEth(await bullToken.balanceOf(investor))
      await masterchef.deposit(1, 0, referrer, {from: investor})
      assert(toEth(await busdToken.balanceOf(investor)) == previousBalanceHolded, "This shouldn't happend")
      assert(toEth(await bullToken.balanceOf(investor)) > previousBullBalance, "Masterchef contract don't harvest" )
    })
  })

  describe("Hard test", async() =>{
    it("withdraw all the funds", async() =>{
      for(let x = 0; x < 100; x++){
        helper.advanceBlock()
      }
      await helper.advanceTimeAndBlock(3600)

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
    })
  })
});