import Principal "mo:base/Principal";

module {
    public type canister_id = Principal;
    public type canister_settings = {
        controllers : ?[Principal];
        freezing_threshold : ?Nat;
        memory_allocation : ?Nat;
        compute_allocation : ?Nat;
    };
    
    public type definite_canister_settings = {
        controllers : [Principal];
        freezing_threshold : Nat;
        memory_allocation : Nat;
        compute_allocation : Nat;
    };
    
    public type wasm_module = Blob;
    
    public type Self = actor {
        create_canister : shared () -> async { canister_id : canister_id };
        update_settings : shared { 
            canister_id : canister_id; 
            settings : canister_settings 
        } -> async ();
        install_code : shared {
            arg : Blob;
            wasm_module : wasm_module;
            mode : { #reinstall; #upgrade; #install };
            canister_id : canister_id;
        } -> async ();
    };
}; 