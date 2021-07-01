# BullRun Finance

Auto liquidity yield farm cross-chain with a full ecosystem composed of farming, referals,bridge, games and NFTs.
The protocol will be deployed in several chains, starting with BSC, Polygon and Fantom. The Bridge will allow the users agency to move their BULL tokens on any deployed chain.

## Main contracts

* **BullToken**: 0xeDd4b24BE3c43De98989C233E67dB29Dc6554fC6
* **BullMasterchef**: 0x10712a6d1B8C0de4c5172A3004A8AeE20569c670
* **RewardDistribution**: 0x1B2379af4F00945e6Fe5FE6657a297bE1d57A059
* **BullReferral**: 0x66351a42D6e4851b21e2B2cF1D4334Eb264D4Ac5
* **BullLocker**: 0x5DF3B5c3bFb687F56887F93F684f92A9545bEeFB
* **BullBridge**: 0xa4f9A8D5000943c0e35b4d3730EdcA89a9CeEC56
* **BullMarketplace**: 0x6399c48C5d74BE900034E283C9488a02A716A757
* **BullNFT**: 0xb86553EA267814BC73c676F78f6E0387FA093Eb6

Contracts deployed on Binance Smart Chain, Polygon and Fantom with the same addresses.

## Overview core contracts

- BullToken is the main protocol token, with a 5% tax on each tx and auto liquidity. It will be used to exchange nfts and cross between chains using the bridge. Modified to use the boosts provided by the nfts.
- BullMasterchef is the contract that distributes BULL to the stakers. Modified to call RewardDistribution and accept nfts to increase APR or reduce harvestInterval.
- RewardDistribution receives rewards and distributes them to the stakers of spcific pools on the masterchef.
- BullLocker locks the liquidity provided by BullToken. This contrct has to be assigned to BullToken and the ownership needs to be transferred to a timelock.
- BullNFT is the contract that manages the NFTs used by the protocol. It's in charge of managing minting an assigning the corresponding boosts.

## These contracts use 
* @openzeppelin/contracts@4.1.0
* @uniswap/v2-periphery@1.1.0-beta.0
* @uniswap/v2-core@1.0.1

---
> Contracts audited by [Hacken](https://hacken.io/wp-content/uploads/2021/06/BullRunFinance_25062021SCAudit_Report_2.pdf) at 25/06/2021