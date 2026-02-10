// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

// Chainlink Automation interface
interface AutomationCompatibleInterface {
    function checkUpkeep(bytes calldata checkData) external returns (bool upkeepNeeded, bytes memory performData);
    function performUpkeep(bytes calldata performData) external;
}

contract Lottery is VRFConsumerBaseV2Plus, AutomationCompatibleInterface {
    uint256 public currentRound;
    uint256 public accumulatedJackpot; // if nobody guesses 5 correct numbers, amount collected rolls over to the next round

    address[] public participants;
    uint256 public amountCollected;
    uint256 public drawTimestamp;

    uint256 public constant TICKET_PRICE = 0.005 ether;

    uint256 public nextDrawTime;
    uint256 public constant DRAW_INTERVAL = 2 minutes;

    enum Phase { Open, Closed, Drawn, Paid }
    Phase public phase;

    struct Entry {
        bool exists;
        uint8[5] numbers;
    }

    mapping(uint256 => mapping(address => Entry)) public entries;

    uint8[5] public winningNumbers;
    uint256 public randomSeed;

    // Chainlink VRF configuration
    uint256 public s_subscriptionId;
    bytes32 public s_keyHash;
    uint32 public s_callbackGasLimit = 500000;
    uint16 public s_requestConfirmations = 3;
    uint32 public s_numWords = 2;

    uint256 public vrfRequestId;
    bool public vrfRequestPending;
    uint256 public lastUpkeepTimestamp;
    bool public automationEnabled;
    address public automationRegistry; // only this address can perform upkeep

    uint256 private locked = 1;
    modifier nonReentrant() {
        require(locked == 1, "Reentrancy");
        locked = 2;
        _;
        locked = 1;
    }

    modifier onlyAutomation() {
        require(msg.sender == automationRegistry || msg.sender == owner(), "Not authorized");
        _;
    }

    event Participated(address indexed user, uint256 indexed round, uint8[5] numbers);
    event Closed(uint256 indexed round, uint256 timestamp);
    event DrawRequested(uint256 indexed round, uint256 indexed vrfRequestId);
    event DrawSet(uint256 indexed round, uint8[5] winningNumbers, uint256 seed, uint256 timestamp);
    event PaidOut(uint256 indexed round, uint256 jackpotPool, uint256 secondaryPool, uint256 ownerFee, bool jackpotWon);
    event JackpotRollover(uint256 indexed fromRound, uint256 indexed toRound, uint256 amount);
    event NewRoundStarted(uint256 indexed round, uint256 accumulatedJackpot, uint256 nextDrawTime);
    event AutomationToggled(bool enabled);
    event OwnerFeeTransferFailed(uint256 amount);
    event EmergencyWithdraw(address indexed to, uint256 amount);
    event AutomationRegistrySet(address indexed registry);

    constructor(
        uint256 vrfSubscriptionId,
        address vrfCoordinator,
        bytes32 keyHash
    ) VRFConsumerBaseV2Plus(vrfCoordinator) {
        currentRound = 1;
        phase = Phase.Open;

        // VRF setup
        s_subscriptionId = vrfSubscriptionId;
        s_keyHash = keyHash;

        // calculate first draw time
        nextDrawTime = _calculateNextDrawTime();
        automationEnabled = true;
    }

    // public view functions

    function participantsCount() external view returns (uint256) {
        return participants.length;
    }

    function getUserEntry(uint256 round, address user) external view returns (bool exists, uint8[5] memory numbers) {
        Entry memory entry = entries[round][user];
        return (entry.exists, entry.numbers);
    }

    function getCurrentJackpot() external view returns (uint256) {
        uint256 currentPoolJackpot = (amountCollected * 50) / 100;
        return currentPoolJackpot + accumulatedJackpot;
    }

    // participant functions

    function participate(uint8[5] calldata nums) external payable {
        require(phase == Phase.Open, "Not open");
        require(msg.value == TICKET_PRICE, "Wrong ticket price");
        require(!entries[currentRound][msg.sender].exists, "Already participated");

        _validateNumbers(nums);

        entries[currentRound][msg.sender] = Entry({ exists: true, numbers: nums });
        participants.push(msg.sender);
        amountCollected += msg.value;

        emit Participated(msg.sender, currentRound, nums);
    }

    // Chainlink automation (for running rounds each x minutes)

    /**
     * @notice Chainlink automation check - checks every minute
     */
    function checkUpkeep(bytes calldata /* checkData */)
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        if (!automationEnabled) {
            return (false, "");
        }

        bool timeReached = (block.timestamp >= nextDrawTime);

        // ACTION 1: close lottery and request VRF when time reached
        if (phase == Phase.Open && timeReached && participants.length > 0) {
            return (true, abi.encode(uint8(1)));
        }

        // ACTION 2: payout after VRF callback
        if (phase == Phase.Drawn) {
            return (true, abi.encode(uint8(2)));
        }

        // ACTION 3: start new round after payout
        if (phase == Phase.Paid) {
            return (true, abi.encode(uint8(3)));
        }

        // ACTION 4: skip to next draw time if no participants
        if (phase == Phase.Open && timeReached && participants.length == 0) {
            return (true, abi.encode(uint8(4)));
        }

        return (false, "");
    }

    /**
     * @notice Chainlink automation execution
     * @dev only automation registry or owner can call this
     */
    function performUpkeep(bytes calldata performData) external override onlyAutomation {
        require(automationEnabled, "Automation disabled");

        uint8 action = abi.decode(performData, (uint8));

        if (action == 1) {
            _closeLotteryAndRequestDraw();
        } else if (action == 2) {
            _payoutWinnersAutomated();
        } else if (action == 3) {
            _startNewRoundAutomated();
        } else if (action == 4) {
            _skipToNextDrawTime();
        }

        lastUpkeepTimestamp = block.timestamp;
    }

    // Chainlink VRF

    /**
     * @notice VRF callback - Chainlink dostavlja random brojeve
     */
    function fulfillRandomWords(
        uint256 /* requestId */,
        uint256[] calldata randomWords
    ) internal override {
        require(vrfRequestPending, "No pending request");
        require(phase == Phase.Closed, "Wrong phase");

        // generate 5 unique winning numbers from randomWords[0]
        winningNumbers = _generateWinningNumbers(randomWords[0]);

        // use second random word as seed for secondary winners
        randomSeed = randomWords[1];

        drawTimestamp = block.timestamp;
        phase = Phase.Drawn;
        vrfRequestPending = false;

        emit DrawSet(currentRound, winningNumbers, randomSeed, drawTimestamp);
    }

    // internal automated functions

    /**
     * @notice close lottery and request VRF
     */
    function _closeLotteryAndRequestDraw() internal {
        require(phase == Phase.Open, "Wrong phase");
        require(block.timestamp >= nextDrawTime, "Too early");
        require(participants.length > 0, "No participants");
        require(!vrfRequestPending, "VRF pending");

        phase = Phase.Closed;
        emit Closed(currentRound, block.timestamp);

        // request random words from Chainlink VRF
        vrfRequestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: s_keyHash,
                subId: s_subscriptionId,
                requestConfirmations: s_requestConfirmations,
                callbackGasLimit: s_callbackGasLimit,
                numWords: s_numWords,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({nativePayment: false})
                )
            })
        );

        vrfRequestPending = true;
        emit DrawRequested(currentRound, vrfRequestId);
    }

    /**
     * @notice automated payout after VRF callback
     */
    function _payoutWinnersAutomated() internal nonReentrant {
        require(phase == Phase.Drawn, "Wrong phase");
        require(participants.length > 0, "No participants");

        uint256 pool = address(this).balance;
        require(pool > 0, "No funds");

        // calculate pools from current round balance only (amountCollected)
        // accumulatedJackpot is already part of address(this).balance from previous rounds
        uint256 currentRoundBalance = amountCollected;
        (uint256 currentJackpotPool, uint256 secondaryPool, uint256 ownerFee) = _calculatePools(currentRoundBalance);

        // total jackpot = current round jackpot + accumulated from previous rounds
        uint256 totalJackpotPool = currentJackpotPool + accumulatedJackpot;

        uint8[] memory matches = _calculateMatches();
        (bool jackpotWon, uint256 jackpotPaid) = _payoutJackpot(totalJackpotPool, matches);

        if (!jackpotWon) {
            // rollover - store unpaid jackpot for next round
            accumulatedJackpot = totalJackpotPool;
        } else {
            accumulatedJackpot = 0;
        }

        _payoutSecondary(secondaryPool, matches);

        (bool okOwner, ) = owner().call{value: ownerFee}("");
        if (!okOwner) {
            // owner fee remains in contract, can be withdrawn later
            emit OwnerFeeTransferFailed(ownerFee);
        }

        phase = Phase.Paid;

        emit PaidOut(currentRound, jackpotPaid, secondaryPool, ownerFee, jackpotWon);
    }

    /**
     * @notice automated start of new round
     */
    function _startNewRoundAutomated() internal {
        require(phase == Phase.Paid, "Wrong phase");

        // reset for new round
        delete participants;
        amountCollected = 0;
        drawTimestamp = 0;
        delete winningNumbers;
        randomSeed = 0;

        if (accumulatedJackpot > 0) {
            emit JackpotRollover(currentRound, currentRound + 1, accumulatedJackpot);
        }

        currentRound++;
        phase = Phase.Open;

        nextDrawTime = _calculateNextDrawTime();

        emit NewRoundStarted(currentRound, accumulatedJackpot, nextDrawTime);
    }

    /**
     * @notice skip to next draw if no participants
     */
    function _skipToNextDrawTime() internal {
        require(phase == Phase.Open, "Wrong phase");
        require(participants.length == 0, "Has participants");

        nextDrawTime = _calculateNextDrawTime();
    }

    // helper functions

    /**
     * @notice calculate next draw time
     */
    function _calculateNextDrawTime() internal view returns (uint256) {
        return block.timestamp + DRAW_INTERVAL;
    }

    /**
     * @notice generate 5 unique winning numbers (1-50) from VRF seed
     */
    function _generateWinningNumbers(uint256 seed) internal pure returns (uint8[5] memory) {
        uint8[5] memory numbers;
        bool[51] memory used; // 1-50
        uint256 currentSeed = seed;

        for (uint8 i = 0; i < 5; i++) {
            uint8 num;
            uint256 attempts = 0;

            do {
                currentSeed = uint256(keccak256(abi.encodePacked(currentSeed, i, attempts)));
                num = uint8((currentSeed % 50) + 1);
                attempts++;
            } while (used[num] && attempts < 100);

            require(!used[num], "Failed to generate unique numbers");
            used[num] = true;
            numbers[i] = num;
        }

        return numbers;
    }

    function _calculatePools(uint256 pool) internal pure returns (uint256 jackpotPool, uint256 secondaryPool, uint256 ownerFee) {
        jackpotPool = (pool * 50) / 100;
        secondaryPool = (pool * 40) / 100;
        ownerFee = pool - jackpotPool - secondaryPool;
    }

    function _calculateMatches() internal view returns (uint8[] memory) {
        uint256 participantCount = participants.length;
        uint8[] memory matches = new uint8[](participantCount);

        for (uint256 i = 0; i < participantCount; i++) {
            address participant = participants[i];
            if (entries[currentRound][participant].exists) {
                matches[i] = _countMatches(entries[currentRound][participant].numbers, winningNumbers);
            }
        }

        return matches;
    }

    function _payoutJackpot(uint256 jackpotPool, uint8[] memory matches) internal returns (bool jackpotWon, uint256 jackpotPaid) {
        uint256 participantCount = participants.length;
        uint8 maxMatches = 0;

        for (uint256 i = 0; i < participantCount; i++) {
            if (matches[i] > maxMatches) maxMatches = matches[i];
        }

        jackpotWon = (maxMatches == 5);

        if (!jackpotWon) {
            return (false, 0);
        }

        address[] memory jackpotWinnersTemp = new address[](participantCount);
        uint256 jackpotCount = 0;

        for (uint256 i = 0; i < participantCount; i++) {
            if (matches[i] == 5) {
                jackpotWinnersTemp[jackpotCount] = participants[i];
                jackpotCount++;
            }
        }
        require(jackpotCount > 0, "No jackpot winners?");

        // last winner gets remainder to avoid dust ETH
        uint256 perJackpot = jackpotPool / jackpotCount;
        for (uint256 i = 0; i < jackpotCount; i++) {
            uint256 amount = perJackpot;

            if (i == jackpotCount - 1) {
                amount = jackpotPool - (perJackpot * (jackpotCount - 1));
            }

            (bool ok, ) = jackpotWinnersTemp[i].call{value: amount}("");
            require(ok, "Jackpot transfer failed");
        }

        jackpotPaid = jackpotPool;
        return (true, jackpotPaid);
    }

    function _payoutSecondary(uint256 secondaryPool, uint8[] memory matches) internal {
        uint256 participantCount = participants.length;

        uint256 secondaryCount = participantCount / 10;
        if (secondaryCount == 0) secondaryCount = 1;
        if (secondaryCount > 20) secondaryCount = 20;

        address[] memory secondaryWinners = _selectSecondaryWinners(matches, secondaryCount);

        // last winner gets remainder to avoid dust ETH
        uint256 perSecondary = secondaryPool / secondaryCount;
        for (uint256 i = 0; i < secondaryCount; i++) {
            uint256 amount = perSecondary;

            if (i == secondaryCount - 1) {
                amount = secondaryPool - (perSecondary * (secondaryCount - 1));
            }

            (bool ok, ) = secondaryWinners[i].call{value: amount}("");
            require (ok, "Secondary transfer failed");
        }
    }

    function _selectSecondaryWinners(uint8[] memory matches, uint256 secondaryCount) internal view returns (address[] memory) {
        uint256 participantCount = participants.length;
        uint8 maxMatches = 0;

        for (uint256 i = 0; i < participantCount; i++) {
            if (matches[i] > maxMatches) maxMatches = matches[i];
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
            require(safety < 5000, "Selection loop guard");

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

        return secondaryWinners;
    }

    function _validateNumbers(uint8[5] calldata nums) internal pure {
        bool[51] memory seen;
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

    // owner emergency functions

    /**
     * @notice enable/disable automation (emergency only)
     */
    function toggleAutomation(bool enabled) external onlyOwner {
        automationEnabled = enabled;
        emit AutomationToggled(enabled);
    }

    /**
     * @notice set Chainlink automation registry address
     * @dev allows owner to set which address can call performUpkeep
     */
    function setAutomationRegistry(address _registry) external onlyOwner {
        require(_registry != address(0), "No address");
        automationRegistry = _registry;
        emit AutomationRegistrySet(_registry);
    }

    /**
     * @notice manual close lottery (emergency fallback if automation fails)
     */
    function emergencyCloseLottery() external onlyOwner {
        require(!automationEnabled, "Automation must be disabled");
        require(phase == Phase.Open, "Wrong phase");
        require(participants.length > 0, "No participants");

        phase = Phase.Closed;
        emit Closed(currentRound, block.timestamp);

        vrfRequestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: s_keyHash,
                subId: s_subscriptionId,
                requestConfirmations: s_requestConfirmations,
                callbackGasLimit: s_callbackGasLimit,
                numWords: s_numWords,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({nativePayment: false})
                )
            })
        );

        vrfRequestPending = true;
        emit DrawRequested(currentRound, vrfRequestId);
    }

    /**
     * @notice manual payout (emergency fallback)
     */
    function emergencyPayout() external onlyOwner nonReentrant {
        require(!automationEnabled, "Automation must be disabled");
        _payoutWinnersAutomated();
    }

    /**
     * @notice manual start new round (emergency fallback)
     */
    function emergencyStartNewRound() external onlyOwner {
        require(!automationEnabled, "Automation must be disabled");
        _startNewRoundAutomated();
    }

    /**
     * @notice emergency withdraw - extract all ETH from contract
     * @dev only callable when automation is disabled and after payout phase
     */
    function emergencyWithdraw() external onlyOwner {
        require(!automationEnabled, "Automation must be disabled first");
        require(phase == Phase.Paid, "Can only withdraw after payout");

        uint256 balance = address(this).balance;
        require(balance > 0, "No balance");

        (bool ok, ) = owner().call{value: balance}("");
        require(ok, "Withdraw failed");

        emit EmergencyWithdraw(owner(), balance);
    }

    receive() external payable {}
}
