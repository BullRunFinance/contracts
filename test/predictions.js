const { assert } = require('chai');
const helper = require("./helpers/truffleTestHelper");

const BullToken = artifacts.require("BullToken");
const BullPrediction = artifacts.require("BullPrediction");
const FalseOracle = artifacts.require("FalseOracle");

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

contract("Predictions", ([owner, operator, bullishBettor, bearishBettor]) => {

  let INT_MAX = "115792089237316195423570985008687907853269984665640564039457584007913129639935"
  let bullToken, bullPrediction, falseOracle
  
  before(async() =>{
    bullToken = await BullToken.new()
    falseOracle = await FalseOracle.new()
    bullPrediction = await BullPrediction.new(bullToken.address, falseOracle.address, operator, 300, 60, "1000000000000000")
  })

  describe("Config bullToken", async() =>{
      it("exclude addresses from taxes", async() =>{
        await bullToken.setExcludedFromTax(bullPrediction.address, true, {from: owner})
        assert.equal(await bullToken.isExcludedFromTax(bullPrediction.address), true, "Predictions not excluded of taxes")
      })

      it("excude addresses from antiWhale", async() =>{
          await bullToken.setExcludedFromAntiWhale(bullPrediction.address, true, {from: owner})
          assert.equal(await bullToken.isExcludedFromAntiWhale(bullPrediction.address), true, "Predictions not excluded of antiwhale")
      })
  })

  describe("Config predictions", async() =>{
    it("set operator", async() =>{
        await bullPrediction.setOperator(operator, {from: owner})
        assert.equal(await bullPrediction.operatorAddress(), operator, "SetOperator fail" )
    })

    it("set price on oracle", async() => {
        await falseOracle.setPrice(toWei(5), {from: owner})
        assert.equal(await falseOracle.getPrice(), toWei(5), "Error setting price")
    })
  })

  describe("Prepare tokens", async() =>{
    it("mint", async() => {
      await bullToken.mint(owner, toWei('500000'), {from: owner})
      await bullToken.mint(bullishBettor, toWei('2000'), {from: owner})
      await bullToken.mint(bearishBettor, toWei('2000'), {from: owner})

      assert.equal(toEth(await bullToken.totalSupply()), 504000)
    })

    it("check balances", async() => {
      assert.equal(toEth(await bullToken.balanceOf(owner)), 500000)
      assert.equal(toEth(await bullToken.balanceOf(bullishBettor)), 2000)
      assert.equal(toEth(await bullToken.balanceOf(bearishBettor)), 2000)
    })

    it("approve", async() =>{
      await bullToken.approve(bullPrediction.address, INT_MAX, {from: owner})
      assert.equal(await bullToken.allowance(owner, bullPrediction.address), INT_MAX, "allowance error")

      await bullToken.approve(bullPrediction.address, INT_MAX, {from: bullishBettor})
      assert.equal(await bullToken.allowance(bullishBettor, bullPrediction.address), INT_MAX, "allowance error")

      await bullToken.approve(bullPrediction.address, INT_MAX, {from: bearishBettor})
      assert.equal(await bullToken.allowance(bearishBettor, bullPrediction.address), INT_MAX, "allowance error")
    })
  })


  let roundTime
  let currentEpoch

  async function advanceRound(){
    currentEpoch++
    await helper.advanceTimeAndBlock(roundTime)
  }

  async function betRound(bearishBetAmount, bullishBetAmount){
    await bullPrediction.betBear(toWei(bearishBetAmount), {from: bearishBettor})
    await bullPrediction.betBull(toWei(bullishBetAmount), {from: bullishBettor})
    assert.equal(toEth((await bullPrediction.ledger(currentEpoch, bearishBettor))[1]), bearishBetAmount)
    assert.equal(toEth((await bullPrediction.ledger(currentEpoch, bullishBettor))[1]), bullishBetAmount)
  }
  
  describe("Start predictions", async() => {
    it("set environment variables for testing", async() => {
      roundTime = parseInt(await bullPrediction.roundTime())
      currentEpoch = 1
    })

    it("start genesis round", async() =>{
      await bullPrediction.genesisStartRound({from: operator})
      assert.equal(await bullPrediction.genesisStartOnce(), true, "Genesis don't started")
      await helper.advanceTime(5)
    })

    it("bet in genesis round", async() => {
      await betRound(20, 40)
    })

    it("lock genesis round and start next round", async() => {
      await falseOracle.setPrice(toWei(5))
      advanceRound()
      await bullPrediction.genesisLockRound({from: operator})
      assert.equal(await bullPrediction.genesisLockOnce(), true, "Genesis don't locked")
      assert.equal(toEth((await bullPrediction.rounds(currentEpoch - 1))[4]), toEth(await falseOracle.getPrice()), "For genesis round lock price isn't 5")
    })

    it("bet in round 2", async() => {
      await helper.advanceTime(5)
      await betRound(15, 80)
    })

    it("lock price round 2 end genesis round and start round 3", async() => {
      await falseOracle.setPrice(toWei(10))
      advanceRound()
      await bullPrediction.executeRound({from: operator})
    })

    it("claim rewards genesis round", async() => {
      let previousBalance = toEth(await bullToken.balanceOf(bullishBettor))
      await bullPrediction.claim(1, {from: bullishBettor})
      assert(toEth(await bullToken.balanceOf(bullishBettor)) > previousBalance)
    })
  
    it("lock price round 3 end 2 round and start round 4", async() => {
      await falseOracle.setPrice(toWei(7))
      advanceRound()
      await bullPrediction.executeRound({from: operator})
    })

    it("claim rewards round 2", async() => {
      let previousBalance = toEth(await bullToken.balanceOf(bearishBettor))
      await bullPrediction.claim(2, {from: bearishBettor})
      assert(toEth(await bullToken.balanceOf(bearishBettor)) > previousBalance, "Reward not claimed in round 2")
    })

    it("claim treasury rewards", async() => {
      let treasuryAmount = await toEth(await bullPrediction.treasuryAmount())
//      console.log(treasuryAmount)
      let previousBalance = toEth(await bullToken.balanceOf(owner))
      await bullPrediction.claimTreasury({from: owner})
      assert(toEth(await bullToken.balanceOf(owner)) == (previousBalance + treasuryAmount), "Treasury rewards error")
    })
  })
});