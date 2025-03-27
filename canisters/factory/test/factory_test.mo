import Debug "mo:base/Debug";
import Principal "mo:base/Principal";
import Array "mo:base/Array";
import Result "mo:base/Result";

actor {
    let factory = actor "rrkah-fqaaa-aaaaa-aaaaq-cai" : actor {
        deploy : (Principal, Text, { #BinaryOptionMarket; #Other: Text }) -> async Result.Result<Nat, Text>;
        getContractsByOwner : (Principal) -> async [Principal];
        getContractDetails : (Principal) -> async ?{
            canisterId: Principal;
            owner: Principal;
            createdAt: Nat64;
            name: Text;
            contractType: { #BinaryOptionMarket; #Other: Text };
        };
        getAllContracts : () -> async [{
            canisterId: Principal;
            owner: Principal;
            createdAt: Nat64;
            name: Text;
            contractType: { #BinaryOptionMarket; #Other: Text };
        }];
        getRecentEvents : () -> async [{
            owner: Principal;
            contractAddress: Principal;
            index: Nat;
            timestamp: Nat64;
        }];
    };

    public func run() : async () {
        Debug.print("Running Factory tests...");

        // Test contract deployment
        let testContract = Principal.fromText("aaaaa-aa");
        let testOwner = Principal.selfOrCaller();

        let deployResult = await factory.deploy(
            testContract, 
            "Test BinaryOptionMarket", 
            #BinaryOptionMarket
        );
        
        // Check deploy result
        switch (deployResult) {
            case (#ok(index)) {
                Debug.print("Contract deployed successfully with index: " # Nat.toText(index));
            };
            case (#err(e)) {
                Debug.print("Error deploying contract: " # e);
                assert(false); // Fail the test
            };
        };

        // Test getting contracts by owner
        let contracts = await factory.getContractsByOwner(testOwner);
        assert(contracts.size() == 1);
        assert(Principal.equal(contracts[0], testContract));
        
        // Test getting contract details
        let contractDetails = await factory.getContractDetails(testContract);
        switch (contractDetails) {
            case (null) {
                Debug.print("Error: Contract details not found");
                assert(false); // Fail the test
            };
            case (?details) {
                assert(Principal.equal(details.canisterId, testContract));
                assert(Principal.equal(details.owner, testOwner));
                assert(details.name == "Test BinaryOptionMarket");
                switch (details.contractType) {
                    case (#BinaryOptionMarket) { /* Expected */ };
                    case (_) {
                        Debug.print("Error: Unexpected contract type");
                        assert(false); // Fail the test
                    };
                };
            };
        };
        
        // Test getting all contracts
        let allContracts = await factory.getAllContracts();
        assert(allContracts.size() == 1);
        
        // Test getting recent events
        let events = await factory.getRecentEvents();
        assert(events.size() == 1);
        assert(Principal.equal(events[0].contractAddress, testContract));

        Debug.print("All tests passed!");
    };
} 