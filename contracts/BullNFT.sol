// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IBullNFT.sol";

contract BullNFT is ERC721Enumerable, Ownable, IBullNFT {
    using SafeMath for uint256;
    using Strings for uint256;

    struct Type {
        address authorizedMiner;
        uint256 totalSupply;
        uint256 maxSupply; // max supply of nft with this type of bonus
        uint256 bonus; // If the bonus property of the boost use a number, it stores here. If not, it's zero.
        /**
        The bonus attribute contains the numerical value of the effect it applies.
        e.g. 
        - Percentages: goes in basis points. The receptor contract should multiply the value affected by the bonus and dividing it by 10000.
        For example a 20% discount would be: `originalValue - originalValue * nft.bonus / 10000` with nft.bonus as `2000`.
        - Time: if the bonus involve some time effect, the bonus should be in seconds.
         */
    }

    // boostId of each nftId
    mapping(uint256 => uint256) public boostById; 
    // type struct of each boostId
    mapping(uint256 => Type) public typesByBoostId; 
    uint256 private nextId = 1;
    uint256 public nextBoostId = 1;
    bytes32 private _uri = _stringToBytes32("https://nfts.bullrun.finance/");

    modifier onlyMiner(uint256 _boostId){
        require(getAuthorizedMiner(_boostId) == msg.sender, "You are not the miner of this type of nft");
        _;
    }

    constructor() public ERC721("BullNFT", "Bull NFT") {}

    /// @dev Mint a new nft with a given _boostId to the _to address.
    function mint(uint256 _boostId, address _to) external override onlyMiner(_boostId){
        require(canMint(_boostId), "MaxSupply of nfts with this boost reached");

        _safeMint(_to, nextId);

        boostById[nextId] = _boostId;
        typesByBoostId[_boostId].totalSupply += 1;
        nextId += 1;
    }
    
    /// @return Return true if the actual supply of nft with the given _boostId is lower than the masSupply of that type of nft.
    function canMint(uint256 _boostId) public override view returns(bool){
        if(remainingMint(_boostId) > 0){
            return true;
        }
        return false;
    }

    /// @return Return the remaining amount of nft with the given _boostId can be mined before reach the maxSupply.
    function remainingMint(uint256 _boostId) public override view returns(uint256){
        return typesByBoostId[_boostId].maxSupply.sub(typesByBoostId[_boostId].totalSupply);
    }

    /// @return Return true if a _user has some nft with the given _boostId.
    function hasBoost(address _user, uint256 _boostId) public override view returns(bool){
        uint256 balance = balanceOf(_user);
        for(uint256 i = 0; i < balance; i++){
            if(boostById[tokenOfOwnerByIndex(_user, i)] == _boostId){
                return true;
            }
        }
        return false;
    }

    /// @return Return the boostId of the given _nftId. If the nft hasn't a boost, returns 0.
    function getBoost(uint256 _nftId) external override view returns(uint256){
        return boostById[_nftId];
    }

    /// @return Return the bonus attribute of the given _nftId.
    function getBonus(uint256 _nftId) external override view returns(uint256){
        return typesByBoostId[boostById[_nftId]].bonus;
    }

    /// @return Return the address allowed to mind nfts with the given _boostId.
    function getAuthorizedMiner(uint256 _boostId) public override view returns(address){
        return typesByBoostId[_boostId].authorizedMiner;
    }

    //--------------- Owner Functions ---------------//

    /// @dev Create a new type of boost.
    /// @param _bonus detailed above.
    function createBoost(address _miner, uint256 _maxSupply, uint256 _bonus) external onlyOwner{
        typesByBoostId[nextBoostId].authorizedMiner = _miner;
        typesByBoostId[nextBoostId].maxSupply = _maxSupply;
        typesByBoostId[nextBoostId].bonus = _bonus;
        nextBoostId++;
    }

    /// @dev Update the max supply of the given _boostId
    function updateMaxSupply(uint256 _boostId, uint256 _newSupply) external onlyOwner{
        require(_newSupply > typesByBoostId[_boostId].maxSupply, "The new supply it's not higher");
        typesByBoostId[_boostId].maxSupply = _newSupply;
    }

    /// @dev Update the miner of nfts with the given _boostId
    function updateMiner(uint256 _boostId, address _miner) external onlyOwner{
        typesByBoostId[_boostId].authorizedMiner = _miner;
    }

    /*
        The default uri is to combine _baseURI with tokenId, e.g., "https://token-data.super-awesome-project.tld/{tokenId}"
        If our server cannot read the block chain in order to look up the Token.Type data, we will need to override another
        function to also supply the Token.Type information.
    */
    function _baseURI() internal view virtual override returns (string memory) {
        return _bytes32ToString(_uri);
    }
    
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        string memory baseURI = ERC721.tokenURI(tokenId);
        Type storage tokenType = typesByBoostId[boostById[tokenId]];
        return string(abi.encodePacked(
            baseURI, "/",
            tokenId.toString(), "/",
            tokenType.bonus.toString()));
    }

    function setUri(string memory newUri) external onlyOwner{
        _uri = _stringToBytes32(newUri);
    }

    function _stringToBytes32(string memory _source) internal pure returns (bytes32 result) {
        bytes memory tempEmptyStringTest = bytes(_source);
        if (tempEmptyStringTest.length == 0) {
            return 0x0;
        }
    
        assembly {
            result := mload(add(_source, 32))
        }
    }
    
    function _bytes32ToString(bytes32 _bytes32) internal pure returns (string memory) {
        uint8 i = 0;
        while(i < 32 && _bytes32[i] != 0) {
            i++;
        }
        bytes memory bytesArray = new bytes(i);
        for (i = 0; i < 32 && _bytes32[i] != 0; i++) {
            bytesArray[i] = _bytes32[i];
        }
        return string(bytesArray);
    }
}

/*
JSON structure:
{
    "name": "_NFT name_",
    "description": "_NFT description_",
    "image": "_url_"
    "special": "_adventage on bull ecosystem_"
}
*/