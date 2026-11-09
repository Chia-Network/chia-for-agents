// ─── RPC Method Catalog ───
const METHODS = [
  {cat:"Blockchain State", name:"get_blockchain_state", params:{}, desc:"Get the current blockchain state"},
  {cat:"Blockchain State", name:"get_network_info", params:{}, desc:"Get network name and prefix"},

  {cat:"Blocks", name:"get_block", params:{header_hash:"0x6a9ad79186e95fee2fc215fafe2d0cddf6bf8bd22fad1a88986225b9d199e2de"}, desc:"Get a full block by header hash"},
  {cat:"Blocks", name:"get_block_record", params:{header_hash:"0x6a9ad79186e95fee2fc215fafe2d0cddf6bf8bd22fad1a88986225b9d199e2de"}, desc:"Get a block record by header hash"},
  {cat:"Blocks", name:"get_block_record_by_height", params:{height:8999003}, desc:"Get a block record by height"},
  {cat:"Blocks", name:"get_block_records", params:{start:8999000,end:8999005}, desc:"Get block records in a range"},
  {cat:"Blocks", name:"get_blocks", params:{start:8999000,end:8999002}, desc:"Get full blocks in a range"},
  {cat:"Blocks", name:"get_block_spends", params:{header_hash:"0x6a9ad79186e95fee2fc215fafe2d0cddf6bf8bd22fad1a88986225b9d199e2de"}, desc:"Get coin spends in a block"},
  {cat:"Blocks", name:"get_block_spends_with_conditions", params:{header_hash:"0x6a9ad79186e95fee2fc215fafe2d0cddf6bf8bd22fad1a88986225b9d199e2de"}, desc:"Get coin spends with parsed conditions"},
  {cat:"Blocks", name:"get_additions_and_removals", params:{header_hash:"0x6a9ad79186e95fee2fc215fafe2d0cddf6bf8bd22fad1a88986225b9d199e2de"}, desc:"Get coins added and removed in a block"},
  {cat:"Blocks", name:"get_unfinished_block_headers", params:{}, desc:"Get headers of unfinished blocks"},
  {cat:"Blocks", name:"get_block_count_metrics", params:{}, desc:"Get block count metrics"},

  {cat:"Coins", name:"get_coin_record_by_name", params:{name:"0xea12f3b6c6dbe3dba7e7fccf6ed38c076ad52ee0f17d2f81704c5059a77e5d91"}, desc:"Get a coin record by coin ID"},
  {cat:"Coins", name:"get_coin_records_by_names", params:{names:["0xea12f3b6c6dbe3dba7e7fccf6ed38c076ad52ee0f17d2f81704c5059a77e5d91"]}, desc:"Get coin records by multiple coin IDs"},
  {cat:"Coins", name:"get_coin_records_by_puzzle_hash", params:{puzzle_hash:"0xad704c74ad4ae0eec561d13ec418ff9463e56f9aec5f283a0bb48d18c8d9b0af",include_spent_coins:false}, desc:"Get coins by puzzle hash"},
  {cat:"Coins", name:"get_coin_records_by_puzzle_hashes", params:{puzzle_hashes:["0xad704c74ad4ae0eec561d13ec418ff9463e56f9aec5f283a0bb48d18c8d9b0af"],include_spent_coins:false}, desc:"Get coins by multiple puzzle hashes"},
  {cat:"Coins", name:"get_coin_records_by_hint", params:{hint:"0xad704c74ad4ae0eec561d13ec418ff9463e56f9aec5f283a0bb48d18c8d9b0af",include_spent_coins:false}, desc:"Get coins by hint"},
  {cat:"Coins", name:"get_coin_records_by_parent_ids", params:{parent_ids:["0xccd5bb71183532bff220ba46c268991a00000000000000000000000000895056"]}, desc:"Get coins by parent coin IDs"},
  {cat:"Coins", name:"get_puzzle_and_solution", params:{coin_id:"0x56deb96fd3122b7d84b6102b5fb8c28ffde4e4ea70481e3f4d811ac17f2611dc",height:8999003}, desc:"Get puzzle and solution for a spent coin"},

  {cat:"Coinset Extended ⚡", name:"get_puzzle_and_solution_with_conditions", params:{coin_id:"0x56deb96fd3122b7d84b6102b5fb8c28ffde4e4ea70481e3f4d811ac17f2611dc",height:8999003}, desc:"Puzzle, solution & parsed conditions (Coinset-only)", coinsetOnly:true},
  {cat:"Coinset Extended ⚡", name:"get_memos_by_coin_name", params:{name:"0x56deb96fd3122b7d84b6102b5fb8c28ffde4e4ea70481e3f4d811ac17f2611dc"}, desc:"Get memos attached to a coin (Coinset-only)", coinsetOnly:true},
  {cat:"Coinset Extended ⚡", name:"get_coin_records_by_hints", params:{hints:["0xad704c74ad4ae0eec561d13ec418ff9463e56f9aec5f283a0bb48d18c8d9b0af"],include_spent_coins:false}, desc:"Get coins by multiple hints (Coinset-only)", coinsetOnly:true},

  {cat:"Mempool", name:"get_all_mempool_tx_ids", params:{}, desc:"Get all transaction IDs in mempool"},
  {cat:"Mempool", name:"get_all_mempool_items", params:{}, desc:"Get all mempool items (large response)"},
  {cat:"Mempool", name:"get_mempool_item_by_tx_id", params:{tx_id:""}, desc:"Get a mempool item by transaction ID (needs live tx ID)"},
  {cat:"Mempool", name:"get_mempool_items_by_coin_name", params:{coin_name:"0xea12f3b6c6dbe3dba7e7fccf6ed38c076ad52ee0f17d2f81704c5059a77e5d91"}, desc:"Get mempool items involving a coin"},
  {cat:"Mempool", name:"get_fee_estimate", params:{target_times:[60,120,300],cost:11000000}, desc:"Estimate fees for target confirmation times"},

  {cat:"Network", name:"get_network_space", params:{newer_block_header_hash:"0x6a9ad79186e95fee2fc215fafe2d0cddf6bf8bd22fad1a88986225b9d199e2de",older_block_header_hash:"0x2fe4a9a2b8c5ddca8a83f24eaddffb9c7f048a0e651cfa3628127f0b05199f63"}, desc:"Estimate network space between two blocks"},
];

