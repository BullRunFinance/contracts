# BullRun Finance

_Auto liquidity yield farm cross-chain with a full ecosystem compuesto de un farming, sistema de referidos, bridge, juegos y nfts._
_El protocolo será deployado en varias chains, comenzando por BSC, Polygon y Fantom. Su Bridge proporionará a los usuarios la libertad de mover sus tokens BULL a través del protocolo en cualquier blockchain donde este esté._

## Main contracts

* BullToken: [deploy after audits]
* BullMasterchef: [deploy after audits]
* RewardDistribution: [deploy after audits]
* BullReferral: [deploy after audits]
* BullLocker: [deploy after audits]
* BullBridge: [deploy after audits]
* BullMarketplace: **under development**
* BullNFT: [deploy after audits]

## These contracts use 
* @openzeppelin/contracts@4.1.0
* @uniswap/v2-periphery@1.1.0-beta.0
* @uniswap/v2-core@1.0.1

## Overview core contracts

_ * BullToken es el token principal del ecosistema, con tax de 5% en cada transacción y auto liquidity. Se utiliza para intercambiar nfts y cruzar entre chains mediante el bridge. Modificado para utilziar boosts de nfts._
_ * BullMasterchef es el encargado de recompensar con Bull a los stakers. Modificado para llamar a RewardDistribution y aceptar nfts que aumentan el APR o reducen el harvestInterval._
_ * RewardDistribution recibe recompensas y las distribuye entre los stakers de determinados pools en el masterchef._
_ * BullLocker lockea la liquidez formada por BullToken. Este contrato debe estar asignado a BullToken y su ownership debe transferirse a un timelock._
_ * BullNFT es el contrato de los NFTs utilizados en el ecosistema. Es el encargado de manejar su minteo y asignar los boosts correspondientes._

---
BullToken, BullMasterchef, BullReferral and BullLocker son forks de  [PantherSwap](https://github.com/pantherswap/panther-farm) con mayores o menores cambios para auemntar la seguridad y los casos de usos.