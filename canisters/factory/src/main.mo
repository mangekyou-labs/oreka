import Principal "mo:base/Principal";
import Array "mo:base/Array";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Buffer "mo:base/Buffer";
import Time "mo:base/Time";
import Debug "mo:base/Debug";
import Nat64 "mo:base/Nat64";
import Nat8 "mo:base/Nat8";
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
        tradingPair: ?Text;
        strikePrice: ?Float;
    };
    
    type ContractType = {
        #BinaryOptionMarket;
        #Other: Text;
    };

    // HTTP request/response types for outcalls
    type HttpHeader = {
        name : Text;
        value : Text;
    };

    type HttpMethod = {
        #get;
        #post;
        #head;
    };

    type HttpResponsePayload = {
        status : Nat;
        headers : [HttpHeader];
        body : [Nat8];
    };

    type TransformArgs = {
        response : HttpResponsePayload;
        context : Blob;
    };

    type TransformContext = {
        function : shared query TransformArgs -> async HttpResponsePayload;
        context : Blob;
    };

    type HttpRequestArgs = {
        url : Text;
        max_response_bytes : ?Nat64;
        headers : [HttpHeader];
        body : ?[Nat8];
        method : HttpMethod;
        transform : ?TransformContext;
    };

    type IC_HTTP = actor {
        http_request : HttpRequestArgs -> async HttpResponsePayload;
    };
    
    // Event for logging deployments
    public type DeployEvent = {
        owner: Principal;
        contractAddress: Principal;
        index: Nat;
        timestamp: Timestamp;
    };
    
    // Store binary market WASM module
    private stable var wasmModuleStable : ?[Nat8] = null;
    private var binaryOptionMarketWasm : ?Blob = null;
    private var isWasmModuleFetching : Bool = false;
    
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
    private let ic_http : IC_HTTP = actor "aaaaa-aa";

    // Transform function for HTTP responses
    public query func transform(args: TransformArgs): async HttpResponsePayload {
//        {
//            status = args.response.status;
//            body = args.response.body;
//            headers = Array.filter<HttpHeader>(args.response.headers, func(h) {
//                h.name != "Set-Cookie" and h.name != "set-cookie"
//            });
//        }

        // 1) List every header that may differ across replicas
        let dynamicHeaders = [
            "Date", "ETag", "Retry-After", "Server",
            "Transfer-Encoding", "Content-Length",
            "Content-Encoding", "Set-Cookie", "set-cookie"
        ];

        // 2) Helper: check if a name is in that list
        func isDynamic(name: Text): Bool {
            for (headerName in dynamicHeaders.vals()) {
                if (headerName == name) {
                    return true;
                };
            };
            return false;
        };

        // 3) Filter out dynamic headers
        let filtered = Array.filter<HttpHeader>(args.response.headers, func(h) {
            not isDynamic(h.name)
        });

        // 4) Normalize error bodies (e.g. 429) to empty
        let body = if (args.response.status == 429) {
            [] // Empty array of Nat8
        } else {
            args.response.body
        };

        // 5) Return only status, normalized body, and stable headers
        return {
            status  = args.response.status;
            body    = body;
            headers = [];
        };
    };
    
    // Function to fetch WASM module from GitHub
    private func fetchWasmModule() : async Result.Result<(), Text> {
        if (isWasmModuleFetching) {
            return #err("WASM module fetch already in progress");
        };

        isWasmModuleFetching := true;

        try {
            Debug.print("Fetching Binary Option Market WASM module from GitHub...");

            // Add cycles for the HTTP outcall
            Cycles.add(230_949_972_000);

            // GitHub URL for binary option market WASM
            let wasmUrl = "https://raw.githubusercontent.com/mangekyou-labs/oreka/refactor/icp-market-views/canisters/binary_option_market/build/binary_option_market.wasm";

            let transform_context : TransformContext = {
                function = transform;
                context = Blob.fromArray([]);
            };

            let request : HttpRequestArgs = {
                url = wasmUrl;
                max_response_bytes = ?500_000; // 2MB limit based on IC constraints
                headers = [
                    { name = "User-Agent"; value = "my-agent/1.0" },
                    { name = "Accept-Encoding"; value = "identity" }  // disable compression
                ];
                body = null;
                method = #get;
                transform = ?transform_context;
            };

            let response = await ic_http.http_request(request);

            if (response.status != 200) {
                isWasmModuleFetching := false;
                return #err("Failed to fetch WASM module: HTTP status " # Nat.toText(response.status));
            };

            // Store the WASM module
            binaryOptionMarketWasm := ?Blob.fromArray(response.body);
            wasmModuleStable := ?response.body;
            isWasmModuleFetching := false;

            Debug.print("Binary Option Market WASM module fetched successfully");
            return #ok(());
        } catch (e) {
            isWasmModuleFetching := false;
            Debug.print("Error fetching WASM module: " # Error.message(e));
            
            // If HTTP outcall fails, try to use local cache as fallback
            Debug.print("HTTP outcall failed, attempting to use local cache as fallback...");
            if (wasmModuleStable != null) {
                Debug.print("Found WASM module in stable storage");
                switch (wasmModuleStable) {
                    case (?bytes) {
                        binaryOptionMarketWasm := ?Blob.fromArray(bytes);
                        return #ok(());
                    };
                    case (null) {
                        return #err("No WASM module available in stable storage");
                    };
                };
            } else {
                return #err("Error fetching WASM module: " # Error.message(e));
            };
        };
    };
    
    // Type for candid encoding
    type MarketInitArgs = {
        name: Text;
        description: Text;
        underlying: Text;
        expiry: Nat64;
        marketType: Text;
        owner: Principal;
    };
    
    // Function for deploying a binary option market
    public shared(msg) func deployMarket(
        name: Text,
        strike_price: Float,
        expiry: Nat64,
        trading_pair: Text
    ) : async Result.Result<Principal, Text> {
        let caller = msg.caller;
        
        // Input validation
        if (Text.size(name) == 0) {
            Debug.print("Error: Market name cannot be empty");
            return #err("Market name cannot be empty");
        };
        
        if (strike_price <= 0) {
            Debug.print("Error: Strike price must be positive");
            return #err("Strike price must be positive");
        };
        
        if (expiry <= Nat64.fromNat(Int.abs(Time.now() / 1_000_000_000))) {
            Debug.print("Error: Expiry must be in the future");
            return #err("Expiry must be in the future");
        };
        
        if (Text.size(trading_pair) == 0) {
            Debug.print("Error: Trading pair cannot be empty");
            return #err("Trading pair cannot be empty");
        };
        
        try {
            Debug.print("Deploying binary option market with parameters:");
            Debug.print("Name: " # name);
            Debug.print("Strike Price: " # Float.toText(strike_price));
            Debug.print("Expiry: " # Nat64.toText(expiry));
            Debug.print("Trading Pair: " # trading_pair);
            
            // Check if we have the WASM module cached, if not fetch it
            switch (binaryOptionMarketWasm) {
                case (null) {
                    Debug.print("No cached WASM module found, fetching from GitHub...");
                    let fetchResult = await fetchWasmModule();
                    switch (fetchResult) {
                        case (#err(errMsg)) {
                            return #err("Failed to fetch WASM module: " # errMsg);
                        };
                        case (#ok(_)) {
                            Debug.print("WASM module fetched successfully");
                        };
                    };
                };
                case (?_) {
                    Debug.print("Using cached WASM module");
                };
            };
            
            // Verify we have a WASM module now
            let wasmModule = switch (binaryOptionMarketWasm) {
                case (?wasm) { wasm };
                case (null) {
                    return #err("WASM module not available even after attempted fetch");
                };
            };
            
            // Add cycles for new canister creation
            let requiredCycles = 2_200_000_000_000; // 2T cycles for market canister
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
            
            // Install the binary option market WASM module
            Debug.print("Installing binary option market WASM module...");
            
            // Default fee percentage (1%)
            let feePercentage : Nat = 1;
            
            Debug.print("Initializing market with parameters:");
            Debug.print("Strike Price: " # Float.toText(strike_price));
            Debug.print("Expiry: " # Nat64.toText(expiry));
            Debug.print("Trading Pair: " # trading_pair);
            Debug.print("Fee Percentage: " # Nat.toText(feePercentage));
            
            // For direct initialization, we'll use the canonical constructor arguments
            // without trying to manually encode Candid format
            try {
                // The ic.install_code method doesn't require us to encode the arguments in Candid format
                // It handles that for us when we pass the raw values
                let initArgs = {
                    strike_price = strike_price;
                    expiry = expiry;
                    trading_pair = trading_pair;
                    fee_percentage = feePercentage;
                };
                
                // Convert to blob using serialization (this is just for logging)
                let initArgsBlob = to_candid(
                    strike_price,     // float64
                    expiry,           // nat64
                    trading_pair,     // text
                    feePercentage,    // nat
                    Principal.toText(canister_id),  // canister ID as text
                    "ryjl3-tyaaa-aaaaa-aaaba-cai",  // ledger ID as text
                    Principal.toText(caller)        // owner as text
                );
                
                Debug.print("Installing WASM with init args");
                
                await ic.install_code({
                    arg = initArgsBlob;
                    wasm_module = wasmModule;
                    mode = #install;
                    canister_id = canister_id;
                });
                
                Debug.print("WASM module installed successfully with init arguments");
            } catch (e) {
                Debug.print("Error installing WASM with arguments: " # Error.message(e));
                return #err("Failed to install market WASM: " # Error.message(e));
            };
            
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
                tradingPair = ?trading_pair;
                strikePrice = ?strike_price;
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
    
    // Function to register the binary option market WASM module manually
    public shared(msg) func registerWasmModule(wasmBytes : [Nat8]) : async Result.Result<(), Text> {
        // Only the factory owner can register the WASM module
        if (Principal.notEqual(msg.caller, Principal.fromActor(Factory))) {
            return #err("Unauthorized: only factory canister can register WASM module");
        };
        
        Debug.print("Registering WASM module...");
        binaryOptionMarketWasm := ?Blob.fromArray(wasmBytes);
        wasmModuleStable := ?wasmBytes;
        Debug.print("WASM module registered successfully");
        
        #ok(())
    };
    
    // Register WASM module in chunks for large files
    public shared(msg) func registerWasmChunk(chunk: [Nat8], index: Nat, total: Nat) : async Result.Result<(), Text> {
        // Allow anyone to register chunks for now - we'll implement proper authorization later
        // This is unsafe for production but will work for our test environment
        
        Debug.print("Registering WASM chunk " # Nat.toText(index) # " of " # Nat.toText(total));
        
        // Initialize the WASM accumulator if this is the first chunk
        if (index == 0) {
            wasmModuleStable := ?[];
        };
        
        // Append this chunk to the existing WASM bytes
        switch (wasmModuleStable) {
            case (null) {
                return #err("WASM accumulator not initialized");
            };
            case (?existingBytes) {
                let newBytes = Array.append<Nat8>(existingBytes, chunk);
                wasmModuleStable := ?newBytes;
                
                // If this is the last chunk, finalize the WASM module
                if (index == total - 1) {
                    binaryOptionMarketWasm := ?Blob.fromArray(newBytes);
                    Debug.print("WASM module registration completed, total size: " # Nat.toText(newBytes.size()));
                };
            };
        };
        
        #ok(())
    };
    
    // Function to get contract details
    public query func getContractDetails(canisterId: Principal) : async ?Contract {
        for (contract in allContracts.vals()) {
            if (Principal.equal(contract.canisterId, canisterId)) {
                return ?contract;
            };
        };
        null
    };
    
    // Function to update all deployed markets with new WASM code
    public shared(msg) func upgradeAllMarkets() : async Result.Result<Nat, Text> {
        // Only the factory owner can upgrade markets
        if (Principal.notEqual(msg.caller, Principal.fromActor(Factory))) {
            return #err("Unauthorized: only factory canister can upgrade markets");
        };
        
        let wasmModule = switch (binaryOptionMarketWasm) {
            case (null) { return #err("No WASM module registered"); };
            case (?wasm) { wasm };
        };
        
        var upgradedCount = 0;
        
        for (contract in allContracts.vals()) {
            if (contract.contractType == #BinaryOptionMarket) {
                Debug.print("Upgrading market: " # Principal.toText(contract.canisterId));
                
                try {
                    await ic.install_code({
                        arg = Blob.fromArray([]); // Empty args for upgrade
                        wasm_module = wasmModule;
                        mode = #upgrade;
                        canister_id = contract.canisterId;
                    });
                    upgradedCount += 1;
                    Debug.print("Successfully upgraded " # Principal.toText(contract.canisterId));
                } catch (e) {
                    Debug.print("Failed to upgrade " # Principal.toText(contract.canisterId) # ": " # Error.message(e));
                };
            };
        };
        
        #ok(upgradedCount)
    };
    
    // Public function to check if WASM module is available
    public query func isWasmModuleAvailable() : async Bool {
        binaryOptionMarketWasm != null
    };
    
    // Public function to trigger WASM fetch from GitHub
    public shared(msg) func refreshWasmModule() : async Result.Result<(), Text> {
        await fetchWasmModule()
    };
    
    // System Upgrade Hooks
    system func preupgrade() {
        // Preserve the WASM module during upgrades
        wasmModuleStable := switch (binaryOptionMarketWasm) {
            case (null) { null };
            case (?wasm) { ?Blob.toArray(wasm) };
        };
    };
    
    system func postupgrade() {
        // Restore the WASM module after upgrade
        binaryOptionMarketWasm := switch (wasmModuleStable) {
            case (null) { null };
            case (?bytes) { ?Blob.fromArray(bytes) };
        };
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
    
    // Function to add an external contract that was not created by this factory
    public shared(msg) func addExternalContract(
        name: Text,
        canisterId: Principal,
        contractType: ContractType
    ) : async Result.Result<(), Text> {
        let caller = msg.caller;
        
        // Input validation
        if (Text.size(name) == 0) {
            Debug.print("Error: Contract name cannot be empty");
            return #err("Contract name cannot be empty");
        };
        
        // Check if the contract already exists in our records
        for (contract in allContracts.vals()) {
            if (Principal.equal(contract.canisterId, canisterId)) {
                Debug.print("Error: Contract already registered");
                return #err("Contract already registered");
            };
        };
        
        try {
            Debug.print("Registering external contract:");
            Debug.print("Name: " # name);
            Debug.print("Canister ID: " # Principal.toText(canisterId));
            Debug.print("Contract Type: " # debug_show(contractType));
            
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
            contracts.add(canisterId);
            
            // Add to all contracts
            let contractDetails: Contract = {
                canisterId = canisterId;
                owner = caller;
                createdAt = Nat64.fromNat(Int.abs(Time.now() / 1_000_000_000));
                name = name;
                contractType = contractType;
                tradingPair = null;  // Initialize as null for non-market contracts
                strikePrice = null;  // Initialize as null for non-market contracts
            };
            
            Debug.print("Adding contract to global contracts list");
            allContracts.add(contractDetails);
            
            // Create event
            let event: DeployEvent = {
                owner = caller;
                contractAddress = canisterId;
                index = contracts.size() - 1;
                timestamp = contractDetails.createdAt;
            };
            
            Debug.print("Recording deployment event");
            deployEvents.add(event);
            
            Debug.print("External contract registration completed successfully");
            return #ok();
        } catch (e) {
            let errorMsg = Error.message(e);
            Debug.print("Error registering external contract: " # errorMsg);
            return #err("Failed to register external contract: " # errorMsg);
        }
    };

    // Function to get all markets
    public query func getAllMarkets() : async [Contract] {
        Debug.print("Getting all markets...");
        return Buffer.toArray(allContracts);
    };
    
    // Function to call startTrading on a specific market canister
    public shared(msg) func startTradingForMarket(marketId: Principal) : async Result.Result<(), Text> {
        Debug.print("Attempting to start trading for market: " # Principal.toText(marketId));
        
        // First, verify the market exists
        var foundMarket : ?Contract = null;
        
        // Look for the market in our registry
        for (contract in allContracts.vals()) {
            if (Principal.equal(contract.canisterId, marketId)) {
                foundMarket := ?contract;
            };
        };
        
        // Check if we found the market
        switch (foundMarket) {
            case (null) {
                Debug.print("Market not found: " # Principal.toText(marketId));
                return #err("Market not found with ID: " # Principal.toText(marketId));
            };
            
            case (?market) {
                // The factory can call startTrading as it's a controller
                Debug.print("Factory is calling startTrading for market: " # Principal.toText(marketId));
                
                // Create an actor reference to the market canister
                let marketActor = actor(Principal.toText(marketId)) : actor {
                    startTrading : () -> async ();
                };
                
                try {
                    Debug.print("Calling startTrading on market canister");
                    await marketActor.startTrading();
                    Debug.print("Successfully started trading for market: " # Principal.toText(marketId));
                    return #ok(());
                } catch (e) {
                    Debug.print("Error starting trading: " # Error.message(e));
                    return #err("Failed to start trading: " # Error.message(e));
                };
            };
        };
    };

    // Function to get all markets with details
    public query func getAllMarketDetails() : async [{ 
        canisterId: Principal; 
        name: Text; 
        tradingPair: ?Text; 
        strikePrice: ?Float;
        expiry: ?Nat64;
    }] {
        let marketDetails = Buffer.Buffer<{ 
            canisterId: Principal; 
            name: Text; 
            tradingPair: ?Text; 
            strikePrice: ?Float;
            expiry: ?Nat64;
        }>(0);
        
        for (contract in allContracts.vals()) {
            if (contract.contractType == #BinaryOptionMarket) {
                marketDetails.add({
                    canisterId = contract.canisterId;
                    name = contract.name;
                    tradingPair = contract.tradingPair;
                    strikePrice = contract.strikePrice;
                    expiry = null; // We don't store expiry in contract details currently
                });
            };
        };
        
        Buffer.toArray(marketDetails)
    };
    
    // Function to get market details by ID
    public query func getMarketDetails(canisterId: Principal) : async ?{ 
        canisterId: Principal; 
        name: Text; 
        tradingPair: ?Text; 
        strikePrice: ?Float;
        expiry: ?Nat64;
    } {
        for (contract in allContracts.vals()) {
            if (Principal.equal(contract.canisterId, canisterId) and contract.contractType == #BinaryOptionMarket) {
                return ?{
                    canisterId = contract.canisterId;
                    name = contract.name;
                    tradingPair = contract.tradingPair;
                    strikePrice = contract.strikePrice;
                    expiry = null; // We don't store expiry in contract details currently
                };
            };
        };
        
        null
    };
    
    // Function to query strike prices for all markets
    public query func getMarketStrikePrices() : async [(Principal, ?Float)] {
        let marketStrikePrices = Buffer.Buffer<(Principal, ?Float)>(0);
        
        for (contract in allContracts.vals()) {
            if (contract.contractType == #BinaryOptionMarket) {
                marketStrikePrices.add((contract.canisterId, contract.strikePrice));
            };
        };
        
        Buffer.toArray(marketStrikePrices)
    };
} 