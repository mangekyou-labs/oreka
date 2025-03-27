import Principal "mo:base/Principal";
import Array "mo:base/Array";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Buffer "mo:base/Buffer";
import Time "mo:base/Time";
import Debug "mo:base/Debug";
import Nat64 "mo:base/Nat64";
import Nat "mo:base/Nat";
import Float "mo:base/Float";
import Error "mo:base/Error";
import Result "mo:base/Result";
import Int "mo:base/Int";
import Cycles "mo:base/ExperimentalCycles";
import IC "./ic.types";
import Text "mo:base/Text";
import Blob "mo:base/Blob";

actor Factory {
    // Type aliases
    type ContractAddress = Principal;
    type Owner = Principal;
    type Timestamp = Nat64;
    
    // Contract details
    type Contract = {
        canisterId: Principal;
        owner: Principal;
        createdAt: Timestamp;
        name: Text;
        contractType: ContractType;
    };
    
    type ContractType = {
        #BinaryOptionMarket;
        #Other: Text;
    };
    
    // Event for logging deployments
    public type DeployEvent = {
        owner: Principal;
        contractAddress: Principal;
        index: Nat;
        timestamp: Timestamp;
    };
    
    // Store all contracts
    private var allContracts = Buffer.Buffer<Contract>(0);
    
    // Store contracts per owner
    private var ownerContracts = HashMap.HashMap<Owner, Buffer.Buffer<ContractAddress>>(
        0, Principal.equal, Principal.hash
    );
    
    // Event log
    private var deployEvents = Buffer.Buffer<DeployEvent>(0);
    
    // IC Management Canister
    private let ic : IC.Self = actor "aaaaa-aa";
    
    // Deploy function to create and register a new binary option market
    public shared(msg) func deployMarket(
        name: Text,
        strikePrice: Float,
        maturityTime: Int,
        feePercentage: Nat,
        tradingPair: Text
    ) : async Result.Result<Principal, Text> {
        let caller = msg.caller;
        
        try {
            Debug.print("Deploying market with parameters:");
            Debug.print("Name: " # name);
            Debug.print("Strike Price: " # Float.toText(strikePrice));
            Debug.print("Maturity Time: " # Int.toText(maturityTime));
            Debug.print("Fee Percentage: " # Nat.toText(feePercentage));
            Debug.print("Trading Pair: " # tradingPair);
            
            // Calculate end timestamp
            let currentTime = Time.now();
            let endTimestamp = Nat64.fromNat(Int.abs(currentTime + maturityTime) / 1_000_000);
            
            // Add cycles for new canister creation
            Cycles.add(1_000_000_000_000);
            
            // Create new canister with default settings
            let {canister_id} = await ic.create_canister();
            
            // Set controllers
            let controllers: ?[Principal] = ?[caller, Principal.fromActor(Factory)];
            
            await ic.update_settings({
                canister_id = canister_id;
                settings = {
                    controllers = controllers;
                    freezing_threshold = null;
                    memory_allocation = null;
                    compute_allocation = null;
                }
            });
            
            Debug.print("Created new canister with ID: " # Principal.toText(canister_id));
            Debug.print("Parameters to be used for manual wasm installation:");
            Debug.print("Strike Price: " # Float.toText(strikePrice));
            Debug.print("End Timestamp: " # Nat64.toText(endTimestamp));
            Debug.print("Trading Pair: " # tradingPair);
            Debug.print("Fee Percentage: " # Nat.toText(feePercentage));
            
            // Add to owner's contracts
            var contracts = switch (ownerContracts.get(caller)) {
                case null {
                    let newBuffer = Buffer.Buffer<ContractAddress>(0);
                    ownerContracts.put(caller, newBuffer);
                    newBuffer;
                };
                case (?existing) { existing };
            };
            
            contracts.add(canister_id);
            
            // Add to all contracts
            let contractDetails: Contract = {
                canisterId = canister_id;
                owner = caller;
                createdAt = Nat64.fromNat(Int.abs(Time.now() / 1_000_000));
                name = name;
                contractType = #BinaryOptionMarket;
            };
            
            allContracts.add(contractDetails);
            
            // Create event
            let event: DeployEvent = {
                owner = caller;
                contractAddress = canister_id;
                index = contracts.size() - 1;
                timestamp = contractDetails.createdAt;
            };
            
            deployEvents.add(event);
            
            #ok(canister_id)
        } catch (e) {
            Debug.print("Error deploying market: " # Error.message(e));
            #err("Failed to deploy market: " # Error.message(e))
        }
    };
    
    // Get all contracts for an owner
    public query func getContractsByOwner(owner: Owner) : async [ContractAddress] {
        switch (ownerContracts.get(owner)) {
            case null { [] };
            case (?contracts) { Buffer.toArray(contracts) };
        }
    };
    
    // Get all contracts in the factory
    public query func getAllContracts() : async [Contract] {
        Buffer.toArray(allContracts)
    };
    
    // Get recent deploy events (last 50)
    public query func getRecentEvents() : async [DeployEvent] {
        let size = deployEvents.size();
        let startIndex = if (size > 50) { size - 50 } else { 0 };
        let result = Buffer.Buffer<DeployEvent>(50);
        
        var i = startIndex;
        while (i < size) {
            result.add(deployEvents.get(i));
            i += 1;
        };
        
        Buffer.toArray(result)
    };
    
    // For canister management
    public shared(msg) func clearAllData() : async Result.Result<(), Text> {
        if (Principal.notEqual(msg.caller, Principal.fromActor(Factory))) {
            return #err("Unauthorized: only factory canister can clear data");
        };
        
        allContracts := Buffer.Buffer<Contract>(0);
        ownerContracts := HashMap.HashMap<Owner, Buffer.Buffer<ContractAddress>>(
            0, Principal.equal, Principal.hash
        );
        deployEvents := Buffer.Buffer<DeployEvent>(0);
        
        #ok(())
    };
} 