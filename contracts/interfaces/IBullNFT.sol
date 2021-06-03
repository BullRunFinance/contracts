// SPDX-License-Identifier: MIT

pragma solidity >=0.4.0;
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IBullNFT is IERC721{

    /// @dev Mint a new nft with a given _boostId to the _to address.
    function mint(uint256 _boostId, address _to) external;

    /// @return Return true if the actual supply of nft with the given _boostId is lower than the masSupply of that type of nft.
    function canMint(uint256 _boostId) external view returns(bool);

    /// @return Return the remaining amount of nft with the given _boostId can be mined before reach the maxSupply.
    function remainingMint(uint256 _boostId) external view returns(uint256);

    /// @return Return true if a _user has some nft with the given _boostId.
    function hasBoost(address _user, uint256 _boostId) external view returns(bool);

    /// @return Return the boostId of the given _nftId. If the nft hasn't a boost, returns 0.
    function getBoost(uint256 _nftId) external view returns (uint256);

    /// @return Return the bonus attribute of the given _nftId.
    function getBonus(uint256 _nftId) external view returns(uint256);

    /// @return Return the address allowed to mind nfts with the given _boostId.
    function getAuthorizedMiner(uint256 _boostId) external view returns(address);
}