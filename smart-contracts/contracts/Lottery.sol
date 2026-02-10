// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.30;

contract Lottery {
    address public owner;
    address public oracle; // oracle koji dostavlja winningNumbers + randomSeed

    address[] public participants;
    uint256 public amountCollected;
    uint256 public drawTimestamp;

    uint256 public constant TICKET_PRICE = 0.005 ether;

    enum Phase { Open, Closed, Drawn, Paid }
    Phase public phase;

    struct Entry {
        bool exists;
        uint8[5] numbers; // odabrani brojevi
    }

    mapping(address => Entry) public entries;

    uint8[5] public winningNumbers;
    uint256 public randomSeed; // oracle seed za izbor 10% random sudionika

    uint256 private locked = 1;
    modifier nonReentrant() {
        require(locked == 1, "Reentrancy");
        locked = 2;
        _;
        locked = 1;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyOracle() {
        require(msg.sender == oracle, "Not oracle");
        _;
    }

    event Participated(address indexed user, uint8[5] numbers);
    event OracleSet(address indexed oracle);
    event Closed();
    event DrawSet(uint8[5] winningNumbers, uint256 seed, uint256 timestamp);
    event PaidOut(uint256 jackpotPool, uint256 secondaryPool, uint256 ownerFee);

    constructor() {
        owner = msg.sender;
        phase = Phase.Open;
    }

    function setOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "Zero oracle");
        oracle = _oracle;
        emit OracleSet(_oracle);
    }

    function participantsCount() external view returns (uint256) {
        return participants.length;
    }

    function participate(uint8[5] calldata nums) external payable {
        require(phase == Phase.Open, "Not open");
        require(msg.value == TICKET_PRICE, "Wrong ticket price");
        require(!entries[msg.sender].exists, "Already participated");

        _validateNumbers(nums);

        entries[msg.sender] = Entry({ exists: true, numbers: nums });
        participants.push(msg.sender);
        amountCollected += msg.value;

        emit Participated(msg.sender, nums);
    }

    function closeLottery() external onlyOwner {
        require(phase == Phase.Open, "Wrong phase");
        require(participants.length > 0, "No participants");
        phase = Phase.Closed;
        emit Closed();
    }

    function setDraw(uint8[5] calldata _winningNumbers, uint256 _randomSeed) external onlyOracle {
        require(phase == Phase.Closed, "Wrong phase");

        _validateNumbers(_winningNumbers);

        winningNumbers = _winningNumbers;
        randomSeed = _randomSeed;
        drawTimestamp = block.timestamp;

        phase = Phase.Drawn;

        emit DrawSet(_winningNumbers, _randomSeed, drawTimestamp);
    }

    function payoutWinners() external payable nonReentrant {
        require(phase == Phase.Drawn, "Wrong phase");
        uint256 participantCount = participants.length;
        require(participantCount > 0, "No participants");

        uint256 pool = address(this).balance;
        require(pool > 0, "No funds");

        uint256 jackpotPool = (pool * 50) / 100;
        uint256 secondaryPool = (pool * 40) / 100;
        uint256 ownerFee = pool - jackpotPool - secondaryPool;

        uint8 maxMatches = 0;
        uint8[] memory matches = new uint8[](participantCount);

        for (uint256 i = 0; i < participantCount; i++) {
            address participant = participants[i];
            if (entries[participant].exists) {
                uint8 m = _countMatches(entries[participant].numbers, winningNumbers);
                matches[i] = m;
                if (m > maxMatches) maxMatches = m;
            }
        }

        address[] memory jackpotWinnersTemp = new address[](participantCount);
        uint256 jackpotCount = 0;

        for (uint256 i = 0; i < participantCount; i++) {
            if (matches[i] == maxMatches) {
                jackpotWinnersTemp[jackpotCount] = participants[i];
                jackpotCount++;
            }
        }
        require(jackpotCount > 0, "No jackpot winners?");

        uint256 perJackpot = jackpotPool / jackpotCount;
        for (uint256 i = 0; i < jackpotCount; i++) {
            (bool ok, ) = jackpotWinnersTemp[i].call{value: perJackpot}("");
            require(ok, "Jackpot transfer failed");
        }

        uint256 secondaryCount = participantCount / 10; // 10%
        if (secondaryCount == 0) secondaryCount = 1;

        uint256 maxSecondaryWinners = 20; // razuman gornji limit
        if (secondaryCount > maxSecondaryWinners) {
             secondaryCount = maxSecondaryWinners;
        }

        bool[] memory isJackpot = new bool[](participantCount);
        for (uint256 i = 0; i < participantCount; i++) {
            if (matches[i] == maxMatches) isJackpot[i] = true;
        }

        bool[] memory picked = new bool[](participantCount);
        address[] memory secondaryWinners = new address[](secondaryCount);

        uint256 pickedCount = 0;
        uint256 seed = randomSeed;

        uint256 safety = 0;
        while (pickedCount < secondaryCount) {
            safety++;
            require(safety < 5000, "Selection loop guard"); // safety for demo

            seed = uint256(keccak256(abi.encodePacked(seed, pickedCount, address(this))));
            uint256 idx = seed % participantCount;

            if (picked[idx]) continue;

            if (isJackpot[idx]) {
                if (_hasAvailableNonJackpot(isJackpot, picked)) {
                    continue;
                }
            }

            picked[idx] = true;
            secondaryWinners[pickedCount] = participants[idx];
            pickedCount++;
        }

        uint256 perSecondary = secondaryPool / secondaryCount;
        for (uint256 i = 0; i < secondaryCount; i++) {
            (bool ok2, ) = secondaryWinners[i].call{value: perSecondary}("");
            require(ok2, "Secondary transfer failed");
        }

        (bool okOwner, ) = owner.call{value: ownerFee}("");
        require(okOwner, "Owner fee transfer failed");

        phase = Phase.Paid;

        emit PaidOut(jackpotPool, secondaryPool, ownerFee);
    }

    function _validateNumbers(uint8[5] calldata nums) internal pure {
        bool[51] memory seen; // 1..50
        for (uint256 i = 0; i < 5; i++) {
            require(nums[i] >= 1 && nums[i] <= 50, "Out of range");
            require(!seen[nums[i]], "Duplicate");
            seen[nums[i]] = true;
        }
    }

    function _countMatches(uint8[5] memory a, uint8[5] memory b) internal pure returns (uint8) {
        uint8 count = 0;
        for (uint256 i = 0; i < 5; i++) {
            for (uint256 j = 0; j < 5; j++) {
                if (a[i] == b[j]) {
                    count++;
                    break;
                }
            }
        }
        return count;
    }

    function _hasAvailableNonJackpot(bool[] memory isJackpot, bool[] memory picked) internal pure returns (bool) {
        for (uint256 i = 0; i < isJackpot.length; i++) {
            if (!isJackpot[i] && !picked[i]) return true;
        }
        return false;
    }

    receive() external payable {}
}
