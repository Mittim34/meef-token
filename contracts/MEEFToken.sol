// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract MEEFToken is
    Initializable,
    ERC20Upgradeable,
    ERC20BurnableUpgradeable,
    ERC20PausableUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    // ==================== YAPILANDIRMA ====================
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18;
    uint256 public constant WALLET_CAP_PERCENT = 1;
    uint256 public constant DAILY_SELL_LIMIT_PERCENT = 10;
    uint256 public constant EARLY_SELL_PENALTY_PERCENT = 15;
    uint256 public constant EARLY_SELL_PERIOD = 7 days;
    uint256 public constant TX_TAX_PERCENT = 3;

    // ==================== DEPOLAMA ====================
    address public treasuryWallet;
    mapping(address => bool) private _blacklisted;
    mapping(address => bool) private _whitelisted;
    mapping(address => uint256) private _firstBuyTime;
    mapping(address => uint256) private _dailySold;
    mapping(address => uint256) private _lastSellDay;

    // ==================== OLAYLAR ====================
    event AddressBlacklisted(address indexed account);
    event AddressUnblacklisted(address indexed account);
    event AddressWhitelisted(address indexed account);
    event AddressUnwhitelisted(address indexed account);
    event TreasuryUpdated(address indexed newTreasury);
    event PenaltyApplied(address indexed from, uint256 penaltyAmount);
    event TaxApplied(address indexed from, uint256 taxAmount);

    // ==================== HATALAR ====================
    error BlacklistedAddress(address account);
    error WalletCapExceeded(address account, uint256 amount, uint256 cap);
    error DailySellLimitExceeded(address account, uint256 amount, uint256 limit);
    error ZeroAddress();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner, address _treasuryWallet) public initializer {
        if (initialOwner == address(0) || _treasuryWallet == address(0)) revert ZeroAddress();

        __ERC20_init("MEEF", "MEEF");
        __ERC20Burnable_init();
        __ERC20Pausable_init();
        __Ownable_init(initialOwner);
        

        treasuryWallet = _treasuryWallet;
        _whitelisted[initialOwner] = true;
        _whitelisted[_treasuryWallet] = true;

        _mint(initialOwner, MAX_SUPPLY);
    }

    // ==================== MINT ====================
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    // ==================== PAUSE ====================
    function pause() public onlyOwner { _pause(); }
    function unpause() public onlyOwner { _unpause(); }

    // ==================== BLACKLIST ====================
    function blacklist(address account) public onlyOwner {
        _blacklisted[account] = true;
        emit AddressBlacklisted(account);
    }

    function unblacklist(address account) public onlyOwner {
        _blacklisted[account] = false;
        emit AddressUnblacklisted(account);
    }

    function isBlacklisted(address account) public view returns (bool) {
        return _blacklisted[account];
    }

    // ==================== WHITELIST ====================
    function whitelist(address account) public onlyOwner {
        _whitelisted[account] = true;
        emit AddressWhitelisted(account);
    }

    function unwhitelist(address account) public onlyOwner {
        _whitelisted[account] = false;
        emit AddressUnwhitelisted(account);
    }

    function isWhitelisted(address account) public view returns (bool) {
        return _whitelisted[account];
    }

    // ==================== TREASURY ====================
    function setTreasury(address newTreasury) public onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        treasuryWallet = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    // ==================== SORGULAMA ====================
    function getFirstBuyTime(address account) public view returns (uint256) {
        return _firstBuyTime[account];
    }

    function getDailySold(address account) public view returns (uint256) {
        return _dailySold[account];
    }

    // ==================== ANA TRANSFER MANTIGI ====================
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20Upgradeable, ERC20PausableUpgradeable) {
        // Blacklist kontrolu
        if (_blacklisted[from]) revert BlacklistedAddress(from);
        if (_blacklisted[to]) revert BlacklistedAddress(to);

        // Mint ve burn islemlerinde kural yok
        if (from == address(0) || to == address(0)) {
            super._update(from, to, value);
            return;
        }

        // Whitelist muaf
        if (_whitelisted[from] && _whitelisted[to]) {
            super._update(from, to, value);
            return;
        }

        // Alici icin: ilk alis zamanini kaydet
        if (_firstBuyTime[to] == 0 && !_whitelisted[to]) {
            _firstBuyTime[to] = block.timestamp;
        }

        uint256 finalAmount = value;
        uint256 totalDeduction = 0;

        // Gondericiye kurallar uygula (whitelist degilse)
        if (!_whitelisted[from]) {
            // 1. Erken satis cezasi (ilk 7 gun)
            if (_firstBuyTime[from] != 0 && block.timestamp < _firstBuyTime[from] + EARLY_SELL_PERIOD) {
                uint256 penalty = (value * EARLY_SELL_PENALTY_PERCENT) / 100;
                totalDeduction += penalty;
                emit PenaltyApplied(from, penalty);
            }

            // 2. Gunluk satis limiti
            uint256 today = block.timestamp / 1 days;
            if (_lastSellDay[from] != today) {
                _lastSellDay[from] = today;
                _dailySold[from] = 0;
            }
            uint256 dailyLimit = (balanceOf(from) * DAILY_SELL_LIMIT_PERCENT) / 100;
            if (_dailySold[from] + value > dailyLimit) {
                revert DailySellLimitExceeded(from, value, dailyLimit);
            }
            _dailySold[from] += value;
        }

        // 3. Islem vergisi (gonderen whitelist degilse)
        if (!_whitelisted[from]) {
            uint256 tax = (value * TX_TAX_PERCENT) / 100;
            totalDeduction += tax;
            emit TaxApplied(from, tax);
        }

        // 4. Anti-Whale kontrolu (alici whitelist degilse)
        if (!_whitelisted[to]) {
            uint256 walletCap = (MAX_SUPPLY * WALLET_CAP_PERCENT) / 100;
            uint256 receiverGets = value - totalDeduction;
            if (balanceOf(to) + receiverGets > walletCap) {
                revert WalletCapExceeded(to, receiverGets, walletCap);
            }
        }

        // Transferi gerceklestir
        if (totalDeduction > 0) {
            finalAmount = value - totalDeduction;
            super._update(from, treasuryWallet, totalDeduction);
        }
        super._update(from, to, finalAmount);
    }

    // ==================== UPGRADE ====================
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function version() public pure returns (string memory) {
        return "1.0.0";
    }
}
