# BullRun Finance

Auto liquidity yield farm cross-chain with a full ecosystem composed of farming, referals,bridge, games and NFTs.
The protocol will be deployed in several chains, starting with BSC, Polygon and Fantom. The Bridge will allow the users agency to move their BULL tokens on any deployed chain.

## Main contracts

* **BullToken**: [deploy after audits]()
* **BullMasterchef**: [deploy after audits]()
* **RewardDistribution**: [deploy after audits]()
* **BullReferral**: [deploy after audits]()
* **BullLocker**: [deploy after audits]()
* **BullBridge**: [deploy after audits]()
* **BullMarketplace**: [under development]()
* **BullNFT**: [deploy after audits]()

## Overview core contracts

- BullToken is the main protocol token, with a 5% tax on each tx and auto liquidity. It will be used to exchange nfts and cross between chains using the bridge. Modified to use the boosts provided by the nfts._
- BullMasterchef is the contract that distributes BULL to the stakers. Modified to call RewardDistribution and accept nfts to increase APR or reduce harvestInterval._
- RewardDistribution receives rewards and distributes them to the stakers of spcific pools on the masterchef._
- BullLocker locks the liquidity provided by BullToken. This contrct has to be assigned to BullToken and the ownership needs to be transferred to a timelock._
- BullNFT is the contract that manages the NFTs used by the protocol. It's in charge of managing minting an assigning the corresponding boosts._

## These contracts use 
* @openzeppelin/contracts@4.1.0
* @uniswap/v2-periphery@1.1.0-beta.0
* @uniswap/v2-core@1.0.1

---
> BullToken, BullMasterchef, BullReferral and BullLocker are forks from  [PantherSwap](https://github.com/pantherswap/panther-farm) with changes applied to them to increase security and usability.