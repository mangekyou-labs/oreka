export const idlFactory = ({ IDL }) => {
  const Side = IDL.Variant({ 'Short': IDL.Null, 'Long': IDL.Null });
  const Result = IDL.Variant({ 'ok': IDL.Text, 'err': IDL.Text });
  const Phase = IDL.Variant({
    'Maturity': IDL.Null,
    'Trading': IDL.Null,
    'Bidding': IDL.Null,
    'Expiry': IDL.Null,
  });
  const OracleDetails = IDL.Record({
    'finalPrice': IDL.Float64,
    'strikePrice': IDL.Float64,
  });
  const Position = IDL.Record({ 'long': IDL.Nat, 'short': IDL.Nat });
  const HttpHeader = IDL.Record({ 'value': IDL.Text, 'name': IDL.Text });
  const HttpResponsePayload = IDL.Record({
    'status': IDL.Nat,
    'body': IDL.Vec(IDL.Nat8),
    'headers': IDL.Vec(HttpHeader),
  });
  const TransformArgs = IDL.Record({
    'context': IDL.Vec(IDL.Nat8),
    'response': HttpResponsePayload,
  });
  const CanisterHttpResponsePayload = IDL.Record({
    'status': IDL.Nat,
    'body': IDL.Vec(IDL.Nat8),
    'headers': IDL.Vec(HttpHeader),
  });
  const PositionPoint = IDL.Record({
    'timestamp': IDL.Int,
    'longAmount': IDL.Nat,
    'shortAmount': IDL.Nat,
  });
  const BinaryOptionMarket = IDL.Service({
    'bid': IDL.Func([Side, IDL.Nat], [Result], []),
    'changeStrikePrice': IDL.Func([IDL.Float64], [], []),
    'check_license_status': IDL.Func([], [IDL.Bool], ['query']),
    'claimReward': IDL.Func([], [], []),
    'expireMarket': IDL.Func([], [], []),
    'forceUnlock': IDL.Func([], [], []),
    'getBalances': IDL.Func(
      [IDL.Principal],
      [IDL.Record({ 'tokenA': IDL.Nat, 'tokenB': IDL.Nat })],
      ['query'],
    ),
    'getBidders': IDL.Func(
      [],
      [
        IDL.Record({
          'long': IDL.Vec(IDL.Tuple(IDL.Principal, IDL.Nat)),
          'short': IDL.Vec(IDL.Tuple(IDL.Principal, IDL.Nat)),
        }),
      ],
      ['query'],
    ),
    'getContractBalance': IDL.Func([], [IDL.Nat], []),
    'getCurrentPhase': IDL.Func([], [Phase], ['query']),
    'getCyclesBalance': IDL.Func([], [IDL.Nat], ['query']),
    'getEndTimestamp': IDL.Func([], [IDL.Nat64], ['query']),
    'getFeePercentage': IDL.Func([], [IDL.Nat], ['query']),
    'getMarketDetails': IDL.Func(
      [],
      [
        IDL.Record({
          'resolved': IDL.Bool,
          'oracleDetails': OracleDetails,
          'positions': Position,
        }),
      ],
      ['query'],
    ),
    'getPositionHistory': IDL.Func(
      [],
      [IDL.Vec(PositionPoint)],
      ['query'],
    ),
    'getTotalDeposit': IDL.Func([], [IDL.Nat], []),
    'getTradingPair': IDL.Func([], [IDL.Text], ['query']),
    'getUserPosition': IDL.Func(
      [IDL.Principal],
      [IDL.Record({ 'long': IDL.Nat, 'short': IDL.Nat })],
      ['query'],
    ),
    'hasUserClaimed': IDL.Func([IDL.Principal], [IDL.Bool], ['query']),
    'isLocked': IDL.Func(
      [],
      [IDL.Record({ 'claim': IDL.Bool, 'deposit': IDL.Bool })],
      ['query'],
    ),
    'resolveMarket': IDL.Func([], [], []),
    'startTrading': IDL.Func([], [], []),
    'textToFloat': IDL.Func([IDL.Text], [IDL.Float64], []),
    'transform': IDL.Func(
      [TransformArgs],
      [CanisterHttpResponsePayload],
      ['query'],
    ),
    'withdraw': IDL.Func([], [], []),
  });
  return BinaryOptionMarket;
};
export const init = ({ IDL }) => { return [IDL.Float64, IDL.Nat64]; };
