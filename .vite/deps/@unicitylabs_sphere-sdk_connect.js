import {
  __publicField
} from "./chunk-JVWSFFO4.js";

// node_modules/@unicitylabs/sphere-sdk/dist/connect/index.js
var LOGGER_KEY = "__sphere_sdk_logger__";
function getState() {
  const g = globalThis;
  if (!g[LOGGER_KEY]) {
    g[LOGGER_KEY] = { debug: false, tags: {}, handler: null };
  }
  return g[LOGGER_KEY];
}
function isEnabled(tag) {
  const state = getState();
  if (tag in state.tags) return state.tags[tag];
  return state.debug;
}
var logger = {
  /**
   * Configure the logger. Can be called multiple times (last write wins).
   * Typically called by createBrowserProviders(), createNodeProviders(), or Sphere.init().
   */
  configure(config) {
    const state = getState();
    if (config.debug !== void 0) state.debug = config.debug;
    if (config.handler !== void 0) state.handler = config.handler;
  },
  /**
   * Enable/disable debug logging for a specific tag.
   * Per-tag setting overrides the global debug flag.
   *
   * @example
   * ```ts
   * logger.setTagDebug('Nostr', true);  // enable only Nostr logs
   * logger.setTagDebug('Nostr', false); // disable Nostr logs even if global debug=true
   * ```
   */
  setTagDebug(tag, enabled) {
    getState().tags[tag] = enabled;
  },
  /**
   * Clear per-tag override, falling back to global debug flag.
   */
  clearTagDebug(tag) {
    delete getState().tags[tag];
  },
  /** Returns true if debug mode is enabled for the given tag (or globally). */
  isDebugEnabled(tag) {
    if (tag) return isEnabled(tag);
    return getState().debug;
  },
  /**
   * Debug-level log. Only shown when debug is enabled (globally or for this tag).
   * Use for detailed operational information.
   */
  debug(tag, message, ...args) {
    if (!isEnabled(tag)) return;
    const state = getState();
    if (state.handler) {
      state.handler("debug", tag, message, ...args);
    } else {
      console.log(`[${tag}]`, message, ...args);
    }
  },
  /**
   * Warning-level log. ALWAYS shown regardless of debug flag.
   * Use for important but non-critical issues (timeouts, retries, degraded state).
   */
  warn(tag, message, ...args) {
    const state = getState();
    if (state.handler) {
      state.handler("warn", tag, message, ...args);
    } else {
      console.warn(`[${tag}]`, message, ...args);
    }
  },
  /**
   * Error-level log. ALWAYS shown regardless of debug flag.
   * Use for critical failures that should never be silenced.
   */
  error(tag, message, ...args) {
    const state = getState();
    if (state.handler) {
      state.handler("error", tag, message, ...args);
    } else {
      console.error(`[${tag}]`, message, ...args);
    }
  },
  /** Reset all logger state (debug flag, tags, handler). Primarily for tests. */
  reset() {
    const g = globalThis;
    delete g[LOGGER_KEY];
  }
};
var SphereError = class extends Error {
  constructor(message, code, cause) {
    super(message);
    __publicField(this, "code");
    __publicField(this, "cause");
    this.name = "SphereError";
    this.code = code;
    this.cause = cause;
  }
};
function majorOf(v) {
  return parseInt(String(v).split(".")[0], 10);
}
function compareSemver(a, b) {
  const parse = (v) => {
    const [core, pre] = String(v).split("-", 2);
    const nums = core.split(".").map((n) => parseInt(n, 10) || 0);
    return { nums, pre };
  };
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i++) {
    const d = (pa.nums[i] ?? 0) - (pb.nums[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  if (pa.pre === void 0 && pb.pre === void 0) return 0;
  if (pa.pre === void 0) return 1;
  if (pb.pre === void 0) return -1;
  const sa = pa.pre.split(".");
  const sb = pb.pre.split(".");
  for (let i = 0; i < Math.max(sa.length, sb.length); i++) {
    const x = sa[i];
    const y = sb[i];
    if (x === void 0) return -1;
    if (y === void 0) return 1;
    const nx = Number(x);
    const ny = Number(y);
    if (!Number.isNaN(nx) && !Number.isNaN(ny)) {
      if (nx !== ny) return nx < ny ? -1 : 1;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return 0;
}
var STORAGE_KEYS_GLOBAL = {
  /** Encrypted BIP39 mnemonic */
  MNEMONIC: "mnemonic",
  /** Encrypted master private key */
  MASTER_KEY: "master_key",
  /** BIP32 chain code */
  CHAIN_CODE: "chain_code",
  /** HD derivation path (full path like m/44'/0'/0'/0/0) */
  DERIVATION_PATH: "derivation_path",
  /** Base derivation path (like m/44'/0'/0' without chain/index) */
  BASE_PATH: "base_path",
  /** Derivation mode: bip32, wif_hmac, legacy_hmac */
  DERIVATION_MODE: "derivation_mode",
  /** Wallet source: mnemonic, file, unknown */
  WALLET_SOURCE: "wallet_source",
  /** Wallet existence flag */
  WALLET_EXISTS: "wallet_exists",
  /** Current active address index */
  CURRENT_ADDRESS_INDEX: "current_address_index",
  /** Nametag cache per address (separate from tracked addresses registry) */
  ADDRESS_NAMETAGS: "address_nametags",
  /** Active addresses registry (JSON: TrackedAddressesStorage) */
  TRACKED_ADDRESSES: "tracked_addresses",
  /** Last processed Nostr wallet event timestamp (unix seconds), keyed per pubkey */
  LAST_WALLET_EVENT_TS: "last_wallet_event_ts",
  /** Last processed Nostr DM (gift-wrap) event timestamp (unix seconds), keyed per pubkey */
  LAST_DM_EVENT_TS: "last_dm_event_ts",
  /** Group chat: last used relay URL (stale data detection) — global, same relay for all addresses */
  GROUP_CHAT_RELAY_URL: "group_chat_relay_url",
  /** Cached token registry JSON (fetched from remote) */
  TOKEN_REGISTRY_CACHE: "token_registry_cache",
  /** Timestamp of last token registry cache update (ms since epoch) */
  TOKEN_REGISTRY_CACHE_TS: "token_registry_cache_ts",
  /** Cached price data JSON (from CoinGecko or other provider) */
  PRICE_CACHE: "price_cache",
  /** Timestamp of last price cache update (ms since epoch) */
  PRICE_CACHE_TS: "price_cache_ts"
};
var STORAGE_KEYS_ADDRESS = {
  /** Pending transfers for this address */
  PENDING_TRANSFERS: "pending_transfers",
  /** Transfer outbox for this address */
  OUTBOX: "outbox",
  /** Conversations for this address */
  CONVERSATIONS: "conversations",
  /** Messages for this address */
  MESSAGES: "messages",
  /** Transaction history for this address */
  TRANSACTION_HISTORY: "transaction_history",
  /** Pending V5 finalization tokens (unconfirmed instant split tokens) */
  PENDING_V5_TOKENS: "pending_v5_tokens",
  /**
   * FINISHED v2 token blobs awaiting transport delivery. Written the moment a
   * transfer/split output is certified on-chain (the source is already spent),
   * removed after successful delivery — survives transport failures + crashes
   * so the recipient's token is never lost with the process.
   */
  PENDING_V2_DELIVERIES: "pending_v2_deliveries",
  /** Group chat: joined groups for this address */
  GROUP_CHAT_GROUPS: "group_chat_groups",
  /** Group chat: messages for this address */
  GROUP_CHAT_MESSAGES: "group_chat_messages",
  /** Group chat: members for this address */
  GROUP_CHAT_MEMBERS: "group_chat_members",
  /** Group chat: processed event IDs for deduplication */
  GROUP_CHAT_PROCESSED_EVENTS: "group_chat_processed_events",
  /** Processed V5 split group IDs for Nostr re-delivery dedup */
  PROCESSED_SPLIT_GROUP_IDS: "processed_split_group_ids",
  /** Processed V6 combined transfer IDs for Nostr re-delivery dedup */
  PROCESSED_COMBINED_TRANSFER_IDS: "processed_combined_transfer_ids",
  // Invoice / Accounting storage keys
  /** Set of cancelled invoice IDs (JSON string array) */
  CANCELLED_INVOICES: "cancelled_invoices",
  /** Set of closed invoice IDs (JSON string array) */
  CLOSED_INVOICES: "closed_invoices",
  /** Frozen balances for terminated invoices (JSON map: invoiceId → FrozenInvoiceBalances) */
  FROZEN_BALANCES: "frozen_balances",
  /** Auto-return settings (JSON: AutoReturnSettings) */
  AUTO_RETURN: "auto_return",
  /** Auto-return dedup ledger (JSON: AutoReturnLedger) */
  AUTO_RETURN_LEDGER: "auto_return_ledger",
  /** Invoice-transfer index metadata (JSON: Record<invoiceId, { terminated, frozenAt? }>) */
  INV_LEDGER_INDEX: "inv_ledger_index",
  /** Token scan state watermarks (JSON: Record<tokenId, txCount>) */
  TOKEN_SCAN_STATE: "token_scan_state",
  // Swap storage keys
  /** Per-swap key: swap:{swapId} */
  SWAP_RECORD_PREFIX: "swap:",
  /** Lightweight index array for listing */
  SWAP_INDEX: "swap_index"
};
var NETWORK_SCOPED_ADDRESS_KEYS = [
  STORAGE_KEYS_ADDRESS.PENDING_TRANSFERS,
  STORAGE_KEYS_ADDRESS.OUTBOX,
  STORAGE_KEYS_ADDRESS.TRANSACTION_HISTORY,
  STORAGE_KEYS_ADDRESS.PENDING_V5_TOKENS,
  STORAGE_KEYS_ADDRESS.PENDING_V2_DELIVERIES,
  STORAGE_KEYS_ADDRESS.PROCESSED_SPLIT_GROUP_IDS,
  STORAGE_KEYS_ADDRESS.PROCESSED_COMBINED_TRANSFER_IDS,
  STORAGE_KEYS_ADDRESS.CANCELLED_INVOICES,
  STORAGE_KEYS_ADDRESS.CLOSED_INVOICES,
  STORAGE_KEYS_ADDRESS.FROZEN_BALANCES,
  STORAGE_KEYS_ADDRESS.AUTO_RETURN,
  STORAGE_KEYS_ADDRESS.AUTO_RETURN_LEDGER,
  STORAGE_KEYS_ADDRESS.INV_LEDGER_INDEX,
  STORAGE_KEYS_ADDRESS.TOKEN_SCAN_STATE,
  STORAGE_KEYS_ADDRESS.SWAP_INDEX
];
var NETWORK_SCOPED_ADDRESS_PREFIXES = [
  STORAGE_KEYS_ADDRESS.SWAP_RECORD_PREFIX,
  // 'swap:'
  "inv_ledger:"
  // AccountingModule INV_LEDGER_PREFIX
];
var STORAGE_KEYS = {
  ...STORAGE_KEYS_GLOBAL,
  ...STORAGE_KEYS_ADDRESS
};
var DEFAULT_NOSTR_RELAYS = [
  "wss://relay.unicity.network",
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.nostr.band"
];
var DEFAULT_AGGREGATOR_URL = "https://aggregator.unicity.network/rpc";
var DEV_AGGREGATOR_URL = "https://dev-aggregator.dyndns.org/rpc";
var DEFAULT_IPFS_GATEWAYS = [
  "https://unicity-ipfs1.dyndns.org"
];
var DEFAULT_BASE_PATH = "m/44'/0'/0'";
var DEFAULT_DERIVATION_PATH = `${DEFAULT_BASE_PATH}/0/0`;
var TOKEN_REGISTRY_URL = "https://raw.githubusercontent.com/unicitynetwork/unicity-ids/refs/heads/main/unicity-ids.testnet.json";
var TEST_NOSTR_RELAYS = [
  "wss://nostr-relay.testnet.unicity.network"
];
var DEFAULT_GROUP_RELAYS = [
  "wss://sphere-relay.unicity.network"
];
var NETWORKS = {
  mainnet: {
    name: "Mainnet",
    aggregatorUrl: DEFAULT_AGGREGATOR_URL,
    nostrRelays: DEFAULT_NOSTR_RELAYS,
    ipfsGateways: DEFAULT_IPFS_GATEWAYS,
    groupRelays: DEFAULT_GROUP_RELAYS,
    tokenRegistryUrl: TOKEN_REGISTRY_URL
  },
  // v1 cutover: 'testnet' now POINTS AT TESTNET2 (the v2 gateway network). The
  // old goggregator testnet spoke the removed v1 protocol — a v2 engine cannot
  // run against it. 'testnet2' stays as an alias of the same configuration.
  testnet: {
    name: "Testnet2",
    networkId: 4,
    // v2 state-transition gateway (networkId 4 comes from the trust base). apiKey is env-injected.
    aggregatorUrl: "https://gateway.testnet2.unicity.network",
    nostrRelays: TEST_NOSTR_RELAYS,
    // reuse testnet infra (shared relays/ipfs)
    ipfsGateways: DEFAULT_IPFS_GATEWAYS,
    groupRelays: DEFAULT_GROUP_RELAYS,
    tokenRegistryUrl: "https://raw.githubusercontent.com/unicitynetwork/unicity-ids/refs/heads/main/unicity-ids.testnet2.json"
  },
  testnet2: {
    name: "Testnet2",
    networkId: 4,
    // v2 state-transition gateway (networkId 4 comes from the trust base). apiKey is env-injected.
    aggregatorUrl: "https://gateway.testnet2.unicity.network",
    nostrRelays: TEST_NOSTR_RELAYS,
    // reuse testnet infra (shared relays/ipfs)
    ipfsGateways: DEFAULT_IPFS_GATEWAYS,
    groupRelays: DEFAULT_GROUP_RELAYS,
    tokenRegistryUrl: "https://raw.githubusercontent.com/unicitynetwork/unicity-ids/refs/heads/main/unicity-ids.testnet2.json"
  },
  // NOTE: mainnet/dev still point at v1-era aggregators. The v2 engine cannot
  // operate against them until their gateways are cut over to the v2 protocol —
  // wallet operations on these networks fail loudly (AGGREGATOR_ERROR) until then.
  dev: {
    name: "Development",
    aggregatorUrl: DEV_AGGREGATOR_URL,
    nostrRelays: TEST_NOSTR_RELAYS,
    ipfsGateways: DEFAULT_IPFS_GATEWAYS,
    groupRelays: DEFAULT_GROUP_RELAYS,
    tokenRegistryUrl: TOKEN_REGISTRY_URL
  }
};
var SPHERE_NETWORKS = {
  testnet2: { id: NETWORKS.testnet2.networkId, name: "testnet2" }
};
var HOST_READY_TYPE = "sphere-connect:host-ready";
var HOST_READY_TIMEOUT = 3e4;
var SPHERE_CONNECT_NAMESPACE = "sphere-connect";
var SPHERE_CONNECT_VERSION = "2.0";
var RPC_METHODS = {
  GET_IDENTITY: "sphere_getIdentity",
  GET_BALANCE: "sphere_getBalance",
  GET_ASSETS: "sphere_getAssets",
  GET_FIAT_BALANCE: "sphere_getFiatBalance",
  GET_TOKENS: "sphere_getTokens",
  GET_HISTORY: "sphere_getHistory",
  RESOLVE: "sphere_resolve",
  SUBSCRIBE: "sphere_subscribe",
  UNSUBSCRIBE: "sphere_unsubscribe",
  DISCONNECT: "sphere_disconnect",
  GET_CONVERSATIONS: "sphere_getConversations",
  GET_MESSAGES: "sphere_getMessages",
  GET_DM_UNREAD_COUNT: "sphere_getDMUnreadCount",
  MARK_AS_READ: "sphere_markAsRead",
  GET_INVOICES: "sphere_getInvoices",
  GET_INVOICE_STATUS: "sphere_getInvoiceStatus"
};
var INTENT_ACTIONS = {
  SEND: "send",
  DM: "dm",
  PAYMENT_REQUEST: "payment_request",
  RECEIVE: "receive",
  SIGN_MESSAGE: "sign_message",
  CREATE_INVOICE: "create_invoice",
  CLOSE_INVOICE: "close_invoice",
  CANCEL_INVOICE: "cancel_invoice",
  PAY_INVOICE: "pay_invoice",
  RETURN_INVOICE_PAYMENT: "return_invoice_payment",
  IMPORT_INVOICE: "import_invoice",
  SEND_INVOICE_RECEIPTS: "send_invoice_receipts",
  SEND_CANCELLATION_NOTICES: "send_cancellation_notices",
  SET_AUTO_RETURN: "set_auto_return",
  MINT: "mint"
};
var ERROR_CODES = {
  // Standard JSON-RPC
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // Sphere Connect (4xxx)
  NOT_CONNECTED: 4001,
  PERMISSION_DENIED: 4002,
  USER_REJECTED: 4003,
  SESSION_EXPIRED: 4004,
  ORIGIN_BLOCKED: 4005,
  RATE_LIMITED: 4006,
  UNSUPPORTED_PROTOCOL_VERSION: 4007,
  // Connect MAJOR mismatch (incompatible era)
  INCOMPATIBLE_NETWORK: 4008,
  // dApp targets a different network than the wallet
  INSUFFICIENT_BALANCE: 4100,
  INVALID_RECIPIENT: 4101,
  TRANSFER_FAILED: 4102,
  INTENT_CANCELLED: 4200
};
var WALLET_EVENTS = {
  /** Wallet locked or user logged out. dApp shows locked state and waits for unlock.
   *  Pushed automatically by ConnectHost — no sphere_subscribe needed. */
  LOCKED: "wallet:locked",
  /** Active wallet address changed. dApp should update displayed identity.
   *  Pushed automatically by ConnectHost — no sphere_subscribe needed. */
  IDENTITY_CHANGED: "identity:changed"
};
function isSphereConnectMessage(msg) {
  if (!msg || typeof msg !== "object") return false;
  const m = msg;
  if (m.ns !== SPHERE_CONNECT_NAMESPACE) return false;
  if (m.type === "handshake") return true;
  if (typeof m.v !== "string") return false;
  return majorOf(m.v) === majorOf(SPHERE_CONNECT_VERSION);
}
function createRequestId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
function fail(code, reason, message, extra) {
  return { ok: false, error: { code, message, data: { reason, ...extra } } };
}
function checkCompatibility(input) {
  const { clientProtocol, walletProtocol, minMinor, clientSdkVersion, minSdkVersion } = input;
  if (majorOf(clientProtocol) !== majorOf(walletProtocol)) {
    return fail(
      ERROR_CODES.UNSUPPORTED_PROTOCOL_VERSION,
      "protocol_incompatible",
      "Incompatible Connect protocol version",
      { walletProtocol, clientProtocol }
    );
  }
  const walletMajor = majorOf(walletProtocol);
  if (minMinor !== void 0 && compareSemver(clientProtocol, `${walletMajor}.${minMinor}`) < 0) {
    return fail(
      ERROR_CODES.UNSUPPORTED_PROTOCOL_VERSION,
      "protocol_incompatible",
      "Connect protocol below the required minimum",
      { walletProtocol, clientProtocol }
    );
  }
  if (minSdkVersion !== void 0 && (!clientSdkVersion || compareSemver(clientSdkVersion, minSdkVersion) < 0)) {
    return fail(
      ERROR_CODES.UNSUPPORTED_PROTOCOL_VERSION,
      "protocol_incompatible",
      "SDK version below the required minimum",
      { walletProtocol, clientProtocol, requiredSdk: minSdkVersion, actualSdk: clientSdkVersion ?? null }
    );
  }
  if (!input.clientNetwork || input.clientNetwork.id !== input.walletNetworkId) {
    return fail(
      ERROR_CODES.INCOMPATIBLE_NETWORK,
      "network_incompatible",
      "dApp targets a different network than the wallet",
      { walletNetwork: { id: input.walletNetworkId }, clientNetwork: input.clientNetwork ?? null }
    );
  }
  return { ok: true };
}
var SDK_VERSION = "0.10.7";
var PERMISSION_SCOPES = {
  IDENTITY_READ: "identity:read",
  BALANCE_READ: "balance:read",
  TOKENS_READ: "tokens:read",
  HISTORY_READ: "history:read",
  EVENTS_SUBSCRIBE: "events:subscribe",
  RESOLVE_PEER: "resolve:peer",
  TRANSFER_REQUEST: "transfer:request",
  DM_REQUEST: "dm:request",
  DM_READ: "dm:read",
  DM_MANAGE: "dm:manage",
  PAYMENT_REQUEST: "payment:request",
  SIGN_REQUEST: "sign:request",
  MINT_REQUEST: "mint:request",
  INVOICE_READ: "invoice:read",
  INVOICE_WRITE: "invoice:write"
};
var ALL_PERMISSIONS = Object.values(PERMISSION_SCOPES);
var DEFAULT_PERMISSIONS = [
  PERMISSION_SCOPES.IDENTITY_READ
];
var METHOD_PERMISSIONS = {
  [RPC_METHODS.GET_IDENTITY]: PERMISSION_SCOPES.IDENTITY_READ,
  [RPC_METHODS.GET_BALANCE]: PERMISSION_SCOPES.BALANCE_READ,
  [RPC_METHODS.GET_ASSETS]: PERMISSION_SCOPES.BALANCE_READ,
  [RPC_METHODS.GET_FIAT_BALANCE]: PERMISSION_SCOPES.BALANCE_READ,
  [RPC_METHODS.GET_TOKENS]: PERMISSION_SCOPES.TOKENS_READ,
  [RPC_METHODS.GET_HISTORY]: PERMISSION_SCOPES.HISTORY_READ,
  [RPC_METHODS.RESOLVE]: PERMISSION_SCOPES.RESOLVE_PEER,
  [RPC_METHODS.SUBSCRIBE]: PERMISSION_SCOPES.EVENTS_SUBSCRIBE,
  [RPC_METHODS.UNSUBSCRIBE]: PERMISSION_SCOPES.EVENTS_SUBSCRIBE,
  [RPC_METHODS.GET_CONVERSATIONS]: PERMISSION_SCOPES.DM_READ,
  [RPC_METHODS.GET_MESSAGES]: PERMISSION_SCOPES.DM_READ,
  [RPC_METHODS.GET_DM_UNREAD_COUNT]: PERMISSION_SCOPES.DM_READ,
  [RPC_METHODS.MARK_AS_READ]: PERMISSION_SCOPES.DM_MANAGE,
  [RPC_METHODS.GET_INVOICES]: PERMISSION_SCOPES.INVOICE_READ,
  [RPC_METHODS.GET_INVOICE_STATUS]: PERMISSION_SCOPES.INVOICE_READ
};
var INTENT_PERMISSIONS = {
  [INTENT_ACTIONS.SEND]: PERMISSION_SCOPES.TRANSFER_REQUEST,
  [INTENT_ACTIONS.DM]: PERMISSION_SCOPES.DM_REQUEST,
  [INTENT_ACTIONS.PAYMENT_REQUEST]: PERMISSION_SCOPES.PAYMENT_REQUEST,
  [INTENT_ACTIONS.RECEIVE]: PERMISSION_SCOPES.IDENTITY_READ,
  [INTENT_ACTIONS.SIGN_MESSAGE]: PERMISSION_SCOPES.SIGN_REQUEST,
  [INTENT_ACTIONS.CREATE_INVOICE]: PERMISSION_SCOPES.INVOICE_WRITE,
  [INTENT_ACTIONS.CLOSE_INVOICE]: PERMISSION_SCOPES.INVOICE_WRITE,
  [INTENT_ACTIONS.CANCEL_INVOICE]: PERMISSION_SCOPES.INVOICE_WRITE,
  [INTENT_ACTIONS.PAY_INVOICE]: PERMISSION_SCOPES.TRANSFER_REQUEST,
  [INTENT_ACTIONS.RETURN_INVOICE_PAYMENT]: PERMISSION_SCOPES.TRANSFER_REQUEST,
  [INTENT_ACTIONS.IMPORT_INVOICE]: PERMISSION_SCOPES.INVOICE_WRITE,
  [INTENT_ACTIONS.SEND_INVOICE_RECEIPTS]: PERMISSION_SCOPES.INVOICE_WRITE,
  [INTENT_ACTIONS.SEND_CANCELLATION_NOTICES]: PERMISSION_SCOPES.INVOICE_WRITE,
  [INTENT_ACTIONS.SET_AUTO_RETURN]: PERMISSION_SCOPES.INVOICE_WRITE,
  [INTENT_ACTIONS.MINT]: PERMISSION_SCOPES.MINT_REQUEST
};
function hasMethodPermission(granted, method) {
  const required = METHOD_PERMISSIONS[method];
  if (!required) return false;
  return granted.has(required);
}
function hasIntentPermission(granted, action) {
  const required = INTENT_PERMISSIONS[action];
  if (!required) return false;
  return granted.has(required);
}
function validatePermissions(permissions) {
  const validScopes = new Set(ALL_PERMISSIONS);
  return permissions.every((p) => validScopes.has(p));
}
var DEFAULT_SESSION_TTL_MS = 864e5;
var DEFAULT_MAX_RPS = 20;
var ConnectHost = class {
  constructor(config) {
    __publicField(this, "sphere");
    __publicField(this, "transport");
    __publicField(this, "config");
    __publicField(this, "session", null);
    __publicField(this, "grantedPermissions", /* @__PURE__ */ new Set());
    // Event subscription management
    __publicField(this, "eventSubscriptions", /* @__PURE__ */ new Map());
    // eventName → unsub
    // Intent auto-approve: action → handler that bypasses wallet UI
    __publicField(this, "autoApprovedIntents", /* @__PURE__ */ new Map());
    // Rate limiting
    __publicField(this, "rateLimitCounter", 0);
    __publicField(this, "rateLimitResetAt", 0);
    __publicField(this, "unsubscribeTransport", null);
    this.sphere = config.sphere;
    this.transport = config.transport;
    this.config = config;
    this.unsubscribeTransport = this.transport.onMessage(this.handleMessage.bind(this));
  }
  /** Get current active session */
  getSession() {
    return this.session;
  }
  /** Register an auto-approve handler for an intent action (session-scoped). */
  setIntentAutoApprove(action, handler) {
    this.autoApprovedIntents.set(action, handler);
  }
  /** Remove auto-approve for an intent action. */
  clearIntentAutoApprove(action) {
    this.autoApprovedIntents.delete(action);
  }
  /**
   * Update the Sphere instance (e.g. user switched address — new Sphere created).
   * Re-subscribes auto-push events and notifies connected dApp of the new identity.
   */
  updateSphere(newSphere) {
    var _a;
    this.sphere = newSphere;
    const existing = this.eventSubscriptions.get(WALLET_EVENTS.IDENTITY_CHANGED);
    if (existing) {
      existing();
      this.eventSubscriptions.delete(WALLET_EVENTS.IDENTITY_CHANGED);
    }
    if ((_a = this.session) == null ? void 0 : _a.active) {
      this.autoSubscribeIdentityChanged();
      const identity = this.getPublicIdentity();
      if (identity) {
        this.pushClientEvent(WALLET_EVENTS.IDENTITY_CHANGED, identity);
      }
    }
  }
  /** Revoke the current session */
  revokeSession() {
    if (this.session) {
      this.session.active = false;
      this.cleanupEventSubscriptions();
      this.autoApprovedIntents.clear();
      this.session = null;
      this.grantedPermissions.clear();
    }
  }
  /**
   * Notify connected dApp that wallet is locked/logged out, then revoke session.
   * Call this BEFORE destroy() when the wallet locks so the dApp gets a clean signal
   * instead of receiving NOT_CONNECTED errors on the next request.
   */
  notifyWalletLocked() {
    var _a;
    if ((_a = this.session) == null ? void 0 : _a.active) {
      this.pushClientEvent(WALLET_EVENTS.LOCKED, {});
    }
    this.revokeSession();
  }
  /** Destroy the host, clean up all resources */
  destroy() {
    this.revokeSession();
    if (this.unsubscribeTransport) {
      this.unsubscribeTransport();
      this.unsubscribeTransport = null;
    }
  }
  // ===========================================================================
  // Message Handling
  // ===========================================================================
  async handleMessage(msg) {
    try {
      if (msg.type === "handshake" && msg.direction === "request") {
        await this.handleHandshake(msg);
        return;
      }
      if (msg.type === "request") {
        await this.handleRpcRequest(msg);
        return;
      }
      if (msg.type === "intent") {
        await this.handleIntentRequest(msg);
        return;
      }
    } catch (error) {
      logger.warn("ConnectHost", "Error handling message:", error);
    }
  }
  // ===========================================================================
  // Handshake
  // ===========================================================================
  async handleHandshake(msg) {
    var _a, _b, _c, _d;
    const dapp = msg.dapp;
    if (!dapp) {
      this.sendHandshakeResponse([], void 0, void 0);
      return;
    }
    const result = checkCompatibility({
      clientProtocol: msg.v,
      walletProtocol: SPHERE_CONNECT_VERSION,
      clientNetwork: msg.network,
      walletNetworkId: this.sphere.networkId ?? -1,
      minMinor: this.config.minMinorVersion,
      clientSdkVersion: msg.sdkVersion,
      minSdkVersion: this.config.minSdkVersion
    });
    if (!result.ok) {
      logger.warn("ConnectHost", "Rejected handshake", {
        dapp: dapp.name,
        reason: (_a = result.error.data) == null ? void 0 : _a.reason,
        clientProtocol: msg.v,
        walletProtocol: SPHERE_CONNECT_VERSION,
        clientNetwork: msg.network ?? null,
        walletNetwork: this.sphere.networkId ?? null
      });
      (_c = (_b = this.config).onConnectionRejected) == null ? void 0 : _c.call(_b, dapp, result.error, !!msg.silent);
      this.sendHandshakeResponse([], void 0, void 0, result.error, msg.v);
      return;
    }
    const clientInfo = { protocolVersion: msg.v, network: msg.network, sdkVersion: msg.sdkVersion };
    if (msg.sessionId && ((_d = this.session) == null ? void 0 : _d.active) && this.session.id === msg.sessionId) {
      const identity2 = this.getPublicIdentity();
      this.sendHandshakeResponse([...this.grantedPermissions], this.session.id, identity2);
      return;
    }
    const requestedPermissions = msg.permissions;
    const { approved, grantedPermissions } = await this.config.onConnectionRequest(
      dapp,
      requestedPermissions,
      msg.silent,
      clientInfo
    );
    if (!approved) {
      this.sendHandshakeResponse([], void 0, void 0);
      return;
    }
    const sessionId = createRequestId();
    const allPermissions = [.../* @__PURE__ */ new Set([...DEFAULT_PERMISSIONS, ...grantedPermissions])];
    const ttl = this.config.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
    this.session = {
      id: sessionId,
      dapp,
      permissions: allPermissions,
      createdAt: Date.now(),
      expiresAt: ttl > 0 ? Date.now() + ttl : 0,
      active: true
    };
    this.grantedPermissions = new Set(allPermissions);
    this.autoSubscribeIdentityChanged();
    const identity = this.getPublicIdentity();
    this.sendHandshakeResponse(allPermissions, sessionId, identity);
  }
  // `warning` is a forward-compatible deprecation-notice slot (see SphereHandshake.warning);
  // no call site emits one yet — reserved for the deprecation-window policy.
  sendHandshakeResponse(permissions, sessionId, identity, error, echoV, warning) {
    const network = typeof this.sphere.networkId === "number" ? { id: this.sphere.networkId } : void 0;
    this.transport.send({
      ns: SPHERE_CONNECT_NAMESPACE,
      v: error && echoV ? echoV : SPHERE_CONNECT_VERSION,
      type: "handshake",
      direction: "response",
      permissions,
      sessionId,
      identity,
      network,
      sdkVersion: SDK_VERSION,
      error,
      warning
    });
  }
  // ===========================================================================
  // RPC Requests (query)
  // ===========================================================================
  async handleRpcRequest(msg) {
    var _a;
    if (!((_a = this.session) == null ? void 0 : _a.active)) {
      this.sendError(msg.id, ERROR_CODES.NOT_CONNECTED, "Not connected");
      return;
    }
    if (this.session.expiresAt > 0 && Date.now() > this.session.expiresAt) {
      this.revokeSession();
      this.sendError(msg.id, ERROR_CODES.SESSION_EXPIRED, "Session expired");
      return;
    }
    if (!this.checkRateLimit()) {
      this.sendError(msg.id, ERROR_CODES.RATE_LIMITED, "Too many requests");
      return;
    }
    if (msg.method === RPC_METHODS.DISCONNECT) {
      const disconnectedSession = this.session;
      this.revokeSession();
      this.sendResult(msg.id, { disconnected: true });
      if (disconnectedSession && this.config.onDisconnect) {
        Promise.resolve(this.config.onDisconnect(disconnectedSession)).catch((err) => logger.warn("Connect", "onDisconnect handler error", err));
      }
      return;
    }
    if (!hasMethodPermission(this.grantedPermissions, msg.method)) {
      this.sendError(msg.id, ERROR_CODES.PERMISSION_DENIED, `Permission denied for ${msg.method}`);
      return;
    }
    try {
      const result = await this.executeMethod(msg.method, msg.params ?? {});
      this.sendResult(msg.id, result);
    } catch (error) {
      this.sendError(msg.id, ERROR_CODES.INTERNAL_ERROR, error.message);
    }
  }
  // ===========================================================================
  // Intent Requests
  // ===========================================================================
  async handleIntentRequest(msg) {
    var _a;
    if (!((_a = this.session) == null ? void 0 : _a.active)) {
      this.sendIntentError(msg.id, ERROR_CODES.NOT_CONNECTED, "Not connected");
      return;
    }
    if (this.session.expiresAt > 0 && Date.now() > this.session.expiresAt) {
      this.revokeSession();
      this.sendIntentError(msg.id, ERROR_CODES.SESSION_EXPIRED, "Session expired");
      return;
    }
    if (!hasIntentPermission(this.grantedPermissions, msg.action)) {
      this.sendIntentError(msg.id, ERROR_CODES.PERMISSION_DENIED, `Permission denied for intent: ${msg.action}`);
      return;
    }
    const autoHandler = this.autoApprovedIntents.get(msg.action);
    if (autoHandler) {
      const autoResponse = await autoHandler(msg.action, msg.params, this.session);
      if (autoResponse.error) {
        this.sendIntentError(msg.id, autoResponse.error.code, autoResponse.error.message);
      } else {
        this.sendIntentResult(msg.id, autoResponse.result);
      }
      return;
    }
    const response = await this.config.onIntent(msg.action, msg.params, this.session);
    if (response.error) {
      this.sendIntentError(msg.id, response.error.code, response.error.message);
    } else {
      this.sendIntentResult(msg.id, response.result);
    }
  }
  // ===========================================================================
  // Method Router
  // ===========================================================================
  async executeMethod(method, params) {
    var _a, _b;
    switch (method) {
      case RPC_METHODS.GET_IDENTITY:
        return this.getPublicIdentity();
      case RPC_METHODS.GET_BALANCE:
        return this.sphere.payments.getBalance(params.coinId);
      case RPC_METHODS.GET_ASSETS:
        return this.sphere.payments.getAssets(params.coinId);
      case RPC_METHODS.GET_FIAT_BALANCE:
        return { fiatBalance: await this.sphere.payments.getFiatBalance() };
      case RPC_METHODS.GET_TOKENS:
        return this.stripTokenSdkData(
          this.sphere.payments.getTokens(
            params.coinId ? { coinId: params.coinId } : void 0
          )
        );
      case RPC_METHODS.GET_HISTORY:
        return this.sphere.payments.getHistory();
      case RPC_METHODS.RESOLVE:
        if (!params.identifier) {
          throw new SphereError("Missing required parameter: identifier", "VALIDATION_ERROR");
        }
        return this.sphere.resolve(params.identifier);
      case RPC_METHODS.SUBSCRIBE:
        return this.handleSubscribe(params.event);
      case RPC_METHODS.UNSUBSCRIBE:
        return this.handleUnsubscribe(params.event);
      case RPC_METHODS.GET_CONVERSATIONS: {
        if (!this.sphere.communications) throw new SphereError("Communications module not available", "MODULE_NOT_AVAILABLE");
        const convos = this.sphere.communications.getConversations();
        const result = [];
        const needsResolve = [];
        for (const [peer, messages] of convos) {
          if (messages.length === 0) continue;
          const last = messages[messages.length - 1];
          const peerNametag = ((_a = messages.find((m) => m.senderPubkey === peer && m.senderNametag)) == null ? void 0 : _a.senderNametag) ?? ((_b = messages.find((m) => m.recipientPubkey === peer && m.recipientNametag)) == null ? void 0 : _b.recipientNametag);
          const idx = result.length;
          result.push({
            peerPubkey: peer,
            peerNametag,
            lastMessage: last,
            unreadCount: this.sphere.communications.getUnreadCount(peer),
            messageCount: messages.length
          });
          if (!peerNametag) {
            needsResolve.push({ index: idx, peerPubkey: peer });
          }
        }
        if (needsResolve.length > 0) {
          const resolved = await Promise.all(
            needsResolve.map(
              ({ peerPubkey }) => this.sphere.communications.resolvePeerNametag(peerPubkey).catch((err) => {
                logger.debug("Connect", "Peer Unicity ID resolution failed", err);
                return void 0;
              })
            )
          );
          for (let i = 0; i < needsResolve.length; i++) {
            if (resolved[i]) {
              result[needsResolve[i].index].peerNametag = resolved[i];
            }
          }
        }
        result.sort((a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp);
        return result;
      }
      case RPC_METHODS.GET_MESSAGES: {
        if (!this.sphere.communications) throw new SphereError("Communications module not available", "MODULE_NOT_AVAILABLE");
        if (!params.peerPubkey) throw new SphereError("Missing required parameter: peerPubkey", "VALIDATION_ERROR");
        return this.sphere.communications.getConversationPage(
          params.peerPubkey,
          {
            limit: params.limit,
            before: params.before
          }
        );
      }
      case RPC_METHODS.GET_DM_UNREAD_COUNT: {
        if (!this.sphere.communications) throw new SphereError("Communications module not available", "MODULE_NOT_AVAILABLE");
        return {
          unreadCount: this.sphere.communications.getUnreadCount(
            params.peerPubkey
          )
        };
      }
      case RPC_METHODS.MARK_AS_READ: {
        if (!this.sphere.communications) throw new SphereError("Communications module not available", "MODULE_NOT_AVAILABLE");
        if (!params.messageIds || !Array.isArray(params.messageIds)) {
          throw new SphereError("Missing required parameter: messageIds (string[])", "VALIDATION_ERROR");
        }
        await this.sphere.communications.markAsRead(params.messageIds);
        return { marked: true, count: params.messageIds.length };
      }
      case RPC_METHODS.GET_INVOICES: {
        if (!this.sphere.accounting) throw new SphereError("Accounting module not available", "MODULE_NOT_AVAILABLE");
        const invoiceOpts = {};
        if (params.state !== void 0) invoiceOpts.state = params.state;
        if (params.limit !== void 0) invoiceOpts.limit = params.limit;
        if (params.offset !== void 0) invoiceOpts.offset = params.offset;
        if (params.sortBy !== void 0) invoiceOpts.sortBy = params.sortBy;
        if (params.sortOrder !== void 0) invoiceOpts.sortOrder = params.sortOrder;
        if (params.createdByMe !== void 0) invoiceOpts.createdByMe = params.createdByMe;
        if (params.targetingMe !== void 0) invoiceOpts.targetingMe = params.targetingMe;
        return this.sphere.accounting.getInvoices(invoiceOpts);
      }
      case RPC_METHODS.GET_INVOICE_STATUS: {
        if (!this.sphere.accounting) throw new SphereError("Accounting module not available", "MODULE_NOT_AVAILABLE");
        if (!params.invoiceId || typeof params.invoiceId !== "string") {
          throw new SphereError("Missing required parameter: invoiceId", "VALIDATION_ERROR");
        }
        return this.sphere.accounting.getInvoiceStatus(params.invoiceId);
      }
      default:
        throw new SphereError(`Unknown method: ${method}`, "VALIDATION_ERROR");
    }
  }
  // ===========================================================================
  // Event Subscriptions
  // ===========================================================================
  autoSubscribeIdentityChanged() {
    if (this.eventSubscriptions.has(WALLET_EVENTS.IDENTITY_CHANGED)) return;
    const unsub = this.sphere.on("identity:changed", (data) => {
      this.pushClientEvent(WALLET_EVENTS.IDENTITY_CHANGED, data);
    });
    this.eventSubscriptions.set(WALLET_EVENTS.IDENTITY_CHANGED, unsub);
  }
  handleSubscribe(eventName) {
    if (!eventName) throw new SphereError("Missing required parameter: event", "VALIDATION_ERROR");
    if (this.eventSubscriptions.has(eventName)) {
      return { subscribed: true, event: eventName };
    }
    const unsub = this.sphere.on(eventName, (data) => {
      this.transport.send({
        ns: SPHERE_CONNECT_NAMESPACE,
        v: SPHERE_CONNECT_VERSION,
        type: "event",
        event: eventName,
        data
      });
    });
    this.eventSubscriptions.set(eventName, unsub);
    return { subscribed: true, event: eventName };
  }
  handleUnsubscribe(eventName) {
    if (!eventName) throw new SphereError("Missing required parameter: event", "VALIDATION_ERROR");
    const unsub = this.eventSubscriptions.get(eventName);
    if (unsub) {
      unsub();
      this.eventSubscriptions.delete(eventName);
    }
    return { unsubscribed: true, event: eventName };
  }
  cleanupEventSubscriptions() {
    for (const [, unsub] of this.eventSubscriptions) {
      unsub();
    }
    this.eventSubscriptions.clear();
  }
  // ===========================================================================
  // Helpers
  // ===========================================================================
  /** Push an event to the dApp without requiring a sphere_subscribe call. */
  pushClientEvent(event, data) {
    this.transport.send({
      ns: SPHERE_CONNECT_NAMESPACE,
      v: SPHERE_CONNECT_VERSION,
      type: "event",
      event,
      data
    });
  }
  getPublicIdentity() {
    const id = this.sphere.identity;
    if (!id) return void 0;
    return {
      chainPubkey: id.chainPubkey,
      directAddress: id.directAddress,
      nametag: id.nametag
    };
  }
  stripTokenSdkData(tokens) {
    return tokens.map((t) => {
      const token = t;
      const { sdkData: _sdkData, ...publicFields } = token;
      return publicFields;
    });
  }
  sendResult(id, result) {
    this.transport.send({
      ns: SPHERE_CONNECT_NAMESPACE,
      v: SPHERE_CONNECT_VERSION,
      type: "response",
      id,
      result
    });
  }
  sendError(id, code, message) {
    this.transport.send({
      ns: SPHERE_CONNECT_NAMESPACE,
      v: SPHERE_CONNECT_VERSION,
      type: "response",
      id,
      error: { code, message }
    });
  }
  sendIntentResult(id, result) {
    this.transport.send({
      ns: SPHERE_CONNECT_NAMESPACE,
      v: SPHERE_CONNECT_VERSION,
      type: "intent_result",
      id,
      result
    });
  }
  sendIntentError(id, code, message) {
    this.transport.send({
      ns: SPHERE_CONNECT_NAMESPACE,
      v: SPHERE_CONNECT_VERSION,
      type: "intent_result",
      id,
      error: { code, message }
    });
  }
  checkRateLimit() {
    const maxRps = this.config.maxRequestsPerSecond ?? DEFAULT_MAX_RPS;
    const now = Date.now();
    if (now > this.rateLimitResetAt) {
      this.rateLimitCounter = 0;
      this.rateLimitResetAt = now + 1e3;
    }
    this.rateLimitCounter++;
    return this.rateLimitCounter <= maxRps;
  }
};
var ConnectError = class extends Error {
  constructor(message, code, data) {
    super(message);
    this.code = code;
    this.data = data;
    this.name = "ConnectError";
  }
};
var DEFAULT_TIMEOUT = 3e4;
var DEFAULT_INTENT_TIMEOUT = 12e4;
var ConnectClient = class {
  constructor(config) {
    __publicField(this, "transport");
    __publicField(this, "dapp");
    __publicField(this, "requestedPermissions");
    __publicField(this, "timeout");
    __publicField(this, "intentTimeout");
    __publicField(this, "resumeSessionId");
    __publicField(this, "silent");
    __publicField(this, "network");
    __publicField(this, "sessionId", null);
    __publicField(this, "grantedPermissions", []);
    __publicField(this, "identity", null);
    __publicField(this, "walletNet", null);
    __publicField(this, "connected", false);
    __publicField(this, "pendingRequests", /* @__PURE__ */ new Map());
    __publicField(this, "eventHandlers", /* @__PURE__ */ new Map());
    __publicField(this, "unsubscribeTransport", null);
    // Handshake resolver (one-shot)
    __publicField(this, "handshakeResolver", null);
    this.transport = config.transport;
    this.dapp = config.dapp;
    this.requestedPermissions = config.permissions ?? [...ALL_PERMISSIONS];
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    this.intentTimeout = config.intentTimeout ?? DEFAULT_INTENT_TIMEOUT;
    this.resumeSessionId = config.resumeSessionId ?? null;
    this.silent = config.silent ?? false;
    this.network = config.network;
  }
  // ===========================================================================
  // Connection
  // ===========================================================================
  /** Connect to the wallet. Returns session info and public identity. */
  async connect() {
    this.unsubscribeTransport = this.transport.onMessage(this.handleMessage.bind(this));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.handshakeResolver = null;
        reject(new Error("Connection timeout"));
      }, this.timeout);
      this.handshakeResolver = { resolve, reject, timer };
      this.transport.send({
        ns: SPHERE_CONNECT_NAMESPACE,
        v: SPHERE_CONNECT_VERSION,
        type: "handshake",
        direction: "request",
        permissions: this.requestedPermissions,
        dapp: this.dapp,
        sdkVersion: SDK_VERSION,
        ...this.network ? { network: this.network } : {},
        ...this.resumeSessionId ? { sessionId: this.resumeSessionId } : {},
        ...this.silent ? { silent: true } : {}
      });
    });
  }
  /** Disconnect from the wallet */
  async disconnect() {
    if (this.connected) {
      try {
        await this.query(RPC_METHODS.DISCONNECT);
      } catch {
      }
    }
    this.cleanup();
  }
  /** Whether currently connected */
  get isConnected() {
    return this.connected;
  }
  /** Granted permission scopes */
  get permissions() {
    return this.grantedPermissions;
  }
  /** Current session ID */
  get session() {
    return this.sessionId;
  }
  /** Public identity received during handshake */
  get walletIdentity() {
    return this.identity;
  }
  /** Wallet's active network, received during handshake. */
  get walletNetwork() {
    return this.walletNet;
  }
  // ===========================================================================
  // Query (read data)
  // ===========================================================================
  /** Send a query request and return the result */
  async query(method, params) {
    if (!this.connected) throw new SphereError("Not connected", "NOT_INITIALIZED");
    const id = createRequestId();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Query timeout: ${method}`));
      }, this.timeout);
      this.pendingRequests.set(id, {
        resolve,
        reject,
        timer
      });
      this.transport.send({
        ns: SPHERE_CONNECT_NAMESPACE,
        v: SPHERE_CONNECT_VERSION,
        type: "request",
        id,
        method,
        params
      });
    });
  }
  // ===========================================================================
  // Intent (trigger wallet UI)
  // ===========================================================================
  /** Send an intent request. The wallet will open its UI for user confirmation. */
  async intent(action, params) {
    if (!this.connected) throw new SphereError("Not connected", "NOT_INITIALIZED");
    const id = createRequestId();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Intent timeout: ${action}`));
      }, this.intentTimeout);
      this.pendingRequests.set(id, {
        resolve,
        reject,
        timer
      });
      this.transport.send({
        ns: SPHERE_CONNECT_NAMESPACE,
        v: SPHERE_CONNECT_VERSION,
        type: "intent",
        id,
        action,
        params
      });
    });
  }
  // ===========================================================================
  // Events
  // ===========================================================================
  /** Subscribe to a wallet event. Returns unsubscribe function. */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, /* @__PURE__ */ new Set());
      if (this.connected) {
        this.query(RPC_METHODS.SUBSCRIBE, { event }).catch((err) => logger.debug("Connect", "Event subscription failed", err));
      }
    }
    this.eventHandlers.get(event).add(handler);
    return () => {
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.eventHandlers.delete(event);
          if (this.connected) {
            this.query(RPC_METHODS.UNSUBSCRIBE, { event }).catch((err) => logger.debug("Connect", "Event unsubscription failed", err));
          }
        }
      }
    };
  }
  // ===========================================================================
  // Message Handling
  // ===========================================================================
  handleMessage(msg) {
    if (msg.type === "handshake" && msg.direction === "response") {
      this.handleHandshakeResponse(msg);
      return;
    }
    if (msg.type === "response") {
      this.handlePendingResponse(msg.id, msg.result, msg.error);
      return;
    }
    if (msg.type === "intent_result") {
      this.handlePendingResponse(msg.id, msg.result, msg.error);
      return;
    }
    if (msg.type === "event") {
      const handlers = this.eventHandlers.get(msg.event);
      if (handlers) {
        for (const handler of handlers) {
          try {
            handler(msg.data);
          } catch (err) {
            logger.debug("Connect", "Event handler error", err);
          }
        }
      }
    }
  }
  handleHandshakeResponse(msg) {
    if (!this.handshakeResolver) return;
    clearTimeout(this.handshakeResolver.timer);
    const m = msg;
    if (m.error) {
      this.handshakeResolver.reject(new ConnectError(m.error.message, m.error.code, m.error.data));
      this.handshakeResolver = null;
      return;
    }
    if (msg.sessionId && msg.identity) {
      this.sessionId = msg.sessionId;
      this.grantedPermissions = msg.permissions;
      this.identity = msg.identity;
      this.walletNet = m.network ?? null;
      this.connected = true;
      if (m.warning) logger.warn("Connect", "Wallet deprecation notice", m.warning.message);
      this.handshakeResolver.resolve({
        sessionId: msg.sessionId,
        permissions: this.grantedPermissions,
        identity: msg.identity
      });
    } else {
      this.handshakeResolver.reject(new Error("Connection rejected by wallet"));
    }
    this.handshakeResolver = null;
  }
  handlePendingResponse(id, result, error) {
    const pending = this.pendingRequests.get(id);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pendingRequests.delete(id);
    if (error) {
      pending.reject(new ConnectError(error.message, error.code, error.data));
    } else {
      pending.resolve(result);
    }
  }
  // ===========================================================================
  // Cleanup
  // ===========================================================================
  cleanup() {
    if (this.unsubscribeTransport) {
      this.unsubscribeTransport();
      this.unsubscribeTransport = null;
    }
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Disconnected"));
    }
    this.pendingRequests.clear();
    this.eventHandlers.clear();
    this.connected = false;
    this.sessionId = null;
    this.grantedPermissions = [];
    this.identity = null;
    this.walletNet = null;
  }
};
export {
  ALL_PERMISSIONS,
  ConnectClient,
  ConnectError,
  ConnectHost,
  DEFAULT_PERMISSIONS,
  ERROR_CODES,
  HOST_READY_TIMEOUT,
  HOST_READY_TYPE,
  INTENT_ACTIONS,
  INTENT_PERMISSIONS,
  METHOD_PERMISSIONS,
  PERMISSION_SCOPES,
  RPC_METHODS,
  SPHERE_CONNECT_NAMESPACE,
  SPHERE_CONNECT_VERSION,
  SPHERE_NETWORKS,
  WALLET_EVENTS,
  createRequestId,
  hasIntentPermission,
  hasMethodPermission,
  isSphereConnectMessage,
  validatePermissions
};
//# sourceMappingURL=@unicitylabs_sphere-sdk_connect.js.map
