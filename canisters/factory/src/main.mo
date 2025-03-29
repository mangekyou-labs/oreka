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
        
        // Input validation first
        if (Text.size(name) == 0) {
            Debug.print("Error: Market name cannot be empty");
            return #err("Market name cannot be empty");
        };
        
        if (strikePrice <= 0.0) {
            Debug.print("Error: Strike price must be positive");
            return #err("Strike price must be positive");
        };
        
        if (maturityTime <= 0) {
            Debug.print("Error: Maturity time must be in the future");
            return #err("Maturity time must be in the future");
        };
        
        if (feePercentage > 100) {
            Debug.print("Error: Fee percentage must be between 0 and 100");
            return #err("Fee percentage must be between 0 and 100");
        };
        
        if (Text.size(tradingPair) == 0) {
            Debug.print("Error: Trading pair cannot be empty");
            return #err("Trading pair cannot be empty");
        };
        
        try {
            Debug.print("Deploying market with parameters:");
            Debug.print("Name: " # name);
            Debug.print("Strike Price: " # Float.toText(strikePrice));
            Debug.print("Maturity Time: " # Int.toText(maturityTime));
            Debug.print("Fee Percentage: " # Nat.toText(feePercentage));
            Debug.print("Trading Pair: " # tradingPair);
            
            // Calculate end timestamp
            let currentTime = Time.now();
            Debug.print("Current time: " # Int.toText(currentTime));
            
            // Calculate safe time conversion to avoid overflow/underflow
            var endTimestampInt = currentTime + maturityTime * 1_000_000_000; // Convert seconds to nanoseconds
            Debug.print("End timestamp (nanoseconds): " # Int.toText(endTimestampInt));
            
            let endTimestamp = Nat64.fromNat(Int.abs(endTimestampInt) / 1_000_000_000); // Convert to seconds
            Debug.print("End timestamp (seconds): " # Nat64.toText(endTimestamp));
            
            // Add cycles for new canister creation
            let requiredCycles = 1_000_000_000_000; // 1T cycles
            Debug.print("Adding " # Nat.toText(requiredCycles) # " cycles for canister creation");
            Cycles.add(requiredCycles);
            
            // Create new canister with default settings
            Debug.print("Creating new canister...");
            let canisterCreationResult = await ic.create_canister();
            let canister_id = canisterCreationResult.canister_id;
            Debug.print("Created new canister with ID: " # Principal.toText(canister_id));
            
            // Set controllers
            Debug.print("Setting controllers for canister...");
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
            Debug.print("Controllers set successfully");
            
            // Add to owner's contracts
            var contracts = switch (ownerContracts.get(caller)) {
                case null {
                    Debug.print("Creating new contract buffer for owner");
                    let newBuffer = Buffer.Buffer<ContractAddress>(0);
                    ownerContracts.put(caller, newBuffer);
                    newBuffer;
                };
                case (?existing) { 
                    Debug.print("Using existing contract buffer for owner");
                    existing 
                };
            };
            
            Debug.print("Adding canister to owner's contracts");
            contracts.add(canister_id);
            
            // Add to all contracts
            let contractDetails: Contract = {
                canisterId = canister_id;
                owner = caller;
                createdAt = Nat64.fromNat(Int.abs(Time.now() / 1_000_000_000));
                name = name;
                contractType = #BinaryOptionMarket;
            };
            
            Debug.print("Adding contract to global contracts list");
            allContracts.add(contractDetails);
            
            // Create event
            let event: DeployEvent = {
                owner = caller;
                contractAddress = canister_id;
                index = contracts.size() - 1;
                timestamp = contractDetails.createdAt;
            };
            
            Debug.print("Recording deployment event");
            deployEvents.add(event);
            
            Debug.print("Market deployment completed successfully");
            return #ok(canister_id);
        } catch (e) {
            let errorMsg = Error.message(e);
            Debug.print("Error deploying market: " # errorMsg);
            
            // Provide more detailed error messages based on common error patterns
            if (Text.contains(errorMsg, #text "cycles")) {
                return #err("Insufficient cycles to create canister. Please ensure your factory canister has enough cycles.");
            } else if (Text.contains(errorMsg, #text "memory")) {
                return #err("Memory allocation error during canister creation.");
            } else if (Text.contains(errorMsg, #text "create_canister")) {
                return #err("IC error when creating canister. The subnet may be at capacity.");
            } else {
                return #err("Failed to deploy market: " # errorMsg);
            }
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