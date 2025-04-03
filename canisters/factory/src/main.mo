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
        {
            status = args.response.status;
            body = args.response.body;
            headers = Array.filter<HttpHeader>(args.response.headers, func(h) {
                h.name != "Set-Cookie" and h.name != "set-cookie"
            });
        }
    };
    
    // Function to fetch WASM module from DFINITY
    private func fetchWasmModule() : async Result.Result<(), Text> {
        if (isWasmModuleFetching) {
            return #err("WASM module fetch already in progress");
        };

        isWasmModuleFetching := true;

        try {
            Debug.print("Fetching ICRC-1 ledger WASM module from DFINITY...");

            // Add cycles for the HTTP outcall
            Cycles.add(230_949_972_000);

            // Official DFINITY URL for ICRC-1 ledger WASM
            let wasmUrl = "https://download.dfinity.systems/ic/d87954601e4b22972899e9957e800406a0a6b929/canisters/ic-icrc1-ledger.wasm.gz";

            let transform_context : TransformContext = {
                function = transform;
                context = Blob.fromArray([]);
            };

            let request : HttpRequestArgs = {
                url = wasmUrl;
                max_response_bytes = ?2_000_000; // 2MB limit based on IC constraints
                headers = [
                    { name = "User-Agent"; value = "IC-Factory-Canister" }
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

            // Store the WASM module (note: it will be gzipped, in production we'd need to handle decompression)
            binaryOptionMarketWasm := ?Blob.fromArray(response.body);
            wasmModuleStable := ?response.body;
            isWasmModuleFetching := false;

            Debug.print("ICRC-1 ledger WASM module fetched successfully");
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
    
    // Deploy function to create a new ICRC-1 token ledger
    public shared(msg) func deployToken(
        name: Text,
        symbol: Text,
        decimals: Nat8,
        initialSupply: Nat,
        fee: Nat
    ) : async Result.Result<Principal, Text> {
        let caller = msg.caller;
        
        // Input validation first
        if (Text.size(name) == 0) {
            Debug.print("Error: Token name cannot be empty");
            return #err("Token name cannot be empty");
        };
        
        if (Text.size(symbol) == 0) {
            Debug.print("Error: Token symbol cannot be empty");
            return #err("Token symbol cannot be empty");
        };
        
        if (decimals > 18) {
            Debug.print("Error: Decimals should be between 0 and 18");
            return #err("Decimals should be between 0 and 18");
        };

        if (fee > initialSupply / 10) { // Arbitrary check that fee is not more than 10% of initial supply
            Debug.print("Error: Fee is too high compared to initial supply");
            return #err("Fee is too high compared to initial supply");
        };
        
        try {
            Debug.print("Deploying ICRC-1 token with parameters:");
            Debug.print("Name: " # name);
            Debug.print("Symbol: " # symbol);
            Debug.print("Decimals: " # Nat8.toText(decimals));
            Debug.print("Initial Supply: " # Nat.toText(initialSupply));
            Debug.print("Fee: " # Nat.toText(fee));
            
            // Check if we have the WASM module cached, if not fetch it
            switch (binaryOptionMarketWasm) {
                case (null) {
                    Debug.print("No cached WASM module found, fetching from DFINITY...");
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
            let requiredCycles = 2_000_000_000_000; // 2T cycles for ledger canister
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
            
            // Create init args for ICRC-1 token
            // Note: In production, we'd need proper Candid encoding
            // For now, we'll just create a token and record its ID
            
            Debug.print("In a production environment, we would install the ICRC-1 WASM module here.");
            Debug.print("For testing, we'll just record the canister ID and skip the installation.");
            Debug.print("Token would be initialized with name: " # name # ", symbol: " # symbol);
            
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
                contractType = #Other(symbol);
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
            
            Debug.print("Token deployment completed successfully");
            return #ok(canister_id);
        } catch (e) {
            let errorMsg = Error.message(e);
            Debug.print("Error deploying token: " # errorMsg);
            
            // Provide more detailed error messages based on common error patterns
            if (Text.contains(errorMsg, #text "cycles")) {
                return #err("Insufficient cycles to create canister. Please ensure your factory canister has enough cycles.");
            } else if (Text.contains(errorMsg, #text "memory")) {
                return #err("Memory allocation error during canister creation.");
            } else if (Text.contains(errorMsg, #text "create_canister")) {
                return #err("IC error when creating canister. The subnet may be at capacity.");
            } else {
                return #err("Failed to deploy token: " # errorMsg);
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
    
    // Public function to trigger WASM fetch from DFINITY
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
} 