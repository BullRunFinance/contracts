const { assert } = require('chai');
const helper = require("./helpers/truffleTestHelper");

const BullToken = artifacts.require("BullToken");
const BUSDToken = artifacts.require("BUSDToken");
const BullRun = artifacts.require("BullRun");

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

contract("BullRun", ([owner, investor, referrer]) => {

  let INT_MAX = "115792089237316195423570985008687907853269984665640564039457584007913129639935"
  let bullToken, busdToken, bullrun
  
  before(async() =>{
    bullToken = await BullToken.new()
    busdToken = await BUSDToken.new()
    bullrun = await BullRun.new(owner)
  })

  describe("Config bullrun", async() =>{
    it("add pools", async() =>{
        await bullrun.add(bullToken.address, 400, {from: owner})
        assert.equal((await bullrun.poolInfo(0))[0], bullToken.address, "Pool don't match" )
    })

    it("exclude bullrun from antiwhale", async() => {
      await bullToken.setExcludedFromAntiWhale(bullrun.address, true)
      assert.equal(await bullToken.isExcludedFromAntiWhale(bullrun.address), true, "BullRun game don't excluded from antiwhale")
    })
  })

  describe("Prepare tokens", async() =>{
    it("mint", async() => {
      await bullToken.mint(owner, toWei('500000'), {from: owner})
      await bullToken.mint(investor, toWei('20000'), {from: owner})
      await bullToken.mint(referrer, toWei('20000'), {from: owner})
      await busdToken.mint(owner, toWei('510000'), {from: owner})
      await busdToken.mint(investor, toWei('10000'), {from: owner})
      await busdToken.mint(referrer, toWei('10000'), {from: owner})

      assert.equal(toEth(await bullToken.totalSupply()), 540000)
      assert.equal(toEth(await busdToken.totalSupply()), 530000)
    })

    it("check balances", async() => {
      assert.equal(toEth(await bullToken.balanceOf(owner)), 500000)
      assert.equal(toEth(await bullToken.balanceOf(investor)), 20000)
      assert.equal(toEth(await bullToken.balanceOf(referrer)), 20000)
      assert.equal(toEth(await busdToken.balanceOf(owner)), 510000)
      assert.equal(toEth(await busdToken.balanceOf(investor)), 10000)
      assert.equal(toEth(await busdToken.balanceOf(referrer)), 10000)
    })

    it("approve", async() =>{
      await bullToken.approve(bullrun.address, INT_MAX, {from: owner})
      assert.equal(await bullToken.allowance(owner, bullrun.address), INT_MAX, "allowance error")

      await bullToken.approve(bullrun.address, INT_MAX, {from: investor})
      assert.equal(await bullToken.allowance(investor, bullrun.address), INT_MAX, "allowance error")

      await bullToken.approve(bullrun.address, INT_MAX, {from: referrer})
      assert.equal(await bullToken.allowance(referrer, bullrun.address), INT_MAX, "allowance error")
    })
  })

  async function deposit(pid, amount, user){
    let previousBalance = toEth(await bullToken.balanceOf(bullrun.address))
    await bullrun.participate(toWei(amount),pid, {from: user})
    assert.equal(toEth(await bullToken.balanceOf(bullrun.address)), previousBalance+(amount*0.95), "deposit error")
    assert.equal((await bullrun.poolInfo(pid))[4], user, "error last bidder")
//    console.log((await bullrun.poolInfo(pid))[4])
//    console.log(((await bullrun.poolInfo(pid))[6]).toNumber())
  }

  describe("Check bullrun", async() =>{
    it("deposit bull", async() =>{
      await deposit(0, 250, referrer)
      await deposit(0, 250, investor)
      await deposit(0, 500, referrer)
      await deposit(0, 900, investor)
      await deposit(0, 5000, referrer)
    })    

/*    it("view", async() =>{
//      console.log(toEth(await bullrun.minBet(0)))
      assert.equal(toEth(await bullToken.balanceOf(bullrun.address)) * 0.05, toEth(await bullrun.minBet(0)), "min deposit has an error")
    })

    it("delay", async() =>{
//      console.log(toWei((await bullrun.poolInfo(0))[6]))
    })*/
  })
});