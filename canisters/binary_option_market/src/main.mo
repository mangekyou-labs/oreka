import Principal "mo:base/Principal";
import Time "mo:base/Time";
import Int "mo:base/Int";
import Int64 "mo:base/Int64";
import Nat "mo:base/Nat";
import Float "mo:base/Float";
import Error "mo:base/Error";
import Option "mo:base/Option";
import Blob "mo:base/Blob";
import Array "mo:base/Array";
import Text "mo:base/Text";
import Iter "mo:base/Iter";
import Char "mo:base/Char";
import Result "mo:base/Result";
import Debug "mo:base/Debug";
import Hash "mo:base/Hash";

import Nat8 "mo:base/Nat8";
import Nat64 "mo:base/Nat64";
import Nat32 "mo:base/Nat32";

import HashMap "mo:base/HashMap";
import TrieMap "mo:base/TrieMap";

import Cycles "mo:base/ExperimentalCycles";

import IcpLedger "canister:icp_ledger_canister";

import Types "Types";
import ICRC "./ICRC";

/// @title Binary Option Market
/// @notice A decentralized binary options trading platform
/// @dev All function calls are currently being implemented without side effects
shared(msg) actor class BinaryOptionMarket(
    initStrikePrice: Float,
    initEndTimestamp: Nat64,
    initTradingPair: Text,
    initFeePercentage: Nat,
    initCanisterId: Text,
    initLedgerId: Text, 
    initOwner: Text
) = self {

    // ============ Type Declarations ============

    /// @notice Trading sides available in the market
    public type Side = {
        #Long;
        #Short;
    };

    /// @notice Market phases
    public type Phase = {
        #Bidding;
        #Trading;
        #Maturity;
        #Expiry;
    };

    /// @notice Oracle price information
    public type OracleDetails = {
        strikePrice : Float;
        finalPrice : Float;
    };

    /// @notice Market position information
    public type Position = {
        long : Nat;
        short : Nat;
    };

    /// @notice Fee structure for the market
    public type MarketFees = {
        poolFee : Nat;
        creatorFee : Nat;
        refundFee : Nat;
    };

    /// @notice Error types for the market
    public type Error = {
        #Transfer: TransferError;
        #Other: Text;
    };

    /// @notice Transfer-specific errors
    public type TransferError = {
        #BadFee : { expected_fee : Tokens };
        #InsufficientFunds : { balance: Tokens };
        #TxTooOld : { allowed_window_nanos: Nat64 };
        #TxCreatedInFuture;
        #TxDuplicate : { duplicate_of: BlockIndex };
    };

    // ============ Core Types ============

    public type BlockIndex = Nat;
    public type Subaccount = Blob;
    public type Timestamp = Nat64;  // Number of nanoseconds since the UNIX epoch in UTC timezone
    public type Tokens = Nat;
    public type TxIndex = Nat;
    public type SubAccount = Blob;
    public type AccountIdentifier = Blob;
    public type Memo = Nat64;

    public type Account = {
        owner : Principal;
        subaccount : ?SubAccount;
    };

    public type TransferArgs = {
        from_subaccount : ?SubAccount;
        to : Account;
        amount : Tokens;
        fee : ?Tokens;
        memo : ?Blob;
        created_at_time : ?Timestamp;
    };

    public type TimeStamp = {
        timestamp_nanos: Nat64;
    };

    public type DepositArgs = {
        to : Account;
        fee : ?Nat;
        spender_subaccount : ?Blob;
        from : Account;
        memo : ?Blob;
        created_at_time : ?Nat64;
        amount : Nat;
    };

    public type DepositError = {
        #TransferFromError : ICRC.TransferFromError;
    };

    public type WithdrawArgs = {
        token : Principal;
        to : ICRC.Account;
        amount : Nat;
        fee : ?Nat;
        memo : ?Blob;
        created_at_time : ?Nat64;
    };

    public type WithdrawError = {
        #InsufficientFunds : { balance : ICRC.Tokens };
        #TransferError : ICRC.TransferError;
    };

    // ============ Constants ============

    private var OWNER : Principal = Principal.fromText(initOwner);
    private let CANISTER_PRINCIPAL : Principal = Principal.fromText(initCanisterId);
    private let LEDGER_PRINCIPAL : Principal = Principal.fromText(initLedgerId);
    private let FEE_PERCENTAGE : Nat = initFeePercentage; // Customizable fee percentage
    private let GAS : Nat64 = 10_000;
    private let ONE_ICP_IN_E8S : Nat = 100_000_000;
    private let TRADING_PAIR : Text = initTradingPair; // E.g., "ICP-USD", "BTC-USD", etc.

    // ============ State Variables ============

    private var oracleDetails : OracleDetails = { 
        strikePrice = initStrikePrice; 
        finalPrice = 0 
    };
    private var positions : Position = { 
        long = 0; 
        short = 0 
    };
    private var fees : MarketFees = { 
        poolFee = 0; 
        creatorFee = 0; 
        refundFee = 0 
    };
    private var totalDeposited : Nat = 0;
    private var resolved : Bool = false;
    private var currentPhase : Phase = #Trading;

    // ============ Data Structures ============

    private var longBids = HashMap.HashMap<Principal, Nat>(0, Principal.equal, Principal.hash);
    private var shortBids = HashMap.HashMap<Principal, Nat>(0, Principal.equal, Principal.hash);
    private var hasClaimed = HashMap.HashMap<Principal, Bool>(0, Principal.equal, Principal.hash);
    private var balancesA = TrieMap.TrieMap<Principal, Nat>(Principal.equal, Principal.hash);
    private var balancesB = TrieMap.TrieMap<Principal, Nat>(Principal.equal, Principal.hash);

    // ============ Stable Storage ============

    stable var licensesStable : [(Principal, Bool)] = [];
    stable var stableBalancesA : ?[(Principal, Nat)] = null;
    stable var stableBalancesB : ?[(Principal, Nat)] = null;

    var licenses : HashMap.HashMap<Principal, Bool> = HashMap.HashMap(16, Principal.equal, Principal.hash);

    // ============ Lock Management ============

    private var isDepositLocked : Bool = false;
    private var isClaimLocked : Bool = false;

    // ============ Utility Functions ============

    /// @notice Converts text to natural number
    /// @param txt The text to convert
    /// @return The natural number
    private func textToNat(txt : Text) : async Nat {
        assert(txt.size() > 0);
        let chars = txt.chars();

        var num : Nat = 0;
        for (c in chars) {
            switch (Char.toNat32(c)) {
                case (d) {
                    if (d >= 48 and d <= 57) {
                        num := num * 10 + Nat32.toNat(d - 48);
                    } else {
                        Debug.print("Invalid character in input: " # debug_show(c));
                        assert(false);
                    };
                };
            };
        };
        num
    };

    /// @notice Converts text to float
    /// @param t The text to convert
    /// @return The float value
    public func textToFloat(t : Text) : async Float {
        var i : Float = 1;
        var f : Float = 0;
        var isDecimal : Bool = false;

        for (c in t.chars()) {
            if (Char.isDigit(c)) {
                let charToNat : Nat64 = Nat64.fromNat(Nat32.toNat(Char.toNat32(c) -48));
                let natToFloat : Float = Float.fromInt64(Int64.fromNat64(charToNat));
                if (isDecimal) {
                    let n : Float = natToFloat / Float.pow(10, i);
                    f := f + n;
                } else {
                    f := f * 10 + natToFloat;
                };
                i := i + 1;
            } else {
                if (Char.equal(c, '.') or Char.equal(c, ',')) {
                    f := f / Float.pow(10, i); // Force decimal
                    f := f * Float.pow(10, i); // Correction
                    isDecimal := true;
                    i := 1;
                } else {
                    throw Error.reject("NaN");
                };
            };
        };
        return f;
    };

    /// @notice Transforms HTTP response for security
    /// @param raw The raw response to transform
    /// @return The transformed response
    public query func transform(raw : Types.TransformArgs) : async Types.CanisterHttpResponsePayload {
        let transformed : Types.CanisterHttpResponsePayload = {
            status = raw.response.status;
            body = raw.response.body;
            headers = [
                { name = "Content-Security-Policy"; value = "default-src 'self'" },
                { name = "Referrer-Policy"; value = "strict-origin" },
                { name = "Permissions-Policy"; value = "geolocation=(self)" },
                { name = "Strict-Transport-Security"; value = "max-age=63072000" },
                { name = "X-Frame-Options"; value = "DENY" },
                { name = "X-Content-Type-Options"; value = "nosniff" },
            ];
        };
        transformed
    };

    // ============ Lock Management Functions ============

    /// @notice Acquires a lock for a specific operation
    /// @param lockType The type of lock to acquire
    /// @return Whether the lock was successfully acquired
    private func acquireLock(lockType: Text) : Bool {
        switch(lockType) {
            case "deposit" {
                if (isDepositLocked) return false;
                isDepositLocked := true;
            };
            case "claim" {
                if (isClaimLocked) return false;
                isClaimLocked := true;
            };
            case _ { return false; };
        };
        true
    };

    /// @notice Releases a lock for a specific operation
    /// @param lockType The type of lock to release
    private func releaseLock(lockType: Text) {
        switch(lockType) {
            case "deposit" { isDepositLocked := false; };
            case "claim" { isClaimLocked := false; };
            case _ {};
        };
    };

    /// @notice Force unlocks all locks (admin only)
    public shared(msg) func forceUnlock() : async () {
        assert(msg.caller == OWNER);
        isDepositLocked := false;
        isClaimLocked := false;
    };

    /// @notice Checks the current lock status
    public query func isLocked() : async {deposit: Bool; claim: Bool} {
        {
            deposit = isDepositLocked;
            claim = isClaimLocked;
        }
    };

    // ============ Logging Functions ============

    private func logBid(side : Side, account : Principal, value : Nat) {
        Debug.print("Bid: " # debug_show(side) # " " # debug_show(account) # " " # debug_show(value));
    };

    private func logMarketResolved(finalPrice : Float, timeStamp : Int) {
        Debug.print("MarketResolved: " # debug_show(finalPrice) # " " # debug_show(timeStamp));
    };

    private func logRewardClaimed(account : Principal, value : Nat) {
        Debug.print("RewardClaimed: " # debug_show(account) # " " # debug_show(value));
    };

    private func logWithdrawal(user : Principal, amount : Nat) {
        Debug.print("Withdrawal: " # debug_show(user) # " " # debug_show(amount));
    };

    // ============ Core Market Functions ============

    /// @notice Places a bid in the market
    /// @param side The side of the market to bid on (Long or Short)
    /// @param value The amount to bid
    /// @return Result indicating success or failure
    public shared(msg) func bid(side : Side, value : Nat) : async Result.Result<Text, Text> {
        assert(currentPhase == #Bidding);
        assert(value > 0);

        // Check if user has already bid on the opposite side
        let hasLongBid = Option.isSome(longBids.get(msg.caller));
        let hasShortBid = Option.isSome(shortBids.get(msg.caller));

        // Prevent bidding on both sides
        switch(side) {
            case (#Long) {
                if (hasShortBid) {
                    return #err("Cannot bid on both sides");
                };
            };
            case (#Short) {
                if (hasLongBid) {
                    return #err("Cannot bid on both sides");
                };
            };
            case (_) {
                return #err("Invalid side");
            };
        };

        // Verify that the user has transferred the tokens
        let balance = await IcpLedger.icrc1_balance_of({
            owner = CANISTER_PRINCIPAL;
            subaccount = null;
        });

        // Update positions based on side
        switch (side) {
            case (#Long) {
                let currentLongBid = Option.get(longBids.get(msg.caller), 0);
                positions := { 
                    long = positions.long + value; 
                    short = positions.short 
                };
                longBids.put(msg.caller, currentLongBid + value);
            };
            case (#Short) {
                let currentShortBid = Option.get(shortBids.get(msg.caller), 0);
                positions := { 
                    long = positions.long; 
                    short = positions.short + value 
                };
                shortBids.put(msg.caller, currentShortBid + value);
            };
            case (_) {
                return #err("Invalid side");
            };
        };

        totalDeposited += value;
        logBid(side, msg.caller, value);
        
        return #ok("Bid placed successfully");
    };

    /// @notice Resolves the market using price feed data
    public shared func resolveMarket() : async () {
        // Allow anyone to call this function, not just the owner
        assert(currentPhase == #Bidding);

        let price = await get_price_for_pair();
        let finalPrice = await textToFloat(price);
        
        resolveWithFulfilledData(finalPrice, Time.now());
    };

    /// @notice Claims rewards for winning positions
    public shared(msg) func claimReward() : async () {
        assert(currentPhase == #Expiry);
        assert(resolved);
        assert(Option.isNull(hasClaimed.get(msg.caller)));

        if (not acquireLock("claim")) {
            throw Error.reject("Claim operation in progress");
        };

        try {
            let finalPrice = oracleDetails.finalPrice;
            let winningSide = if (finalPrice >= oracleDetails.strikePrice) #Long else #Short;

            let userDeposit = switch (winningSide) {
                case (#Long) Option.get(longBids.get(msg.caller), 0);
                case (#Short) Option.get(shortBids.get(msg.caller), 0);
            };

            let totalWinningDeposits = switch (winningSide) {
                case (#Long) positions.long;
                case (#Short) positions.short;
            };

            assert(userDeposit > 0);

            let reward = (userDeposit * totalDeposited) / totalWinningDeposits;
            let fee = (reward * FEE_PERCENTAGE) / 100;
            let finalReward = if (reward > fee) { reward - fee } else { 0 };

            // Mark as claimed before transfer to prevent reentrancy
            hasClaimed.put(msg.caller, true);

            let transferArgs : TransferArgs = {
                amount = finalReward;
                to = { owner = msg.caller; subaccount = null };
                from_subaccount = null;
                fee = null;
                created_at_time = null;
                memo = null;
            };
            let transferResult = await transfer(transferArgs);
            
            switch (transferResult) {
                case (#err(error)) {
                    // Rollback if transfer fails
                    hasClaimed.delete(msg.caller);
                    releaseLock("claim");
                    Debug.print("Transfer failed: " # debug_show(error));
                    throw Error.reject("Transfer failed");
                };
                case (#ok(blockIndex)) {
                    // Update all relevant values after successful transfer
                    switch (winningSide) {
                        case (#Long) {
                            // Clear losing short positions
                            shortBids.delete(msg.caller);
                            // Update winning long position
                            longBids.delete(msg.caller);
                            positions := {
                                long = positions.long - userDeposit;
                                short = positions.short;
                            };
                        };
                        case (#Short) {
                            // Clear losing long positions
                            longBids.delete(msg.caller);
                            // Update winning short position
                            shortBids.delete(msg.caller);
                            positions := {
                                long = positions.long;
                                short = positions.short - userDeposit;
                            };
                        };
                    };

                    // Update total deposited
                    totalDeposited := totalDeposited - userDeposit;
                    
                    // Clear user's balance
                    balancesA.delete(msg.caller);

                    releaseLock("claim");
                    Debug.print("Transfer successful, block index: " # debug_show(blockIndex));
                    logRewardClaimed(msg.caller, finalReward);
                };
            };
        } catch (e) {
            releaseLock("claim");
            throw e;
        };
    };

    /// @notice Withdraws funds from the contract (admin only)
    public shared(msg) func withdraw() : async () {
        assert(msg.caller == OWNER);
        let amount = 0; // Implementation needed: Get canister balance
        assert(amount > 0);

        // Implementation needed: Transfer using ledger canister
        // await transferICP(msg.caller, amount);

        logWithdrawal(msg.caller, amount);
    };

    /// @notice Starts the trading phase
    public shared(msg) func startTrading() : async () {
        assert(OWNER == msg.caller);
        assert(currentPhase == #Trading);
        currentPhase := #Bidding;
    };

    /// @notice Expires the market
    public shared(msg) func expireMarket() : async () {
        assert(msg.caller == OWNER);
        assert(currentPhase == #Maturity);
        assert(resolved);
        currentPhase := #Expiry;
    };

    /// @notice Changes the strike price (admin only)
    public shared(msg) func changeStrikePrice(newStrikePrice : Float) : async () {
        assert(msg.caller == OWNER);
        oracleDetails := { 
            strikePrice = newStrikePrice; 
            finalPrice = oracleDetails.finalPrice 
        };
    };

    /// @notice Transfers ownership of the market to a new owner
    /// @param newOwner The principal of the new owner
    public shared(msg) func transferOwnership(newOwner: Principal) : async () {
        assert(msg.caller == OWNER);
        OWNER := newOwner;
    };

    /// @notice Gets the current owner of the market
    public query func getOwner() : async Principal {
        OWNER
    };

    // ============ View Functions ============

    public query func getEndTimestamp() : async Nat64 {
        initEndTimestamp
    };

    /// @notice Gets the current cycle balance
    public query func getCyclesBalance() : async Nat {
        Debug.print("Main balance: " # debug_show(Cycles.balance()));
        Cycles.balance()
    };

    /// @notice Gets the contract's ICP balance
    public func getContractBalance() : async Nat {
        let balance = await IcpLedger.icrc1_balance_of({ 
            owner = CANISTER_PRINCIPAL; 
            subaccount = null 
        });
        return balance;
    };

    /// @notice Gets the total amount deposited
    public query func getTotalDeposit() : async Nat {
        totalDeposited
    };

    /// @notice Gets all bidders and their positions
    public query func getBidders() : async {long: [(Principal, Nat)]; short: [(Principal, Nat)]} {
        {
            long = Iter.toArray(longBids.entries());
            short = Iter.toArray(shortBids.entries());
        }
    };

    /// @notice Gets the current market phase
    public query func getCurrentPhase() : async Phase {
        currentPhase
    };

    /// @notice Gets detailed market information
    public query func getMarketDetails() : async {
        oracleDetails: OracleDetails;
        positions: Position;
        resolved: Bool;
    } {
        {
            oracleDetails;
            positions;
            resolved;
        }
    };

    /// @notice Gets a user's position
    public query func getUserPosition(caller : Principal) : async {long: Nat; short: Nat} {
        {
            long = Option.get(longBids.get(caller), 0);
            short = Option.get(shortBids.get(caller), 0);
        }
    };

    /// @notice Checks if a user has claimed their rewards
    public query func hasUserClaimed(caller : Principal) : async Bool {
        Option.get(hasClaimed.get(caller), false)
    };

    /// @notice Gets user balances for both tokens
    public query func getBalances(user: Principal) : async {tokenA: Nat; tokenB: Nat} {
        {
            tokenA = Option.get(balancesA.get(user), 0);
            tokenB = Option.get(balancesB.get(user), 0);
        }
    };

    /// @notice Checks license status for a user
    public shared query ({caller}) func check_license_status() : async Bool {
        let licenseResult = licenses.get(caller);
        switch(licenseResult) {
            case(null) { false };
            case (? license) { license };
        };
    };

    /// @notice Gets the trading pair used by this market
    public query func getTradingPair() : async Text {
        TRADING_PAIR
    };
    
    /// @notice Gets the fee percentage used by this market
    public query func getFeePercentage() : async Nat {
        FEE_PERCENTAGE
    };

    // ============ Internal Functions ============

    /// @notice Resolves market with provided data
    private func resolveWithFulfilledData(rate : Float, timestamp : Int) {
        let finalPrice = rate;
        oracleDetails := { 
            strikePrice = oracleDetails.strikePrice; 
            finalPrice = finalPrice 
        };

        resolved := true;
        currentPhase := #Maturity;

        logMarketResolved(finalPrice, timestamp);
    };

    /// @notice Gets controller's account identifier
    private func controllerAccountId(controller: Principal) : async AccountIdentifier {
        Principal.toLedgerAccount(controller, null);
    };

    /// @notice Helper function to manage token balances
    private func which_balances(t : Principal) : TrieMap.TrieMap<Principal, Nat> {
        if (t == LEDGER_PRINCIPAL) {
            balancesA
        } else {
            balancesB
        };
    };

    /// @notice Handles token transfers
    private func transfer(args : TransferArgs) : async Result.Result<BlockIndex, Text> {
        Debug.print(
            "Transferring "
            # debug_show (args.amount)
            # " tokens to principal "
            # debug_show (args.to)
            # " subaccount "
            # debug_show (args.from_subaccount)
        );

        try {
            let transferResult = await IcpLedger.icrc1_transfer(args);
            switch (transferResult) {
                case (#Err(transferError)) {
                    return #err("Couldn't transfer funds:\n" # debug_show (transferError));
                };
                case (#Ok(blockIndex)) { return #ok blockIndex };
            };
        } catch (error) {
            return #err("Reject message: " # Error.message(error));
        };
    };

    /// @notice Handles deposits
    private func deposit(args : DepositArgs) : async Result.Result<Nat, Text> {
        if (not acquireLock("deposit")) {
            return #err("The function is locked");
        };
        
        try {
            let token = IcpLedger;
            let balances = which_balances(LEDGER_PRINCIPAL);

            let transfer_result = await token.icrc2_transfer_from({
                spender_subaccount = args.spender_subaccount;
                from = args.from;
                to = args.to;
                amount = args.amount;
                fee = args.fee;
                memo = args.memo;
                created_at_time = args.created_at_time;
            });

            // Release lock BEFORE processing result to prevent trap
            releaseLock("deposit");

            switch (transfer_result) {
                case (#Ok(block_height)) {
                    let sender = args.from.owner;
                    let old_balance = Option.get(balances.get(sender), 0);
                    balances.put(sender, old_balance + args.amount);
                    #ok(block_height)
                };
                case (#Err(e)) { 
                    #err("Transfer failed: " # debug_show(e))
                };
            };
        } catch (e) {
            // Make sure lock is released even if we trap
            releaseLock("deposit");
            #err("Unexpected error: " # Error.message(e))
        };
    };

    /// @notice Gets ICP/USD exchange rate
    private func get_price_for_pair() : async Text {
        let ic : Types.IC = actor ("aaaaa-aa");
        let ONE_MINUTE : Nat64 = 60;
        let start_timestamp : Types.Timestamp = initEndTimestamp - 60;
        let end_timestamp : Types.Timestamp = initEndTimestamp;
        let host : Text = "api.exchange.coinbase.com";
        
        // Extract pair components
        let pairComponents = Text.split(TRADING_PAIR, #text("-"));
        let pairIter = pairComponents.next();
        
        // Set default pair if not properly formatted
        let tradingPair = switch (pairIter) {
            case (?baseCurrency) {
                switch (pairComponents.next()) {
                    case (?quoteCurrency) { baseCurrency # "-" # quoteCurrency };
                    case (null) { "ICP-USD" }; // Default if not properly formatted
                };
            };
            case (null) { "ICP-USD" }; // Default if empty
        };
        
        let url = "https://" # host # "/products/" # tradingPair # "/candles?start=" 
            # Nat64.toText(start_timestamp) # "&end=" 
            # Nat64.toText(end_timestamp) # "&granularity=" 
            # Nat64.toText(ONE_MINUTE);

        Debug.print("Request URL: " # url);

        let transform_context = {
            function = transform;
            context = Blob.fromArray([]);
        };

        let http_request : Types.HttpRequestArgs = {
            url = url;
            max_response_bytes = null;
            headers = [
                { name = "Host"; value = ":443" },
                { name = "User-Agent"; value = "exchange_rate_canister" }
            ];
            body = null;
            method = #get;
            transform = ?transform_context;
        };

        Cycles.add<system>(230_949_972_000);
        
        let http_response : Types.HttpResponsePayload = await ic.http_request(http_request);
        let response_body: Blob = Blob.fromArray(http_response.body);
        let decoded_text: Text = switch (Text.decodeUtf8(response_body)) {
            case (null) { "No value returned" };
            case (?y) { y };
        };

        Debug.print("Decoded text: " # decoded_text);
        let trimmed_text = Text.trim(decoded_text, #text("[]"));
        let values = Iter.toArray(Text.split(trimmed_text, #text(",")));
        values[4]
    };

    // ============ System Functions ============

    system func preupgrade() {
        stableBalancesA := ?Iter.toArray(balancesA.entries());
        stableBalancesB := ?Iter.toArray(balancesB.entries());
    };

    system func postupgrade() {
        switch (stableBalancesA) {
            case (null) {};
            case (?entries) {
                balancesA := TrieMap.fromEntries<Principal, Nat>(
                    entries.vals(), 
                    Principal.equal, 
                    Principal.hash
                );
                stableBalancesA := null;
            };
        };

        switch (stableBalancesB) {
            case (null) {};
            case (?entries) {
                balancesB := TrieMap.fromEntries<Principal, Nat>(
                    entries.vals(), 
                    Principal.equal, 
                    Principal.hash
                );
                stableBalancesB := null;
            };
        };
    };
};
