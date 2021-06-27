const { assert } = require('chai');
const helper = require("./helpers/truffleTestHelper");
const { expectRevert, time } = require('@openzeppelin/test-helpers');

const BullToken = artifacts.require("BullToken");
const BullLocker = artifacts.require("BullLocker");

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

contract("BullLocker", ([owner, recipient]) => {
  let bullLocker, bullToken

  before(async() =>{
    bullToken = await BullToken.new()
    bullLocker = await BullLocker.new()
  })

  describe("Config bull", async() => {    
    it("mint tokens", async() =>{
      let mintOwner = toWei(5000000)

      await bullToken.mint(owner, mintOwner)

      assert.equal(toEth(await bullToken.balanceOf(owner)), toEth(mintOwner))
    })

    it("set bullLocker", async() => {
        await bullToken.updateLpLocker(bullLocker.address)

        assert.equal(await bullToken.lpLocker(), bullLocker.address, "bullLocket not assigned")
    })

    it("set bull excludes", async() => {
        await bullToken.setExcludedFromTax(recipient, true)

        assert(await bullToken.isExcludedFromTax(recipient), "recipient didn't excluded from tax")
    })

    it("send tokens to locker", async() => {
        await bullToken.transfer(bullLocker.address, toWei(5000), {from: owner})

        assert.equal(toEth(await bullToken.balanceOf(owner)), 4995000, "tokens not transfered to locker")
        assert.equal(toEth(await bullToken.balanceOf(bullLocker.address)), 5000, "tokens not transfered to locker")
    })

    it("only the owner should be able to withdraw", async() => {
        await expectRevert(
            bullLocker.unlock(bullToken.address, recipient, {from: recipient}),
            "Ownable: caller is not the owner"
        )

        assert.equal(toEth(await bullToken.balanceOf(recipient)), 0, "recipient withdrew")
    })

    it("withdraw tokens from locker", async() => {
        await bullLocker.unlock(bullToken.address, recipient)

        assert.equal(toEth(await bullToken.balanceOf(recipient)), 5000, "locker withdraw fail")
        assert.equal(toEth(await bullToken.balanceOf(bullLocker.address)), 0, "remain tokens in locker")
    })
  })
})