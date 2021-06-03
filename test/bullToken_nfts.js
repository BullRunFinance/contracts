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

contract("Transactions with NFTs", ([owner, user1, user2, user3, user4, user5, user6]) => {
  let bullNFT, bullToken
  let goldenBull = 1
  let silverBull = 2
  let bronzeBull = 3
  let goldenBullBonus = 5000
  let silverBullBonus = 2500
  let bronzeBullBonus = 1000

  before(async() =>{
    bullToken = await BullToken.new()
    bullNFT = await BullNFT.new()
  })

  describe("Create NFTs", async() => {
    it("create boosts", async() =>{
      await bullNFT.createBoost(owner, 50, goldenBullBonus)
      await bullNFT.createBoost(owner, 25, silverBullBonus)
      await bullNFT.createBoost(owner, 10, bronzeBullBonus)

      assert.equal((await bullNFT.nextBoostId()).toString(), "4", "Boosts creation error")
    })

    it("mint nfts", async() => {
      await bullNFT.mint(goldenBull, user1)
      await bullNFT.mint(silverBull, user2)
      await bullNFT.mint(bronzeBull, user3)

      assert(await bullNFT.hasBoost(user1, goldenBull))
      assert(await bullNFT.hasBoost(user2, silverBull))
      assert(await bullNFT.hasBoost(user3, bronzeBull))
    })
  })

  describe("Config bull", async() => {    
    it("mint tokens", async() =>{
      let mintOwner = toWei(500000)
      let mintUsers = toWei(1000)

      await bullToken.mint(owner, mintOwner)
      await bullToken.mint(user1, mintUsers)
      await bullToken.mint(user2, mintUsers)
      await bullToken.mint(user3, mintUsers)
      await bullToken.mint(user4, mintUsers)
      await bullToken.mint(user5, mintUsers)

      assert.equal(toEth(await bullToken.balanceOf(owner)), toEth(mintOwner))
      assert.equal(toEth(await bullToken.balanceOf(user1)), toEth(mintUsers))
      assert.equal(toEth(await bullToken.balanceOf(user2)), toEth(mintUsers))
      assert.equal(toEth(await bullToken.balanceOf(user3)), toEth(mintUsers))
      assert.equal(toEth(await bullToken.balanceOf(user4)), toEth(mintUsers))
      assert.equal(toEth(await bullToken.balanceOf(user5)), toEth(mintUsers))
    })

    it("set nft address", async() => {
      await bullToken.updateBullNFTContract(bullNFT.address)

      assert.equal(await bullToken.bullNFT(), bullNFT.address)
    })
  })

  async function amountSent(_amount, _boostId){
    let transferTax = parseInt(await bullToken.transferTaxRate())
    let discount = transferTax - transferTax * (parseInt(await bullNFT.getBonus(_boostId)) / 10000)
    _amount = _amount - _amount * discount / 10000
    return _amount
  }

  describe("Test transactions", async() => {
    it("test goldenBull sender", async() => {
      let previousBalanceReceiver = toEth(await bullToken.balanceOf(user2))
      let amount = toWei(500)
      await bullToken.transfer(user2, amount, {from: user1})
      assert.equal(previousBalanceReceiver + await amountSent(toEth(amount), goldenBull), toEth(await bullToken.balanceOf(user2)))
    })

    it("test goldenBull receiver", async() => {
      let previousBalanceReceiver = toEth(await bullToken.balanceOf(user1))
      let amount = toWei(500)
      await bullToken.transfer(user1, amount, {from: user3})
      assert.equal(previousBalanceReceiver + await amountSent(toEth(amount), goldenBull), toEth(await bullToken.balanceOf(user1)))
    })

    it("test silverBull sender", async() => {
      let previousBalanceReceiver = toEth(await bullToken.balanceOf(user3))
      let amount = toWei(500)
      await bullToken.transfer(user3, amount, {from: user2})
      assert.equal(previousBalanceReceiver + await amountSent(toEth(amount), silverBull), toEth(await bullToken.balanceOf(user3)))
    })

    it("test silverBull receiver", async() => {
      let previousBalanceReceiver = toEth(await bullToken.balanceOf(user2))
      let amount = toWei(500)
      await bullToken.transfer(user2, amount, {from: user4})
      assert.equal(previousBalanceReceiver + await amountSent(toEth(amount), silverBull), toEth(await bullToken.balanceOf(user2)))
    })

    it("test bronzeBull sender", async() => {
      let previousBalanceReceiver = toEth(await bullToken.balanceOf(user4))
      let amount = toWei(500)
      await bullToken.transfer(user4, amount, {from: user3})
      assert.equal(previousBalanceReceiver + await amountSent(toEth(amount), bronzeBull), toEth(await bullToken.balanceOf(user4)))
    })

    it("test bronzeBull receiver", async() => {
      let previousBalanceReceiver = toEth(await bullToken.balanceOf(user3))
      let amount = toWei(500)
      await bullToken.transfer(user3, amount, {from: user5})
      assert.equal(previousBalanceReceiver + await amountSent(toEth(amount), bronzeBull), toEth(await bullToken.balanceOf(user3)))
    })

    it("test no nft", async() => {
      let previousBalanceReceiver = toEth(await bullToken.balanceOf(user6))
      let amount = toWei(500)
      await bullToken.transfer(user6, amount, {from: user5})
      assert.equal(previousBalanceReceiver + await amountSent(toEth(amount), 0), toEth(await bullToken.balanceOf(user6)))
    })
  })
})