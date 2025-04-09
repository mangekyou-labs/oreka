import Principal "mo:base/Principal";
import BinaryOptionMarket "canister:binary_option_market";
import IcpLedger "canister:icp_ledger_canister";
import Error "mo:base/Error";
import Debug "mo:base/Debug";

actor {
    public func test_bid() : async Text {
        let marketId = "bd3sg-teaaa-aaaaa-qaaba-cai";
        let amount : Nat = 100_000_000; // 1 ICP in e8s
        
        // First approve the market canister to spend tokens
        let approveArgs = {
            spender = {
                owner = Principal.fromText(marketId);
                subaccount = null;
            };
            amount = amount;
            fee = null;
            memo = null;
            from_subaccount = null;
            created_at_time = null;
            expected_allowance = null;  // Don't specify expected allowance
            expires_at = null;
        };

        try {
            Debug.print("Approving market canister to spend tokens...");
            let approveResult = await IcpLedger.icrc2_approve(approveArgs);
            
            switch (approveResult) {
                case (#Ok(blockIndex)) {
                    Debug.print("Approval successful. Block index: " # debug_show(blockIndex));
                    // Now place the bid
                    let side = #Long;
                    let result = await BinaryOptionMarket.bid(side, amount);
                    
                    switch (result) {
                        case (#ok(msg)) { msg };
                        case (#err(msg)) { "Bid Error: " # msg };
                    };
                };
                case (#Err(error)) {
                    "Approve Error: " # debug_show(error)
                };
            };
        } catch (e) {
            "Unexpected error: " # Error.message(e)
        };
    };
} 