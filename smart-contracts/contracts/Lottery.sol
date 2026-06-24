// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

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
    uint256 public constant DRAW_INTERVAL = 4 minutes;

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
    uint256 public vrfRequestTimestamp;
    uint256 public constant VRF_TIMEOUT = 30 minutes;

    mapping(address => uint256) public pendingWithdrawals;
    uint256 public totalPending;

    bool public automationEnabled;
    address public automationRegistry;
    uint256 public lastUpkeepTimestamp;

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
    event EmergencyWithdraw(address indexed to, uint256 amount);
    event WinningsCredited(address indexed account, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);
    event VRFRequestCancelled(uint256 indexed round, uint256 indexed requestId);
    event AutomationToggled(bool enabled);
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

        nextDrawTime = block.timestamp + DRAW_INTERVAL;
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
        if (phase == Phase.Paid) {
            return accumulatedJackpot;
        }
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

    /**
     * @notice withdraw winnings credited to the caller
     */
    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "Nothing to withdraw");

        pendingWithdrawals[msg.sender] = 0;
        totalPending -= amount;

        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Withdraw failed");

        emit Withdrawn(msg.sender, amount);
    }

    // Chainlink VRF callback

    /**
     * @notice VRF callback - Chainlink delivers random numbers
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

    // Chainlink Automation

    /**
     * @notice automation check - decides which lifecycle action is due
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

        bool timeReached = block.timestamp >= nextDrawTime;

        if (phase == Phase.Open && timeReached && participants.length > 0 && !vrfRequestPending) {
            return (true, abi.encode(uint8(1)));
        }
        if (phase == Phase.Drawn) {
            return (true, abi.encode(uint8(2)));
        }
        if (phase == Phase.Paid) {
            return (true, abi.encode(uint8(3)));
        }
        if (phase == Phase.Open && timeReached && participants.length == 0) {
            return (true, abi.encode(uint8(4)));
        }

        return (false, "");
    }

    /**
     * @notice automation execution - only the registry or owner may call
     */
    function performUpkeep(bytes calldata performData) external override onlyAutomation {
        require(automationEnabled, "Automation disabled");

        uint8 action = abi.decode(performData, (uint8));

        if (action == 1) {
            require(block.timestamp >= nextDrawTime, "Too early");
            _closeAndRequestDraw();
        } else if (action == 2) {
            _payout();
        } else if (action == 3) {
            _startNewRound();
        } else if (action == 4) {
            _skipToNextDrawTime();
        } else {
            revert("Unknown action");
        }

        lastUpkeepTimestamp = block.timestamp;
    }

    // owner functions (manual fallbacks)

    /**
     * @notice close lottery and request VRF random number
     */
    function closeLotteryAndRequestDraw() external onlyOwner {
        _closeAndRequestDraw();
    }

    /**
     * @notice payout winners after VRF has delivered winning numbers
     */
    function payoutWinners() external onlyOwner nonReentrant {
        _payout();
    }

    /**
     * @notice start a new lottery round
     */
    function startNewRound() external onlyOwner {
        _startNewRound();
    }

    /**
     * @notice cancel a VRF request that never got fulfilled and reopen the round
     */
    function cancelStuckVRFRequest() external onlyOwner {
        require(vrfRequestPending, "No pending request");
        require(phase == Phase.Closed, "Wrong phase");
        require(block.timestamp >= vrfRequestTimestamp + VRF_TIMEOUT, "Timeout not reached");

        vrfRequestPending = false;
        phase = Phase.Open;

        emit VRFRequestCancelled(currentRound, vrfRequestId);
    }

    /**
     * @notice enable or disable automation
     */
    function toggleAutomation(bool enabled) external onlyOwner {
        automationEnabled = enabled;
        emit AutomationToggled(enabled);
    }

    /**
     * @notice set the address allowed to call performUpkeep
     */
    function setAutomationRegistry(address registry) external onlyOwner {
        require(registry != address(0), "No address");
        automationRegistry = registry;
        emit AutomationRegistrySet(registry);
    }

    // lifecycle internals

    function _closeAndRequestDraw() internal {
        require(phase == Phase.Open, "Wrong phase");
        require(participants.length > 0, "No participants");
        require(!vrfRequestPending, "VRF pending");

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
        vrfRequestTimestamp = block.timestamp;
        emit DrawRequested(currentRound, vrfRequestId);
    }

    function _payout() internal {
        require(phase == Phase.Drawn, "Wrong phase");
        require(participants.length > 0, "No participants");

        uint256 pool = address(this).balance;
        require(pool > 0, "No funds");

        uint256 currentRoundBalance = amountCollected;
        (uint256 currentJackpotPool, uint256 secondaryPool, uint256 ownerFee) = _calculatePools(currentRoundBalance);

        uint256 totalJackpotPool = currentJackpotPool + accumulatedJackpot;

        uint8[] memory matches = _calculateMatches();
        (bool jackpotWon, uint256 jackpotPaid) = _payoutJackpot(totalJackpotPool, matches);

        if (!jackpotWon) {
            accumulatedJackpot = totalJackpotPool;
        } else {
            accumulatedJackpot = 0;
        }

        _payoutSecondary(secondaryPool, matches, jackpotWon);

        _credit(owner(), ownerFee);

        phase = Phase.Paid;

        emit PaidOut(currentRound, jackpotPaid, secondaryPool, ownerFee, jackpotWon);
    }

    function _startNewRound() internal {
        require(phase == Phase.Paid, "Wrong phase");

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

        nextDrawTime = block.timestamp + DRAW_INTERVAL;

        emit NewRoundStarted(currentRound, accumulatedJackpot, nextDrawTime);
    }

    function _skipToNextDrawTime() internal {
        require(phase == Phase.Open, "Wrong phase");
        require(participants.length == 0, "Has participants");

        nextDrawTime = block.timestamp + DRAW_INTERVAL;
    }

    /**
     * @notice emergency withdraw - extract all ETH from contract after payout phase
     */
    function emergencyWithdraw() external onlyOwner {
        require(phase == Phase.Paid, "Can only withdraw after payout");

        uint256 balance = address(this).balance - totalPending;
        require(balance > 0, "No balance");

        (bool ok, ) = owner().call{value: balance}("");
        require(ok, "Withdraw failed");

        emit EmergencyWithdraw(owner(), balance);
    }

    // internal helper functions

    function _credit(address account, uint256 amount) internal {
        if (amount == 0) return;
        pendingWithdrawals[account] += amount;
        totalPending += amount;
        emit WinningsCredited(account, amount);
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

        uint256 perJackpot = jackpotPool / jackpotCount;
        for (uint256 i = 0; i < jackpotCount; i++) {
            uint256 amount = perJackpot;

            if (i == jackpotCount - 1) {
                amount = jackpotPool - (perJackpot * (jackpotCount - 1));
            }

            _credit(jackpotWinnersTemp[i], amount);
        }

        jackpotPaid = jackpotPool;
        return (true, jackpotPaid);
    }

    function _payoutSecondary(uint256 secondaryPool, uint8[] memory matches, bool jackpotWon) internal {
        uint256 participantCount = participants.length;

        uint256 secondaryCount = participantCount / 10;
        if (secondaryCount == 0) secondaryCount = 1;
        if (secondaryCount > 20) secondaryCount = 20;

        address[] memory secondaryWinners = _selectSecondaryWinners(matches, secondaryCount, jackpotWon);

        uint256 perSecondary = secondaryPool / secondaryCount;
        for (uint256 i = 0; i < secondaryCount; i++) {
            uint256 amount = perSecondary;

            if (i == secondaryCount - 1) {
                amount = secondaryPool - (perSecondary * (secondaryCount - 1));
            }

            _credit(secondaryWinners[i], amount);
        }
    }

    function _selectSecondaryWinners(uint8[] memory matches, uint256 secondaryCount, bool jackpotWon) internal view returns (address[] memory) {
        uint256 participantCount = participants.length;

        bool[] memory isJackpot = new bool[](participantCount);
        if (jackpotWon) {
            for (uint256 i = 0; i < participantCount; i++) {
                if (matches[i] == 5) isJackpot[i] = true;
            }
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

    receive() external payable {}
}
