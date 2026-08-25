export const covenantAbi = [
  'function createFacility(address borrower,uint256 trancheSize,uint64 maturityCreditcoinBlock) payable returns (uint256 facilityId)',
  'function acceptCovenant(uint256 covenantId)',
  'function cancelProposedCovenant(uint256 covenantId)',
  'function draw(uint256 facilityId,uint256 amount)',
  'function createCovenant(uint256 facilityId,uint64 chainKey,address token,address recipient,uint256 requiredAmount,uint64 startSourceBlock,uint64 endSourceBlock,uint64 proofDeadlineCreditcoinBlock,uint64 freezeFrontierMarginSourceBlocks) returns (uint256 covenantId)',
  'function freezeExpiredCovenant(uint256 covenantId)',
  'function closeFacility(uint256 facilityId)',
  'function submitEvidence(uint256 covenantId,uint64 chainKey,uint64 blockHeight,bytes encodedTransaction,bytes32 merkleRoot,(bytes32 hash,bool isLeft)[] siblings,bytes32 lowerEndpointDigest,bytes32[] continuityRoots) returns (bytes32 queryId,uint256 matchedAmount)',
  'function facilities(uint256) view returns (address lender,address borrower,uint256 creditLimit,uint256 trancheSize,uint256 unlocked,uint256 drawn,uint256 activeCovenantId,uint64 maturityCreditcoinBlock,uint8 status)',
  'function covenants(uint256) view returns (uint256 facilityId,uint64 chainKey,address token,address payer,address recipient,uint256 requiredAmount,uint256 verifiedAmount,uint64 startSourceBlock,uint64 endSourceBlock,uint64 proofDeadlineCreditcoinBlock,uint64 freezeFrontierMarginSourceBlocks,uint8 status)',
  'function availableToDraw(uint256) view returns (uint256)',
  'function isFreezable(uint256 covenantId) view returns (bool)',
  'event FacilityCreated(uint256 indexed facilityId,address indexed lender,address indexed borrower,uint256 creditLimit,uint256 trancheSize,uint256 initiallyUnlocked,uint64 maturityCreditcoinBlock)',
  'event CovenantAccepted(uint256 indexed covenantId,uint256 indexed facilityId,address indexed borrower)',
  'event CovenantCreated(uint256 indexed covenantId,uint256 indexed facilityId,uint64 indexed chainKey,address token,address payer,address recipient,uint256 requiredAmount,uint64 startSourceBlock,uint64 endSourceBlock,uint64 proofDeadlineCreditcoinBlock)',
  'event EvidenceAccepted(uint256 indexed covenantId,bytes32 indexed queryId,uint64 indexed sourceBlock,uint256 matchedAmount,uint256 verifiedAmount)',
  'event CovenantSatisfied(uint256 indexed covenantId,uint256 indexed facilityId,uint256 newUnlockedAmount)',
] as const;

export const erc20Abi = [
  'function transfer(address to,uint256 value) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'event Transfer(address indexed from,address indexed to,uint256 value)',
] as const;