// ─── Walkthrough Definitions ───
const WALKTHROUGHS = [
  {
    id: 'check_balance',
    title: '💰 Check a Balance',
    description: 'Convert a Chia address to its puzzle hash, find all unspent coins, and compute the total balance.',
    steps: [
      {
        label: 'Decode the address',
        type: 'utility',
        tool: 'address_decode',
        description: 'Convert a bech32m address (xch1...) into a puzzle hash. The puzzle hash is what the blockchain uses to identify coin ownership.',
        prefill: { address: 'xch144cyca9dftswa3tp6ylvgx8lj3372mu6a30jswstkjx33jxekzhs5a995k' },
        extract: { puzzleHash: 'puzzle_hash' }
      },
      {
        label: 'Find unspent coins',
        type: 'rpc',
        method: 'get_coin_records_by_puzzle_hash',
        description: 'Query the blockchain for all unspent coins controlled by this puzzle hash.',
        prefill: { puzzle_hash: '{{puzzleHash}}', include_spent_coins: false },
        extract: { coins: 'coin_records' }
      },
      {
        label: 'Sum the balance',
        type: 'compute',
        fn: 'sum_balance',
        description: 'Add up all coin amounts. Each coin holds some amount of mojos (1 XCH = 1,000,000,000,000 mojos).'
      }
    ]
  },
  {
    id: 'trace_coin',
    title: '🔗 Trace a Coin\'s History',
    description: 'Start from a coin and follow its parent chain to see where the value came from.',
    steps: [
      {
        label: 'Look up the coin',
        type: 'rpc',
        method: 'get_coin_record_by_name',
        description: 'Fetch a coin record by its unique coin ID. This returns the coin\'s parent, puzzle hash, amount, and spend status.',
        prefill: { name: '0x56deb96fd3122b7d84b6102b5fb8c28ffde4e4ea70481e3f4d811ac17f2611dc' },
        extract: { parentId: 'coin_record.coin.parent_coin_info', coinAmount: 'coin_record.coin.amount', coinHeight: 'coin_record.confirmed_block_index', coinSpent: 'coin_record.spent' }
      },
      {
        label: 'Look up the parent',
        type: 'rpc',
        method: 'get_coin_record_by_name',
        description: 'Fetch the parent coin to see where this coin\'s value originated.',
        prefill: { name: '{{parentId}}' },
        extract: { grandparentId: 'coin_record.coin.parent_coin_info', parentAmount: 'coin_record.coin.amount', parentHeight: 'coin_record.confirmed_block_index' }
      },
      {
        label: 'Look up the grandparent',
        type: 'rpc',
        method: 'get_coin_record_by_name',
        description: 'Go one more level up the chain. You can keep going until you reach a coinbase coin (farming reward).',
        prefill: { name: '{{grandparentId}}' },
        extract: { greatGrandparentId: 'coin_record.coin.parent_coin_info', grandparentAmount: 'coin_record.coin.amount', grandparentHeight: 'coin_record.confirmed_block_index' }
      },
      {
        label: 'View the lineage',
        type: 'compute',
        fn: 'show_lineage',
        description: 'See the chain of coins traced so far, from grandparent to child.'
      }
    ]
  },
  {
    id: 'explore_block',
    title: '🧱 Explore a Block',
    description: 'Get the current blockchain state, pick a recent block, and see what coins moved in it.',
    steps: [
      {
        label: 'Get blockchain state',
        type: 'rpc',
        method: 'get_blockchain_state',
        description: 'Query the current state of the blockchain, including the peak (latest) block height.',
        prefill: {},
        extract: { peakHeight: 'blockchain_state.peak.height', peakHash: 'blockchain_state.peak.header_hash' }
      },
      {
        label: 'Get a block record',
        type: 'rpc',
        method: 'get_block_record_by_height',
        description: 'Fetch the block record at a specific height. This shows the block\'s header hash, farmer, fees, and whether it\'s a transaction block.',
        prefill: { height: 8999003 },
        extract: { blockHash: 'block_record.header_hash', blockFees: 'block_record.fees', blockFarmer: 'block_record.farmer_puzzle_hash' }
      },
      {
        label: 'See coin movements',
        type: 'rpc',
        method: 'get_additions_and_removals',
        description: 'Get all coins created (additions) and destroyed (removals) in this block. This is the core of how value moves on Chia.',
        prefill: { header_hash: '{{blockHash}}' },
        extract: { additions: 'additions', removals: 'removals' }
      },
      {
        label: 'Summarize the block',
        type: 'compute',
        fn: 'summarize_block',
        description: 'See a summary of the block\'s activity.'
      }
    ]
  },
  {
    id: 'verify_coin_id',
    title: '🔐 Verify a Coin ID',
    description: 'Fetch a coin and independently recompute its ID from its components to verify it matches.',
    steps: [
      {
        label: 'Fetch the coin',
        type: 'rpc',
        method: 'get_coin_record_by_name',
        description: 'Look up a coin by its ID. We\'ll use the parent_coin_info, puzzle_hash, and amount to recompute the ID.',
        prefill: { name: '0xea12f3b6c6dbe3dba7e7fccf6ed38c076ad52ee0f17d2f81704c5059a77e5d91' },
        extract: { originalCoinId: '_input_name', parent: 'coin_record.coin.parent_coin_info', ph: 'coin_record.coin.puzzle_hash', amount: 'coin_record.coin.amount' }
      },
      {
        label: 'Recompute the coin ID',
        type: 'utility',
        tool: 'coin_id',
        description: 'Compute SHA256(parent_coin_info + puzzle_hash + amount). This is how Chia derives coin IDs — no separate ID field exists, every coin\'s identity is a hash of its components.',
        prefill: { parent: '{{parent}}', puzzle_hash: '{{ph}}', amount: '{{amount}}' },
        extract: { computedId: 'coin_id' }
      },
      {
        label: 'Compare',
        type: 'compute',
        fn: 'verify_match',
        description: 'Check if the computed coin ID matches the original. If they match, the coin data is authentic.'
      }
    ]
  }
];

